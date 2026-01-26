import {
  createRuleMessages,
  formatCode,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'
import { ruleName } from './spiracss-pseudo-nesting.constants'

export const messages = createRuleMessages(ruleName, {
  needNesting: () =>
    `Pseudo selectors must be nested with ${formatCode(
      '&'
    )} on the same compound. Example: ${formatCode(
      '.btn { &:hover { ... } }'
    )} or ${formatCode(
      '.btn { &::before { ... } }'
    )}. For child targets, use ${formatCode(
      '> .btn { &:hover { ... } }'
    )} (not ${formatCode('> .btn:hover')} or ${formatCode(
      '& > .btn:hover'
    )}).`,
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
