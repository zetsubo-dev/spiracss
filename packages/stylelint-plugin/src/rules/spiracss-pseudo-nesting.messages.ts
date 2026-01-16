import stylelint from 'stylelint'

import { ruleName } from './spiracss-pseudo-nesting.constants'
import {
  formatCode,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'

export const messages = stylelint.utils.ruleMessages(ruleName, {
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
