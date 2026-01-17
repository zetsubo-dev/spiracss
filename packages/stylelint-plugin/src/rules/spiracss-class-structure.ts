import path from 'path'
import type { Comment, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { NON_SELECTOR_AT_RULE_NAMES } from '../utils/constants'
import { formatFileBase } from '../utils/formatting'
import { selectorParseFailedArgs } from '../utils/messages'
import {
  CACHE_SIZES_SCHEMA,
  INTERACTION_COMMENT_PATTERN_SCHEMA,
  NAMING_SCHEMA,
  SELECTOR_POLICY_SCHEMA,
  SHARED_COMMENT_PATTERN_SCHEMA
} from '../utils/option-schema'
import { findParentRule, isRule } from '../utils/postcss-helpers'
import { getCommentText, isRuleInsideAtRule, safeTestPattern } from '../utils/section'
import {
  createSelectorCacheWithErrorFlag,
  type SelectorParserCache
} from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import {
  isBoolean,
  isNumber,
  isPlainObject,
  isString,
  isStringArray
} from '../utils/validate'
import { ruleName } from './spiracss-class-structure.constants'
import { messages } from './spiracss-class-structure.messages'
import { normalizeOptions } from './spiracss-class-structure.options'
import {
  buildPatterns,
  buildSelectorPolicyData,
  formatNamingHint
} from './spiracss-class-structure.patterns'
import {
  isRootBlockRule,
  markInteractionRules,
  markSharedRules
} from './spiracss-class-structure.sections'
import {
  analyzeRootSelector,
  collectRootBlockNames,
  hasSegmentSequence,
  hasValidSpiraClass,
  mergeRuleKinds,
  processSelector
} from './spiracss-class-structure.selectors'
import {
  splitSelectors,
  stripGlobalSelectorForRoot
} from './spiracss-property-placement.selectors'
import type { Kind } from './spiracss-class-structure.types'

export { ruleName }

// SpiraCSS "core structure" rule.
// Validates class naming, Block/Element/Modifier structure, child selectors, and shared sections.

const meta = {
  url: 'https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint.md#spiracssclass-structure',
  fixable: false,
  description: 'Enforce SpiraCSS class structure and naming rules.',
  category: 'stylistic'
}

const optionSchema = {
  allowElementChainDepth: [isNumber],
  allowExternalClasses: [isString],
  allowExternalPrefixes: [isString],
  enforceChildCombinator: [isBoolean],
  enforceSingleRootBlock: [isBoolean],
  enforceRootFileName: [isBoolean],
  rootFileCase: ['preserve', 'kebab', 'snake', 'camel', 'pascal'],
  childScssDir: [isString],
  componentsDirs: [isString],
  ...NAMING_SCHEMA,
  ...SHARED_COMMENT_PATTERN_SCHEMA,
  ...INTERACTION_COMMENT_PATTERN_SCHEMA,
  ...SELECTOR_POLICY_SCHEMA,
  ...CACHE_SIZES_SCHEMA
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
      commentPatterns: { sharedCommentPattern: RegExp; interactionCommentPattern: RegExp }
      patterns: ReturnType<typeof buildPatterns>
      policyData: ReturnType<typeof buildSelectorPolicyData>
      namingHint: string
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
      const cacheSizes = options.cacheSizes
      cache = {
        options,
        commentPatterns: {
          sharedCommentPattern: options.sharedCommentPattern,
          interactionCommentPattern: options.interactionCommentPattern
        },
        patterns: buildPatterns(options, cacheSizes, handleInvalid),
        policyData: buildSelectorPolicyData(options.selectorPolicy),
        namingHint: formatNamingHint(options),
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
        ['allowExternalClasses', 'allowExternalPrefixes', 'componentsDirs'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const {
        options,
        commentPatterns,
        patterns,
        policyData,
        namingHint,
        hasInvalidOptions
      } = getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return

      const cacheSizes = options.cacheSizes
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const ruleKinds = new WeakMap<Rule, Kind>()
      const elementDepths = new WeakMap<Rule, number>()
      const blockDepths = new WeakMap<Rule, number>()
      const rootBlockRules = new WeakSet<Rule>()
      let firstRule: Rule | null = null
      let rootBlockName: string | null = null
      let hasSpiraClassForRootCheck = false
      const topLevelRules: Rule[] = []
      const filePath: string = (result?.opts?.from as string) || ''
      const normalizedPath = filePath ? path.normalize(filePath) : ''
      const pathSegments = normalizedPath ? normalizedPath.split(path.sep).filter(Boolean) : []
      const fileName = filePath ? path.basename(filePath) : ''
      const fileBase = fileName && fileName.endsWith('.scss') ? path.basename(fileName, '.scss') : ''

      const parseStrippedSelectors = (
        selectorText: string
      ): ReturnType<SelectorParserCache['parse']> => {
        const selectorTexts = splitSelectors(selectorText, selectorCache)
        const localSelectors = selectorTexts
          .map((selector) =>
            stripGlobalSelectorForRoot(
              selector,
              selectorCache,
              cacheSizes.selector,
              { preserveCombinator: true }
            )
          )
          .filter((selector): selector is string => Boolean(selector))
        // Preserve leading combinators so relative selectors (e.g. :global(...) > .block)
        // do not count as root Block definitions.
        return localSelectors.flatMap((selector) =>
          selectorCache.parse(selector)
        )
      }

      const allRules: Rule[] = []
      root.walkRules((rule: Rule) => {
        allRules.push(rule)
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
        if (!firstRule) firstRule = rule
        if (findParentRule(rule)) return
        topLevelRules.push(rule)
        if (typeof rule.selector !== 'string') return

        const selectors = parseStrippedSelectors(rule.selector)
        if (selectors.length === 0) return
        const rootBlocks = collectRootBlockNames(selectors, options, patterns)
        if (rootBlocks.length === 0) return
        if (isRootBlockRule(rule)) rootBlockRules.add(rule)
        const rootName = rootBlockName || rootBlocks[0]
        if (!rootBlockName) rootBlockName = rootName
        if (options.enforceSingleRootBlock) {
          const extras = rootBlocks.filter((name) => name !== rootName)
          if (extras.length > 0) {
            stylelint.utils.report({
              ruleName,
              result,
              node: rule,
              message: messages.multipleRootBlocks(rootName, extras)
            })
          }
        }
      })

      const sharedRules = markSharedRules(root, commentPatterns, rootBlockRules)
      const interactionRules = markInteractionRules(root, commentPatterns, rootBlockRules)

      allRules.forEach((rule: Rule) => {
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
        const parentRule = findParentRule(rule)
        const parentKind = parentRule ? ruleKinds.get(parentRule) : undefined
        const parentSelector =
          parentRule && typeof parentRule.selector === 'string' ? parentRule.selector : undefined
        const parentDepth = parentRule ? elementDepths.get(parentRule) || 0 : 0
        const parentBlockDepth = parentRule ? blockDepths.get(parentRule) || 0 : 0

        if (typeof rule.selector !== 'string') return

        const isShared = sharedRules.has(rule)
        const isInteraction = interactionRules.has(rule)
        const selectors = parseStrippedSelectors(rule.selector)
        if (selectors.length === 0) return
        if (!hasSpiraClassForRootCheck && hasValidSpiraClass(selectors, options, patterns)) {
          hasSpiraClassForRootCheck = true
        }
        const reported = new Set<string>()

        const report = (message: string) => {
          if (reported.has(message)) return
          reported.add(message)
          stylelint.utils.report({
            ruleName,
            result,
            node: rule,
            message
          })
        }

        const structuralKinds: Kind[] = []
        selectors.forEach((sel) => {
          const structuralKind = processSelector(sel, {
            parentKind,
            parentSelector,
            parentDepth,
            parentBlockDepth,
            report,
            options,
            patterns,
            policyData,
            namingHint,
            isShared,
            isInteraction
          })
          if (structuralKind) structuralKinds.push(structuralKind)
        })

        const ruleKind = mergeRuleKinds(structuralKinds)
        if (ruleKind) {
          ruleKinds.set(rule, ruleKind)
          const depth =
            ruleKind === 'element'
              ? parentKind === 'element'
                ? parentDepth + 1
                : 1
              : 0
          elementDepths.set(rule, depth)
          if (ruleKind === 'block') {
            const blockDepth = parentKind === 'block' ? parentBlockDepth + 1 : 0
            blockDepths.set(rule, blockDepth)
          }
        }
      })

      if (options.enforceSingleRootBlock && !rootBlockName && hasSpiraClassForRootCheck) {
        const targetNode = firstRule || root
        stylelint.utils.report({
          ruleName,
          result,
          node: targetNode,
          message: messages.missingRootBlock()
        })
      }

      root.walkComments((comment: Comment) => {
        const text = getCommentText(comment)
        if (!safeTestPattern(options.sharedCommentPattern, text)) return
        const parent = comment.parent
        const isRootShared = Boolean(parent && isRule(parent) && rootBlockRules.has(parent))
        if (isRootShared) return
        stylelint.utils.report({
          ruleName,
          result,
          node: comment,
          message: messages.sharedNeedRootBlock(
            options.sharedCommentPattern
          )
        })
      })

      if (options.enforceSingleRootBlock && rootBlockName) {
        const resolvedRootBlockName = rootBlockName
        topLevelRules.forEach((rule) => {
          if (typeof rule.selector !== 'string') return

          const selectors = parseStrippedSelectors(rule.selector)
          if (selectors.length === 0) return
          selectors.forEach((sel) => {
            const { hasSpiraClass, hasRootBlock, hasOtherBlock } = analyzeRootSelector(
              sel,
              resolvedRootBlockName,
              options,
              patterns
            )
            if (!hasSpiraClass || hasRootBlock || hasOtherBlock) return
            stylelint.utils.report({
              ruleName,
              result,
              node: rule,
              message: messages.rootSelectorMissingBlock(
                resolvedRootBlockName,
                sel.toString().trim()
              )
            })
          })
        })
      }

      if (options.enforceRootFileName && rootBlockName && fileBase) {
        const isComponentsLayer = options.componentsDirs.some((dir) => {
          const normalizedDir = path.normalize(dir)
          const dirSegments = normalizedDir.split(path.sep).filter(Boolean)
          if (dirSegments.length === 0) return false
          if (dirSegments.length === 1) return pathSegments.includes(dirSegments[0])
          return hasSegmentSequence(pathSegments, dirSegments)
        })
        const assetsIndex = pathSegments.indexOf('assets')
        const isAssetsCss = assetsIndex >= 0 && pathSegments[assetsIndex + 1] === 'css'
        const isExcludedFile = fileName === 'index.scss' || fileName.startsWith('_')
        const isChildScss = pathSegments.includes(options.childScssDir)

        if (isComponentsLayer && !isAssetsCss && !isExcludedFile) {
          const expectedBase = isChildScss
            ? rootBlockName
            : formatFileBase(rootBlockName, options.rootFileCase)
          if (expectedBase && expectedBase !== fileBase) {
            const targetNode = firstRule || root
            stylelint.utils.report({
              ruleName,
              result,
              node: targetNode,
              message: messages.fileNameMismatch(rootBlockName, expectedBase, fileBase)
            })
          }
        }
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
    }
  },
  meta
)

const spiracssClassStructure = createPlugin(ruleName, rule)

export default spiracssClassStructure
