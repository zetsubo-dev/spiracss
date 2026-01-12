import interactionScope from '../dist/esm/rules/spiracss-interaction-scope.js'
import { testRule, withClassMode, withDataMode } from './rule-test-utils.js'

describe('spiracss/interaction-scope - basic checks', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover', ':focus', ':active'],
        requireAtRoot: true,
        requireComment: true,
        requireTail: true,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  > .title {}
  // --interaction
  @at-root & {
    &:hover {}
  }
}`,
        description: '@at-root & + comment + tail placement'
      },
      {
        code: `
.block {
  // --interaction
  @at-root & {
    & > .github {
      & > a:hover {
        opacity: 0.7;
      }
    }
  }
}`,
        description: 'explicitly nest with & even inside @at-root &'
      },
      {
        code: `
.block {
  > .title {}
  // --interaction
  @at-root & {
    // Allow internal comments and declarations
    opacity: 0;
    &:hover {}
  }
}`,
        description: 'comment/tail checks work even with comments/declarations inside the interaction block'
      },
      {
        code: `
@layer components {
  .block {
    > .title {}
    // --interaction
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: 'recognizes interaction even when root Block is wrapped in @layer'
      },
      {
        code: `
@media (min-width: 768px) {
  .block {
    > .title {}
    // --interaction
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: 'recognizes interaction even when root Block is wrapped in @media'
      },
      {
        code: `
@container (min-width: 480px) {
  .block {
    > .title {}
    // --interaction
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: 'recognizes interaction even when root Block is wrapped in @container'
      },
      {
        code: `
@scope (.theme) {
  .block {
    > .title {}
    // --interaction
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: 'recognizes interaction even when root Block is wrapped in @scope'
      }
    ],

    reject: [
      {
        code: `
.block {
  &:hover {}
}`,
        description: 'missing @at-root (requireAtRoot: true violation)',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          },
          {
            message: 'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... } (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  // --interaction
  @at-root {
    &:hover {}
  }
}`,
        description: 'Reject @at-root without "&"',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  // --interaction
  @at-root & {
    > .github {
      > a:hover {
        opacity: 0.7;
      }
    }
  }
}`,
        description: 'omitting & inside @at-root & is an error',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  // --interaction
  @at-root & {
    .parent &:hover {
      opacity: 0.7;
    }
  }
}`,
        description: 'Selectors without a leading "&" should error',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  // --interaction
  @at-root & {
    > &:hover {
      opacity: 0.7;
    }
  }
}`,
        description: 'Leading combinator before "&" should error',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  > .child {
    // --interaction
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: 'interaction block is inside a child rule',
        warnings: [
          {
            message: 'The interaction block must be directly under the root Block. Move the @at-root block out of child rules. (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  > .title {}
  @at-root & {
    &:hover {}
  }
}`,
        description: 'missing comment (requireComment: true violation)',
        message: 'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... } (spiracss/interaction-scope)'
      },
      {
        code: `
.block {
  // --interaction
  @at-root & {
    &:hover {}
  }
  > .title {}
}`,
        description: 'not placed at the end (requireTail: true violation)',
        message: 'Place the @at-root interaction block at the end of the root Block (after all other rules). (spiracss/interaction-scope)'
      },
      {
        code: `
.block {
  > .title {}
  // --interaction
  @at-root & {
    opacity: 0;
    &:hover {}
  }
  > .another {}
}`,
        description: 'detect tail-placement violations even if the interaction block starts with declarations',
        message: 'Place the @at-root interaction block at the end of the root Block (after all other rules). (spiracss/interaction-scope)'
      }
    ]
  })
})

describe('spiracss/interaction-scope - selector parse failure', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover'],
        requireAtRoot: false,
        requireComment: false,
        requireTail: false
      })
    ],
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
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. (spiracss/interaction-scope)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/interaction-scope - requireAtRoot: false', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover'],
        requireAtRoot: false,
        requireComment: false,
        requireTail: false
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block { &:hover {} }',
        description: 'when requireAtRoot: false, @at-root is optional'
      }
    ]
  })
})

