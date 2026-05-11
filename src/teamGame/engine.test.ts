import { describe, expect, it } from 'vitest'
import {
  buildDailyRounds,
  expectedOrderSequence,
  scoreColorAnswer,
  scoreOrderAnswer,
  scoreTapAnswer,
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
      if (r.kind === 'color') {
        expect(r.colors).toHaveLength(3)
        expect(r.correctIndex).toBeGreaterThanOrEqual(0)
        expect(r.correctIndex).toBeLessThanOrEqual(2)
      } else if (r.kind === 'order') {
        expect(new Set(r.values).size).toBe(3)
        expect(new Set(r.shuffled).size).toBe(3)
        expect(expectedOrderSequence(r.values)).toEqual([...r.values].sort((a, b) => a - b))
      } else {
        expect(r.gridSize).toBe(3)
        expect(r.correctIndex).toBeGreaterThanOrEqual(0)
        expect(r.correctIndex).toBeLessThanOrEqual(8)
      }
    }
  })

  it('scores color / order / tap', () => {
    expect(
      scoreColorAnswer(
        { kind: 'color', colors: ['#a', '#b', '#c'], correctIndex: 1 },
        1,
      ),
    ).toBe(10)
    expect(
      scoreColorAnswer(
        { kind: 'color', colors: ['#a', '#b', '#c'], correctIndex: 1 },
        0,
      ),
    ).toBe(0)

    const order = {
      kind: 'order' as const,
      values: [2, 5, 9] as const,
      shuffled: [5, 9, 2] as const,
    }
    expect(scoreOrderAnswer(order, [2, 5, 9])).toBe(10)
    expect(scoreOrderAnswer(order, [2, 9, 5])).toBe(0)

    expect(scoreTapAnswer({ kind: 'tap', gridSize: 3, correctIndex: 4 }, 4)).toBe(10)
    expect(scoreTapAnswer({ kind: 'tap', gridSize: 3, correctIndex: 4 }, 3)).toBe(0)
  })
})
