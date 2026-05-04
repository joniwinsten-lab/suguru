#!/usr/bin/env node
/**
 * Satunnainen erikokoinen ortoyhtenäinen jako (alue 1…9 solua), sitten ratkaisu.
 * Usage: node scripts/random-solvable.mjs [height] [width]
 * Defaults: 6 6
 */
import { growVariablePartitionAny } from './variable-partition.mjs'
import { solveFromRegions } from './solver-core.mjs'

const H = parseInt(process.argv[2] || '6', 10)
const W = parseInt(process.argv[3] || String(H), 10)

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

for (let t = 0; t < 250000; t++) {
  const rng = mulberry32((t * 0x85ebca6b) >>> 0)
  const regions = growVariablePartitionAny(H, W, rng)
  if (!regions) continue
  const sol = solveFromRegions(regions)
  if (sol) {
    console.log(JSON.stringify({ regions, solution: sol }))
    process.exit(0)
  }
}
console.error('failed', { H, W })
process.exit(1)
