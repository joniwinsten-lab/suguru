const MAX = 32

export function normalizePlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Returns null if valid, otherwise an error message. */
export function validatePlayerName(raw: string): string | null {
  const s = normalizePlayerName(raw)
  if (s.length === 0) return 'Enter a name.'
  if (s.length > MAX) return `Name must be at most ${MAX} characters.`
  return null
}
