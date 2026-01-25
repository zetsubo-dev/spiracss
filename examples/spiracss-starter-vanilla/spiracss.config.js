// SpiraCSS Configuration for Vite Simple Example

/** @type {{ aliasRoots: Record<string, string[]>; stylelint: any; selectorPolicy: any; generator: any }} */
const config = {
  // Path aliases for @rel comment validation and imports
  aliasRoots: {
    src: ['src'],
    components: ['src/components'],
    styles: ['src/styles'],
    common: ['src/components/common'],
    pages: ['src/components/pages'],
    parts: ['src/components/parts'],
    assets: ['src/assets']
  },

  // Stylelint rules configuration
  stylelint: {
    base: {
      comments: {
        shared: /--shared/i,
        interaction: /--interaction/i
      },
      external: {
        classes: [],
        prefixes: ['u-']
      },
      naming: {
        blockCase: 'kebab',
        blockMaxWords: 2,
        elementCase: 'kebab',
        modifierCase: 'kebab',
        modifierPrefix: '-'
      },
      paths: {
        childDir: 'scss',
        components: ['src/components']
      }
    },

    class: {
      elementDepth: 4,
      childCombinator: true,
      rootCase: 'pascal'
    },

    interactionScope: {
      pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      requireAtRoot: true,
      requireComment: true,
      requireTail: true
    },

    rel: {
      requireScss: true,
      requireMeta: true,
      validatePath: true,
      skipNoRules: true,
      requireChild: true,
      requireChildShared: true,
      requireChildInteraction: false,
      requireParent: true,
      childDir: 'scss',
      fileCase: 'pascal',
      childFileCase: 'kebab'
    }
  },

  // Variant/State selector policy
  selectorPolicy: {
    variant: {
      mode: 'data',
      dataKeys: ['data-variant']
    },
    state: {
      mode: 'data',
      dataKey: 'data-state',
      ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
    }
  },

  // HTML → SCSS generator settings
  generator: {
    globalScssModule: '@styles/partials/global',
    pageEntryAlias: 'assets',
    pageEntrySubdir: 'css',
    rootFileCase: 'pascal',
    childScssDir: 'scss',
    layoutMixins: ['@include breakpoint-up(md)']
  }
}

export default config
