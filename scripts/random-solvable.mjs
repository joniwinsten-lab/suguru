#!/usr/bin/env node
/**
 * Random orth-connected partition into k equal-sized regions, then solve.
 * Usage: node scripts/random-solvable.mjs [height] [width] [k]
 * Defaults: 6 6 6
 */
import { spawnSync } from 'node:child_process'

const rnd = (n) => (Math.random() * n) | 0

const orth = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function key(r, c) {
  return `${r},${c}`
}

function growPartition(H, W, k) {
  const total = H * W
  if (total % k !== 0) return null
  const sz = total / k
  const grid = Array.from({ length: H }, () => Array(W).fill(-1))
  const unassigned = new Map()
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      unassigned.set(key(r, c), [r, c])
    }
  }

  for (let rid = 0; rid < k; rid++) {
    const need = rid === k - 1 ? unassigned.size : sz
    if (need <= 0) return null
    const start = [...unassigned.values()][rnd(unassigned.size)]
    unassigned.delete(key(start[0], start[1]))
    const comp = [start]
    while (comp.length < need && unassigned.size) {
      const border = []
      for (const [r, c] of comp) {
        for (const [dr, dc] of orth) {
          const nr = r + dr,
            nc = c + dc
          const k2 = key(nr, nc)
          if (unassigned.has(k2)) border.push(unassigned.get(k2))
        }
      }
      if (!border.length) break
      const pick = border[rnd(border.length)]
      unassigned.delete(key(pick[0], pick[1]))
      comp.push(pick)
    }
    if (comp.length !== need) return null
    for (const [r, c] of comp) grid[r][c] = rid
  }

  if (unassigned.size) return null
  return grid
}

function solve(regions) {
  const H = regions.length
  const W = regions[0].length
  const payload = JSON.stringify({ height: H, width: W, regions })
  const r = spawnSync('node', ['scripts/solve-layout.mjs'], {
    input: payload,
    encoding: 'utf8',
  })
  if (r.status !== 0) return null
  return JSON.parse(r.stdout).solution
}

const H = parseInt(process.argv[2] || '6', 10)
const W = parseInt(process.argv[3] || String(H), 10)
const k = parseInt(process.argv[4] || String(H), 10)

for (let t = 0; t < 25000; t++) {
  const regions = growPartition(H, W, k)
  if (!regions) continue
  const sol = solve(regions)
  if (sol) {
    console.log(JSON.stringify({ regions, solution: sol }))
    process.exit(0)
  }
}
console.error('failed', { H, W, k })
process.exit(1)
