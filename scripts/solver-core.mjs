/**
 * Suguru solver — yksi ratkaisu tai null (MRV / rajauseuranta kevyesti).
 * @param {number[][]} regions
 * @param {{ maxNodes?: number }} [opts]
 * @returns {number[][] | null}
 */
export function solveFromRegions(regions, opts = {}) {
  const maxNodes = opts.maxNodes ?? Infinity
  const H = regions.length
  const W = regions[0].length
  const gridCap = Math.min(W, H)

  const neighbors = (r, c) => {
    const o = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr,
          nc = c + dc
        if (nr >= 0 && nr < H && nc >= 0 && nc < W) o.push([nr, nc])
      }
    }
    return o
  }

  const rid = (r, c) => regions[r][c]
  const byRegion = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const id = rid(r, c)
      if (!byRegion.has(id)) byRegion.set(id, [])
      byRegion.get(id).push([r, c])
    }
  }

  const regionSize = new Map()
  for (const [id, cells] of byRegion) {
    regionSize.set(id, cells.length)
  }

  function partialOk(grid, r, c, d) {
    for (const [nr, nc] of neighbors(r, c)) {
      const nv = grid[nr][nc]
      if (nv !== 0 && nv === d) return false
    }
    const rCells = byRegion.get(rid(r, c))
    for (const [rr, cc] of rCells) {
      if (rr === r && cc === c) continue
      const v = grid[rr][cc]
      if (v !== 0 && v === d) return false
    }
    return true
  }

  let nodes = 0

  function dfs(grid) {
    if (maxNodes !== Infinity && ++nodes > maxNodes) return null

    let bestR = -1,
      bestC = -1
    let bestOpts = null
    let minLen = 99

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (grid[r][c] !== 0) continue
        const nMax = Math.min(regionSize.get(rid(r, c)), gridCap)
        const cand = []
        for (let d = 1; d <= nMax; d++) {
          if (partialOk(grid, r, c, d)) cand.push(d)
        }
        if (cand.length === 0) return null
        if (cand.length < minLen) {
          minLen = cand.length
          bestR = r
          bestC = c
          bestOpts = cand
          if (minLen === 1) break
        }
      }
      if (minLen === 1) break
    }

    if (bestR < 0) return grid

    for (const d of bestOpts) {
      grid[bestR][bestC] = d
      const res = dfs(grid)
      if (res) return res
      grid[bestR][bestC] = 0
    }
    return null
  }

  const grid = Array.from({ length: H }, () => Array(W).fill(0))
  return dfs(grid)
}
