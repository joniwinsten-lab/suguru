import type { Level, LevelJson } from './types'
import { flatIndex, gridDigitCap, neighborCoords } from './grid'

function assertDimensions(
  width: number,
  height: number,
  matrix: number[][] | (number | null)[][],
  name: string,
): void {
  if (matrix.length !== height) {
    throw new Error(`${name}: expected ${height} rows, got ${matrix.length}`)
  }
  for (let r = 0; r < height; r++) {
    if (matrix[r].length !== width) {
      throw new Error(`${name}: row ${r} width ${matrix[r].length}, expected ${width}`)
    }
  }
}

/**
 * Validates structure and Suguru clues; returns a normalized Level.
 * Does not verify unique solution — only that givens do not break rules.
 *
 * 8×8- ja 9×9-kentille suositeltu aluehistogrammi: `is8899SmallRegionLayout` (ks. `regionHistogram.ts`).
 */
export function parseLevel(raw: LevelJson): Level {
  const { id, title, width, height, regions, givens } = raw
  if (width < 2 || height < 2) {
    throw new Error('Level dimensions must be at least 2×2')
  }
  assertDimensions(width, height, regions, 'regions')
  assertDimensions(width, height, givens, 'givens')

  const regionCells = new Map<number, number[]>()
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const rid = regions[r][c]
      const idx = flatIndex(r, c, width)
      const list = regionCells.get(rid)
      if (list) list.push(idx)
      else regionCells.set(rid, [idx])
    }
  }

  const regionSize = new Map<number, number>()
  const cap = gridDigitCap(width, height)
  for (const [rid, cells] of regionCells) {
    const sz = cells.length
    if (sz > cap) {
      throw new Error(
        `Region ${rid} has ${sz} cells but ${width}×${height} grid allows at most ${cap} (digits 1…${cap})`,
      )
    }
    regionSize.set(rid, sz)
  }

  const cellRegion: number[] = new Array(width * height)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      cellRegion[flatIndex(r, c, width)] = regions[r][c]
    }
  }

  let maxDigit = 0
  for (const size of regionSize.values()) {
    if (size > maxDigit) maxDigit = size
  }

  const frozenRegions = new Map<number, readonly number[]>(
    [...regionCells].map(([k, v]) => [k, Object.freeze([...v])]),
  )

  const level: Level = {
    id,
    title,
    width,
    height,
    regions,
    givens,
    regionCells: frozenRegions,
    cellRegion,
    regionSize,
    maxDigit,
  }

  validateRegionContiguity(level)
  validateGivens(level)
  return level
}

function validateRegionContiguity(level: Level): void {
  const { width, height, regionCells } = level
  const visited = new Set<string>()

  for (const [rid, cells] of regionCells) {
    visited.clear()
    const start = cells[0]
    const { row: sr, col: sc } = indexToRC(start, width)
    const stack: [number, number][] = [[sr, sc]]
    const target = new Set(cells)

    while (stack.length) {
      const [r, c] = stack.pop()!
      const key = `${r},${c}`
      if (visited.has(key)) continue
      const idx = flatIndex(r, c, width)
      if (!target.has(idx)) continue
      if (level.cellRegion[idx] !== rid) {
        throw new Error(`Region ${rid}: cell (${r},${c}) has wrong region id`)
      }
      visited.add(key)
      if (r > 0) stack.push([r - 1, c])
      if (r + 1 < height) stack.push([r + 1, c])
      if (c > 0) stack.push([r, c - 1])
      if (c + 1 < width) stack.push([r, c + 1])
    }

    if (visited.size !== cells.length) {
      throw new Error(`Region ${rid} is not orthogonally contiguous`)
    }
  }
}

function indexToRC(index: number, width: number): { row: number; col: number } {
  return { row: Math.floor(index / width), col: index % width }
}

function validateGivens(level: Level): void {
  const { width, height, givens, regionSize } = level
  const values = givens.map((row) => [...row])

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const v = values[r][c]
      if (v === null) continue
      const rid = level.cellRegion[flatIndex(r, c, width)]
      const regionMax = regionSize.get(rid) ?? 0
      const cap = gridDigitCap(width, height)
      const max = Math.min(regionMax, cap)
      if (v < 1 || v > max) {
        throw new Error(
          `Given at (${r},${c}) is ${v} but max digit here is ${max} (region size ${regionMax}, grid cap ${cap})`,
        )
      }
    }
  }

  for (const [rid, cells] of level.regionCells) {
    const seen = new Set<number>()
    for (const idx of cells) {
      const { row, col } = indexToRC(idx, width)
      const v = values[row][col]
      if (v !== null) {
        if (seen.has(v)) {
          throw new Error(`Duplicate given ${v} in region ${rid}`)
        }
        seen.add(v)
      }
    }
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const v = values[r][c]
      if (v === null) continue
      if (cellConflictsWithNeighbors(level, values, r, c, v)) {
        throw new Error(`Given at (${r},${c}) conflicts with neighbor rule`)
      }
    }
  }
}

function cellConflictsWithNeighbors(
  level: Level,
  values: (number | null)[][],
  row: number,
  col: number,
  value: number,
): boolean {
  for (const [nr, nc] of neighborCoords(row, col, level.height, level.width)) {
    const nv = values[nr][nc]
    if (nv !== null && nv === value) return true
  }
  return false
}
