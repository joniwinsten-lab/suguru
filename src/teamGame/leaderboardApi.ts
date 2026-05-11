import { getSupabase } from './supabaseClient'

export type LeaderboardRow = {
  player_name: string
  score: number
  time_ms: number
  day_key: string
  created_at: string
}

export async function fetchLeaderboard(
  startDate: string,
  endDate: string,
): Promise<LeaderboardRow[]> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_team_leaderboard', {
    p_start: startDate,
    p_end: endDate,
  })
  if (error) throw error
  return (data ?? []) as LeaderboardRow[]
}

export type SubmitPayload = {
  playerName: string
  dayKey: string
  score: number
  timeMs: number
}

export async function submitScore(payload: SubmitPayload): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('team_game_scores').insert({
    player_name: payload.playerName.trim(),
    day_key: payload.dayKey,
    score: payload.score,
    time_ms: payload.timeMs,
    game_version: 'v1',
  })
  if (error) throw error
}
