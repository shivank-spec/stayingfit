-- =====================================================================
-- Stayingfit · complete database setup
-- Supabase → SQL Editor → paste this whole file → Run. Safe to run again.
--
-- Logins are username + password. Nobody can sign themselves up:
--   * staff logins (coach, assistant) are made in the SQL Editor with
--     create_staff_login(...)  (see README)
--   * client logins are made by the coach from her dashboard, or in the
--     SQL Editor with add_client(...)
-- Every new login gets a temporary password. The first time they sign in
-- they are asked whether they want to change their username and password.
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

-- anyone signed in: change their own username
create or replace function public.change_my_username(p_new text) returns text
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(coalesce(p_new, ''))); em text; me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if u !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Usernames are 3 to 30 characters: small letters, numbers, dots, dashes or underscores, starting with a letter or number';
  end if;
  if exists (select 1 from public.profiles where id = me and username = u) then return u; end if;
  em := public.login_email(u);
  if exists (select 1 from public.profiles where username = u) or exists (select 1 from auth.users where lower(email) = em) then
    raise exception 'The username "%" is taken. Try another', u;
  end if;
  update auth.users set email = em, updated_at = now() where id = me;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', em), updated_at = now()
    where user_id = me and provider = 'email';
  update public.profiles set username = u where id = me;
  return u;
end $$;

-- anyone signed in: keep the login they were given (answers "no" to the first sign-in question)
create or replace function public.keep_my_login() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
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
    'public.change_my_password(text, text)', 'public.change_my_username(text)', 'public.keep_my_login()', 'public.delete_client(uuid)', 'public.give_consent()', 'public.give_health_consent()',
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
    begin execute 'alter publication supabase_realtime add table public.photo_comments'; exception when duplicate_object or undefined_table then null; end;
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

-- =====================================================================
-- Update 2: separate coach / assistant chats, broadcast, 4-day diets,
-- daily liquids checklist. Safe to run again.
-- =====================================================================

-- ---------- tables ----------
alter table public.threads drop constraint if exists threads_kind_check;
alter table public.threads add constraint threads_kind_check check (kind in ('dm','asst','family'));
alter table public.threads drop constraint if exists threads_client_id_key;
create unique index if not exists threads_client_kind on public.threads (client_id, kind);
alter table public.messages add column if not exists broadcast boolean not null default false;
alter table public.weights add column if not exists at timestamptz not null default now();
alter table public.clients add column if not exists liquids_updated date;

create table if not exists public.diets (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  start_date date not null,
  meals      jsonb not null check (jsonb_typeof(meals) = 'array' and jsonb_array_length(meals) between 4 and 5),
  notes      text check (notes is null or length(notes) <= 600),
  created_at timestamptz not null default now(),
  unique (client_id, start_date)
);

-- diets written before the mid meal was added hold four meals; new ones hold five
alter table public.diets drop constraint if exists diets_meals_check;
alter table public.diets add constraint diets_meals_check check (jsonb_typeof(meals) = 'array' and jsonb_array_length(meals) between 4 and 5);

