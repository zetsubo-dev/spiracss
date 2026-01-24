import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeString
} from '../utils/normalize'
import { normalizeCommonOptions, pickCommonDefaults } from '../utils/options'
import { isAliasRoots } from '../utils/validate'
import type { Options } from './spiracss-rel-comments.types'

const isWordCase = (value: unknown): value is Exclude<Options['fileCase'], 'preserve'> =>
  value === 'kebab' || value === 'snake' || value === 'camel' || value === 'pascal'

const normalizeFileCase = (
  value: unknown,
  fallback: Options['fileCase'],
  reportInvalid?: InvalidOptionReporter
): Options['fileCase'] => {
  if (value === 'preserve') return value
  if (isWordCase(value)) return value
  if (value !== undefined) {
    reportInvalid?.(
      'fileCase',
      value,
      '[spiracss] fileCase must be "preserve" | "kebab" | "snake" | "camel" | "pascal".'
    )
  }
  return fallback
}

const defaultOptions: Options = {
  require: {
    scss: true,
    meta: true,
    parent: true,
    child: {
      enabled: true,
      shared: true,
      interaction: false
    }
  },
  fileCase: 'preserve',
  validate: {
    path: true
  },
  skip: {
    noRules: true
  },
  paths: {
    childDir: 'scss',
    aliases: undefined
  },
  comments: {
    shared: /--shared/i,
    interaction: /--interaction/i
  },
  naming: undefined,
  external: {
    classes: [],
    prefixes: []
  },
  cache: DEFAULT_CACHE_SIZES
}

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as {
    requireScss?: boolean
    requireMeta?: boolean
    requireParent?: boolean
    requireChild?: boolean
    requireChildShared?: boolean
    requireChildInteraction?: boolean
    validatePath?: boolean
    skipNoRules?: boolean
    childDir?: string
    aliasRoots?: Options['paths']['aliases']
    fileCase?: Options['fileCase']
    comments?: { shared?: RegExp | string; interaction?: RegExp | string }
    cache?: CacheSizes
    naming?: Options['naming']
    external?: Options['external']
  }
  const common = normalizeCommonOptions(
    raw,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  )
  const fallbackChildDir = defaultOptions.paths.childDir ?? 'scss'
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
    require: {
      scss: normalizeBoolean(
        raw.requireScss,
        defaultOptions.require.scss,
        { coerce: true }
      ),
      meta: normalizeBoolean(
        raw.requireMeta,
        defaultOptions.require.meta,
        { coerce: true }
      ),
      parent: normalizeBoolean(
        raw.requireParent,
        defaultOptions.require.parent,
        { coerce: true }
      ),
      child: {
        enabled: normalizeBoolean(
          raw.requireChild,
          defaultOptions.require.child.enabled,
          { coerce: true }
        ),
        shared: normalizeBoolean(
          raw.requireChildShared,
          defaultOptions.require.child.shared,
          { coerce: true }
        ),
        interaction: normalizeBoolean(
          raw.requireChildInteraction,
          defaultOptions.require.child.interaction,
          { coerce: true }
        )
      }
    },
    fileCase: normalizeFileCase(raw.fileCase, defaultOptions.fileCase, reportInvalid),
    validate: {
      path: normalizeBoolean(
        raw.validatePath,
        defaultOptions.validate.path,
        { coerce: true }
      )
    },
    skip: {
      noRules: normalizeBoolean(
        raw.skipNoRules,
        defaultOptions.skip.noRules,
        { coerce: true }
      )
    },
    paths: {
      childDir: normalizeString(raw.childDir, fallbackChildDir),
      aliases: normalizeAliases(raw.aliasRoots)
    },
    ...common
  }
}
