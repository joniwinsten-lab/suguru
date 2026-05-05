/** 8-directional offsets including diagonals */
const DR = [-1, -1, -1, 0, 0, 1, 1, 1] as const
const DC = [-1, 0, 1, -1, 1, -1, 0, 1] as const

/** Suurin luku millä tahansa solulla (ei voi ylittää ruudukon lyhyempää sivua). */
export function gridDigitCap(width: number, height: number): number {
  return Math.min(width, height)
}

export function flatIndex(row: number, col: number, width: number): number {
  return row * width + col
}

export function rowCol(
  index: number,
  width: number,
): { row: number; col: number } {
  return { row: Math.floor(index / width), col: index % width }
}

export function neighborCoords(
  row: number,
  col: number,
  height: number,
  width: number,
): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < DR.length; i++) {
    const nr = row + DR[i]
    const nc = col + DC[i]
    if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
      out.push([nr, nc])
    }
  }
  return out
}
