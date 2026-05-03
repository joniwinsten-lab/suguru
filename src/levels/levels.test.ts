import { describe, expect, it } from 'vitest'
import { levels } from './index'

describe('levels', () => {
  it('parses all bundled levels', () => {
    expect(levels.length).toBeGreaterThanOrEqual(5)
    const maxima = levels.map((l) => l.maxDigit)
    expect(Math.max(...maxima)).toBe(8)
    expect(maxima).toContain(7)
    expect(maxima).toContain(6)
  })
})
