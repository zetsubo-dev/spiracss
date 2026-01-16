import type { Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { normalizeCacheSizes } from '../utils/cache'
import { selectorParseFailedArgs } from '../utils/messages'
import { CACHE_SIZES_SCHEMA } from '../utils/option-schema'
import {
  collectCompoundSegments,
  createSelectorCacheWithErrorFlag,
  type SelectorParserCache
} from '../utils/selector'
import { createPlugin, createRule, reportInvalidOption } from '../utils/stylelint'
import { isPlainObject } from '../utils/validate'
import { ruleName } from './spiracss-pseudo-nesting.constants'
import { messages } from './spiracss-pseudo-nesting.messages'

// SpiraCSS: pseudo-classes/elements must be nested under &.
// - Example: .btn { &:hover { ... } } / .btn { &::before { ... } }

export { ruleName }

const meta = {
  url: 'https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint.md#spiracsspseudo-nesting',
  fixable: false,
  description: 'Require pseudo selectors to be nested under "&" in SpiraCSS.',
  category: 'stylistic'
}

const collectViolations = (
  selector: string,
  selectorCache: SelectorParserCache
): number[] => {
  const indexes: number[] = []
  const selectors = selectorCache.parse(selector)
  selectors.forEach((sel) => {
    if (sel.parent?.type !== 'root') return
    const compounds = collectCompoundSegments(sel)
    compounds.forEach((compound) => {
      if (compound.hasNesting) return
      compound.pseudos.forEach((pseudo) => {
        indexes.push(pseudo.sourceIndex ?? 0)
      })
    })
  })

  return indexes
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
            possible: CACHE_SIZES_SCHEMA,
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
        (rawOptions as { cacheSizes?: unknown } | null | undefined)?.cacheSizes,
        reportInvalid
      )

      let firstRule: Rule | null = null
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      root.walkRules((rule: Rule) => {
        if (!firstRule) firstRule = rule
        const selector: string = rule.selector || ''
        if (!selector.includes(':')) return

        const indexes = collectViolations(selector, selectorCache)
        if (indexes.length === 0) return

        indexes.forEach((index) => {
          stylelint.utils.report({
            ruleName,
            result,
            node: rule,
            index,
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
