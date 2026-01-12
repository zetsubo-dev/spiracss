import type { CacheSizes, WordCase } from '../types'
import { DEFAULT_CACHE_SIZES, normalizeCacheSizes } from '../utils/cache'
import {
  type InvalidOptionReporter,
  normalizeBoolean,
  normalizeCommentPattern,
  normalizeKeyList,
  normalizeSelectorPolicyBase,
  normalizeString,
  normalizeStringArray
} from '../utils/normalize'
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

const defaultSelectorPolicy: NormalizedSelectorPolicy = {
  valueNaming: defaultValueNaming,
  variant: {
    mode: 'data',
    dataKeys: ['data-variant'],
    valueNaming: defaultValueNaming
  },
  state: {
    mode: 'data',
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
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
  fieldName: string
): ValueNaming => {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const value = raw as ValueNamingOptions
  if (value.case !== undefined && !isWordCase(value.case)) {
    throw new Error(
      `${ERROR_PREFIX} ${fieldName}.case must be "kebab" | "snake" | "camel" | "pascal".`
    )
  }
  if (value.maxWords !== undefined) {
    if (
      typeof value.maxWords !== 'number' ||
      !Number.isInteger(value.maxWords) ||
      value.maxWords < 1
    ) {
      throw new Error(`${ERROR_PREFIX} ${fieldName}.maxWords must be a positive integer.`)
    }
  }
  return {
    case: value.case ?? fallback.case,
    maxWords: value.maxWords ?? fallback.maxWords
  }
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
  const base = normalizeSelectorPolicyBase(raw, defaults, reportInvalid)
  const policy = (raw && typeof raw === 'object' ? raw : {}) as SelectorPolicy
  const variant = policy.variant || {}
  const state = policy.state || {}

  const baseValueNaming = normalizeValueNaming(
    policy.valueNaming,
    defaultSelectorPolicy.valueNaming,
    'selectorPolicy.valueNaming'
  )
  const variantValueNaming = normalizeValueNaming(
    variant.valueNaming,
    baseValueNaming,
    'selectorPolicy.variant.valueNaming'
  )
  const stateValueNaming = normalizeValueNaming(
    state.valueNaming,
    baseValueNaming,
    'selectorPolicy.state.valueNaming'
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
    naming: opt.naming || defaultOptions.naming,
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
    selectorPolicy: safeNormalizeSelectorPolicy(
      (opt as { selectorPolicy?: SelectorPolicy }).selectorPolicy
    ),
    cacheSizes: normalizeCacheSizes(opt.cacheSizes, reportInvalid)
  }
}
