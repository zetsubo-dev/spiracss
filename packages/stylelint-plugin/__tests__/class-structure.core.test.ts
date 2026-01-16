import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - basic Block/Element checks', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: true,
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
        code: '.hero-banner { .title {} }',
        description: 'enforceChildCombinator: true requires child selectors',
        message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `sharedCommentPattern` (current: `/--shared/i`) or `interactionCommentPattern` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner { & .title {} }',
        description: 'enforceChildCombinator: true rejects "& .child" descendant selectors',
        message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `sharedCommentPattern` (current: `/--shared/i`) or `interactionCommentPattern` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner, .hero-banner.-primary { .title {} }',
        description: 'Block detection is stable with multiple selectors; missing child selector is an error',
        warnings: [
          {
            message: 'Write modifier classes inside the Block using `&.<modifier>`. Example: `.block { &.-primary { ... } }`. Do not use `.block.-primary` or `.-primary` at top level. (spiracss/class-structure)'
          },
          {
            message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `sharedCommentPattern` (current: `/--shared/i`) or `interactionCommentPattern` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
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


describe('spiracss/class-structure - enforceChildCombinator option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner { .title {} }',
        description: 'enforceChildCombinator: false allows missing child selector'
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
        allowElementChainDepth: 2, // Allow Element depth up to 2 (Block > Element > Element)
        enforceChildCombinator: false,
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
        description: 'Block > Element > Element > Element (depth=3) exceeds allowElementChainDepth: 2',
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
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        allowExternalClasses: ['swiper-container'],
        allowExternalPrefixes: ['js-'],
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.swiper-container {}',
        description: 'classes allowed by allowExternalClasses'
      },
      {
        code: '.js-toggle {}',
        description: 'prefixes allowed by allowExternalPrefixes'
      },
      {
        code: '.hero-banner { &.js-toggle {} }',
        description: 'allowExternalPrefixes also allows &. external classes'
      }
    ]
  })
})
