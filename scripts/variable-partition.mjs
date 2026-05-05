/**
 * Satunnainen ortogonaalinen jako: jokainen alue on yhtenäinen, koko 1…cap (cap = min(H,W)).
 * Ei tasasuuruista jakoa (vähintään kaksi eri kokoa).
 *
 * Ohjatut histogrammit (_helpompi kuin vapaa jako):
 * 7×7: 1×(1 solu), 2×(2 solua), 3×(3 solua); loput alueet 4…7.
 * 8×8: 1×(1), 3×(2), 3×(3); loput 4…8.
 * 9×9: 2×(1), 3×(2), 3×(3), 2×(4); loput 5…9 (ei ylimääräisiä 4 alkioita isoissa tapauksissa).
 */
function gridDigitCap(H, W) {
  return Math.min(H, W)
}
const orth = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function key(r, c) {
  return `${r},${c}`
}

function pickTargetSize(rem, rng, cap) {
  if (rem <= 1) return 1
  const c = Math.min(cap, rem)
  if (rem <= cap) {
    if (rng() < 0.35) return rem
    return 1 + Math.floor(rng() * (rem - 1))
  }
  return 1 + Math.floor(rng() * Math.min(cap, rem - 1))
}

/**
 * Jako aloittamalla jokaisesta solusta oma alue, yhdistetään satunnaisia vierekkäisiä
 * pareja kun yhteenlaskettu koko ≤ 9. Tuottaa usein ratkaistavampia laudat isolla ruudukolla.
 */
export function growVariablePartitionByMerging(H, W, rng) {
  const cap = gridDigitCap(H, W)
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
          if (sa + sb <= cap) edges.push([lo, hi])
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

/** Montako aluetta on kullakin koolla (soluja / alue). */
export function regionSizeHistogram(regions) {
  const H = regions.length
  const W = regions[0].length
  const cellsPerId = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const id = regions[r][c]
      cellsPerId.set(id, (cellsPerId.get(id) ?? 0) + 1)
    }
  }
  const hist = new Map()
  for (const size of cellsPerId.values()) {
    hist.set(size, (hist.get(size) ?? 0) + 1)
  }
  return hist
}

/** 7×7 / 8×8 / 9×9 — pienten alueiden tavoitehistogrammi (+ isot alueet). */
export function matchesGuidedSmallRegionHistogram(H, W, regions) {
  if (H !== W || ![7, 8, 9].includes(H)) return true
  const cap = gridDigitCap(H, W)
  const hist = regionSizeHistogram(regions)
  if (H === 7) {
    if ((hist.get(1) ?? 0) !== 1) return false
    if ((hist.get(2) ?? 0) !== 2) return false
    if ((hist.get(3) ?? 0) !== 3) return false
  } else if (H === 8) {
    if ((hist.get(1) ?? 0) !== 1) return false
    if ((hist.get(2) ?? 0) !== 3) return false
    if ((hist.get(3) ?? 0) !== 3) return false
  } else {
    if ((hist.get(1) ?? 0) !== 2) return false
    if ((hist.get(2) ?? 0) !== 3) return false
    if ((hist.get(3) ?? 0) !== 3) return false
    if ((hist.get(4) ?? 0) !== 2) return false
  }
  const minLarge = H === 9 ? 5 : 4
  for (const [size, n] of hist) {
    if (size < 1 || size > cap || n < 1) return false
    if (size < minLarge) continue
    if (size > cap) return false
  }
  return true
}

/** @deprecated käytä matchesGuidedSmallRegionHistogram — sama rajapinta pool-skriptejä varten */
export function matches8899SmallRegionRule(H, W, regions) {
  return matchesGuidedSmallRegionHistogram(H, W, regions)
}

/** Kiinteät pienet koot (yhden regionin alkion koko). */
function guidedFixedCells(H) {
  if (H === 7) return [1, 2, 2, 3, 3, 3]
  if (H === 8) return [1, 2, 2, 2, 3, 3, 3]
  if (H === 9) return [1, 1, 2, 2, 2, 3, 3, 3, 4, 4]
  return null
}

