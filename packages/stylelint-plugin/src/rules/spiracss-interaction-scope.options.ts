import type { CacheSizes } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  safeNormalizeSelectorPolicyBase,
  normalizeStringArray
} from '../utils/normalize'
import { normalizeCommonOptions } from '../utils/options'
import { createDefaultSelectorPolicyBase } from '../utils/selector-policy'
import type {
  NormalizedSelectorPolicy,
  Options,
  SelectorPolicy
} from './spiracss-interaction-scope.types'

const defaultSelectorPolicy: NormalizedSelectorPolicy = createDefaultSelectorPolicyBase()

const defaultOptions: Options = {
  pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
  require: {
    atRoot: true,
    comment: true,
    tail: true
  },
  commentOnly: false,
  comments: {
    shared: /--shared/i,
    interaction: /--interaction/i
  },
  selectorPolicy: defaultSelectorPolicy,
  cache: DEFAULT_CACHE_SIZES
}

export const normalizeOptions = (
  opt: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!opt || typeof opt !== 'object') return { ...defaultOptions }
  const raw = opt as {
    pseudos?: Options['pseudos']
    requireAtRoot?: boolean
    requireComment?: boolean
    requireTail?: boolean
    commentOnly?: boolean
    comments?: { shared?: RegExp | string; interaction?: RegExp | string }
    cache?: CacheSizes
    selectorPolicy?: SelectorPolicy
  }
  const selectorPolicy = raw.selectorPolicy
  const common = normalizeCommonOptions(
    raw,
    {
      comments: defaultOptions.comments,
      cache: defaultOptions.cache
    },
    reportInvalid
  )

  return {
    pseudos: normalizeStringArray(raw.pseudos, defaultOptions.pseudos),
    require: {
      atRoot: normalizeBoolean(raw.requireAtRoot, defaultOptions.require.atRoot, {
        coerce: true
      }),
      comment: normalizeBoolean(raw.requireComment, defaultOptions.require.comment, {
        coerce: true
      }),
      tail: normalizeBoolean(raw.requireTail, defaultOptions.require.tail, {
        coerce: true
      })
    },
    commentOnly: normalizeBoolean(raw.commentOnly, defaultOptions.commentOnly, {
      coerce: true
    }),
    selectorPolicy: safeNormalizeSelectorPolicyBase(
      selectorPolicy,
      defaultSelectorPolicy,
      reportInvalid
    ),
    ...common
  }
}
