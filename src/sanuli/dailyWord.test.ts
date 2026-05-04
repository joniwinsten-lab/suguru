import { describe, expect, it } from 'vitest'
import { dayKeyUtc, pickDailyIndex } from './dailyWord'

describe('dayKeyUtc', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 4, 3, 15, 0, 0))
    expect(dayKeyUtc(d)).toBe('2026-05-03')
  })
})

describe('pickDailyIndex', () => {
  it('is stable for the same day key', () => {
    expect(pickDailyIndex('2026-05-03', 100)).toBe(pickDailyIndex('2026-05-03', 100))
  })

  it('stays within range', () => {
    for (let n = 1; n < 50; n++) {
      const i = pickDailyIndex('2026-05-03', n)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(n)
    }
  })
})
