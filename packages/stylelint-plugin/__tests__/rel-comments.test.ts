import assert from 'assert'
import fs from 'fs'
import scss from 'postcss-scss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import relComments from '../dist/esm/rules/spiracss-rel-comments.js'
import { testRule } from './rule-test-utils.js'

describe('spiracss/rel-comments - basic checks', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: true,
        requireWhenMetaLoadCss: true,
        validatePath: false, // File existence checks are disabled for tests.
        skipFilesWithoutRules: true,
        requireChildRelComments: true,
        requireParentRelComment: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'page entry comment + child Block @rel comment'
      },
      {
        code: `
@use 'sass:meta';
@media (min-width: 768px) {
  // @assets/css/home.scss
  .home-section {
    > .child-block {
      // @rel/scss/child-block.scss
      @include meta.load-css('scss');
    }
  }
}`,
        description: 'place @rel immediately before the root Block inside @media'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/child-block.scss
    @include meta.load-css('scss');
  }

  // --interaction
  // @at-root & {
  // }
}`,
        description: '@at-root is not treated as a link comment'
      },
      {
        code: '.block {}',
        description: 'out of scope when meta.load-css is missing'
      }
    ],

    reject: [
      {
        code: `
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'missing page entry comment (requireInScssDirectories violation)',
        message:
          'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). (spiracss/rel-comments)'
      },
      {
        code: `
@use 'sass:meta';
.home-section:has(:global(.foo)) {
  > .child-block {
    // @rel/scss/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'missing page entry comment even with unverified :global selectors',
        message:
          'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). (spiracss/rel-comments)'
      },
      {
        codeFilename: 'pages/home/scss/home.scss',
        code: `
@media (min-width: 768px) {
  .home-section {
    // @rel/../parent-block.scss
    > .child-block {
      // @rel/scss/child-block.scss
    }
  }
}`,
        description: '@rel on a root Block inside a root wrapper is treated as misplaced',
        message:
          'Parent link comment must be at the top of the file (before the root Block). Move it above the root Block as the first line (e.g., `// @rel/...`). Use a configured alias from `aliasRoots` (current: `none`). (spiracss/rel-comments)'
      },
      {
        code: `
@use 'sass:meta';
.home-section {
  @include meta.load-css('scss/feature-card');
}`,
        description: 'parent link is required even with meta.load-css("scss/child")',
        message:
          'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). (spiracss/rel-comments)'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/other-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'child Block name and @rel file name do not match',
        message: 'Link comment must include `child-block.scss` for direct child `.child-block`. Update the `@rel` path to match. (spiracss/rel-comments)'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    @include meta.load-css('scss');
  }
}`,
        description: 'missing child Block @rel comment (requireChildRelComments violation)',
        message:
          'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - root Block must be first rule', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: true,
        requireWhenMetaLoadCss: false,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: false,
        requireParentRelComment: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        codeFilename: 'components/home/scss/home-section.scss',
        code: `
// @rel/../parent-block.scss
@media (min-width: 768px) {
  .home-section {}
}
`,
        description: 'ok if root Block is first inside wrapper'
      }
    ],

    reject: [
      {
        codeFilename: 'components/home/scss/home-section.scss',
        code: `
// @rel/../parent-block.scss
.title {}
.home-section {}
`,
        description: 'warn if root Block is not first',
        message:
          'Root Block must be the first rule in its root scope (after `@use`/`@forward`/`@import`). Move it above other rules so the parent link comment can stay at the top. (spiracss/rel-comments)'
      },
      {
        codeFilename: 'components/home/scss/home-section.scss',
        code: `
