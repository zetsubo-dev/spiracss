import type { Rule } from 'postcss'

import {
  type SelectorPolicySetsBase,
  buildSelectorPolicySetsBase
} from '../utils/selector-policy'
import { createSharedCacheAccessor } from '../utils/cache'
import type { SelectorParserCache } from '../utils/selector'
import { findParentRule } from '../utils/postcss-helpers'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import type { ClassifyOptions } from './spiracss-class-structure.types'
import type { Options } from './spiracss-property-placement.types'
import { messages } from './spiracss-property-placement.messages'

type ParsedSelector = ReturnType<SelectorParserCache['parse']>[number]
type SelectorNode = ParsedSelector['nodes'][number]
type SelectorNodeLike = SelectorNode | ParsedSelector
type SegmentNodes = SelectorNode[]
type TagNode = SelectorNode & { type: 'tag'; value: string }
type IdNode = SelectorNode & { type: 'id'; value: string }

type SelectorKind = 'root' | 'element' | 'child-block' | 'page-root'

export type SelectorInfo = {
  kind: SelectorKind
  tailCombinator: '>' | '+' | '~' | null
}

export type SelectorAnalysis =
  | {
      status: 'ok'
      selectors: SelectorInfo[]
      familyKeys: string[]
      hasUnverifiedFamilyKeys: boolean
    }
  | { status: 'skip' }
  | { status: 'error'; message: string }

export type PolicySets = SelectorPolicySetsBase & {
  modifiersAllowed: boolean
}

