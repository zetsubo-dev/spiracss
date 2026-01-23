import safeRegex from 'safe-regex'

import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeStringArray
} from '../utils/normalize'
import { normalizeCommonOptions } from '../utils/options'
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
  action: {
    maxWords: 3
  },
  block: {
    source: 'selector',
    warnMissing: true
  },
  shared: {
    prefixes: ['kf-'],
    files: DEFAULT_SHARED_FILE_PATTERNS
  },
  ignore: {
    files: [],
    patterns: [],
    skipPlacement: false
  },
  naming: undefined,
  external: {
    classes: [],
    prefixes: []
  },
  cache: DEFAULT_CACHE_SIZES
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
      'blockSource',
      value,
      '[spiracss] blockSource must be "selector", "file", or "selector-or-file".'
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
  const raw = opt as {
    actionMaxWords?: number
    blockSource?: BlockNameSource
    blockWarnMissing?: boolean
    sharedPrefixes?: string[]
    sharedFiles?: Array<string | RegExp>
    ignoreFiles?: Array<string | RegExp>
    ignorePatterns?: Array<string | RegExp>
    ignoreSkipPlacement?: boolean
    naming?: Options['naming']
    external?: Options['external']
    cache?: CacheSizes
  }
  const common = normalizeCommonOptions(
    raw,
    {
      naming: defaultOptions.naming,
      external: defaultOptions.external,
      cache: defaultOptions.cache
    },
    reportInvalid
  )
  return {
    action: {
      maxWords: normalizeActionMaxWords(
        raw.actionMaxWords,
        defaultOptions.action.maxWords,
        reportInvalid
      )
    },
    block: {
      source: normalizeBlockNameSource(
        raw.blockSource,
        defaultOptions.block.source,
        reportInvalid
      ),
      warnMissing: normalizeBoolean(
        raw.blockWarnMissing,
        defaultOptions.block.warnMissing,
        { coerce: true }
      )
    },
    shared: {
      prefixes: normalizeSharedPrefixes(
        raw.sharedPrefixes,
        defaultOptions.shared.prefixes
      ),
      files: normalizeFilePatterns(
        raw.sharedFiles,
        DEFAULT_SHARED_FILES,
        reportInvalid,
        'sharedFiles'
      )
    },
    ignore: {
      files: normalizeFilePatterns(
        raw.ignoreFiles,
        undefined,
        reportInvalid,
        'ignoreFiles'
      ),
      patterns: normalizePatternList(
        raw.ignorePatterns,
        reportInvalid,
        'ignorePatterns'
      ),
      skipPlacement: normalizeBoolean(
        raw.ignoreSkipPlacement,
        defaultOptions.ignore.skipPlacement,
        { coerce: true }
      )
    },
    ...common
  }
}
