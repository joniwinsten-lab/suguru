-- Tiimin päiväpeli: tulokset + top-listat (päivä / viikko / kk / all-time)
-- Aja Supabase SQL-editorissa tai: supabase db push

create table if not exists public.team_game_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  day_key date not null,
  score int not null check (score >= 0),
  time_ms int not null check (time_ms >= 0),
  game_version text not null default 'v1',
  created_at timestamptz not null default now(),
  constraint team_game_scores_name_len check (
    char_length(trim(player_name)) between 1 and 32
  )
);

-- Yksi yritys / päivä / nimi (case-insensitive)
create unique index if not exists team_game_scores_player_day
  on public.team_game_scores (lower(trim(player_name)), day_key);

create index if not exists team_game_scores_day_key_idx
  on public.team_game_scores (day_key desc);

create index if not exists team_game_scores_created_idx
  on public.team_game_scores (created_at desc);

alter table public.team_game_scores enable row level security;

-- Sisäinen tiimi: kaikki saavat lukea ja lisätä (unique estää tuplapelin)
drop policy if exists "team_game_scores_select_all" on public.team_game_scores;
create policy "team_game_scores_select_all"
  on public.team_game_scores for select
  using (true);

drop policy if exists "team_game_scores_insert_all" on public.team_game_scores;
create policy "team_game_scores_insert_all"
  on public.team_game_scores for insert
  with check (true);

-- Paras tulos per nimi ikkunassa (korkein score, tasatilanteessa pienempi aika)
create or replace function public.get_team_leaderboard(p_start date, p_end date)
returns table (
  player_name text,
  score int,
  time_ms int,
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
      t.score,
      t.time_ms,
      t.day_key,
      t.created_at,
      row_number() over (
        partition by lower(trim(t.player_name))
        order by t.score desc, t.time_ms asc
      ) as rn
    from public.team_game_scores t
    where t.day_key between p_start and p_end
  )
  select pn as player_name, score, time_ms, day_key, created_at
  from ranked
  where rn = 1
  order by score desc, time_ms asc
  limit 100;
$$;

grant execute on function public.get_team_leaderboard(date, date) to anon, authenticated;

comment on table public.team_game_scores is 'Tiimin päiväpeli: yksi rivi per pelaaja per päivä (UTC day_key).';
