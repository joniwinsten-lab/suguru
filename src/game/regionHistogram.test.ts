import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  matchesGuidedSmallRegionHistogram,
  regionSizeHistogram,
} from './regionHistogram'
import { parseLevel } from './level'
import type { LevelJson } from './types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')

function readPoolLevels(name: string): LevelJson[] {
  const raw = readFileSync(join(root, 'public', 'pools', `${name}.json`), 'utf8')
  const pack = JSON.parse(raw) as { levels: LevelJson[] }
  return pack.levels
}

describe('matchesGuidedSmallRegionHistogram', () => {
  it('ignores ei-ohjattuja kokoja', () => {
    const regions = [
      [0, 0],
      [0, 0],
    ]
    expect(matchesGuidedSmallRegionHistogram(2, 2, regions)).toBe(true)
  })

  it('hard-7 pool noudattaa histogrammia', () => {
    const levels = readPoolLevels('hard-7')
    for (const lvl of levels) {
      expect(matchesGuidedSmallRegionHistogram(lvl.height, lvl.width, lvl.regions)).toBe(
        true,
      )
      const h = regionSizeHistogram(lvl.regions)
      expect(h.get(1)).toBe(1)
      expect(h.get(2)).toBe(2)
      expect(h.get(3)).toBe(3)
    }
  })

  it('pro-8 pool noudattaa histogrammia', () => {
    const levels = readPoolLevels('pro-8')
    for (const lvl of levels) {
      expect(matchesGuidedSmallRegionHistogram(lvl.height, lvl.width, lvl.regions)).toBe(
        true,
      )
      const h = regionSizeHistogram(lvl.regions)
      expect(h.get(1)).toBe(1)
      expect(h.get(2)).toBe(3)
      expect(h.get(3)).toBe(3)
    }
  })

  it('legend-9 pool: vapaa jako, vähintään kaksi aluekokoa, uniikit layoutit', () => {
    const levels = readPoolLevels('legend-9')
    const layoutKeys = new Set<string>()
    for (const lvl of levels) {
      parseLevel(lvl)
      const h = regionSizeHistogram(lvl.regions)
      expect(h.size).toBeGreaterThanOrEqual(2)
      layoutKeys.add(JSON.stringify(lvl.regions))
    }
    expect(layoutKeys.size).toBe(levels.length)
  })
})