function guidedBigPartitionBounds(H) {
  const cap = gridDigitCap(H, H)
  if (H === 9) return { minChunk: 5, maxChunk: cap }
  if (H === 7 || H === 8) return { minChunk: 4, maxChunk: cap }
  return null
}

/**
 * Jaa luku n summaksi, jossa jokainen termi on välillä [4,9].
 * @returns {number[] | null}
 */
function histogramEquals(a, b) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if ((b.get(k) ?? 0) !== v) return false
  }
  return true
}

/** Jaa n osiin väliltä [minChunk, maxChunk] (8899-isot alueet). */
function splitIntoChunkRange(n, rng, minChunk, maxChunk) {
  for (let t = 0; t < 4000; t++) {
    const parts = []
    let rem = n
    while (rem > maxChunk) {
      const maxS = Math.min(maxChunk, rem - minChunk)
      if (maxS < minChunk) break
      const s = minChunk + Math.floor(rng() * (maxS - minChunk + 1))
      parts.push(s)
      rem -= s
    }
    if (rem >= minChunk && rem <= maxChunk) {
      parts.push(rem)
      return parts
    }
  }
  return null
}

function shuffleSmall(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Kiinteät pienet + satunnainen iso jako; järjestys: suurimmista alaspäin (+ sekoitetut pienet). */
function buildGuidedSmallRegionSizes(H, rng) {
  const fixed = guidedFixedCells(H)
  const bounds = guidedBigPartitionBounds(H)
  if (!fixed || !bounds) return null
  const total = H * H
  const fixedSum = fixed.reduce((a, b) => a + b, 0)
  const rem = total - fixedSum
  const big = splitIntoChunkRange(rem, rng, bounds.minChunk, bounds.maxChunk)
  if (!big) return null
  const smallShuffled = shuffleSmall(fixed, rng)
  const bigDesc = [...big].sort((a, b) => b - a)
  return [...smallShuffled, ...bigDesc]
}

/**
 * Kasvata yhtenäisiä alueita annetuista kooista (suurin ensin).
 * @param {number[]} sizesDescending
 * @returns {number[][] | null}
 */
export function growPartitionWithRegionSizes(H, W, sizesDescending, rng) {
  const cap = gridDigitCap(H, W)
  const unassigned = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      unassigned.set(key(r, c), [r, c])
    }
  }

  const grid = Array.from({ length: H }, () => Array(W).fill(-1))
  let rid = 0

  for (const need of sizesDescending) {
    if (need < 1 || need > cap) return null
    if (unassigned.size < need) return null

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

  if (unassigned.size !== 0) return null
  return grid
}

function cloneHist(h) {
  return new Map(h)
}

function histL1(a, b) {
  let d = 0
  for (let s = 1; s <= 9; s++) {
    d += Math.abs((a.get(s) ?? 0) - (b.get(s) ?? 0))
  }
  return d
}

/** Histogrammi: montako aluetta on kullakin koolla (ei soluja). */
function regionCountHistBySize(groups) {
  const h = new Map()
  for (const cells of groups.values()) {
    const n = cells.length
    h.set(n, (h.get(n) ?? 0) + 1)
  }
  return h
}

/**
 * 7×7 / 8×8 / 9×9: ohjattu yhdistely kohti tavoitehistogrammia (lisää pieniä alueita).
 * @returns {number[][] | null}
 */
