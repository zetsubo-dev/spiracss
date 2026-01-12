import stylelint from 'stylelint'

import { ruleName } from './spiracss-class-structure.constants'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  invalidName: (cls: string, namingHint: string) =>
    // Naming style is configurable, so only state that it violates SpiraCSS Block/Element/Modifier rules.
    `Class "${cls}" is not a valid SpiraCSS Block/Element/Modifier. Rename it to match the configured naming rules. ${namingHint}`,
  elementChainTooDeep: (parent: string, child: string, depth: number, limit: number) =>
    `Element chain is too deep: "${parent}" -> "${child}" (depth ${depth}, max ${limit}). Promote a segment to a Block or simplify the structure.`,
  elementCannotOwnBlock: (parent: string, child: string) =>
    `Element "${parent}" cannot contain a Block "${child}". Move the Block to the parent Block level or refactor.`,
  blockDescendantSelector: (parent: string, child: string) =>
    `Avoid chained selectors under "${parent}". Only target direct children ("> .child"). Move "${child}" styles into the child Block/Element file.`,
  blockTargetsGrandchildElement: (parent: string, child: string) =>
    `Do not style grandchild Elements from "${parent}". Move ".${child}" styles into the child Block file.`,
  tooDeepBlockNesting: (cls: string) =>
    `Block "${cls}" is nested too deeply (Block > Block > Block...). Move grandchild Block styles to its own file and link via @rel.`,
  multipleRootBlocks: (root: string, extras: string[]) =>
    `Only one root Block is allowed per file. Found ${extras
      .map((name) => `"${name}"`)
      .join(', ')} in addition to "${root}". Split into separate SCSS files or move extra Blocks under the root.`,
  needChild: (child: string) =>
    `Use a direct-child combinator under the Block: "> .${child}". Example: ".block { > .${child} { ... } }". Shared/interaction sections are exempt.`,
  sharedNeedRootBlock: () =>
    'Place "// --shared" directly under the root Block (root wrappers like @layer/@supports/@media/@container/@scope are allowed). Do not nest inside child rules.',
  needAmpForMod: (example: string) =>
    `Write modifier classes inside the Block using "&.<modifier>". Example: ".block { &.${example} { ... } }". Do not use ".block.${example}" or ".${example}" at top level.`,
  needModifierPrefix: (cls: string, example: string) =>
    `Only modifier classes may be appended to "&". Found "${cls}". Use "&.<modifier>". Example: "&.${example}". If not a modifier, move it to its own selector.`,
  disallowedModifier: () =>
    'Modifier classes are disabled because selectorPolicy uses data mode. Use configured data attributes or enable class mode in selectorPolicy.',
  invalidVariantAttribute: (attr: string, example: string) =>
    `Attribute "${attr}" is disabled because selectorPolicy.variant.mode is "class". Use modifier classes instead (e.g., "&.${example}").`,
  invalidStateAttribute: (attr: string, example: string) =>
    `Attribute "${attr}" is disabled because selectorPolicy.state.mode is "class". Use modifier classes instead (e.g., "&.${example}").`,
  invalidDataValue: (attr: string, value: string) =>
    `Attribute "${attr}" value "${value}" does not match selectorPolicy valueNaming. Rename it to match the configured case/word rules.`,
  rootSelectorMissingBlock: (block: string, selector: string) =>
    `Root selector "${selector}" must include the root Block ".${block}". Include it in the selector or move this rule under the root Block.`,
  missingRootBlock: () =>
    'No root Block found. Define a top-level Block selector that matches the naming rules (e.g., ".hero-banner { ... }").',
  selectorParseFailed: () =>
    'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors.',
  fileNameMismatch: (block: string, expected: string, actual: string) =>
    `Root Block ".${block}" must be defined in "${expected}.scss" (found "${actual}.scss"). Rename the file or the Block.`
})