// Parse @scope prelude: "(start)" or "(start) to (end)" (allow flexible spacing around "to").
const SCOPE_PARAM_PATTERN = /^\s*\(([^()]*)\)(?:\s*to\s*\(([^()]*)\))?\s*$/i
// Allow only simple selectors (no pseudo, attribute, combinator, or grouping).
const SIMPLE_SCOPE_SELECTOR_PATTERN = /^[^,\s>+~&()\[\]:]+$/
// Extract the leading token from @include params.
const SCOPE_HEAD_PATTERN = /^([^\s(]+)/
const ALLOWED_COMBINATORS = new Set(['>', '+', '~'])
const GLOBAL_PSEUDO = ':global'
const FUNCTIONAL_PSEUDOS = new Set([':is', ':where', ':not'])
const LEADING_COMBINATOR_PATTERN = /^[>+~]/
const TRAILING_COMBINATOR_PATTERN = /[>+~]$/
// Guard against selector explosion during nested resolution.
const MAX_RESOLVED_SELECTORS = 1000

const isTagNode = (node: SelectorNode): node is TagNode => node.type === 'tag'
const isIdNode = (node: SelectorNode): node is IdNode => node.type === 'id'

const normalizeCombinator = (value: string): string => value.trim() || ' '

const externalClassCache = new WeakMap<
  Options,
  { classSet: Set<string>; prefixes: string[] }
>()

const getExternalClassCache = (options: Options): { classSet: Set<string>; prefixes: string[] } => {
  const cached = externalClassCache.get(options)
  if (cached) return cached
  const entry = {
    classSet: new Set(options.external.classes),
    prefixes: options.external.prefixes
  }
  externalClassCache.set(options, entry)
  return entry
}

const isExternalClass = (name: string, options: Options): boolean => {
  if (name.startsWith('u-')) return true
  const cached = getExternalClassCache(options)
  if (cached.classSet.has(name)) return true
  return cached.prefixes.some((prefix) => name.startsWith(prefix))
}

const isAllowedAttribute = (name: string, policy: PolicySets): boolean => {
  const lowered = name.toLowerCase()
  if (lowered.startsWith('data-')) {
    if (policy.dataVariantEnabled && policy.variantKeys.has(lowered)) return true
    if (policy.dataStateEnabled && lowered === policy.stateKey) return true
    return false
  }
  if (lowered.startsWith('aria-')) {
    if (!policy.dataStateEnabled) return false
    return policy.ariaKeys.has(lowered)
  }
  return false
}

export const buildPolicySets = (policy: Options['selectorPolicy']): PolicySets => ({
  ...buildSelectorPolicySetsBase(policy),
  modifiersAllowed: !(policy.variant.mode === 'data' && policy.state.mode === 'data')
})

type StrippedSelector = {
  selector: string
  leadingCombinator: '>' | '+' | '~' | null
}

const normalizeStrippedSelector = (selectorText: string): StrippedSelector | null => {
  let normalized = selectorText.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  // Strip dangling combinators left after removing :global(...) segments.
  // Descendant combinators are treated as root; only explicit child/sibling intent is preserved.
  const match = normalized.match(LEADING_COMBINATOR_PATTERN)
  const leadingCombinator = match ? (match[0] as '>' | '+' | '~') : null
  while (LEADING_COMBINATOR_PATTERN.test(normalized)) {
    normalized = normalized.slice(1).trim()
  }
  while (TRAILING_COMBINATOR_PATTERN.test(normalized)) {
    normalized = normalized.slice(0, -1).trim()
  }
  return normalized.length > 0 ? { selector: normalized, leadingCombinator } : null
}

type GlobalSelectorAnalysis = {
  stripped: string | null
  strippedSelectors: StrippedSelector[]
  globalOnly: boolean
  selectorCount: number
}
type GlobalSelectorCacheEntry = { value: GlobalSelectorAnalysis }
const getGlobalSelectorCache =
  createSharedCacheAccessor<string, GlobalSelectorCacheEntry>()

type GlobalSelectorScan = {
  hasLocal: boolean
  hasGlobal: boolean
  hasGlobalOutsideNegation: boolean
  rightmostGlobal: boolean
} & (
  | { hasBareGlobal: false; bareIndex: null }
  | { hasBareGlobal: true; bareIndex: number }
)

type GlobalSelectorFlags = {
  hasLocal: boolean
  hasGlobal: boolean
  hasGlobalOutsideNegation: boolean
} & (
  | { hasBareGlobal: false; bareIndex: null }
  | { hasBareGlobal: true; bareIndex: number }
)

const scanSelectorGlobalFlags = (
  selector: ReturnType<SelectorParserCache['parse']>[number],
  cache: WeakMap<
    ReturnType<SelectorParserCache['parse']>[number],
    GlobalSelectorFlags & { lastIndex: number | null }
  > = new WeakMap()
): GlobalSelectorFlags & { lastIndex: number | null } => {
  const cached = cache.get(selector)
  if (cached) return cached
  const nodes = selector.nodes ?? []
  let hasLocal = false
  let hasGlobal = false
  let hasGlobalOutsideNegation = false
  let hasBareGlobal = false
  let bareIndex: number | null = null
  let lastIndex: number | null = null

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.type === 'comment' || node.type === 'combinator') continue
    lastIndex = index
    break
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.type === 'comment' || node.type === 'combinator') continue
    if (node.type === 'pseudo') {
      const value = typeof node.value === 'string' ? node.value.toLowerCase() : ''
      if (value === GLOBAL_PSEUDO) {
        hasGlobal = true
        hasGlobalOutsideNegation = true
        const nestedSelectors = Array.isArray(node.nodes)
          ? node.nodes.filter(
              (
                child
              ): child is ReturnType<SelectorParserCache['parse']>[number] =>
                child.type === 'selector'
            )
          : []
        if (nestedSelectors.length === 0) {
          hasBareGlobal = true
          bareIndex = index
          break
        }
        continue
      }
      const selectorNodes = Array.isArray(node.nodes)
        ? node.nodes.filter(
            (
              child
            ): child is ReturnType<SelectorParserCache['parse']>[number] =>
              child.type === 'selector'
          )
        : []
      if (FUNCTIONAL_PSEUDOS.has(value)) {
        const isNegation = value === ':not'
        let hasNestedLocal = false
        selectorNodes.forEach((selectorNode) => {
          const nested = scanSelectorGlobalFlags(selectorNode, cache)
          if (nested.hasLocal) hasNestedLocal = true
          if (nested.hasGlobal) hasGlobal = true
          if (!isNegation && nested.hasGlobalOutsideNegation) {
            hasGlobalOutsideNegation = true
          }
        })
        if (hasNestedLocal) hasLocal = true
        continue
      }
      if (selectorNodes.length > 0) {
        selectorNodes.forEach((selectorNode) => {
          const nested = scanSelectorGlobalFlags(selectorNode, cache)
          if (nested.hasGlobal) hasGlobal = true
          if (nested.hasGlobalOutsideNegation) hasGlobalOutsideNegation = true
        })
        hasLocal = true
      }
      // Non-global pseudos do not make the selector local by themselves.
      continue
    }
    hasLocal = true
  }

  let result: GlobalSelectorFlags & { lastIndex: number | null }
  if (hasBareGlobal && bareIndex !== null) {
    result = {
      hasLocal,
      hasGlobal,
      hasGlobalOutsideNegation,
      hasBareGlobal: true,
      bareIndex,
      lastIndex
    }
  } else {
    result = {
      hasLocal,
      hasGlobal,
      hasGlobalOutsideNegation,
      hasBareGlobal: false,
      bareIndex: null,
      lastIndex
    }
  }
  cache.set(selector, result)
  return result
}

const isSelectorGlobalOnly = (
  selector: ReturnType<SelectorParserCache['parse']>[number],
  cache?: WeakMap<
    ReturnType<SelectorParserCache['parse']>[number],
    GlobalSelectorFlags & { lastIndex: number | null }
  >
): boolean => {
  const scan = scanSelectorGlobalFlags(selector, cache)
  return scan.hasGlobalOutsideNegation && !scan.hasLocal
}

const getRightmostSegment = (nodes: SelectorNode[]): SelectorNode[] => {
  let start = 0
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (nodes[index].type === 'combinator') {
      start = index + 1
      break
    }
  }
  return nodes.slice(start)
}

