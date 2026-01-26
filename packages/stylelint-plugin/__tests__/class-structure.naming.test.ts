import assert from 'assert'

import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { invalidNameMessage, testRule, withClassMode } from './rule-test-utils.js'
import { lint } from './stylelint-helpers.js'

describe('spiracss/class-structure - naming.blockCase variations', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          blockCase: 'camel'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.heroBanner { > .title {} }`,
        description: 'camelCase Block names are allowed'
      },
      {
        code: `.navMenu { > .item {} }`,
        description: 'camelCase Block names (2 words) are allowed'
      }
    ],

    reject: [
      {
        code: `.hero-banner { > .title {} }`,
        description: 'kebab-case is rejected in camelCase mode',
        warnings: [
          {
            message: invalidNameMessage('hero-banner', { blockCase: 'camel' })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: `.HeroBanner { > .title {} }`,
        description: 'PascalCase is rejected in camelCase mode',
        warnings: [
          {
            message: invalidNameMessage('HeroBanner', { blockCase: 'camel' })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      }
    ]
  })

  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          blockCase: 'pascal'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.HeroBanner { > .title {} }`,
        description: 'PascalCase Block names are allowed'
      },
      {
        code: `.NavMenu { > .item {} }`,
        description: 'PascalCase Block names (2 words) are allowed'
      }
    ],

    reject: [
      {
        code: `.heroBanner { > .title {} }`,
        description: 'camelCase is rejected in PascalCase mode',
        warnings: [
          {
            message: invalidNameMessage('heroBanner', { blockCase: 'pascal' })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: `.hero-banner { > .title {} }`,
        description: 'kebab-case is rejected in PascalCase mode',
        warnings: [
          {
            message: invalidNameMessage('hero-banner', { blockCase: 'pascal' })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      }
    ]
  })

  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          blockCase: 'snake'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.hero_banner { > .title {} }`,
        description: 'snake_case Block names are allowed'
      },
      {
        code: `.nav_menu { > .item {} }`,
        description: 'snake_case Block names (2 words) are allowed'
      }
    ],

    reject: [
      {
        code: `.hero-banner { > .title {} }`,
        description: 'kebab-case is rejected in snake_case mode',
        warnings: [
          {
            message: invalidNameMessage('hero-banner', { blockCase: 'snake' })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: `.heroBanner { > .title {} }`,
        description: 'camelCase is rejected in snake_case mode',
        warnings: [
          {
            message: invalidNameMessage('heroBanner', { blockCase: 'snake' })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      }
    ]
  })
})



describe('spiracss/class-structure - naming.blockMaxWords option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        naming: {
          blockCase: 'kebab',
          blockMaxWords: 3
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner-large { > .title {} }',
        description: 'allow Block name up to 3 words'
      }
    ],

    reject: [
      {
        code: '.hero-banner-large-extra { > .title {} }',
        description: 'invalid when Block name exceeds word limit',
        warnings: [
          {
            message: invalidNameMessage('hero-banner-large-extra', {
              blockCase: 'kebab',
              blockMaxWords: 3
            })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      }
    ]
  })
})



describe('spiracss/class-structure - naming default word count', () => {
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

    reject: [
      {
        code: '.block {}',
        description: 'Block names require at least 2 words by default',
        noNormalizeRootBlock: true,
        message:
          'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - naming.modifierPrefix option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          modifierPrefix: '_'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.hero-banner { &._primary {} }`,
        description: 'Modifiers with "_" prefix are allowed'
      },
      {
        code: `.hero-banner { &._primary-large {} }`,
        description: 'Two-word modifiers with "_" prefix are allowed'
      }
    ],

    reject: [
      {
        code: `.hero-banner { &.-primary {} }`,
        description: '"-" prefix does not match as modifier in "_" mode (invalid)',
        message: 'Only modifier classes may be appended to `&`. Found `-primary`. Use `&.<modifier>`. Example: `&._primary`. If not a modifier, move it to its own selector. (spiracss/class-structure)'
      }
    ]
  })

  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          modifierPrefix: '--'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.hero-banner { &.--primary {} }`,
        description: 'Modifiers with "--" prefix are allowed'
      },
      {
        code: `.hero-banner { &.--primary-large {} }`,
        description: 'Two-word modifiers with "--" prefix are allowed'
      }
    ],

    reject: [
      {
        code: `.hero-banner { &.-primary {} }`,
        description: '"-" prefix does not match as modifier in "--" mode (invalid)',
        message: 'Only modifier classes may be appended to `&`. Found `-primary`. Use `&.<modifier>`. Example: `&.--primary`. If not a modifier, move it to its own selector. (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - naming.elementCase/modifierCase option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          elementCase: 'camel',
          modifierCase: 'camel'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.hero-banner { > .main {} }`,
        description: 'camelCase Element names (1 word) are allowed'
      },
      {
        code: `.hero-banner { &.-primaryLarge {} }`,
        description: 'camelCase Modifier names are allowed'
      },
      {
        code: `.hero-banner { > .main { &.-highlighted {} } }`,
        description: 'Element + camelCase Modifier combination'
      },
      {
        code: `.hero-banner { > .main-title {} }`,
        description: 'kebab-case Element matches as Block and is allowed as Block > Block because of ">"'
      }
    ],

    reject: [
      {
        code: `.hero-banner { > .mainTitle {} }`,
        description: 'camelCase Element (2 words) is invalid',
        message: invalidNameMessage('mainTitle', {
          elementCase: 'camel',
          modifierCase: 'camel'
        })
      },
      {
        code: `.hero-banner { &.-primary-large {} }`,
        description: 'kebab-case Modifier is invalid in camelCase mode',
        message: 'Only modifier classes may be appended to `&`. Found `-primary-large`. Use `&.<modifier>`. Example: `&.-primary`. If not a modifier, move it to its own selector. (spiracss/class-structure)'
      }
    ]
  })

  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          elementCase: 'pascal',
          modifierCase: 'pascal'
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.hero-banner { > .Main {} }`,
        description: 'PascalCase Element names (1 word) are allowed'
      },
      {
        code: `.hero-banner { &.-PrimaryLarge {} }`,
        description: 'PascalCase Modifier names are allowed'
      }
    ],

    reject: [
      {
        code: `.hero-banner { > .mainTitle {} }`,
        description: 'camelCase Element is invalid in PascalCase mode',
        message: invalidNameMessage('mainTitle', {
          elementCase: 'pascal',
          modifierCase: 'pascal'
        })
      },
      {
        code: `.hero-banner { > .MainTitle {} }`,
        description: 'PascalCase Element (2 words) is invalid',
        message: invalidNameMessage('MainTitle', {
          elementCase: 'pascal',
          modifierCase: 'pascal'
        })
      },
      {
        code: `.hero-banner { &.-primaryLarge {} }`,
        description: 'camelCase Modifier is invalid in PascalCase mode',
        message: 'Only modifier classes may be appended to `&`. Found `-primaryLarge`. Use `&.<modifier>`. Example: `&.-Primary`. If not a modifier, move it to its own selector. (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - naming.customPatterns (all specified)', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          customPatterns: {
            block: /^b-[a-z]+$/,
            element: /^e-[a-z]+$/,
            modifier: /^m-[a-z]+$/
          }
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.b-hero { > .e-title {} }`,
        description: 'Blocks and Elements following custom patterns are allowed'
      },
      {
        code: `.b-hero { &.m-primary {} }`,
        description: 'Modifiers following custom patterns are allowed'
      },
      {
        code: `.b-hero { > .e-title { &.m-large {} } }`,
        description: 'Element + Modifier combination with custom patterns'
      }
    ],

    reject: [
      {
        code: `.hero-banner { > .title {} }`,
        description: 'kebab-case is rejected in custom pattern mode (both Block and Element)',
        warnings: [
          {
            message: invalidNameMessage('hero-banner', {
              customPatterns: {
                block: /^b-[a-z]+$/,
                element: /^e-[a-z]+$/,
                modifier: /^m-[a-z]+$/
              }
            })
          },
          {
            message: invalidNameMessage('title', {
              customPatterns: {
                block: /^b-[a-z]+$/,
                element: /^e-[a-z]+$/,
                modifier: /^m-[a-z]+$/
              }
            })
          }
        ]
      },
      {
        code: `.b-hero { > .title {} }`,
        description: 'Element does not follow custom pattern',
        message: invalidNameMessage('title', {
          customPatterns: {
            block: /^b-[a-z]+$/,
            element: /^e-[a-z]+$/,
            modifier: /^m-[a-z]+$/
          }
        })
      }
    ]
  })
})



