import type { NamingOptions, WordCase } from '../types'
import { createSharedCacheAccessor,DEFAULT_CACHE_SIZE } from './cache'
import type { InvalidOptionReporter } from './normalize'

export const normalizeBlockMaxWords = (value: unknown): number => {
  const normalized =
    typeof value === 'number' && Number.isInteger(value) ? value : 2
  if (normalized < 2) return 2
  if (normalized > 100) return 100
  return normalized
}

const serializePattern = (pattern: RegExp | undefined): string =>
  pattern ? `${pattern.source}/${pattern.flags}` : ''

export const normalizeCustomPattern = (
  value: unknown,
  label: string,
  reportInvalid?: InvalidOptionReporter
): RegExp | undefined => {
  if (value === undefined || value === null) return undefined
  if (value instanceof RegExp) {
    if (value.flags.includes('g') || value.flags.includes('y')) {
      reportInvalid?.(
        label,
        value,
        'RegExp flags "g" and "y" are not allowed for customPatterns.'
      )
      return undefined
    }
    return value
  }
  reportInvalid?.(label, value, `[spiracss] ${label} must be a RegExp.`)
  return undefined
}

const getBlockPatternCache = createSharedCacheAccessor<string, RegExp>()

/**
 * Builds a RegExp for Block naming with caching.
 */
export const buildBlockPattern = (
  naming?: NamingOptions,
  cacheSize = DEFAULT_CACHE_SIZE,
  reportInvalid?: InvalidOptionReporter,
  options?: { customBlock?: RegExp; skipCustomPatternValidation?: boolean }
): RegExp => {
  const blockCase: WordCase = naming?.blockCase || 'kebab'
  const blockMaxWords = normalizeBlockMaxWords(naming?.blockMaxWords)
  const customBlock = options?.skipCustomPatternValidation
    ? options.customBlock
    : normalizeCustomPattern(
        naming?.customPatterns?.block,
        'naming.customPatterns.block',
        reportInvalid
      )
  if (customBlock) return customBlock

  const blockPatternCache = getBlockPatternCache(cacheSize)
  const cacheKey = `${blockCase}:${blockMaxWords}:${serializePattern(customBlock)}`
  const cached = blockPatternCache.get(cacheKey)
  if (cached) return cached

  const blockSegments = Math.max(1, blockMaxWords - 1)
  const blockRange = `{1,${blockSegments}}`

  let pattern: RegExp
  switch (blockCase) {
    case 'kebab':
      pattern = new RegExp(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)${blockRange}$`)
      break
    case 'snake':
      pattern = new RegExp(`^[a-z][a-z0-9]*(?:_[a-z0-9]+)${blockRange}$`)
      break
    case 'camel':
      pattern = new RegExp(`^[a-z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*)${blockRange}$`)
      break
    case 'pascal':
      pattern = new RegExp(`^[A-Z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*)${blockRange}$`)
      break
    default:
      pattern = new RegExp(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)${blockRange}$`)
      break
  }

  blockPatternCache.set(cacheKey, pattern)
  return pattern
}
