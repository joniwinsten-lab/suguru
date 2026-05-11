#!/usr/bin/env node
/**
 * Generoi public/pools/{tierId}.json — useita satunnaisia ratkaistavia kenttiä / vaikeustaso.
 * POOL_COUNT oletus 3 kenttää / vaikeustaso (vaihda esim. POOL_COUNT=20).
 *
 * Alueet: yhtenäiset, koko enintään min(H,W) solua, ei tasasuuruista jakoa (vähintään kaksi eri kokoa).
 * 7×7: 1×(1 solu), 2×(2 solua), 3×(3 solua); loput 4…7.
 * 8×8: 1×(1), 3×(2), 3×(3); loput 4…8.
 * 9×9 (legend-9): vapaa jako (aluekoot 1…9), ei kiinteää histogrammia; kentät uniikkeja.
 * Vihjeet: pyöristetty 25 % ruudukon soluista, satunnaisesti jaoteltu; arvot oikeasta ratkaisusta.
 *
 *   node scripts/build-level-pools.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  countSolutionsFromPuzzle,
  solveFromRegions,
  solveNoGuessFromPuzzle,
} from './solver-core.mjs'
import {
  growGuidedSmallRegionPartition,
  growVariablePartitionAny,
  hasHeterogeneousRegionSizes,
  matchesGuidedSmallRegionHistogram,
} from './variable-partition.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'pools')

const POOL_COUNT = parseInt(process.env.POOL_COUNT || '50', 10)
const TIER_FILTER = process.env.TIERS
  ? new Set(process.env.TIERS.split(',').map((x) => x.trim()).filter(Boolean))
  : null

function clueFractionBoundsForTier(tierId) {
  if (tierId === 'beginner-4a') return { min: 0.3, max: 0.5 }
  if (tierId === 'easy-6') return { min: 0.3, max: 0.5 }
  if (tierId === 'hard-7') return { min: 0.3, max: 0.5 }
  if (tierId === 'pro-8') return { min: 0.3, max: 0.5 }
  if (tierId === 'legend-9') return { min: 0.56, max: 0.62 }
  return { min: 0.3, max: 0.5 }
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

/** Satunnaiset solut; lukumäärä = max(1, round(H*W * 25%)). Arvot ratkaisusta → vihjeet ovat aina säännönmukaiset. */
function givensFractionRandomSeeded(regions, sol, seed, fraction) {
  const H = regions.length
  const W = regions[0].length
  const total = H * W
  const rng = mulberry32(seed >>> 0)
  const k = Math.min(total, Math.max(1, Math.round(total * fraction)))
  const cells = []
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      cells.push([r, c])
    }
  }
  shuffleInPlace(cells, rng)
  const g = Array.from({ length: H }, () => Array(W).fill(null))
  for (let i = 0; i < k; i++) {
    const [r, c] = cells[i]
    g[r][c] = sol[r][c]
  }
  return g
}

