import type { Rule } from 'postcss'

import {
  type SelectorPolicySetsBase,
  buildSelectorPolicySetsBase
} from '../utils/selector-policy'
import type { SelectorParserCache } from '../utils/selector'
import { findParentRule } from '../utils/postcss-helpers'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import type { Options as ClassStructureOptions } from './spiracss-class-structure.types'
import type { Options } from './spiracss-property-placement.types'
import { messages } from './spiracss-property-placement.messages'

type SelectorNode = ReturnType<SelectorParserCache['parse']>[number]['nodes'][number]
type SegmentNodes = SelectorNode[]
type TagNode = SelectorNode & { type: 'tag'; value: string }
type IdNode = SelectorNode & { type: 'id'; value: string }

type SelectorKind = 'root' | 'element' | 'child-block' | 'page-root'

export type SelectorInfo = {
  kind: SelectorKind
  tailCombinator: '>' | '+' | '~' | null
}

export type SelectorAnalysis =
  | { status: 'ok'; selectors: SelectorInfo[]; familyKeys: string[] }
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
    classSet: new Set(options.allowExternalClasses),
    prefixes: [...options.allowExternalPrefixes]
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

const normalizeStrippedSelector = (selectorText: string): string | null => {
  const normalized = selectorText.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  if (/^[>+~]/.test(normalized)) return null
  if (/[>+~]$/.test(normalized)) return null
  return normalized
}

export const stripGlobalSelector = (
  selectorText: string,
  cache: SelectorParserCache
): string | null => {
  const selectors = cache.parse(selectorText)
  if (selectors.length === 0) return null
  const stripped: string[] = []
  selectors.forEach((sel) => {
    const cloned = sel.clone()
    cloned.walkPseudos((pseudo) => {
      const value = typeof pseudo.value === 'string' ? pseudo.value.toLowerCase() : ''
      if (value === ':global') {
        pseudo.remove()
      }
    })
    const normalized = normalizeStrippedSelector(cloned.toString())
    if (normalized) stripped.push(normalized)
  })
  if (stripped.length === 0) return null
  return stripped.join(', ')
}

export const splitSelectors = (
  selector: string,
  cache: SelectorParserCache
): string[] => {
  const selectors = cache.parse(selector)
  return selectors.map((sel) => sel.toString().trim()).filter((text) => text.length > 0)
}

const combineSelectors = (parent: string, child: string): string[] => {
  const trimmedChild = child.trim()
  if (!trimmedChild) return []
  if (trimmedChild.includes('&')) {
    return [trimmedChild.replace(/&/g, parent)]
  }
  return [`${parent} ${trimmedChild}`.trim()]
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
        combined.push(...combineSelectors(parent, child))
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
  classifyOptions: ClassStructureOptions
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
  classifyOptions: ClassStructureOptions,
  mode: 'kind' | 'base'
): SegmentKindInfo | SegmentBase | null => {
  let baseKind: 'block' | 'element' | null = null
  let baseClass: string | null = null
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
      if (![':is', ':where', ':not'].includes(pseudoValue)) return null
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
      baseCount += 1
      if (!baseKind) {
        baseKind = kind
        baseClass = className
      } else if (baseKind !== kind) {
        return null
      } else if (mode === 'base') {
        return null
      }
    }
  }

  // For kind-only mode, multiple base classes of the same kind are still invalid.
  if (baseCount > 1) return null
  if (!baseKind || !baseClass) return null
  if (pseudoKind && baseKind !== pseudoKind) return null
  if (mode === 'base') {
    if (pseudoClass && baseClass !== pseudoClass) return null
    return { kind: baseKind, baseClass }
  }
  return { kind: baseKind }
}

const analyzeSegmentKind = (
  segment: SegmentNodes,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
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
  classifyOptions: ClassStructureOptions
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
  classifyOptions: ClassStructureOptions
): SelectorAnalysis => {
  if (selectorList.length === 0) return { status: 'skip' }
  const normalizedSelectors = selectorList.filter((selector) => selector.length > 0)
  if (normalizedSelectors.length === 0) return { status: 'skip' }
  const strippedSelectors = normalizedSelectors
    .map((selector) => stripGlobalSelector(selector, cache))
    .filter((selector): selector is string => Boolean(selector))
  if (strippedSelectors.length === 0) return { status: 'skip' }

  let hasPageRootSelector = false
  let hasKindMismatch = false
  let expectedKind: SelectorKind | null = null
  const selectors: SelectorInfo[] = []
  const familyKeys: string[] = []

  for (const selectorText of strippedSelectors) {
    const analysis = analyzeSelector(
      selectorText,
      cache,
      options,
      policy,
      patterns,
      classifyOptions
    )
    if (analysis.status === 'error') return analysis
    if (analysis.status === 'skip') {
      continue
    }
    if (analysis.selector.kind === 'page-root') {
      hasPageRootSelector = true
    }
    if (expectedKind && expectedKind !== analysis.selector.kind) {
      hasKindMismatch = true
    } else {
      expectedKind = analysis.selector.kind
    }
    selectors.push(analysis.selector)
    const familyKey = buildSelectorFamilyKey(
      selectorText,
      cache,
      options,
      policy,
      patterns,
      classifyOptions
    )
    if (familyKey) familyKeys.push(familyKey)
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
    : { status: 'ok', selectors, familyKeys: [...new Set(familyKeys)] }
}

const analyzeSelector = (
  selectorText: string,
  cache: SelectorParserCache,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
):
  | { status: 'ok'; selector: SelectorInfo }
  | { status: 'skip' }
  | { status: 'error'; message: string } => {
  // Only evaluate simple chain selectors; complex patterns are treated as unverified.
  const parsed = parseSelectorSegments(selectorText, cache)
  if (!parsed) return { status: 'skip' }
  const { segments, combinators, rootCheck } = parsed
  if (rootCheck.status !== 'ok') return rootCheck
  if (rootCheck.kind === 'page-root') {
    return { status: 'ok', selector: { kind: 'page-root', tailCombinator: null } }
  }

  const chain = buildSelectorChain(
    segments,
    combinators,
    (segment) => {
      const kind = analyzeSegmentKind(segment, options, policy, patterns, classifyOptions)
      return kind ? { kind } : null
    },
    options.allowElementChainDepth
  )
  if (!chain) return { status: 'skip' }

  if (chain.segmentKinds.length === 1) {
    return { status: 'ok', selector: { kind: 'root', tailCombinator: null } }
  }

  if (chain.hasChildBlockAtTail) {
    return {
      status: 'ok',
      selector: { kind: 'child-block', tailCombinator: chain.tailCombinator }
    }
  }

  return {
    status: 'ok',
    selector: { kind: 'element', tailCombinator: chain.tailCombinator }
  }
}

export const buildSelectorFamilyKey = (
  selectorText: string,
  cache: SelectorParserCache,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
): string | null => {
  const parsed = parseSelectorSegments(selectorText, cache)
  if (!parsed) return null
  const { segments, combinators, rootCheck } = parsed
  if (rootCheck.status !== 'ok' || rootCheck.kind === 'page-root') return null
  const chain = buildSelectorChain<SegmentBase>(
    segments,
    combinators,
    (segment) => analyzeSegmentBase(segment, options, policy, patterns, classifyOptions),
    options.allowElementChainDepth
  )
  if (!chain) return null

  let key = chain.segmentInfos[0].baseClass
  for (let i = 1; i < chain.segmentInfos.length; i += 1) {
    key += `${chain.combinators[i - 1]}${chain.segmentInfos[i].baseClass}`
  }

  return key
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
