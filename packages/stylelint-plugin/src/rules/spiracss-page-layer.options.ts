import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeKeyList,
  normalizeString
} from '../utils/normalize'
import { normalizeCommonOptions } from '../utils/options'
import { isAliasRoots } from '../utils/validate'
import type { Options } from './spiracss-page-layer.types'

const defaultOptions: Options = {
  pageEntry: {
    alias: 'assets',
    subdir: 'css'
  },
  paths: {
    components: ['components'],
    aliases: undefined
  },
  naming: undefined,
  external: {
    classes: [],
    prefixes: []
  },
  cache: DEFAULT_CACHE_SIZES
}

const normalizePageEntrySubdir = (value: unknown, fallback: string): string => {
  if (value === '') return ''
  return normalizeString(value, fallback)
}

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as {
    pageEntryAlias?: string
    pageEntrySubdir?: string
    componentsDirs?: string[]
    aliasRoots?: Options['paths']['aliases']
    cache?: CacheSizes
    naming?: Options['naming']
    external?: Options['external']
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
  const normalizeAliases = (value: unknown): Options['paths']['aliases'] => {
    if (value === undefined) return defaultOptions.paths.aliases
    if (isAliasRoots(value)) return value
    reportInvalid?.(
      'aliasRoots',
      value,
      '[spiracss] aliasRoots must be an object whose values are string arrays.'
    )
    return defaultOptions.paths.aliases
  }

  return {
    pageEntry: {
      alias: normalizeString(raw.pageEntryAlias, defaultOptions.pageEntry.alias),
      subdir: normalizePageEntrySubdir(
        raw.pageEntrySubdir,
        defaultOptions.pageEntry.subdir
      )
    },
    paths: {
      components: normalizeKeyList(
        raw.componentsDirs,
        defaultOptions.paths.components,
        'componentsDirs',
        reportInvalid
      ),
      aliases: normalizeAliases(raw.aliasRoots)
    },
    ...common
  }
}
