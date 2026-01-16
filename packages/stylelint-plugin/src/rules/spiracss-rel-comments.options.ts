import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeString
} from '../utils/normalize'
import { normalizeCommonOptions, pickCommonDefaults } from '../utils/options'
import type { Options } from './spiracss-rel-comments.types'

const defaultOptions: Options = {
  requireInScssDirectories: true,
  requireWhenMetaLoadCss: true,
  validatePath: true,
  skipFilesWithoutRules: true,
  requireChildRelComments: true,
  requireChildRelCommentsInShared: true,
  requireChildRelCommentsInInteraction: false,
  requireParentRelComment: true,
  childScssDir: 'scss',
  aliasRoots: undefined,
  sharedCommentPattern: /--shared/i,
  interactionCommentPattern: /--interaction/i,
  naming: undefined,
  allowExternalClasses: [],
  allowExternalPrefixes: [],
  cacheSizes: DEFAULT_CACHE_SIZES
}

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as Partial<Options> & {
    sharedCommentPattern?: RegExp | string
    interactionCommentPattern?: RegExp | string
  }
  const common = normalizeCommonOptions(
    raw,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  )
  const fallbackChildScssDir = defaultOptions.childScssDir ?? 'scss'

  return {
    requireInScssDirectories: normalizeBoolean(
      raw.requireInScssDirectories,
      defaultOptions.requireInScssDirectories,
      { coerce: true }
    ),
    requireWhenMetaLoadCss: normalizeBoolean(
      raw.requireWhenMetaLoadCss,
      defaultOptions.requireWhenMetaLoadCss,
      { coerce: true }
    ),
    validatePath: normalizeBoolean(raw.validatePath, defaultOptions.validatePath, {
      coerce: true
    }),
    skipFilesWithoutRules: normalizeBoolean(
      raw.skipFilesWithoutRules,
      defaultOptions.skipFilesWithoutRules,
      { coerce: true }
    ),
    requireChildRelComments: normalizeBoolean(
      raw.requireChildRelComments,
      defaultOptions.requireChildRelComments,
      { coerce: true }
    ),
    requireChildRelCommentsInShared: normalizeBoolean(
      raw.requireChildRelCommentsInShared,
      defaultOptions.requireChildRelCommentsInShared,
      { coerce: true }
    ),
    requireChildRelCommentsInInteraction: normalizeBoolean(
      raw.requireChildRelCommentsInInteraction,
      defaultOptions.requireChildRelCommentsInInteraction,
      { coerce: true }
    ),
    requireParentRelComment: normalizeBoolean(
      raw.requireParentRelComment,
      defaultOptions.requireParentRelComment,
      { coerce: true }
    ),
    childScssDir: normalizeString(raw.childScssDir, fallbackChildScssDir),
    aliasRoots: raw.aliasRoots || defaultOptions.aliasRoots,
    ...common
  }
}
