import { describe, expect, it } from 'vitest'
import { is8899SmallRegionLayout, regionSizeHistogram } from './regionHistogram'

describe('is8899SmallRegionLayout', () => {
  it('accepts a valid 8×8 histogram (1×1, 2×2, 3×3; only 4+ otherwise)', () => {
    const regions = [
      [0, 0, 0, 1, 2, 3, 3, 3],
      [0, 0, 0, 1, 2, 3, 3, 3],
      [0, 0, 2, 2, 2, 4, 4, 4],
      [5, 5, 5, 2, 2, 6, 6, 6],
      [5, 5, 5, 7, 7, 8, 8, 6],
      [9, 10, 10, 7, 8, 8, 11, 11],
      [9, 10, 12, 8, 8, 8, 11, 11],
      [9, 9, 9, 13, 13, 8, 11, 11],
    ]
    expect(is8899SmallRegionLayout(8, 8, regions)).toBe(true)
    const h = regionSizeHistogram(regions)
    expect(h.get(1)).toBe(1)
    expect(h.get(2)).toBe(2)
    expect(h.get(3)).toBe(3)
  })

  it('ignores non-8/9 boards', () => {
    const regions = [
      [0, 0],
      [0, 0],
    ]
    expect(is8899SmallRegionLayout(2, 2, regions)).toBe(true)
  })
})
