import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import { type InvalidOptionReporter } from '../utils/normalize'
import { normalizeCommonOptions, pickCommonDefaults } from '../utils/options'
import type { Options } from './spiracss-interaction-properties.types'

const defaultOptions: Options = {
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
    cacheSizes?: CacheSizes
  }
  return normalizeCommonOptions(
    raw,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  ) as Options
}
