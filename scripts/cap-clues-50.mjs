#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { countSolutionsFromPuzzle, solveNoGuessFromPuzzle } from './solver-core.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const poolsDir = join(root, 'public', 'pools')

const TIER_IDS = ['beginner-4a', 'easy-6', 'hard-7', 'pro-8', 'legend-9']

function cloneGrid(grid) {
  return grid.map((row) => [...row])
}

function listGivenCells(givens) {
  const out = []
  for (let r = 0; r < givens.length; r++) {
    for (let c = 0; c < givens[0].length; c++) {
      if (givens[r][c] != null) out.push([r, c])
    }
  }
  return out
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

function canKeepPuzzle(regions, givens) {
  const noGuess = solveNoGuessFromPuzzle(regions, givens)
  if (!noGuess) return false
  const count = countSolutionsFromPuzzle(regions, givens, {
    maxSolutions: 2,
    maxNodes: 4_000_000,
  })
  return count === 1
}

function capLevelGivens(level, ratioCap) {
  const total = level.width * level.height
  const capCount = Math.max(1, Math.floor(total * ratioCap))
  let givens = cloneGrid(level.givens)
  let cells = listGivenCells(givens)
  if (cells.length <= capCount) return givens

  const rng = mulberry32(total * 7919 + cells.length * 104729)
  while (cells.length > capCount) {
    let removed = false
    const candidates = [...cells]
    shuffleInPlace(candidates, rng)
    for (const [r, c] of candidates) {
      const next = cloneGrid(givens)
      next[r][c] = null
      if (!canKeepPuzzle(level.regions, next)) continue
      givens = next
      cells = listGivenCells(givens)
      removed = true
      break
    }
    if (!removed) {
      throw new Error(`Unable to reduce clues to <=50% for ${level.id}`)
    }
  }
  return givens
}

for (const tierId of TIER_IDS) {
  const path = join(poolsDir, `${tierId}.json`)
  const pack = JSON.parse(readFileSync(path, 'utf8'))
  for (const level of pack.levels) {
    level.givens = capLevelGivens(level, 0.5)
  }
  writeFileSync(path, JSON.stringify(pack), 'utf8')
  console.error(`capped clues: ${tierId}`)
}

console.error('done')
