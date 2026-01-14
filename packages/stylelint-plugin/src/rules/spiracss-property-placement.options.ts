import type { CacheSizes, NormalizedSelectorPolicyBase } from '../types'
import { DEFAULT_CACHE_SIZES, normalizeCacheSizes } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeCommentPattern,
  normalizeSelectorPolicyBase,
  normalizeStringArray
} from '../utils/normalize'
import type { Options } from './spiracss-property-placement.types'

const defaultSelectorPolicy: NormalizedSelectorPolicyBase = {
  variant: {
    mode: 'data',
    dataKeys: ['data-variant']
  },
  state: {
    mode: 'data',
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
  }
}

const defaultOptions: Options = {
  allowElementChainDepth: 4,
  allowExternalClasses: [],
  allowExternalPrefixes: [],
  naming: undefined,
  selectorPolicy: defaultSelectorPolicy,
  sharedCommentPattern: /--shared/i,
  interactionCommentPattern: /--interaction/i,
  cacheSizes: DEFAULT_CACHE_SIZES
}

export const normalizeOptions = (
  raw: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!raw || typeof raw !== 'object') return { ...defaultOptions }
  const opt = raw as Partial<Options> & {
    sharedCommentPattern?: RegExp | string
    interactionCommentPattern?: RegExp | string
    cacheSizes?: CacheSizes
  }

  const safeNormalizeSelectorPolicy = (
    value: unknown
  ): NormalizedSelectorPolicyBase => {
    try {
      return normalizeSelectorPolicyBase(value, defaultSelectorPolicy, reportInvalid)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      reportInvalid?.('selectorPolicy', value, detail)
      return { ...defaultOptions.selectorPolicy }
    }
  }

  return {
    allowElementChainDepth:
      typeof opt.allowElementChainDepth === 'number'
        ? opt.allowElementChainDepth
        : defaultOptions.allowElementChainDepth,
    allowExternalClasses: normalizeStringArray(
      opt.allowExternalClasses,
      defaultOptions.allowExternalClasses
    ),
    allowExternalPrefixes: normalizeStringArray(
      opt.allowExternalPrefixes,
      defaultOptions.allowExternalPrefixes
    ),
    naming: opt.naming ?? defaultOptions.naming,
    selectorPolicy: safeNormalizeSelectorPolicy(opt.selectorPolicy),
    sharedCommentPattern: normalizeCommentPattern(
      opt.sharedCommentPattern,
      defaultOptions.sharedCommentPattern,
      'sharedCommentPattern',
      reportInvalid
    ),
    interactionCommentPattern: normalizeCommentPattern(
      opt.interactionCommentPattern,
      defaultOptions.interactionCommentPattern,
      'interactionCommentPattern',
      reportInvalid
    ),
    cacheSizes: normalizeCacheSizes(opt.cacheSizes, reportInvalid)
  }
}
