import type { AtRule, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { CACHE_SCHEMA, COMMENTS_SCHEMA, POLICY_SCHEMA } from '../utils/option-schema'
import { findParentRule } from '../utils/postcss-helpers'
import { selectorParseFailedArgs } from '../utils/messages'
import { safeTestPattern } from '../utils/section'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { getRuleDocsUrl } from '../utils/rule-docs'
import { isBoolean, isPlainObject, isString, isStringArray } from '../utils/validate'
import { ruleName } from './spiracss-interaction-scope.constants'
import { messages } from './spiracss-interaction-scope.messages'
import { normalizeOptions } from './spiracss-interaction-scope.options'
import {
  analyzeSelector,
  buildSelectorPolicySets,
  findAtRootAncestor,
  findCommentBefore,
  hasAtRootNestingParam,
  isLastNonCommentNode,
  isRootLevelRule,
  normalizePseudo,
  startsWithNestingToken
} from './spiracss-interaction-scope.utils'

// SpiraCSS: interaction section rule
// - Dynamic states and pseudos (e.g. :hover) must live in an @at-root & { ... } block, starting from &.
// - Interaction blocks should include a `// --interaction` comment.

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Require interaction selectors to be scoped in SpiraCSS interaction sections.',
  category: 'stylistic'
}

const optionSchema = {
  pseudos: [isString],
  requireAtRoot: [isBoolean],
  requireComment: [isBoolean],
  requireTail: [isBoolean],
  commentOnly: [isBoolean],
  ...COMMENTS_SCHEMA,
  ...POLICY_SCHEMA,
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
      typeof primaryOption === 'object' && primaryOption !== null ? primaryOption : secondaryOption

    type RuleCache = {
      options: ReturnType<typeof normalizeOptions>
      allowedPseudoSet: Set<string>
      policySets: ReturnType<typeof buildSelectorPolicySets>
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
      cache = {
        options,
        allowedPseudoSet: new Set(options.pseudos.map(normalizePseudo)),
        policySets: buildSelectorPolicySets(options.selectorPolicy),
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
        ['pseudos'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const { options, allowedPseudoSet, policySets, hasInvalidOptions } =
        getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return

      const checkedTailTargets = new WeakSet<AtRule>()
      let firstRule: Rule | null = null
      const cacheSizes = options.cache
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache

      root.walkRules((rule: Rule) => {
        if (!firstRule) firstRule = rule
        const selector: string = rule.selector || ''

        const atRootNode = findAtRootAncestor(rule)
        // Interaction comments are expected right before @at-root (or its wrapper like @layer/@supports/@media/@container/@scope).
        // To avoid false positives inside @at-root blocks, anchor the search at atRootNode.
        const commentTarget = atRootNode || rule
        const comment = findCommentBefore(commentTarget)
        const hasInteractionComment = Boolean(
          comment && safeTestPattern(options.comments.interaction, comment)
        )
        const selectorAnalysis = analyzeSelector(
          selector,
          selectorCache,
          allowedPseudoSet,
          policySets
        )
        const hasStateSelector = selectorAnalysis.hasState
        const hasMixedStateVariant = selectorAnalysis.hasMixed
        const hasNest = startsWithNestingToken(selector, selectorCache)
        const hasAtRootNesting = hasAtRootNestingParam(atRootNode)

        const hasInteractionSelector = selectorAnalysis.hasAllowedPseudo || hasStateSelector
        const shouldCheckByComment = hasInteractionComment && (hasInteractionSelector || hasNest)
        const shouldCheckBySelector =
          !options.commentOnly && hasInteractionSelector
        const reports: string[] = []

        if (hasMixedStateVariant) {
          const variantKeys = Array.from(policySets.variantKeys)
          const stateKeys = [policySets.stateKey, ...Array.from(policySets.ariaKeys)]
          reports.push(messages.mixedStateVariant(stateKeys, variantKeys))
        }

        if (!shouldCheckByComment && !shouldCheckBySelector) {
          if (reports.length === 0) return
        }

        const ownerRule = findParentRule(atRootNode ?? rule)
        const isTopLevelRule = Boolean(ownerRule && isRootLevelRule(ownerRule))
        if (!isTopLevelRule) {
          reports.push(messages.needRootBlock())
        }

        if (options.require.atRoot) {
          if (!hasAtRootNesting || !hasNest) {
            reports.push(messages.needAtRoot())
          }
        }

        if (options.require.comment) {
          if (!hasInteractionComment) {
            reports.push(
              messages.needComment(options.comments.interaction)
            )
          }
        }

        if (options.require.tail && hasInteractionComment && hasAtRootNesting && atRootNode) {
          // Check tail placement once per interaction section to reduce noise.
          if (!checkedTailTargets.has(atRootNode)) {
            checkedTailTargets.add(atRootNode)
            if (!isLastNonCommentNode(atRootNode)) {
              reports.push(messages.needTail())
            }
          }
        }

        reports.forEach((message) => {
          stylelint.utils.report({
            ruleName,
            result,
            node: rule,
            message
          })
        })
      })

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

const spiracssInteractionScope = createPlugin(ruleName, rule)

export default spiracssInteractionScope
