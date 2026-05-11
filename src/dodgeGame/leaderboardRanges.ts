import { utcMonthRange, utcWeekRange } from './dayKey'

export type DodgeLeaderTab = 'day' | 'week' | 'month' | 'all'

/**
 * Aikaväli `get_dodge_leaderboard(p_start, p_end)` -kutsulle.
 * RPC palauttaa kullekin nimelle (case-insensitive) parhaan yksittäisen pelin
 * välillä [start, end] (suurin matka; tasapelissä pidempi aika).
 */
export function dodgeLeaderboardDateRange(
  tab: DodgeLeaderTab,
  dayKey: string,
  ref: Date = new Date(),
): { start: string; end: string } {
  const dk = String(dayKey ?? '').slice(0, 10)
  if (tab === 'day') {
    return { start: dk, end: dk }
  }
  if (tab === 'week') {
    return utcWeekRange(ref)
  }
  if (tab === 'month') {
    return utcMonthRange(ref)
  }
  return { start: '2000-01-01', end: '2099-12-31' }
}
