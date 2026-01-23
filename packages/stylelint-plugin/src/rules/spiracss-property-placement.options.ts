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
  element: {
    // SpiraCSS recommends up to ~4 levels, so default to 4.
    depth: 4
  },
  external: {
    classes: [],
    prefixes: []
  },
  margin: {
    side: 'top'
  },
  position: true,
  size: {
    internal: true
  },
  responsive: {
    mixins: []
  },
  naming: undefined,
  selectorPolicy: defaultSelectorPolicy,
  comments: {
    shared: /--shared/i,
    interaction: /--interaction/i
  },
  cache: DEFAULT_CACHE_SIZES
}

export const normalizeOptions = (
  raw: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!raw || typeof raw !== 'object') return { ...defaultOptions }
  const opt = raw as {
    elementDepth?: number
    marginSide?: Options['margin']['side']
    position?: boolean
    sizeInternal?: boolean
    responsiveMixins?: string[]
    comments?: { shared?: RegExp | string; interaction?: RegExp | string }
    cache?: CacheSizes
    naming?: Options['naming']
    external?: Options['external']
    selectorPolicy?: Options['selectorPolicy']
  }
  const selectorPolicy = opt.selectorPolicy
  const common = normalizeCommonOptions(
    opt,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  )

  const normalizeMarginSide = (value: unknown): Options['margin']['side'] => {
    const lowered = typeof value === 'string' ? value.toLowerCase() : ''
    if (lowered === 'top' || lowered === 'bottom') return lowered
    if (value !== undefined) {
      reportInvalid?.('marginSide', value, 'Expected "top" or "bottom".')
    }
    return defaultOptions.margin.side
  }

  return {
    element: {
      depth:
        typeof opt.elementDepth === 'number'
          ? opt.elementDepth
          : defaultOptions.element.depth
    },
    margin: {
      side: normalizeMarginSide(opt.marginSide)
    },
    position:
      typeof opt.position === 'boolean' ? opt.position : defaultOptions.position,
    size: {
      internal:
        typeof opt.sizeInternal === 'boolean'
          ? opt.sizeInternal
          : defaultOptions.size.internal
    },
    responsive: {
      mixins: normalizeStringArray(
        opt.responsiveMixins,
        defaultOptions.responsive.mixins
      )
    },
    selectorPolicy: safeNormalizeSelectorPolicyBase(
      selectorPolicy,
      defaultSelectorPolicy,
      reportInvalid
    ),
    ...common
  }
}
