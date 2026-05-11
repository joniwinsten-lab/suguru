-- AS Daily life: max 3 pelikertaa / UTC-päivä / nimi, yksi tuloksen lähetys / päivä.
-- Vaatii aiemman dodge_game_scores + RLS:n (20260511193000 tai vastaava).

create table if not exists public.dodge_daily_attempts (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  day_key date not null,
  attempts_used int not null default 0 check (attempts_used >= 0 and attempts_used <= 3),
  constraint dodge_daily_attempts_name_len check (
    char_length(trim(player_name)) between 1 and 32
  )
);

create unique index if not exists dodge_daily_attempts_player_day
  on public.dodge_daily_attempts (lower(trim(player_name)), day_key);

create index if not exists dodge_daily_attempts_day_key_idx
  on public.dodge_daily_attempts (day_key desc);

alter table public.dodge_daily_attempts enable row level security;

drop policy if exists "dodge_daily_attempts_select_all" on public.dodge_daily_attempts;
create policy "dodge_daily_attempts_select_all"
  on public.dodge_daily_attempts for select
  using (true);

drop policy if exists "dodge_daily_attempts_insert_all" on public.dodge_daily_attempts;
create policy "dodge_daily_attempts_insert_all"
  on public.dodge_daily_attempts for insert
  with check (true);

drop policy if exists "dodge_daily_attempts_update_all" on public.dodge_daily_attempts;
create policy "dodge_daily_attempts_update_all"
  on public.dodge_daily_attempts for update
  using (true)
  with check (true);

-- Luetaan ilman sivuvaikutuksia (lobby / HUD).
drop function if exists public.dodge_daily_quota(date, text);

create or replace function public.dodge_daily_quota(p_day date, p_name text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_sub boolean;
  v_used int;
  v_key text := lower(trim(p_name));
begin
  if v_key = '' then
    return jsonb_build_object(
      'submitted', false,
      'attempts_used', 0,
      'attempts_max', 3,
      'can_start', false
    );
  end if;

  select exists (
    select 1
    from public.dodge_game_scores s
    where s.day_key = p_day
      and lower(trim(s.player_name)) = v_key
  )
  into v_sub;

  select d.attempts_used
  into v_used
  from public.dodge_daily_attempts d
  where d.day_key = p_day
    and lower(trim(d.player_name)) = v_key;

  if v_used is null then
    v_used := 0;
  end if;

  return jsonb_build_object(
    'submitted', v_sub,
    'attempts_used', v_used,
    'attempts_max', 3,
    'can_start', (not v_sub) and (v_used < 3)
  );
end;
$$;

grant execute on function public.dodge_daily_quota(date, text) to anon, authenticated;

-- Kuluttaa yhden yrityksen (kutsutaan kun peli alkaa).
drop function if exists public.dodge_begin_attempt(date, text);

create or replace function public.dodge_begin_attempt(p_day date, p_name text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sub boolean;
  v_key text := lower(trim(p_name));
  v_used int;
  v_new int;
begin
  if v_key = '' or char_length(trim(p_name)) < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_key || '|' || p_day::text));

  select exists (
    select 1
    from public.dodge_game_scores s
    where s.day_key = p_day
      and lower(trim(s.player_name)) = v_key
  )
  into v_sub;

  if v_sub then
    return jsonb_build_object('ok', false, 'error', 'already_submitted');
  end if;

  select d.attempts_used
  into v_used
  from public.dodge_daily_attempts d
  where d.day_key = p_day
    and lower(trim(d.player_name)) = v_key;

  if v_used is null then
    insert into public.dodge_daily_attempts (player_name, day_key, attempts_used)
    values (trim(p_name), p_day, 1);
    v_new := 1;
  elsif v_used >= 3 then
    return jsonb_build_object('ok', false, 'error', 'no_attempts');
  else
    update public.dodge_daily_attempts d
    set attempts_used = d.attempts_used + 1
    where d.day_key = p_day
      and lower(trim(d.player_name)) = v_key
      and d.attempts_used < 3
    returning d.attempts_used into v_new;
    if v_new is null then
      return jsonb_build_object('ok', false, 'error', 'no_attempts');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'attempts_used', v_new,
    'attempts_remaining', 3 - v_new
  );
end;
$$;

grant execute on function public.dodge_begin_attempt(date, text) to anon, authenticated;

-- Vähintään yksi aloitettu yritys ennen tulosriviä; estää duplikaattilähetyksen.
create or replace function public.dodge_enforce_score_submit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_attempts int;
  v_key text := lower(trim(new.player_name));
begin
  if exists (
    select 1
    from public.dodge_game_scores s
    where s.day_key = new.day_key
      and lower(trim(s.player_name)) = v_key
      and s.id is distinct from new.id
  ) then
    raise exception 'duplicate_score_day'
      using errcode = '23505',
      message = 'Tulos on jo lähetetty tälle päivälle.';
  end if;

  select a.attempts_used
  into v_attempts
  from public.dodge_daily_attempts a
  where a.day_key = new.day_key
    and lower(trim(a.player_name)) = v_key;

  if v_attempts is null or v_attempts < 1 then
    raise exception 'no_attempt_before_submit'
      using errcode = 'P0001',
      message = 'Pelaa vähintään yksi yritys ennen tuloksen lähetystä.';
  end if;

  return new;
end;
$$;

drop trigger if exists dodge_game_scores_submit_guard on public.dodge_game_scores;
create trigger dodge_game_scores_submit_guard
  before insert on public.dodge_game_scores
  for each row
  execute function public.dodge_enforce_score_submit();

-- Vanha nimi: true = tulos jo lähetetty (yksi rivi / päivä).
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

comment on table public.dodge_daily_attempts is 'AS Daily life: aloitetut pelikerrat / UTC-päivä / nimi (max 3 ennen lähetystä).';

notify pgrst, 'reload schema';
