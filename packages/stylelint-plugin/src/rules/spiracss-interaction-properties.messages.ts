import stylelint from 'stylelint'

import { ruleName } from './spiracss-interaction-properties.constants'
import {
  formatCode,
  formatPattern,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  needInteraction: (prop: string, pattern: RegExp) =>
    `${formatCode(
      prop
    )} must be declared inside the SpiraCSS interaction section under the root Block ` +
    `(comment matching ${formatCode(
      'interactionCommentPattern'
    )}, current: ${formatPattern(
      pattern
    )}; typically in ${formatCode('@at-root &')}).`,
  missingTransitionProperty: () =>
    `Transition must include explicit property names (e.g., ${formatCode(
      'transition: opacity 0.2s'
    )}).`,
  transitionAll: (prop: string) => {
    const example =
      prop === 'transition-property'
        ? 'transition-property: opacity'
        : 'transition: opacity 0.2s'
    return `Avoid ${formatCode(
      `${prop}: all`
    )}. List explicit properties (e.g., ${formatCode(example)}).`
  },
  transitionNone: () =>
    `${formatCode(
      'transition: none'
    )} / ${formatCode(
      'transition-property: none'
    )} is not allowed. Use a tiny ${formatCode(
      'transition-duration'
    )} instead (e.g., ${formatCode('transition-duration: 0.001s')}).`,
  invalidTransitionProperty: (prop: string) =>
    `Transition property ${formatCode(
      prop
    )} is not allowed. Use explicit properties (no custom properties or keywords like ${formatCode(
      'inherit'
    )}/${formatCode('initial')}/${formatCode('unset')}/${formatCode(
      'revert'
    )}/${formatCode('revert-layer')}).`,
  initialOutsideInteraction: (prop: string, target: string, pattern: RegExp) =>
    `${formatCode(prop)} is transitioned for ${formatCode(
      target
    )}. Move its declarations into the interaction section ` +
    `(comment matching ${formatCode(
      'interactionCommentPattern'
    )}, current: ${formatPattern(pattern)}).`,
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
