const MAX = 32

export function normalizePlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Palauttaa null jos ok, muuten virheilmoitus. */
export function validatePlayerName(raw: string): string | null {
  const s = normalizePlayerName(raw)
  if (s.length === 0) return 'Kirjoita nimi.'
  if (s.length > MAX) return `Nimi saa olla enintään ${MAX} merkkiä.`
  return null
}
