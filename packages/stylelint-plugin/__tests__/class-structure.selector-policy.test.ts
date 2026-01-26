import assert from 'assert'

import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { invalidNameMessage, testRule, withClassMode, withDataMode } from './rule-test-utils.js'
import { lint } from './stylelint-helpers.js'

describe('spiracss/class-structure - attribute selector combinations', () => {
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
        code: '.block[data-active] { color: red; }',
        description: 'add attribute selector to Block'
      },
      {
        code: '.hero-banner[aria-label] { > .title {} }',
        description: 'Block with attribute selector + Element'
      },
      {
        code: '.block { > .element[data-testid] {} }',
        description: 'add non-reserved data attribute to Element'
      },
      {
        code: '.block[data-x][data-y] { > .title {} }',
        description: 'multiple attribute selectors'
      },
      {
        code: '.block { &[data-testid] {} }',
        description: 'non-reserved data attributes directly under & are ignored'
      },
      {
        code: '.block:has([data-state="open"]) { color: red; }',
        description: 'reserved keys inside :has() are out of scope'
      },
      {
        code: '.block:not(:has([data-state="open"])) { color: red; }',
        description: ':has() inside :not() is out of scope'
      },
      {
        code: '.block:is(:not(.foo [data-state="open"])) { color: red; }',
        description: 'compound selectors inside nested pseudos are out of scope'
      },
      {
        code: '.block:not(.foo [data-state="open"]) { color: red; }',
        description: 'compound selectors inside :not() are out of scope'
      },
      {
        code: `
.parent-block {
  [data-variant="primary"] {
    color: red;
  }
}`,
        description: 'reserved keys on descendants are out of scope'
      }
    ],

    reject: [
      {
        code: '.InvalidBlock[data-x] { > .title {} }',
        description: 'invalid class names are detected even with attribute selectors',
        warnings: [
          {
            message: invalidNameMessage('InvalidBlock')
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: '.block[data-variant="primary"] { > .title {} }',
        description: 'class mode disallows data-variant',
        message: 'Attribute `data-variant` is disabled because `selectorPolicy.variant.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block[aria-expanded="true"] { > .title {} }',
        description: 'class mode disallows state aria attributes',
        message: 'Attribute `aria-expanded` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block { > .element[data-state="open"] {} }',
        description: 'class mode disallows data-state',
        message: 'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block { &[data-state="open"] {} }',
        description: 'class mode also disallows data-state on &',
        message: 'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block { &:not([data-state="open"]) {} }',
        description: 'class mode validates reserved keys inside :not()',
        message: 'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block:is([data-variant="primary"]) { color: red; }',
        description: 'class mode validates reserved keys inside :is()',
        message: 'Attribute `data-variant` is disabled because `selectorPolicy.variant.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block:where([aria-expanded="true"]) { color: red; }',
        description: 'class mode validates reserved keys inside :where()',
        message: 'Attribute `aria-expanded` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: ':not(.block) [data-variant="primary"] { color: red; }',
        description: 'error if root Block is missing even when a valid Block exists inside :not()',
        message:
          'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
      },
      {
        code: '.foo:is(.block)[data-state="open"] { color: red; }',
        description: 'validate reserved keys even for SpiraCSS classes inside :is()',
        message: 'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.foo:not(.block)[data-state="open"] { color: red; }',
        description: 'validate reserved keys even for SpiraCSS classes inside :not()',
        warnings: [
          {
            message:
              'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: '.foo:where(.block)[data-state="open"] { color: red; }',
        description: 'validate reserved keys even for SpiraCSS classes inside :where()',
        message: 'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - attribute allowance in data mode', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withDataMode({
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block[data-variant="primary"] { > .title {} }',
        description: 'data mode data-variant'
      },
      {
        code: '.block[aria-expanded="true"] { > .title {} }',
        description: 'data mode aria allowlist'
      },
      {
        code: '.block[data-testid] { > .title {} }',
        description: 'data mode ignores non-reserved data attributes'
      },
      {
        code: '.block[aria-label] { > .title {} }',
        description: 'data mode ignores non-reserved aria attributes'
      }
    ]
  })
})





describe('spiracss/class-structure - modifiers in data mode', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withDataMode({
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' },
        selectorPolicy: {
          variant: { dataKeys: ['data-theme', 'data-size'] }
        }
      })
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
.block {
  &.-primary {
    > .title {}
  }
}
        `,
        description: 'modifier classes are disabled in data mode',
        message:
          'Modifier classes are disabled because `selectorPolicy.variant.mode` and `selectorPolicy.state.mode` are both `data`. Use variant attributes (current: `data-theme`, `data-size`) or state attributes (current: `data-state`, `aria-expanded`, `aria-selected`, `aria-disabled`) instead, or enable class mode in `selectorPolicy`. (spiracss/class-structure)'
      }
    ]
  })
})

describe('spiracss/class-structure - data value naming', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withDataMode({
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block[data-variant="primary-dark"] { > .title {} }',
        description: 'data-variant defaults to 1-2 words in kebab'
      },
      {
        code: '.block[data-state="open-modal"] { > .title {} }',
        description: 'data-state also defaults to 1-2 words in kebab'
      }
    ],

    reject: [
      {
        code: '.block[data-variant="primary-dark-large"] { > .title {} }',
        description: '3+ words are invalid',
        message:
          'Attribute `data-variant` value `primary-dark-large` does not match `selectorPolicy` valueNaming (case: `kebab`, maxWords: `2`). Rename it to match the configured rules. (spiracss/class-structure)'
      },
      {
        code: '.block[data-state="open-modal-loading"] { > .title {} }',
        description: 'state with 3+ words is invalid',
        message:
          'Attribute `data-state` value `open-modal-loading` does not match `selectorPolicy` valueNaming (case: `kebab`, maxWords: `2`). Rename it to match the configured rules. (spiracss/class-structure)'
      }
    ]
  })

  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withDataMode({
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' },
        selectorPolicy: {
          valueNaming: { case: 'snake', maxWords: 2 },
          variant: { mode: 'data', dataKeys: ['data-variant'] },
          state: {
            mode: 'data',
            dataKey: 'data-state',
            ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
            valueNaming: { maxWords: 1 }
          }
        }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block[data-variant="primary_dark"] { > .title {} }',
        description: 'variant allows up to 2 words in snake_case'
      },
      {
        code: '.block[data-state="open"] { > .title {} }',
        description: 'state is forced to 1 word'
      }
    ],

    reject: [
      {
        code: '.block[data-variant="primary-dark"] { > .title {} }',
        description: 'variant disallows kebab',
        message:
          'Attribute `data-variant` value `primary-dark` does not match `selectorPolicy` valueNaming (case: `snake`, maxWords: `2`). Rename it to match the configured rules. (spiracss/class-structure)'
      },
      {
        code: '.block[data-state="open_state"] { > .title {} }',
        description: 'state disallows 2 words',
        message:
          'Attribute `data-state` value `open_state` does not match `selectorPolicy` valueNaming (case: `snake`, maxWords: `1`). Rename it to match the configured rules. (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - selectorPolicy mixed mode', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      {
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' },
        selectorPolicy: {
          variant: { mode: 'data', dataKeys: ['data-variant'] },
          state: { mode: 'class' }
        }
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block[data-variant="primary"] { > .title {} }',
        description: 'variant=data allows data-variant'
      },
      {
        code: '.block { &.-active {} }',
        description: 'state=class allows modifiers'
      }
    ],

    reject: [
      {
        code: '.block[data-state="open"] { > .title {} }',
        description: 'state=class disallows data-state',
        message: 'Attribute `data-state` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      },
      {
        code: '.block[aria-expanded="true"] { > .title {} }',
        description: 'state=class disallows aria',
        message:
          'Attribute `aria-expanded` is disabled because `selectorPolicy.state.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      }
    ]
  })

  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      {
        elementDepth: 4,
        childCombinator: false,
        naming: { blockCase: 'kebab' },
        selectorPolicy: {
          variant: { mode: 'class' },
          state: {
            mode: 'data',
            dataKey: 'data-state',
            ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
          }
        }
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block[data-state="open"] { > .title {} }',
        description: 'state=data allows data-state'
      },
      {
        code: '.block[aria-expanded="true"] { > .title {} }',
        description: 'state=data allows aria'
      },
      {
        code: '.block { &.-primary {} }',
        description: 'variant=class allows modifiers'
      }
    ],

    reject: [
      {
        code: '.block[data-variant="primary"] { > .title {} }',
        description: 'variant=class disallows data-variant',
        message: 'Attribute `data-variant` is disabled because `selectorPolicy.variant.mode` is `class`. Use modifier classes instead (e.g., `&.-primary`). (spiracss/class-structure)'
      }
    ]
  })
})



