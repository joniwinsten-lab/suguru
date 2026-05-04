#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const path = join(root, 'public', 'words', 'fi-5.json')

const raw = JSON.parse(readFileSync(path, 'utf8'))
const re = /^[a-zåäö]{5}$/

function clean(arr) {
  const out = []
  const seen = new Set()
  for (const w of arr) {
    const x = String(w).toLowerCase().normalize('NFC')
    if (!re.test(x)) {
      console.error('drop invalid length/chars:', w)
      continue
    }
    if (seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}

const solutions = clean(raw.solutions || [])
const extra = clean(raw.allowedExtra || [])
const allowed = clean([...solutions, ...extra])

writeFileSync(
  path,
  JSON.stringify({ solutions, allowed }, null, 0),
  'utf8',
)
console.error('solutions', solutions.length, 'allowed', allowed.length)
