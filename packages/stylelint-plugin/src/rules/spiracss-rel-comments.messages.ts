import stylelint from 'stylelint'

import { ruleName } from './spiracss-rel-comments.constants'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  // Summarizes missing/incorrect link comment placement (top-of-file, child Block, or inside root Block).
  missingParentRel: () =>
    'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Example: "// @rel/../parent-block.scss" or "// @assets/...".',
  misplacedParentRel: () =>
    'Parent link comment must be at the top of the file (before the root Block). Move it above the root Block as the first line (e.g., @rel or @assets).',
  rootBlockNotFirst: () =>
    'Root Block must be the first rule in its root scope (after @use/@forward/@import). Move it above other rules so the parent link comment can stay at the top.',
  missingChildRel: () =>
    'Missing child @rel comment. Add "// @rel/<child>.scss" as the first line inside each direct child rule ("> .child"). Example: "> .child { // @rel/child.scss }".',
  notFound: (target: string) => `Link target not found: ${target}. Fix the path or aliasRoots.`,
  childMismatch: (child: string) =>
    `Link comment must include "${child}.scss" for direct child ".${child}". Update the @rel path to match.`,
  selectorParseFailed: () =>
    'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors.'
})
