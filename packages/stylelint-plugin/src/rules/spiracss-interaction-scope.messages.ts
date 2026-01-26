import {
  createRuleMessages,
  formatCode,
  formatConfigList,
  formatPattern,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'
import { ruleName } from './spiracss-interaction-scope.constants'

export const messages = createRuleMessages(ruleName, {
  needAtRoot: () =>
    `When ${formatCode(
      'requireAtRoot'
    )} is enabled, interaction selectors (pseudos/state) must be inside ${formatCode(
      '@at-root & { ... }'
    )} and each selector must start with ${formatCode('&')}.`,
  needComment: (pattern: RegExp) =>
    `Add the interaction comment matching ${formatCode(
      'comments.interaction'
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
    `Do not mix state selectors (${formatConfigList(
      stateKeys
    )}) with variant selectors (${formatConfigList(
      variantKeys
    )}) in the same selector. Split into separate selectors.`,
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
