#!/usr/bin/env node
/**
 * Kirjoittaa public/words/fi-5.json (solutions + tyhjä allowedExtra) ja ajaa validate-fi-5-json.mjs.
 *
 * Oletuslähde: hugovk/everyfinnishword — kaikkisanat.txt (Kotus Nykysuomen sanalista,
 * lisenssi: CC BY 4.0, ks. https://github.com/hugovk/everyfinnishword ).
 *
 * Ympäristö:
 *   FI_WORDLIST_URL  — URL tekstitiedostoon (yksi sana / rivi)
 *   FI_WORDLIST_PATH — paikallinen tiedosto (ohittaa URL:n)
 *
 * solutions = kaikki kelvolliset 5-kirjaimiset (päivän sana poimitaan näistä).
 * allowedExtra jätetään tyhjäksi; validate-fi-5-json.mjs yhdistää allowed-listan.
 *
 *   node scripts/build-fi-5-full.mjs
 *   node scripts/validate-fi-5-json.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'public', 'words', 'fi-5.json')

const DEFAULT_URL =
  'https://raw.githubusercontent.com/hugovk/everyfinnishword/master/kaikkisanat.txt'

const re = /^[a-zåäö]{5}$/

async function loadText() {
  const local = process.env.FI_WORDLIST_PATH
  if (local) {
    return readFileSync(local, 'utf8')
  }
  const url = process.env.FI_WORDLIST_URL || DEFAULT_URL
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Sanalistan lataus epäonnistui: ${url} (${r.status})`)
  return r.text()
}

function extractFiveLetterWords(text) {
  const words = new Set()
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().toLowerCase().normalize('NFC')
    if (w.length !== 5) continue
    if (!re.test(w)) continue
    words.add(w)
  }
  return [...words].sort((a, b) => a.localeCompare(b, 'fi'))
}

const text = await loadText()
const solutions = extractFiveLetterWords(text)
if (solutions.length < 100)
  throw new Error(`Liian vähän sanoja (${solutions.length}) — tarkista lähde.`)

writeFileSync(
  outPath,
  JSON.stringify({ solutions, allowedExtra: [] }, null, 2),
  'utf8',
)
console.error('wrote', outPath, 'solutions', solutions.length)

execSync('node scripts/validate-fi-5-json.mjs', { cwd: root, stdio: 'inherit' })
console.error('done — public/words/fi-5.json päivitetty')
