import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - basic Block/Element checks', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: true,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner { > .title {} }',
        description: 'Block > Element (child selector)'
      }
    ],

    reject: [
      {
        code: '.hero-banner > .title {}',
        description: 'top-level child selector must be nested under the Block',
        message:
          'Do not write child selectors at the top level. Selector: `.hero-banner > .title`. Nest it inside the Block (e.g., `.block { > .child { ... } }`). (spiracss/class-structure)'
      },
      {
        code: '.hero-banner { .title {} }',
        description: 'childCombinator: true requires child selectors',
        message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `comments.shared` (current: `/--shared/i`) or `comments.interaction` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner { & .title {} }',
        description: 'childCombinator: true rejects "& .child" descendant selectors',
        message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `comments.shared` (current: `/--shared/i`) or `comments.interaction` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner, .hero-banner.-primary { .title {} }',
        description: 'Block detection is stable with multiple selectors; missing child selector is an error',
        warnings: [
          {
            message: 'Write modifier classes inside the Block using `&.<modifier>`. Example: `.block { &.-primary { ... } }`. Do not use `.block.-primary` or `.-primary` at top level. (spiracss/class-structure)'
          },
          {
            message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `comments.shared` (current: `/--shared/i`) or `comments.interaction` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: '.hero-banner { > .feature-list .title {} }',
        description: 'grandchild selectors reaching into child Blocks are errors',
        message:
          'Avoid chained selectors under `.hero-banner`. Only target direct children (`> .child`). Move `.title` styles into the child Block/Element file. (spiracss/class-structure)'
      }
    ]
  })
})


describe('spiracss/class-structure - childCombinator option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        childNesting: true,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner { .title {} }',
        description: 'childCombinator: false allows missing child selector'
      }
    ]
  })
})

describe('spiracss/class-structure - childNesting option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: true,
        childNesting: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner > .title {}',
        description: 'childNesting: false allows top-level child selectors'
      }
    ]
  })
})

describe('spiracss/class-structure - childNesting patterns', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: true,
        childNesting: true,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@media (min-width: 768px) {
  .hero-banner {
    > .title {}
  }
}`,
        description: 'nested child selector inside @media is allowed'
      },
      {
        code: `
:global(.scope) {
  .hero-banner {
    > .title {}
  }
}`,
        description: 'child selector nested inside Block under a global wrapper is allowed'
      }
    ],

    reject: [
      {
        code: `
@media (min-width: 768px) {
  .hero-banner > .title {}
}`,
        description: 'top-level child selector inside @media is rejected',
        message:
          'Do not write child selectors at the top level. Selector: `.hero-banner > .title`. Nest it inside the Block (e.g., `.block { > .child { ... } }`). (spiracss/class-structure)'
      },
      {
        code: `
:global(.scope) {
  .hero-banner > .title {}
}`,
        description: 'top-level child selector inside global wrapper is rejected',
        message:
          'Do not write child selectors at the top level. Selector: `.hero-banner > .title`. Nest it inside the Block (e.g., `.block { > .child { ... } }`). (spiracss/class-structure)'
      },
      {
        code: `
.hero-banner > .title,
.hero-banner > .body {
  color: #111;
}`,
        description: 'child selector lists are rejected at the top level',
        warnings: [
          {
            message:
              'Do not write child selectors at the top level. Selector: `.hero-banner > .title`. Nest it inside the Block (e.g., `.block { > .child { ... } }`). (spiracss/class-structure)'
          },
          {
            message:
              'Do not write child selectors at the top level. Selector: `.hero-banner > .body`. Nest it inside the Block (e.g., `.block { > .child { ... } }`). (spiracss/class-structure)'
          }
        ]
      }
    ]
  })
})


describe('spiracss/class-structure - Element chain depth checks', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 2, // Allow Element depth up to 2 (Block > Element > Element)
        childCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner { .title { .subtitle {} } }',
        description: 'Block > Element > Element (depth=2) is OK'
      }
    ],

    reject: [
      {
        code: '.hero-banner { .title { .subtitle { .text {} } } }',
        description: 'Block > Element > Element > Element (depth=3) exceeds elementDepth: 2',
        message:
          'Element chain is too deep: `.subtitle` -> `text` (depth 3, max 2). Promote a segment to a Block or simplify the structure. (spiracss/class-structure)'
      }
    ]
  })
})


describe('spiracss/class-structure - external class allowance', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        external: { classes: ['swiper-container'], prefixes: ['js-'] },
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.swiper-container {}',
        description: 'classes allowed by external.classes'
      },
      {
        code: '.js-toggle {}',
        description: 'prefixes allowed by external.prefixes'
      },
      {
        code: '.hero-banner { &.js-toggle {} }',
        description: 'external.prefixes also allows &. external classes'
      }
    ]
  })
})
