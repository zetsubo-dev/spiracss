import type { AtRule, Declaration, Node, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { NON_SELECTOR_AT_RULE_NAMES, ROOT_WRAPPER_NAMES } from '../utils/constants'
import { selectorParseFailedArgs } from '../utils/messages'
import { normalizeCustomPattern } from '../utils/naming'
import {
  CACHE_SCHEMA,
  COMMENTS_SCHEMA,
  EXTERNAL_SCHEMA,
  NAMING_SCHEMA,
  POLICY_SCHEMA
} from '../utils/option-schema'
import { findParentRule, isAtRule, isRule } from '../utils/postcss-helpers'
import { getRuleDocsUrl } from '../utils/rule-docs'
import { isRuleInsideAtRule, markInteractionContainers } from '../utils/section'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import { getLowercasePolicyKeys } from '../utils/selector-policy'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { isBoolean, isNumber, isPlainObject, isString, isStringArray } from '../utils/validate'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import { isRootBlockRule } from './spiracss-class-structure.sections'
import { collectRootBlockNames } from './spiracss-class-structure.selectors'
import type { ClassifyOptions } from './spiracss-class-structure.types'
import { ruleName } from './spiracss-property-placement.constants'
import { messages } from './spiracss-property-placement.messages'
import { normalizeOptions } from './spiracss-property-placement.options'
import {
  analyzeSelectorList,
  buildPolicySets,
  normalizeScopePrelude,
  normalizeUnverifiedScopePrelude,
  parseMixinName,
  type PolicySets,
  resolveSelectors,
  type SelectorAnalysis,
  type SelectorInfo,
  splitSelectors,
  stripGlobalSelectorForRoot} from './spiracss-property-placement.selectors'
import type { Options } from './spiracss-property-placement.types'
import { createValueTokenHelpers } from './spiracss-property-placement.values'

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Enforce SpiraCSS property placement rules (container/item/internal).',
  category: 'stylistic'
}

const optionSchema = {
  elementDepth: [isNumber],
  marginSide: [isString],
  marginSideTags: [isBoolean],
  position: [isBoolean],
  sizeInternal: [isBoolean],
  responsiveMixins: [isString],
  ...NAMING_SCHEMA,
  ...COMMENTS_SCHEMA,
  ...POLICY_SCHEMA,
  ...EXTERNAL_SCHEMA,
  ...CACHE_SCHEMA
}

