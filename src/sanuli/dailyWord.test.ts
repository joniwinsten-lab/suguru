import { describe, expect, it } from 'vitest'
import { dayKeyUtc, hashDayKey, pickDailyIndex, pickDailyWordIndices } from './dailyWord'

describe('dayKeyUtc', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 4, 3, 15, 0, 0))
    expect(dayKeyUtc(d)).toBe('2026-05-03')
  })
})

describe('pickDailyIndex', () => {
  it('is stable for the same day key', () => {
    expect(pickDailyIndex('2026-05-03', 100)).toBe(hashDayKey('2026-05-03') % 100)
  })

  it('stays within range', () => {
    for (let n = 1; n < 50; n++) {
      const i = pickDailyIndex('2026-05-03', n)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(n)
    }
  })
})

describe('pickDailyWordIndices', () => {
  it('returns five distinct indices when pool is large enough', () => {
    const xs = pickDailyWordIndices('2026-05-03', 500)
    expect(xs).toHaveLength(5)
    expect(new Set(xs).size).toBe(5)
    for (const i of xs) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(500)
    }
  })

  it('is stable per day', () => {
    expect(pickDailyWordIndices('2026-05-03', 300)).toEqual(
      pickDailyWordIndices('2026-05-03', 300),
    )
  })

  it('shrinks pool shorter than five', () => {
    expect(pickDailyWordIndices('2026-05-03', 3)).toHaveLength(3)
  })
})
