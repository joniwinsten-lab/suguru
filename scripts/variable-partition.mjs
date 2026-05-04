/**
 * Satunnainen ortogonaalinen jako: jokainen alue on yhtenäinen, koko 1…9 solua.
 * Ei tasasuuruista jakoa (vähintään kaksi eri kokoa).
 */
const orth = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function key(r, c) {
  return `${r},${c}`
}

function pickTargetSize(rem, rng) {
  if (rem <= 1) return 1
  if (rem <= 9) {
    if (rng() < 0.35) return rem
    return 1 + Math.floor(rng() * (rem - 1))
  }
  return 1 + Math.floor(rng() * Math.min(9, rem - 1))
}

/**
 * Jako aloittamalla jokaisesta solusta oma alue, yhdistetään satunnaisia vierekkäisiä
 * pareja kun yhteenlaskettu koko ≤ 9. Tuottaa usein ratkaistavampia laudat isolla ruudukolla.
 */
export function growVariablePartitionByMerging(H, W, rng) {
  const lab = Array.from({ length: H }, (_, r) =>
    Array.from({ length: W }, (_, c) => r * W + c),
  )

  function buildGroups() {
    const m = new Map()
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const id = lab[r][c]
        if (!m.has(id)) m.set(id, [])
        m.get(id).push([r, c])
      }
    }
    return m
  }

  for (let round = 0; round < H * W * 2; round++) {
    const groups = buildGroups()
    const edges = []
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        for (const [dr, dc] of orth) {
          const nr = r + dr,
            nc = c + dc
          if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue
          const a = lab[r][c],
            b = lab[nr][nc]
          if (a === b) continue
          const lo = Math.min(a, b),
            hi = Math.max(a, b)
          const sa = groups.get(lo).length,
            sb = groups.get(hi).length
          if (sa + sb <= 9) edges.push([lo, hi])
        }
      }
    }
    if (!edges.length) break
    const [keep, lose] = edges[Math.floor(rng() * edges.length)]
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (lab[r][c] === lose) lab[r][c] = keep
      }
    }
  }

  const remap = new Map()
  let nid = 0
  const grid = Array.from({ length: H }, () => Array(W).fill(0))
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const old = lab[r][c]
      if (!remap.has(old)) remap.set(old, nid++)
      grid[r][c] = remap.get(old)
    }
  }

  if (!hasHeterogeneousRegionSizes(grid)) return null
  return grid
}

/** Palauttaa true, jos aluekokoihin kuuluu vähintään kaksi eri arvoa. */
export function hasHeterogeneousRegionSizes(regions) {
  const H = regions.length
  const W = regions[0].length
  const counts = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const id = regions[r][c]
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return new Set(counts.values()).size >= 2
}

/**
 * Yksi satunnainen jako; epäonnistuu jos kasvu jumiin tai lopputulos tasakokoinen.
 * @param {number} H
 * @param {number} W
 * @param {() => number} rng
 * @returns {number[][] | null}
 */
function tryGrowVariablePartitionOnce(H, W, rng) {
  const unassigned = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      unassigned.set(key(r, c), [r, c])
    }
  }

  const grid = Array.from({ length: H }, () => Array(W).fill(-1))
  let rid = 0

  while (unassigned.size > 0) {
    const rem = unassigned.size
    const need = pickTargetSize(rem, rng)
    const starts = [...unassigned.values()]
    const start = starts[Math.floor(rng() * starts.length)]

    const comp = [start]
    const inComp = new Set([key(start[0], start[1])])

    while (comp.length < need) {
      const border = []
      for (const [r, c] of comp) {
        for (const [dr, dc] of orth) {
          const nr = r + dr,
            nc = c + dc
          const k2 = key(nr, nc)
          if (unassigned.has(k2) && !inComp.has(k2)) {
            border.push(unassigned.get(k2))
          }
        }
      }
      if (!border.length) return null
      const pick = border[Math.floor(rng() * border.length)]
      comp.push(pick)
      inComp.add(key(pick[0], pick[1]))
    }

    if (comp.length !== need) return null

    for (const [r, c] of comp) {
      unassigned.delete(key(r, c))
      grid[r][c] = rid
    }
    rid++
  }

  if (!hasHeterogeneousRegionSizes(grid)) return null
  return grid
}

/**
 * @param {number} H
 * @param {number} W
 * @param {() => number} rng — palauttaa [0,1)
 * @param {{ partitionAttempts?: number }} [opts]
 * @returns {number[][] | null}
 */
export function growVariablePartition(H, W, rng, opts = {}) {
  const n = H * W
  const defaultAttempts = n > 48 ? 500 : n > 24 ? 350 : 200
  const attempts = opts.partitionAttempts ?? defaultAttempts
  for (let a = 0; a < attempts; a++) {
    const g = tryGrowVariablePartitionOnce(H, W, rng)
    if (g) return g
  }
  return null
}

/**
 * Isommilla ruuduilla yhdistelyjako ensin (useammin yhtenäinen topologia), sitten kasvatus.
 * @param {{ partitionAttempts?: number }} [opts]
 */
export function growVariablePartitionAny(H, W, rng, opts = {}) {
  const n = H * W
  if (n > 16) {
    for (let a = 0; a < 120; a++) {
      const m = growVariablePartitionByMerging(H, W, rng)
      if (m) return m
    }
  }
  return growVariablePartition(H, W, rng, opts)
}
