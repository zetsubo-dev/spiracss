import { ruleName } from './spiracss-rel-comments.constants'
import {
  createRuleMessages,
  formatCode,
  formatConfigList,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'

const formatAliasList = (aliases: string[]): string =>
  formatConfigList(aliases.map((alias) => `@${alias}/`))

const formatAliasHint = (aliases: string[]): string =>
  ` (current: ${formatAliasList(aliases)})`

export const messages = createRuleMessages(ruleName, {
  // Summarizes missing/incorrect link comment placement (top-of-file, child Block, or inside root Block).
  missingParentRel: (aliases: string[]) =>
    'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. ' +
    `Use ${formatCode('// @rel/...')} or a configured alias from ${formatCode(
      'aliasRoots'
    )}${formatAliasHint(aliases)}.`,
  misplacedParentRel: (aliases: string[]) =>
    'Parent link comment must be at the top of the file (before the root Block). ' +
    `Move it above the root Block as the first line (e.g., ${formatCode(
      '// @rel/...'
    )}). ` +
    `Use a configured alias from ${formatCode(
      'aliasRoots'
    )}${formatAliasHint(aliases)}.`,
  rootBlockNotFirst: () =>
    `Root Block must be the first rule in its root scope (after ${formatCode(
      '@use'
    )}/${formatCode('@forward')}/${formatCode(
      '@import'
    )}). Move it above other rules so the parent link comment can stay at the top.`,
  missingChildRel: (aliases: string[]) =>
    `Missing child link comment. Add ${formatCode(
      '// @rel/<child>.scss'
    )} or ${formatCode('// @<alias>/<child>.scss')} ` +
    `using ${formatCode(
      'aliasRoots'
    )}${formatAliasHint(aliases)} as the first line inside each direct child rule (${formatCode(
      '> .child'
    )}). ` +
    `Example: ${formatCode('> .child { // @rel/child.scss }')}.`,
  notFound: (target: string) =>
    `Link target not found: ${formatCode(
      target
    )}. Fix the path or ${formatCode('aliasRoots')}.`,
  childMismatch: (child: string) =>
    `Link comment must include ${formatCode(
      `${child}.scss`
    )} for direct child ${formatCode(
      `.${child}`
    )}. Update the ${formatCode('@rel')} path to match.`,
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