function hashSeed(tierId, index) {
  let h = 2166136261
  const s = `${tierId}:${index}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const TIERS = [
  { id: 'beginner-4a', title: '4×4 — Aloittelija', h: 4, w: 4 },
  { id: 'easy-6', title: '6×6 — Helppo', h: 6, w: 6 },
  { id: 'hard-7', title: '7×7 — Vaikea', h: 7, w: 7 },
  { id: 'pro-8', title: '8×8 — Ammattilainen', h: 8, w: 8 },
  { id: 'legend-9', title: '9×9 — Legenda', h: 9, w: 9 },
]

/**
 * 4×4: satunnainen jako + kapasiteetti ≤4 tuottaa käytännössä vain ratkaisemattomia karttoja.
 * Kolme klassista tasakokoista jakoa (takavaihe voi silti näyttää eri vihjeitä / kierroksia).
 */
const CURATED_4x4 = [
  [
    [0, 0, 1, 1],
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [2, 2, 3, 3],
  ],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [2, 2, 2, 2],
    [3, 3, 3, 3],
  ],
  [
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
  ],
]

/** Kiinteät, solverilla verifioidut ohjatut histogrammit pyydettyihin 7×7/8×8/9×9 sääntöihin. */
const CURATED_GUIDED = {
  'hard-7': [
    [
      [0, 0, 0, 0, 1, 1, 2],
      [3, 0, 4, 5, 5, 5, 2],
      [3, 4, 4, 4, 5, 5, 2],
      [3, 4, 6, 7, 8, 7, 9],
      [3, 4, 6, 7, 7, 7, 9],
      [3, 10, 10, 10, 7, 7, 9],
      [10, 10, 10, 10, 11, 11, 11],
    ],
  ],
  'pro-8': [
    [
      [0, 0, 1, 1, 1, 2, 2, 2],
      [3, 3, 3, 4, 2, 2, 2, 2],
      [3, 3, 4, 4, 5, 5, 6, 6],
      [7, 4, 4, 4, 5, 8, 8, 6],
      [7, 9, 4, 10, 10, 10, 8, 6],
      [7, 9, 4, 10, 10, 10, 8, 8],
      [7, 11, 11, 12, 12, 10, 10, 13],
      [14, 11, 11, 11, 11, 11, 13, 13],
    ],
  ],
}

function transformGrid(regions, mode) {
  const H = regions.length
  const W = regions[0].length
  if (mode === 'id') return regions.map((row) => [...row])
  if (mode === 'rot90') {
    const out = Array.from({ length: W }, () => Array(H).fill(0))
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) out[c][H - 1 - r] = regions[r][c]
    return out
  }
  if (mode === 'rot180') {
    const out = Array.from({ length: H }, () => Array(W).fill(0))
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) out[H - 1 - r][W - 1 - c] = regions[r][c]
    return out
  }
  if (mode === 'rot270') {
    const out = Array.from({ length: W }, () => Array(H).fill(0))
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) out[W - 1 - c][r] = regions[r][c]
    return out
  }
  if (mode === 'flipH') return regions.map((row) => [...row].reverse())
  if (mode === 'flipV') return [...regions].reverse().map((row) => [...row])
  if (mode === 'diag') {
    const out = Array.from({ length: W }, () => Array(H).fill(0))
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) out[c][r] = regions[r][c]
    return out
  }
  if (mode === 'antiDiag') {
    const out = Array.from({ length: W }, () => Array(H).fill(0))
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) out[W - 1 - c][H - 1 - r] = regions[r][c]
    return out
  }
  return regions.map((row) => [...row])
}

function curatedVariants(regions) {
  const modes = ['id', 'rot90', 'rot180', 'rot270', 'flipH', 'flipV', 'diag', 'antiDiag']
  const out = []
  const seen = new Set()
  for (const mode of modes) {
    const next = transformGrid(regions, mode)
    const key = JSON.stringify(next)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(next)
  }
  return out
}

/** Yksi ratkaisuyritys solmurajalla (tyhjät jaot hylätään ilman useaa täyttä DFS:ää). */
function solveForLayoutBank(regions, H, W) {
  const n = H * W
  const maxNodes =
    n <= 16
      ? 2_000_000
      : n <= 36
        ? 6_000_000
        : n <= 49
          ? 12_000_000
          : n <= 64
            ? 18_000_000
            : 4_000_000
  return solveFromRegions(regions, { maxNodes })
}

/** Kerää erikokoisia ratkaistavia aluekarttoja (ei tasasuuruista jakoa). */
function collectRegionLayouts(tierId, H, W, want, maxTries, seedSalt) {
  const seen = new Set()
  const preferred = []
  const other = []
  const guidedHistogram = H === W && H >= 7 && H <= 9 && tierId !== 'legend-9'

  const curated = CURATED_GUIDED[tierId]
  if (curated) {
    for (const baseRegions of curated) {
      for (const regions of curatedVariants(baseRegions)) {
        const k = JSON.stringify(regions)
        if (seen.has(k)) continue
        if (!matchesGuidedSmallRegionHistogram(H, W, regions)) continue
        if (!solveForLayoutBank(regions, H, W)) continue
        seen.add(k)
        preferred.push(regions.map((row) => [...row]))
      }
    }
  }

  if (H === 4 && W === 4) {
    for (const regions of CURATED_4x4) {
      const k = JSON.stringify(regions)
      if (seen.has(k)) continue
      if (!solveForLayoutBank(regions, H, W)) continue
      seen.add(k)
      other.push(regions.map((row) => [...row]))
      if (preferred.length + other.length >= want) {
        return [...preferred, ...other].slice(0, want)
      }
    }
  }

  for (let t = 0; t < maxTries && preferred.length + other.length < want; t++) {
    const rng = mulberry32((seedSalt ^ (t * 0x9e3779b1)) >>> 0)
    const regions = growVariablePartitionAny(H, W, rng)
    if (!regions) continue
    if (tierId === 'legend-9' && !hasHeterogeneousRegionSizes(regions)) continue
    const k = JSON.stringify(regions)
    if (seen.has(k)) continue
    if (!(tierId === 'legend-9' && H === 9 && W === 9)) {
      if (!solveForLayoutBank(regions, H, W)) continue
    }
    seen.add(k)
    const copy = regions.map((row) => [...row])
    if (guidedHistogram && matchesGuidedSmallRegionHistogram(H, W, regions)) {
      preferred.push(copy)
    } else {
      other.push(copy)
    }
  }

  const guidedExtra =
    H === 7 ? 6_000 : H === 8 ? 10_000 : H === 9 ? 14_000 : 0
  if (guidedHistogram && preferred.length < want) {
    for (
      let t = 0;
      t < guidedExtra && preferred.length < want;
      t++
    ) {
      const rng = mulberry32((seedSalt ^ 0xcafe_5eed ^ (t * 0xdeadbeef)) >>> 0)
      const regions = growGuidedSmallRegionPartition(H, W, rng)
      if (!regions) continue
      const k = JSON.stringify(regions)
      if (seen.has(k)) continue
      if (!matchesGuidedSmallRegionHistogram(H, W, regions)) continue
      if (!solveForLayoutBank(regions, H, W)) continue
      seen.add(k)
      preferred.push(regions.map((row) => [...row]))
    }
  }

  if (guidedHistogram) return preferred.slice(0, want)
  const out = [...preferred, ...other]
  return out.slice(0, want)
}

const solMemo = new Map()
function solutionFor(regions) {
  const key = JSON.stringify(regions)
  let sol = solMemo.get(key)
  if (!sol) {
    const H = regions.length
    const W = regions[0].length
    const n = H * W
    const maxNodes =
      n <= 16
        ? 10_000_000
        : n <= 36
          ? 25_000_000
          : n <= 49
            ? 40_000_000
            : n <= 64
              ? 55_000_000
              : 22_000_000
    sol = solveFromRegions(regions, { maxNodes })
    if (!sol) return null
    solMemo.set(key, sol)
  }
  return sol.map((row) => [...row])
}

/**
 * Etsi vihjeasettelu, joka on:
 * 1) yksikäsitteinen (vain 1 ratkaisu)
 * 2) ratkaistavissa ilman arvausta (naked/hidden singles alueissa).
 */
function findDeterministicUniqueGivens(regions, solution, tierId, levelIndex, minFraction, maxFraction) {
  const n = regions.length * regions[0].length
  const start = hashSeed(tierId, levelIndex * 1543 + 97)
  const countOpts = { maxSolutions: 2, maxNodes: n > 64 ? 8_000_000 : 4_000_000 }

  if (tierId === 'legend-9') {
    const rng = mulberry32((start ^ levelIndex * 0xface) >>> 0)
    for (let a = 0; a < 520; a++) {
      const frac = 0.52 + rng() * (0.68 - 0.52)
      const seed = (start ^ Math.imul(a + 1, 0x9e3779b1)) >>> 0
      const givens = givensFractionRandomSeeded(regions, solution, seed, frac)
      const noGuess = solveNoGuessFromPuzzle(regions, givens)
      if (!noGuess) continue
      const count = countSolutionsFromPuzzle(regions, givens, countOpts)
      if (count !== 1) continue
      return givens
    }
    return null
  }

  const tries = tierId === 'pro-8' ? 240 : 220
  const fractions = []
  for (let f = minFraction; f <= maxFraction + 1e-9; f += 0.02) {
    fractions.push(Number(Math.min(maxFraction, f).toFixed(2)))
  }
  const hardCap = 0.5
  const tail = []
  if (maxFraction < hardCap - 1e-9) {
    for (let f = maxFraction + 0.02; f <= hardCap + 1e-9; f += 0.02) {
      tail.push(Number(Math.min(hardCap, f).toFixed(2)))
    }
  }
  const fractionOrder = [...new Set([...fractions, ...tail])]
  for (const frac of fractionOrder) {
    for (let t = 0; t < tries; t++) {
      const seed = (start ^ Math.imul(t + 1, 0x9e3779b1)) >>> 0
      const givens = givensFractionRandomSeeded(regions, solution, seed, frac)
      let givenCount = 0
      for (let r = 0; r < regions.length; r++) {
        for (let c = 0; c < regions[0].length; c++) {
          if (givens[r][c] != null) givenCount++
        }
      }
      const ratio = givenCount / n
      if (ratio < minFraction - 1e-9 || ratio > maxFraction + 1e-9) continue
      const noGuess = solveNoGuessFromPuzzle(regions, givens)
      if (!noGuess) continue
      const count = countSolutionsFromPuzzle(regions, givens, countOpts)
      if (count !== 1) continue
      return givens
    }
  }
  return null
}

function cloneGivensGrid(grid) {
  return grid.map((row) => [...row])
}

function listGivenCellsGrid(givens) {
  const out = []
  for (let r = 0; r < givens.length; r++) {
    for (let c = 0; c < givens[0].length; c++) {
      if (givens[r][c] != null) out.push([r, c])
    }
  }
  return out
}

function canKeepLegend9(regions, givens) {
  if (!solveNoGuessFromPuzzle(regions, givens)) return false
  const count = countSolutionsFromPuzzle(regions, givens, {
    maxSolutions: 2,
    maxNodes: 12_000_000,
  })
  return count === 1
}

/** legend-9: julkaisuraja (56–62 %) vihjeille buildTierin lopussa. */
function rebalanceLegend9Clues(level, minRatio, maxRatio) {
  const total = level.width * level.height
  const minCount = Math.max(1, Math.ceil(total * minRatio))
  const maxCount = Math.max(minCount, Math.floor(total * maxRatio))
  const solution = solveFromRegions(level.regions, { maxNodes: 18_000_000 })
  if (!solution) throw new Error(`Unsolvable layout in ${level.id}`)

  let givens = cloneGivensGrid(level.givens)
  let cells = listGivenCellsGrid(givens)
  const rng = mulberry32((hashSeed(level.id, 0) ^ (cells.length * 7919)) >>> 0)
  const target = minCount + Math.floor(rng() * (maxCount - minCount + 1))

  if (cells.length < minCount) {
    const open = []
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        if (givens[r][c] == null) open.push([r, c])
      }
    }
    shuffleInPlace(open, rng)
    while (cells.length < minCount && open.length > 0) {
      const [r, c] = open.pop()
      givens[r][c] = solution[r][c]
      cells.push([r, c])
    }
  }

  while (cells.length > target) {
    let removed = false
    const candidates = [...cells]
    shuffleInPlace(candidates, rng)
    for (const [r, c] of candidates) {
      const next = cloneGivensGrid(givens)
      next[r][c] = null
      if (!canKeepLegend9(level.regions, next)) continue
      givens = next
      cells = listGivenCellsGrid(givens)
      removed = true
      break
    }
    if (!removed) break
  }

  if (cells.length < target) {
    const open = []
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        if (givens[r][c] == null) open.push([r, c])
      }
    }
    shuffleInPlace(open, rng)
    while (cells.length < target && open.length > 0) {
      const [r, c] = open.pop()
      givens[r][c] = solution[r][c]
      cells.push([r, c])
    }
  }

  cells = listGivenCellsGrid(givens)
  if (cells.length < minCount || cells.length > maxCount) {
    throw new Error(`Unable to rebalance clues for ${level.id}`)
  }
  if (!canKeepLegend9(level.regions, givens)) {
    throw new Error(`Rebalance broke unique/no-guess for ${level.id}`)
  }
  return givens
}

function buildTier(tier) {
  const levels = []
  const { id, title, h, w } = tier
  const clueBounds = clueFractionBoundsForTier(id)

  const layoutWant =
    id === 'beginner-4a'
      ? Math.min(24, POOL_COUNT)
      : id === 'legend-9'
        ? Math.min(100, POOL_COUNT + 45)
        : POOL_COUNT
  const layoutMaxTries = id === 'legend-9' ? 12_000 : 2200
  const seedSalt = hashSeed(id, 0xf00d_5eed)
  let layoutBank = collectRegionLayouts(id, h, w, layoutWant, layoutMaxTries, seedSalt)
  if (layoutBank.length === 0) {
    layoutBank = collectRegionLayouts(id, h, w, layoutWant, 12_000, seedSalt ^ 0xace0_ace0)
  }
  if (layoutBank.length === 0) {
    throw new Error(`no solvable heterogeneous layouts for ${id}`)
  }

  const usedLayoutKeys = id === 'legend-9' ? new Set() : null
  const usedSolutionKeys = id === 'legend-9' ? new Set() : null

  for (let i = 0; i < POOL_COUNT; i++) {
    let pickedRegions = null
    let givens = null
    for (let j = 0; j < layoutBank.length; j++) {
      const template = layoutBank[j]
      const layoutKey = JSON.stringify(template)
      if (usedLayoutKeys?.has(layoutKey)) continue

      const regions = template.map((row) => [...row])
      const sol = solutionFor(regions)
      if (!sol) continue
      const solutionKey = id === 'legend-9' ? JSON.stringify(sol) : null
      if (solutionKey && usedSolutionKeys?.has(solutionKey)) continue
      let candidate = null
      const variants = 12
      for (let seedVariant = 0; seedVariant < variants && !candidate; seedVariant++) {
        const idx = i * 100 + j + seedVariant * 10_000
        candidate = findDeterministicUniqueGivens(
          regions,
          sol,
          id,
          idx,
          clueBounds.min,
          clueBounds.max,
        )
      }
      if (!candidate) continue
      pickedRegions = regions
      givens = candidate
      usedLayoutKeys?.add(layoutKey)
      if (solutionKey) usedSolutionKeys?.add(solutionKey)
      break
    }
    if (!pickedRegions || !givens) {
      throw new Error(
        `failed to build deterministic+unique givens for ${id}-${String(i).padStart(3, '0')}`,
      )
    }

    levels.push({
      id: `${id}-${String(i).padStart(3, '0')}`,
      title,
      width: w,
      height: h,
      regions: pickedRegions,
      givens,
    })
    if (id === 'legend-9' && (i + 1) % 5 === 0) {
      console.error('legend-9 progress', i + 1, '/', POOL_COUNT)
    }
  }

  if (id === 'legend-9') {
    const b = clueFractionBoundsForTier(id)
    for (const level of levels) {
      level.givens = rebalanceLegend9Clues(level, b.min, b.max)
    }
  }

  return { tierId: id, tierTitle: title, count: levels.length, levels }
}

mkdirSync(outDir, { recursive: true })

const activeTiers = TIER_FILTER ? TIERS.filter((tier) => TIER_FILTER.has(tier.id)) : TIERS

for (const tier of activeTiers) {
  console.error('building', tier.id, '×', POOL_COUNT, '...')
  const pack = buildTier(tier)
  const path = join(outDir, `${tier.id}.json`)
  writeFileSync(path, JSON.stringify(pack), 'utf8')
  console.error('wrote', path, pack.count)
}

console.error('done')
