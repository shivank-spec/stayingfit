-- Stayingfit: assistant privileges, live updates, staff blood-test uploads
-- Run once in Supabase > SQL Editor (safe to re-run).

-- 1. Live updates: the team's screens hear about client and diet changes straight away
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.clients';    exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.diets';      exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.blood_tests'; exception when duplicate_object or undefined_table then null; end;
  end if;
end $$;

-- 2. The assistant can edit client details, renewals and detox dates (same as the coach)
drop policy if exists "clients: coach updates" on public.clients;
create policy "clients: staff updates" on public.clients for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- 3. The assistant can delete clients (same as the coach)
create or replace function public.delete_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not (public.is_staff() or public.is_console()) then raise exception 'Only the team can delete clients'; end if;
  select user_id into uid from public.clients where id = p_client;
  if uid is null then raise exception 'Client not found'; end if;
  delete from auth.users where id = uid;  -- cascades to profile, client, logs, chats
end $$;

-- 4. The assistant can upload blood-test reports for a client
drop policy if exists "reports: staff uploads" on storage.objects;
create policy "reports: staff uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and public.is_staff());

create or replace function public.staff_add_blood_test(p_client uuid, p_d date, p_hba1c numeric default null,
  p_ldl int default null, p_hdl int default null, p_tg int default null, p_file text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.clients;
begin
  if not (public.is_staff() or public.is_console()) then raise exception 'Only the team can add reports for clients'; end if;
  select * into c from public.clients where id = p_client;
  if not found then raise exception 'Client not found'; end if;
  if p_d is null or p_d > public.today_ist() then raise exception 'The test date can''t be in the future'; end if;
  if p_d < public.today_ist() - 730 then raise exception 'That test is more than two years old'; end if;
  if p_hba1c is null and p_ldl is null and p_hdl is null and p_tg is null and p_file is null then
    raise exception 'Enter at least one result or attach the report';
  end if;
  if p_file is not null and p_file !~ ('^' || c.id::text || '/[A-Za-z0-9._-]+$') then raise exception 'Report file does not belong to this client'; end if;
  insert into public.blood_tests (client_id, d, hba1c, ldl, hdl, tg, file_path)
    values (p_client, p_d, p_hba1c, p_ldl, p_hdl, p_tg, p_file);
  return jsonb_build_object('ok', true);
end $$;

-- 5. The assistant can view, reuse (send again) and delete diets, same as the coach
create or replace function public.save_diet(p_client uuid, p_start date, p_meals jsonb, p_notes text default null, p_morning text default null, p_night text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid; t date := public.today_ist(); m jsonb;
begin
  if not public.is_staff() then raise exception 'Only the team can write diets'; end if;
  if not exists (select 1 from public.clients where id = p_client) then raise exception 'Client not found'; end if;
  if p_start is null or p_start < t - 60 or p_start > t + 30 then raise exception 'Pick a start date close to today'; end if;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' or jsonb_array_length(p_meals) not between 4 and 5 then raise exception 'A diet has five meals'; end if;
  select jsonb_agg(left(coalesce(v, ''), 400)) into m from jsonb_array_elements_text(p_meals) v;
  if not exists (select 1 from jsonb_array_elements_text(m) v where length(trim(v)) > 0) then raise exception 'Write at least one meal'; end if;
  insert into public.diets (client_id, start_date, meals, notes, morning, night)
    values (p_client, p_start, m, nullif(left(trim(coalesce(p_notes, '')), 600), ''), nullif(left(trim(coalesce(p_morning, '')), 400), ''), nullif(left(trim(coalesce(p_night, '')), 400), ''))
    on conflict (client_id, start_date) do update set meals = excluded.meals, notes = excluded.notes, morning = excluded.morning, night = excluded.night
    returning id into did;
  return did;
end $$;

create or replace function public.delete_diet(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only the team can delete diets'; end if;
  delete from public.diets where id = p_id;
end $$;

revoke all on function public.save_diet(uuid, date, jsonb, text, text, text) from public, anon;
grant execute on function public.save_diet(uuid, date, jsonb, text, text, text) to authenticated;
revoke all on function public.delete_diet(uuid) from public, anon;
grant execute on function public.delete_diet(uuid) to authenticated;

revoke all on function public.staff_add_blood_test(uuid, date, numeric, int, int, int, text) from public, anon;
grant execute on function public.staff_add_blood_test(uuid, date, numeric, int, int, int, text) to authenticated;
grant execute on function public.delete_client(uuid) to authenticated;

-- 6. Detox menu: the team uploads a menu for each client (text, a file of any kind, or both).
--    The client reads it; only the team writes it.
create table if not exists public.detox_menus (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  body       text check (body is null or length(body) <= 4000),
  file_path  text,
  file_name  text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.detox_menus enable row level security;
drop policy if exists "detox_menus: own or staff" on public.detox_menus;
create policy "detox_menus: own or staff" on public.detox_menus for select to authenticated
  using (client_id = public.my_client_id() or public.is_staff());
revoke all on public.detox_menus from anon, authenticated;
grant select on public.detox_menus to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
  values ('detox', 'detox', false, 52428800)
  on conflict (id) do update set file_size_limit = 52428800, allowed_mime_types = null;

drop policy if exists "detox: client reads own" on storage.objects;
create policy "detox: client reads own" on storage.objects for select to authenticated
  using (bucket_id = 'detox' and ((storage.foldername(name))[1] = public.my_client_id()::text or public.is_staff()));
drop policy if exists "detox: staff uploads" on storage.objects;
create policy "detox: staff uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'detox' and public.is_staff());
drop policy if exists "detox: staff deletes" on storage.objects;
create policy "detox: staff deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'detox' and public.is_staff());

create or replace function public.save_detox_menu(p_client uuid, p_body text default null, p_file text default null, p_file_name text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b text := nullif(left(trim(coalesce(p_body, '')), 4000), '');
begin
  if not (public.is_staff() or public.is_console()) then raise exception 'Only the team can upload a detox menu'; end if;
  if not exists (select 1 from public.clients where id = p_client) then raise exception 'Client not found'; end if;
  if b is null and p_file is null then raise exception 'Write the menu or attach a file'; end if;
  if p_file is not null and p_file !~ ('^' || p_client::text || '/[^/]+$') then raise exception 'File does not belong to this client'; end if;
  insert into public.detox_menus (client_id, body, file_path, file_name, updated_at, updated_by)
    values (p_client, b, p_file, nullif(left(coalesce(p_file_name, ''), 200), ''), now(), auth.uid())
    on conflict (client_id) do update set body = excluded.body,
      file_path = coalesce(excluded.file_path, public.detox_menus.file_path),
      file_name = coalesce(excluded.file_name, public.detox_menus.file_name),
      updated_at = now(), updated_by = auth.uid();
end $$;

create or replace function public.delete_detox_menu(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare old_path text;
begin
  if not (public.is_staff() or public.is_console()) then raise exception 'Only the team can remove a detox menu'; end if;
  select file_path into old_path from public.detox_menus where client_id = p_client;
  delete from public.detox_menus where client_id = p_client;
  if old_path is not null then delete from storage.objects where bucket_id = 'detox' and name = old_path; end if;
end $$;

revoke all on function public.save_detox_menu(uuid, text, text, text) from public, anon;
grant execute on function public.save_detox_menu(uuid, text, text, text) to authenticated;
revoke all on function public.delete_detox_menu(uuid) from public, anon;
grant execute on function public.delete_detox_menu(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.detox_menus'; exception when duplicate_object then null; end;
  end if;
end $$;