// @rel/../parent-block.scss
@media (min-width: 768px) {
  .title {}
  .home-section {}
}
`,
        description: 'warn if root Block is not first even inside wrapper',
        message:
          'Root Block must be the first rule in its root scope (after `@use`/`@forward`/`@import`). Move it above other rules so the parent link comment can stay at the top. (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - selector parse failure', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: false,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: false,
        requireParentRelComment: false
      }
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
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: `.block > :`. (spiracss/rel-comments)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/rel-comments - naming.customPatterns validation', () => {
  it('reports invalid customPatterns', async () => {
    const result = await stylelint.lint({
      code: '.block {}',
      customSyntax: 'postcss-scss',
      config: {
        plugins: [relComments],
        rules: {
          'spiracss/rel-comments': [
            true,
            {
              requireInScssDirectories: false,
              requireWhenMetaLoadCss: false,
              validatePath: false,
              skipFilesWithoutRules: true,
              requireChildRelComments: false,
              requireParentRelComment: false,
              naming: {
                customPatterns: {
                  block: 'invalid' as unknown as RegExp,
                  element: 'invalid' as unknown as RegExp,
                  modifier: 'invalid' as unknown as RegExp
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
    assert.ok(result.errored, 'invalid customPatterns should stop validation')
    assert.ok(
      warningTexts.some((text) => text.includes('naming.customPatterns.block'))
    )
    assert.ok(
      warningTexts.some((text) => text.includes('naming.customPatterns.element'))
    )
    assert.ok(
      warningTexts.some((text) => text.includes('naming.customPatterns.modifier'))
    )
  })

  it('skips invalid option warnings when validate is false', () => {
    const warnings: string[] = []
    const result = {
      warn: (text: string) => {
        warnings.push(text)
      },
      opts: {},
      stylelint: {
        config: { validate: false },
        stylelintError: false
      }
    } as unknown as stylelint.PostcssResult
    const root = scss.parse('.block {}')
    const run = relComments.rule(
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: false,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: false,
        requireParentRelComment: false,
        naming: {
          customPatterns: {
            block: 'invalid' as unknown as RegExp
          }
        }
      },
      {} as RuleContext
    )
    run(root, result)
    assert.strictEqual(warnings.length, 0)
    assert.strictEqual(result.stylelint?.stylelintError, false)
  })
})

describe('spiracss/rel-comments - requireWhenMetaLoadCss: false', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireWhenMetaLoadCss: false,
        skipFilesWithoutRules: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@use 'sass:meta';
.block {
  > .child {
    @include meta.load-css('scss');
  }
}`,
        description: 'when requireWhenMetaLoadCss: false, comments are optional'
      }
    ]
  })
})

describe('spiracss/rel-comments - missing parent link (no duplicate reports)', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: true,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: false,
        requireParentRelComment: true
      }
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
@use 'sass:meta';
.block {
  @include meta.load-css('scss');
}`,
        description: 'report missingParentRel once when no link comments exist',
        warnings: [
          {
            message:
              'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). (spiracss/rel-comments)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/rel-comments - skipFilesWithoutRules: true', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: true,
        skipFilesWithoutRules: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '$color: red;',
        description: 'skip files without rules'
      },
      {
        codeFilename: 'components/hero/scss/only-keyframes.scss',
        code: `
@keyframes fade {
  0% { opacity: 0; }
  100% { opacity: 1; }
}`,
        description: 'files with only @keyframes are also skipped'
      }
    ]
  })
})

describe('spiracss/rel-comments - multiple meta.load-css', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: true,
        requireWhenMetaLoadCss: true,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: true,
        requireParentRelComment: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block-a {
    // @rel/scss/child-block-a.scss
    @include meta.load-css('scss');
  }
  > .child-block-b {
    // @rel/scss/child-block-b.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'multiple child Blocks each have an @rel comment'
      }
    ]
  })
})

describe('spiracss/rel-comments - validatePath: true', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: true,
        validatePath: true,
        skipFilesWithoutRules: true,
        requireChildRelComments: true,
        requireParentRelComment: false,
        aliasRoots: {
          components: ['__tests__/fixtures/components'],
          'assets-v2': ['__tests__/fixtures/components'],
          a1: ['__tests__/fixtures/components']
        }
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@use 'sass:meta';
.block {
  > .child-block {
    // @rel/__tests__/fixtures/scss/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: '@rel path to an existing file (accept)'
      },
      {
        code: `
