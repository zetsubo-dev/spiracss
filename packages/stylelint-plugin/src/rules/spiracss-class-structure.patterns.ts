import type { NormalizedCacheSizes, WordCase } from '../types'
import { createSharedCacheAccessor } from '../utils/cache'
import { formatCode, formatPattern } from '../utils/messages'
import {
  buildBlockPattern,
  normalizeBlockMaxWords,
  normalizeCustomPattern
} from '../utils/naming'
import type { InvalidOptionReporter } from '../utils/normalize'
import type {
  ClassifyOptions,
  Kind,
  NormalizedSelectorPolicy,
  Patterns,
  SelectorPolicyData,
  ValueNaming
} from './spiracss-class-structure.types'

type NamingHintOptions = Pick<ClassifyOptions, 'naming'>

const serializePattern = (pattern: RegExp | undefined): string =>
  pattern ? `${pattern.source}/${pattern.flags}` : ''

const normalizeWordCase = (value: unknown, fallback: WordCase): WordCase =>
  value === 'kebab' || value === 'snake' || value === 'camel' || value === 'pascal'
    ? value
    : fallback

const getPatternsCache = createSharedCacheAccessor<string, Patterns>()

const buildValuePattern = (naming: ValueNaming): RegExp => {
  const maxWords = naming.maxWords
  switch (naming.case) {
    case 'kebab': {
      const word = '[a-z0-9]+'
      const rest = maxWords > 1 ? `(?:-${word}){0,${maxWords - 1}}` : ''
      return new RegExp(`^${word}${rest}$`)
    }
    case 'snake': {
      const word = '[a-z0-9]+'
      const rest = maxWords > 1 ? `(?:_${word}){0,${maxWords - 1}}` : ''
      return new RegExp(`^${word}${rest}$`)
    }
    case 'camel': {
      const head = '[a-z][a-zA-Z0-9]*'
      const rest = maxWords > 1 ? `(?:[A-Z][a-zA-Z0-9]*){0,${maxWords - 1}}` : ''
      return new RegExp(`^${head}${rest}$`)
    }
    case 'pascal': {
      const head = '[A-Z][a-zA-Z0-9]*'
      const rest = maxWords > 1 ? `(?:[A-Z][a-zA-Z0-9]*){0,${maxWords - 1}}` : ''
      return new RegExp(`^${head}${rest}$`)
    }
    default: {
      const word = '[a-z0-9]+'
      const rest = maxWords > 1 ? `(?:-${word}){0,${maxWords - 1}}` : ''
      return new RegExp(`^${word}${rest}$`)
    }
  }
}

export const formatNamingHint = (options: NamingHintOptions): string => {
  const naming = options?.naming || {}
  const blockCase: WordCase = normalizeWordCase(naming.blockCase, 'kebab')
  const elementCase: WordCase = normalizeWordCase(naming.elementCase, 'kebab')
  const modifierCase: WordCase = normalizeWordCase(naming.modifierCase, 'kebab')
  const modifierPrefix = naming.modifierPrefix ?? '-'
  const prefixLabel = modifierPrefix === '' ? '(none)' : modifierPrefix
  const blockMaxWords = normalizeBlockMaxWords(naming.blockMaxWords)
  const parts = [
    `blockCase=${formatCode(blockCase)}`,
    `blockMaxWords=${formatCode(String(blockMaxWords))}`,
    `elementCase=${formatCode(elementCase)}`,
    `modifierCase=${formatCode(modifierCase)}`,
    `modifierPrefix=${formatCode(prefixLabel)}`
  ]
  const customParts: string[] = []
  const customBlock = normalizeCustomPattern(
    naming.customPatterns?.block,
    'naming.customPatterns.block'
  )
  const customElement = normalizeCustomPattern(
    naming.customPatterns?.element,
    'naming.customPatterns.element'
  )
  const customModifier = normalizeCustomPattern(
    naming.customPatterns?.modifier,
    'naming.customPatterns.modifier'
  )
  if (customBlock) customParts.push(`block=${formatPattern(customBlock)}`)
  if (customElement) customParts.push(`element=${formatPattern(customElement)}`)
  if (customModifier) customParts.push(`modifier=${formatPattern(customModifier)}`)
  const customHint =
    customParts.length > 0 ? ` Custom patterns: ${customParts.join(', ')}.` : ''
  return `Naming: ${parts.join(', ')}.${customHint}`
}

