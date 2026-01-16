import type { CacheSizes, NormalizedSelectorPolicyBase } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  safeNormalizeSelectorPolicyBase,
  normalizeStringArray
} from '../utils/normalize'
import { normalizeCommonOptions, pickCommonDefaults } from '../utils/options'
import { createDefaultSelectorPolicyBase } from '../utils/selector-policy'
import type { Options } from './spiracss-property-placement.types'

const defaultSelectorPolicy: NormalizedSelectorPolicyBase = createDefaultSelectorPolicyBase()

const defaultOptions: Options = {
  // SpiraCSS recommends up to ~4 levels, so default to 4.
  allowElementChainDepth: 4,
  allowExternalClasses: [],
  allowExternalPrefixes: [],
  marginSide: 'top',
  enablePosition: true,
  enableSizeInternal: true,
  responsiveMixins: [],
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
  const common = normalizeCommonOptions(
    opt,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  )

  const normalizeMarginSide = (value: unknown): Options['marginSide'] => {
    const lowered = typeof value === 'string' ? value.toLowerCase() : ''
    if (lowered === 'top' || lowered === 'bottom') return lowered
    if (value !== undefined) {
      reportInvalid?.('marginSide', value, 'Expected "top" or "bottom".')
    }
    return defaultOptions.marginSide
  }

  return {
    allowElementChainDepth:
      typeof opt.allowElementChainDepth === 'number'
        ? opt.allowElementChainDepth
        : defaultOptions.allowElementChainDepth,
    marginSide: normalizeMarginSide(opt.marginSide),
    enablePosition:
      typeof opt.enablePosition === 'boolean'
        ? opt.enablePosition
        : defaultOptions.enablePosition,
    enableSizeInternal:
      typeof opt.enableSizeInternal === 'boolean'
        ? opt.enableSizeInternal
        : defaultOptions.enableSizeInternal,
    responsiveMixins: normalizeStringArray(
      opt.responsiveMixins,
      defaultOptions.responsiveMixins
    ),
    selectorPolicy: safeNormalizeSelectorPolicyBase(
      opt.selectorPolicy,
      defaultSelectorPolicy,
      reportInvalid
    ),
    ...common
  }
}
