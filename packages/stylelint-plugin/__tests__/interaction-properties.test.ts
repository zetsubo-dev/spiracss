import interactionProperties from '../dist/esm/rules/spiracss-interaction-properties.js'
import { testRule } from './rule-test-utils.js'

describe('spiracss/interaction-properties - basics', () => {
  testRule({
    plugins: [interactionProperties],
    ruleName: interactionProperties.ruleName,
    config: [
      true,
      {
        interactionCommentPattern: /--interaction/i
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  display: block;

  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }
}
        `,
        description: 'collect transition declarations in the interaction section'
      },
      {
        code: `
.block-name {
  // --interaction
  opacity: 0;
  transition: opacity 0.2s ease;
}
        `,
        description: 'treat multiple declarations after the comment as interaction'
      },
      {
        code: `
.block-name {
  // --interaction
  transition: opacity 0.2s ease;
}
        `,
        description: 'treat the declaration immediately after the comment as interaction'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;

    &:hover {
      opacity: 1;
      transform: translateY(-2px);
    }
  }
}
        `,
        description: 'allow multiple transition properties'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition-property: opacity, transform;
  }
}
        `,
        description: 'allow transition-property lists'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
        `,
        description: 'allow cubic-bezier timing functions'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: opacity 0.2s steps(4, end);
  }
}
        `,
        description: 'allow steps() timing functions'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: opacity var(--motion-fast) ease;
  }
}
        `,
        description: 'allow var() for transition timing values'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    animation: fade-in 0.2s ease;
  }
}
        `,
        description: 'allow animation inside interaction'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    animation: fade-in 0.2s ease, slide-up 0.3s ease;
  }
}
        `,
        description: 'allow multiple animations in the shorthand'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition-behavior: allow-discrete;
  }
}
        `,
        description: 'allow transition-behavior inside interaction'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    animation-timeline: scroll();
    animation-range: entry 0% exit 100%;
  }
}
        `,
        description: 'allow animation timeline and range inside interaction'
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    animation-range-start: entry 10%;
    animation-range-end: exit 90%;
  }
}
        `,
        description: 'allow animation range start/end inside interaction'
      },
      {
        code: `
@keyframes fade-in {
  from {
    animation-timing-function: linear;
  }
  to {
    opacity: 1;
  }
}
        `,
        description: 'ignore animation properties inside keyframes'
      }
    ],

    reject: [
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: all 0.2s ease;
  }
}
        `,
        description: 'disallow transition: all',
        warnings: [
          {
            message:
              'Avoid "transition: all". List explicit properties (e.g., "transition: opacity 0.2s"). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  transition-property: all;
}
        `,
        description: 'disallow transition-property: all',
        warnings: [
          {
            message:
              'Avoid "transition-property: all". List explicit properties (e.g., "transition-property: opacity"). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: var(--motion-fast);
  }
}
        `,
        description: 'reject transition values without explicit properties',
        warnings: [
          {
            message:
              'Transition must include explicit property names (e.g., "transition: opacity 0.2s"). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  opacity: 0;

  // --shared
  transition: opacity 0.2s ease;
}
        `,
        description: 'do not treat declarations after shared comment as interaction',
        warnings: [
          {
            message:
              '"transition" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: inherit;
  }
}
        `,
        description: 'disallow keyword values in transition',
        warnings: [
          {
            message:
              'Transition property "inherit" is not allowed. Use explicit properties (no custom properties or keywords like inherit/initial/unset/revert/revert-layer). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  .child {
    // --interaction
    transition: opacity 0.2s ease;
  }
}
        `,
        description: 'ignore // --interaction inside child rules',
        warnings: [
          {
            message:
              '"transition" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  transition: opacity 0.2s ease;
}
        `,
        description: 'reject transition outside interaction',
        warnings: [
          {
            message:
              '"transition" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: 0.2s ease;
  }
}
        `,
        description: 'reject transition without explicit property',
        warnings: [
          {
            message:
              'Transition must include explicit property names (e.g., "transition: opacity 0.2s"). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  opacity: 0;

  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
        `,
        description: 'initial values for transitioned properties must be in interaction',
        warnings: [
          {
            message:
              '"opacity" is transitioned for .block-name. Move its declarations into the interaction section. (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition: none;
  }
}
        `,
        description: 'disallow transition: none',
        warnings: [
          {
            message:
              '"transition: none" / "transition-property: none" is not allowed. Use a tiny "transition-duration" instead (e.g., "transition-duration: 0.001s"). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    transition-property: none;
  }
}
        `,
        description: 'disallow transition-property: none',
        warnings: [
          {
            message:
              '"transition: none" / "transition-property: none" is not allowed. Use a tiny "transition-duration" instead (e.g., "transition-duration: 0.001s"). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  animation: fade-in 0.2s ease;
}
        `,
        description: 'reject animation outside interaction',
        warnings: [
          {
            message:
              '"animation" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  animation-name: fade-in;
  animation-delay: 120ms;
}
        `,
        description: 'reject individual animation properties outside interaction',
        warnings: [
          {
            message:
              '"animation-name" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          },
          {
            message:
              '"animation-delay" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  animation-timeline: scroll();
  animation-range: entry 0% exit 100%;
}
        `,
        description: 'reject scroll-driven animation properties outside interaction',
        warnings: [
          {
            message:
              '"animation-timeline" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          },
          {
            message:
              '"animation-range" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  animation-range-start: entry 10%;
  animation-range-end: exit 90%;
}
        `,
        description: 'reject animation range start/end outside interaction',
        warnings: [
          {
            message:
              '"animation-range-start" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          },
          {
            message:
              '"animation-range-end" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  transition-behavior: allow-discrete;
}
        `,
        description: 'reject transition-behavior outside interaction',
        warnings: [
          {
            message:
              '"transition-behavior" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  transition-duration: 0.2s;
}
        `,
        description: 'reject individual transition properties outside interaction',
        warnings: [
          {
            message:
              '"transition-duration" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    opacity: 0;
  }

  // --interaction
  @at-root & {
    > .title {
      transition: opacity 0.2s ease;
    }
  }
}
        `,
        description: 'reject element initial values outside interaction',
        warnings: [
          {
            message:
              '"opacity" is transitioned for .block-name > .title. Move its declarations into the interaction section. (spiracss/interaction-properties)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/interaction-properties - comment pattern flags', () => {
  testRule({
    plugins: [interactionProperties],
    ruleName: interactionProperties.ruleName,
    config: [
      true,
      {
        interactionCommentPattern: /--interaction/g,
        sharedCommentPattern: /--shared/g
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  // --interaction
  transition: opacity 0.2s ease;
}
        `,
        description: 'detect interaction comment even with the g flag'
      }
    ],

    reject: [
      {
        code: `
.block-name {
  // --interaction
  transition: opacity 0.2s ease;

  // --shared
  transition: opacity 0.2s ease;
}
        `,
        description: 'stop at shared comment even with the g flag',
        warnings: [
          {
            message:
              '"transition" must be declared inside the SpiraCSS interaction section under the root Block (// --interaction, typically in @at-root &). (spiracss/interaction-properties)'
          }
        ]
      }
    ]
  })
})
