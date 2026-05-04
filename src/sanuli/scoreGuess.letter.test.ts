import { describe, expect, it } from 'vitest'
import { isValidFiLetter } from './scoreGuess'

describe('isValidFiLetter', () => {
  it('accepts åäö and ascii letters', () => {
    expect(isValidFiLetter('ä')).toBe(true)
    expect(isValidFiLetter('Ö')).toBe(true)
    expect(isValidFiLetter('å')).toBe(true)
    expect(isValidFiLetter('a')).toBe(true)
  })

  it('rejects multi-char and non-letters', () => {
    expect(isValidFiLetter('aa')).toBe(false)
    expect(isValidFiLetter('')).toBe(false)
    expect(isValidFiLetter('1')).toBe(false)
    expect(isValidFiLetter(' ')).toBe(false)
  })
})
