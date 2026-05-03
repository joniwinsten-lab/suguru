/** Raw level as stored in JSON */
export type LevelJson = {
  id: string
  title: string
  width: number
  height: number
  /** Region id per cell; same dimensions as grid */
  regions: number[][]
  /** Starting clues; null = empty */
  givens: (number | null)[][]
}

/** Normalized, validated puzzle */
export type Level = {
  id: string
  title: string
  width: number
  height: number
  regions: number[][]
  givens: (number | null)[][]
  /** regionId -> list of flat indices */
  regionCells: ReadonlyMap<number, readonly number[]>
  /** flat index -> region id */
  cellRegion: readonly number[]
  /** region id -> size (must match max digit in that region) */
  regionSize: ReadonlyMap<number, number>
  maxDigit: number
}

export type GameState = {
  level: Level
  /** Current digits including givens; null = empty */
  values: (number | null)[][]
  selected: { row: number; col: number } | null
}
