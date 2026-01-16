import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - enforceSingleRootBlock option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        enforceSingleRootBlock: true,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner {}',
        description: 'single root Block'
      },
      {
        code: '.hero-banner {}\n@media (min-width: 700px) { .hero-banner {} }',
        description: '@media alongside the same Block is allowed'
      }
    ],

    reject: [
      {
        code: '.hero-banner {}\n.card-list {}',
        description: 'error when multiple root Blocks exist',
        message: 'Only one root Block is allowed per file. Found `card-list` in addition to `hero-banner`. Split into separate SCSS files or move extra Blocks under the root. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner, .card-list {}',
        description: 'error when multiple Blocks are defined in a single rule',
        message: 'Only one root Block is allowed per file. Found `card-list` in addition to `hero-banner`. Split into separate SCSS files or move extra Blocks under the root. (spiracss/class-structure)'
      }
    ]
  })
})


describe('spiracss/class-structure - root selectors include the root Block', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        allowExternalPrefixes: ['u-'],
        enforceChildCombinator: false,
        enforceSingleRootBlock: true,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.tab-panels {}',
        description: 'root Block only'
      },
      {
        code: '.tab-panels > .tab-panel {}',
        description: 'selector includes the root Block'
      },
      {
        code: '.tab-panels {}\n:is(.tab-panels) {}',
        description: 'root Block inside :is() is treated as the same element'
      },
      {
        code: '.tab-panels {}\n.foo:is(.tab-panels, .bar .baz) {}',
        description: 'root Block remains valid even with compound selectors inside :is()'
      },
      {
        code: '.tab-panels {}\n.u-hidden {}',
        description: 'selectors with only external classes are excluded'
      }
    ],

    reject: [
      {
        code: '.tab-panels {}\n.swiper {}',
        description: 'top-level selector without root Block is an error',
        message:
          'Root selector `.swiper` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. (spiracss/class-structure)'
      },
      {
        code: '.tab-panels {}\n.foo:has(.tab-panels) {}',
        description: 'Blocks inside :has() are excluded from root detection',
        message:
          'Root selector `.foo:has(.tab-panels)` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. (spiracss/class-structure)'
      },
      {
        code: '.tab-panels, .swiper {}',
        description: 'error when root Block is missing in multi-selector',
        message:
          'Root selector `.swiper` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. (spiracss/class-structure)'
      }
    ]
  })
})


describe('spiracss/class-structure - file name matches root Block name', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        enforceRootFileName: true,
        rootFileCase: 'preserve',
        childScssDir: 'scss',
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.card-list {}',
        codeFilename: 'components/card-list/card-list.scss',
        description: 'root Block name matches file name'
      },
      {
        code: '.card-header {}',
        codeFilename: 'components/card-list/scss/card-header.scss',
        description: 'child Blocks match class names without applying rootFileCase'
      }
    ],

    reject: [
      {
        code: '.card-list {}',
        codeFilename: 'components/card-list/list.scss',
        description: 'root Block name does not match file name',
        message: 'Root Block `.card-list` must be defined in `card-list.scss` (found `list.scss`). Rename the file or the Block. (spiracss/class-structure)'
      }
    ]
  })
})


describe('spiracss/class-structure - rootFileCase application', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        enforceRootFileName: true,
        rootFileCase: 'pascal',
        childScssDir: 'scss',
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-card {}',
        codeFilename: 'components/hero-card/HeroCard.scss',
        description: 'file name matching rootFileCase is allowed'
      }
    ]
  })
})


describe('spiracss/class-structure - componentsDirs setting', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        enforceRootFileName: true,
        rootFileCase: 'preserve',
        childScssDir: 'scss',
        componentsDirs: ['src/ui'],
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.feature-card {}',
        codeFilename: 'src/ui/feature-card/feature-card.scss',
        description: 'paths matching componentsDirs are checked'
      }
    ],

    reject: [
      {
        code: '.feature-card {}',
        codeFilename: 'src/ui/feature-card/card.scss',
        description: 'file name mismatch under componentsDirs',
        message: 'Root Block `.feature-card` must be defined in `feature-card.scss` (found `card.scss`). Rename the file or the Block. (spiracss/class-structure)'
      }
    ]
  })
})
