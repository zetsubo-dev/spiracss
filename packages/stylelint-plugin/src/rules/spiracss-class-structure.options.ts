import type { CacheSizes, WordCase } from '../types'
import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeKeyList,
  safeNormalizeSelectorPolicyBase,
  normalizeString
} from '../utils/normalize'
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
  // SpiraCSS recommends up to ~4 levels, so default to 4.
  allowElementChainDepth: 4,
  allowExternalClasses: [],
  allowExternalPrefixes: [],
  enforceChildCombinator: true,
  enforceSingleRootBlock: true,
  enforceRootFileName: true,
  rootFileCase: 'preserve',
  childScssDir: 'scss',
  componentsDirs: ['components'],
  naming: undefined,
  sharedCommentPattern: /--shared/i,
  interactionCommentPattern: /--interaction/i,
  selectorPolicy: defaultSelectorPolicy,
  cacheSizes: DEFAULT_CACHE_SIZES
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
  const opt = raw as Partial<Options> & {
    sharedCommentPattern?: RegExp | string
    interactionCommentPattern?: RegExp | string
    cacheSizes?: CacheSizes
  }
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
    allowElementChainDepth:
      typeof opt.allowElementChainDepth === 'number'
        ? opt.allowElementChainDepth
        : defaultOptions.allowElementChainDepth,
    enforceChildCombinator: normalizeBoolean(
      opt.enforceChildCombinator,
      defaultOptions.enforceChildCombinator
    ),
    enforceSingleRootBlock: normalizeBoolean(
      opt.enforceSingleRootBlock,
      defaultOptions.enforceSingleRootBlock
    ),
    enforceRootFileName: normalizeBoolean(
      opt.enforceRootFileName,
      defaultOptions.enforceRootFileName
    ),
    rootFileCase: normalizeFileNameCase(opt.rootFileCase, defaultOptions.rootFileCase),
    childScssDir: normalizeString(opt.childScssDir, defaultOptions.childScssDir),
    componentsDirs: safeNormalizeKeyList(
      opt.componentsDirs,
      defaultOptions.componentsDirs,
      'componentsDirs'
    ),
    selectorPolicy: normalizeSelectorPolicy(
      (opt as { selectorPolicy?: SelectorPolicy }).selectorPolicy,
      reportInvalid
    ),
    ...common
  }
}
