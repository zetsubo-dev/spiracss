import assert from 'assert'
import stylelint from 'stylelint'

import pageLayer from '../dist/esm/rules/spiracss-page-layer.js'
import { testRule } from './rule-test-utils.js'

const baseOptions = {
  aliasRoots: {
    assets: ['src/assets'],
    components: ['src/components']
  },
  pageEntryAlias: 'assets',
  pageEntrySubdir: 'css',
  componentsDirs: ['src/components'],
  external: {
    classes: ['is-external'],
    prefixes: ['js-']
  }
}

const pageEntryFile = 'src/assets/css/about.scss'
const nonEntryFile = 'src/assets/scss/about.scss'
const rootEntryFile = 'src/assets/about.scss'

const missingLinkMessage = (selector: string) =>
  `Direct child Blocks in page entry SCSS require a link comment to a component file. Selector: \`${selector}\`. Add a link comment as the first node in the rule (e.g., \`// @components/...\`). (spiracss/page-layer)`

const nonComponentMessage = (selector: string) =>
  `Link comments for page-layer child Blocks must resolve to the component layer. Selector: \`${selector}\`. Components: \`src/components\`. (spiracss/page-layer)`

const selectorParseMessage = (selector: string) =>
  `Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: \`${selector}\`. (spiracss/page-layer)`

describe('spiracss/page-layer - enablement', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [true, baseOptions],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.page-root > .child-block { color: red; }',
        description: 'skip outside page entry directory',
        codeFilename: nonEntryFile
      }
    ]
  })

  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [
      true,
      {
        aliasRoots: {
          components: ['src/components']
        },
        componentsDirs: ['src/components']
      }
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.page-root { .title { color: red; } }',
        description: 'skip when pageEntryAlias is missing from aliasRoots',
        codeFilename: pageEntryFile
      }
    ]
  })

  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: false,
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.page-root > .child-block { color: red; }',
        description: 'disabled rule',
        codeFilename: pageEntryFile
      }
    ]
  })
})

describe('spiracss/page-layer - aliasRoots entries', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [
      true,
      {
        ...baseOptions,
        aliasRoots: {
          assets: ['src/assets', 'src/pages'],
          components: ['src/components']
        }
      }
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: '.page-root > .child-block { color: red; }',
        description: 'apply when file is under a secondary alias root',
        message: missingLinkMessage('.page-root > .child-block'),
        codeFilename: 'src/pages/css/about.scss'
      }
    ]
  })
})

describe('spiracss/page-layer - pageEntrySubdir empty', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [
      true,
      {
        ...baseOptions,
        pageEntrySubdir: ''
      }
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: '.page-root > .child-block { color: red; }',
        description: 'apply when pageEntrySubdir is empty',
        message: missingLinkMessage('.page-root > .child-block'),
        codeFilename: rootEntryFile
      }
    ]
  })
})

describe('spiracss/page-layer - componentsDirs empty', () => {
  it('reports invalid componentsDirs', async () => {
    const result = await stylelint.lint({
      code: '.page-root > .child-block { color: red; }',
      codeFilename: pageEntryFile,
      customSyntax: 'postcss-scss',
      config: {
        plugins: [pageLayer],
        rules: {
          'spiracss/page-layer': [
            true,
            {
              ...baseOptions,
              componentsDirs: []
            }
          ]
        }
      }
    })

    const invalidOptionWarnings = result.results[0]?.invalidOptionWarnings ?? []
    assert.ok(result.errored, 'empty componentsDirs should be reported')
    assert.ok(
      invalidOptionWarnings.some((warning) => warning.text.includes('componentsDirs')),
      'invalid componentsDirs should be reported'
    )
  })
})

describe('spiracss/page-layer - child Block detection', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [true, baseOptions],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.page-root { color: red; }',
        description: 'Block-only rule is ok',
        codeFilename: pageEntryFile
      },
      {
        code: `
.page-root {
  > .child-block {
    // @components/child-block/child-block.scss
    color: red;
  }
}
`,
        description: 'Block > Block with link comment is ok',
        codeFilename: pageEntryFile
      },
      {
        code: '.page-root > .title { color: red; }',
        description: 'Block > Element is allowed by this rule',
        codeFilename: pageEntryFile
      },
      {
        code: '.js-hook { color: red; }',
        description: 'external classes are ignored',
        codeFilename: pageEntryFile
      }
    ]
  })
})

describe('spiracss/page-layer - child Block link comments', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [true, baseOptions],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.page-root > .child-block {
  // @components/child-block/child-block.scss
  color: red;
}
`,
        description: 'link comment exists under child Block',
        codeFilename: pageEntryFile
      },
      {
        code: `
.page-root > .child-a,
.page-root > .child-b {
  // @components/child-a/child-a.scss
  color: red;
}
`,
        description: 'selector list uses a single link comment',
        codeFilename: pageEntryFile
      }
    ],
    reject: [
      {
        code: '.page-root > .child-block { color: red; }',
        description: 'missing link comment',
        message: missingLinkMessage('.page-root > .child-block'),
        codeFilename: pageEntryFile
      },
      {
        code: `
.page-root {
  > .child-block {
    color: red;
  }
}
`,
        description: 'missing link comment in nested child Block',
        message: missingLinkMessage('> .child-block'),
        codeFilename: pageEntryFile
      },
      {
        code: `
.page-root > .child-block {
  // just a comment
  color: red;
}
`,
        description: 'non-link comment is not enough',
        message: missingLinkMessage('.page-root > .child-block'),
        codeFilename: pageEntryFile
      }
    ]
  })
})

describe('spiracss/page-layer - component link targets', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [true, baseOptions],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
.page-root > .child-block {
  // @rel/shared.scss
  color: red;
}
`,
        description: 'link target outside components is rejected',
        message: nonComponentMessage('.page-root > .child-block'),
        codeFilename: pageEntryFile
      }
    ]
  })
})

describe('spiracss/page-layer - multiple child Blocks', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [true, baseOptions],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.page-root > .child-block {
  // @components/child-block/child-block.scss
  color: red;
}
.page-root > .other-block {
  // @components/other-block/other-block.scss
  color: blue;
}
`,
        description: 'each child Block has a link comment',
        codeFilename: pageEntryFile
      }
    ],
    reject: [
      {
        code: `
.page-root > .child-block {
  // @components/child-block/child-block.scss
  color: red;
}
.page-root > .other-block {
  color: blue;
}
`,
        description: 'missing link comment on one child Block',
        message: missingLinkMessage('.page-root > .other-block'),
        codeFilename: pageEntryFile
      }
    ]
  })
})

describe('spiracss/page-layer - root wrappers and parse errors', () => {
  testRule({
    plugins: [pageLayer],
    ruleName: pageLayer.ruleName,
    config: [true, baseOptions],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
@media (min-width: 600px) {
  .page-root > .child-block {
    color: red;
  }
}
`,
        description: 'applies inside @media',
        message: missingLinkMessage('.page-root > .child-block'),
        codeFilename: pageEntryFile
      },
      {
        code: `
@layer layout {
  .page-root > .child-block {
    color: red;
  }
}
`,
        description: 'applies inside @layer',
        message: missingLinkMessage('.page-root > .child-block'),
        codeFilename: pageEntryFile
      },
      {
        code: '.page-root > : { color: red; }',
        description: 'selector parse failure emits warning',
        warnings: [
          {
            message: selectorParseMessage('.page-root > :')
          }
        ],
        codeFilename: pageEntryFile
      }
    ]
  })
})