const CONTAINER_PROP_NAMES = new Set([
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

const ITEM_PROP_NAMES = new Set([
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

const MARGIN_SIDE_PROP_NAMES = new Set([
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-block',
  'margin-block-start',
  'margin-block-end'
])

const DISPLAY_ALLOWED = new Set(['flex', 'inline-flex', 'grid', 'inline-grid'])

const OVERFLOW_PROP_NAMES = new Set(['overflow', 'overflow-x', 'overflow-y'])

const OFFSET_PROP_NAMES = new Set([
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-block',
  'inset-inline',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end'
])

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
  if (prop === 'grid') return true
  if (prop === 'grid-template' || prop.startsWith('grid-template-')) return true
  if (prop.startsWith('grid-auto-')) return true
  return CONTAINER_PROP_NAMES.has(prop)
}

const isItemProp = (prop: string): boolean => ITEM_PROP_NAMES.has(prop)

const isMarginSideProp = (prop: string): boolean =>
  MARGIN_SIDE_PROP_NAMES.has(prop)

const isOverflowProp = (prop: string): boolean => OVERFLOW_PROP_NAMES.has(prop)

const isSizeInternalProp = (prop: string): boolean =>
  prop === 'width' ||
  prop === 'height' ||
  prop === 'inline-size' ||
  prop === 'block-size' ||
  prop.startsWith('min-') ||
  prop.startsWith('max-')

const isInternalProp = (prop: string, enableSizeInternal: boolean): boolean =>
  isPaddingProp(prop) ||
  isOverflowProp(prop) ||
  (enableSizeInternal && isSizeInternalProp(prop))

const isInsideAtRoot = (node: Node): boolean => {
  let current: Node | undefined = node.parent ?? undefined
  while (current) {
    if (isAtRule(current) && current.name === 'at-root') return true
    current = current.parent ?? undefined
  }
  return false
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
      classifyOptions: ClassifyOptions
      customModifierPattern: RegExp | undefined
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
      const classifyOptions: ClassifyOptions = {
        external: options.external,
        naming: options.naming
      }
      const customModifierPattern = normalizeCustomPattern(
        options.naming?.customPatterns?.modifier,
        'naming.customPatterns.modifier'
      )
      cache = {
        options,
        patterns: buildPatterns(classifyOptions, options.cache, handleInvalid),
        policySets: buildPolicySets(options.selectorPolicy),
        classifyOptions,
        customModifierPattern,
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
        ['external.classes', 'external.prefixes', 'responsiveMixins'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const {
        options,
        patterns,
        policySets,
        classifyOptions,
        customModifierPattern,
        hasInvalidOptions
      } = getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return

      const cacheSizes = options.cache
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const resolvedSelectorsCache = new WeakMap<Rule, string[]>()
      const ruleAnalysisCache = new WeakMap<
        Rule,
        {
          resolvedSelectors: string[]
          analysis: SelectorAnalysis
          resolvedSelectorText: string
        }
      >()
      const ruleFamilyKeysCache = new WeakMap<Rule, string[] | null>()
      const wrapperKeyCache = new WeakMap<Node, string>()
      const atRuleIds = new WeakMap<AtRule, number>()
      let atRuleIdSeed = 0
      let firstRule: Rule | null = null
      const responsiveMixins = new Set(
        options.responsive.mixins.map((name) => name.toLowerCase())
      )
      const { checkMarginSide, parsePositionValue, isZeroMinSize } =
        createValueTokenHelpers()
      const selectorPolicy = options.selectorPolicy
      const variantMode = selectorPolicy.variant.mode
      const stateMode = selectorPolicy.state.mode
      // Display lowercase keys in messages to match actual selector matching behavior.
      const { variantKeys, stateKeys } = getLowercasePolicyKeys(selectorPolicy)
      const naming = options.naming ?? {}
      const modifierPrefix = naming.modifierPrefix ?? '-'
      const modifierCase = naming.modifierCase ?? 'kebab'
      const modifierPattern = customModifierPattern ?? ''

      const getAtRuleId = (atRule: AtRule): number => {
        const cached = atRuleIds.get(atRule)
        if (cached) return cached
        atRuleIdSeed += 1
        atRuleIds.set(atRule, atRuleIdSeed)
        return atRuleIdSeed
      }

      const rootBlockRules = new WeakSet<Rule>()
      const externalRootRules = new WeakSet<Rule>()
      const declsByRule = new Map<Rule, Declaration[]>()

      const isExternalRootSelectors = (
        selectors: ReturnType<typeof selectorCache.parse>
      ): boolean => {
        if (selectors.length === 0) return false
        return selectors.every((sel) => {
          let hasClass = false
          let hasExternal = false
          let hasNonExternal = false
          let invalid = false
          sel.walk((node) => {
            if (invalid) return
            if (node.type === 'comment') return
            if (node.type === 'combinator') return
            if (node.type === 'class') {
              hasClass = true
              const kind = classify(node.value, classifyOptions, patterns)
              if (kind === 'external') {
                hasExternal = true
                return
              }
              hasNonExternal = true
              return
            }
            invalid = true
          })
          if (invalid) return false
          if (!hasClass) return false
          if (hasNonExternal) return false
          return hasExternal
        })
      }

      root.walk((node) => {
        if (node.type === 'rule') {
          const rule = node as Rule
          if (!firstRule) firstRule = rule
          if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
          if (findParentRule(rule)) return
          if (!isRootBlockRule(rule)) return
          if (typeof rule.selector !== 'string') return
          const selectorTexts = splitSelectors(rule.selector, selectorCache)
          // Root block detection strips :global parts while preserving leading combinators.
          const localSelectors = selectorTexts
            .map((selector) =>
              stripGlobalSelectorForRoot(
                selector,
                selectorCache,
                options.cache.selector,
                {
                  preserveCombinator: true
                }
              )
            )
            .filter((selector): selector is string => Boolean(selector))
          if (localSelectors.length === 0) return
          const selectors = localSelectors.flatMap((selector) =>
            selectorCache.parse(selector)
          )
          const rootBlocks = collectRootBlockNames(selectors, classifyOptions, patterns)
          if (rootBlocks.length > 0) {
            rootBlockRules.add(rule)
            return
          }
          if (isExternalRootSelectors(selectors)) {
            externalRootRules.add(rule)
          }
          return
        }
        if (node.type === 'decl') {
          const decl = node as Declaration
          const parentRule = findParentRule(decl)
          if (!parentRule) return
          const bucket = declsByRule.get(parentRule)
          if (bucket) {
            bucket.push(decl)
          } else {
            declsByRule.set(parentRule, [decl])
          }
          return
        }
      })

      const commentPatterns = {
        sharedCommentPattern: options.comments.shared,
        interactionCommentPattern: options.comments.interaction
      }
      const interactionContainers = markInteractionContainers(
        root,
        commentPatterns,
        (_comment, parent) =>
          isRule(parent) && (rootBlockRules.has(parent) || externalRootRules.has(parent))
      )
      const selectorExplosion = { example: null as string | null, limit: 0 }
      const reportSelectorExplosion = (selector: string, limit: number): void => {
        if (!selectorExplosion.example) selectorExplosion.example = selector
        selectorExplosion.limit = limit
      }
      const getResolvedSelectors = (rule: Rule): string[] =>
        resolveSelectors(
          rule,
          selectorCache,
          resolvedSelectorsCache,
          reportSelectorExplosion
        )
      const resolveContextSelector = (rule: Rule | null | undefined): string => {
        if (!rule || typeof rule.selector !== 'string') return '(unknown)'
        const resolved = getResolvedSelectors(rule)
        if (resolved.length > 0) return resolved.join(', ')
        return rule.selector
      }

      const getRuleAnalysis = (
        rule: Rule
      ): {
        resolvedSelectors: string[]
        analysis: SelectorAnalysis
        resolvedSelectorText: string
      } => {
        const cached = ruleAnalysisCache.get(rule)
        if (cached) return cached
        const resolvedSelectors = getResolvedSelectors(rule)
        const analysis: SelectorAnalysis =
          resolvedSelectors.length === 0
            ? { status: 'skip' }
            : analyzeSelectorList(
                resolvedSelectors,
                selectorCache,
                options,
                policySets,
                patterns,
                classifyOptions
              )
        const entry = {
          resolvedSelectors,
          analysis,
          resolvedSelectorText: resolvedSelectors.join(', ')
        }
        ruleAnalysisCache.set(rule, entry)
        return entry
      }

      const getRuleFamilyKeys = (rule: Rule): string[] | null => {
        if (ruleFamilyKeysCache.has(rule)) {
          return ruleFamilyKeysCache.get(rule) ?? null
        }
        const { analysis } = getRuleAnalysis(rule)
        if (analysis.status !== 'ok') {
          ruleFamilyKeysCache.set(rule, null)
          return null
        }
        const keys = analysis.familyKeys
        if (keys.length === 0) {
          ruleFamilyKeysCache.set(rule, null)
          return null
        }
        ruleFamilyKeysCache.set(rule, keys)
        return keys
      }

      const getWrapperContextKey = (node: Node): string => {
        const cached = wrapperKeyCache.get(node)
        if (cached) return cached
        const parts: string[] = []
        let current: Node | undefined = node.parent ?? undefined
        while (current) {
          if (isAtRule(current)) {
            const name = current.name ? current.name.toLowerCase() : ''
            if (name === 'scope') {
              const params = typeof current.params === 'string' ? current.params : ''
              const normalized = normalizeScopePrelude(params)
              if (normalized) {
                parts.push(`scope:${normalized}`)
              } else {
                const fallback = normalizeUnverifiedScopePrelude(params)
                parts.push(`scope:unverified:${fallback ?? getAtRuleId(current)}`)
              }
            } else if (ROOT_WRAPPER_NAMES.has(name)) {
              // allowed wrapper
            } else if (name === 'include') {
              const params = typeof current.params === 'string' ? current.params : ''
              const mixinName = parseMixinName(params)
              const allowlisted = mixinName
                ? responsiveMixins.has(mixinName.toLowerCase())
                : false
              if (!allowlisted) {
                parts.push(`include:${getAtRuleId(current)}`)
              }
            } else {
              const keyName = name || 'unknown'
              parts.push(`atrule:${keyName}:${getAtRuleId(current)}`)
            }
          }
          current = current.parent ?? undefined
        }
        let key = 'ctx:root'
        if (parts.length > 0) {
          let context = ''
          for (let i = parts.length - 1; i >= 0; i -= 1) {
            context += `${context ? '|' : ''}${parts[i]}`
          }
          key = `ctx:${context}`
        }
        wrapperKeyCache.set(node, key)
        return key
      }

      const shouldCheckMarginSideForTagSelectors = (
        resolvedSelectors: string[]
      ): boolean => {
        const localSelectors = resolvedSelectors.flatMap((selectorText) =>
          splitSelectors(selectorText, selectorCache)
            .map((selector) =>
              stripGlobalSelectorForRoot(
                selector,
                selectorCache,
                options.cache.selector
              )
            )
            .filter((selector): selector is string => Boolean(selector))
        )
        if (localSelectors.length === 0) return false
        return localSelectors.some((selectorText) => {
          const parsed = selectorCache.parse(selectorText)
          if (parsed.length === 0) return false
          return parsed.some((selector) => {
            let hasTag = false
            selector.walk((node) => {
              if (node.type === 'tag') hasTag = true
            })
            return hasTag
          })
        })
      }

      const familyOffsetMap = new Map<string, boolean>()
      if (options.position) {
        for (const [rule, decls] of declsByRule) {
          if (interactionContainers.has(rule)) continue
          if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) continue
          const familyKeys = getRuleFamilyKeys(rule)
          if (!familyKeys) continue
          const ruleWrapperKey = getWrapperContextKey(rule)
          for (const decl of decls) {
            if (isInsideAtRoot(decl)) continue
            const prop = decl.prop.toLowerCase()
            if (!OFFSET_PROP_NAMES.has(prop)) continue
            const wrapperKey =
              decl.parent === rule ? ruleWrapperKey : getWrapperContextKey(decl)
            familyKeys.forEach((key) => {
              familyOffsetMap.set(`${wrapperKey}::${key}`, true)
            })
          }
        }
      }

      root.walkAtRules((atRule: AtRule) => {
        const name = atRule.name ? atRule.name.toLowerCase() : ''
        const parentRule = findParentRule(atRule)
        if (name === 'extend') {
          const placeholder = atRule.params?.trim() || '%unknown'
          const parentSelector = resolveContextSelector(parentRule)
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
          const parentSelector = resolveContextSelector(parentRule)
          stylelint.utils.report({
            ruleName,
            result,
            node: atRule,
            message: messages.forbiddenAtRoot(
              parentSelector,
              options.comments.interaction
            )
          })
        }
      })

      for (const [rule, decls] of declsByRule) {
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) continue
        if (interactionContainers.has(rule)) continue
        if (isInsideAtRoot(rule)) continue
        if (typeof rule.selector !== 'string') continue

        const { resolvedSelectors, analysis, resolvedSelectorText } = getRuleAnalysis(rule)
        const checkTagMarginSideOnly =
          analysis.status === 'skip' &&
          options.margin.tags &&
          shouldCheckMarginSideForTagSelectors(resolvedSelectors)
        if (analysis.status === 'skip' && !checkTagMarginSideOnly) continue
        if (analysis.status === 'error') {
          stylelint.utils.report({
            ruleName,
            result,
            node: rule,
            message: analysis.message
          })
          continue
        }

        const selectorInfos = analysis.status === 'ok' ? analysis.selectors : []
        const resolvedSelector = resolvedSelectorText

        const ruleWrapperKey = getWrapperContextKey(rule)
        decls.forEach((decl) => {
          if (isInsideAtRoot(decl)) return
          const prop = decl.prop.toLowerCase()
          if (!prop || prop.startsWith('--')) return

          if (isContainerProp(decl)) {
            if (analysis.status !== 'ok') return
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
            if (analysis.status === 'ok') {
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
              if (hasInvalidPlacement) {
                stylelint.utils.report({
                  ruleName,
                  result,
                  node: decl,
                  message: messages.itemInRoot(prop, resolvedSelector)
                })
                return
              }
            }
            if (isMarginSideProp(prop)) {
              const marginSideResult = checkMarginSide(prop, decl.value, options.margin.side)
              if (marginSideResult === 'error') {
                const disallowedSide = options.margin.side === 'top' ? 'bottom' : 'top'
                stylelint.utils.report({
                  ruleName,
                  result,
                  node: decl,
                  message: messages.marginSideViolation(prop, resolvedSelector, disallowedSide)
                })
              }
            }
            return
          }

          if (isInternalProp(prop, options.size.internal)) {
            if (analysis.status !== 'ok') return
            // Allow min-* = 0 everywhere (self/item exception) before internal checks.
            if (options.size.internal && isZeroMinSize(prop, decl.value)) return
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
              message: messages.internalInChildBlock(
                prop,
                resolvedSelector,
                variantMode,
                variantKeys,
                stateMode,
                stateKeys,
                modifierPrefix,
                modifierCase,
                modifierPattern
              )
            })
            return
          }

          if (options.position && prop === 'position') {
            if (analysis.status !== 'ok') return
            const hasChildBlock = selectorInfos.some((info) => info.kind === 'child-block')
            if (!hasChildBlock) return
            const parsedPosition = parsePositionValue(decl.value)
            if (parsedPosition.status === 'skip') return
            if (parsedPosition.status === 'unknown') {
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.positionInChildBlock(
                  parsedPosition.value,
                  resolvedSelector,
                  options.responsive.mixins,
                  parsedPosition.reason
                )
              })
              return
            }
            if (parsedPosition.value === 'static') return
            if (parsedPosition.value === 'fixed' || parsedPosition.value === 'sticky') {
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.positionInChildBlock(
                  parsedPosition.value,
                  resolvedSelector,
                  options.responsive.mixins
                )
              })
              return
            }
            if (parsedPosition.value === 'relative' || parsedPosition.value === 'absolute') {
              if (analysis.hasUnverifiedFamilyKeys) {
                stylelint.utils.report({
                  ruleName,
                  result,
                  node: decl,
                  message: messages.positionInChildBlock(
                    parsedPosition.value,
                    resolvedSelector,
                    options.responsive.mixins
                  )
                })
                return
              }
              const familyKeys = getRuleFamilyKeys(rule)
              if (!familyKeys) return
              const wrapperKey =
                decl.parent === rule ? ruleWrapperKey : getWrapperContextKey(decl)
              // Require offsets for every selector in a list to avoid partial matches.
              const hasOffsets = familyKeys.every((key) =>
                familyOffsetMap.has(`${wrapperKey}::${key}`)
              )
              if (hasOffsets) return
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.positionInChildBlock(
                  parsedPosition.value,
                  resolvedSelector,
                  options.responsive.mixins
                )
              })
            }
          }
        })
      }

      if (selectorState.hasError()) {
        const targetNode = firstRule || root
        stylelint.utils.report({
          ruleName,
          result,
          node: targetNode,
          message: messages.selectorParseFailed(
            ...selectorParseFailedArgs(selectorState.getErrorSelector())
          ),
          severity: 'warning'
        })
      }
      if (selectorExplosion.example) {
        const targetNode = firstRule || root
        stylelint.utils.report({
          ruleName,
          result,
          node: targetNode,
          message: messages.selectorResolutionSkipped(
            selectorExplosion.limit,
            selectorExplosion.example
          ),
          severity: 'warning'
        })
      }
    }
  },
  meta
)

const spiracssPropertyPlacement = createPlugin(ruleName, rule)

export default spiracssPropertyPlacement
