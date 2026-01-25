// SpiraCSS Configuration for Examples
// This is a minimal example configuration for SpiraCSS SCSS structure

/** @type {{ aliasRoots: Record<string, string[]>; fileCase: any; stylelint: any; selectorPolicy: any; generator: any }} */
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

  // Default file name casing for root/child SCSS (generator + stylelint)
  // Example: { root: 'pascal', child: 'kebab' }
  fileCase: {
    root: 'preserve',
    child: 'preserve'
  },

  // Stylelint rules configuration (aligned with current config schema)
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
      // Maximum depth of Element > Element chains
      elementDepth: 4,
      // Require `>` child combinator for direct children
      childCombinator: true
    },

    interactionScope: {
      // Allowed pseudo-classes
      pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      // Require @at-root & { ... } wrapper
      requireAtRoot: true,
      // Require --interaction comment
      requireComment: true,
      // Require interaction block at the end
      requireTail: true
    },

    rel: {
      // Require @rel in scss directories
      requireScss: true,
      // Require @rel when meta.load-css is present
      requireMeta: true,
      // Validate @rel paths
      validatePath: true,
      // Skip files without rules
      skipNoRules: true,
      // Require child @rel comments
      requireChild: true,
      requireChildShared: true,
      requireChildInteraction: false,
      // Require parent @rel comment
      requireParent: true,
      // File name case for @rel targets (fallback: fileCase.root)
      fileCase: 'preserve',
      // File name case for @rel targets inside childDir (fallback: fileCase.child)
      childFileCase: 'preserve',
      // Child SCSS directory name
      childDir: 'scss'
    }
  },

  // Variant/State selector policy (data attributes by default)
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
    rootFileCase: 'preserve',
    childFileCase: 'preserve',
    childScssDir: 'scss',
    layoutMixins: ['@include breakpoint-up(md)']
  }
}

export default config
