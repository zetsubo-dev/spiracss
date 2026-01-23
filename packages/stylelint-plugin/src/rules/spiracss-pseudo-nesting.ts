import type { Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { normalizeCacheSizes } from '../utils/cache'
import { selectorParseFailedArgs } from '../utils/messages'
import { CACHE_SCHEMA } from '../utils/option-schema'
import {
  collectCompoundSegments,
  createSelectorCacheWithErrorFlag,
  type SelectorParserCache
} from '../utils/selector'
import { createPlugin, createRule, reportInvalidOption } from '../utils/stylelint'
import { getRuleDocsUrl } from '../utils/rule-docs'
import { isPlainObject } from '../utils/validate'
import { ruleName } from './spiracss-pseudo-nesting.constants'
import { messages } from './spiracss-pseudo-nesting.messages'

// SpiraCSS: pseudo-classes/elements must be nested under &.
// - Example: .btn { &:hover { ... } } / .btn { &::before { ... } }

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Require pseudo selectors to be nested under "&" in SpiraCSS.',
  category: 'stylistic'
}

type Violation = {
  index: number
  endIndex: number
}

const collectViolations = (
  selector: string,
  selectorCache: SelectorParserCache
): Violation[] => {
  const violations: Violation[] = []
  const selectors = selectorCache.parse(selector)
  selectors.forEach((sel) => {
    if (sel.parent?.type !== 'root') return
    const compounds = collectCompoundSegments(sel)
    compounds.forEach((compound) => {
      if (compound.hasNesting) return
      compound.pseudos.forEach((pseudo) => {
        const index = pseudo.sourceIndex ?? 0
        const endIndex = index + pseudo.toString().length
        violations.push({ index, endIndex })
      })
    })
  })

  return violations
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
            possible: CACHE_SCHEMA,
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

      const cacheSizes = normalizeCacheSizes(
        (rawOptions as { cache?: unknown } | null | undefined)?.cache,
        reportInvalid
      )

      let firstRule: Rule | null = null
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      root.walkRules((rule: Rule) => {
        if (!firstRule) firstRule = rule
        const selector: string = rule.selector || ''
        if (!selector.includes(':')) return

        const violations = collectViolations(selector, selectorCache)
        if (violations.length === 0) return

        violations.forEach(({ index, endIndex }) => {
          stylelint.utils.report({
            ruleName,
            result,
            node: rule,
            index,
            endIndex,
            message: messages.needNesting()
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

const spiracssPseudoNesting = createPlugin(ruleName, rule)

export default spiracssPseudoNesting
