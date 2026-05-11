import { describe, expect, it } from 'vitest'
import { normalizePlayerName, validatePlayerName } from './name'

describe('dodgeGame name', () => {
  it('normalizes whitespace', () => {
    expect(normalizePlayerName('  a  b  ')).toBe('a b')
  })

  it('validates', () => {
    expect(validatePlayerName('')).toBe('Kirjoita nimi.')
    expect(validatePlayerName('x')).toBe(null)
  })
})
