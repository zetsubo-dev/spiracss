// SpiraCSS config for development
// Settings to validate rules against stylelint plugin test fixtures.

const path = require('path')

module.exports = {
  // Alias settings matching the test fixtures structure
  // Use absolute paths via __dirname so VSCode's stylelint extension resolves correctly.
  aliasRoots: {
    src: [path.join(__dirname, 'test/fixtures/src')],
    components: [path.join(__dirname, 'test/fixtures/src/components')],
    styles: [path.join(__dirname, 'test/fixtures/src/styles')],
    common: [path.join(__dirname, 'test/fixtures/src/components/common')],
    pages: [path.join(__dirname, 'test/fixtures/src/components/pages')],
    parts: [path.join(__dirname, 'test/fixtures/src/components/parts')],
    assets: [path.join(__dirname, 'test/fixtures/src/assets')]
  },

  // stylelint plugin rules
  stylelint: {
    // Shared section comment patterns
    sectionCommentPatterns: {
      shared: /--shared/i,
      interaction: /--interaction/i
    },
    // SpiraCSS core structure rules
    classStructure: {
      // How many Element > Element chains to allow (SpiraCSS recommends 4).
      allowElementChainDepth: 4,
      // Allow class names outside SpiraCSS naming (e.g., from libraries).
      allowExternalClasses: [],
      // Allow external class prefixes (e.g., swiper-).
      allowExternalPrefixes: [],
      // Require the '>' child combinator for direct children of a Block.
      enforceChildCombinator: true
      // If naming is not specified, SpiraCSS defaults are used.
      // (Block = two-word kebab / Element = one word / Modifier = 1-2 words with '-'.)
      // naming: {
      //   blockCase: 'kebab',
      //   elementCase: 'kebab',
      //   modifierCase: 'kebab',
      //   modifierPrefix: '-'
      // }
    },

    // Rules for the interaction section
    interactionScope: {
      // Allowed interaction pseudo-classes
      allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      // Require grouping inside an @at-root & { ... } block.
      requireAtRoot: true,
      // Require a preceding `// --interaction` comment.
      requireComment: true,
      // Require the interaction block at the end of the file (last non-comment node).
      requireTail: true,
      // When true, only blocks explicitly marked by comments are checked.
      enforceWithCommentOnly: false
    },

    // Write pseudo-classes/elements nested under &.
    pseudoNesting: {},

    // Link comment/path validation rules between parent/child Blocks
    relComments: {
      // Require @rel under scss directories.
      requireInScssDirectories: true,
      // Require @rel when meta.load-css('scss') is present.
      requireWhenMetaLoadCss: true,
      // Validate that the referenced path exists.
      validatePath: true,
      // Skip files without rules.
      skipFilesWithoutRules: true,
      // Require child link comments from the parent (@rel/scss/child.scss, etc.).
      requireChildRelComments: true,
      // Require child @rel even in the shared section.
      requireChildRelCommentsInShared: true,
      // Require child @rel even in the interaction section.
      requireChildRelCommentsInInteraction: true,
      // Require parent link comments on the child side (@rel/../Parent.scss, etc.).
      requireParentRelComment: true,
      // Directory name for child Block SCSS (default 'scss').
      childScssDir: 'scss'
    }
  },

  // HTML-to-SCSS generator settings (unused in development but kept for structural consistency)
  generator: {
    // Alias path for the global SCSS module
    globalScssModule: '@styles/partials/global',
    // Alias for page entry files
    pageEntryAlias: 'assets',
    // Subdirectory for page entry files
    pageEntrySubdir: 'css',
    // Directory name for child component SCSS
    childScssDir: 'scss',
    // List of layout mixins
    layoutMixins: ['@include breakpoint-up(md)']
  }
}
