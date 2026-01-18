import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - complex nesting structures', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner { .content { .title { .subtitle {} } } }',
        description: 'Block > Element > Element > Element (deep Element nesting)'
      },
      {
        code: '.hero-banner { .button-group {} }',
        description: 'Block > Block (multiple Blocks at same level)'
      }
    ],

    reject: [
      {
        code: '.hero-banner { .content { .button-group {} } }',
        description: 'Blocks cannot be placed inside Elements',
        message:
          'Element `.content` cannot contain a Block `button-group`. Move the Block to the parent Block level or refactor. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner { .wrapper { .inner-banner {} } }',
        description: 'Nesting Blocks inside Elements is discouraged',
        message:
          'Element `.wrapper` cannot contain a Block `inner-banner`. Move the Block to the parent Block level or refactor. (spiracss/class-structure)'
      }
    ]
  })
})

describe('spiracss/class-structure - Block nesting depth limits', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.page-layout { > .section-box {} }',
        description: 'Block > Block (one level) is OK'
      }
    ],

    reject: [
      {
        code: '.page-layout { > .section-box { > .inner-box {} } }',
        description: 'Block > Block > Block (two levels) is too deep',
        message: 'Block `inner-box` is nested too deeply (Block > Block > Block...). Move grandchild Block styles to its own file and link via `@rel`. (spiracss/class-structure)'
      }
    ]
  })
})

describe('spiracss/class-structure - parent/child checks inside @media/@supports', () => {
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
        code: `
.sample-block {
  @media (min-width: 768px) {
    > .title {}
  }
}`,
        description: 'inside @media, direct children of Block require ">"'
      }
    ],

    reject: [
      {
        code: `
.sample-block {
  @media (min-width: 768px) {
    .title {}
  }
}`,
        description: 'childCombinator applies inside @media',
        message: 'Use a direct-child combinator under the Block: `> .title`. Sections marked by `comments.shared` (current: `/--shared/i`) or `comments.interaction` (current: `/--interaction/i`) are exempt. (spiracss/class-structure)'
      },
      {
        code: `
.sample-block {
  > .element {
    @supports (display: grid) {
      > .child-block {}
    }
  }
}`,
        description: 'Element > Block is detected inside @supports',
        message:
          'Element `> .element` cannot contain a Block `child-block`. Move the Block to the parent Block level or refactor. (spiracss/class-structure)'
      },
      {
        code: `
.sample-block {
  > .child-block {
    @media (min-width: 768px) {
      > .grandchild-block {}
    }
  }
}`,
        description: 'Block > Block > Block is detected inside @media',
        message: 'Block `grandchild-block` is nested too deeply (Block > Block > Block...). Move grandchild Block styles to its own file and link via `@rel`. (spiracss/class-structure)'
      }
    ]
  })
})
