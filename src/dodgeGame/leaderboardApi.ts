import { getSupabase } from './supabaseClient'

export type DodgeLeaderboardRow = {
  player_name: string
  distance_m: number
  run_ms: number
  day_key: string
  created_at: string
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  return Number.NaN
}

export async function fetchDodgeLeaderboard(
  startDate: string,
  endDate: string,
): Promise<DodgeLeaderboardRow[]> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_dodge_leaderboard', {
    p_start: startDate,
    p_end: endDate,
  })
  if (error) throw error
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map((r) => ({
    player_name: String(r.player_name ?? ''),
    distance_m: toNum(r.distance_m),
    run_ms: Math.round(toNum(r.run_ms)),
    day_key: String(r.day_key ?? ''),
    created_at: String(r.created_at ?? ''),
  }))
}

export type DodgeSubmitPayload = {
  playerName: string
  dayKey: string
  distanceM: number
  runMs: number
}

export async function submitDodgeScore(payload: DodgeSubmitPayload): Promise<void> {
  const sb = getSupabase()
  const dm = Math.round(payload.distanceM * 100) / 100
  const { error } = await sb.from('dodge_game_scores').insert({
    player_name: payload.playerName.trim(),
    day_key: payload.dayKey,
    distance_m: dm,
    run_ms: Math.max(0, Math.round(payload.runMs)),
    game_version: 'v1',
  })
  if (error) throw error
}

export async function dodgeAlreadyPlayed(dayKey: string, playerName: string): Promise<boolean> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('dodge_already_played', {
    p_day: dayKey,
    p_name: playerName.trim(),
  })
  if (error) throw error
  return Boolean(data)
}
