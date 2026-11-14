-- Red Dust Outpost · Moon Survival leaderboard (added Nov 2026). Additive only: no existing table or function changes.
-- Safe to run again.
create table if not exists public.survival_scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  daily       boolean not null default false,
  day         date,
  score       int not null check (score between 0 and 200000),
  seconds     int not null check (seconds between 0 and 86400),
  objectives  smallint not null check (objectives between 0 and 7),
  samples     smallint not null check (samples between 0 and 12),
  created_at  timestamptz not null default now()
);
create index if not exists survival_board_idx on public.survival_scores (daily, day, score desc);
alter table public.survival_scores enable row level security;
drop policy if exists "read own survival scores" on public.survival_scores;
create policy "read own survival scores" on public.survival_scores for select using (auth.uid() = user_id);

create or replace function public.submit_survival(p_daily boolean, p_score int, p_seconds int, p_objectives int, p_samples int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_day date; v_last timestamptz; v_cap int; v_best int; v_rank bigint; v_players bigint;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_seconds not between 0 and 86400 or p_objectives not between 0 and 7 or p_samples not between 0 and 12 then raise exception 'Bad stats'; end if;
  -- same formula as the game: 1 point per second survived, 300 per objective, 150 per science sample (x1.5 on Hard), plus a small margin
  v_cap := floor((p_seconds + p_objectives * 300 + p_samples * 150) * 1.5) + 50;   -- Hard difficulty earns 1.5x
  if p_score < 0 or p_score > v_cap then raise exception 'Score does not match the mission stats'; end if;
  select max(created_at) into v_last from survival_scores where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '15 seconds' then raise exception 'Please wait a moment before submitting again'; end if;
  if p_daily then v_day := (now() at time zone 'utc')::date; end if;
  perform ensure_profile();
  insert into survival_scores (user_id, daily, day, score, seconds, objectives, samples) values (v_uid, p_daily, v_day, p_score, p_seconds, p_objectives, p_samples);
  with best as (select user_id, max(score) as s from survival_scores where daily = p_daily and (not p_daily or day = v_day) group by user_id)
  select (select s from best where user_id = v_uid), (select count(*) + 1 from best where s > (select s from best where user_id = v_uid)), (select count(*) from best)
  into v_best, v_rank, v_players;
  return jsonb_build_object('best', v_best, 'rank', v_rank, 'players', v_players, 'new_best', v_best = p_score);
end $$;

create or replace function public.get_survival_board(p_daily boolean default false, p_limit int default 50)
returns table (rank bigint, name text, score int, seconds int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.seconds from survival_scores s
    where s.daily = p_daily and (not p_daily or s.day = (now() at time zone 'utc')::date)
    order by s.user_id, s.score desc),
  ranked as (select rank() over (order by b.score desc) as rank, coalesce(p.name, 'Commander') as name, b.score, b.seconds, b.user_id = auth.uid() as is_me
    from best b left join profiles p on p.id = b.user_id)
  select r.rank, r.name, r.score, r.seconds, r.is_me from ranked r
  where r.rank <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.is_me order by r.rank, r.name;
$$;

revoke all on function public.submit_survival(boolean,int,int,int,int) from public, anon;
grant execute on function public.submit_survival(boolean,int,int,int,int) to authenticated;
grant execute on function public.get_survival_board(boolean,int) to anon, authenticated;
