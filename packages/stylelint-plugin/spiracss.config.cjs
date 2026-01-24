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

  // Default file name casing for root/child SCSS (generator + stylelint)
  // Example: { root: 'pascal', child: 'kebab' }
  fileCase: {
    root: 'preserve',
    child: 'preserve'
  },

  // stylelint plugin rules
  stylelint: {
    // Shared defaults across rules.
    base: {
      comments: {
        shared: /--shared/i,
        interaction: /--interaction/i
      },
      external: {
        classes: [],
        prefixes: []
      }
    },

    // SpiraCSS core structure rules
    class: {
      // How many Element > Element chains to allow (SpiraCSS recommends 4).
      elementDepth: 4,
      // Require the '>' child combinator for direct children of a Block.
      childCombinator: true
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
      pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      // Require grouping inside an @at-root & { ... } block.
      requireAtRoot: true,
      requireComment: true,
      requireTail: true,
      // When true, only blocks explicitly marked by comments are checked.
      commentOnly: false
    },

    // Write pseudo-classes/elements nested under &.
    pseudo: {
      enabled: true
    },

    // Link comment/path validation rules between parent/child Blocks
    rel: {
      // Require @rel under scss directories.
      requireScss: true,
      requireMeta: true,
      requireParent: true,
      requireChild: true,
      requireChildShared: true,
      requireChildInteraction: true,
      // Validate that the referenced path exists.
      validatePath: true,
      // Skip files without rules.
      skipNoRules: true,
      // File name case for @rel targets (default 'preserve'; fallback: fileCase.root).
      fileCase: 'preserve',
      // File name case for @rel targets inside childDir (default 'preserve'; fallback: fileCase.child).
      childFileCase: 'preserve',
      // Directory name for child Block SCSS (default 'scss').
      childDir: 'scss'
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
    // File name case for child component SCSS (fallback: fileCase.child)
    childFileCase: 'preserve',
    // Directory name for child component SCSS
    childScssDir: 'scss',
    // List of layout mixins
    layoutMixins: ['@include breakpoint-up(md)']
  }
}
