-- =====================================================================
--  Red Dust Outpost · backend
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  It is safe to run again: it only creates what is missing and
--  replaces the functions with their latest version.
--
--  What it sets up:
--    profiles  - each player's call sign
--    saves     - cloud save (stars, journal, badges, campaign progress)
--    scores    - every finished mission, for the leaderboards
--    functions - the only way the game talks to the database, so every
--                write is checked on the server
-- =====================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'Commander',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_name_ok check (name ~ '^[A-Za-z0-9 _.\-]{2,16}$')
);

create table if not exists public.saves (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  constraint saves_size_ok check (pg_column_size(data) < 200000)
);

create table if not exists public.scores (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  mode         text not null check (mode in ('campaign','daily','coop')),
  world        smallint not null check (world between 0 and 6),
  day          date,
  score        int not null check (score between 0 and 100000),
  stars        smallint not null check (stars between 0 and 3),
  kills        int not null check (kills between 0 and 3000),
  discoveries  smallint not null check (discoveries between 0 and 3),
  difficulty   real not null check (difficulty in (0.75, 1, 1.3)),
  won          boolean not null default true,
  seconds      int not null check (seconds between 0 and 36000),
  created_at   timestamptz not null default now()
);
create index if not exists scores_board_idx on public.scores (mode, world, day, score desc);
-- Worlds 0-5 (Ceres was added as world 5). Safe to run again.
alter table public.scores drop constraint if exists scores_world_check;
alter table public.scores add constraint scores_world_check check (world between 0 and 6);
create index if not exists scores_user_idx  on public.scores (user_id, created_at desc);

-- Row level security: players can read their own rows. All writes go
-- through the functions below, which check every value first.
alter table public.profiles enable row level security;
alter table public.saves    enable row level security;
alter table public.scores   enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "read own save" on public.saves;
create policy "read own save" on public.saves for select using (auth.uid() = user_id);
drop policy if exists "read own scores" on public.scores;
create policy "read own scores" on public.scores for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
--  Profiles
-- ---------------------------------------------------------------------
create or replace function public.ensure_profile()
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  insert into profiles (id, name)
  values (v_uid, 'Cadet ' || upper(substr(replace(v_uid::text, '-', ''), 1, 4)))
  on conflict (id) do nothing;
  select name into v_name from profiles where id = v_uid;
  return v_name;
end $$;

create or replace function public.set_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if v_name !~ '^[A-Za-z0-9 _.\-]{2,16}$' then
    raise exception 'Use 2 to 16 letters, numbers, spaces, dots, dashes or underscores';
  end if;
  perform ensure_profile();
  update profiles set name = v_name, updated_at = now() where id = v_uid;
  return v_name;
end $$;