describe('spiracss/class-structure - naming.customPatterns (partial override)', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        external: { classes: [], prefixes: [] },
        childCombinator: true,
        naming: {
          blockCase: 'kebab',
          customPatterns: {
            block: /^b-[a-z]+$/
            // Defaults apply when element/modifier patterns are omitted.
          }
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `.b-hero { > .title {} }`,
        description: 'Block uses custom pattern, Element uses kebab'
      },
      {
        code: `.b-hero { &.-primary {} }`,
        description: 'Block uses custom pattern, Modifier uses kebab with "-" prefix'
      }
    ],

    reject: [
      {
        code: `.hero-banner { > .title {} }`,
        description: 'Block does not follow custom pattern',
        warnings: [
          {
            message: invalidNameMessage('hero-banner', {
              blockCase: 'kebab',
              customPatterns: {
                block: /^b-[a-z]+$/
              }
            })
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: `.b-hero { > .titleText {} }`,
        description: 'Element is camelCase, so invalid in kebab mode',
        message: invalidNameMessage('titleText', {
          blockCase: 'kebab',
          customPatterns: {
            block: /^b-[a-z]+$/
          }
        })
      }
    ]
  })
})


describe('spiracss/class-structure - naming.customPatterns validation', () => {
  it('reports invalid customPatterns', async () => {
    const result = await lint({
      code: '.hero-banner { }',
      customSyntax: 'postcss-scss',
      config: {
        plugins: [classStructure],
        rules: {
          'spiracss/class-structure': [
            true,
            {
              naming: {
                customPatterns: {
                  block: 'invalid' as unknown as RegExp
                }
              }
            }
          ]
        }
      }
    })
    const invalidOptionWarnings = result.results[0]?.invalidOptionWarnings ?? []
    const warnings = result.results[0]?.warnings ?? []
    const warningTexts = [
      ...invalidOptionWarnings.map((warning) => warning.text),
      ...warnings.map((warning) => warning.text)
    ]
    assert.ok(warningTexts.some((text) => text.includes('naming.customPatterns.block')))
  })

})
