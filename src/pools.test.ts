import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseLevel } from './game/level'
import type { Level } from './game/types'
import type { PoolPack } from './poolApi'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function readPool(name: string): PoolPack {
  const raw = readFileSync(join(root, 'public', 'pools', `${name}.json`), 'utf8')
  return JSON.parse(raw) as PoolPack
}

const GIVEN_FRACTION = 0.25

/** Vastaa build-level-pools.mjs: ~25 % soluista vihjeenä, vähintään 1. */
function assertGivensFraction(level: Level): void {
  const { height, width, givens } = level
  const total = height * width
  const expected = Math.min(total, Math.max(1, Math.round(total * GIVEN_FRACTION)))
  let n = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (givens[r][c] !== null) n++
    }
  }
  expect(n).toBe(expected)
  expect(new Set(level.regionSize.values()).size).toBeGreaterThanOrEqual(2)
}

describe('pools', () => {
  it('parses first level from beginner pool', () => {
    const pack = readPool('beginner-4a')
    expect(pack.count).toBeGreaterThanOrEqual(1)
    expect(pack.levels[0]).toBeTruthy()
    const level = parseLevel(pack.levels[0])
    expect(level.maxDigit).toBeGreaterThanOrEqual(1)
    expect(level.maxDigit).toBeLessThanOrEqual(9)
    expect(new Set(level.regionSize.values()).size).toBeGreaterThanOrEqual(2)
  })

  it('beginner pool levels have 25% givens and heterogeneous regions', () => {
    const pack = readPool('beginner-4a')
    for (let i = 0; i < pack.count; i++) {
      const level = parseLevel(pack.levels[i])
      assertGivensFraction(level)
    }
  })
})
