import { describe, expect, it } from 'vitest'
import { normalizePlayerName, validatePlayerName } from './name'

describe('dodgeGame name', () => {
  it('normalizes whitespace', () => {
    expect(normalizePlayerName('  a  b  ')).toBe('a b')
  })

  it('validates', () => {
    expect(validatePlayerName('')).toBe('Enter a name.')
    expect(validatePlayerName('x')).toBe(null)
  })
})
