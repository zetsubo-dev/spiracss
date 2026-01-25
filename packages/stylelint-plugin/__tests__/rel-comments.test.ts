import assert from 'assert'
import fs from 'fs'
import scss from 'postcss-scss'
import type { RuleContext } from 'stylelint'
import { lint } from './stylelint-helpers.js'

import relComments from '../dist/esm/rules/spiracss-rel-comments.js'
import { testRule } from './rule-test-utils.js'

describe('spiracss/rel-comments - basic checks', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireScss: true,
        requireMeta: true,
        validatePath: false, // File existence checks are disabled for tests.
        skipNoRules: true,
        requireChild: true,
        requireParent: true
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
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/child-block.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'page entry comment + child Block @rel comment (module)'
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
        description: 'missing page entry comment (requireScss violation)',
        message:
          'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingParentRel (spiracss/rel-comments)'
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
          'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingParentRel (spiracss/rel-comments)'
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
          'Parent link comment must be at the top of the file (before the root Block). Move it above the root Block as the first line (e.g., `// @rel/...`). Use a configured alias from `aliasRoots` (current: `none`). Docs: https://spiracss.jp/stylelint-rules/rel-comments/#misplacedParentRel (spiracss/rel-comments)'
      },
      {
        code: `
@use 'sass:meta';
.home-section {
  @include meta.load-css('scss/feature-card');
}`,
        description: 'parent link is required even with meta.load-css("scss/child")',
        message:
          'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingParentRel (spiracss/rel-comments)'
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
        message: 'Link comment must include `child-block.scss`, `child-block.module.scss` for direct child `.child-block`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
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
        description: 'missing child Block @rel comment (requireChild violation)',
        message:
          'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - :global is transparent', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireScss: true,
        requireMeta: true,
        validatePath: false, // File existence checks are disabled for tests.
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > :global(.child-block) {
    @include meta.load-css('scss');
  }
}`,
        description: 'detect direct child Blocks inside :global',
        message:
          'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - :local is transparent', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireScss: true,
        requireMeta: true,
        validatePath: false, // File existence checks are disabled for tests.
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > :local(.child-block) {
    @include meta.load-css('scss');
  }
}`,
        description: 'detect direct child Blocks inside :local',
        message:
          'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - fileCase option', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'pascal',
        requireScss: true,
        requireMeta: true,
        validatePath: false, // File existence checks are disabled for tests.
        skipNoRules: true,
        requireChild: true,
        requireParent: true
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
    // @rel/scss/ChildBlock.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'accept PascalCase file name when fileCase=pascal'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/ChildBlock.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'accept PascalCase module file name when fileCase=pascal'
      }
    ],

    reject: [
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
        description: 'reject kebab-case file name when fileCase=pascal',
        message: 'Link comment must include `ChildBlock.scss`, `ChildBlock.module.scss` for direct child `.child-block`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - fileCase variants', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'kebab',
        naming: { blockCase: 'pascal' },
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.HomeSection {
  > .ChildBlock {
    // @rel/scss/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'kebab fileCase expects kebab filenames even for PascalCase classes'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.HomeSection {
  > .ChildBlock {
    // @rel/scss/child-block.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'kebab fileCase accepts module suffix'
      }
    ],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.HomeSection {
  > .ChildBlock {
    // @rel/scss/ChildBlock.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'kebab fileCase rejects PascalCase filename',
        message: 'Link comment must include `child-block.scss`, `child-block.module.scss` for direct child `.ChildBlock`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })

  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'snake',
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
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
    // @rel/scss/child_block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'snake fileCase expects snake filenames'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/child_block.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'snake fileCase accepts module suffix'
      }
    ],

    reject: [
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
        description: 'snake fileCase rejects kebab filename',
        message: 'Link comment must include `child_block.scss`, `child_block.module.scss` for direct child `.child-block`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })

  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'camel',
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
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
    // @rel/scss/childBlock.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'camel fileCase expects camel filenames'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .child-block {
    // @rel/scss/childBlock.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'camel fileCase accepts module suffix'
      }
    ],

    reject: [
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
        description: 'camel fileCase rejects kebab filename',
        message: 'Link comment must include `childBlock.scss`, `childBlock.module.scss` for direct child `.child-block`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - childFileCase option', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'pascal',
        childFileCase: 'kebab',
        childDir: 'scss',
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-header {
    // @common/SiteHeader/SiteHeader.scss
    @include meta.load-css('scss');
  }

  > .site-logo {
    // @rel/scss/site-logo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'use pascal for component root, kebab for childDir'
      }
    ],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-header {
    // @common/SiteHeader/SiteHeader.scss
    @include meta.load-css('scss');
  }

  > .site-logo {
    // @rel/scss/SiteLogo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'reject PascalCase file name inside childDir when childFileCase=kebab',
        message: 'Link comment must include `site-logo.scss`, `site-logo.module.scss` for direct child `.site-logo`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })

  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'pascal',
        childFileCase: 'kebab',
        childDir: 'scss',
        aliasRoots: {
          common: ['src/components/scss']
        },
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-logo {
    // @common/site-logo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'childFileCase applies when alias root includes childDir'
      }
    ],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-logo {
    // @common/SiteLogo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'reject PascalCase when alias root includes childDir',
        message: 'Link comment must include `site-logo.scss`, `site-logo.module.scss` for direct child `.site-logo`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })

  // childFileCase fallback to fileCase when not set
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'pascal',
        // childFileCase not set - should fallback to fileCase
        childDir: 'scss',
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-logo {
    // @rel/scss/SiteLogo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'childFileCase fallback: use fileCase (pascal) for childDir'
      }
    ],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-logo {
    // @rel/scss/site-logo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'childFileCase fallback: reject kebab when fileCase=pascal',
        message: 'Link comment must include `SiteLogo.scss`, `SiteLogo.module.scss` for direct child `.site-logo`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })

  // childFileCase with .module.scss
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'pascal',
        childFileCase: 'kebab',
        childDir: 'scss',
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-logo {
    // @rel/scss/site-logo.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'childFileCase accepts .module.scss with correct case'
      }
    ]
  })

  // reverse pattern: fileCase=kebab, childFileCase=pascal
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        fileCase: 'kebab',
        childFileCase: 'pascal',
        childDir: 'scss',
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-header {
    // @common/site-header.scss
    @include meta.load-css('scss');
  }

  > .site-logo {
    // @rel/scss/SiteLogo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'reverse: kebab for component root, pascal for childDir'
      }
    ],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.home-section {
  > .site-logo {
    // @rel/scss/site-logo.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'reverse: reject kebab inside childDir when childFileCase=pascal',
        message: 'Link comment must include `SiteLogo.scss`, `SiteLogo.module.scss` for direct child `.site-logo`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
      }
    ]
  })
})

