export type TileState = 'empty' | 'tbd' | 'absent' | 'present' | 'correct'

/** NYT Wordle -tyyppinen arviointi (tuplakirjaimet huomioiden). */
export function scoreGuess(solution: string, guess: string): TileState[] {
  const n = solution.length
  if (guess.length !== n) throw new Error('guess length mismatch')
  const out: TileState[] = Array(n).fill('absent') as TileState[]
  const solChars = [...solution]
  const gueChars = [...guess]
  const usedSol = Array(n).fill(false)

  for (let i = 0; i < n; i++) {
    if (gueChars[i] === solChars[i]) {
      out[i] = 'correct'
      usedSol[i] = true
    }
  }
  for (let i = 0; i < n; i++) {
    if (out[i] === 'correct') continue
    const ch = gueChars[i]
    let hit = -1
    for (let j = 0; j < n; j++) {
      if (usedSol[j] || solChars[j] !== ch) continue
      hit = j
      break
    }
    if (hit >= 0) {
      out[i] = 'present'
      usedSol[hit] = true
    }
  }
  return out
}

export function normalizeFi(s: string): string {
  return s.trim().toLowerCase().normalize('NFC')
}

export function isValidFiWord(s: string): boolean {
  if (s.length !== 5) return false
  return /^[a-zåäö]+$/i.test(s)
}

/** Yksi kirjain (syöttö), NFC-pienet a–z / åäö. */
export function isValidFiLetter(s: string): boolean {
  const x = normalizeFi(s)
  return x.length === 1 && /^[a-zåäö]$/i.test(x)
}
