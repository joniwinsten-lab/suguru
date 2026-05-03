import { describe, expect, it } from 'vitest'
import { neighborCoords } from './grid'
import { parseLevel } from './level'
import type { LevelJson } from './types'
import { cellHasConflict, isSolved } from './rules'

const solved4: LevelJson = {
  id: 't',
  title: 't',
  width: 4,
  height: 4,
  regions: [
    [0, 0, 0, 0],
    [1, 1, 2, 2],
    [1, 1, 2, 2],
    [3, 3, 3, 3],
  ],
  givens: [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [1, 2, 3, 4],
    [3, 4, 1, 2],
  ],
}

describe('neighborCoords', () => {
  it('returns 3 neighbors in a corner', () => {
    expect(neighborCoords(0, 0, 4, 4)).toHaveLength(3)
  })
  it('returns 8 neighbors in the interior', () => {
    expect(neighborCoords(1, 1, 4, 4)).toHaveLength(8)
  })
})

describe('rules', () => {
  it('accepts a hand-verified full grid', () => {
    const level = parseLevel(solved4)
    const values = solved4.givens.map((row) => [...row]) as (number | null)[][]
    expect(isSolved(level, values)).toBe(true)
  })

  it('detects neighbor conflict', () => {
    const level = parseLevel(solved4)
    const values = solved4.givens.map((row) => [...row]) as (number | null)[][]
    values[0][0] = 2
    values[0][1] = 2
    expect(cellHasConflict(level, values, 0, 0)).toBe(true)
    expect(cellHasConflict(level, values, 0, 1)).toBe(true)
  })
})