describe('spiracss/rel-comments - fileCase default preserve', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        naming: { blockCase: 'camel' },
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.homeSection {
  > .childBlock {
    // @rel/scss/childBlock.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'default preserve keeps camelCase filename'
      },
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.homeSection {
  > .childBlock {
    // @rel/scss/childBlock.module.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'default preserve allows module suffix'
      }
    ],

    reject: [
      {
        code: `
// @assets/css/home.scss
@use 'sass:meta';
.homeSection {
  > .childBlock {
    // @rel/scss/child-block.scss
    @include meta.load-css('scss');
  }
}`,
        description: 'default preserve rejects kebab filename for camelCase class',
        message: 'Link comment must include `childBlock.scss`, `childBlock.module.scss` for direct child `.childBlock`. Update the `@rel` path to match. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#childMismatch (spiracss/rel-comments)'
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
        requireScss: true,
        requireMeta: false,
        validatePath: false,
        skipNoRules: true,
        requireChild: false,
        requireParent: true
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
          'Root Block must be the first rule in its root scope (after `@use`/`@forward`/`@import`). Move it above other rules so the parent link comment can stay at the top. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#rootBlockNotFirst (spiracss/rel-comments)'
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
          'Root Block must be the first rule in its root scope (after `@use`/`@forward`/`@import`). Move it above other rules so the parent link comment can stay at the top. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#rootBlockNotFirst (spiracss/rel-comments)'
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
        requireScss: false,
        requireMeta: false,
        validatePath: false,
        skipNoRules: true,
        requireChild: false,
        requireParent: false
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
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: `.block > :`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#selectorParseFailed (spiracss/rel-comments)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/rel-comments - naming.customPatterns validation', () => {
  it('reports invalid customPatterns', async () => {
    const result = await lint({
      code: '.block {}',
      customSyntax: 'postcss-scss',
      config: {
        plugins: [relComments],
        rules: {
          'spiracss/rel-comments': [
            true,
            {
              requireScss: false,
              requireMeta: false,
              validatePath: false,
              skipNoRules: true,
              requireChild: false,
              requireParent: false,
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
        requireScss: false,
        requireMeta: false,
        validatePath: false,
        skipNoRules: true,
        requireChild: false,
        requireParent: false,
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

describe('spiracss/rel-comments - requireMeta: false', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireMeta: false,
        skipNoRules: true
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
        description: 'when requireMeta: false, comments are optional'
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
        requireScss: false,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: false,
        requireParent: true
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
              'Missing top-of-file link comment to the parent. Add it as the first line before the root Block. Use `// @rel/...` or a configured alias from `aliasRoots` (current: `none`). Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingParentRel (spiracss/rel-comments)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/rel-comments - skipNoRules: true', () => {
  testRule({
    plugins: [relComments],
    ruleName: relComments.ruleName,
    config: [
      true,
      {
        requireScss: true,
        skipNoRules: true
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
        requireScss: true,
        requireMeta: true,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: true
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
        requireScss: false,
        requireMeta: true,
        validatePath: true,
        skipNoRules: true,
        requireChild: true,
        requireParent: false,
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
        message: 'Link target not found: `non-existent-block.scss`. Fix the path or `aliasRoots`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#notFound (spiracss/rel-comments)'
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
        message: 'Link target not found: `@components/non-existent-block.scss`. Fix the path or `aliasRoots`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#notFound (spiracss/rel-comments)'
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
      const result = await lint({
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
                requireScss: false,
                requireMeta: false,
                validatePath: true,
                skipNoRules: true,
                requireChild: false,
                requireParent: false
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
        requireScss: false,
        requireMeta: false,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireParent: false
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
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
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
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
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
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
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
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
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
        requireScss: false,
        requireMeta: false,
        validatePath: false,
        skipNoRules: true,
        requireChild: true,
        requireChildShared: false,
        requireChildInteraction: false,
        requireParent: false
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
        message: 'Missing child link comment. Add `// @rel/<child>.scss` or `// @<alias>/<child>.scss` using `aliasRoots` (current: `none`) as the first line inside each direct child rule (`> .child`). Example: `> .child { // @rel/child.scss }`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#missingChildRel (spiracss/rel-comments)'
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
        requireScss: false,
        requireMeta: true,
        validatePath: true,
        skipNoRules: true,
        requireChild: true,
        requireParent: false,
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
        message: 'Link target not found: `@components/non-existent-block.scss`. Fix the path or `aliasRoots`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#notFound (spiracss/rel-comments)'
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
        message: 'Link target not found: `@unknown/unknown-block.scss`. Fix the path or `aliasRoots`. Docs: https://spiracss.jp/stylelint-rules/rel-comments/#notFound (spiracss/rel-comments)'
      }
    ]
  })
})
