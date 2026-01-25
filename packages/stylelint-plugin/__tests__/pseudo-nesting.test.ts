import pseudoNesting from '../dist/esm/rules/spiracss-pseudo-nesting.js'
import { testRule } from './rule-test-utils.js'

describe('spiracss/pseudo-nesting - basic checks', () => {
  testRule({
    plugins: [pseudoNesting],
    ruleName: pseudoNesting.ruleName,
    config: [true],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  &:hover {}
}`,
        description: 'pseudo selectors are nested under &'
      },
      {
        code: `
.block {
  &:hover,
  &:focus {}
}`,
        description: 'multiple pseudos are nested under &'
      },
      {
        code: `
.block {
  > .item {
    &:hover {}
  }
}`,
        description: 'pseudos on child selectors are nested'
      },
      {
        code: `
.block {
  &::before {}
}`,
        description: 'pseudo elements are nested under &'
      },
      {
        code: `
.block {
  &:hover > .item {}
}`,
        description: 'when targeting children from parent state, hang off &'
      },
      {
        code: `
.block {
  > .item {
    &:not(.is-disabled):hover {}
  }
}`,
        description: 'nested pseudos on & stay on the same compound'
      },
      {
        code: `
:global(.block) {}
`,
        description: ':global pseudo is ignored'
      }
    ],

    reject: [
      {
        code: `
.block:hover {}
`,
        description: 'top-level pseudo is an error',
        message:
          'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
      },
      {
        code: `
.block {
  :hover {}
}`,
        description: 'pseudo without & inside nesting is an error',
        message:
          'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
      },
      {
        code: `
.block {
  > .item:hover {}
}`,
        description: 'inline pseudo on child selector is an error',
        message:
          'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
      },
      {
        code: `
.block {
  & > .item:hover {}
}`,
        description: 'even with &, pseudo must be on the same compound',
        message:
          'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
      },
      {
        code: `
.block::before {}
`,
        description: 'top-level pseudo element is an error',
        message:
          'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
      },
      {
        code: `
.block {
  > .item:not(.is-disabled):hover {}
}`,
        description: 'compound pseudos on child selector require & nesting',
        warnings: [
          {
            message:
              'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
          },
          {
            message:
              'Pseudo selectors must be nested with `&` on the same compound. Example: `.btn { &:hover { ... } }` or `.btn { &::before { ... } }`. For child targets, use `> .btn { &:hover { ... } }` (not `> .btn:hover` or `& > .btn:hover`). (spiracss/pseudo-nesting)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/pseudo-nesting - selector parse failure', () => {
  testRule({
    plugins: [pseudoNesting],
    ruleName: pseudoNesting.ruleName,
    config: [true],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
.block > : {
  color: red;
}`,
        description: 'emit a single warning on selector parse failure',
        warnings: [
          {
            message:
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: `.block > :`. (spiracss/pseudo-nesting)'
          }
        ]
      }
    ]
  })
})