describe('spiracss/class-structure - selectorPolicy validation', () => {
  const assertInvalidSelectorPolicy = async (
    selectorPolicy: Record<string, unknown>,
    description: string
  ): Promise<void> => {
    const result = await lint({
      code: '.hero-banner { }',
      customSyntax: 'postcss-scss',
      config: {
        plugins: [classStructure],
        rules: {
          'spiracss/class-structure': [
            true,
            {
              selectorPolicy
            }
          ]
        }
      }
    })
    const warnings = result.results[0]?.warnings ?? []
    const invalidOptionWarnings = result.results[0]?.invalidOptionWarnings ?? []
    const warningTexts = [
      ...invalidOptionWarnings.map((warning) => warning.text),
      ...warnings.map((warning) => warning.text)
    ]
    assert.ok(result.errored, description)
    assert.ok(
      warningTexts.some((text) => text.includes('selectorPolicy')),
      description
    )
  }

  it('reports invalid selectorPolicy mode', async () => {
    await assertInvalidSelectorPolicy(
      {
        variant: { mode: '' as unknown as 'data' }
      },
      'invalid selectorPolicy.variant.mode'
    )
  })

  it('reports non-string selectorPolicy keys', async () => {
    await assertInvalidSelectorPolicy(
      {
        variant: { mode: 'data', dataKeys: ['data-variant', 1 as unknown as string] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      },
      'invalid selectorPolicy.variant.dataKeys'
    )

    await assertInvalidSelectorPolicy(
      {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded', 1 as unknown as string] }
      },
      'invalid selectorPolicy.state.ariaKeys'
    )
  })

  it('reports non-array selectorPolicy keys', async () => {
    await assertInvalidSelectorPolicy(
      {
        variant: { mode: 'data', dataKeys: 'data-variant' as unknown as string },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded'] }
      },
      'invalid selectorPolicy.variant.dataKeys (non-array)'
    )

    await assertInvalidSelectorPolicy(
      {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: 'aria-expanded' as unknown as string }
      },
      'invalid selectorPolicy.state.ariaKeys (non-array)'
    )
  })

  it('reports empty selectorPolicy key arrays', async () => {
    await assertInvalidSelectorPolicy(
      {
        variant: { mode: 'data', dataKeys: [] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded'] }
      },
      'invalid selectorPolicy.variant.dataKeys (empty)'
    )

    await assertInvalidSelectorPolicy(
      {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      },
      'invalid selectorPolicy.state.ariaKeys (empty)'
    )
  })

  it('reports invalid selectorPolicy valueNaming', async () => {
    await assertInvalidSelectorPolicy(
      {
        valueNaming: { case: 'invalid' as unknown as 'kebab' }
      },
      'invalid selectorPolicy.valueNaming.case'
    )

    await assertInvalidSelectorPolicy(
      {
        valueNaming: { maxWords: 0 }
      },
      'invalid selectorPolicy.valueNaming.maxWords'
    )
  })
})
