#!/usr/bin/env node
/**
 * stdin: { height, width, regions: number[][] }
 * stdout: { solution: number[][] }
 */
import { readFileSync } from 'node:fs'
import { solveFromRegions } from './solver-core.mjs'

const input = JSON.parse(readFileSync(0, 'utf8'))
const { regions } = input
const sol = solveFromRegions(regions)
if (!sol) {
  console.error('No solution')
  process.exit(1)
}
console.log(JSON.stringify({ solution: sol }))