-- ---------------------------------------------------------------------
--  Cloud save
-- ---------------------------------------------------------------------
create or replace function public.save_progress(p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_now timestamptz := now();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Save data must be an object'; end if;
  insert into saves (user_id, data, updated_at) values (v_uid, p_data, v_now)
  on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return v_now;
end $$;

create or replace function public.load_progress()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('data', data, 'updated_at', updated_at)
  from saves where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
--  Daily challenge: the same world and twists for everyone each UTC day.
--  The game has the same formula built in, so it also works offline.
-- ---------------------------------------------------------------------
create or replace function public.get_daily()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_day  date := (now() at time zone 'utc')::date;
  v_n    int  := v_day - date '2026-01-01';
  v_mods text[] := array['swarm','dim','meteors','rich','glass','thin','storms','fast'];
  v_a    int  := ((v_n * 7) % 8 + 8) % 8;
  v_b    int  := ((v_n * 3 + 5) % 8 + 8) % 8;
begin
  if v_b = v_a then v_b := (v_a + 3) % 8; end if;
  return jsonb_build_object(
    'day', v_day,
    'world', ((v_n % 5) + 5) % 5,
    'mods', jsonb_build_array(v_mods[v_a + 1], v_mods[v_b + 1]),
    'seconds_left', extract(epoch from ((v_day + 1)::timestamp - (now() at time zone 'utc')))::int
  );
end $$;

-- ---------------------------------------------------------------------
--  Scores: checked on the server before they reach the leaderboard
-- ---------------------------------------------------------------------
create or replace function public.submit_score(
  p_mode text, p_world int, p_score int, p_stars int, p_kills int,
  p_discoveries int, p_difficulty real, p_won boolean, p_seconds int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date;
  v_cap int;
  v_last timestamptz;
  v_best int;
  v_rank bigint;
  v_players bigint;
  v_daily jsonb;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_mode not in ('campaign','daily','coop') then raise exception 'Unknown mode'; end if;
  if p_world not between 0 and 6 then raise exception 'Unknown world'; end if;
  if p_difficulty not in (0.75, 1, 1.3) then raise exception 'Unknown difficulty'; end if;
  if p_stars not between 0 and 3 or p_discoveries not between 0 and 3 then raise exception 'Bad stars'; end if;
  if p_kills not between 0 and 3000 or p_seconds not between 0 and 36000 then raise exception 'Bad stats'; end if;
  if p_won and p_seconds < 60 then raise exception 'That mission was too fast to be real'; end if;

  -- The highest score the game can award for these stats (same formula as the game).
  v_cap := ceil((p_kills * 10 + p_stars * 500 + p_discoveries * 200 + 500 + 300) * 1.3) + 5;
  if p_score < 0 or p_score > v_cap then raise exception 'Score does not match the mission stats'; end if;

  -- One score every 15 seconds per player.
  select max(created_at) into v_last from scores where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '15 seconds' then
    raise exception 'Please wait a moment before submitting again';
  end if;

  if p_mode = 'daily' then
    v_daily := get_daily();
    v_day := (v_daily ->> 'day')::date;
    if p_world <> (v_daily ->> 'world')::int then raise exception 'That is not today''s daily world'; end if;
  end if;

  perform ensure_profile();
  insert into scores (user_id, mode, world, day, score, stars, kills, discoveries, difficulty, won, seconds)
  values (v_uid, p_mode, p_world, v_day, p_score, p_stars, p_kills, p_discoveries, p_difficulty, p_won, p_seconds);

  with best as (
    select user_id, max(score) as s from scores
    where mode = p_mode and world = p_world and (p_mode <> 'daily' or day = v_day)
    group by user_id)
  select (select s from best where user_id = v_uid),
         (select count(*) + 1 from best where s > (select s from best where user_id = v_uid)),
         (select count(*) from best)
  into v_best, v_rank, v_players;

  return jsonb_build_object('best', v_best, 'rank', v_rank, 'players', v_players, 'new_best', v_best = p_score);
end $$;

-- Leaderboard: each player's best score. With p_world null on the campaign
-- board, a player's best scores on every world are added together.
create or replace function public.get_leaderboard(p_mode text, p_world int default null, p_limit int default 50)
returns table (rank bigint, name text, score bigint, stars bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with best as (
    select s.user_id, s.world, max(s.score) as best, max(s.stars) as stars
    from scores s
    where s.mode = p_mode
      and (p_mode <> 'daily' or s.day = (now() at time zone 'utc')::date)
      and (p_world is null or s.world = p_world)
    group by s.user_id, s.world),
  per_player as (
    select user_id, sum(best) as score, sum(stars) as stars from best group by user_id),
  ranked as (
    select rank() over (order by pp.score desc) as rank,
           coalesce(p.name, 'Commander') as name, pp.score, pp.stars,
           pp.user_id = auth.uid() as is_me
    from per_player pp left join profiles p on p.id = pp.user_id)
  select r.rank, r.name, r.score, r.stars, r.is_me
  from ranked r
  where r.rank <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.is_me
  order by r.rank, r.name;
$$;

-- Daily base ghosts: the layout of each player's best daily base (v23).
create table if not exists public.daily_bases (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  score   int  not null,
  base    text not null check (char_length(base) <= 4000),
  primary key (user_id, day));
alter table public.daily_bases enable row level security;

create or replace function public.save_daily_base(p_base text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_day date; v_best int; v_last int;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_base is null or char_length(p_base) > 4000 or p_base !~ '^[a-z0-9,;-]*$' then raise exception 'Bad base'; end if;
  v_day := (get_daily() ->> 'day')::date;
  select max(score) into v_best from scores where user_id = v_uid and mode = 'daily' and day = v_day;
  select score into v_last from scores where user_id = v_uid and mode = 'daily' and day = v_day order by created_at desc limit 1;
  if v_best is null or v_last is distinct from v_best then return; end if;
  insert into daily_bases (user_id, day, score, base) values (v_uid, v_day, v_best, p_base)
  on conflict (user_id, day) do update set score = excluded.score, base = excluded.base;
end $$;

create or replace function public.get_daily_top_base()
returns table (name text, score int, base text)
language sql stable security definer set search_path = public as $$
  select coalesce(p.name, 'Commander'), d.score, d.base
  from daily_bases d left join profiles p on p.id = d.user_id
  where d.day = (now() at time zone 'utc')::date
  order by d.score desc limit 1;
$$;
revoke all on function public.save_daily_base(text) from public, anon;
grant execute on function public.save_daily_base(text) to authenticated;
grant execute on function public.get_daily_top_base() to anon, authenticated;

-- Lock everything down: only signed-in players (guests count) may call these.
revoke all on function public.ensure_profile()  from public, anon;
revoke all on function public.set_name(text)    from public, anon;
revoke all on function public.save_progress(jsonb) from public, anon;
revoke all on function public.load_progress()   from public, anon;
revoke all on function public.submit_score(text,int,int,int,int,int,real,boolean,int) from public, anon;
grant execute on function public.ensure_profile()  to authenticated;
grant execute on function public.set_name(text)    to authenticated;
grant execute on function public.save_progress(jsonb) to authenticated;
grant execute on function public.load_progress()   to authenticated;
grant execute on function public.submit_score(text,int,int,int,int,int,real,boolean,int) to authenticated;
grant execute on function public.get_daily()       to anon, authenticated;
grant execute on function public.get_leaderboard(text,int,int) to anon, authenticated;