const isGlobalOnlySegment = (
  segment: SelectorNode[],
  cache: WeakMap<
    ReturnType<SelectorParserCache['parse']>[number],
    GlobalSelectorFlags & { lastIndex: number | null }
  >
): boolean => {
  let hasNodes = false
  let hasGlobalReference = false
  for (const node of segment) {
    if (node.type === 'comment' || node.type === 'combinator') continue
    hasNodes = true
    if (
      node.type === 'class' ||
      node.type === 'tag' ||
      node.type === 'id' ||
      node.type === 'attribute' ||
      node.type === 'nesting' ||
      node.type === 'universal' ||
      node.type === 'string'
    ) {
      return false
    }
    if (node.type === 'pseudo') {
      const value = typeof node.value === 'string' ? node.value.toLowerCase() : ''
      const selectorNodes = Array.isArray(node.nodes)
        ? node.nodes.filter(
            (
              child
            ): child is ReturnType<SelectorParserCache['parse']>[number] =>
              child.type === 'selector'
          )
        : []
      if (value === GLOBAL_PSEUDO) {
        if (selectorNodes.length === 0) return false
        hasGlobalReference = true
        continue
      }
      if (FUNCTIONAL_PSEUDOS.has(value)) {
        if (selectorNodes.length === 0) return false
        if (value === ':not') return false
        if (!selectorNodes.every((selector) => isSelectorGlobalOnly(selector, cache))) {
          return false
        }
        hasGlobalReference = true
        continue
      }
      if (selectorNodes.length > 0) return false
      // Other pseudos are allowed as long as the segment is otherwise global-only.
      continue
    }
    return false
  }
  return hasNodes && hasGlobalReference
}

/**
 * Tracks local/global nodes inside a selector.
 *
 * CSS Modules :global semantics:
 * - :global(.foo) → only .foo is global; nodes after it are local
 * - :global .foo  → .foo and all subsequent nodes are global (bare :global)
 */
const scanSelectorGlobalState = (
  selector: ReturnType<SelectorParserCache['parse']>[number],
  cache: WeakMap<
    ReturnType<SelectorParserCache['parse']>[number],
    GlobalSelectorFlags & { lastIndex: number | null }
  >
): GlobalSelectorScan => {
  const nodes = selector.nodes ?? []
  const scan = scanSelectorGlobalFlags(selector, cache)
  let rightmostGlobal = false
  if (
    scan.hasBareGlobal &&
    scan.bareIndex !== null &&
    scan.lastIndex !== null &&
    scan.lastIndex > scan.bareIndex
  ) {
    rightmostGlobal = true
  } else {
    const rightmostSegment = getRightmostSegment(nodes)
    rightmostGlobal = isGlobalOnlySegment(rightmostSegment, cache)
  }
  // Keep the explicit branch to help TypeScript narrow hasBareGlobal/bareIndex.
  if (scan.hasBareGlobal && scan.bareIndex !== null) {
    return {
      hasLocal: scan.hasLocal,
      hasGlobal: scan.hasGlobal,
      hasGlobalOutsideNegation: scan.hasGlobalOutsideNegation,
      hasBareGlobal: true,
      bareIndex: scan.bareIndex,
      rightmostGlobal
    }
  }
  return {
    hasLocal: scan.hasLocal,
    hasGlobal: scan.hasGlobal,
    hasGlobalOutsideNegation: scan.hasGlobalOutsideNegation,
    hasBareGlobal: false,
    bareIndex: null,
    rightmostGlobal
  }
}

