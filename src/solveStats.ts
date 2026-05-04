export type SolveRecord = {
  bestMs: number
  lastMs: number
  lastIso: string
  solveCount: number
}

const key = (tierId: string, index: number) =>
  `suguru:solve:v2:${tierId}:${index}`

export function loadSolveRecord(
  tierId: string,
  index: number,
): SolveRecord | null {
  try {
    const raw = localStorage.getItem(key(tierId, index))
    if (!raw) return null
    return JSON.parse(raw) as SolveRecord
  } catch {
    return null
  }
}

export function saveSolveRecord(
  tierId: string,
  index: number,
  elapsedMs: number,
): SolveRecord {
  const prev = loadSolveRecord(tierId, index)
  const bestMs = prev ? Math.min(prev.bestMs, elapsedMs) : elapsedMs
  const rec: SolveRecord = {
    bestMs,
    lastMs: elapsedMs,
    lastIso: new Date().toISOString(),
    solveCount: (prev?.solveCount ?? 0) + 1,
  }
  localStorage.setItem(key(tierId, index), JSON.stringify(rec))
  return rec
}

export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  const rs = s - m * 60
  return `${m} min ${rs.toFixed(1)} s`
}