describe('spiracss/interaction-scope - data-state / data-variant handling', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withDataMode({
        requireAtRoot: true,
        requireComment: true,
        requireTail: true
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  // --interaction
  @at-root & {
    &[data-state="active"] {}
    &[aria-expanded="true"] {}
  }
}`,
        description: 'data-state / aria-* go in the interaction section'
      },
      {
        code: `
.block {
  // --interaction
  @at-root & {
    &[data-variant="primary"] {}
  }
}`,
        description: 'data-variant is allowed in the interaction section'
      }
    ],

    reject: [
      {
        code: `
.block {
  &[data-state="active"] {}
}`,
        description: 'data-state outside interaction is an error',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          },
          {
            message: 'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... } (spiracss/interaction-scope)'
          }
        ]
      },
      {
        code: `
.block {
  &[data-state="loading"][data-variant="danger"] {}
}`,
        description: 'data-state and data-variant together are an error',
        warnings: [
          {
            message: 'Do not mix state selectors ("data-state", "aria-expanded", "aria-selected", "aria-disabled") with variant selectors ("data-variant") in the same selector. Split into separate selectors. (spiracss/interaction-scope)'
          },
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          },
          {
            message: 'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... } (spiracss/interaction-scope)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/interaction-scope - combined warnings', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover', ':focus'],
        requireAtRoot: true,
        requireComment: true,
        requireTail: true,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
.block {
  > .title {}
  &:hover {}
  &:focus {}
}`,
        description: 'multiple pseudos with no @at-root and no comment',
        warnings: [
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          },
          {
            message: 'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... } (spiracss/interaction-scope)'
          },
          {
            message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
          },
          {
            message: 'Add "// --interaction" immediately before the @at-root block. Example: // --interaction @at-root & { ... } (spiracss/interaction-scope)'
          }
        ]
      }
    ]
  })
})

describe('interaction-scope - ignored pseudos not in allowedPseudos', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover'],
        requireAtRoot: true,
        requireComment: false,
        requireTail: false
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  @at-root & {
    &:visited {}
  }
}`,
        description: ':visited not in allowedPseudos is ignored'
      }
    ]
  })
})

describe('interaction-scope - enforceWithCommentOnly', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover'],
        requireAtRoot: true,
        requireComment: true,
        requireTail: false,
        interactionCommentPattern: /--interaction/i,
        enforceWithCommentOnly: true
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block { &:hover {} }',
        description: 'when enforceWithCommentOnly: true, skip checks without a comment'
      }
    ],

    reject: [
      {
        code: `
.block {
  // --interaction
  &:hover {}
}`,
        description: 'when a comment exists, check requireAtRoot and others',
        message: 'Interaction selectors (pseudos/state) must be inside "@at-root & { ... }" and each selector must start with "&". Example: // --interaction @at-root & { &:hover { ... } } (spiracss/interaction-scope)'
      }
    ]
  })
})

describe('interaction-scope - behavior inside @media/@supports', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover'],
        requireAtRoot: true,
        requireComment: true,
        requireTail: true,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  > .element {}
  // --interaction
  @media (min-width: 768px) {
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: '@at-root & inside @media counts as tail'
      },
      {
        code: `
.block {
  > .element {}
  // --interaction
  @supports (display: grid) {
    @at-root & {
      &:hover {}
    }
  }
}`,
        description: '@at-root & inside @supports counts as tail'
      },
      {
        code: `
.block {
  > .element {}
  // --interaction
  @at-root & {
    &:hover {}
    @media (min-width: 768px) {
      &:focus {}
    }
  }
}`,
        description: '@media inside @at-root is allowed'
      }
    ],

    reject: [
      {
        code: `
.block {
  > .element {}
  // --interaction
  @media (min-width: 768px) {
    @at-root & {
      &:hover {}
    }
  }
  > .another {}
}`,
        description: 'not tail placement even inside @media is an error',
        message: 'Place the @at-root interaction block at the end of the root Block (after all other rules). (spiracss/interaction-scope)'
      }
    ]
  })
})

describe('interaction-scope - comment pattern flags', () => {
  testRule({
    plugins: [interactionScope],
    ruleName: interactionScope.ruleName,
    config: [
      true,
      withClassMode({
        allowedPseudos: [':hover'],
        requireAtRoot: true,
        requireComment: true,
        requireTail: true,
        interactionCommentPattern: /--interaction/g
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  // --interaction
  @at-root & {
    &:hover {}
  }
}

.block-alt {
  // --interaction
  @at-root & {
    &:hover {}
  }
}
        `,
        description: 'detect interaction comments with the g flag reliably'
      }
    ],

    reject: []
  })
})
