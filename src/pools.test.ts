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

const CLUE_RATIO_BOUNDS: Record<string, { min: number; max: number }> = {
  'beginner-4a': { min: 0.3, max: 0.5 },
  'easy-6': { min: 0.3, max: 0.5 },
  'hard-7': { min: 0.3, max: 0.5 },
  'pro-8': { min: 0.3, max: 0.5 },
  'legend-9': { min: 0.25, max: 0.4 },
}

function assertGivensFraction(level: Level, tierId: string): void {
  const { height, width, givens } = level
  const total = height * width
  const bounds = CLUE_RATIO_BOUNDS[tierId]
  const minExpected = Math.min(total, Math.max(1, Math.round(total * bounds.min)))
  const maxExpected = Math.min(total, Math.max(1, Math.round(total * bounds.max)))
  let n = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (givens[r][c] !== null) n++
    }
  }
  expect(n).toBeGreaterThanOrEqual(minExpected)
  expect(n).toBeLessThanOrEqual(maxExpected)
  const cap = Math.min(width, height)
  if (cap >= 6) {
    expect(new Set(level.regionSize.values()).size).toBeGreaterThanOrEqual(2)
  }
}

describe('pools', () => {
  it('parses first level from beginner pool', () => {
    const pack = readPool('beginner-4a')
    expect(pack.count).toBeGreaterThanOrEqual(1)
    expect(pack.levels[0]).toBeTruthy()
    const level = parseLevel(pack.levels[0])
    expect(level.maxDigit).toBeGreaterThanOrEqual(1)
    expect(level.maxDigit).toBeLessThanOrEqual(
      Math.min(level.width, level.height),
    )
    if (Math.min(level.width, level.height) >= 6) {
      expect(new Set(level.regionSize.values()).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('all tiers keep clue ratio bounds and valid region diversity', () => {
    const tiers = Object.keys(CLUE_RATIO_BOUNDS)
    for (const tierId of tiers) {
      const pack = readPool(tierId)
      for (let i = 0; i < pack.count; i++) {
        const level = parseLevel(pack.levels[i])
        assertGivensFraction(level, tierId)
      }
    }
  })

})