const analyzeGlobalSelector = (
  selectorText: string,
  cache: SelectorParserCache,
  cacheSize: number
): GlobalSelectorAnalysis => {
  const globalCache = getGlobalSelectorCache(cacheSize)
  const cached = globalCache.get(selectorText)
  if (cached) {
    // Keep parse-error tracking consistent even when global analysis is cached.
    cache.parse(selectorText)
    return cached.value
  }
  const selectors = cache.parse(selectorText)
  if (selectors.length === 0) {
    const value = {
      stripped: null,
      strippedSelectors: [],
      globalOnly: false,
      selectorCount: 0
    }
    globalCache.set(selectorText, { value })
    return value
  }
  const selectorCount = selectors.length
  const flagsCache = new WeakMap<
    ReturnType<SelectorParserCache['parse']>[number],
    GlobalSelectorFlags & { lastIndex: number | null }
  >()
  let allGlobalOnly = selectors.length > 0
  const stripped: StrippedSelector[] = []
  selectors.forEach((sel) => {
    const scan = scanSelectorGlobalState(sel, flagsCache)
    let selectorGlobalOnly =
      scan.rightmostGlobal ||
      (scan.hasGlobalOutsideNegation && !scan.hasLocal)
    if (!scan.hasGlobal) {
      const normalized = normalizeStrippedSelector(sel.toString())
      if (normalized) stripped.push(normalized)
      allGlobalOnly = false
      return
    }
    if (scan.rightmostGlobal) {
      // Treat selectors whose rightmost target is global as out-of-scope.
      allGlobalOnly = allGlobalOnly && selectorGlobalOnly
      return
    }
    if (scan.hasBareGlobal) {
      const cloned = sel.clone()
      const nodes = cloned.nodes ?? []
      nodes.splice(scan.bareIndex)
      const normalized = normalizeStrippedSelector(cloned.toString())
      if (normalized) stripped.push(normalized)
      if (!normalized) selectorGlobalOnly = true
      allGlobalOnly = allGlobalOnly && selectorGlobalOnly
      return
    }
    const cloned = sel.clone()
    const globalOnlySelectors = new WeakSet<ParsedSelector>()
    let hasEmptySelectorList = false
    let hasGlobalOnlySelectorList = false
    cloned.walkPseudos((pseudo) => {
      const value = typeof pseudo.value === 'string' ? pseudo.value.toLowerCase() : ''
      if (value === GLOBAL_PSEUDO) {
        const parent = pseudo.parent
        if (parent && parent.type === 'selector') {
          const parentSelector = parent as ParsedSelector
          const scan = scanSelectorGlobalState(parentSelector, flagsCache)
          if (scan.rightmostGlobal || (scan.hasGlobalOutsideNegation && !scan.hasLocal)) {
            globalOnlySelectors.add(parentSelector)
          }
        }
        // Drop :global(...) entirely so global context doesn't affect placement checks.
        pseudo.remove()
      }
    })
    cloned.walkPseudos((pseudo) => {
      const selectorNodes = Array.isArray(pseudo.nodes)
        ? pseudo.nodes.filter(
            (
              child
            ): child is ReturnType<SelectorParserCache['parse']>[number] =>
              child.type === 'selector'
          )
        : []
      if (selectorNodes.length === 0) return
      let removedGlobalOnly = false
      selectorNodes.forEach((selector) => {
        if (globalOnlySelectors.has(selector)) {
          selector.remove()
          removedGlobalOnly = true
        }
      })
      const value = typeof pseudo.value === 'string' ? pseudo.value.toLowerCase() : ''
      selectorNodes.forEach((selector) => {
        const hasMeaningfulNodes = (selector.nodes ?? []).some(
          (node) => node.type !== 'comment' && node.type !== 'combinator'
        )
        if (!hasMeaningfulNodes) selector.remove()
      })
      const remainingSelectors = Array.isArray(pseudo.nodes)
        ? pseudo.nodes.filter(
            (
              child
            ): child is ReturnType<SelectorParserCache['parse']>[number] =>
              child.type === 'selector'
          )
        : []
      if (remainingSelectors.length === 0) {
        if (FUNCTIONAL_PSEUDOS.has(value)) {
          if (value !== ':not' && removedGlobalOnly) {
            hasGlobalOnlySelectorList = true
            return
          }
          pseudo.remove()
          return
        }
        hasEmptySelectorList = true
        return
      }
      const pseudoNodes = (pseudo.nodes ?? []) as SelectorNodeLike[]
      const hasContent = pseudoNodes.some((node) => {
        if (node.type === 'comment') return false
        if (node.type !== 'selector') return true
        return (node.nodes ?? []).some(
          (child) => child.type !== 'comment' && child.type !== 'combinator'
        )
      })
      if (!hasContent) pseudo.remove()
    })
    if (hasGlobalOnlySelectorList) {
      selectorGlobalOnly = true
      allGlobalOnly = allGlobalOnly && selectorGlobalOnly
      return
    }
    if (hasEmptySelectorList) {
      // Treat non-functional pseudos with empty selector lists as unverified:
      // skip placement, but keep @at-root/@extend checks in scope.
      allGlobalOnly = false
      return
    }
    const normalized = normalizeStrippedSelector(cloned.toString())
    if (normalized) stripped.push(normalized)
    if (!normalized) selectorGlobalOnly = true
    allGlobalOnly = allGlobalOnly && selectorGlobalOnly
  })
  const strippedText = stripped.length > 0 ? stripped.map((item) => item.selector).join(', ') : null
  const value: GlobalSelectorAnalysis = {
    stripped: allGlobalOnly ? null : strippedText,
    strippedSelectors: allGlobalOnly ? [] : stripped,
    globalOnly: allGlobalOnly,
    selectorCount
  }
  globalCache.set(selectorText, { value })
  return value
}

export const stripGlobalSelector = (
  selectorText: string,
  cache: SelectorParserCache,
  cacheSize: number,
  options?: { preserveCombinator?: boolean }
): string | null => {
  const analysis = analyzeGlobalSelector(selectorText, cache, cacheSize)
  // `null` means the selector is either global-only or unverified after stripping :global.
  // Use stripGlobalSelectorForRoot() to keep unverified selectors in-scope for root anchoring.
  // Use isGlobalOnlySelector() to distinguish global-only (skip @at-root/@extend).
  if (!options?.preserveCombinator) return analysis.stripped
  if (analysis.strippedSelectors.length === 0) return null
  return analysis.strippedSelectors
    .map((item) =>
      item.leadingCombinator ? `${item.leadingCombinator} ${item.selector}` : item.selector
    )
    .join(', ')
}

export const stripGlobalSelectorForRoot = (
  selectorText: string,
  cache: SelectorParserCache,
  cacheSize: number,
  options?: { preserveCombinator?: boolean }
): string | null => {
  // Expect a single selector (splitSelectors output), not a selector list with commas.
  // For unverified selectors, return the original text to keep root anchoring in-scope.
  const analysis = analyzeGlobalSelector(selectorText, cache, cacheSize)
  if (analysis.globalOnly) return null
  if (!options?.preserveCombinator) {
    return analysis.stripped ?? selectorText
  }
  if (analysis.strippedSelectors.length === 0) {
    // Keep unverified selectors in-scope for root anchoring.
    return selectorText
  }
  return analysis.strippedSelectors
    .map((item) =>
      item.leadingCombinator ? `${item.leadingCombinator} ${item.selector}` : item.selector
    )
    .join(', ')
}