export function growGuidedSmallRegionByMerging(H, W, rng) {
  if (H !== W || ![7, 8, 9].includes(H)) return null
  const cap = gridDigitCap(H, W)
  const total = H * H
  const fixed = guidedFixedCells(H)
  const bounds = guidedBigPartitionBounds(H)
  if (!fixed || !bounds) return null
  const fixedSum = fixed.reduce((a, b) => a + b, 0)
  const big = splitIntoChunkRange(total - fixedSum, rng, bounds.minChunk, bounds.maxChunk)
  if (!big) return null

  const targetHist = new Map()
  for (const s of [...fixed, ...big]) {
    targetHist.set(s, (targetHist.get(s) ?? 0) + 1)
  }
  const targetRegionCount = [...targetHist.values()].reduce((a, b) => a + b, 0)
  const mergesNeeded = total - targetRegionCount

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

  for (let i = 0; i < mergesNeeded; i++) {
    const groups = buildGroups()
    const curHist = regionCountHistBySize(groups)
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
          if (sa + sb <= cap) edges.push([lo, hi, sa, sb])
        }
      }
    }
    if (!edges.length) return null

    const edgeKey = (lo, hi) => `${lo}|${hi}`
    const seenE = new Set()
    const uniq = []
    for (const [lo, hi, sa, sb] of edges) {
      const k = edgeKey(lo, hi)
      if (seenE.has(k)) continue
      seenE.add(k)
      uniq.push([lo, hi, sa, sb])
    }

    let bestScore = Infinity
    const candidates = []
    for (const [lo, hi, sa, sb] of uniq) {
      const nh = cloneHist(curHist)
      nh.set(sa, (nh.get(sa) ?? 0) - 1)
      if (nh.get(sa) === 0) nh.delete(sa)
      nh.set(sb, (nh.get(sb) ?? 0) - 1)
      if (nh.get(sb) === 0) nh.delete(sb)
      const ns = sa + sb
      nh.set(ns, (nh.get(ns) ?? 0) + 1)
      const sc = histL1(nh, targetHist)
      if (sc < bestScore) {
        bestScore = sc
        candidates.length = 0
        candidates.push([lo, hi])
      } else if (sc === bestScore) {
        candidates.push([lo, hi])
      }
    }

    const [keep, lose] = candidates[Math.floor(rng() * candidates.length)]
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

  const hist = regionSizeHistogram(grid)
  if (!histogramEquals(hist, targetHist)) return null
  return grid
}

/**
 * 7×7 / 8×8 / 9×9: satunnainen jako ohjatulla pienten alueiden histogramilla.
 * @returns {number[][] | null}
 */
export function growGuidedSmallRegionPartition(H, W, rng) {
  if (H !== W || ![7, 8, 9].includes(H)) return null
  if (H >= 8) {
    for (let k = 0; k < 160; k++) {
      const m = growGuidedSmallRegionByMerging(H, W, rng)
      if (m) return m
    }
    for (let k = 0; k < 100; k++) {
      const sizes = buildGuidedSmallRegionSizes(H, rng)
      if (!sizes) continue
      const g = growPartitionWithRegionSizes(H, W, sizes, rng)
      if (g) return g
    }
    return null
  }
  for (let k = 0; k < 160; k++) {
    const sizes = buildGuidedSmallRegionSizes(H, rng)
    if (!sizes) continue
    const g = growPartitionWithRegionSizes(H, W, sizes, rng)
    if (g) return g
  }
  for (let k = 0; k < 120; k++) {
    const m = growGuidedSmallRegionByMerging(H, W, rng)
    if (m) return m
  }
  return null
}

/** @deprecated käytä growGuidedSmallRegionPartition */
export function grow8899Partition(H, W, rng) {
  return growGuidedSmallRegionPartition(H, W, rng)
}

/** @deprecated käytä growGuidedSmallRegionByMerging */
export function grow8899ByMerging(H, W, rng) {
  return growGuidedSmallRegionByMerging(H, W, rng)
}

/**
 * Yksi satunnainen jako; epäonnistuu jos kasvu jumiin tai lopputulos tasakokoinen.
 * @param {number} H
 * @param {number} W
 * @param {() => number} rng
 * @returns {number[][] | null}
 */
function tryGrowVariablePartitionOnce(H, W, rng) {
  const cap = gridDigitCap(H, W)
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
    const need = pickTargetSize(rem, rng, cap)
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
  /** 7×7: vain ohattu jako (histogrammi pakollinen). 8–9: yhdistely ensin (nopeasti ratkaistavia). */
  if (H === W && H === 7) {
    for (let a = 0; a < 120; a++) {
      const g = growGuidedSmallRegionPartition(H, W, rng)
      if (g) return g
    }
  }
  if (n >= 16) {
    for (let a = 0; a < 120; a++) {
      const m = growVariablePartitionByMerging(H, W, rng)
      if (m) return m
    }
  }
  if (H === W && (H === 8 || H === 9)) {
    for (let a = 0; a < 120; a++) {
      const g = growGuidedSmallRegionPartition(H, W, rng)
      if (g) return g
    }
  }
  return growVariablePartition(H, W, rng, opts)
}
