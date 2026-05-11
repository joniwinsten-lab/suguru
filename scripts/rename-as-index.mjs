import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dir = path.join(root, 'dist-as')
const from = path.join(dir, 'index-as.html')
const to = path.join(dir, 'index.html')

if (!fs.existsSync(from)) {
  console.error('rename-as-index: missing', from)
  process.exit(1)
}
fs.renameSync(from, to)
console.log('rename-as-index: dist-as/index.html OK')