create table if not exists public.liquids (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null check (length(name) between 1 and 60),
  when_text  text not null default '' check (length(when_text) <= 60),
  sort       int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists liquids_client on public.liquids (client_id);

create table if not exists public.liquid_ticks (
  client_id uuid not null references public.clients(id) on delete cascade,
  d         date not null,
  liquid_id uuid not null references public.liquids(id) on delete cascade,
  at        timestamptz not null default now(),
  primary key (client_id, d, liquid_id)
);

alter table public.diets        enable row level security;
alter table public.liquids      enable row level security;
alter table public.liquid_ticks enable row level security;
drop policy if exists "diets: own or staff" on public.diets;
create policy "diets: own or staff" on public.diets for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
drop policy if exists "liquids: own or staff" on public.liquids;
create policy "liquids: own or staff" on public.liquids for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
drop policy if exists "liquid_ticks: own or staff" on public.liquid_ticks;
create policy "liquid_ticks: own or staff" on public.liquid_ticks for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
do $$ declare t text; begin
  foreach t in array array['diets','liquids','liquid_ticks'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------- chats: the coach sees every chat; the assistant sees her own chats and family groups ----------
create or replace function public.can_see_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'coach' then true
    when 'assistant' then exists (select 1 from public.threads t where t.id = p_thread and t.kind in ('asst','family'))
    else exists (select 1 from public.thread_members m where m.thread_id = p_thread and m.client_id = public.my_client_id())
  end
$$;

-- one-to-one chat: 'dm' is client + coach, 'asst' is client + assistant
create or replace function public.ensure_chat(p_client uuid default null, p_kind text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare r text := public.my_role(); cid uuid; k text; tid uuid; cname text;
begin
  if r = 'coach' then cid := p_client; k := coalesce(p_kind, 'dm');
  elsif r = 'assistant' then cid := p_client; k := 'asst';
  else cid := public.my_client_id(); k := coalesce(p_kind, 'dm');
  end if;
  if k not in ('dm','asst') then raise exception 'Unknown chat'; end if;
  if cid is null then raise exception 'No client for this chat'; end if;
  select name into cname from public.clients where id = cid;
  if cname is null then raise exception 'Client not found'; end if;
  select id into tid from public.threads where client_id = cid and kind = k;
  if tid is null then
    insert into public.threads (kind, client_id, title) values (k, cid, cname)
      on conflict (client_id, kind) do nothing returning id into tid;
    if tid is null then select id into tid from public.threads where client_id = cid and kind = k; end if;
    insert into public.thread_members (thread_id, client_id) values (tid, cid) on conflict do nothing;
  end if;
  return tid;
end $$;

create or replace function public.ensure_dm(p_client uuid default null) returns uuid
language sql security definer set search_path = public as $$ select public.ensure_chat(p_client, null) $$;

-- staff: one message into every client's own chat
create or replace function public.broadcast(p_body text, p_tier text default 'All') returns int
language plpgsql security definer set search_path = public as $$
declare r text := public.my_role(); k text; b text := trim(coalesce(p_body, '')); c record; tid uuid; n int := 0;
begin
  if r not in ('coach','assistant') or r is null then raise exception 'Only the team can send a broadcast'; end if;
  if length(b) = 0 then raise exception 'Write a message first'; end if;
  if length(b) > 1000 then raise exception 'Messages can be up to 1000 characters'; end if;
  if p_tier not in ('All','Hand-holding','Weekly') then raise exception 'Unknown group'; end if;
  k := case when r = 'coach' then 'dm' else 'asst' end;
  for c in select id, name from public.clients where p_tier = 'All' or tier = p_tier loop
    select id into tid from public.threads where client_id = c.id and kind = k;
    if tid is null then
      insert into public.threads (kind, client_id, title) values (k, c.id, c.name) returning id into tid;
      insert into public.thread_members (thread_id, client_id) values (tid, c.id) on conflict do nothing;
    end if;
    insert into public.messages (thread_id, sender, sender_name, from_staff, body, broadcast)
      values (tid, auth.uid(), public.my_display_name(), true, b, true);
    update public.threads set last_at = now(), last_from_staff = true, last_text = left(b, 120) where id = tid;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- weigh-ins remember the time they were logged ----------
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

  insert into public.weights (client_id, d, kg, at) values (c.id, t, round(p_kg, 1), now())
    on conflict (client_id, d) do update set kg = excluded.kg, at = now();

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

-- ---------- diets: the coach writes a fresh one every 4 days ----------
create or replace function public.save_diet(p_client uuid, p_start date, p_meals jsonb, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid; t date := public.today_ist(); m jsonb;
begin
  if not public.is_staff() then raise exception 'Only the team can write diets'; end if;
  if not exists (select 1 from public.clients where id = p_client) then raise exception 'Client not found'; end if;
  if p_start is null or p_start < t - 60 or p_start > t + 30 then raise exception 'Pick a start date close to today'; end if;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' or jsonb_array_length(p_meals) not between 4 and 5 then raise exception 'A diet has five meals'; end if;
  select jsonb_agg(left(coalesce(v, ''), 400)) into m from jsonb_array_elements_text(p_meals) v;
  if not exists (select 1 from jsonb_array_elements_text(m) v where length(trim(v)) > 0) then raise exception 'Write at least one meal'; end if;
  insert into public.diets (client_id, start_date, meals, notes) values (p_client, p_start, m, nullif(left(trim(coalesce(p_notes, '')), 600), ''))
    on conflict (client_id, start_date) do update set meals = excluded.meals, notes = excluded.notes
    returning id into did;
  return did;
end $$;

create or replace function public.delete_diet(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only the team can delete diets'; end if;
  delete from public.diets where id = p_id;
end $$;

-- ---------- liquids: the coach sets each client's list, the client ticks them off every day ----------
create or replace function public.set_liquids(p_client uuid, p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; nm text; wh text; lid uuid;
begin
  if not public.is_coach() then raise exception 'Only the coach can change the liquids list'; end if;
  if not exists (select 1 from public.clients where id = p_client) then raise exception 'Client not found'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Send a list'; end if;
  if jsonb_array_length(p_items) > 12 then raise exception 'Up to 12 liquids'; end if;
  update public.liquids set active = false where client_id = p_client;
  for it in select * from jsonb_array_elements(p_items) loop
    nm := left(trim(coalesce(it->>'name', '')), 60); wh := left(trim(coalesce(it->>'when', '')), 60);
    continue when length(nm) = 0;
    select id into lid from public.liquids where client_id = p_client and lower(name) = lower(nm) and lower(when_text) = lower(wh) limit 1;
    if lid is null then insert into public.liquids (client_id, name, when_text, sort) values (p_client, nm, wh, n);
    else update public.liquids set active = true, sort = n, name = nm, when_text = wh where id = lid; end if;
    n := n + 1;
  end loop;
  update public.clients set liquids_updated = public.today_ist() where id = p_client;
  return n;
end $$;

create or replace function public.tick_liquid(p_liquid uuid, p_on boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.clients; t date := public.today_ist(); total int; n_done int; gained int := 0; l public.day_logs;
begin
  select * into c from public.clients where user_id = auth.uid() for update;
  if not found then raise exception 'This login is not a client'; end if;
  if c.consent_at is null then raise exception 'Please agree to the privacy notice first'; end if;
  if not exists (select 1 from public.liquids where id = p_liquid and client_id = c.id and active) then raise exception 'That item is not on your list'; end if;
  if coalesce(p_on, true) then
    insert into public.liquid_ticks (client_id, d, liquid_id) values (c.id, t, p_liquid) on conflict do nothing;
  else
    delete from public.liquid_ticks where client_id = c.id and d = t and liquid_id = p_liquid;
  end if;
  select count(*) into total from public.liquids where client_id = c.id and active;
  select count(*) into n_done from public.liquid_ticks k join public.liquids q on q.id = k.liquid_id where k.client_id = c.id and k.d = t and q.active;
  if total > 0 and n_done >= total then
    insert into public.day_logs (client_id, d) values (c.id, t) on conflict do nothing;
    select * into l from public.day_logs where client_id = c.id and d = t for update;
    if not (l.done ? 'liquids') then
      update public.day_logs set done = done || '{"liquids":true}' where client_id = c.id and d = t;
      update public.clients set stars = stars + 2 where id = c.id;
      gained := 2;
    end if;
  end if;
  return jsonb_build_object('gained', gained, 'done', n_done, 'total', total);
end $$;

-- staff: mark a conversation as handled without replying (only chats they can see)
create or replace function public.mark_thread_done(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() or not public.can_see_thread(p_thread) then raise exception 'Only the team can do this'; end if;
  update public.threads set last_from_staff = true where id = p_thread;
end $$;

-- ---------- rights ----------
do $$ declare f text; begin
  foreach f in array array['public.ensure_chat(uuid, text)', 'public.ensure_dm(uuid)', 'public.broadcast(text, text)', 'public.log_weight(numeric)',
    'public.save_diet(uuid, date, jsonb, text)', 'public.delete_diet(uuid)', 'public.set_liquids(uuid, jsonb)', 'public.tick_liquid(uuid, boolean)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;

-- =====================================================================
-- Update 3: phone notifications (web push) and comments on meal photos
-- =====================================================================
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net is not available here: notifications stay off'; end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- one row: the secret the database uses to call the sender, where the sender lives, and the sender's keys
create table if not exists private.push_config (
  id            boolean primary key default true check (id),
  hook_secret   text not null,
  fn_url        text,
  vapid_public  text,
  vapid_private jsonb
);
insert into private.push_config (hook_secret) values (encode(extensions.gen_random_bytes(32), 'hex')) on conflict do nothing;

-- one row per phone or browser that has notifications switched on
create table if not exists public.push_subs (
  endpoint   text primary key check (length(endpoint) between 20 and 1000),
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null check (length(p256dh) between 20 and 200),
  auth       text not null check (length(auth) between 8 and 100),
  ua         text check (ua is null or length(ua) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

create table if not exists public.photo_comments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  path        text not null check (length(path) <= 200),
  author      uuid not null,
  author_name text not null,
  body        text not null check (length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists photo_comments_client on public.photo_comments (client_id, created_at);
alter table public.photo_comments enable row level security;
drop policy if exists "photo_comments: own or staff" on public.photo_comments;
create policy "photo_comments: own or staff" on public.photo_comments for select to authenticated using (client_id = public.my_client_id() or public.is_staff());
revoke all on public.photo_comments from anon, authenticated;
grant select on public.photo_comments to authenticated;

-- the app asks for the public key before switching notifications on
create or replace function public.push_key() returns text
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else (select vapid_public from private.push_config) end
$$;

create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then raise exception 'Sign in first'; end if;
  -- only the real push services of Chrome/Android, Apple, Firefox and Edge
  if coalesce(p_endpoint, '') !~ '^https://(fcm\.googleapis\.com|[a-z0-9-]+\.google\.com|[a-z0-9-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/[!-~]+$' then
    raise exception 'This browser''s notification service is not supported';
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{16,40}$' then raise exception 'Notification keys look wrong'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, ua) values (p_endpoint, uid, p_p256dh, p_auth, left(p_ua, 300))
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua;
  delete from public.push_subs where user_id = uid and endpoint not in (select endpoint from public.push_subs where user_id = uid order by created_at desc limit 8);
end $$;

create or replace function public.drop_push_sub(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- ask the sender to deliver; never blocks or fails the action that caused it
create or replace function public._push_fire(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cfg private.push_config;
begin
  select * into cfg from private.push_config;
  if cfg.fn_url is null or not exists (select 1 from public.push_subs) then return; end if;
  perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('kind', p_kind, 'id', p_id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-hook-secret', cfg.hook_secret), timeout_milliseconds := 10000);
exception when others then null;
end $$;

create or replace function public._push_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public._push_fire('message', new.id); return new; end $$;
drop trigger if exists push_on_message on public.messages;
create trigger push_on_message after insert on public.messages for each row execute function public._push_on_message();

-- the sender calls this: who gets the notification, what it says, and the keys to send it
create or replace function public.push_job(p_secret text, p_kind text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg private.push_config; m public.messages; t public.threads; pc public.photo_comments; uids uuid[]; title text; body text; url text; tag text;
begin
  select * into cfg from private.push_config;
  if p_secret is null or cfg.hook_secret is distinct from p_secret then raise exception 'Not allowed'; end if;
  if p_kind = 'message' then
    select * into m from public.messages where id = p_id; if not found then return jsonb_build_object('subs', '[]'::jsonb); end if;
    select * into t from public.threads where id = m.thread_id;
    select array_agg(distinct u) into uids from (
      -- clients in the conversation hear from the team, and family members hear from each other
      select c.user_id as u from public.thread_members tm join public.clients c on c.id = tm.client_id
        where tm.thread_id = t.id and (m.from_staff or t.kind = 'family')
      union all
      -- the team hears from clients: the coach for her chats, the assistant for theirs, both for family groups
      select p.id from public.profiles p where not m.from_staff
        and ((t.kind = 'dm' and p.role = 'coach') or (t.kind = 'asst' and p.role = 'assistant') or (t.kind = 'family' and p.role in ('coach', 'assistant')))
    ) x where u is not null and u <> m.sender;
    title := m.sender_name || case when t.kind = 'family' then ' · ' || t.title else '' end;
    body := left(m.body, 140); url := '#chat=' || t.id; tag := 'chat-' || t.id;
  elsif p_kind = 'comment' then
    select * into pc from public.photo_comments where id = p_id; if not found then return jsonb_build_object('subs', '[]'::jsonb); end if;
    select array_agg(c.user_id) into uids from public.clients c where c.id = pc.client_id;
    title := pc.author_name || ' commented on your meal photo'; body := left(pc.body, 140); url := '#photos'; tag := 'photo-' || pc.id;
  else
    raise exception 'Unknown kind';
  end if;
  return jsonb_build_object('vapid_public', cfg.vapid_public, 'vapid_private', cfg.vapid_private, 'title', title, 'body', body, 'url', url, 'tag', tag,
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from public.push_subs s where s.user_id = any(uids)), '[]'::jsonb));
end $$;

-- the sender makes its own keys the first time it runs; only the public half ever leaves the database again
create or replace function public.push_set_vapid(p_secret text, p_public text, p_private jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare cfg private.push_config;
begin
  select * into cfg from private.push_config for update;
  if p_secret is null or cfg.hook_secret is distinct from p_secret then raise exception 'Not allowed'; end if;
  if cfg.vapid_public is null and p_public is not null and p_private is not null then
    update private.push_config set vapid_public = p_public, vapid_private = p_private where id;
    return p_public;
  end if;
  return cfg.vapid_public;
end $$;

-- phones that have switched notifications off or uninstalled the app
create or replace function public.push_gone(p_secret text, p_endpoints text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_secret is null or (select hook_secret from private.push_config) is distinct from p_secret then raise exception 'Not allowed'; end if;
  delete from public.push_subs where endpoint = any(p_endpoints); get diagnostics n = row_count; return n;
end $$;

-- the team comments on a client's meal photo; the client sees it under the photo
create or replace function public.comment_photo(p_path text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; b text := trim(coalesce(p_body, '')); nid uuid;
begin
  if not public.is_staff() then raise exception 'Only the team can comment on photos'; end if;
  if length(b) = 0 then raise exception 'Write a comment first'; end if;
  if length(b) > 500 then raise exception 'Comments can be up to 500 characters'; end if;
  select l.client_id into cid from public.day_logs l where l.photos @> jsonb_build_array(jsonb_build_object('path', p_path)) limit 1;
  if cid is null then raise exception 'Photo not found'; end if;
  insert into public.photo_comments (client_id, path, author, author_name, body) values (cid, p_path, auth.uid(), public.my_display_name(), b) returning id into nid;
  perform public._push_fire('comment', nid);
  return nid;
end $$;

create or replace function public.delete_photo_comment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only the team can do this'; end if;
  delete from public.photo_comments where id = p_id and (author = auth.uid() or public.is_coach());
end $$;

do $$ declare f text; begin
  foreach f in array array['public.push_key()', 'public.save_push_sub(text, text, text, text)', 'public.drop_push_sub(text)', 'public.comment_photo(text, text)', 'public.delete_photo_comment(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
  foreach f in array array['public._push_fire(text, uuid)', 'public._push_on_message()', 'public.push_job(text, text, uuid)', 'public.push_set_vapid(text, text, jsonb)', 'public.push_gone(text, text[])'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['public.push_job(text, text, uuid)', 'public.push_set_vapid(text, text, jsonb)', 'public.push_gone(text, text[])'] loop
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.photo_comments'; exception when duplicate_object then null; end;
  end if;
end $$;

-- =====================================================================
-- Update 4: a private team chat between the coach and the assistant
-- =====================================================================
alter table public.threads drop constraint if exists threads_kind_check;
alter table public.threads add constraint threads_kind_check check (kind in ('dm','asst','family','team'));
alter table public.threads add column if not exists last_sender uuid;
create unique index if not exists threads_one_team on public.threads (kind) where kind = 'team';

create or replace function public.can_see_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'coach' then true
    when 'assistant' then exists (select 1 from public.threads t where t.id = p_thread and t.kind in ('asst','family','team'))
    else exists (select 1 from public.thread_members m where m.thread_id = p_thread and m.client_id = public.my_client_id())
  end
$$;

-- the one chat the coach and the assistant share; clients can never see it
create or replace function public.ensure_team() returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if not public.is_staff() then raise exception 'Only the team can do this'; end if;
  select id into tid from public.threads where kind = 'team';
  if tid is null then
    insert into public.threads (kind, title) values ('team', 'Team') on conflict do nothing returning id into tid;
    if tid is null then select id into tid from public.threads where kind = 'team'; end if;
  end if;
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
  update public.threads set last_at = now(), last_from_staff = staff, last_text = left(b, 120), last_sender = auth.uid() where id = p_thread;
  return mid;
end $$;

create or replace function public.mark_thread_done(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() or not public.can_see_thread(p_thread) then raise exception 'Only the team can do this'; end if;
  update public.threads set last_from_staff = true, last_sender = case when kind = 'team' then null else last_sender end where id = p_thread;
end $$;

create or replace function public.push_job(p_secret text, p_kind text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg private.push_config; m public.messages; t public.threads; pc public.photo_comments; uids uuid[]; title text; body text; url text; tag text;
begin
  select * into cfg from private.push_config;
  if p_secret is null or cfg.hook_secret is distinct from p_secret then raise exception 'Not allowed'; end if;
  if p_kind = 'message' then
    select * into m from public.messages where id = p_id; if not found then return jsonb_build_object('subs', '[]'::jsonb); end if;
    select * into t from public.threads where id = m.thread_id;
    select array_agg(distinct u) into uids from (
      -- clients in the conversation hear from the team, and family members hear from each other
      select c.user_id as u from public.thread_members tm join public.clients c on c.id = tm.client_id
        where tm.thread_id = t.id and (m.from_staff or t.kind = 'family')
      union all
      -- the team hears from clients: the coach for her chats, the assistant for theirs, both for family groups;
      -- and the coach and the assistant hear from each other in the team chat
      select p.id from public.profiles p where (t.kind = 'team' and p.role in ('coach', 'assistant')) or (not m.from_staff
        and ((t.kind = 'dm' and p.role = 'coach') or (t.kind = 'asst' and p.role = 'assistant') or (t.kind = 'family' and p.role in ('coach', 'assistant'))))
    ) x where u is not null and u <> m.sender;
    title := m.sender_name || case when t.kind = 'family' then ' · ' || t.title when t.kind = 'team' then ' · team chat' else '' end;
    body := left(m.body, 140); url := '#chat=' || t.id; tag := 'chat-' || t.id;
  elsif p_kind = 'comment' then
    select * into pc from public.photo_comments where id = p_id; if not found then return jsonb_build_object('subs', '[]'::jsonb); end if;
    select array_agg(c.user_id) into uids from public.clients c where c.id = pc.client_id;
    title := pc.author_name || ' commented on your meal photo'; body := left(pc.body, 140); url := '#photos'; tag := 'photo-' || pc.id;
  else
    raise exception 'Unknown kind';
  end if;
  return jsonb_build_object('vapid_public', cfg.vapid_public, 'vapid_private', cfg.vapid_private, 'title', title, 'body', body, 'url', url, 'tag', tag,
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from public.push_subs s where s.user_id = any(uids)), '[]'::jsonb));
end $$;

revoke all on function public.ensure_team() from public, anon;
grant execute on function public.ensure_team() to authenticated;
revoke all on function public.push_job(text, text, uuid) from public, anon, authenticated;

-- =====================================================================
-- Update 5: the assistant can add clients too (deleting stays with the coach)
-- =====================================================================
create or replace function public.add_client(p_username text, p_password text, p_name text, p_start_kg numeric,
  p_goal_kg numeric default null, p_tier text default 'Weekly', p_days int default 30) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid; cid uuid; t date := public.today_ist();
begin
  if not (public.is_staff() or public.is_console()) then raise exception 'Only the team can add clients'; end if;
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

-- =====================================================================
-- Update 6: a morning message above the meals and a night message below them
-- =====================================================================
alter table public.diets add column if not exists morning text check (morning is null or length(morning) <= 400);
alter table public.diets add column if not exists night text check (night is null or length(night) <= 400);

drop function if exists public.save_diet(uuid, date, jsonb, text);
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
revoke all on function public.save_diet(uuid, date, jsonb, text, text, text) from public, anon;
grant execute on function public.save_diet(uuid, date, jsonb, text, text, text) to authenticated;

-- =====================================================================
-- Update 7: private notes about a client, read only by the coach and the assistant
-- =====================================================================
create table if not exists public.client_notes (
  client_id uuid primary key references public.clients(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.client_notes enable row level security;
drop policy if exists "client_notes: staff" on public.client_notes;
create policy "client_notes: staff" on public.client_notes for select to authenticated using (public.is_staff());
revoke all on public.client_notes from anon, authenticated;
grant select on public.client_notes to authenticated;

create or replace function public.save_client_note(p_client uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare b text := trim(coalesce(p_body, ''));
begin
  if not public.is_staff() then raise exception 'Only the team can write notes'; end if;
  if not exists (select 1 from public.clients where id = p_client) then raise exception 'Client not found'; end if;
  if length(b) > 2000 then raise exception 'Notes can be up to 2000 characters'; end if;
  if length(b) = 0 then
    delete from public.client_notes where client_id = p_client;
  else
    insert into public.client_notes (client_id, body, updated_at, updated_by) values (p_client, b, now(), auth.uid())
    on conflict (client_id) do update set body = excluded.body, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;
revoke all on function public.save_client_note(uuid, text) from public, anon;
grant execute on function public.save_client_note(uuid, text) to authenticated;

-- =====================================================================
-- Update 8: getting ready for every client
--   a nightly copy of the data, kept inside the database, and a way to
--     bring back a client who was deleted by mistake
--   the team can see how full the photo space and the database are
--   the app reports its own errors
--   the dashboard reads only each client's latest diets
--   deleting a client can remove their files too
-- =====================================================================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- nightly backup: one row per table per day
-- ---------------------------------------------------------------------
create table if not exists private.backups (
  d        date not null,
  tbl      text not null,
  n        int  not null,
  data     jsonb not null,
  taken_at timestamptz not null default now(),
  primary key (d, tbl)
);

-- what the app noticed going wrong on someone's phone (read from the SQL Editor only)
create table if not exists public.app_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  user_id uuid,
  role    text,
  ver     text,
  msg     text not null,
  src     text,
  ua      text
);
create index if not exists app_errors_user_at on public.app_errors (user_id, at);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

create or replace function private.take_backup() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; day date := public.today_ist(); j jsonb; n_rows bigint := 0; n_tabs int := 0; total bigint := 0;
begin
  for t in select c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname not in ('app_errors', 'push_subs')
            order by 1 loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into j;
    insert into private.backups (d, tbl, n, data) values (day, t, jsonb_array_length(j), j)
      on conflict (d, tbl) do update set n = excluded.n, data = excluded.data, taken_at = now();
    n_rows := n_rows + jsonb_array_length(j); n_tabs := n_tabs + 1;
  end loop;
  -- logins: enough to bring one back with the same password (the password itself is never stored, only its scrambled form)
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'encrypted_password', u.encrypted_password, 'created_at', u.created_at)), '[]'::jsonb)
    into j from auth.users u;
  insert into private.backups (d, tbl, n, data) values (day, 'auth.users', jsonb_array_length(j), j)
    on conflict (d, tbl) do update set n = excluded.n, data = excluded.data, taken_at = now();
  -- keep the last seven days, and Sundays for five weeks
  delete from private.backups b where b.d < day - 6 and not (extract(dow from b.d) = 0 and b.d >= day - 35);
  -- the copies must never crowd out the live data: drop the oldest day while they take more than 150 MB
  loop
    select coalesce(sum(pg_column_size(b.data)), 0) into total from private.backups b;
    exit when total <= 157286400 or (select count(distinct b.d) from private.backups b) <= 2;
    delete from private.backups b where b.d = (select min(b2.d) from private.backups b2);
  end loop;
  delete from public.app_errors where at < now() - interval '30 days';
  return jsonb_build_object('day', day, 'tables', n_tabs + 1, 'rows', n_rows, 'bytes', total);
end $$;

-- SQL Editor only. Bring back one deleted client from the copy taken on p_day:
--   select d, x->>'id' as id, x->>'name' as name from private.backups b, jsonb_array_elements(b.data) x where b.tbl = 'clients' order by d desc;
--   select private.restore_client('2026-11-17', '<client id>');
-- Their login works again with the password they had. Photos and report files are not part of the copy.
create or replace function private.restore_client(p_day date, p_client uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c jsonb; u jsonb; pr jsonb; uid uuid; em text; j jsonb; t text; n int; thr text[] := '{}'; res jsonb := '{}'::jsonb;
  pick constant text := 'select coalesce(jsonb_agg(x), ''[]''::jsonb) from private.backups b, jsonb_array_elements(b.data) x where b.d = $1 and b.tbl = $2 and ';
  has_trg boolean := exists (select 1 from pg_trigger where tgrelid = 'public.messages'::regclass and tgname = 'push_on_message');
begin
  select x into c from private.backups b, jsonb_array_elements(b.data) x where b.d = p_day and b.tbl = 'clients' and x->>'id' = p_client::text;
  if c is null then raise exception 'That client is not in the copy taken on %', p_day; end if;
  if exists (select 1 from public.clients where id = p_client) then raise exception '% has not been deleted. Nothing was changed', c->>'name'; end if;
  uid := (c->>'user_id')::uuid;
  select x into pr from private.backups b, jsonb_array_elements(b.data) x where b.d = p_day and b.tbl = 'profiles' and x->>'id' = uid::text;
  if pr is null then raise exception 'The profile of % is not in that copy', c->>'name'; end if;
  if exists (select 1 from public.profiles where username = pr->>'username' and id <> uid) then
    raise exception 'The username "%" now belongs to a newer login. Rename that login first', pr->>'username';
  end if;

  if not exists (select 1 from auth.users where id = uid) then
    select x into u from private.backups b, jsonb_array_elements(b.data) x where b.d = p_day and b.tbl = 'auth.users' and x->>'id' = uid::text;
    if u is null then raise exception 'The login of % is not in that copy', c->>'name'; end if;
    em := u->>'email';
    if exists (select 1 from auth.users where lower(email) = lower(em)) then raise exception 'The login "%" is in use by a newer account', em; end if;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      u->>'encrypted_password', now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, coalesce((u->>'created_at')::timestamptz, now()), now());
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now());
  end if;

  -- old messages coming back must not send notifications
  if has_trg then execute 'alter table public.messages disable trigger push_on_message'; end if;
  foreach t in array array['profiles', 'clients', 'weights', 'day_logs', 'diet_plans', 'diets', 'blood_tests', 'liquids', 'liquid_ticks',
                           'photo_comments', 'client_notes', 'threads', 'thread_members', 'messages'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if t = 'profiles' then execute pick || 'x->>''id'' = $3' into j using p_day, t, uid::text;
    elsif t = 'clients' then execute pick || 'x->>''id'' = $3' into j using p_day, t, p_client::text;
    elsif t = 'thread_members' then
      execute pick || '(x->>''client_id'' = $3 or x->>''thread_id'' = any($4)) and exists (select 1 from public.threads th where th.id::text = x->>''thread_id'')'
        into j using p_day, t, p_client::text, thr;
    elsif t = 'messages' then execute pick || 'x->>''thread_id'' = any($3)' into j using p_day, t, thr;
    else execute pick || 'x->>''client_id'' = $3' into j using p_day, t, p_client::text;
    end if;
    execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict do nothing', t, t) using j;
    get diagnostics n = row_count;
    res := res || jsonb_build_object(t, n);
    if t = 'threads' then select coalesce(array_agg(x->>'id'), '{}') into thr from jsonb_array_elements(j) x; end if;
  end loop;
  if has_trg then execute 'alter table public.messages enable trigger push_on_message'; end if;

  -- files are not in the copy: forget the ones that are gone, so nothing shows as a broken picture
  update public.day_logs l set photos = coalesce((select jsonb_agg(p) from jsonb_array_elements(l.photos) p
      where exists (select 1 from storage.objects o where o.bucket_id = 'meal-photos' and o.name = p->>'path')), '[]'::jsonb)
    where l.client_id = p_client and jsonb_array_length(l.photos) > 0;
  delete from public.photo_comments pc where pc.client_id = p_client
    and not exists (select 1 from storage.objects o where o.bucket_id = 'meal-photos' and o.name = pc.path);
  update public.blood_tests bt set file_path = null where bt.client_id = p_client and bt.file_path is not null
    and not exists (select 1 from storage.objects o where o.bucket_id = 'reports' and o.name = bt.file_path);
  return jsonb_build_object('client', c->>'name', 'from', p_day, 'rows', res);
end $$;

revoke all on function private.take_backup() from public, anon, authenticated;
revoke all on function private.restore_client(date, uuid) from public, anon, authenticated;
revoke all on private.backups from public, anon, authenticated;

-- run the backup every night at 2:00 am India time (20:30 UTC)
do $$ begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron is not available here: run "select private.take_backup()" by hand'; end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sf-nightly-backup', '30 20 * * *', 'select private.take_backup()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- how full things are (the team only)
-- ---------------------------------------------------------------------
create or replace function public.app_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n bigint := 0; f bigint := 0; b timestamptz;
begin
  if not (public.is_staff() or public.is_console()) then raise exception 'Only the team can see this'; end if;
  begin
    select count(*), coalesce(sum(nullif(o.metadata->>'size', '')::bigint), 0) into n, f
      from storage.objects o where o.bucket_id in ('meal-photos', 'reports');
  exception when others then n := 0; f := 0; end;
  select max(taken_at) into b from private.backups;
  -- the limits are the free plan's: 1 GB of files and 500 MB of database. Change them here after an upgrade.
  return jsonb_build_object('files', n, 'file_bytes', f, 'file_limit', 1073741824::bigint,
    'db_bytes', pg_database_size(current_database()), 'db_limit', 524288000::bigint, 'last_backup', b);
end $$;

-- ---------------------------------------------------------------------
-- the app reports an error it ran into (signed-in people only, a few per hour)
-- ---------------------------------------------------------------------
create or replace function public.log_error(p_msg text, p_src text default null, p_ua text default null, p_ver text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m text := left(trim(coalesce(p_msg, '')), 500);
begin
  if uid is null or length(m) = 0 then return; end if;
  if (select count(*) from public.app_errors where user_id = uid and at > now() - interval '1 hour') >= 10 then return; end if;
  if (select count(*) from public.app_errors where at > now() - interval '1 day') >= 500 then return; end if;
  insert into public.app_errors (user_id, role, ver, msg, src, ua)
  values (uid, public.my_role(), left(p_ver, 20), m, left(p_src, 300), left(p_ua, 300));
end $$;

-- ---------------------------------------------------------------------
-- each client's latest eight diets: all the dashboard needs, however many were ever sent
-- (the usual rules still decide who can read which diet)
-- ---------------------------------------------------------------------
create or replace view public.diets_recent with (security_invoker = true) as
  select x.id, x.client_id, x.start_date, x.meals, x.notes, x.morning, x.night, x.created_at
  from (select d.*, row_number() over (partition by d.client_id order by d.start_date desc, d.created_at desc) as rn from public.diets d) x
  where x.rn <= 8;
revoke all on public.diets_recent from anon, authenticated;
grant select on public.diets_recent to authenticated;

-- ---------------------------------------------------------------------
-- deleting a client: the coach's app removes their photos and report files first
-- ---------------------------------------------------------------------
create or replace function public.client_files(p_client uuid) returns table (bucket text, path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'Only the coach can do this'; end if;
  return query select o.bucket_id::text, o.name::text from storage.objects o
    where o.bucket_id in ('meal-photos', 'reports') and o.name like p_client::text || '/%' order by 1, 2;
end $$;

drop policy if exists "files: coach deletes" on storage.objects;
create policy "files: coach deletes" on storage.objects for delete to authenticated
  using (bucket_id in ('meal-photos', 'reports') and public.is_coach());

do $$ declare f text; begin
  foreach f in array array['public.app_usage()', 'public.log_error(text, text, text, text)', 'public.client_files(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
notify pgrst, 'reload schema';
