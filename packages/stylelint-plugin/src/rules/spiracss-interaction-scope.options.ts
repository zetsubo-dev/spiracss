import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES, normalizeCacheSizes } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeCommentPattern,
  normalizeSelectorPolicyBase,
  normalizeStringArray
} from '../utils/normalize'
import type {
  NormalizedSelectorPolicy,
  Options,
  SelectorPolicy
} from './spiracss-interaction-scope.types'

const defaultSelectorPolicy: NormalizedSelectorPolicy = {
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
  allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
  requireAtRoot: true,
  requireComment: true,
  requireTail: true,
  enforceWithCommentOnly: false,
  interactionCommentPattern: /--interaction/i,
  selectorPolicy: defaultSelectorPolicy,
  cacheSizes: DEFAULT_CACHE_SIZES
}

const normalizeSelectorPolicy = (
  raw: unknown,
  reportInvalid?: InvalidOptionReporter
): NormalizedSelectorPolicy => {
  return normalizeSelectorPolicyBase(raw, defaultSelectorPolicy, reportInvalid)
}

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as Partial<Options> & {
    interactionCommentPattern?: RegExp | string
    cacheSizes?: CacheSizes
  }
  const safeNormalizeSelectorPolicy = (value: unknown): NormalizedSelectorPolicy => {
    try {
      return normalizeSelectorPolicy(value, reportInvalid)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      reportInvalid?.('selectorPolicy', value, detail)
      return { ...defaultOptions.selectorPolicy }
    }
  }

  return {
    allowedPseudos: normalizeStringArray(raw.allowedPseudos, defaultOptions.allowedPseudos),
    requireAtRoot: normalizeBoolean(raw.requireAtRoot, defaultOptions.requireAtRoot, {
      coerce: true
    }),
    requireComment: normalizeBoolean(raw.requireComment, defaultOptions.requireComment, {
      coerce: true
    }),
    requireTail: normalizeBoolean(raw.requireTail, defaultOptions.requireTail, { coerce: true }),
    enforceWithCommentOnly: normalizeBoolean(
      raw.enforceWithCommentOnly,
      defaultOptions.enforceWithCommentOnly,
      { coerce: true }
    ),
    interactionCommentPattern: normalizeCommentPattern(
      raw.interactionCommentPattern,
      defaultOptions.interactionCommentPattern,
      'interactionCommentPattern',
      reportInvalid
    ),
    selectorPolicy: safeNormalizeSelectorPolicy(
      (raw as { selectorPolicy?: SelectorPolicy }).selectorPolicy
    ),
    cacheSizes: normalizeCacheSizes(raw.cacheSizes, reportInvalid)
  }
}
