/**
 * Suguru solver — yksi ratkaisu tai null.
 * @param {number[][]} regions
 * @param {{ maxNodes?: number }} [opts] — generaattorissa rajoita (vältä eksponentiaalinen jumi).
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
    const cells = byRegion.get(rid(r, c))
    for (const [rr, cc] of cells) {
      if (rr === r && cc === c) continue
      const v = grid[rr][cc]
      if (v !== 0 && v === d) return false
    }
    return true
  }

  const cells = []
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) cells.push([r, c])

  cells.sort((a, b) => {
    const da = regionSize.get(rid(a[0], a[1]))
    const db = regionSize.get(rid(b[0], b[1]))
    return db - da
  })

  let nodes = 0
  function dfs(grid, pos) {
    if (maxNodes !== Infinity && ++nodes > maxNodes) return null
    if (pos === cells.length) return grid
    const [r, c] = cells[pos]
    const n = Math.min(regionSize.get(rid(r, c)), gridCap)
    for (let d = 1; d <= n; d++) {
      if (!partialOk(grid, r, c, d)) continue
      grid[r][c] = d
      const res = dfs(grid, pos + 1)
      if (res) return res
      grid[r][c] = 0
    }
    return null
  }

  const grid = Array.from({ length: H }, () => Array(W).fill(0))
  return dfs(grid, 0)
}
