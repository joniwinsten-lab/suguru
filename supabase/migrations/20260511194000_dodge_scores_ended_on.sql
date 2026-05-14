-- AS Daily life: tallenna mihin esteeseen peli päättyi (leaderboard-näyttö).

alter table public.dodge_game_scores
  add column if not exists ended_on text;

alter table public.dodge_game_scores
  drop constraint if exists dodge_game_scores_ended_on_len;

alter table public.dodge_game_scores
  add constraint dodge_game_scores_ended_on_len check (
    ended_on is null or char_length(ended_on) <= 200
  );

drop function if exists public.get_dodge_leaderboard(date, date);

create or replace function public.get_dodge_leaderboard(p_start date, p_end date)
returns table (
  player_name text,
  distance_m numeric,
  run_ms int,
  day_key date,
  created_at timestamptz,
  ended_on text
)
language sql
stable
security invoker
set search_path = public
as $$
  with ranked as (
    select
      trim(t.player_name) as pn,
      t.distance_m,
      t.run_ms,
      t.day_key,
      t.created_at,
      t.ended_on,
      row_number() over (
        partition by lower(trim(t.player_name))
        order by t.distance_m desc, t.run_ms desc, t.created_at asc
      ) as rn
    from public.dodge_game_scores t
    where t.day_key between p_start and p_end
  )
  select pn as player_name, distance_m, run_ms, day_key, created_at, ended_on
  from ranked
  where rn = 1
  order by distance_m desc, run_ms desc
  limit 100;
$$;

grant execute on function public.get_dodge_leaderboard(date, date) to anon, authenticated;

notify pgrst, 'reload schema';
