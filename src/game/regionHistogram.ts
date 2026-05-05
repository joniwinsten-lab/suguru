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
 * 7×7 / 8×8 / 9×9: lisää ohjattuja pieniä alueita helpotusta varten.
 * 7×7: 1×(1 solu), 2×(2 solua), 3×(3 solua); loput ≥4.
 * 8×8: 1×(1), 3×(2), 3×(3); loput ≥4.
 * 9×9: 2×(1), 3×(2), 3×(3), 2×(4 solua); loput ≥5.
 */
export function matchesGuidedSmallRegionHistogram(
  height: number,
  width: number,
  regions: number[][],
): boolean {
  if (height !== width || ![7, 8, 9].includes(height)) return true
  const cap = Math.min(height, width)
  const hist = regionSizeHistogram(regions)
  if (height === 7) {
    if ((hist.get(1) ?? 0) !== 1) return false
    if ((hist.get(2) ?? 0) !== 2) return false
    if ((hist.get(3) ?? 0) !== 3) return false
  } else if (height === 8) {
    if ((hist.get(1) ?? 0) !== 1) return false
    if ((hist.get(2) ?? 0) !== 3) return false
    if ((hist.get(3) ?? 0) !== 3) return false
  } else {
    if ((hist.get(1) ?? 0) !== 2) return false
    if ((hist.get(2) ?? 0) !== 3) return false
    if ((hist.get(3) ?? 0) !== 3) return false
    if ((hist.get(4) ?? 0) !== 2) return false
  }
  const minLarge = height === 9 ? 5 : 4
  for (const [size, n] of hist) {
    if (size < 1 || size > cap || n < 1) return false
    if (size < minLarge) continue
  }
  return true
}

/** @deprecated käytä matchesGuidedSmallRegionHistogram */
export function is8899SmallRegionLayout(
  height: number,
  width: number,
  regions: number[][],
): boolean {
  return matchesGuidedSmallRegionHistogram(height, width, regions)
}