export const isGlobalOnlySelector = (
  selectorText: string,
  cache: SelectorParserCache,
  cacheSize: number
): boolean => {
  return analyzeGlobalSelector(selectorText, cache, cacheSize).globalOnly
}

export const splitSelectors = (
  selector: string,
  cache: SelectorParserCache
): string[] => {
  const selectors = cache.parse(selector)
  return selectors.map((sel) => sel.toString().trim()).filter((text) => text.length > 0)
}

const combineSelectors = (parent: string, child: string): string | null => {
  const trimmedChild = child.trim()
  if (!trimmedChild) return null
  if (trimmedChild.includes('&')) {
    return trimmedChild.replace(/&/g, parent)
  }
  return `${parent} ${trimmedChild}`.trim()
}

export const resolveSelectors = (
  rule: Rule,
  cache: SelectorParserCache,
  resolvedCache: WeakMap<Rule, string[]>,
  reportExplosion?: (selector: string, limit: number) => void
): string[] => {
  const cached = resolvedCache.get(rule)
  if (cached !== undefined) return cached

  const chain: Rule[] = [rule]
  let current: Rule | null = findParentRule(rule)
  let resolved: string[] | null = null

  while (current) {
    const cachedCurrent = resolvedCache.get(current)
    if (cachedCurrent !== undefined) {
      resolved = cachedCurrent
      break
    }
    chain.push(current)
    current = findParentRule(current)
  }

  while (chain.length > 0) {
    const currentRule = chain.pop() as Rule
    if (typeof currentRule.selector !== 'string') {
      resolved = []
      resolvedCache.set(currentRule, resolved)
      continue
    }
    const currentSelectors = splitSelectors(currentRule.selector, cache)
    if (!resolved) {
      resolved = currentSelectors
      resolvedCache.set(currentRule, resolved)
      continue
    }
    if (resolved.length === 0 || currentSelectors.length === 0) {
      resolved = []
      resolvedCache.set(currentRule, resolved)
      continue
    }
    if (resolved.length * currentSelectors.length > MAX_RESOLVED_SELECTORS) {
      reportExplosion?.(currentRule.selector, MAX_RESOLVED_SELECTORS)
      resolved = []
      resolvedCache.set(currentRule, resolved)
      continue
    }
    // Expand selectors with a hard cap to keep worst-case cost bounded.
    const combined: string[] = []
    let exceeded = false
    resolved.forEach((parent) => {
      if (exceeded) return
      currentSelectors.forEach((child) => {
        if (exceeded) return
        const combinedSelector = combineSelectors(parent, child)
        if (!combinedSelector) return
        combined.push(combinedSelector)
        if (combined.length > MAX_RESOLVED_SELECTORS) {
          exceeded = true
        }
      })
    })
    if (exceeded) {
      reportExplosion?.(currentRule.selector, MAX_RESOLVED_SELECTORS)
      resolved = []
      resolvedCache.set(currentRule, resolved)
      continue
    }
    resolved = combined
    resolvedCache.set(currentRule, resolved)
  }

  return resolvedCache.get(rule) ?? []
}

const collectSegments = (
  selector: ReturnType<SelectorParserCache['parse']>[number],
  segments: SegmentNodes[],
  combinators: string[]
): void => {
  let current: SegmentNodes = []
  selector.nodes.forEach((node) => {
    if (node.type === 'comment') return
    if (node.type === 'combinator') {
      segments.push(current)
      current = []
      combinators.push(normalizeCombinator(node.value))
      return
    }
    current.push(node)
  })
  // Keep empty segments to preserve combinator alignment; invalid selectors are rejected later.
  segments.push(current)
}

const analyzeRootSegment = (
  segment: SegmentNodes,
  segmentCount: number,
  combinatorCount: number,
  selectorText: string
):
  | { status: 'ok'; kind?: 'page-root' }
  | { status: 'skip' }
  | { status: 'error'; message: string } => {
  const tags = segment.filter(isTagNode)
  const ids = segment.filter(isIdNode)
  if (tags.length === 0 && ids.length === 0) return { status: 'ok' }

  const hasOtherNodes = segment.some((node) => node.type !== 'tag' && node.type !== 'id')
  const isBodyTag = tags.length === 1 && tags[0].value.toLowerCase() === 'body'
  const isBody = isBodyTag && ids.length === 0
  const isIdRoot = ids.length === 1 && tags.length === 0

  if (isBodyTag && ids.length > 0) {
    return { status: 'error', message: messages.pageRootNoChildren(selectorText) }
  }

  if (isBody || isIdRoot) {
    if (hasOtherNodes || segmentCount > 1 || combinatorCount > 0) {
      return { status: 'error', message: messages.pageRootNoChildren(selectorText) }
    }
    return { status: 'ok', kind: 'page-root' }
  }

  return { status: 'skip' }
}

type RootCheckResult = ReturnType<typeof analyzeRootSegment>

type PseudoBaseResult = {
  baseKind: 'block' | 'element' | null
  baseClass: string | null
}

type SegmentKindInfo = {
  kind: 'block' | 'element'
}

type SegmentBase = {
  kind: 'block' | 'element'
  baseClass: string
}

