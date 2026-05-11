import { describe, expect, it } from 'vitest'
import {
  buildDailyRounds,
  correctMaxValue,
  expectedClickSequence,
  scoreOrderAnswer,
  scorePickMaxAnswer,
  scoreTapAnswer,
  sortedValues,
} from './engine'

describe('teamGame engine', () => {
  it('buildDailyRounds is deterministic per dayKey', () => {
    const a = buildDailyRounds('2026-02-06')
    const b = buildDailyRounds('2026-02-06')
    expect(a).toEqual(b)
  })

  it('buildDailyRounds changes when dayKey changes', () => {
    const a = buildDailyRounds('2026-02-06')
    const b = buildDailyRounds('2026-02-07')
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('every round has valid shape', () => {
    const rounds = buildDailyRounds('2026-05-01', 24)
    expect(rounds).toHaveLength(24)
    for (const r of rounds) {
      if (r.kind === 'pickMax') {
        expect(new Set(r.values).size).toBe(3)
        expect(new Set(r.shuffled).size).toBe(3)
        expect(new Set(r.shuffled)).toEqual(new Set(r.values))
        expect(correctMaxValue(r.values)).toBe(Math.max(...r.values))
      } else if (r.kind === 'order') {
        expect(new Set(r.values).size).toBe(3)
        expect(new Set(r.shuffled).size).toBe(3)
        expect(['asc', 'desc']).toContain(r.clickOrder)
        const asc = sortedValues(r.values)
        expect(expectedClickSequence(r)).toEqual(
          r.clickOrder === 'asc' ? asc : [...asc].reverse(),
        )
      } else {
        expect(r.gridSize).toBe(3)
        expect(r.correctIndex).toBeGreaterThanOrEqual(0)
        expect(r.correctIndex).toBeLessThanOrEqual(8)
      }
    }
  })

  it('scores pickMax / order / tap', () => {
    const pickMax = {
      kind: 'pickMax' as const,
      values: [2, 7, 4] as const,
      shuffled: [4, 7, 2] as const,
    }
    expect(scorePickMaxAnswer(pickMax, 7)).toBe(10)
    expect(scorePickMaxAnswer(pickMax, 4)).toBe(0)

    const orderAsc = {
      kind: 'order' as const,
      values: [2, 5, 9] as const,
      shuffled: [5, 9, 2] as const,
      clickOrder: 'asc' as const,
    }
    expect(scoreOrderAnswer(orderAsc, [2, 5, 9])).toBe(10)
    expect(scoreOrderAnswer(orderAsc, [2, 9, 5])).toBe(0)

    const orderDesc = {
      kind: 'order' as const,
      values: [2, 5, 9] as const,
      shuffled: [5, 9, 2] as const,
      clickOrder: 'desc' as const,
    }
    expect(scoreOrderAnswer(orderDesc, [9, 5, 2])).toBe(10)
    expect(scoreOrderAnswer(orderDesc, [2, 5, 9])).toBe(0)

    expect(scoreTapAnswer({ kind: 'tap', gridSize: 3, correctIndex: 4 }, 4)).toBe(10)
    expect(scoreTapAnswer({ kind: 'tap', gridSize: 3, correctIndex: 4 }, 3)).toBe(0)
  })
})
