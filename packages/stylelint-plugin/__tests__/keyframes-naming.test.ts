import assert from 'assert'
import scss from 'postcss-scss'
import type { PostcssResult, RuleContext } from 'stylelint'

import keyframesNaming from '../dist/esm/rules/spiracss-keyframes-naming.js'
import { testRule } from './rule-test-utils.js'

describe('spiracss/keyframes-naming - basics', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        blockWarnMissing: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.card-list {}

@keyframes card-list-fade-in {
  0% {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
        `,
        description: 'root Block + end placement keyframes (with % selectors)'
      },
      {
        code: `
.card-list {}

@keyframes card-list-fade-in {
  to {
    opacity: 1;
  }
}

@keyframes card-list-slide-up {
  to {
    transform: translateY(0);
  }
}
        `,
        description: 'multiple keyframes at the end are valid'
      },
      {
        code: `
.card-list {
  > .title {}
}

@keyframes card-list-title-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        description: 'keyframes for a known element name'
      },
      {
        code: `
.card-list {}

@-webkit-keyframes card-list-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        description: 'allow vendor-prefixed keyframes'
      },
      {
        code: `
@keyframes kf-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
        `,
        codeFilename: 'src/styles/partials/keyframes.scss',
        description: 'allow shared prefix only in shared files'
      }
    ],

    reject: [
      {
        code: `
.card-list {}

@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
        `,
        description: 'disallow keyframes inside @media',
        warnings: [
          {
            message:
              'Place `@keyframes` at the root level (not inside `@media`/`@layer`/etc). (spiracss/keyframes-naming)'
          }
        ]
      },
      {
        code: `
.card-list {}

@keyframes card-list-fade-in {
  to {
    opacity: 1;
  }
}

.card-list {
  color: #333;
}
        `,
        description: 'keyframes are not at the end of the file',
        warnings: [
          {
            message:
              'Place `@keyframes` at the end of the file (only comments/blank lines may follow). (spiracss/keyframes-naming)'
          }
        ]
      },
      {
        code: `
.card-list {}

@keyframes card-list-fade-in-out-more {
  to {
    opacity: 1;
  }
}
        `,
        description: 'action exceeds the max word count',
        warnings: [
          {
            message:
              'Keyframes `card-list-fade-in-out-more` must follow `card-list-{action}` or `card-list-{element}-{action}` (e.g., `card-list-fade-in` or `card-list-{element}-fade-in`; action: `kebab`, 1-3 words). (spiracss/keyframes-naming)'
          }
        ]
      },
      {
        code: `
.card-list {}

@keyframes card-list-title-fade-in-out {
  to {
    opacity: 1;
  }
}
        `,
        description: 'unknown element names are treated as action',
        warnings: [
          {
            message:
              'Keyframes `card-list-title-fade-in-out` must follow `card-list-{action}` or `card-list-{element}-{action}` (e.g., `card-list-fade-in` or `card-list-{element}-fade-in`; action: `kebab`, 1-3 words). (spiracss/keyframes-naming)'
          }
        ]
      },
      {
        code: `
@keyframes kf-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
        `,
        codeFilename: 'components/card-list/card-list.scss',
        description: 'shared prefix is not allowed outside shared files',
        warnings: [
          {
            message:
              'Shared keyframes `kf-loading-spin` (prefix `kf-`) must be defined in a shared keyframes file configured via `sharedFiles` (current: `/keyframes\\.scss$/`). (spiracss/keyframes-naming)'
          }
        ]
      },
      {
        code: `
@keyframes card-list-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        description: 'warn when the root Block cannot be resolved',
        warnings: [
          {
            message:
              'Cannot determine the root Block for `@keyframes` naming. Add a root Block selector or configure `blockSource`. (spiracss/keyframes-naming)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/keyframes-naming - :global is transparent', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        blockWarnMissing: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
:global(.card-list) {}

@keyframes card-list-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        description: 'resolve the root Block from :global selector'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - ignorePatterns', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        ignorePatterns: [/^vendor-/]
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.card-list {}

@keyframes vendor-spin {
  to {
    transform: rotate(360deg);
  }
}
        `,
        description: 'skip naming checks for ignorePatterns matches'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - ignorePatterns (global flag)', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        ignorePatterns: [/^vendor-/g]
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.card-list {}

@keyframes vendor-spin {
  to {
    transform: rotate(360deg);
  }
}
        `,
        description: 'ignorePatterns with global flag stay stable'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - ignoreSkipPlacement', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        ignorePatterns: [/^vendor-/],
        ignoreSkipPlacement: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@media (min-width: 768px) {
  @keyframes vendor-spin {
    to {
      transform: rotate(360deg);
    }
  }
}
        `,
        description: 'ignorePatterns can also skip placement checks'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - ignorePatterns placement default', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        ignorePatterns: [/^vendor-/]
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [],

    reject: [
      {
        code: `
@media (min-width: 768px) {
  @keyframes vendor-spin {
    to {
      transform: rotate(360deg);
    }
  }
}
        `,
        description: 'ignorePatterns does not skip placement by default',
        warnings: [
          {
            message:
              'Place `@keyframes` at the root level (not inside `@media`/`@layer`/etc). (spiracss/keyframes-naming)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/keyframes-naming - ignoreFiles (global flag)', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        ignoreFiles: [/ignored\.scss$/g]
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
        `,
        codeFilename: 'components/card-list/ignored.scss',
        description: 'ignoreFiles with global flag stays stable'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - ignoreFiles (string suffix)', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        ignoreFiles: ['ignored.scss']
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
        `,
        codeFilename: 'components/card-list/ignored.scss',
        description: 'ignoreFiles supports string suffix patterns'
      },
      {
        code: `
@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
        `,
        codeFilename: 'components\\card-list\\ignored.scss',
        description: 'ignoreFiles matches Windows-style paths'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - blockSource', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        blockSource: 'file',
        blockWarnMissing: false
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@keyframes card-list-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        codeFilename: 'components/card-list/card-list.scss',
        description: 'blockSource: file resolves Block from file name'
      }
    ],

    reject: []
  })

  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        blockSource: 'selector-or-file',
        blockWarnMissing: false
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@keyframes hero-banner-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        codeFilename: 'components/hero-banner/hero-banner.scss',
        description: 'blockSource: selector-or-file fallback'
      }
    ],

    reject: []
  })
})

describe('spiracss/keyframes-naming - camel case', () => {
  testRule({
    plugins: [keyframesNaming],
    ruleName: keyframesNaming.ruleName,
    config: [
      true,
      {
        naming: {
          blockCase: 'camel'
        }
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.cardList {}

@keyframes cardList-fadeIn {
  to {
    opacity: 1;
  }
}
        `,
        description: 'allow camel case action'
      }
    ],

    reject: [
      {
        code: `
.cardList {}

@keyframes cardList-fade-in {
  to {
    opacity: 1;
  }
}
        `,
        description: 'camel case does not allow kebab action',
        warnings: [
          {
            message:
              'Keyframes `cardList-fade-in` must follow `cardList-{action}` or `cardList-{element}-{action}` (e.g., `cardList-fadeIn` or `cardList-{element}-fadeIn`; action: `camel`, 1-3 words). (spiracss/keyframes-naming)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/keyframes-naming - file path resolution', () => {
  it('prefers codeFilename when from is a placeholder', () => {
    const warnings: string[] = []
    const result = {
      warn: (text: string) => {
        warnings.push(text)
      },
      opts: {
        from: '<input css>',
        codeFilename: 'components/card-list/ignored.scss'
      },
      stylelint: {
        config: { validate: false },
        customMessages: {},
        customUrls: {},
        ruleSeverities: {},
        ruleMetadata: {},
        disabledRanges: [],
        quiet: false,
        stylelintError: false
      }
    } as unknown as PostcssResult
    const root = scss.parse(`
.card-list {}

@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
    `)
    const run = keyframesNaming.rule(
      true,
      {
        ignoreFiles: [/ignored\.scss$/]
      },
      {} as RuleContext
    )
    run(root, result)
    assert.strictEqual(warnings.length, 0)
  })

  it('prefers codeFilename when from is stdin', () => {
    const warnings: string[] = []
    const result = {
      warn: (text: string) => {
        warnings.push(text)
      },
      opts: {
        from: 'stdin',
        codeFilename: 'components/card-list/ignored.scss'
      },
      stylelint: {
        config: { validate: false },
        customMessages: {},
        customUrls: {},
        ruleSeverities: {},
        ruleMetadata: {},
        disabledRanges: [],
        quiet: false,
        stylelintError: false
      }
    } as unknown as PostcssResult
    const root = scss.parse(`
.card-list {}

@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
    `)
    const run = keyframesNaming.rule(
      true,
      {
        ignoreFiles: [/ignored\.scss$/]
      },
      {} as RuleContext
    )
    run(root, result)
    assert.strictEqual(warnings.length, 0)
  })

  it('falls back to root input.from when input.file is a placeholder', () => {
    const warnings: string[] = []
    const result = {
      warn: (text: string) => {
        warnings.push(text)
      },
      stylelint: {
        config: { validate: false },
        customMessages: {},
        customUrls: {},
        ruleSeverities: {},
        ruleMetadata: {},
        disabledRanges: [],
        quiet: false,
        stylelintError: false
      }
    } as unknown as PostcssResult
    const root = scss.parse(`
.card-list {}

@media (min-width: 768px) {
  @keyframes card-list-fade-in {
    to {
      opacity: 1;
    }
  }
}
    `)
    root.source = {
      input: {
        file: '<input css>',
        from: 'components/card-list/ignored.scss'
      }
    } as typeof root.source
    const run = keyframesNaming.rule(
      true,
      {
        ignoreFiles: [/ignored\.scss$/]
      },
      {} as RuleContext
    )
    run(root, result)
    assert.strictEqual(warnings.length, 0)
  })
})
