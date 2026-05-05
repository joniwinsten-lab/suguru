/** Montako aluetta on kullakin koolla (soluja / alue). */
export function regionSizeHistogram(regions: number[][]): Map<number, number> {
  const H = regions.length
  const W = regions[0]?.length ?? 0
  const cellsPerId = new Map<number, number>()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const id = regions[r]![c]!
      cellsPerId.set(id, (cellsPerId.get(id) ?? 0) + 1)
    }
  }
  const hist = new Map<number, number>()
  for (const size of cellsPerId.values()) {
    hist.set(size, (hist.get(size) ?? 0) + 1)
  }
  return hist
}

/**
 * 8×8 ja 9×9: tasan yksi 1-soluinen, kaksi 2-soluista, kolme 3-soluista aluetta;
 * muut alueet kooltaan 4…N (N = ruudukon sivun pituus).
 */
export function is8899SmallRegionLayout(
  height: number,
  width: number,
  regions: number[][],
): boolean {
  if (height !== width || (height !== 8 && height !== 9)) return true
  const cap = Math.min(height, width)
  const hist = regionSizeHistogram(regions)
  if ((hist.get(1) ?? 0) !== 1) return false
  if ((hist.get(2) ?? 0) !== 2) return false
  if ((hist.get(3) ?? 0) !== 3) return false
  for (const [size, n] of hist) {
    if (size < 1 || size > cap || n < 1) return false
    if (size <= 3) continue
  }
  return true
}
