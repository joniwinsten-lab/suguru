import { errorToReadableString } from './errorMessage'
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

/** Estää [object Object] -soluja, jos RPC palauttaa JSON-kenttiä. */
function cellStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }
  return String(v)
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
  if (error) throw new Error(errorToReadableString(error))
  const raw = data ?? []
  if (!Array.isArray(raw)) {
    throw new Error('Top-listan vastaus ei ole taulukko. Tarkista get_dodge_leaderboard-RPC.')
  }
  const rows = raw as Record<string, unknown>[]
  return rows.map((r) => ({
    player_name: cellStr(r.player_name),
    distance_m: toNum(r.distance_m),
    run_ms: Math.round(toNum(r.run_ms)),
    day_key: cellStr(r.day_key),
    created_at: cellStr(r.created_at),
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
  if (error) throw new Error(errorToReadableString(error))
}

export async function dodgeAlreadyPlayed(dayKey: string, playerName: string): Promise<boolean> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('dodge_already_played', {
    p_day: dayKey,
    p_name: playerName.trim(),
  })
  if (error) throw new Error(errorToReadableString(error))
  return Boolean(data)
}
