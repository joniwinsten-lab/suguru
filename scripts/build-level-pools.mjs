#!/usr/bin/env node
/**
 * Generoi public/pools/{tierId}.json — useita satunnaisia ratkaistavia kenttiä / vaikeustaso.
 * POOL_COUNT oletus 3 kenttää / vaikeustaso (vaihda esim. POOL_COUNT=20).
 *
 * Alueet: yhtenäiset, koko 1…9 solua, ei tasasuuruista jakoa (vähintään kaksi eri kokoa).
 * Vihjeet: pyöristetty 25 % ruudukon soluista, satunnaisesti jaoteltu; arvot oikeasta ratkaisusta.
 *
 *   node scripts/build-level-pools.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { solveFromRegions } from './solver-core.mjs'
import { growVariablePartitionAny } from './variable-partition.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'pools')

const POOL_COUNT = parseInt(process.env.POOL_COUNT || '3', 10)
const GIVEN_CELL_FRACTION = 0.25

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
function givensFractionRandomSeeded(regions, sol, seed) {
  const H = regions.length
  const W = regions[0].length
  const total = H * W
  const rng = mulberry32(seed >>> 0)
  const k = Math.min(total, Math.max(1, Math.round(total * GIVEN_CELL_FRACTION)))
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
function collectRegionLayouts(H, W, want, maxTries, seedSalt) {
  const seen = new Set()
  const out = []
  for (let t = 0; t < maxTries && out.length < want; t++) {
    const rng = mulberry32((seedSalt ^ (t * 0x9e3779b1)) >>> 0)
    const regions = growVariablePartitionAny(H, W, rng)
    if (!regions) continue
    const k = JSON.stringify(regions)
    if (seen.has(k)) continue
    if (!solveForLayoutBank(regions, H, W)) continue
    seen.add(k)
    out.push(regions.map((row) => [...row]))
  }
  return out
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

  const layoutWant = Math.min(10, POOL_COUNT)
  const layoutMaxTries = id === 'legend-9' ? 4500 : 2200
  const seedSalt = hashSeed(id, 0xf00d_5eed)
  let layoutBank = collectRegionLayouts(h, w, layoutWant, layoutMaxTries, seedSalt)
  if (layoutBank.length === 0) {
    layoutBank = collectRegionLayouts(h, w, layoutWant, 12_000, seedSalt ^ 0xace0_ace0)
  }
  if (layoutBank.length === 0) {
    throw new Error(`no solvable heterogeneous layouts for ${id}`)
  }

  for (let i = 0; i < POOL_COUNT; i++) {
    const regions = layoutBank[i % layoutBank.length].map((row) => [...row])
    const sol = solutionFor(regions)
    if (!sol) throw new Error(`unsolvable ${id}`)

    const seed = hashSeed(id, i * 7919 + 13)
    const givens = givensFractionRandomSeeded(regions, sol, seed)

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
