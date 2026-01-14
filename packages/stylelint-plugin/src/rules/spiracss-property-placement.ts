import type { AtRule, Declaration, Node, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { DEFAULT_CACHE_SIZES } from '../utils/cache'
import { NON_SELECTOR_AT_RULE_NAMES } from '../utils/constants'
import {
  CACHE_SIZES_SCHEMA,
  INTERACTION_COMMENT_PATTERN_SCHEMA,
  NAMING_SCHEMA,
  SELECTOR_POLICY_SCHEMA,
  SHARED_COMMENT_PATTERN_SCHEMA
} from '../utils/option-schema'
import { isAtRule, isRule } from '../utils/postcss-helpers'
import { isRuleInsideAtRule, markInteractionContainers } from '../utils/section'
import type { SelectorParserCache } from '../utils/selector'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { isNumber, isPlainObject, isString, isStringArray } from '../utils/validate'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import { collectRootBlockNames, findNearestParentRule } from './spiracss-class-structure.selectors'
import { isRootBlockRule } from './spiracss-class-structure.sections'
import type { Options as ClassStructureOptions } from './spiracss-class-structure.types'
import { ruleName } from './spiracss-property-placement.constants'
import { messages } from './spiracss-property-placement.messages'
import { normalizeOptions } from './spiracss-property-placement.options'
import type { Options } from './spiracss-property-placement.types'

export { ruleName }

const meta = {
  url: 'https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint.md#spiracssproperty-placement',
  fixable: false,
  description: 'Enforce SpiraCSS property placement rules (container/item/internal).',
  category: 'stylistic'
}

const optionSchema = {
  allowElementChainDepth: [isNumber],
  allowExternalClasses: [isString],
  allowExternalPrefixes: [isString],
  ...NAMING_SCHEMA,
  ...SHARED_COMMENT_PATTERN_SCHEMA,
  ...INTERACTION_COMMENT_PATTERN_SCHEMA,
  ...SELECTOR_POLICY_SCHEMA,
  ...CACHE_SIZES_SCHEMA
}

const CONTAINER_PROPS = new Set([
  'flex-direction',
  'flex-wrap',
  'gap',
  'row-gap',
  'column-gap',
  'justify-content',
  'justify-items',
  'align-content',
  'align-items'
])

const ITEM_PROPS = new Set([
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-inline',
  'margin-inline-start',
  'margin-inline-end',
  'margin-block',
  'margin-block-start',
  'margin-block-end',
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'order',
  'align-self',
  'justify-self',
  'grid-column',
  'grid-row',
  'grid-area'
])

const DISPLAY_ALLOWED = new Set(['flex', 'inline-flex', 'grid', 'inline-grid'])

const isPaddingProp = (prop: string): boolean =>
  prop === 'padding' || prop.startsWith('padding-')

const isContainerProp = (decl: Declaration): boolean => {
  const prop = decl.prop.toLowerCase()
  if (prop === 'display') {
    const tokens = decl.value
      .trim()
      .toLowerCase()
      .split(/\s+|!/)
      .filter((token) => token.length > 0 && token !== 'important')
    return tokens.some((token) => DISPLAY_ALLOWED.has(token))
  }
  if (prop === 'grid-template' || prop.startsWith('grid-template-')) return true
  if (prop.startsWith('grid-auto-')) return true
  return CONTAINER_PROPS.has(prop)
}

const isItemProp = (prop: string): boolean => ITEM_PROPS.has(prop)

type SelectorKind = 'root' | 'element' | 'child-block' | 'page-root'
type SelectorInfo = {
  kind: SelectorKind
  tailCombinator: '>' | '+' | '~' | null
}

type SelectorNode = ReturnType<SelectorParserCache['parse']>[number]['nodes'][number]
type SegmentNodes = SelectorNode[]
type TagNode = SelectorNode & { type: 'tag'; value: string }
type IdNode = SelectorNode & { type: 'id'; value: string }

type SelectorAnalysis =
  | { status: 'ok'; selectors: SelectorInfo[] }
  | { status: 'skip' }
  | { status: 'error'; message: string }

type PolicySets = {
  dataVariantEnabled: boolean
  dataStateEnabled: boolean
  variantKeys: Set<string>
  stateKey: string
  ariaKeys: Set<string>
  modifiersAllowed: boolean
}

const buildPolicySets = (policy: Options['selectorPolicy']): PolicySets => ({
  dataVariantEnabled: policy.variant.mode === 'data',
  dataStateEnabled: policy.state.mode === 'data',
  variantKeys: new Set(policy.variant.dataKeys.map((key) => key.toLowerCase())),
  stateKey: policy.state.dataKey.toLowerCase(),
  ariaKeys: new Set(policy.state.ariaKeys.map((key) => key.toLowerCase())),
  modifiersAllowed: !(policy.variant.mode === 'data' && policy.state.mode === 'data')
})

const hasGlobalSelector = (selector: string): boolean => selector.includes(':global')

const normalizeCombinator = (value: string): string => value.trim() || ' '

const splitSelectors = (selector: string, cache: SelectorParserCache): string[] => {
  const selectors = cache.parse(selector)
  return selectors.map((sel) => sel.toString()).filter((text) => text.trim().length > 0)
}

const combineSelectors = (parent: string, child: string): string[] => {
  const trimmedChild = child.trim()
  if (!trimmedChild) return []
  if (trimmedChild.includes('&')) {
    return [trimmedChild.replace(/&/g, parent)]
  }
  const startsWithCombinator = /^[>+~]/.test(trimmedChild)
  if (startsWithCombinator) {
    return [`${parent} ${trimmedChild}`.trim()]
  }
  return [`${parent} ${trimmedChild}`.trim()]
}

const resolveSelectors = (
  rule: Rule,
  cache: SelectorParserCache,
  resolvedCache: WeakMap<Rule, string[]>
): string[] => {
  const cached = resolvedCache.get(rule)
  if (cached) return cached
  if (typeof rule.selector !== 'string') {
    resolvedCache.set(rule, [])
    return []
  }
  const current = splitSelectors(rule.selector, cache)
  const parentRule = findNearestParentRule(rule)
  if (!parentRule) {
    resolvedCache.set(rule, current)
    return current
  }
  const parentSelectors = resolveSelectors(parentRule, cache, resolvedCache)
  if (parentSelectors.length === 0 || current.length === 0) {
    resolvedCache.set(rule, [])
    return []
  }
  const combined: string[] = []
  parentSelectors.forEach((parent) => {
    current.forEach((child) => {
      combined.push(...combineSelectors(parent, child))
    })
  })
  resolvedCache.set(rule, combined)
  return combined
}

const isTagNode = (node: SelectorNode): node is TagNode => node.type === 'tag'
const isIdNode = (node: SelectorNode): node is IdNode => node.type === 'id'

const isExternalClass = (name: string, options: Options): boolean =>
  name.startsWith('u-') ||
  options.allowExternalClasses.includes(name) ||
  options.allowExternalPrefixes.some((prefix) => name.startsWith(prefix))

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

const isInsideAtRoot = (node: Node): boolean => {
  let current: Node | undefined = node.parent ?? undefined
  while (current) {
    if (isAtRule(current) && current.name === 'at-root') return true
    current = current.parent ?? undefined
  }
  return false
}

const analyzeSelectorList = (
  selectorList: string[],
  cache: SelectorParserCache,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
): SelectorAnalysis => {
  if (selectorList.length === 0) return { status: 'skip' }
  const trimmedSelectors = selectorList.map((selector) => selector.trim()).filter(Boolean)
  if (trimmedSelectors.length === 0) return { status: 'skip' }

  let hasGlobalSelectorText = false
  let hasPageRootSelector = false
  let hasUnverifiedSelector = false
  let hasKindMismatch = false
  let expectedKind: SelectorKind | null = null
  const selectors: SelectorInfo[] = []

  for (const selectorText of trimmedSelectors) {
    if (!selectorText.trim()) return { status: 'skip' }
    if (hasGlobalSelector(selectorText)) {
      hasGlobalSelectorText = true
      continue
    }
    const parsed = cache.parse(selectorText)
    if (parsed.length !== 1) {
      hasUnverifiedSelector = true
      continue
    }
    const sel = parsed[0]
    const analysis = analyzeSelector(sel, selectorText, options, policy, patterns, classifyOptions)
    if (analysis.status === 'error') return analysis
    if (analysis.status === 'skip') {
      hasUnverifiedSelector = true
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
  }

  if (hasPageRootSelector && trimmedSelectors.length > 1) {
    return { status: 'error', message: messages.pageRootNoChildren(trimmedSelectors.join(', ')) }
  }
  if (hasGlobalSelectorText || hasUnverifiedSelector || hasKindMismatch) {
    return { status: 'skip' }
  }

  return selectors.length === 0 ? { status: 'skip' } : { status: 'ok', selectors }
}

const analyzeSelector = (
  selector: ReturnType<SelectorParserCache['parse']>[number],
  selectorText: string,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
): 
  | { status: 'ok'; selector: SelectorInfo }
  | { status: 'skip' }
  | { status: 'error'; message: string } => {
  // Only evaluate simple chain selectors; complex patterns are treated as unverified.
  const segments: SegmentNodes[] = []
  const combinators: string[] = []
  collectSegments(selector, segments, combinators)

  if (segments.length === 0) return { status: 'skip' }

  const rootCheck = analyzeRootSegment(segments[0], segments.length, combinators.length, selectorText)
  if (rootCheck.status !== 'ok') return rootCheck
  if (rootCheck.kind === 'page-root') {
    return { status: 'ok', selector: { kind: 'page-root', tailCombinator: null } }
  }

  if (combinators.some((combinator) => combinator === ' ')) return { status: 'skip' }
  if (combinators.some((combinator) => !['>', '+', '~'].includes(combinator))) {
    return { status: 'skip' }
  }
  if (combinators.slice(0, -1).some((combinator) => combinator === '+' || combinator === '~')) {
    return { status: 'skip' }
  }

  const segmentKinds: Array<'block' | 'element'> = []
  for (const segment of segments) {
    const kind = analyzeSegmentKind(segment, options, policy, patterns, classifyOptions)
    if (!kind) return { status: 'skip' }
    segmentKinds.push(kind)
  }

  if (segmentKinds[0] !== 'block') return { status: 'skip' }

  const tailCombinator = combinators.length > 0 ? (combinators.at(-1) as '>' | '+' | '~') : null
  if (tailCombinator && (tailCombinator === '+' || tailCombinator === '~')) {
    const lastKind = segmentKinds.at(-1)
    const prevKind = segmentKinds.at(-2)
    if (!lastKind || !prevKind || lastKind !== prevKind) return { status: 'skip' }
  }
  if (
    segmentKinds.length === 2 &&
    segmentKinds[0] === 'block' &&
    segmentKinds[1] === 'block' &&
    (tailCombinator === '+' || tailCombinator === '~')
  ) {
    return { status: 'skip' }
  }

  const allowSiblingBlockTail =
    (tailCombinator === '+' || tailCombinator === '~') &&
    segmentKinds.at(-1) === 'block' &&
    segmentKinds.at(-2) === 'block'
  const childBlockScanEnd = allowSiblingBlockTail ? -2 : -1
  const hasChildBlockBeforeTail = segmentKinds
    .slice(1, childBlockScanEnd)
    .some((kind) => kind === 'block')
  if (hasChildBlockBeforeTail) return { status: 'skip' }

  const hasChildBlockAtTail = segmentKinds.length > 1 && segmentKinds.at(-1) === 'block'
  if (hasChildBlockAtTail) {
    if (tailCombinator === '+'
        || tailCombinator === '~'
        || tailCombinator === '>') {
      // allowed
    } else {
      return { status: 'skip' }
    }
  }

  const maxDepth = calculateElementDepth(segmentKinds, combinators)
  if (maxDepth > options.allowElementChainDepth) return { status: 'skip' }

  if (segmentKinds.length === 1) {
    return { status: 'ok', selector: { kind: 'root', tailCombinator: null } }
  }

  if (hasChildBlockAtTail) {
    return { status: 'ok', selector: { kind: 'child-block', tailCombinator } }
  }

  return { status: 'ok', selector: { kind: 'element', tailCombinator } }
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

const analyzeSegmentKind = (
  segment: SegmentNodes,
  options: Options,
  policy: PolicySets,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
): 'block' | 'element' | null => {
  let baseKind: 'block' | 'element' | null = null
  let baseCount = 0
  let pseudoKind: 'block' | 'element' | null = null
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
      const parsed = analyzePseudoKind(node, options, patterns, classifyOptions)
      if (!parsed) return null
      if (!pseudoKind) {
        pseudoKind = parsed
      } else if (pseudoKind !== parsed) {
        return null
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
      } else if (baseKind !== kind) {
        return null
      }
    }
  }

  if (baseCount > 1) return null
  if (!baseKind && pseudoKind) baseKind = pseudoKind
  if (!baseKind) return null
  if (pseudoKind && baseKind !== pseudoKind) return null
  return baseKind
}

const analyzePseudoKind = (
  pseudo: SelectorNode,
  options: Options,
  patterns: ReturnType<typeof buildPatterns>,
  classifyOptions: ClassStructureOptions
): 'block' | 'element' | null => {
  if (!('nodes' in pseudo) || !Array.isArray(pseudo.nodes)) return null
  const selectorNodes = pseudo.nodes.filter(
    (node): node is ReturnType<SelectorParserCache['parse']>[number] => node.type === 'selector'
  )
  if (selectorNodes.length === 0) return null

  let resolved: 'block' | 'element' | null = null
  for (const sel of selectorNodes) {
    const classes: string[] = []
    let hasInvalid = false
    sel.nodes.forEach((node) => {
      if (node.type === 'comment') return
      if (node.type === 'class') {
        classes.push(node.value)
        return
      }
      hasInvalid = true
    })
    if (hasInvalid || classes.length !== 1) return null
    const className = classes[0]
    if (isExternalClass(className, options)) return null
    const kind = classify(className, classifyOptions, patterns)
    if (kind !== 'block' && kind !== 'element') return null
    if (!resolved) resolved = kind
    if (resolved !== kind) return null
  }

  return resolved
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

const rule = createRule(
  ruleName,
  messages,
  (primaryOption: unknown, secondaryOption: unknown, _context: RuleContext) => {
    if (primaryOption === false) {
      return () => {
        /* rule disabled */
      }
    }

    const rawOptions =
      typeof primaryOption === 'object' && primaryOption !== null
        ? primaryOption
        : secondaryOption

    type RuleCache = {
      options: ReturnType<typeof normalizeOptions>
      patterns: ReturnType<typeof buildPatterns>
      policySets: PolicySets
      classifyOptions: ClassStructureOptions
      hasInvalidOptions: boolean
    }
    let cache: RuleCache | null = null
    const getCache = (
      reportInvalid?: (optionName: string, value: unknown, detail?: string) => void
    ): RuleCache => {
      if (cache) return cache
      let hasInvalidOptions = false
      const handleInvalid = reportInvalid
        ? (optionName: string, value: unknown, detail?: string) => {
            hasInvalidOptions = true
            reportInvalid(optionName, value, detail)
          }
        : undefined
      const options = normalizeOptions(rawOptions, handleInvalid)
      const classifyOptions = {
        allowExternalClasses: options.allowExternalClasses,
        allowExternalPrefixes: options.allowExternalPrefixes,
        naming: options.naming
      } as ClassStructureOptions
      cache = {
        options,
        patterns: buildPatterns(
          classifyOptions,
          options.cacheSizes ?? DEFAULT_CACHE_SIZES,
          handleInvalid
        ),
        policySets: buildPolicySets(options.selectorPolicy),
        classifyOptions,
        hasInvalidOptions
      }
      return cache
    }

    return (root: Root, result: stylelint.PostcssResult) => {
      const shouldValidate = result.stylelint?.config?.validate !== false
      if (shouldValidate) {
        const validOptions = stylelint.utils.validateOptions(
          result,
          ruleName,
          {
            actual: primaryOption,
            possible: [true, isPlainObject]
          },
          {
            actual: secondaryOption,
            possible: isPlainObject,
            optional: true
          },
          {
            actual: rawOptions,
            possible: optionSchema,
            optional: true
          }
        )
        if (!validOptions) return
      }

      const reportInvalid = shouldValidate
        ? (optionName: string, value: unknown, detail?: string) => {
            reportInvalidOption(result, ruleName, optionName, value, detail)
          }
        : undefined

      const hasInvalid = validateOptionsArrayFields(
        rawOptions,
        ['allowExternalClasses', 'allowExternalPrefixes'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const { options, patterns, policySets, classifyOptions, hasInvalidOptions } =
        getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return

      const cacheSizes = options.cacheSizes ?? DEFAULT_CACHE_SIZES
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const resolvedSelectorsCache = new WeakMap<Rule, string[]>()

      const rootBlockRules = new WeakSet<Rule>()
      root.walkRules((rule: Rule) => {
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
        if (findNearestParentRule(rule)) return
        if (!isRootBlockRule(rule)) return
        if (typeof rule.selector !== 'string') return
        if (rule.selector.includes(':global')) return
        const selectors = selectorCache.parse(rule.selector)
        const rootBlocks = collectRootBlockNames(selectors, classifyOptions, patterns)
        if (rootBlocks.length === 0) return
        rootBlockRules.add(rule)
      })

      const commentPatterns = {
        sharedCommentPattern: options.sharedCommentPattern,
        interactionCommentPattern: options.interactionCommentPattern
      }
      const interactionContainers = markInteractionContainers(
        root,
        commentPatterns,
        (_comment, parent) => isRule(parent) && rootBlockRules.has(parent)
      )
      const resolveContextSelector = (rule: Rule | null | undefined): string => {
        if (!rule || typeof rule.selector !== 'string') return '(unknown)'
        const resolved = resolveSelectors(rule, selectorCache, resolvedSelectorsCache)
        if (resolved.length > 0) return resolved.join(', ')
        return rule.selector
      }

      root.walkAtRules((atRule: AtRule) => {
        const name = atRule.name ? atRule.name.toLowerCase() : ''
        if (name === 'extend') {
          const placeholder = atRule.params?.trim() || '%unknown'
          const parentSelector = resolveContextSelector(findNearestParentRule(atRule))
          stylelint.utils.report({
            ruleName,
            result,
            node: atRule,
            message: messages.forbiddenExtend(parentSelector, placeholder)
          })
          return
        }
        if (name === 'at-root') {
          if (interactionContainers.has(atRule)) return
          const parentSelector = resolveContextSelector(findNearestParentRule(atRule))
          stylelint.utils.report({
            ruleName,
            result,
            node: atRule,
            message: messages.forbiddenAtRoot(parentSelector)
          })
        }
      })

      root.walkRules((rule: Rule) => {
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
        if (interactionContainers.has(rule)) return
        if (isInsideAtRoot(rule)) return
        if (typeof rule.selector !== 'string') return

        const resolvedSelectors = resolveSelectors(rule, selectorCache, resolvedSelectorsCache)
        if (resolvedSelectors.length === 0) return

        const analysis = analyzeSelectorList(
          resolvedSelectors,
          selectorCache,
          options,
          policySets,
          patterns,
          classifyOptions
        )
        if (analysis.status === 'skip') return
        if (analysis.status === 'error') {
          stylelint.utils.report({
            ruleName,
            result,
            node: rule,
            message: analysis.message
          })
          return
        }

        const selectorInfos = analysis.selectors
        const resolvedSelector = resolvedSelectors.join(', ')

        rule.walkDecls((decl: Declaration) => {
          if (findNearestParentRule(decl) !== rule) return
          if (isInsideAtRoot(decl)) return
          const prop = decl.prop.toLowerCase()
          if (!prop || prop.startsWith('--')) return

          if (isContainerProp(decl)) {
            const hasPageRoot = selectorInfos.some((info) => info.kind === 'page-root')
            if (hasPageRoot) {
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.pageRootContainer(prop, resolvedSelector)
              })
              return
            }
            const hasChildBlock = selectorInfos.some((info) => info.kind === 'child-block')
            if (!hasChildBlock) return
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: messages.containerInChildBlock(prop, resolvedSelector)
            })
            return
          }

          if (isItemProp(prop)) {
            const hasPageRoot = selectorInfos.some((info) => info.kind === 'page-root')
            if (hasPageRoot) {
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.pageRootItem(prop, resolvedSelector)
              })
              return
            }
            const hasInvalidPlacement = selectorInfos.some((info) => {
              if (info.kind === 'root') return true
              return info.tailCombinator === null
            })
            if (!hasInvalidPlacement) return
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: messages.itemInRoot(prop, resolvedSelector)
            })
            return
          }

          if (isPaddingProp(prop)) {
            const hasPageRoot = selectorInfos.some((info) => info.kind === 'page-root')
            if (hasPageRoot) {
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.pageRootInternal(prop, resolvedSelector)
              })
              return
            }
            const hasChildBlock = selectorInfos.some((info) => info.kind === 'child-block')
            if (!hasChildBlock) return
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: messages.internalInChildBlock(prop, resolvedSelector)
            })
          }
        })
      })
    }
  },
  meta
)

const spiracssPropertyPlacement = createPlugin(ruleName, rule)

export default spiracssPropertyPlacement
