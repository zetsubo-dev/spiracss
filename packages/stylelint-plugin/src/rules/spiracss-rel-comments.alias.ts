import fs from 'fs'
import path from 'path'

import type { AliasRoots } from './spiracss-rel-comments.types'
import { createLruCache, DEFAULT_CACHE_SIZE } from '../utils/cache'

const ALIAS_NAME_PATTERN = '[a-z][a-z0-9-]*'
const aliasTargetRe = new RegExp(
  `^\\s*@(?!rel\\b)(${ALIAS_NAME_PATTERN})\\/([^\\s*]+)`,
  'gm'
)

const parseAliasTarget = (
  target: string
): { key: string; suffix: string } | null => {
  const match = new RegExp(`^@(${ALIAS_NAME_PATTERN})(?:/(.*))?$`).exec(target)
  if (!match) return null
  return { key: match[1], suffix: match[2] ?? '' }
}

/**
 * Returns true when the candidate resolves inside the project root (including symlinks).
 */
const shouldReportAliasError = (): boolean => {
  const debug = process.env.SPIRACSS_DEBUG
  if (!debug) return false
  if (debug === '1') return true
  return debug.split(',').map((entry) => entry.trim()).includes('alias')
}

const reportAliasError = (error: unknown): void => {
  if (!shouldReportAliasError()) return
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[spiracss] Alias resolution failed: ${message}`)
}

type RealpathCacheEntry =
  | { status: 'ok'; value: string }
  | { status: 'error' }

const realpathCache = createLruCache<string, RealpathCacheEntry>(DEFAULT_CACHE_SIZE)

const resolveRealpath = (target: string): string | null => {
  const cached = realpathCache.get(target)
  if (cached) {
    return cached.status === 'ok' ? cached.value : null
  }
  try {
    const resolved = fs.realpathSync(target)
    realpathCache.set(target, { status: 'ok', value: resolved })
    return resolved
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code !== 'ENOENT') {
      reportAliasError(error)
      realpathCache.set(target, { status: 'error' })
    }
    return null
  }
}

const isWithinProjectRoot = (projectRoot: string, candidate: string): boolean => {
  const normalizedRoot = resolveRealpath(projectRoot) ?? path.resolve(projectRoot)
  const absoluteCandidate = path.resolve(candidate)
  const resolvedCandidate = resolveRealpath(absoluteCandidate)
  const normalizedCandidate = resolvedCandidate
    ? resolvedCandidate
    : (() => {
        const parentDir = path.dirname(absoluteCandidate)
        const resolvedParent = resolveRealpath(parentDir) ?? path.resolve(parentDir)
        return path.resolve(resolvedParent, path.basename(absoluteCandidate))
      })()
  const relative = path.relative(normalizedRoot, normalizedCandidate)
  if (!relative) return true
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) return false
  return !path.isAbsolute(relative)
}

export const extractLinkTargets = (text: string | undefined | null): string[] => {
  const targets: string[] = []
  if (!text) return targets

  // @rel/xxx
  const relRe = /^\s*@rel\s*([^\s*]+)/gm
  let m = relRe.exec(text)
  while (m) {
    targets.push(m[1])
    m = relRe.exec(text)
  }

  // @alias/xxx (@assets, @components, etc): alias key is arbitrary (a-z start, alnum + hyphen).
  // Exclude @rel since it is handled by the dedicated pattern above.
  // Only treat "@alias/..." as link targets and ignore non-link comments like @at-root.
  const aliasMatches = text.matchAll(
    new RegExp(aliasTargetRe.source, aliasTargetRe.flags)
  )
  for (const match of aliasMatches) {
    targets.push(`@${match[1]}/${match[2]}`)
  }

  return targets
}

export const normalizeRelPath = (raw: string | undefined | null): string => {
  if (!raw) return ''
  let target = raw.trim()
  target = target.replace(/^['"`]/, '').replace(/['"`]$/, '')
  target = target.replace(/^\/+/, '')
  return target
}

export const resolveAliasCandidates = (
  target: string,
  projectRoot: string,
  aliasRoots: AliasRoots
): string[] => {
  const parsed = parseAliasTarget(target)
  if (!parsed) return []
  const { key, suffix } = parsed
  const bases = Array.isArray(aliasRoots[key]) ? aliasRoots[key] : []
  const normalizedSuffix = suffix.replace(/^\/+/, '')
  return bases.flatMap((base) => {
    // Use absolute base as-is; for relative bases, resolve against projectRoot.
    const resolvedBase = path.isAbsolute(base) ? base : path.resolve(projectRoot, base)
    const candidate = path.resolve(resolvedBase, normalizedSuffix)
    return isWithinProjectRoot(projectRoot, candidate) ? [candidate] : []
  })
}

export const resolvePathCandidates = (
  target: string,
  baseDir: string,
  projectRoot: string,
  aliasRoots: AliasRoots
): string[] => {
  if (!target) return []
  if (target.startsWith('@')) return resolveAliasCandidates(target, projectRoot, aliasRoots)
  const candidate = path.resolve(baseDir, target)
  return isWithinProjectRoot(projectRoot, candidate) ? [candidate] : []
}
