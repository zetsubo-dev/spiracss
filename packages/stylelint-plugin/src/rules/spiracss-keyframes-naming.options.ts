import safeRegex from 'safe-regex'

import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES, normalizeCacheSizes } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeStringArray
} from '../utils/normalize'
import type { BlockNameSource, Options } from './spiracss-keyframes-naming.types'

const DEFAULT_SHARED_FILES = ['keyframes.scss']

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toSuffixPattern = (text: string): RegExp => {
  const normalized = text.replace(/\\/g, '/')
  const escaped = escapeRegExp(normalized).replace(/\//g, '[\\\\/]')
  return new RegExp(`${escaped}$`)
}

const DEFAULT_SHARED_FILE_PATTERNS = DEFAULT_SHARED_FILES.map((file) =>
  toSuffixPattern(file)
)

const defaultOptions: Options = {
  actionMaxWords: 3,
  blockNameSource: 'selector',
  warnOnMissingBlock: true,
  sharedPrefixes: ['kf-'],
  sharedFiles: DEFAULT_SHARED_FILE_PATTERNS,
  ignoreFiles: [],
  ignorePatterns: [],
  ignorePlacementForIgnored: false,
  allowExternalClasses: [],
  allowExternalPrefixes: [],
  cacheSizes: DEFAULT_CACHE_SIZES
}

const normalizeActionMaxWords = (
  value: unknown,
  fallback: number,
  reportInvalid?: InvalidOptionReporter
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const intValue = Math.trunc(value)
  if (intValue < 1 || intValue > 3) {
    reportInvalid?.('actionMaxWords', value, '[spiracss] actionMaxWords must be 1-3.')
    return fallback
  }
  return intValue
}

const normalizeBlockNameSource = (
  value: unknown,
  fallback: BlockNameSource,
  reportInvalid?: InvalidOptionReporter
): BlockNameSource => {
  if (value === 'selector' || value === 'file' || value === 'selector-or-file') return value
  if (value !== undefined) {
    reportInvalid?.(
      'blockNameSource',
      value,
      '[spiracss] blockNameSource must be "selector", "file", or "selector-or-file".'
    )
  }
  return fallback
}

const normalizePatternList = (
  value: unknown,
  reportInvalid?: InvalidOptionReporter,
  optionName = 'ignorePatterns'
): RegExp[] => {
  if (!Array.isArray(value)) return []
  const patterns: RegExp[] = []
  value.forEach((item) => {
    if (item instanceof RegExp) {
      if (!safeRegex(item)) {
        reportInvalid?.(optionName, item, '[spiracss] Unsafe RegExp detected.')
        return
      }
      patterns.push(item)
      return
    }
    if (typeof item === 'string' && item.trim()) {
      try {
        const regex = new RegExp(item)
        if (!safeRegex(regex)) {
          reportInvalid?.(optionName, item, '[spiracss] Unsafe RegExp detected.')
          return
        }
        patterns.push(regex)
      } catch {
        reportInvalid?.(optionName, item, '[spiracss] Invalid RegExp string.')
      }
    } else if (item !== undefined) {
      reportInvalid?.(optionName, item, '[spiracss] Expected RegExp or string.')
    }
  })
  return patterns
}

const normalizeFilePatterns = (
  value: unknown,
  fallback: string[] | undefined,
  reportInvalid?: InvalidOptionReporter,
  optionName = 'sharedFiles'
): RegExp[] => {
  if (value === undefined && fallback) {
    return fallback.map((file) => toSuffixPattern(file))
  }
  if (!Array.isArray(value)) return []
  const patterns: RegExp[] = []
  value.forEach((item) => {
    if (item instanceof RegExp) {
      if (!safeRegex(item)) {
        reportInvalid?.(optionName, item, '[spiracss] Unsafe RegExp detected.')
        return
      }
      patterns.push(item)
      return
    }
    if (typeof item === 'string' && item.trim()) {
      patterns.push(toSuffixPattern(item))
      return
    }
    if (item !== undefined) {
      reportInvalid?.(optionName, item, '[spiracss] Expected string or RegExp.')
    }
  })
  return patterns
}

const normalizeSharedPrefixes = (
  value: unknown,
  fallback: string[]
): string[] => normalizeStringArray(value, fallback)

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as Partial<Options> & {
    cacheSizes?: CacheSizes
  }
  return {
    actionMaxWords: normalizeActionMaxWords(
      raw.actionMaxWords,
      defaultOptions.actionMaxWords,
      reportInvalid
    ),
    blockNameSource: normalizeBlockNameSource(
      raw.blockNameSource,
      defaultOptions.blockNameSource,
      reportInvalid
    ),
    warnOnMissingBlock: normalizeBoolean(
      raw.warnOnMissingBlock,
      defaultOptions.warnOnMissingBlock,
      { coerce: true }
    ),
    sharedPrefixes: normalizeSharedPrefixes(raw.sharedPrefixes, defaultOptions.sharedPrefixes),
    sharedFiles: normalizeFilePatterns(raw.sharedFiles, DEFAULT_SHARED_FILES, reportInvalid),
    ignoreFiles: normalizeFilePatterns(raw.ignoreFiles, undefined, reportInvalid, 'ignoreFiles'),
    ignorePatterns: normalizePatternList(raw.ignorePatterns, reportInvalid, 'ignorePatterns'),
    ignorePlacementForIgnored: normalizeBoolean(
      raw.ignorePlacementForIgnored,
      defaultOptions.ignorePlacementForIgnored,
      { coerce: true }
    ),
    naming: raw.naming,
    allowExternalClasses: normalizeStringArray(
      raw.allowExternalClasses,
      defaultOptions.allowExternalClasses
    ),
    allowExternalPrefixes: normalizeStringArray(
      raw.allowExternalPrefixes,
      defaultOptions.allowExternalPrefixes
    ),
    cacheSizes: normalizeCacheSizes(raw.cacheSizes, reportInvalid)
  }
}
