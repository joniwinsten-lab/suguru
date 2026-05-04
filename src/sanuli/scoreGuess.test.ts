import { describe, expect, it } from 'vitest'
import { scoreGuess } from './scoreGuess'

describe('scoreGuess', () => {
  it('marks greens first', () => {
    expect(scoreGuess('abcde', 'abxyz')).toEqual([
      'correct',
      'correct',
      'absent',
      'absent',
      'absent',
    ])
  })

  it('handles duplicate in guess: one green one yellow', () => {
    expect(scoreGuess('aabbb', 'aaccc')).toEqual([
      'correct',
      'correct',
      'absent',
      'absent',
      'absent',
    ])
    expect(scoreGuess('aabbb', 'ccaac')).toEqual([
      'absent',
      'absent',
      'present',
      'present',
      'absent',
    ])
  })

  it('handles duplicate in solution', () => {
    expect(scoreGuess('aabbb', 'xxyaa')).toEqual([
      'absent',
      'absent',
      'absent',
      'present',
      'present',
    ])
  })
})
