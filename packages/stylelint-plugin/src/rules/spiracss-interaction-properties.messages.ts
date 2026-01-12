import stylelint from 'stylelint'

import { ruleName } from './spiracss-interaction-properties.constants'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  needInteraction: (prop: string) =>
    `"${prop}" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &).`,
  missingTransitionProperty: () =>
    'Transition must include explicit property names (e.g., "transition: opacity 0.2s").',
  transitionAll: (prop: string) => {
    const example =
      prop === 'transition-property'
        ? 'transition-property: opacity'
        : 'transition: opacity 0.2s'
    return `Avoid "${prop}: all". List explicit properties (e.g., "${example}").`
  },
  transitionNone: () =>
    '"transition: none" / "transition-property: none" is not allowed. Use a tiny "transition-duration" instead (e.g., "transition-duration: 0.001s").',
  invalidTransitionProperty: (prop: string) =>
    `Transition property "${prop}" is not allowed. Use explicit properties (no custom properties or keywords like inherit/initial/unset/revert/revert-layer).`,
  initialOutsideInteraction: (prop: string, target: string) =>
    `"${prop}" is transitioned for ${target}. Move its declarations into the interaction section.`,
  selectorParseFailed: () =>
    'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors.'
})
