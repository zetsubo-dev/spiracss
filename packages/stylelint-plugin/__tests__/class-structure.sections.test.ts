import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { invalidNameMessage, testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - --shared section behavior', () => {
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
        code: `
.hero-banner {
  > .title {}
  // --shared
  .helper-class {}
}`,
        description: 'child combinator is not required inside --shared (enforceChildCombinator relaxed)'
      },
      {
        code: `
@layer components {
  .hero-banner {
    > .title {}
    // --shared
    .helper-class {}
  }
}`,
        description: 'recognizes --shared even when root Block is wrapped in @layer'
      },
      {
        code: `
@supports (display: grid) {
  .hero-banner {
    > .title {}
    // --shared
    .helper-class {}
  }
}`,
        description: 'recognizes --shared even when root Block is wrapped in @supports'
      },
      {
        code: `
@media (min-width: 768px) {
  .hero-banner {
    > .title {}
    // --shared
    .helper-class {}
  }
}`,
        description: 'recognizes --shared even when root Block is wrapped in @media'
      },
      {
        code: `
@container (min-width: 480px) {
  .hero-banner {
    > .title {}
    // --shared
    .helper-class {}
  }
}`,
        description: 'recognizes --shared even when root Block is wrapped in @container'
      },
      {
        code: `
@scope (.theme) {
  .hero-banner {
    > .title {}
    // --shared
    .helper-class {}
  }
}`,
        description: 'recognizes --shared even when root Block is wrapped in @scope'
      }
    ],

    reject: [
      {
        code: `
.hero-banner {
  > .title {}
  > .caption {
    // --shared
    .note {}
  }
}`,
        description: '--shared section must be directly under the root Block',
        message: 'Place the shared section comment matching `sharedCommentPattern` (current: `/--shared/i`) directly under the root Block (root wrappers like `@layer`/`@supports`/`@media`/`@container`/`@scope` are allowed). Do not nest inside child rules. (spiracss/class-structure)'
      },
      {
        code: `
// --shared
.hero-banner { > .title {} }`,
        description: '--shared comments at the file top level are invalid',
        message: 'Place the shared section comment matching `sharedCommentPattern` (current: `/--shared/i`) directly under the root Block (root wrappers like `@layer`/`@supports`/`@media`/`@container`/`@scope` are allowed). Do not nest inside child rules. (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - --interaction section behavior', () => {
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
        code: `
.hero-banner {
  > .title {}

  // --interaction
  @at-root & {
    & .title:focus-visible {}
  }
}`,
        description: 'child combinator is not required inside --interaction (enforceChildCombinator relaxed)'
      },
      {
        code: `
.hero-banner {
  > .kv-box {}

  // --interaction
  @at-root & {
    > .kv-box {
      > .img {
        opacity: 0;
        transition: opacity 0.3s ease;
      }
    }
  }
}`,
        description: 'allow grandchild Elements inside --interaction'
      },
      {
        code: `
.hero-banner {
  // --interaction
  @at-root & {
    > .kv-box {
      > .inner-card {
        > .deep-panel {
          opacity: 1;
        }
      }
    }
  }
}`,
        description: 'allow deeper Block chains inside --interaction'
      },
      {
        code: `
.hero-banner {
  > .title {}

  // --interaction
  @at-root & {
    > .title {
      > .action-group {
        opacity: 1;
      }
    }
  }
}`,
        description: 'allow Element > Block inside --interaction'
      },
      {
        code: `
.hero-banner {
  // --interaction
  @at-root & {
    > .content {
      > .paragraph {
        > .emphasis {
          > .strong {
            > .mark {
              opacity: 1;
            }
          }
        }
      }
    }
  }
}`,
        description: 'remove Element chain depth limits inside --interaction'
      }
    ]
  })
})



describe('spiracss/class-structure - --shared section details', () => {
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
        code: `
.sample-block {
  > .element {}
  // --shared
  .utility-class {}
  .another-utility {}
}`,
        description: 'allow multiple rules inside --shared (treated as Blocks)'
      },
      {
        code: `
.sample-block {
  > .element {}
  // --shared
  .helper { .nested {} }
}`,
        description: 'nested rules inside --shared are allowed'
      },
      {
        code: `
.sample-block {
  > .element {}
  // --shared
  @media (min-width: 768px) {
    .responsive-class {}
  }
}`,
        description: '@media is allowed inside --shared'
      },
      {
        code: `
.sample-block {
  > .element {}
  // --shared
  .helper {}
  // --interaction
  @at-root & {
    &:hover {}
  }
}`,
        description: '--shared section ends when a --interaction comment appears'
      }
    ],

    reject: [
      {
        code: `
.sample-block {
  > .element {}
  // --shared
  .InvalidClassName {}
}`,
        description: 'invalid class names are still detected inside --shared',
        message: invalidNameMessage('InvalidClassName')
      }
    ]
  })
})

describe('spiracss/class-structure - comment pattern flags', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: true,
        naming: { blockCase: 'kebab' },
        sharedCommentPattern: /--shared/g
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [],

    reject: [
      {
        code: `
.hero-banner {
  > .title {}
  > .caption {
    // --shared
    .note {}
  }
  > .meta {
    // --shared
    .note {}
  }
}
        `,
        description: 'detect shared comments with the g flag reliably',
        warnings: [
          {
            message:
              'Place the shared section comment matching `sharedCommentPattern` (current: `/--shared/g`) directly under the root Block (root wrappers like `@layer`/`@supports`/`@media`/`@container`/`@scope` are allowed). Do not nest inside child rules. (spiracss/class-structure)'
          },
          {
            message:
              'Place the shared section comment matching `sharedCommentPattern` (current: `/--shared/g`) directly under the root Block (root wrappers like `@layer`/`@supports`/`@media`/`@container`/`@scope` are allowed). Do not nest inside child rules. (spiracss/class-structure)'
          }
        ]
      }
    ]
  })
})
