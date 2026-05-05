#!/usr/bin/env node
/**
 * Generoi public/pools/{tierId}.json — useita satunnaisia ratkaistavia kenttiä / vaikeustaso.
 * POOL_COUNT oletus 3 kenttää / vaikeustaso (vaihda esim. POOL_COUNT=20).
 *
 * Alueet: yhtenäiset, koko enintään min(H,W) solua, ei tasasuuruista jakoa (vähintään kaksi eri kokoa).
 * 7×7: 1×(1 solu), 2×(2 solua), 3×(3 solua); loput 4…7.
 * 8×8: 1×(1), 3×(2), 3×(3); loput 4…8.
 * 9×9: 2×(1), 3×(2), 3×(3), 2×(4 solua); loput 5…9.
 * Vihjeet: pyöristetty 25 % ruudukon soluista, satunnaisesti jaoteltu; arvot oikeasta ratkaisusta.
 *
 *   node scripts/build-level-pools.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { solveFromRegions } from './solver-core.mjs'
import {
  growGuidedSmallRegionPartition,
  growVariablePartitionAny,
  matchesGuidedSmallRegionHistogram,
} from './variable-partition.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'pools')

const POOL_COUNT = parseInt(process.env.POOL_COUNT || '10', 10)

function givenFractionForTier(tierId) {
  if (tierId === 'hard-7') return 0.45
  if (tierId === 'pro-8') return 0.48
  if (tierId === 'legend-9') return 0.5
  return 0.25
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
  'legend-9': [
    [
      [0, 1, 1, 1, 2, 2, 3, 3, 4],
      [0, 1, 1, 1, 1, 1, 3, 3, 4],
      [0, 0, 5, 5, 3, 3, 3, 6, 4],
      [7, 7, 5, 5, 3, 8, 8, 6, 6],
      [7, 7, 7, 9, 10, 10, 10, 6, 6],
      [7, 11, 7, 9, 10, 10, 6, 6, 6],
      [11, 11, 12, 9, 13, 14, 15, 14, 16],
      [12, 12, 12, 13, 13, 14, 15, 14, 14],
      [12, 17, 12, 13, 13, 14, 14, 14, 14],
    ],
  ],
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
            : 28_000_000
  return solveFromRegions(regions, { maxNodes })
}

/** Kerää erikokoisia ratkaistavia aluekarttoja (ei tasasuuruista jakoa). */
function collectRegionLayouts(tierId, H, W, want, maxTries, seedSalt) {
  const seen = new Set()
  const preferred = []
  const other = []
  const guidedSquare = H === W && H >= 7 && H <= 9

  const curated = CURATED_GUIDED[tierId]
  if (curated) {
    for (const regions of curated) {
      const k = JSON.stringify(regions)
      if (seen.has(k)) continue
      if (!matchesGuidedSmallRegionHistogram(H, W, regions)) continue
      if (!solveForLayoutBank(regions, H, W)) continue
      seen.add(k)
      preferred.push(regions.map((row) => [...row]))
      if (preferred.length >= want) return preferred.slice(0, want)
    }
    if (preferred.length > 0) return preferred
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
    const k = JSON.stringify(regions)
    if (seen.has(k)) continue
    if (!solveForLayoutBank(regions, H, W)) continue
    seen.add(k)
    const copy = regions.map((row) => [...row])
    if (guidedSquare && matchesGuidedSmallRegionHistogram(H, W, regions)) preferred.push(copy)
    else other.push(copy)
  }

  const guidedExtra =
    H === 7 ? 6_000 : H === 8 ? 10_000 : H === 9 ? 14_000 : 0
  if (guidedSquare && preferred.length < want) {
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

  const out = [...preferred, ...other]
  return out.slice(0, want)
}

const solMemo = new Map()
function solutionFor(regions) {
  const key = JSON.stringify(regions)
  let sol = solMemo.get(key)
  if (!sol) {
    sol = solveFromRegions(regions)
    if (!sol) return null
    solMemo.set(key, sol)
  }
  return sol.map((row) => [...row])
}

function buildTier(tier) {
  const levels = []
  const { id, title, h, w } = tier
  const givenFraction = givenFractionForTier(id)

  const layoutWant = Math.min(10, POOL_COUNT)
  const layoutMaxTries = id === 'legend-9' ? 4500 : 2200
  const seedSalt = hashSeed(id, 0xf00d_5eed)
  let layoutBank = collectRegionLayouts(id, h, w, layoutWant, layoutMaxTries, seedSalt)
  if (layoutBank.length === 0) {
    layoutBank = collectRegionLayouts(id, h, w, layoutWant, 12_000, seedSalt ^ 0xace0_ace0)
  }
  if (layoutBank.length === 0) {
    throw new Error(`no solvable heterogeneous layouts for ${id}`)
  }

  for (let i = 0; i < POOL_COUNT; i++) {
    const regions = layoutBank[i % layoutBank.length].map((row) => [...row])
    const sol = solutionFor(regions)
    if (!sol) throw new Error(`unsolvable ${id}`)

    const seed = hashSeed(id, i * 7919 + 13)
    const givens = givensFractionRandomSeeded(regions, sol, seed, givenFraction)

    levels.push({
      id: `${id}-${String(i).padStart(3, '0')}`,
      title,
      width: w,
      height: h,
      regions,
      givens,
    })
  }

  return { tierId: id, tierTitle: title, count: levels.length, levels }
}

mkdirSync(outDir, { recursive: true })

for (const tier of TIERS) {
  console.error('building', tier.id, '×', POOL_COUNT, '...')
  const pack = buildTier(tier)
  const path = join(outDir, `${tier.id}.json`)
  writeFileSync(path, JSON.stringify(pack), 'utf8')
  console.error('wrote', path, pack.count)
}

console.error('done')
