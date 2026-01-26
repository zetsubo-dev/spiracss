import type { WordCase } from '../types'
import { formatWordCase } from '../utils/formatting'
import {
  createRuleMessages,
  formatCode,
  formatConfigList,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'
import { ruleName } from './spiracss-keyframes-naming.constants'

const exampleActionName = (actionCase: WordCase): string =>
  formatWordCase('fade in', actionCase)

export const messages = createRuleMessages(ruleName, {
  needRoot: () =>
    `Place ${formatCode(
      '@keyframes'
    )} at the root level (not inside ${formatCode(
      '@media'
    )}/${formatCode('@layer')}/etc).`,
  needTail: () =>
    `Place ${formatCode(
      '@keyframes'
    )} at the end of the file (only comments/blank lines may follow).`,
  invalidName: (name: string, block: string, actionCase: WordCase, maxWords: number) =>
    `Keyframes ${formatCode(name)} must follow ${formatCode(
      `${block}-{action}`
    )} or ${formatCode(
      `${block}-{element}-{action}`
    )} (e.g., ${formatCode(
      `${block}-${exampleActionName(actionCase)}`
    )} or ${formatCode(
      `${block}-{element}-${exampleActionName(actionCase)}`
    )}; action: ${formatCode(actionCase)}, 1-${maxWords} words).`,
  invalidSharedName: (name: string, prefix: string, actionCase: WordCase, maxWords: number) =>
    `Shared keyframes ${formatCode(name)} must follow ${formatCode(
      `${prefix}{action}`
    )} (e.g., ${formatCode(
      `${prefix}${exampleActionName(actionCase)}`
    )}; action: ${formatCode(actionCase)}, 1-${maxWords} words).`,
  sharedFileOnly: (name: string, prefix: string, sharedFiles: Array<string | RegExp>) =>
    `Shared keyframes ${formatCode(name)} (prefix ${formatCode(
      prefix
    )}) must be defined in a shared keyframes file ` +
    `configured via ${formatCode('sharedFiles')} (current: ${formatConfigList(
      sharedFiles
    )}).`,
  missingBlock: () =>
    `Cannot determine the root Block for ${formatCode(
      '@keyframes'
    )} naming. Add a root Block selector or configure ${formatCode(
      'blockSource'
    )}.`,
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