const analyzePseudoBase = (
  pseudo: SelectorNode,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassifyOptions
): PseudoBaseResult | null => {
  if (!('nodes' in pseudo) || !Array.isArray(pseudo.nodes)) return null
  const selectorNodes = pseudo.nodes.filter(
    (node): node is ReturnType<SelectorParserCache['parse']>[number] => node.type === 'selector'
  )
  if (selectorNodes.length === 0) return null

  let resolvedKind: 'block' | 'element' | null = null
  let resolvedClass: string | null = null
  let resolvedHasBase = false

  for (const sel of selectorNodes) {
    let localKind: 'block' | 'element' | null = null
    let localClass: string | null = null
    let localHasBase = false
    let invalid = false

    sel.nodes.forEach((node) => {
      if (invalid) return
      if (node.type === 'comment') return
      if (node.type === 'combinator') {
        invalid = true
        return
      }
      if (node.type === 'class') {
        const className = node.value
        if (isExternalClass(className, options)) {
          invalid = true
          return
        }
        const kind = classify(className, classifyOptions, patterns)
        if (kind === 'external' || kind === 'invalid') {
          invalid = true
          return
        }
        if (kind === 'modifier') {
          if (!policy.modifiersAllowed) invalid = true
          return
        }
        if (localHasBase) {
          if (localClass !== className || localKind !== kind) invalid = true
          return
        }
        localKind = kind
        localClass = className
        localHasBase = true
        return
      }
      if (node.type === 'attribute') {
        const name = typeof node.attribute === 'string' ? node.attribute : ''
        if (!name || !isAllowedAttribute(name, policy)) invalid = true
        return
      }
      if (node.type === 'pseudo') {
        invalid = true
        return
      }
      if (node.type === 'nesting' || node.type === 'tag' || node.type === 'id') {
        invalid = true
        return
      }
      invalid = true
    })

    if (invalid) return null

    if (resolvedHasBase) {
      if (!localHasBase) return null
      if (resolvedClass !== localClass || resolvedKind !== localKind) return null
    } else if (localHasBase) {
      resolvedHasBase = true
      resolvedClass = localClass
      resolvedKind = localKind
    }
  }

  return { baseKind: resolvedKind, baseClass: resolvedClass }
}

// Analyze a selector segment and return either the resolved kind only ("kind")
// or the kind + base class ("base") for selector-family keys.
const analyzeSegmentInfo = (
  segment: SegmentNodes,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassifyOptions,
  mode: 'kind' | 'base'
): SegmentKindInfo | SegmentBase | null => {
  let baseKind: 'block' | 'element' | null = null
  let baseClass: string | null = null
  // Only enforce single base-class segments when building family keys.
  const countBaseClasses = mode === 'base'
  let baseCount = 0
  let pseudoKind: 'block' | 'element' | null = null
  let pseudoClass: string | null = null

  for (const node of segment) {
    if (node.type === 'nesting') return null
    if (node.type === 'universal' || node.type === 'tag' || node.type === 'id') return null
    if (node.type === 'attribute') {
      const name = typeof node.attribute === 'string' ? node.attribute : ''
      if (!name || !isAllowedAttribute(name, policy)) return null
      continue
    }
    if (node.type === 'pseudo') {
      const pseudoValue = typeof node.value === 'string' ? node.value.toLowerCase() : ''
      if (!FUNCTIONAL_PSEUDOS.has(pseudoValue)) return null
      const parsed = analyzePseudoBase(node, options, policy, patterns, classifyOptions)
      if (!parsed) return null
      if (parsed.baseKind) {
        if (!pseudoClass) {
          pseudoClass = parsed.baseClass
          pseudoKind = parsed.baseKind
        } else if (
          pseudoKind !== parsed.baseKind ||
          (mode === 'base' && pseudoClass !== parsed.baseClass)
        ) {
          return null
        }
      }
      continue
    }
    if (node.type !== 'class') continue
    const className = node.value
    if (isExternalClass(className, options)) return null
    const kind = classify(className, classifyOptions, patterns)
    if (kind === 'external' || kind === 'invalid') return null
    if (kind === 'modifier') {
      if (!policy.modifiersAllowed) return null
      continue
    }
    if (kind === 'block' || kind === 'element') {
      if (countBaseClasses) baseCount += 1
      if (!baseKind) {
        baseKind = kind
        baseClass = className
      } else if (baseKind !== kind) {
        return null
      }
    }
  }

  if (!baseKind || !baseClass) return null
  if (pseudoKind && baseKind !== pseudoKind) return null
  if (mode === 'base') {
    // Family keys require exactly one base class per segment.
    if (baseCount > 1) return null
    if (pseudoClass && baseClass !== pseudoClass) return null
    return { kind: baseKind, baseClass }
  }
  // For kind-only mode, multiple base classes of the same kind are allowed.
  return { kind: baseKind }
}

const analyzeSegmentKind = (
  segment: SegmentNodes,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassifyOptions
): 'block' | 'element' | null => {
  const info = analyzeSegmentInfo(
    segment,
    options,
    policy,
    patterns,
    classifyOptions,
    'kind'
  )
  return info ? info.kind : null
}

const analyzeSegmentBase = (
  segment: SegmentNodes,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassifyOptions
): SegmentBase | null => {
  const info = analyzeSegmentInfo(
    segment,
    options,
    policy,
    patterns,
    classifyOptions,
    'base'
  )
  return info && 'baseClass' in info ? info : null
}

