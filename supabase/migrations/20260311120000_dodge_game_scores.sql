-- Väistöpeli: tulokset + top-listat. Korvaa aiemman tiimi-taulun (jos olemassa).
-- Yksi rivi / UTC-päivä / nimi (case-insensitive).

drop function if exists public.get_team_leaderboard(date, date);
drop table if exists public.team_game_scores;

create table if not exists public.dodge_game_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  day_key date not null,
  distance_m numeric(12, 2) not null check (distance_m >= 0),
  run_ms int not null check (run_ms >= 0),
  game_version text not null default 'v1',
  created_at timestamptz not null default now(),
  constraint dodge_game_scores_name_len check (
    char_length(trim(player_name)) between 1 and 32
  )
);

create unique index if not exists dodge_game_scores_player_day
  on public.dodge_game_scores (lower(trim(player_name)), day_key);

create index if not exists dodge_game_scores_day_key_idx
  on public.dodge_game_scores (day_key desc);

create index if not exists dodge_game_scores_created_idx
  on public.dodge_game_scores (created_at desc);

alter table public.dodge_game_scores enable row level security;

drop policy if exists "dodge_game_scores_select_all" on public.dodge_game_scores;
create policy "dodge_game_scores_select_all"
  on public.dodge_game_scores for select
  using (true);

drop policy if exists "dodge_game_scores_insert_all" on public.dodge_game_scores;
create policy "dodge_game_scores_insert_all"
  on public.dodge_game_scores for insert
  with check (true);

-- Paras tulos per nimi ikkunassa (suurin matka; tasalla pidempi peli-aika voittaa)
create or replace function public.get_dodge_leaderboard(p_start date, p_end date)
returns table (
  player_name text,
  distance_m numeric,
  run_ms int,
  day_key date,
  created_at timestamptz
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
      row_number() over (
        partition by lower(trim(t.player_name))
        order by t.distance_m desc, t.run_ms desc, t.created_at asc
      ) as rn
    from public.dodge_game_scores t
    where t.day_key between p_start and p_end
  )
  select pn as player_name, distance_m, run_ms, day_key, created_at
  from ranked
  where rn = 1
  order by distance_m desc, run_ms desc
  limit 100;
$$;

grant execute on function public.get_dodge_leaderboard(date, date) to anon, authenticated;

create or replace function public.dodge_already_played(p_day date, p_name text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.dodge_game_scores s
    where s.day_key = p_day
      and lower(trim(s.player_name)) = lower(trim(p_name))
  );
$$;

grant execute on function public.dodge_already_played(date, text) to anon, authenticated;

comment on table public.dodge_game_scores is 'Väistö: yksi yritys per pelaaja per UTC-päivä (unique).';
