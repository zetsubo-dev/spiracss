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

  // Default file name casing for root/child SCSS (generator + stylelint)
  // Example: { root: 'pascal', child: 'kebab' }
  fileCase: {
    root: 'preserve',
    child: 'preserve'
  },

  // stylelint plugin rules (generally unused during extension development)
  stylelint: {
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
    class: {
      elementDepth: 4,
      childCombinator: true
    },
    interactionScope: {
      pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      requireAtRoot: true,
      requireComment: true,
      requireTail: true,
      commentOnly: false
    },
    rel: {
      requireScss: true,
      requireMeta: true,
      requireParent: true,
      requireChild: true,
      requireChildShared: true,
      requireChildInteraction: true,
      validatePath: true,
      skipNoRules: true,
      fileCase: 'preserve',
      childFileCase: 'preserve',
      childDir: 'scss'
    }
  },

  // HTML-to-SCSS generator settings (unused in Comment Links)
  generator: {
    globalScssModule: '@styles/partials/global',
    pageEntryAlias: 'assets',
    pageEntrySubdir: 'css',
    childFileCase: 'preserve',
    childScssDir: 'scss'
  }
}
