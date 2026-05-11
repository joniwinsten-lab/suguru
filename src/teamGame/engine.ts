/**
 * Päivittäinen “reaktio + tarkkuus” -peli: deterministinen seed (UTC day_key).
 * Pisteet: oikein +10 / kierros, väärin 0. Lopputulos: score + time_ms (aika ratkaisee tasapelin).
 */

export const ROUND_POINTS = 10
export const DEFAULT_ROUND_COUNT = 18

/** Korkea kontrasti, “pika peli” -fiilis; vältetään vihreää jotta se ei sekoitu “oikein”-palautteeseen. */
const PALETTE = ['#ff2d6a', '#00d4ff', '#ffd400', '#b388ff', '#ff6b35'] as const

export type RoundKind = 'color' | 'order' | 'tap'

export type ColorRound = {
  kind: 'color'
  colors: readonly string[]
  correctIndex: number
}

export type OrderRound = {
  kind: 'order'
  /** Kolme eri lukua 1…9 */
  values: readonly [number, number, number]
  /** Sama järjestys kuin näytössä (sekoitettu) */
  shuffled: readonly [number, number, number]
  /** Painaako pelaaja luvut pienimmästä suurimpaan vai toisin päin */
  clickOrder: 'asc' | 'desc'
}

export type TapRound = {
  kind: 'tap'
  gridSize: 3
  correctIndex: number
}

export type RoundSpec = ColorRound | OrderRound | TapRound

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashDayRound(dayKey: string, roundIndex: number): number {
  let h = 2166136261
  const s = `${dayKey}|r${roundIndex}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickThreeDistinctNumbers(rng: () => number): [number, number, number] {
  const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)
  return [pool[0]!, pool[1]!, pool[2]!]
}

export function buildDailyRounds(
  dayKey: string,
  roundCount: number = DEFAULT_ROUND_COUNT,
): RoundSpec[] {
  const out: RoundSpec[] = []
  for (let i = 0; i < roundCount; i++) {
    const rng = mulberry32(hashDayRound(dayKey, i))
    const kindRoll = rng()
    const kind: RoundKind =
      kindRoll < 0.34 ? 'color' : kindRoll < 0.67 ? 'order' : 'tap'

    if (kind === 'color') {
      const colors = shuffle([...PALETTE], rng).slice(0, 3)
      const correctIndex = Math.floor(rng() * 3)
      out.push({
        kind: 'color',
        colors,
        correctIndex,
      })
    } else if (kind === 'order') {
      const values = pickThreeDistinctNumbers(rng)
      const shuffled = shuffle([...values], rng) as [number, number, number]
      const clickOrder: 'asc' | 'desc' = rng() < 0.5 ? 'asc' : 'desc'
      out.push({ kind: 'order', values, shuffled, clickOrder })
    } else {
      const correctIndex = Math.floor(rng() * 9)
      out.push({ kind: 'tap', gridSize: 3, correctIndex })
    }
  }
  return out
}

/** Lajiteltu pienimmästä suurimpaan (arvot, ei klikkijärjestystä). */
export function sortedValues(values: readonly [number, number, number]): number[] {
  return [...values].sort((a, b) => a - b)
}

/** Oikea klikkijärjestys tälle kierrokselle (nouseva tai laskeva). */
export function expectedClickSequence(spec: OrderRound): number[] {
  const s = sortedValues(spec.values)
  return spec.clickOrder === 'desc' ? s.reverse() : s
}

export function scoreColorAnswer(spec: ColorRound, pickedIndex: number): number {
  return pickedIndex === spec.correctIndex ? ROUND_POINTS : 0
}

export function scoreOrderAnswer(
  spec: OrderRound,
  clickedInOrder: readonly number[],
): number {
  const want = expectedClickSequence(spec)
  if (clickedInOrder.length !== 3) return 0
  for (let i = 0; i < 3; i++) {
    if (clickedInOrder[i] !== want[i]) return 0
  }
  return ROUND_POINTS
}

export function scoreTapAnswer(spec: TapRound, cellIndex: number): number {
  return cellIndex === spec.correctIndex ? ROUND_POINTS : 0
}
