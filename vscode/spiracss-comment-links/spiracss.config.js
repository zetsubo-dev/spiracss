// SpiraCSS config for development
// Test/development config for the VSCode extension spiracss-comment-links.

module.exports = {
  // Alias settings matching the test fixtures structure
  aliasRoots: {
    src: ['fixtures/src'],
    components: ['fixtures/src/components'],
    styles: ['fixtures/src/styles'],
    assets: ['fixtures/src/assets']
  },

  // stylelint plugin rules (generally unused during extension development)
  stylelint: {
    // Shared section comment patterns
    sectionCommentPatterns: {
      shared: /--shared/i,
      interaction: /--interaction/i
    },
    classStructure: {
      allowElementChainDepth: 4,
      allowExternalClasses: [],
      allowExternalPrefixes: [],
      enforceChildCombinator: true
    },
    interactionScope: {
      allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      requireAtRoot: true,
      requireComment: true,
      requireTail: true,
      enforceWithCommentOnly: false
    },
    relComments: {
      requireInScssDirectories: true,
      requireWhenMetaLoadCss: true,
      validatePath: true,
      skipFilesWithoutRules: true,
      requireChildRelComments: true,
      requireChildRelCommentsInShared: true,
      requireChildRelCommentsInInteraction: true,
      requireParentRelComment: true,
      childScssDir: 'scss'
    }
  },

  // HTML-to-SCSS generator settings (unused in Comment Links)
  generator: {
    globalScssModule: '@styles/partials/global',
    pageEntryAlias: 'assets',
    pageEntrySubdir: 'css',
    childScssDir: 'scss',
    layoutMixins: ['@include breakpoint-up(md)']
  }
}
