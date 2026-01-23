import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { invalidNameMessage, testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - edge cases', () => {
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
        code: '.block-name {}',
        description: 'single Block'
      }
    ],

    reject: [
      {
        code: '.title { .element {} }',
        description: 'error when root Block is not found',
        message:
          'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
      },
      {
        code: '.BadBlock { > .title {} }',
        description: 'detect invalid class names in compound selectors (avoid missing non-base)',
        warnings: [
          {
            message: invalidNameMessage('BadBlock')
          },
          {
            message:
              'No root Block found. Define a top-level Block selector that matches the naming rules. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: '.Block {}',
        description: 'PascalCase is invalid in kebab-case mode',
        message: invalidNameMessage('Block')
      },
      {
        code: '.block_name {}',
        description: 'snake_case is invalid in kebab-case mode',
        message: invalidNameMessage('block_name')
      }
    ]
  })
})

describe('spiracss/class-structure - selector parse failure', () => {
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
        code: `
.block-name {
  > : {
    color: red;
  }
}`,
        description: 'emit a single warning on selector parse failure',
        warnings: [
          {
            message:
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: `> :`. (spiracss/class-structure)'
          }
        ]
      },
      {
        code: `
.block-name {
  > : {
    color: red;
  }
}

.block {
  > : {
    color: blue;
  }
}`,
        description: 'emit a single warning even when multiple selectors fail',
        warnings: [
          {
            message:
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: `> :`. (spiracss/class-structure)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/class-structure - special patterns', () => {
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
        code: '.hero-banner {}',
        description: 'empty rule set'
      },
      {
        code: '.block { > .element { /* comments only */ } }',
        description: 'rule set with comments only'
      }
    ],

    reject: [
      {
        code: '.123-invalid {}',
        description: 'class names starting with numbers (invalid CSS)',
        message: invalidNameMessage('123-invalid')
      },
      {
        code: '.block--modifier {}',
        description: 'BEM-style modifier (not supported in SpiraCSS)',
        message: invalidNameMessage('block--modifier')
      }
    ]
  })
})

describe('spiracss/class-structure - :global skip', () => {
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
        code: ':global(.u-hidden) {}',
        description: ':global skips naming checks'
      },
      {
        code: '.block { :global(.utility) {} }',
        description: ':global inside Block is also skipped'
      }
    ]
  })
})

describe('spiracss/class-structure - pseudo element/class combinations', () => {
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
        code: '.block::before { content: ""; }',
        description: 'pseudo element ::before is excluded from class checks'
      },
      {
        code: '.block::after { content: ""; }',
        description: 'pseudo element ::after is excluded from class checks'
      },
      {
        code: '.block:hover { color: red; }',
        description: 'pseudo class :hover is excluded from class checks'
      },
      {
        code: '.block:not(.active) { display: none; }',
        description: 'classes inside :not() are validated'
      },
      {
        code: '.hero-banner { > .title::before { content: "★"; } }',
        description: 'add pseudo element to Element'
      },
      {
        code: '.hero-banner { &.-primary:hover { background: blue; } }',
        description: 'add pseudo class to Modifier'
      }
    ],

    reject: [
      {
        code: '.block:not(.InvalidClass) { display: none; }',
        description: 'invalid class names inside :not() are detected',
        message: invalidNameMessage('InvalidClass')
      }
    ]
  })
})
