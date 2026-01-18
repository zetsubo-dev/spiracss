import { ruleName } from './spiracss-class-structure.constants'
import {
  createRuleMessages,
  formatConfigList,
  formatList,
  formatPattern,
  formatCode,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'

export const messages = createRuleMessages(ruleName, {
  invalidName: (cls: string, namingHint: string) =>
    // Naming style is configurable, so only state that it violates SpiraCSS Block/Element/Modifier rules.
    `Class ${formatCode(
      cls
    )} is not a valid SpiraCSS Block/Element/Modifier. Rename it to match the configured naming rules. ${namingHint}`,
  elementChainTooDeep: (parent: string, child: string, depth: number, limit: number) =>
    `Element chain is too deep: ${formatCode(parent)} -> ${formatCode(
      child
    )} (depth ${depth}, max ${limit}). Promote a segment to a Block or simplify the structure.`,
  elementCannotOwnBlock: (parent: string, child: string) =>
    `Element ${formatCode(parent)} cannot contain a Block ${formatCode(
      child
    )}. Move the Block to the parent Block level or refactor.`,
  blockDescendantSelector: (parent: string, child: string) =>
    `Avoid chained selectors under ${formatCode(
      parent
    )}. Only target direct children (${formatCode(
      '> .child'
    )}). Move ${formatCode(
      `.${child}`
    )} styles into the child Block/Element file.`,
  blockTargetsGrandchildElement: (parent: string, child: string) =>
    `Do not style grandchild Elements from ${formatCode(
      parent
    )}. Move ${formatCode(
      `.${child}`
    )} styles into the child Block file.`,
  tooDeepBlockNesting: (cls: string) =>
    `Block ${formatCode(
      cls
    )} is nested too deeply (Block > Block > Block...). Move grandchild Block styles to its own file and link via ${formatCode(
      '@rel'
    )}.`,
  multipleRootBlocks: (root: string, extras: string[]) =>
    `Only one root Block is allowed per file. Found ${formatList(extras, {
      maxItems: extras.length
    })} in addition to ${formatCode(
      root
    )}. Split into separate SCSS files or move extra Blocks under the root.`,
  needChild: (
    child: string,
    sharedPattern: RegExp,
    interactionPattern: RegExp
  ) =>
    `Use a direct-child combinator under the Block: ${formatCode(
      `> .${child}`
    )}. ` +
    `Sections marked by ${formatCode(
      'comments.shared'
    )} (current: ${formatPattern(
      sharedPattern
    )}) ` +
    `or ${formatCode(
      'comments.interaction'
    )} (current: ${formatPattern(
      interactionPattern
    )}) are exempt.`,
  needChildNesting: (selector: string) =>
    `Do not write child selectors at the top level. Selector: ${formatCode(
      selector
    )}. Nest it inside the Block (e.g., ${formatCode(
      '.block { > .child { ... } }'
    )}).`,
  sharedNeedRootBlock: (sharedPattern: RegExp) =>
    `Place the shared section comment matching ${formatCode(
      'comments.shared'
    )} (current: ${formatPattern(
      sharedPattern
    )}) directly under the root Block ` +
    `(root wrappers like ${formatCode('@layer')}/${formatCode(
      '@supports'
    )}/${formatCode('@media')}/${formatCode(
      '@container'
    )}/${formatCode('@scope')} are allowed). Do not nest inside child rules.`,
  needAmpForMod: (example: string) => {
    const exampleHint = example
      ? ` Example: ${formatCode(`.block { &.${example} { ... } }`)}.`
      : ''
    const invalidExample = example
      ? ` Do not use ${formatCode(`.block.${example}`)} or ${formatCode(
          `.${example}`
        )} at top level.`
      : ' Do not use modifier classes at the top level.'
    return `Write modifier classes inside the Block using ${formatCode(
      '&.<modifier>'
    )}.${exampleHint}${invalidExample}`
  },
  needModifierPrefix: (cls: string, example: string) => {
    const exampleHint = example ? ` Example: ${formatCode(`&.${example}`)}.` : ''
    return `Only modifier classes may be appended to ${formatCode(
      '&'
    )}. Found ${formatCode(cls)}. Use ${formatCode(
      '&.<modifier>'
    )}.${exampleHint} If not a modifier, move it to its own selector.`
  },
  disallowedModifier: (variantKeys: string[], stateKeys: string[]) =>
    `Modifier classes are disabled because ${formatCode(
      'selectorPolicy.variant.mode'
    )} and ${formatCode(
      'selectorPolicy.state.mode'
    )} are both ${formatCode('data')}. ` +
    `Use variant attributes (current: ${formatConfigList(
      variantKeys
    )}) or state attributes (current: ${formatConfigList(
      stateKeys
    )}) instead, or enable class mode in ${formatCode('selectorPolicy')}.`,
  invalidVariantAttribute: (
    attr: string,
    example: string,
    customModifierPattern?: RuleMessageArgs[number]
  ) => {
    const pattern =
      customModifierPattern instanceof RegExp || typeof customModifierPattern === 'string'
        ? customModifierPattern
        : undefined
    const hint = pattern
      ? `Use modifier classes matching ${formatCode(
          'naming.customPatterns.modifier'
        )} (current: ${formatPattern(pattern)}).`
      : example
      ? `Use modifier classes instead (e.g., ${formatCode(`&.${example}`)}).`
      : 'Use modifier classes that match the configured naming rules.'
    return (
      `Attribute ${formatCode(attr)} is disabled because ${formatCode(
        'selectorPolicy.variant.mode'
      )} is ${formatCode('class')}. ` + hint
    )
  },
  invalidStateAttribute: (
    attr: string,
    example: string,
    customModifierPattern?: RuleMessageArgs[number]
  ) => {
    const pattern =
      customModifierPattern instanceof RegExp || typeof customModifierPattern === 'string'
        ? customModifierPattern
        : undefined
    const hint = pattern
      ? `Use modifier classes matching ${formatCode(
          'naming.customPatterns.modifier'
        )} (current: ${formatPattern(pattern)}).`
      : example
      ? `Use modifier classes instead (e.g., ${formatCode(`&.${example}`)}).`
      : 'Use modifier classes that match the configured naming rules.'
    return (
      `Attribute ${formatCode(attr)} is disabled because ${formatCode(
        'selectorPolicy.state.mode'
      )} is ${formatCode('class')}. ` + hint
    )
  },
  invalidDataValue: (attr: string, value: string, caseName: string, maxWords: number) =>
    `Attribute ${formatCode(attr)} value ${formatCode(
      value
    )} does not match ${formatCode(
      'selectorPolicy'
    )} valueNaming (case: ${formatCode(caseName)}, maxWords: ${formatCode(
      String(maxWords)
    )}). Rename it to match the configured rules.`,
  rootSelectorMissingBlock: (block: string, selector: string) =>
    `Root selector ${formatCode(
      selector
    )} must include the root Block ${formatCode(
      `.${block}`
    )}. Include it in the selector or move this rule under the root Block.`,
  missingRootBlock: () =>
    'No root Block found. Define a top-level Block selector that matches the naming rules.',
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0]),
  fileNameMismatch: (block: string, expected: string, actual: string) =>
    `Root Block ${formatCode(
      `.${block}`
    )} must be defined in ${formatCode(
      `${expected}.scss`
    )} (found ${formatCode(`${actual}.scss`)}). Rename the file or the Block.`
})
