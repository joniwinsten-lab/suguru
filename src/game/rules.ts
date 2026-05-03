import type { Level } from './types'
import { flatIndex, neighborCoords } from './grid'

/** Same value twice in region (only non-null cells). */
export function regionHasDuplicate(
  level: Level,
  values: (number | null)[][],
  row: number,
  col: number,
): boolean {
  const v = values[row][col]
  if (v === null) return false
  const rid = level.cellRegion[flatIndex(row, col, level.width)]
  const cells = level.regionCells.get(rid)
  if (!cells) return false
  for (const idx of cells) {
    const r = Math.floor(idx / level.width)
    const c = idx % level.width
    if (r === row && c === col) continue
    const ov = values[r][c]
    if (ov !== null && ov === v) return true
  }
  return false
}

export function neighborHasSameValue(
  level: Level,
  values: (number | null)[][],
  row: number,
  col: number,
): boolean {
  const v = values[row][col]
  if (v === null) return false
  for (const [nr, nc] of neighborCoords(row, col, level.height, level.width)) {
    const nv = values[nr][nc]
    if (nv !== null && nv === v) return true
  }
  return false
}

/** Cell violates Suguru rules (only meaningful when value is non-null). */
export function cellHasConflict(
  level: Level,
  values: (number | null)[][],
  row: number,
  col: number,
): boolean {
  if (values[row][col] === null) return false
  return (
    regionHasDuplicate(level, values, row, col) ||
    neighborHasSameValue(level, values, row, col)
  )
}

export function isGiven(level: Level, row: number, col: number): boolean {
  return level.givens[row][col] !== null
}

/**
 * User-controlled cell shows conflict styling when filled and illegal.
 * Givens are never flagged (invalid puzzles should fail at parse time).
 */
export function cellShowsError(
  level: Level,
  values: (number | null)[][],
  row: number,
  col: number,
): boolean {
  if (isGiven(level, row, col)) return false
  return cellHasConflict(level, values, row, col)
}

export function isGridComplete(
  values: (number | null)[][],
  height: number,
  width: number,
): boolean {
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (values[r][c] === null) return false
    }
  }
  return true
}

export function isSolved(level: Level, values: (number | null)[][]): boolean {
  if (!isGridComplete(values, level.height, level.width)) return false
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      if (cellHasConflict(level, values, r, c)) return false
    }
  }
  return true
}

/** Digit allowed by region size only (not full constraint check). */
export function isDigitInRangeForCell(
  level: Level,
  row: number,
  col: number,
  digit: number,
): boolean {
  const rid = level.cellRegion[flatIndex(row, col, level.width)]
  const max = level.regionSize.get(rid) ?? 0
  return digit >= 1 && digit <= max
}
