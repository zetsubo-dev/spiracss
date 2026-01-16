import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  safeNormalizeSelectorPolicyBase,
  normalizeStringArray
} from '../utils/normalize'
import { normalizeCommonOptions, pickCommonDefaults } from '../utils/options'
import { createDefaultSelectorPolicyBase } from '../utils/selector-policy'
import type {
  NormalizedSelectorPolicy,
  Options,
  SelectorPolicy
} from './spiracss-interaction-scope.types'

const defaultSelectorPolicy: NormalizedSelectorPolicy = createDefaultSelectorPolicyBase()

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

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as Partial<Options> & {
    interactionCommentPattern?: RegExp | string
    cacheSizes?: CacheSizes
  }
  const common = normalizeCommonOptions(
    raw,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  )

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
    selectorPolicy: safeNormalizeSelectorPolicyBase(
      (raw as { selectorPolicy?: SelectorPolicy }).selectorPolicy,
      defaultSelectorPolicy,
      reportInvalid
    ),
    ...common
  }
}
