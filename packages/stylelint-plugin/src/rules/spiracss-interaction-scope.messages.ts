import stylelint from 'stylelint'

import { ruleName } from './spiracss-interaction-scope.constants'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  needAtRoot: () =>
    'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } }',
  needComment: () =>
    'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... }',
  needTail: () =>
    'Place the @at-root interaction block at the end of the root Block (after all other rules).',
  needRootBlock: () =>
    'The interaction block must be directly under the root Block. Move the @at-root block out of child rules.',
  mixedStateVariant: (variantKeys: string, stateKeys: string) =>
    `Do not mix state selectors (${stateKeys}) with variant selectors (${variantKeys}) in the same selector. Split into separate selectors.`,
  selectorParseFailed: () =>
    'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors.'
})