const calculateElementDepth = (
  segmentKinds: Array<'block' | 'element'>,
  combinators: string[]
): number => {
  // Track consecutive element chains joined by child combinators.
  let maxDepth = 0
  let currentDepth = 0
  for (let i = 1; i < segmentKinds.length; i += 1) {
    const kind = segmentKinds[i]
    const combinator = combinators[i - 1]
    if (kind !== 'element') {
      currentDepth = 0
      continue
    }
    if (combinator === '>' && segmentKinds[i - 1] === 'element') {
      currentDepth += 1
    } else {
      currentDepth = 1
    }
    if (currentDepth > maxDepth) maxDepth = currentDepth
  }
  return maxDepth
}

type SelectorChain<T extends SegmentKindInfo> = {
  segmentInfos: T[]
  segmentKinds: Array<'block' | 'element'>
  combinators: string[]
  tailCombinator: '>' | '+' | '~' | null
  hasChildBlockAtTail: boolean
}

const parseSelectorSegments = (
  selectorText: string,
  cache: SelectorParserCache
): { segments: SegmentNodes[]; combinators: string[]; rootCheck: RootCheckResult } | null => {
  const parsed = cache.parse(selectorText)
  if (parsed.length !== 1) return null
  const segments: SegmentNodes[] = []
  const combinators: string[] = []
  collectSegments(parsed[0], segments, combinators)
  if (segments.length === 0) return null
  const rootCheck = analyzeRootSegment(
    segments[0],
    segments.length,
    combinators.length,
    selectorText
  )
  return { segments, combinators, rootCheck }
}

const buildSelectorChain = <T extends SegmentKindInfo>(
  segments: SegmentNodes[],
  combinators: string[],
  resolveSegment: (segment: SegmentNodes) => T | null,
  maxElementDepth: number
): SelectorChain<T> | null => {
  // Only allow direct or sibling combinators; descendant combinator (space) is unsupported.
  if (combinators.some((combinator) => !ALLOWED_COMBINATORS.has(combinator))) {
    return null
  }
  // Sibling combinators (+, ~) are allowed only at the tail position (after the last segment).
  for (let i = 0; i < combinators.length - 1; i += 1) {
    if (combinators[i] === '+' || combinators[i] === '~') return null
  }

  const segmentInfos: T[] = []
  const segmentKinds: Array<'block' | 'element'> = []
  for (const segment of segments) {
    const info = resolveSegment(segment)
    if (!info) return null
    segmentInfos.push(info)
    segmentKinds.push(info.kind)
  }

  if (segmentKinds[0] !== 'block') return null

  const tailCombinator = combinators.length > 0 ? (combinators.at(-1) as '>' | '+' | '~') : null
  if (tailCombinator && (tailCombinator === '+' || tailCombinator === '~')) {
    const lastKind = segmentKinds.at(-1)
    const prevKind = segmentKinds.at(-2)
    if (!lastKind || !prevKind || lastKind !== prevKind) return null
  }
  if (
    segmentKinds.length === 2 &&
    segmentKinds[0] === 'block' &&
    segmentKinds[1] === 'block' &&
    (tailCombinator === '+' || tailCombinator === '~')
  ) {
    // Reject `.block + .block` at the root to avoid block-to-block sibling targeting.
    return null
  }

  const allowSiblingBlockTail =
    (tailCombinator === '+' || tailCombinator === '~') &&
    segmentKinds.at(-1) === 'block' &&
    segmentKinds.at(-2) === 'block'
  const childBlockScanEnd = allowSiblingBlockTail ? -2 : -1
  const hasChildBlockBeforeTail = segmentKinds
    .slice(1, childBlockScanEnd)
    .some((kind) => kind === 'block')
  if (hasChildBlockBeforeTail) return null

  const hasChildBlockAtTail = segmentKinds.length > 1 && segmentKinds.at(-1) === 'block'
  if (hasChildBlockAtTail) {
    if (tailCombinator === '+' || tailCombinator === '~' || tailCombinator === '>') {
      // allowed
    } else {
      return null
    }
  }

  const maxDepth = calculateElementDepth(segmentKinds, combinators)
  if (maxDepth > maxElementDepth) return null

  return { segmentInfos, segmentKinds, combinators, tailCombinator, hasChildBlockAtTail }
}

