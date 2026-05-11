import { describe, expect, it } from 'vitest'
import { normalizePlayerName, validatePlayerName } from './name'

describe('teamGame name', () => {
  it('validatePlayerName rejects empty and long', () => {
    expect(validatePlayerName('')).toBeTruthy()
    expect(validatePlayerName('   ')).toBeTruthy()
    expect(validatePlayerName('a'.repeat(33))).toBeTruthy()
  })

  it('validatePlayerName accepts ok name', () => {
    expect(validatePlayerName(' Maija ')).toBeNull()
  })

  it('normalizePlayerName trims and collapses spaces', () => {
    expect(normalizePlayerName('  A  B  ')).toBe('A B')
  })
})
