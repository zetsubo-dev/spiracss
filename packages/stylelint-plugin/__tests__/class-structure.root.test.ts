import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - rootSingle option', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        rootSingle: true,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-banner {}',
        description: 'single root Block'
      }
    ],

    reject: [
      {
        code: '.hero-banner {}\n@media (min-width: 700px) { .hero-banner {} }',
        description: 'error when the same root Block is defined multiple times',
        message:
          'Root Block `.hero-banner` must be defined only once per file. Found another top-level selector `.hero-banner`. Merge it into the existing root Block and nest additional selectors there. Auto-fix: move this selector inside `.hero-banner` and rewrite the root-level compound part as nested `&...` selectors (e.g., `.hero-banner { &.<externalClass> { ... } }`). (spiracss/class-structure)'
      },
      {
        code: '.hero-banner {}\n.card-list {}',
        description: 'error when multiple root Blocks exist',
        message: 'Only one root Block is allowed per file. Found `card-list` in addition to `hero-banner`. Split into separate SCSS files or move extra Blocks under the root. Auto-fix: keep one root Block in this file; split extra roots into separate files, or move them under the existing root Block as nested child selectors. (spiracss/class-structure)'
      },
      {
        code: '.hero-banner, .card-list {}',
        description: 'error when multiple Blocks are defined in a single rule',
        message: 'Only one root Block is allowed per file. Found `card-list` in addition to `hero-banner`. Split into separate SCSS files or move extra Blocks under the root. Auto-fix: keep one root Block in this file; split extra roots into separate files, or move them under the existing root Block as nested child selectors. (spiracss/class-structure)'
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
        elementDepth: 4,
        external: { classes: ['swiper'], prefixes: ['u-'] },
        childCombinator: false,
        rootSingle: true,
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
        code: '.tab-panels[role="tablist"] {}',
        description: 'selector includes the root Block'
      },
      {
        code: ':is(.tab-panels) {}',
        description: 'root Block inside :is() is treated as the same element'
      },
      {
        code: '.foo:is(.tab-panels, .bar .baz) {}',
        description: 'root Block remains valid even with compound selectors inside :is()'
      },
      {
        code: '.tab-panels:has(:global(.foo)), .tab-panels:has(:global(.bar)) {}',
        description: 'unverified :global selectors still anchor the root Block'
      }
    ],

    reject: [
      {
        code: '.tab-panels.swiper {}',
        description: 'single root selector with external classes must be nested under the root Block',
        message:
          'Root selector `.tab-panels.swiper` must keep the root Block `.tab-panels` as the top-level selector. Move external classes into the root Block using `&.<externalClass>` (e.g., `.tab-panels { &.<externalClass> { ... } }`). Auto-fix: move this rule into `.tab-panels` and convert the compound root selector to nested `&...`. (spiracss/class-structure)'
      },
      {
        code: '.tab-panels {}\n.swiper {}',
        description: 'external.classes selector without root Block is an error',
        message:
          'Root selector `.swiper` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. Auto-fix: either prepend/include `.tab-panels` in the selector, or move declarations into `.tab-panels { ... }`. (spiracss/class-structure)'
      },
      {
        code: '.tab-panels {}\n.tab-panels.swiper {}',
        description: 'duplicate root Block selector with external classes is an error',
        message:
          'Root Block `.tab-panels` must be defined only once per file. Found another top-level selector `.tab-panels.swiper`. Merge it into the existing root Block and nest additional selectors there. Auto-fix: move this selector inside `.tab-panels` and rewrite the root-level compound part as nested `&...` selectors (e.g., `.tab-panels { &.<externalClass> { ... } }`). (spiracss/class-structure)'
      },
      {
        code: '.tab-panels {}\n.u-hidden {}',
        description: 'external.prefixes selector without root Block is an error',
        message:
          'Root selector `.u-hidden` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. Auto-fix: either prepend/include `.tab-panels` in the selector, or move declarations into `.tab-panels { ... }`. (spiracss/class-structure)'
      },
      {
        code: '.tab-panels {}\n.foo:has(.tab-panels) {}',
        description: 'Blocks inside :has() are excluded from root detection',
        message:
          'Root selector `.foo:has(.tab-panels)` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. Auto-fix: either prepend/include `.tab-panels` in the selector, or move declarations into `.tab-panels { ... }`. (spiracss/class-structure)'
      },
      {
        code: '.tab-panels, .swiper {}',
        description: 'error when root Block is missing in multi-selector',
        message:
          'Root selector `.swiper` must include the root Block `.tab-panels`. Include it in the selector or move this rule under the root Block. Auto-fix: either prepend/include `.tab-panels` in the selector, or move declarations into `.tab-panels { ... }`. (spiracss/class-structure)'
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
        elementDepth: 4,
        childCombinator: false,
        rootFile: true,
        rootCase: 'preserve',
        childDir: 'scss',
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
        code: '.card-list {}',
        codeFilename: 'components/card-list/card-list.module.scss',
        description: 'root Block name matches CSS Modules file name'
      },
      {
        code: '.card-header {}',
        codeFilename: 'components/card-list/scss/card-header.scss',
        description: 'child Blocks match class names without applying rootCase'
      }
    ],

    reject: [
      {
        code: '.card-list {}',
        codeFilename: 'components/card-list/list.scss',
        description: 'root Block name does not match file name',
        message: 'Root Block `.card-list` must be defined in `card-list.scss`, `card-list.module.scss` (found `list.scss`). Rename the file or the Block. (spiracss/class-structure)'
      }
    ]
  })
})


describe('spiracss/class-structure - rootCase application', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        rootFile: true,
        rootCase: 'pascal',
        childDir: 'scss',
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.hero-card {}',
        codeFilename: 'components/hero-card/HeroCard.scss',
        description: 'file name matching rootCase is allowed'
      },
      {
        code: '.hero-card {}',
        codeFilename: 'components/hero-card/HeroCard.module.scss',
        description: 'CSS Modules file name matching rootCase is allowed'
      }
    ]
  })
})


describe('spiracss/class-structure - childFileCase application', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        elementDepth: 4,
        childCombinator: false,
        rootFile: true,
        rootCase: 'preserve',
        childDir: 'scss',
        childFileCase: 'kebab',
        naming: { blockCase: 'camel' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.cardHeader {}',
        codeFilename: 'components/card-header/scss/card-header.scss',
        description: 'files under childDir use childFileCase for file name checks'
      },
      {
        code: '.cardHeader {}',
        codeFilename: 'components/card-header/scss/card-header.module.scss',
        description: 'CSS Modules files under childDir also use childFileCase'
      }
    ],

    reject: [
      {
        code: '.cardHeader {}',
        codeFilename: 'components/card-header/scss/CardHeader.scss',
        description: 'childFileCase violation under childDir',
        message: 'Root Block `.cardHeader` must be defined in `card-header.scss`, `card-header.module.scss` (found `CardHeader.scss`). Rename the file or the Block. (spiracss/class-structure)'
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
        elementDepth: 4,
        childCombinator: false,
        rootFile: true,
        rootCase: 'preserve',
        childDir: 'scss',
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
        message: 'Root Block `.feature-card` must be defined in `feature-card.scss`, `feature-card.module.scss` (found `card.scss`). Rename the file or the Block. (spiracss/class-structure)'
      }
    ]
  })
})
