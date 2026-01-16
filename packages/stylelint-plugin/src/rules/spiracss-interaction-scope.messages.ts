import stylelint from 'stylelint'

import { ruleName } from './spiracss-interaction-scope.constants'
import {
  formatCode,
  formatList,
  formatPattern,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  needAtRoot: () =>
    `When ${formatCode(
      'requireAtRoot'
    )} is enabled, interaction selectors (pseudos/state) must be inside ${formatCode(
      '@at-root & { ... }'
    )} and each selector must start with ${formatCode('&')}.`,
  needComment: (pattern: RegExp) =>
    `Add the interaction comment matching ${formatCode(
      'interactionCommentPattern'
    )} (current: ${formatPattern(
      pattern
    )}) immediately before the interaction rule ` +
    `(or the ${formatCode('@at-root')} block when used).`,
  needTail: () =>
    `Place the ${formatCode(
      '@at-root'
    )} interaction block at the end of the root Block (after all other rules).`,
  needRootBlock: () =>
    `The interaction block must be directly under the root Block. Move the ${formatCode(
      '@at-root'
    )} block out of child rules.`,
  mixedStateVariant: (stateKeys: string[], variantKeys: string[]) =>
    `Do not mix state selectors (${formatList(
      stateKeys
    )}) with variant selectors (${formatList(
      variantKeys
    )}) in the same selector. Split into separate selectors.`,
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
