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

/** RPC palauttaa yhden rivin / nimi (case-insensitive): paras matka ikkunassa, tasapelissä pidempi aika. */
export async function fetchDodgeLeaderboard(
  startDate: string,
  endDate: string,
): Promise<DodgeLeaderboardRow[]> {
  const pStart = String(startDate ?? '').slice(0, 10)
  const pEnd = String(endDate ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pStart) || !/^\d{4}-\d{2}-\d{2}$/.test(pEnd)) {
    throw new Error('Top-listan aikaväli puuttuu tai on virheellinen.')
  }
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_dodge_leaderboard', {
    p_start: pStart,
    p_end: pEnd,
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

export type DodgeDailyQuota = {
  submitted: boolean
  attempts_used: number
  attempts_max: number
  can_start: boolean
}

function parseQuotaJson(data: unknown): DodgeDailyQuota {
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const max = Math.max(1, Math.round(toNum(o.attempts_max)) || 3)
  const used = Math.min(max, Math.max(0, Math.round(toNum(o.attempts_used))))
  return {
    submitted: Boolean(o.submitted),
    attempts_used: used,
    attempts_max: max,
    can_start: Boolean(o.can_start),
  }
}

export async function fetchDodgeDailyQuota(dayKey: string, playerName: string): Promise<DodgeDailyQuota> {
  const sb = getSupabase()
  const pDay = String(dayKey ?? '').slice(0, 10)
  const pName = String(playerName ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pDay) || pName.length === 0) {
    return { submitted: false, attempts_used: 0, attempts_max: 3, can_start: false }
  }
  const { data, error } = await sb.rpc('dodge_daily_quota', {
    p_day: pDay,
    p_name: pName,
  })
  if (error) throw new Error(errorToReadableString(error))
  return parseQuotaJson(data)
}

export type DodgeBeginAttemptResult = {
  ok: boolean
  attempts_used?: number
  attempts_remaining?: number
  error?: string
}

function parseBeginJson(data: unknown): DodgeBeginAttemptResult {
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const err = o.error
  return {
    ok: Boolean(o.ok),
    attempts_used: o.attempts_used != null ? Math.round(toNum(o.attempts_used)) : undefined,
    attempts_remaining: o.attempts_remaining != null ? Math.round(toNum(o.attempts_remaining)) : undefined,
    error: typeof err === 'string' ? err : undefined,
  }
}

export async function beginDodgeAttempt(dayKey: string, playerName: string): Promise<DodgeBeginAttemptResult> {
  const sb = getSupabase()
  const pDay = String(dayKey ?? '').slice(0, 10)
  const pName = String(playerName ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pDay) || pName.length === 0) {
    return { ok: false, error: 'invalid_name' }
  }
  const { data, error } = await sb.rpc('dodge_begin_attempt', {
    p_day: pDay,
    p_name: pName,
  })
  if (error) throw new Error(errorToReadableString(error))
  return parseBeginJson(data)
}

/** @deprecated Käytä fetchDodgeDailyQuota; sama kuin quota.submitted */
export async function dodgeAlreadyPlayed(dayKey: string, playerName: string): Promise<boolean> {
  const q = await fetchDodgeDailyQuota(dayKey, playerName)
  return q.submitted
}
