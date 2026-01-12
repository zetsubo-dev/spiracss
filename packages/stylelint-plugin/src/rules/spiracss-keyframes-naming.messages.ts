import stylelint from 'stylelint'

import { ruleName } from './spiracss-keyframes-naming.constants'

const exampleActionName = (actionCase: string): string => {
  switch (actionCase) {
    case 'snake':
      return 'fade_in'
    case 'camel':
      return 'fadeIn'
    case 'pascal':
      return 'FadeIn'
    case 'kebab':
    default:
      return 'fade-in'
  }
}

export const messages = stylelint.utils.ruleMessages(ruleName, {
  needRoot: () => 'Place @keyframes at the root level (not inside @media/@layer/etc).',
  needTail: () =>
    'Place @keyframes at the end of the file (only comments/blank lines may follow).',
  invalidName: (name: string, block: string, actionCase: string, maxWords: number) =>
    `Keyframes "${name}" must follow "${block}-{action}" or "${block}-{element}-{action}" (e.g., "${block}-${exampleActionName(
      actionCase
    )}" or "${block}-{element}-${exampleActionName(actionCase)}"; action: ${actionCase}, 1-${maxWords} words).`,
  invalidSharedName: (name: string, prefix: string, actionCase: string, maxWords: number) =>
    `Shared keyframes "${name}" must follow "${prefix}{action}" (e.g., "${prefix}${exampleActionName(
      actionCase
    )}"; action: ${actionCase}, 1-${maxWords} words).`,
  sharedFileOnly: (name: string, prefix: string) =>
    `Shared keyframes "${name}" (prefix "${prefix}") must be defined in a shared keyframes file (e.g., "keyframes.scss", or configure "sharedFiles").`,
  missingBlock: () =>
    'Cannot determine the root Block for @keyframes naming. Add a root Block selector or configure blockNameSource.',
  selectorParseFailed: () =>
    'Failed to parse one or more selectors, so keyframes naming checks may be incomplete.'
})
