/** Päivän sanojen määrä (ketjutettu peli). */
export const DAILY_WORD_SLOTS = 5

/** Päivän sana: sama kaikille (UTC-päivä). */
export function dayKeyUtc(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function hashDayKey(dayKey: string): number {
  let h = 2166136261
  for (let i = 0; i < dayKey.length; i++) {
    h ^= dayKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickDailyIndex(dayKey: string, poolLength: number): number {
  return hashDayKey(dayKey) % poolLength
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Yksiselitteinen järjestys: päivän viisi eri sana-indeksiä (UTC-päivä). */
export function pickDailyWordIndices(dayKey: string, poolLength: number): number[] {
  const want = Math.min(DAILY_WORD_SLOTS, Math.max(0, poolLength))
  if (want === 0) return []
  const indices = Array.from({ length: poolLength }, (_, i) => i)
  const rng = mulberry32(hashDayKey(dayKey) ^ 0x9e3779b9)
  for (let i = poolLength - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, want)
}
