import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const esmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm')

const ensureEsmPackageJson = () => {
  fs.mkdirSync(esmDir, { recursive: true })
  const packageJsonPath = path.join(esmDir, 'package.json')
  const content = `${JSON.stringify({ type: 'module' }, null, 2)}\n`
  fs.writeFileSync(packageJsonPath, content)
}

const shouldAddExtension = (specifier) => {
  if (!specifier.startsWith('.')) return false
  if (specifier.endsWith('.js')) return false
  if (specifier.endsWith('.mjs')) return false
  if (specifier.endsWith('.cjs')) return false
  if (specifier.endsWith('.json')) return false
  if (specifier.endsWith('.node')) return false
  return true
}

const rewriteSpecifiers = (source) => {
  const replaceSpecifier = (match, prefix, specifier, suffix) => {
    if (!shouldAddExtension(specifier)) return match
    return `${prefix}${specifier}.js${suffix}`
  }

  return source
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, replaceSpecifier)
    .replace(/(import\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, replaceSpecifier)
    .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g, replaceSpecifier)
}

const updateFile = (filePath) => {
  const original = fs.readFileSync(filePath, 'utf8')
  const updated = rewriteSpecifiers(original)
  if (updated !== original) {
    fs.writeFileSync(filePath, updated)
  }
}

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      updateFile(fullPath)
    }
  }
}

ensureEsmPackageJson()
walk(esmDir)
