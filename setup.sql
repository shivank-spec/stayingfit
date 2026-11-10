-- =====================================================================
-- Stayingfit · complete database setup
-- Supabase → SQL Editor → paste this whole file → Run. Safe to run again.
--
-- Logins are username + password. Nobody can sign themselves up:
--   * staff logins (coach, assistant) are made in the SQL Editor with
--     create_staff_login(...)  (see README)
--   * client logins are made by the coach from her dashboard, or in the
--     SQL Editor with add_client(...)
-- Every new login gets a temporary password and must choose their own the
-- first time they sign in.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  role           text not null check (role in ('client','coach','assistant')),
  display_name   text not null check (length(display_name) between 1 and 80),
  must_change_pw boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  name              text not null check (length(name) between 1 and 80),
  tier              text not null default 'Weekly' check (tier in ('Hand-holding','Weekly')),
  start_kg          numeric(5,1) not null check (start_kg between 30 and 250),
  goal_kg           numeric(5,1) check (goal_kg between 30 and 250),
  plan_start        date not null default ((now() at time zone 'Asia/Kolkata')::date),
  plan_end          date not null default ((now() at time zone 'Asia/Kolkata')::date + 30),
  diet_anchor       date not null default ((now() at time zone 'Asia/Kolkata')::date),
  detox_freq        int  not null default 22 check (detox_freq between 15 and 40),
  last_detox        date not null default ((now() at time zone 'Asia/Kolkata')::date),
  detox_done        int  not null default 0,
  kcal_target       int  not null default 1500 check (kcal_target between 800 and 4000),
  stars             int  not null default 0,
  streak            int  not null default 0,
  last_log_date     date,
  badges            jsonb not null default '{}'::jsonb,
  consent_at        timestamptz,
  health_consent_at timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.weights (
  client_id uuid not null references public.clients(id) on delete cascade,
  d         date not null,
  kg        numeric(5,1) not null check (kg between 30 and 250),
  primary key (client_id, d)
);

create table if not exists public.day_logs (
  client_id uuid not null references public.clients(id) on delete cascade,
  d         date not null,
  water     int  not null default 0 check (water between 0 and 10),
  meals     jsonb not null default '[]'::jsonb,
  exercise  jsonb not null default '[]'::jsonb,
  photos    jsonb not null default '[]'::jsonb,
  done      jsonb not null default '{}'::jsonb,
  primary key (client_id, d)
);

create table if not exists public.diet_plans (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  days       jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) = 4),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_tests (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  d          date not null,
  hba1c      numeric(3,1) check (hba1c between 3 and 20),
  ldl        int check (ldl between 10 and 500),
  hdl        int check (hdl between 5 and 200),
  tg         int check (tg between 10 and 2000),
  file_path  text,
  created_at timestamptz not null default now()
);
create index if not exists blood_tests_client_d on public.blood_tests (client_id, d);

create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('dm','family')),
  client_id       uuid unique references public.clients(id) on delete cascade,
  title           text not null,
  last_at         timestamptz not null default now(),
  last_from_staff boolean not null default true,
  last_text       text,
  created_at      timestamptz not null default now()
);

create table if not exists public.thread_members (
  thread_id uuid not null references public.threads(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  primary key (thread_id, client_id)
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads(id) on delete cascade,
  sender      uuid not null,
  sender_name text not null,
  from_staff  boolean not null default false,
  body        text not null check (length(body) between 1 and 1000),
  reactions   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists messages_thread_time on public.messages (thread_id, created_at);

-- ---------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------
create or replace function public.today_ist() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.login_email(p_username text) returns text
language sql immutable as $$ select lower(trim(p_username)) || '@stayingfit.app' $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('coach','assistant') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'coach' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid()
$$;

-- true only in the Supabase SQL Editor, never for a request from the app
create or replace function public.is_console() returns boolean
language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '') = ''
     and session_user not in ('authenticator', 'anon', 'authenticated')
$$;

create or replace function public.can_see_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.thread_members m where m.thread_id = p_thread and m.client_id = public.my_client_id()
  )
$$;

create or replace function public.my_display_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone')
$$;

-- ---------------------------------------------------------------------
-- logins (internal; only reachable through the checked functions below)
-- ---------------------------------------------------------------------
create or replace function public._check_password(p text) returns void
language plpgsql immutable as $$
begin
  if p is null or length(p) < 8 then raise exception 'Passwords need at least 8 characters'; end if;
  if length(p) > 72 then raise exception 'Passwords can be at most 72 characters'; end if;
