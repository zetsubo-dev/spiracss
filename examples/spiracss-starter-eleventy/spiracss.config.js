// SpiraCSS Configuration for Eleventy Simple Example

/** @type {{ aliasRoots: Record<string, string[]>; stylelint: any; selectorPolicy: any; generator: any }} */
const config = {
  // Path aliases for @rel comment validation and imports
  aliasRoots: {
    src: ["src"],
    styles: ["src/styles"],
    assets: ["src/assets"],
    layouts: ["src/_includes/layouts"],
    partials: ["src/_includes/partials"],
    blocks: ["src/_includes/blocks"]
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
        prefixes: ["u-"]
      },
      naming: {
        blockCase: "kebab",
        blockMaxWords: 2,
        elementCase: "kebab",
        modifierCase: "kebab",
        modifierPrefix: "-"
      },
      paths: {
        childDir: "scss",
        components: ["src/_includes"]
      }
    },

    class: {
      elementDepth: 4,
      childCombinator: true,
      rootCase: "kebab"
    },

    interactionScope: {
      pseudos: [":hover", ":focus", ":focus-visible", ":active", ":visited"],
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
      childDir: "scss",
      fileCase: "kebab",
      childFileCase: "kebab"
    }
  },

  // Variant/State selector policy
  selectorPolicy: {
    variant: {
      mode: "data",
      dataKeys: ["data-variant"]
    },
    state: {
      mode: "data",
      dataKey: "data-state",
      ariaKeys: ["aria-expanded", "aria-selected", "aria-disabled"]
    }
  },

  // HTML -> SCSS generator settings
  generator: {
    globalScssModule: "styles/partials/global",
    pageEntryAlias: "assets",
    pageEntrySubdir: "css",
    rootFileCase: "kebab",
    childScssDir: "scss",
    layoutMixins: ["@include breakpoint-up(md)"]
  }
};

export default config;
