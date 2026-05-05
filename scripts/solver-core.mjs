function buildContext(regions) {
  const H = regions.length
  const W = regions[0].length
  const gridCap = Math.min(W, H)
  const byRegion = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const id = regions[r][c]
      if (!byRegion.has(id)) byRegion.set(id, [])
      byRegion.get(id).push([r, c])
    }
  }
  const regionSize = new Map()
  for (const [id, cells] of byRegion) regionSize.set(id, cells.length)
  return { H, W, gridCap, regions, byRegion, regionSize }
}

function neighborCoords(r, c, H, W) {
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < H && nc >= 0 && nc < W) out.push([nr, nc])
    }
  }
  return out
}

function candidatesForCell(ctx, grid, r, c) {
  const rid = ctx.regions[r][c]
  const nMax = Math.min(ctx.regionSize.get(rid) ?? 0, ctx.gridCap)
  const cand = []
  for (let d = 1; d <= nMax; d++) {
    let ok = true
    for (const [nr, nc] of neighborCoords(r, c, ctx.H, ctx.W)) {
      if (grid[nr][nc] === d) {
        ok = false
        break
      }
    }
    if (!ok) continue
    for (const [rr, cc] of ctx.byRegion.get(rid)) {
      if (rr === r && cc === c) continue
      if (grid[rr][cc] === d) {
        ok = false
        break
      }
    }
    if (ok) cand.push(d)
  }
  return cand
}

function validateGivens(ctx, grid) {
  for (let r = 0; r < ctx.H; r++) {
    for (let c = 0; c < ctx.W; c++) {
      const v = grid[r][c]
      if (v === 0) continue
      grid[r][c] = 0
      const cand = candidatesForCell(ctx, grid, r, c)
      grid[r][c] = v
      if (!cand.includes(v)) return false
    }
  }
  return true
}

function solveByMrv(ctx, startGrid, maxNodes = Infinity) {
  const grid = startGrid.map((row) => [...row])
  let nodes = 0
  function dfs() {
    if (maxNodes !== Infinity && ++nodes > maxNodes) return null
    let bestR = -1
    let bestC = -1
    let best = null
    for (let r = 0; r < ctx.H; r++) {
      for (let c = 0; c < ctx.W; c++) {
        if (grid[r][c] !== 0) continue
        const cand = candidatesForCell(ctx, grid, r, c)
        if (cand.length === 0) return null
        if (!best || cand.length < best.length) {
          best = cand
          bestR = r
          bestC = c
          if (cand.length === 1) break
        }
      }
      if (best?.length === 1) break
    }
    if (!best) return grid.map((row) => [...row])
    for (const d of best) {
      grid[bestR][bestC] = d
      const res = dfs()
      if (res) return res
      grid[bestR][bestC] = 0
    }
    return null
  }
  return dfs()
}

/** Palauttaa ratkaisujen määrän, katkaisee kun maxSolutions saavutetaan. */
export function countSolutionsFromPuzzle(
  regions,
  givens,
  opts = {},
) {
  const maxSolutions = opts.maxSolutions ?? 2
  const maxNodes = opts.maxNodes ?? Infinity
  const ctx = buildContext(regions)
  const grid = givens.map((row) => row.map((v) => (v == null ? 0 : v)))
  if (!validateGivens(ctx, grid)) return 0
  let nodes = 0
  let count = 0
  function dfs() {
    if (count >= maxSolutions) return
    if (maxNodes !== Infinity && ++nodes > maxNodes) return
    let bestR = -1
    let bestC = -1
    let best = null
    for (let r = 0; r < ctx.H; r++) {
      for (let c = 0; c < ctx.W; c++) {
        if (grid[r][c] !== 0) continue
        const cand = candidatesForCell(ctx, grid, r, c)
        if (cand.length === 0) return
        if (!best || cand.length < best.length) {
          best = cand
          bestR = r
          bestC = c
          if (cand.length === 1) break
        }
      }
      if (best?.length === 1) break
    }
    if (!best) {
      count++
      return
    }
    for (const d of best) {
      grid[bestR][bestC] = d
      dfs()
      grid[bestR][bestC] = 0
      if (count >= maxSolutions) return
    }
  }
  dfs()
  return count
}

/**
 * Ratkaise ilman arvausta:
 * - naked singles (solulla vain 1 kandidaatti)
 * - hidden singles alueessa (digit mahtuu vain yhteen soluun)
 */
export function solveNoGuessFromPuzzle(regions, givens) {
  const ctx = buildContext(regions)
  const grid = givens.map((row) => row.map((v) => (v == null ? 0 : v)))
  if (!validateGivens(ctx, grid)) return null

  let progress = true
  while (progress) {
    progress = false
    // 1) naked singles
    for (let r = 0; r < ctx.H; r++) {
      for (let c = 0; c < ctx.W; c++) {
        if (grid[r][c] !== 0) continue
        const cand = candidatesForCell(ctx, grid, r, c)
        if (cand.length === 0) return null
        if (cand.length === 1) {
          grid[r][c] = cand[0]
          progress = true
        }
      }
    }
    // 2) hidden singles in each region
    for (const [rid, cells] of ctx.byRegion) {
      const max = Math.min(ctx.regionSize.get(rid) ?? 0, ctx.gridCap)
      const spots = new Map()
      for (let d = 1; d <= max; d++) spots.set(d, [])
      for (const [r, c] of cells) {
        if (grid[r][c] !== 0) continue
        const cand = candidatesForCell(ctx, grid, r, c)
        for (const d of cand) spots.get(d).push([r, c])
      }
      for (let d = 1; d <= max; d++) {
        const arr = spots.get(d)
        if (arr.length === 1) {
          const [r, c] = arr[0]
          if (grid[r][c] === 0) {
            grid[r][c] = d
            progress = true
          }
        }
      }
    }
  }

  for (let r = 0; r < ctx.H; r++) {
    for (let c = 0; c < ctx.W; c++) {
      if (grid[r][c] === 0) return null
    }
  }
  return grid
}

/**
 * Yksi ratkaisu tyhjästä aluekartasta (vanha rajapinta).
 * @param {number[][]} regions
 * @param {{ maxNodes?: number }} [opts]
 * @returns {number[][] | null}
 */
export function solveFromRegions(regions, opts = {}) {
  const ctx = buildContext(regions)
  const empty = Array.from({ length: ctx.H }, () => Array(ctx.W).fill(0))
  return solveByMrv(ctx, empty, opts.maxNodes ?? Infinity)
}
