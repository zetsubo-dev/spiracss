import path from 'path'
import type { Comment, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { NON_SELECTOR_AT_RULE_NAMES, ROOT_WRAPPER_NAMES } from '../utils/constants'
import { formatFileBase } from '../utils/formatting'
import { selectorParseFailedArgs } from '../utils/messages'
import {
  CACHE_SCHEMA,
  COMMENTS_SCHEMA,
  EXTERNAL_SCHEMA,
  NAMING_SCHEMA,
  POLICY_SCHEMA
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
import { getRuleDocsUrl } from '../utils/rule-docs'
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
  isGlobalOnlySelector,
  stripGlobalSelectorForRoot
} from './spiracss-property-placement.selectors'
import type { Kind } from './spiracss-class-structure.types'

export { ruleName }

// SpiraCSS "core structure" rule.
// Validates class naming, Block/Element/Modifier structure, child selectors, and shared sections.

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Enforce SpiraCSS class structure and naming rules.',
  category: 'stylistic'
}

const optionSchema = {
  elementDepth: [isNumber],
  childCombinator: [isBoolean],
  childNesting: [isBoolean],
  rootSingle: [isBoolean],
  rootFile: [isBoolean],
  rootCase: [isString],
  childDir: [isString],
  componentsDirs: [isString],
  ...NAMING_SCHEMA,
  ...COMMENTS_SCHEMA,
  ...POLICY_SCHEMA,
  ...EXTERNAL_SCHEMA,
  ...CACHE_SCHEMA
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
      const cacheSizes = options.cache
      cache = {
        options,
        commentPatterns: {
          sharedCommentPattern: options.comments.shared,
          interactionCommentPattern: options.comments.interaction
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
        ['external.classes', 'external.prefixes', 'componentsDirs'],
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

      const cacheSizes = options.cache
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

      const isGlobalWrapperRule = (rule: Rule): boolean => {
        if (typeof rule.selector !== 'string') return false
        return isGlobalOnlySelector(
          rule.selector,
          selectorCache,
          cacheSizes.selector
        )
      }

      const findParentRuleSkippingGlobal = (rule: Rule): Rule | null => {
        let current = findParentRule(rule)
        while (current && isGlobalWrapperRule(current)) {
          current = findParentRule(current)
        }
        return current
      }

      const isRuleInRootScopeWithGlobal = (rule: Rule): boolean => {
        let current = rule.parent
        while (current) {
          if (current.type === 'root') return true
          if (current.type === 'atrule') {
            const name = current.name ? current.name.toLowerCase() : ''
            if (!ROOT_WRAPPER_NAMES.has(name)) return false
            current = current.parent
            continue
          }
          if (current.type === 'rule') {
            const parentRule = current as Rule
            if (isGlobalWrapperRule(parentRule)) {
              current = parentRule.parent
              continue
            }
            return false
          }
          return false
        }
        return false
      }

      const allRules: Rule[] = []
      root.walkRules((rule: Rule) => {
        allRules.push(rule)
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
        if (!firstRule) firstRule = rule
        if (findParentRuleSkippingGlobal(rule)) return
        topLevelRules.push(rule)
        if (typeof rule.selector !== 'string') return

        const selectors = parseStrippedSelectors(rule.selector)
        if (selectors.length === 0) return
        const rootBlocks = collectRootBlockNames(selectors, options, patterns)
        if (rootBlocks.length === 0) return
        if (isRuleInRootScopeWithGlobal(rule)) rootBlockRules.add(rule)
        const rootName = rootBlockName || rootBlocks[0]
        if (!rootBlockName) rootBlockName = rootName
        if (options.root.single) {
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
        const parentRule = findParentRuleSkippingGlobal(rule)
        const parentKind = parentRule ? ruleKinds.get(parentRule) : undefined
        const hasBlockAncestor = (() => {
          let current = parentRule
          while (current) {
            if (ruleKinds.get(current) === 'block') return true
            current = findParentRuleSkippingGlobal(current)
          }
          return false
        })()
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
            isInteraction,
            hasBlockAncestor
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

      if (options.root.single && !rootBlockName && hasSpiraClassForRootCheck) {
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
        if (!safeTestPattern(options.comments.shared, text)) return
        const parent = comment.parent
        const isRootShared = Boolean(parent && isRule(parent) && rootBlockRules.has(parent))
        if (isRootShared) return
        stylelint.utils.report({
          ruleName,
          result,
          node: comment,
          message: messages.sharedNeedRootBlock(
            options.comments.shared
          )
        })
      })

      if (options.root.single && rootBlockName) {
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

      if (options.root.file && rootBlockName && fileBase) {
        const isComponentsLayer = options.paths.components.some((dir) => {
          const normalizedDir = path.normalize(dir)
          const dirSegments = normalizedDir.split(path.sep).filter(Boolean)
          if (dirSegments.length === 0) return false
          if (dirSegments.length === 1) return pathSegments.includes(dirSegments[0])
          return hasSegmentSequence(pathSegments, dirSegments)
        })
        const assetsIndex = pathSegments.indexOf('assets')
        const isAssetsCss = assetsIndex >= 0 && pathSegments[assetsIndex + 1] === 'css'
        const isExcludedFile = fileName === 'index.scss' || fileName.startsWith('_')
        const isChildScss = pathSegments.includes(options.paths.childDir)

        if (isComponentsLayer && !isAssetsCss && !isExcludedFile) {
          const expectedBase = isChildScss
            ? rootBlockName
            : formatFileBase(rootBlockName, options.root.case)
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