export const buildPatterns = (
  options: ClassifyOptions,
  cacheSizes: NormalizedCacheSizes,
  reportInvalid?: InvalidOptionReporter
): Patterns => {
  const naming = options.naming || {}
  const blockCase: WordCase = normalizeWordCase(naming.blockCase, 'kebab')
  const elementCase: WordCase = normalizeWordCase(naming.elementCase, 'kebab')
  const modifierCase: WordCase = normalizeWordCase(naming.modifierCase, 'kebab')
  const modifierPrefix = naming.modifierPrefix ?? '-'
  const blockMaxWords = normalizeBlockMaxWords(naming.blockMaxWords)

  // Support partial customPatterns overrides (only specified ones replace defaults).
  const customBlock = normalizeCustomPattern(
    naming.customPatterns?.block,
    'naming.customPatterns.block',
    reportInvalid
  )
  const customElement = normalizeCustomPattern(
    naming.customPatterns?.element,
    'naming.customPatterns.element',
    reportInvalid
  )
  const customModifier = normalizeCustomPattern(
    naming.customPatterns?.modifier,
    'naming.customPatterns.modifier',
    reportInvalid
  )

  const cacheKey = [
    blockCase,
    blockMaxWords,
    elementCase,
    modifierCase,
    modifierPrefix,
    serializePattern(customBlock),
    serializePattern(customElement),
    serializePattern(customModifier)
  ].join('|')
  const patternsCache = getPatternsCache(cacheSizes.patterns)
  const cached = patternsCache.get(cacheKey)
  if (cached) return cached

  const blockRe = buildBlockPattern(
    naming,
    cacheSizes.naming,
    reportInvalid,
    {
      customBlock,
      skipCustomPatternValidation: true
    }
  )

  const elementRe = customElement ?? (() => {
    switch (elementCase) {
      case 'kebab':
      case 'snake':
        // title / lede
        return /^[a-z][a-z0-9]*$/
      case 'camel':
        // Single word only (no inner uppercase).
        return /^[a-z][a-z0-9]*$/
      case 'pascal':
        // Single word only (no inner uppercase).
        return /^[A-Z][a-z0-9]*$/
      default:
        return /^[a-z][a-z0-9]*$/
    }
  })()

  const modifierRe = customModifier ?? (() => {
    // Modifiers allow 1-2 words (SpiraCSS rule), prefixed by modifierPrefix.
    const prefixEscaped = modifierPrefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const base = (() => {
      switch (modifierCase) {
        case 'kebab': {
          const one = '[a-z0-9]+'
          const two = '[a-z0-9]+-[a-z0-9]+'
          return `(?:${one}|${two})`
        }
        case 'snake': {
          const one = '[a-z0-9]+'
          const two = '[a-z0-9]+_[a-z0-9]+'
          return `(?:${one}|${two})`
        }
        case 'camel': {
          const one = '[a-z][a-zA-Z0-9]*'
          const two = '[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*'
          return `(?:${one}|${two})`
        }
        case 'pascal': {
          const one = '[A-Z][a-zA-Z0-9]*'
          const two = '[A-Z][a-z0-9]*[A-Z][a-zA-Z0-9]*'
          return `(?:${one}|${two})`
        }
        default: {
          const one = '[a-z0-9]+'
          const two = '[a-z0-9]+-[a-z0-9]+'
          return `(?:${one}|${two})`
        }
      }
    })()
    return new RegExp(`^${prefixEscaped}${base}$`)
  })()

  const patterns = { blockRe, elementRe, modifierRe }
  patternsCache.set(cacheKey, patterns)
  return patterns
}

export const buildSelectorPolicyData = (
  policy: NormalizedSelectorPolicy
): SelectorPolicyData => ({
  reservedVariantKeys: new Set(policy.variant.dataKeys.map((key) => key.toLowerCase())),
  reservedStateKey: policy.state.dataKey.toLowerCase(),
  reservedAriaKeys: new Set(policy.state.ariaKeys.map((key) => key.toLowerCase())),
  variantValuePattern: buildValuePattern(policy.variant.valueNaming),
  stateValuePattern: buildValuePattern(policy.state.valueNaming)
})

/**
 * Classifies a class name using SpiraCSS patterns and external class allowances.
 * @param name - Class name to classify.
 * @param options - Rule options that define external class allowances.
 * @param patterns - Compiled naming patterns for Block/Element/Modifier.
 * @returns Classification kind for the class name.
 */
export const classify = (
  name: string,
  options: ClassifyOptions,
  patterns: Patterns
): Kind => {
  const external = options.external
  if (external.classes.includes(name) || external.prefixes.some((p) => name.startsWith(p))) {
    return 'external'
  }
  if (patterns.modifierRe.test(name)) return 'modifier'
  if (patterns.blockRe.test(name)) return 'block'
  if (patterns.elementRe.test(name)) return 'element'
  return 'invalid'
}