end $$;

create or replace function public._create_login(p_username text, p_password text, p_role text, p_display text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); u text := lower(trim(coalesce(p_username, ''))); em text;
begin
  if u !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Usernames are 3 to 30 characters: small letters, numbers, dots, dashes or underscores, starting with a letter or number';
  end if;
  perform public._check_password(p_password);
  if p_role not in ('client','coach','assistant') then raise exception 'Unknown role %', p_role; end if;
  if coalesce(length(trim(p_display)), 0) = 0 then raise exception 'Enter a name'; end if;
  em := public.login_email(u);
  if exists (select 1 from public.profiles where username = u) or exists (select 1 from auth.users where lower(email) = em) then
    raise exception 'The username "%" is taken. Try another', u;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    crypt(p_password, gen_salt('bf', 10)), now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, now(), now());

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());

  insert into public.profiles (id, username, role, display_name, must_change_pw)
  values (uid, u, p_role, left(trim(p_display), 80), true);
  return uid;
end $$;

-- SQL Editor only: make the coach and assistant logins
create or replace function public.create_staff_login(p_username text, p_password text, p_role text, p_display_name text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_console() then raise exception 'Run this from the Supabase SQL Editor'; end if;
  if p_role not in ('coach','assistant') then raise exception 'Role must be coach or assistant'; end if;
  perform public._create_login(p_username, p_password, p_role, p_display_name);
  return 'Login created: ' || lower(trim(p_username)) || ' (' || p_role || '). They choose their own password at first sign-in.';
end $$;

-- coach dashboard or SQL Editor: add a client with their login
create or replace function public.add_client(p_username text, p_password text, p_name text, p_start_kg numeric,
  p_goal_kg numeric default null, p_tier text default 'Weekly', p_days int default 30) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid; cid uuid; t date := public.today_ist();
begin
  if not (public.is_coach() or public.is_console()) then raise exception 'Only the coach can add clients'; end if;
  if coalesce(length(trim(p_name)), 0) = 0 then raise exception 'Enter the client''s name'; end if;
  if p_start_kg is null or p_start_kg not between 30 and 250 then raise exception 'Start weight must be between 30 and 250 kg'; end if;
  if p_goal_kg is not null and p_goal_kg not between 30 and 250 then raise exception 'Goal weight must be between 30 and 250 kg'; end if;
  if p_tier not in ('Hand-holding','Weekly') then raise exception 'Check-ins must be Hand-holding or Weekly'; end if;
  if p_days is null or p_days not between 7 and 365 then raise exception 'Plan length must be 7 to 365 days'; end if;
  uid := public._create_login(p_username, p_password, 'client', p_name);
  insert into public.clients (user_id, name, tier, start_kg, goal_kg, plan_start, plan_end, diet_anchor, last_detox)
  values (uid, left(trim(p_name), 80), p_tier, round(p_start_kg, 1), round(p_goal_kg, 1), t, t + p_days, t, t)
  returning id into cid;
  return cid;
end $$;

-- coach (for clients and the assistant) or SQL Editor (anyone): set a new temporary password
create or replace function public.reset_password(p_username text, p_new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare p public.profiles;
begin
  select * into p from public.profiles where username = lower(trim(p_username));
  if not found then raise exception 'No login called "%"', p_username; end if;
  if not (public.is_console() or (public.is_coach() and p.role in ('client','assistant'))) then
    raise exception 'You can''t reset this password';
  end if;
  perform public._check_password(p_new_password);
  update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf', 10)), updated_at = now() where id = p.id;
  update public.profiles set must_change_pw = true where id = p.id;
  delete from auth.sessions where user_id = p.id;  -- signs them out on other devices
end $$;

-- anyone signed in: change their own password
create or replace function public.change_my_password(p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select encrypted_password into h from auth.users where id = auth.uid();
  if h is null then raise exception 'Not signed in'; end if;
  if crypt(coalesce(p_old, ''), h) <> h then raise exception 'Your current password is wrong'; end if;
  perform public._check_password(p_new);
  if p_new = p_old then raise exception 'Choose a password different from the old one'; end if;
  update auth.users set encrypted_password = crypt(p_new, gen_salt('bf', 10)), updated_at = now() where id = auth.uid();
  update public.profiles set must_change_pw = false where id = auth.uid();
end $$;

-- coach: delete a client, their login and all their logs
create or replace function public.delete_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not (public.is_coach() or public.is_console()) then raise exception 'Only the coach can delete clients'; end if;
  select user_id into uid from public.clients where id = p_client;
  if uid is null then raise exception 'Client not found'; end if;
  delete from auth.users where id = uid;  -- cascades to profile, client, logs, chats
end $$;

-- SQL Editor only: remove any login (e.g. an assistant who leaves)
create or replace function public.delete_login(p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_console() then raise exception 'Run this from the Supabase SQL Editor'; end if;
  select id into uid from public.profiles where username = lower(trim(p_username));
  if uid is null then raise exception 'No login called "%"', p_username; end if;
  delete from auth.users where id = uid;
  return 'Deleted ' || lower(trim(p_username));
end $$;

-- ---------------------------------------------------------------------
-- row level security: who can read what
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.weights        enable row level security;
alter table public.day_logs       enable row level security;
alter table public.diet_plans     enable row level security;
alter table public.blood_tests    enable row level security;
alter table public.threads        enable row level security;
alter table public.thread_members enable row level security;
alter table public.messages       enable row level security;

drop policy if exists "profiles: own or staff" on public.profiles;
create policy "profiles: own or staff" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "clients: own or staff" on public.clients;
create policy "clients: own or staff" on public.clients for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "clients: coach updates" on public.clients;
create policy "clients: coach updates" on public.clients for update to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "weights: own or staff" on public.weights;
create policy "weights: own or staff" on public.weights for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
drop policy if exists "day_logs: own or staff" on public.day_logs;
create policy "day_logs: own or staff" on public.day_logs for select to authenticated using (client_id = public.my_client_id() or public.is_staff());

drop policy if exists "diet_plans: own or staff" on public.diet_plans;
create policy "diet_plans: own or staff" on public.diet_plans for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
drop policy if exists "diet_plans: coach inserts" on public.diet_plans;
create policy "diet_plans: coach inserts" on public.diet_plans for insert to authenticated with check (public.is_coach());
drop policy if exists "diet_plans: coach updates" on public.diet_plans;
create policy "diet_plans: coach updates" on public.diet_plans for update to authenticated using (public.is_coach()) with check (public.is_coach());

drop policy if exists "tests: own or staff" on public.blood_tests;
create policy "tests: own or staff" on public.blood_tests for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
drop policy if exists "threads: members or staff" on public.threads;
create policy "threads: members or staff" on public.threads for select to authenticated using (public.can_see_thread(id));
drop policy if exists "thread_members: members or staff" on public.thread_members;
create policy "thread_members: members or staff" on public.thread_members for select to authenticated using (public.can_see_thread(thread_id));
drop policy if exists "messages: members or staff" on public.messages;
create policy "messages: members or staff" on public.messages for select to authenticated using (public.can_see_thread(thread_id));

-- table rights: read-only for signed-in users, except the few edits the coach makes directly.
-- Everything else goes through the checked functions below.
do $$ declare t text; begin
  foreach t in array array['profiles','clients','weights','day_logs','diet_plans','blood_tests','threads','thread_members','messages'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
grant insert, update on public.diet_plans to authenticated;
grant update (name, tier, goal_kg, plan_end, diet_anchor, detox_freq, kcal_target) on public.clients to authenticated;

-- ---------------------------------------------------------------------
-- client actions
-- ---------------------------------------------------------------------
create or replace function public.give_consent() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.clients set consent_at = coalesce(consent_at, now()) where user_id = auth.uid();
  if not found then raise exception 'This login is not a client'; end if;
end $$;

create or replace function public.give_health_consent() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.clients set health_consent_at = coalesce(health_consent_at, now()) where user_id = auth.uid();
  if not found then raise exception 'This login is not a client'; end if;
end $$;

create or replace function public.log_weight(p_kg numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.clients; t date := public.today_ist(); gap int; new_streak int; gained int := 0;
  newb text[] := '{}'; b text;
begin
  select * into c from public.clients where user_id = auth.uid() for update;
  if not found then raise exception 'This login is not a client'; end if;
  if c.consent_at is null then raise exception 'Please agree to the privacy notice first'; end if;
  if p_kg is null or p_kg < 30 or p_kg > 250 then raise exception 'Weight must be between 30 and 250 kg'; end if;

  insert into public.weights (client_id, d, kg) values (c.id, t, round(p_kg, 1))
    on conflict (client_id, d) do update set kg = excluded.kg;

  if c.last_log_date is distinct from t then
    gap := case when c.last_log_date is null then 99 else t - c.last_log_date end;
    new_streak := case when gap = 1 then c.streak + 1 else 1 end;
    gained := 1;
    if new_streak >= 7  and not (c.badges ? 'streak7') then newb := newb || 'streak7'::text; end if;
    if new_streak >= 30 and not (c.badges ? 'king')    then newb := newb || 'king'::text;    end if;
    foreach b in array newb loop c.badges := c.badges || jsonb_build_object(b, t); end loop;
    gained := gained + 5 * coalesce(array_length(newb, 1), 0);
    update public.clients set streak = new_streak, last_log_date = t, stars = stars + gained, badges = c.badges where id = c.id;
  end if;
  return jsonb_build_object('gained', gained, 'badges', to_jsonb(newb));
end $$;

create or replace function public.log_day(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.clients; l public.day_logs; t date := public.today_ist();
  base int := 0; gained int; ex_min int; perfect boolean := false; newb text[] := '{}'; b text; m int; k int;
begin
  select * into c from public.clients where user_id = auth.uid() for update;
  if not found then raise exception 'This login is not a client'; end if;
  if c.consent_at is null then raise exception 'Please agree to the privacy notice first'; end if;
  p_payload := coalesce(p_payload, '{}'::jsonb);

  insert into public.day_logs (client_id, d) values (c.id, t) on conflict do nothing;
  select * into l from public.day_logs where client_id = c.id and d = t for update;

  if p_action = 'water' then
    l.water := greatest(0, least(10, coalesce((p_payload->>'n')::int, 0)));
  elsif p_action = 'meal_add' then
    if jsonb_array_length(l.meals) >= 12 then raise exception 'That is plenty of meals for one day'; end if;
    k := (p_payload->>'k')::int;
    if k is null or k not between 0 and 3000 then raise exception 'Calories look wrong'; end if;
    l.meals := l.meals || jsonb_build_array(jsonb_build_object('n', left(coalesce(nullif(trim(p_payload->>'n'), ''), 'Meal'), 60), 'k', k, 't', left(coalesce(p_payload->>'t', ''), 12)));
  elsif p_action = 'meal_remove' then
    l.meals := l.meals - coalesce((p_payload->>'i')::int, -1);
  elsif p_action = 'exercise' then
    m := (p_payload->>'min')::int;
    if m is null or m not between 5 and 300 then raise exception 'Enter between 5 and 300 minutes'; end if;
    if coalesce(p_payload->>'type', '') not in ('Walk','Run','Yoga','Strength','Cycling','Dance') then raise exception 'Unknown activity'; end if;
    if jsonb_array_length(l.exercise) >= 10 then raise exception 'That is plenty of workouts for one day'; end if;
    l.exercise := jsonb_build_array(jsonb_build_object('type', p_payload->>'type', 'min', m, 't', left(coalesce(p_payload->>'t', ''), 12))) || l.exercise;
    base := case when jsonb_array_length(l.exercise) = 1 then 1 else 0 end;
  elsif p_action = 'photo' then
    if jsonb_array_length(l.photos) >= 6 then raise exception 'Up to 6 photos a day'; end if;
    if coalesce(p_payload->>'path', '') !~ ('^' || c.id::text || '/[0-9-]{10}/[A-Za-z0-9-]+\.jpg$') then raise exception 'Photo path does not belong to you'; end if;
    l.photos := l.photos || jsonb_build_array(jsonb_build_object('path', p_payload->>'path', 't', left(coalesce(p_payload->>'t', ''), 12)));
    base := 1;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  select coalesce(sum((e->>'min')::int), 0) into ex_min from jsonb_array_elements(l.exercise) e;
  gained := base;
  if l.water >= 10 and not (l.done ? 'water') then l.done := l.done || '{"water":true}'; gained := gained + 2; end if;
  if jsonb_array_length(l.meals) >= 3 and not (l.done ? 'meals') then l.done := l.done || '{"meals":true}'; gained := gained + 2; end if;
  if ex_min >= 30 and not (l.done ? 'move') then l.done := l.done || '{"move":true}'; gained := gained + 2; end if;
  if (l.done ? 'water') and (l.done ? 'meals') and (l.done ? 'move') and not (l.done ? 'bonus') then
    l.done := l.done || '{"bonus":true}'; gained := gained + 5; perfect := true;
  end if;
  if l.water >= 10 and not (c.badges ? 'water') then newb := newb || 'water'::text; end if;
  if jsonb_array_length(l.meals) >= 3 and not (c.badges ? 'meal') then newb := newb || 'meal'::text; end if;
  foreach b in array newb loop c.badges := c.badges || jsonb_build_object(b, t); end loop;
  gained := gained + 5 * coalesce(array_length(newb, 1), 0);

  update public.day_logs set water = l.water, meals = l.meals, exercise = l.exercise, photos = l.photos, done = l.done
    where client_id = c.id and d = t;
  if gained > 0 then
    update public.clients set stars = stars + gained, badges = c.badges where id = c.id;
  end if;
  return jsonb_build_object('gained', gained, 'badges', to_jsonb(newb), 'perfect', perfect);
end $$;

create or replace function public.add_blood_test(p_d date, p_hba1c numeric default null, p_ldl int default null,
  p_hdl int default null, p_tg int default null, p_file text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.clients; gained int := 0;
begin
  select * into c from public.clients where user_id = auth.uid() for update;
  if not found then raise exception 'This login is not a client'; end if;
  if c.health_consent_at is null then raise exception 'Please agree to share health results first'; end if;
  if p_d is null or p_d > public.today_ist() then raise exception 'The test date can''t be in the future'; end if;
  if p_d < public.today_ist() - 730 then raise exception 'That test is more than two years old'; end if;
  if p_hba1c is null and p_ldl is null and p_hdl is null and p_tg is null then raise exception 'Enter at least one result from your report'; end if;
  if p_file is not null and p_file !~ ('^' || c.id::text || '/[A-Za-z0-9._-]+$') then raise exception 'Report file does not belong to you'; end if;
  if (select count(*) from public.blood_tests where client_id = c.id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s a lot of reports for one day. Try again tomorrow';
  end if;
  insert into public.blood_tests (client_id, d, hba1c, ldl, hdl, tg, file_path) values (c.id, p_d, p_hba1c, p_ldl, p_hdl, p_tg, p_file);
  if not exists (select 1 from public.blood_tests where client_id = c.id and d = p_d and created_at < now()) then
    gained := 3; update public.clients set stars = stars + 3 where id = c.id;
  end if;
  return jsonb_build_object('gained', gained);
end $$;

-- leaderboard: first name, initials and progress only
create or replace function public.leaderboard()
returns table (client_id uuid, label text, initials text, is_me boolean, loss_pct numeric, past_pct numeric, stars int, streak int)
language plpgsql stable security definer set search_path = public as $$
declare t date := public.today_ist();
begin
  if public.my_client_id() is null and not public.is_staff() then return; end if;
  return query
  select c.id,
         split_part(c.name, ' ', 1) || coalesce(' ' || nullif(left(split_part(c.name, ' ', 2), 1), '') || '.', ''),
         upper(left(split_part(c.name, ' ', 1), 1) || left(split_part(c.name, ' ', 2), 1)),
         c.user_id = auth.uid(),
         round((c.start_kg - coalesce(cw.kg, c.start_kg)) / c.start_kg * 100, 2),
         round((c.start_kg - coalesce(pw.kg, c.start_kg)) / c.start_kg * 100, 2),
         c.stars,
         case when c.last_log_date >= t - 1 then c.streak else 0 end
  from public.clients c
  left join lateral (select kg from public.weights w where w.client_id = c.id order by d desc limit 1) cw on true
  left join lateral (select kg from public.weights w where w.client_id = c.id and w.d <= t - 7 order by d desc limit 1) pw on true
  where c.consent_at is not null;
end $$;

-- ---------------------------------------------------------------------
-- coach actions
-- ---------------------------------------------------------------------
create or replace function public.coach_mark_detox(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_coach() then raise exception 'Only the coach can do this'; end if;
  update public.clients set last_detox = public.today_ist(), detox_done = detox_done + 1 where id = p_client returning detox_done into n;
  if n is null then raise exception 'Client not found'; end if;
  if n >= 3 then
    update public.clients set badges = badges || jsonb_build_object('detox', public.today_ist()), stars = stars + 5
      where id = p_client and not (badges ? 'detox');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- messaging
-- ---------------------------------------------------------------------
create or replace function public.ensure_dm(p_client uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; tid uuid; cname text;
begin
  if public.is_staff() then cid := p_client; else cid := public.my_client_id(); end if;
  if cid is null then raise exception 'No client for this chat'; end if;
  select name into cname from public.clients where id = cid;
  if cname is null then raise exception 'Client not found'; end if;
  select id into tid from public.threads where client_id = cid;
  if tid is null then
    insert into public.threads (kind, client_id, title) values ('dm', cid, cname)
      on conflict (client_id) do nothing returning id into tid;
    if tid is null then select id into tid from public.threads where client_id = cid; end if;
    insert into public.thread_members (thread_id, client_id) values (tid, cid) on conflict do nothing;
  end if;
  return tid;
end $$;

create or replace function public.create_family_group(p_title text, p_clients uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid; n int;
begin
  if not public.is_coach() then raise exception 'Only the coach can create groups'; end if;
  if coalesce(length(trim(p_title)), 0) = 0 then raise exception 'Give the group a name'; end if;
  select count(*) into n from public.clients where id = any(p_clients);
  if n < 2 then raise exception 'Pick at least two clients for a family group'; end if;
  insert into public.threads (kind, title) values ('family', left(trim(p_title), 60)) returning id into tid;
  insert into public.thread_members (thread_id, client_id) select tid, id from public.clients where id = any(p_clients) on conflict do nothing;
  return tid;
end $$;

create or replace function public.send_message(p_thread uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare mid uuid; staff boolean := public.is_staff(); b text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or not public.can_see_thread(p_thread) then raise exception 'You are not part of this conversation'; end if;
  if length(b) = 0 then raise exception 'Write a message first'; end if;
  if length(b) > 1000 then raise exception 'Messages can be up to 1000 characters'; end if;
  if not staff and (select count(*) from public.messages where sender = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little, then try again';
  end if;
  insert into public.messages (thread_id, sender, sender_name, from_staff, body)
    values (p_thread, auth.uid(), public.my_display_name(), staff, b) returning id into mid;
  update public.threads set last_at = now(), last_from_staff = staff, last_text = left(b, 120) where id = p_thread;
  return mid;
end $$;

create or replace function public.react(p_message uuid, p_emoji text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.messages; arr jsonb; me text := auth.uid()::text;
begin
  if p_emoji not in ('👍','❤️','👏','🙏') then raise exception 'Unknown reaction'; end if;
  select * into m from public.messages where id = p_message for update;
  if not found or not public.can_see_thread(m.thread_id) then raise exception 'Message not found'; end if;
  arr := coalesce(m.reactions -> p_emoji, '[]'::jsonb);
  if arr ? me then
    arr := (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(arr) v where v <> me);
  else
    arr := arr || to_jsonb(me);
  end if;
  if jsonb_array_length(arr) = 0 then m.reactions := m.reactions - p_emoji; else m.reactions := jsonb_set(m.reactions, array[p_emoji], arr); end if;
  update public.messages set reactions = m.reactions where id = p_message;
  return m.reactions;
end $$;

-- staff: mark a conversation as handled without replying
create or replace function public.mark_thread_done(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only the team can do this'; end if;
  update public.threads set last_from_staff = true where id = p_thread;
end $$;

-- ---------------------------------------------------------------------
-- function rights
-- ---------------------------------------------------------------------
do $$ declare f text; begin
  -- nobody calls these from the app
  foreach f in array array['public._create_login(text, text, text, text)', 'public.create_staff_login(text, text, text, text)',
    'public.delete_login(text)', 'public._check_password(text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
  -- signed-in users only (each function checks who is calling)
  foreach f in array array['public.add_client(text, text, text, numeric, numeric, text, int)', 'public.reset_password(text, text)',
    'public.change_my_password(text, text)', 'public.delete_client(uuid)', 'public.give_consent()', 'public.give_health_consent()',
    'public.log_weight(numeric)', 'public.log_day(text, jsonb)', 'public.add_blood_test(date, numeric, int, int, int, text)',
    'public.leaderboard()', 'public.coach_mark_detox(uuid)', 'public.ensure_dm(uuid)', 'public.create_family_group(text, uuid[])',
    'public.send_message(uuid, text)', 'public.react(uuid, text)', 'public.mark_thread_done(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- live chat updates
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.threads';  exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- private file storage: meal photos and blood test reports
-- files live at <bucket>/<client id>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg']),
       ('reports', 'reports', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meal photos: client uploads own" on storage.objects;
create policy "meal photos: client uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = public.my_client_id()::text);
drop policy if exists "meal photos: read own or staff" on storage.objects;
create policy "meal photos: read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and ((storage.foldername(name))[1] = public.my_client_id()::text or public.is_staff()));

drop policy if exists "reports: client uploads own" on storage.objects;
create policy "reports: client uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = public.my_client_id()::text);
drop policy if exists "reports: read own or staff" on storage.objects;
create policy "reports: read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'reports' and ((storage.foldername(name))[1] = public.my_client_id()::text or public.is_staff()));
