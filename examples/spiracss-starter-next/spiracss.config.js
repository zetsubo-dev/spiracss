// SpiraCSS Configuration for Next Simple Example

/** @type {{ aliasRoots: Record<string, string[]>; stylelint: any; selectorPolicy: any; jsxClassBindings: any; generator: any }} */
const config = {
  // Path aliases for @rel comment validation and imports
  aliasRoots: {
    src: ["src"],
    components: ["src/components"],
    styles: ["src/styles"],
    layouts: ["src/components/layouts"],
    common: ["src/components/common"],
    pages: ["src/components/pages"],
    parts: ["src/components/parts"]
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
        blockCase: "camel",
        blockMaxWords: 2,
        elementCase: "camel",
        modifierCase: "camel",
        modifierPrefix: "-"
      },
      paths: {
        childDir: "scss",
        components: ["src/components"]
      }
    },

    class: {
      elementDepth: 4,
      childCombinator: true,
      rootFile: false
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
      fileCase: "preserve",
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

  // JSX / TSX className extraction (recommended for CSS Modules usage)
  jsxClassBindings: {
    memberAccessAllowlist: ["styles"]
  },

  // HTML → SCSS generator settings
  generator: {
    globalScssModule: "@styles/partials/global",
    pageEntryAlias: "styles",
    pageEntrySubdir: "pages",
    rootFileCase: "preserve",
    childScssDir: "scss",
    layoutMixins: ["@include breakpoint-up(md)"]
  }
};

export default config;