// Analyze selectors for placement rules, skipping unverified selectors and
// rejecting lists that mix incompatible kinds.
export const analyzeSelectorList = (
  selectorList: string[],
  cache: SelectorParserCache,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassifyOptions
): SelectorAnalysis => {
  if (selectorList.length === 0) return { status: 'skip' }
  const normalizedSelectors = selectorList.filter((selector) => selector.length > 0)
  if (normalizedSelectors.length === 0) return { status: 'skip' }
  const strippedSelectors = normalizedSelectors.flatMap((selector) =>
    analyzeGlobalSelector(selector, cache, options.cache.selector).strippedSelectors
  )
  if (strippedSelectors.length === 0) return { status: 'skip' }

  let hasPageRootSelector = false
  let hasKindMismatch = false
  let hasUnverifiedFamilyKeys = false
  let expectedKind: SelectorKind | null = null
  const selectors: SelectorInfo[] = []
  const familyKeys: string[] = []

  for (const { selector: selectorText, leadingCombinator } of strippedSelectors) {
    const analysis = analyzeSelectorWithFamilyKey(
      selectorText,
      cache,
      options,
      policy,
      patterns,
      classifyOptions,
      leadingCombinator
    )
    if (analysis.status === 'error') return analysis
    if (analysis.status === 'skip') {
      continue
    }
    if (analysis.selector.kind === 'page-root') {
      hasPageRootSelector = true
      selectors.push(analysis.selector)
      continue
    }

    if (expectedKind && expectedKind !== analysis.selector.kind) {
      hasKindMismatch = true
    } else {
      expectedKind = analysis.selector.kind
    }
    selectors.push(analysis.selector)
    if (!analysis.familyKey && analysis.selector.kind === 'child-block') {
      hasUnverifiedFamilyKeys = true
    }
    if (!hasKindMismatch && analysis.familyKey) familyKeys.push(analysis.familyKey)
  }

  if (hasPageRootSelector && normalizedSelectors.length > 1) {
    return {
      status: 'error',
      message: messages.pageRootNoChildren(normalizedSelectors.join(', '))
    }
  }
  // Reject lists that mix incompatible kinds to avoid bypassing placement checks.
  if (hasKindMismatch) {
    return {
      status: 'error',
      message: messages.selectorKindMismatch(normalizedSelectors.join(', '))
    }
  }

  return selectors.length === 0
    ? { status: 'skip' }
    : {
        status: 'ok',
        selectors,
        familyKeys: [...new Set(familyKeys)],
        hasUnverifiedFamilyKeys
      }
}

type SelectorAnalysisResult =
  | { status: 'ok'; selector: SelectorInfo; familyKey: string | null }
  | { status: 'skip' }
  | { status: 'error'; message: string }

const buildFamilyKeyFromChain = (chain: SelectorChain<SegmentBase>): string => {
  let key = chain.segmentInfos[0].baseClass
  for (let i = 1; i < chain.segmentInfos.length; i += 1) {
    key += `${chain.combinators[i - 1]}${chain.segmentInfos[i].baseClass}`
  }
  return key
}

const analyzeSelectorWithFamilyKey = (
  selectorText: string,
  cache: SelectorParserCache,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassifyOptions,
  leadingCombinator: '>' | '+' | '~' | null = null
): SelectorAnalysisResult => {
  // Only evaluate simple chain selectors; complex patterns are treated as unverified.
  const parsed = parseSelectorSegments(selectorText, cache)
  if (!parsed) return { status: 'skip' }
  const { segments, combinators, rootCheck } = parsed
  if (rootCheck.status !== 'ok') return rootCheck
  if (rootCheck.kind === 'page-root') {
    return {
      status: 'ok',
      selector: { kind: 'page-root', tailCombinator: null },
      familyKey: null
    }
  }

  // First pass: determine selector kind using relaxed validation (allows multiple
  // base classes of the same kind in a segment, e.g., `.block.block-alt`).
  const chain = buildSelectorChain(
    segments,
    combinators,
    (segment) => {
      const kind = analyzeSegmentKind(segment, options, policy, patterns, classifyOptions)
      return kind ? { kind } : null
    },
    options.element.depth
  )
  if (!chain) return { status: 'skip' }

  let selector: SelectorInfo
  if (chain.segmentKinds.length === 1) {
    selector = { kind: 'root', tailCombinator: null }
  } else if (chain.hasChildBlockAtTail) {
    selector = { kind: 'child-block', tailCombinator: chain.tailCombinator }
  } else {
    selector = { kind: 'element', tailCombinator: chain.tailCombinator }
  }
  if (leadingCombinator && selector.kind === 'root') {
    // Preserve child/sibling intent when the global prefix is stripped away.
    selector = { kind: 'child-block', tailCombinator: leadingCombinator }
  }

  // Second pass: extract family key using strict validation (requires exactly one
  // base class per segment). This may fail even when the first pass succeeded.
  const baseChain = buildSelectorChain<SegmentBase>(
    segments,
    combinators,
    (segment) => analyzeSegmentBase(segment, options, policy, patterns, classifyOptions),
    options.element.depth
  )
  const familyKey = baseChain ? buildFamilyKeyFromChain(baseChain) : null

  return { status: 'ok', selector, familyKey }
}

export const normalizeScopePrelude = (params: string): string | null => {
  const match = params.match(SCOPE_PARAM_PATTERN)
  if (!match) return null
  const start = match[1]?.trim() ?? ''
  const end = match[2]?.trim() ?? ''
  // Complex prelude selectors are treated as unverified to avoid mis-grouping contexts.
  if (!start || !SIMPLE_SCOPE_SELECTOR_PATTERN.test(start)) return null
  if (end && !SIMPLE_SCOPE_SELECTOR_PATTERN.test(end)) return null
  return end ? `${start}=>${end}` : start
}

export const normalizeUnverifiedScopePrelude = (params: string): string | null => {
  const normalized = params.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : null
}

export const parseMixinName = (params: string): string | null => {
  const trimmed = params.trim()
  if (!trimmed || trimmed.includes('#{')) return null
  const match = trimmed.match(SCOPE_HEAD_PATTERN)
  return match ? match[1] : null
}
