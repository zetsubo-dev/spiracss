import type { CacheSizes, WordCase } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeKeyList,
  normalizeString,
  safeNormalizeSelectorPolicyBase} from '../utils/normalize'
import { normalizeCommonOptions, pickCommonDefaults } from '../utils/options'
import { createDefaultSelectorPolicyBase } from '../utils/selector-policy'
import type {
  FileNameCase,
  NormalizedSelectorPolicy,
  Options,
  SelectorPolicy,
  ValueNaming,
  ValueNamingOptions
} from './spiracss-class-structure.types'

const defaultValueNaming: ValueNaming = {
  case: 'kebab',
  maxWords: 2
}

const baseSelectorPolicy = createDefaultSelectorPolicyBase()

const defaultSelectorPolicy: NormalizedSelectorPolicy = {
  valueNaming: defaultValueNaming,
  variant: {
    ...baseSelectorPolicy.variant,
    valueNaming: defaultValueNaming
  },
  state: {
    ...baseSelectorPolicy.state,
    valueNaming: defaultValueNaming
  }
}

const ERROR_PREFIX = '[spiracss]'

const defaultOptions: Options = {
  element: {
    // SpiraCSS recommends up to ~4 levels, so default to 4.
    depth: 4
  },
  external: {
    classes: [],
    prefixes: []
  },
  child: {
    combinator: true,
    nesting: true
  },
  root: {
    single: true,
    file: true,
    case: 'preserve'
  },
  paths: {
    childDir: 'scss',
    components: ['components'],
    childFileCase: 'preserve'
  },
  naming: undefined,
  comments: {
    shared: /--shared/i,
    interaction: /--interaction/i
  },
  selectorPolicy: defaultSelectorPolicy,
  cache: DEFAULT_CACHE_SIZES
}

const isWordCase = (value: unknown): value is WordCase =>
  value === 'kebab' || value === 'snake' || value === 'camel' || value === 'pascal'

const normalizeFileNameCase = (value: unknown, fallback: FileNameCase): FileNameCase => {
  if (value === 'preserve') return value
  if (isWordCase(value)) return value
  return fallback
}

const normalizeValueNaming = (
  raw: unknown,
  fallback: ValueNaming,
  fieldName: string,
  reportInvalid?: InvalidOptionReporter
): ValueNaming => {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const value = raw as ValueNamingOptions
  const normalized: ValueNaming = { ...fallback }
  if (value.case !== undefined) {
    if (!isWordCase(value.case)) {
      reportInvalid?.(
        `${fieldName}.case`,
        value.case,
        `${ERROR_PREFIX} ${fieldName}.case must be "kebab" | "snake" | "camel" | "pascal".`
      )
    } else {
      normalized.case = value.case
    }
  }
  if (value.maxWords !== undefined) {
    if (
      typeof value.maxWords !== 'number' ||
      !Number.isInteger(value.maxWords) ||
      value.maxWords < 1
    ) {
      reportInvalid?.(
        `${fieldName}.maxWords`,
        value.maxWords,
        `${ERROR_PREFIX} ${fieldName}.maxWords must be a positive integer.`
      )
    } else {
      normalized.maxWords = value.maxWords
    }
  }
  return normalized
}

const normalizeSelectorPolicy = (
  raw: unknown,
  reportInvalid?: InvalidOptionReporter
): NormalizedSelectorPolicy => {
  const defaults = {
    variant: {
      mode: defaultSelectorPolicy.variant.mode,
      dataKeys: defaultSelectorPolicy.variant.dataKeys
    },
    state: {
      mode: defaultSelectorPolicy.state.mode,
      dataKey: defaultSelectorPolicy.state.dataKey,
      ariaKeys: defaultSelectorPolicy.state.ariaKeys
    }
  }
  const base = safeNormalizeSelectorPolicyBase(raw, defaults, reportInvalid)
  const policy = (raw && typeof raw === 'object' ? raw : {}) as SelectorPolicy
  const variant = policy.variant || {}
  const state = policy.state || {}

  const baseValueNaming = normalizeValueNaming(
    policy.valueNaming,
    defaultSelectorPolicy.valueNaming,
    'selectorPolicy.valueNaming',
    reportInvalid
  )
  const variantValueNaming = normalizeValueNaming(
    variant.valueNaming,
    baseValueNaming,
    'selectorPolicy.variant.valueNaming',
    reportInvalid
  )
  const stateValueNaming = normalizeValueNaming(
    state.valueNaming,
    baseValueNaming,
    'selectorPolicy.state.valueNaming',
    reportInvalid
  )

  return {
    valueNaming: baseValueNaming,
    variant: {
      mode: base.variant.mode,
      dataKeys: base.variant.dataKeys,
      valueNaming: variantValueNaming
    },
    state: {
      mode: base.state.mode,
      dataKey: base.state.dataKey,
      ariaKeys: base.state.ariaKeys,
      valueNaming: stateValueNaming
    }
  }
}

export const normalizeOptions = (
  raw: unknown,
  reportInvalid?: InvalidOptionReporter
): Options => {
  if (!raw || typeof raw !== 'object') return { ...defaultOptions }
  const opt = raw as {
    elementDepth?: number
    childCombinator?: boolean
    childNesting?: boolean
    rootSingle?: boolean
    rootFile?: boolean
    rootCase?: FileNameCase
    childFileCase?: FileNameCase
    childDir?: string
    componentsDirs?: string[]
    comments?: { shared?: RegExp | string; interaction?: RegExp | string }
    cache?: CacheSizes
    naming?: Options['naming']
    external?: Options['external']
    selectorPolicy?: Options['selectorPolicy']
  }
  const selectorPolicy = opt.selectorPolicy
  const safeNormalizeKeyList = (
    value: unknown,
    fallback: string[],
    fieldName: string
  ): string[] => normalizeKeyList(value, fallback, fieldName, reportInvalid)
  const common = normalizeCommonOptions(
    opt,
    pickCommonDefaults(defaultOptions),
    reportInvalid
  )

  return {
    element: {
      depth:
        typeof opt.elementDepth === 'number'
          ? opt.elementDepth
          : defaultOptions.element.depth
    },
    child: {
      combinator: normalizeBoolean(
        opt.childCombinator,
        defaultOptions.child.combinator
      ),
      nesting: normalizeBoolean(
        opt.childNesting,
        defaultOptions.child.nesting
      )
    },
    root: {
      single: normalizeBoolean(
        opt.rootSingle,
        defaultOptions.root.single
      ),
      file: normalizeBoolean(
        opt.rootFile,
        defaultOptions.root.file
      ),
      case: normalizeFileNameCase(opt.rootCase, defaultOptions.root.case)
    },
    paths: {
      childDir: normalizeString(
        opt.childDir,
        defaultOptions.paths.childDir
      ),
      components: safeNormalizeKeyList(
        opt.componentsDirs,
        defaultOptions.paths.components,
        'componentsDirs'
      ),
      childFileCase: normalizeFileNameCase(
        opt.childFileCase,
        defaultOptions.paths.childFileCase
      )
    },
    selectorPolicy: normalizeSelectorPolicy(selectorPolicy, reportInvalid),
    ...common
  }
}