@use 'sass:meta';
.block {
  > .child-block {
    // @components/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: '@components alias to an existing file (accept)'
      },
      {
        code: `
@use 'sass:meta';
.block {
  > .child-block {
    // @assets-v2/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'alias with alphanumerics/hyphen (accept)'
      },
      {
        code: `
@use 'sass:meta';
.block {
  > .child-block {
    // @a1/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'alias containing numbers (accept)'
      }
    ],

    reject: [
      {
        code: `
@use 'sass:meta';
.block {
  > .non-existent-block {
    // @rel/non-existent-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: '@rel path to a missing file (reject)',
        message: 'Link target not found: `non-existent-block.scss`. Fix the path or `aliasRoots`. (spiracss/rel-comments)'
      },
      {
        code: `
@use 'sass:meta';
.block {
  > .non-existent-block {
    // @components/non-existent-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: '@components alias to a missing file (reject)',
        message: 'Link target not found: `@components/non-existent-block.scss`. Fix the path or `aliasRoots`. (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - validatePath error handling', () => {
  it('treats EACCES as missing', async () => {
    const originalExistsSync = fs.existsSync
    fs.existsSync = ((pathLike: fs.PathLike) => {
      const target = typeof pathLike === 'string' ? pathLike : pathLike.toString()
      if (target.includes('forbidden.scss')) {
        const error = new Error('EACCES') as NodeJS.ErrnoException
        error.code = 'EACCES'
        throw error
      }
      return originalExistsSync(pathLike)
    }) as typeof fs.existsSync

    try {
      const result = await stylelint.lint({
        code: `
.block {
  // @rel/forbidden.scss
}
`,
        codeFilename: 'components/home/scss/home-section.scss',
        customSyntax: 'postcss-scss',
        config: {
          plugins: [relComments],
          rules: {
            'spiracss/rel-comments': [
              true,
              {
                requireInScssDirectories: false,
                requireWhenMetaLoadCss: false,
                validatePath: true,
                skipFilesWithoutRules: true,
                requireChildRelComments: false,
                requireParentRelComment: false
              }
            ]
          }
        }
      })
      const warnings = result.results[0]?.warnings ?? []
      assert.ok(
        warnings.some((warning) => warning.text.includes('forbidden.scss')),
        'EACCES should be reported as missing link target'
      )
    } finally {
      fs.existsSync = originalExistsSync
    }
  })
})


describe('spiracss/rel-comments - child block comments default behavior', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: false,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: true,
        requireParentRelComment: false
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.page-entry {
  > .child-block {
    // @rel/child-block.scss
    color: red;
  }
}`,
        description: 'ok if @rel exists directly under a child Block even without meta.load-css'
      },
      {
        code: `
.page-entry {
  // --shared
  > .child-block {
    // @rel/child-block.scss
    color: red;
  }
}`,
        description: 'require child Block comments even inside the shared section'
      },
      {
        code: `
.page-entry {
  // --interaction
  > .child-block {
    // @rel/child-block.scss
    color: red;
  }
}`,
        description: '@rel is OK even inside the interaction section'
      },
      {
        code: `
.page-entry {
  // --interaction
  > .child-block {
    color: red;
  }
}`,
        description: 'do not require child Block comments inside the interaction section (default)'
      },
      {
        code: `
.page-entry {
  // --interaction
  @at-root & {
    > .child-block {
      color: red;
    }
  }
}`,
        description: 'child Block comments are optional inside @at-root in the interaction section (default)'
      }
    ],

    reject: [
      {
        code: `
.page-entry {
  > .child-block {
    color: red;
  }
}`,
        description: 'in normal sections, link comments are required directly under child Blocks',
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. (spiracss/rel-comments)'
      },
      {
        code: `
.page-entry {
  > .child-block {
    // just a comment
    color: red;
  }
}`,
        description: 'non-link comments are an error',
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. (spiracss/rel-comments)'
      },
      {
        code: `
.page-entry {
  @at-root & {
    > .child-block {
      color: red;
    }
  }
}`,
        description: 'link comments are required directly under child Blocks even inside @at-root &',
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. (spiracss/rel-comments)'
      },
      {
        code: `
.page-entry {
  // --shared
  > .child-block {
    color: red;
  }
}`,
        description: 'child Block comments are required inside the shared section',
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. (spiracss/rel-comments)'
      }
    ]
  })
})


describe('spiracss/rel-comments - child block comments opt-out in shared/interaction', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: false,
        validatePath: false,
        skipFilesWithoutRules: true,
        requireChildRelComments: true,
        requireChildRelCommentsInShared: false,
        requireChildRelCommentsInInteraction: false,
        requireParentRelComment: false
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.page-entry {
  // --shared
  > .child-block {
    color: red;
  }
}`,
        description: 'do not require child Block comments inside the shared section'
      },
      {
        code: `
.page-entry {
  // --interaction
  @at-root & {
    > .child-block {
      color: red;
    }
  }
}`,
        description: 'do not require child Block comments inside the interaction section'
      }
    ],

    reject: [
      {
        code: `
.page-entry {
  > .child-block {
    color: red;
  }
}`,
        description: 'normal sections require child Block comments',
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. (spiracss/rel-comments)'
      }
    ]
  })
})

describe('rel-comments - resolving multiple aliasRoots', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireInScssDirectories: false,
        requireWhenMetaLoadCss: true,
        validatePath: true,
        skipFilesWithoutRules: true,
        requireChildRelComments: true,
        requireParentRelComment: false,
        aliasRoots: {
          components: ['__tests__/fixtures/components', '__tests__/fixtures/legacy'],
          shared: ['__tests__/fixtures/scss']
        }
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
@use 'sass:meta';
.block {
  > .child-block {
    // @components/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'resolve files from multiple aliasRoots (found in first path)'
      },
      {
        code: `
@use 'sass:meta';
.block {
  > .child-block {
    // @shared/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'resolve files correctly with another alias key'
      }
    ],

    reject: [
      {
        code: `
@use 'sass:meta';
.block {
  > .non-existent-block {
    // @components/non-existent-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'error when no file is found in any aliasRoots candidate',
        message: 'Link target not found: `@components/non-existent-block.scss`. Fix the path or `aliasRoots`. (spiracss/rel-comments)'
      },
      {
        code: `
@use 'sass:meta';
.block {
  > .unknown-block {
    // @unknown/unknown-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'undefined alias key is an error',
        message: 'Link target not found: `@unknown/unknown-block.scss`. Fix the path or `aliasRoots`. (spiracss/rel-comments)'
      }
    ]
  })
})
