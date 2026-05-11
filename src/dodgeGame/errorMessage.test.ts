import { describe, expect, it } from 'vitest'
import { caughtToUiMessage, errorToReadableString, safeUiString } from './errorMessage'

describe('errorToReadableString', () => {
  it('parses Error with string message', () => {
    expect(errorToReadableString(new Error('hello'))).toBe('hello')
  })

  it('handles Error whose message is an object (avoids [object Object] in UI)', () => {
    const err = new Error() as Error & { message: unknown }
    err.message = { nested: 'x' } as unknown as string
    const s = errorToReadableString(err)
    expect(s).toContain('nested')
    expect(s).not.toBe('[object Object]')
  })

  it('reads message from plain PostgREST-like object', () => {
    expect(
      errorToReadableString({
        message: 'RLS',
        details: '',
        hint: '',
        code: '42501',
      }),
    ).toBe('RLS')
  })

  it('handles new Error(non-string) coerced to [object Object] message', () => {
    const s = errorToReadableString(new Error(String({ foo: 1 })))
    expect(s).not.toBe('[object Object]')
    expect(s.length).toBeGreaterThan(0)
  })

  it('caughtToUiMessage never returns object string', () => {
    expect(caughtToUiMessage(new Error('[object Object]'))).not.toMatch(/^\[object/i)
    expect(caughtToUiMessage({ status: 503 })).toContain('503')
  })
})
