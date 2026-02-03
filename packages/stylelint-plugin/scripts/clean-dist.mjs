import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true })
}
