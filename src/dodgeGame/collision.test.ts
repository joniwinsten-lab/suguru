import { describe, expect, it } from 'vitest'
import { circleHitsRect } from './collision'

describe('circleHitsRect', () => {
  it('tunnistaa osuman', () => {
    expect(circleHitsRect(50, 50, 10, 45, 45, 20, 20)).toBe(true)
  })

  it('ei osumaa kaukana', () => {
    expect(circleHitsRect(10, 10, 5, 100, 100, 20, 20)).toBe(false)
  })

  it('reunan lähellä ilman osumaa', () => {
    expect(circleHitsRect(0, 0, 5, 20, 20, 10, 10)).toBe(false)
  })
})
