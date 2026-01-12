import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES, normalizeCacheSizes } from '../utils/cache'
import { type InvalidOptionReporter, normalizeCommentPattern, normalizeStringArray } from '../utils/normalize'
import type { Options } from './spiracss-interaction-properties.types'

const defaultOptions: Options = {
  sharedCommentPattern: /--shared/i,
  interactionCommentPattern: /--interaction/i,
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
    cacheSizes?: CacheSizes
  }
  return {
    sharedCommentPattern: normalizeCommentPattern(
      raw.sharedCommentPattern,
      defaultOptions.sharedCommentPattern,
      'sharedCommentPattern',
      reportInvalid
    ),
    interactionCommentPattern: normalizeCommentPattern(
      raw.interactionCommentPattern,
      defaultOptions.interactionCommentPattern,
      'interactionCommentPattern',
      reportInvalid
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
