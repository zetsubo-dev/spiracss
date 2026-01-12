// SpiraCSS shared configuration file (sample)
// In real projects, copy this file to the project root and
// adjust paths and options to match your directory structure.
// This sample uses ESM syntax (export default).
//
// - aliasRoots:  alias mappings such as @components / @assets / @styles to real directories
// - `stylelint`: options passed to the Stylelint plugin rules
// - selectorPolicy: variant/state representation policy
// - htmlFormat: output attribute for HTML placeholders
// - generator:  options for HTML-to-SCSS generators (VS Code extension, CLI)

/** @type {{ aliasRoots: Record<string, string[]>; stylelint: any; selectorPolicy: any; htmlFormat: any; generator: any }} */
const config = {
  // Alias definitions used by Comment Links and Stylelint @rel validation (relative paths from project root recommended / absolute paths allowed only within the project)
  aliasRoots: {
    src: ['src'],
    components: ['src/components'],
    styles: ['src/styles'],
    common: ['src/components/common'],
    pages: ['src/components/pages'],
    parts: ['src/components/parts'],
    assets: ['src/assets']
  },

  // Recommended settings for SpiraCSS Stylelint rules (adjust per project)
  stylelint: {
    // Cache sizes (LRU / default: 1000)
    cacheSizes: {
      selector: 1000,
      patterns: 1000,
      naming: 1000,
      path: 1000
    },
    // Shared section comment patterns (default: { shared: /--shared/i, interaction: /--interaction/i })
    sectionCommentPatterns: {
      shared: /--shared/i,
      interaction: /--interaction/i
    },

    classStructure: {
      // Max Element > Element chain depth (default: 4)
      allowElementChainDepth: 4,
      // Class names excluded from naming/structure checks (exact match / default: [])
      allowExternalClasses: [],
      // Class name prefixes excluded from naming/structure checks (prefix match / e.g. u- / swiper- / default: [])
      allowExternalPrefixes: ['u-'],
      // Require `>` child selectors directly under Block (default: true)
      enforceChildCombinator: true,
      // Limit to one root Block per file (default: true)
      enforceSingleRootBlock: true,
      // Require root Block name to match the SCSS filename (default: true)
      enforceRootFileName: true,
      // Root Block SCSS filename case (default: 'preserve')
      rootFileCase: 'preserve', // align with generator.rootFileCase
      // Directory name for child Block SCSS (default: 'scss')
      childScssDir: 'scss',
      // Directory names treated as the component layer (default: ['components'])
      componentsDirs: ['components'],
      // Naming customization (SpiraCSS defaults when omitted)
      naming: {
        // Block word case (kebab / snake / camel / pascal / default: 'kebab')
        blockCase: 'kebab',
        // Block max words (2-100 / default: 2)
        blockMaxWords: 2,
        // Element word case (kebab / snake / camel / pascal / default: 'kebab')
        elementCase: 'kebab',
        // Modifier word case for class mode (kebab / snake / camel / pascal / default: 'kebab')
        modifierCase: 'kebab',
        // Modifier prefix for class mode (default: '-')
        modifierPrefix: '-',
        // Override naming rules with RegExp (default: none)
        customPatterns: {
          // block: /^custom-block-.+$/, // example
          // element: /^icon-.+$/, // example
          // modifier: /^--[a-z]+(-[a-z]+)?$/ // example
        }
      }
    },

    interactionScope: {
      // Pseudo-classes to validate (default: [':hover', ':focus', ':focus-visible', ':active', ':visited'])
      allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      // Require @at-root & { ... } and selectors starting with & (default: true)
      requireAtRoot: true,
      // Require --interaction comment (default: true)
      requireComment: true,
      // Require interaction block at the end (default: true)
      requireTail: true,
      // Only validate blocks that have comments (default: false)
      enforceWithCommentOnly: false,
      // selectorPolicy references top-level (set only if you need to override explicitly)
      // selectorPolicy: { ... }
    },

    interactionProperties: {
      // Enforce transition/animation declarations inside the interaction section
      // Override sharedCommentPattern / interactionCommentPattern only if needed
      // sharedCommentPattern: /--shared/i,
      // interactionCommentPattern: /--interaction/i
    },

    keyframesNaming: {
      // Max words for action (1-3 / default: 3)
      actionMaxWords: 3,
      // Block name source (selector / file / selector-or-file / default: selector)
      blockNameSource: 'selector',
      // Warn when Block cannot be resolved (default: true)
      warnOnMissingBlock: true,
      // Prefixes for shared keyframes (default: ['kf-'])
      sharedPrefixes: ['kf-'],
      // Files allowed for shared keyframes (string = suffix match / default: ['keyframes.scss'])
      sharedFiles: ['keyframes.scss'],
      // Files to ignore for this rule (string = suffix match / default: [])
      ignoreFiles: [],
      // Keyframes names to ignore (string treated as RegExp / default: [])
      ignorePatterns: [],
      // Skip placement checks for keyframes matched by ignorePatterns (default: false)
      ignorePlacementForIgnored: false
    },

    relComments: {
      // Require @rel in SCSS directories (default: true)
      requireInScssDirectories: true,
      // Require @rel when meta.load-css is present (default: true)
      requireWhenMetaLoadCss: true,
      // Validate @rel path existence (default: true)
      validatePath: true,
      // Skip files without selector rules (default: true)
      skipFilesWithoutRules: true,
      // Require parent -> child @rel (default: true)
      requireChildRelComments: true,
      // Require child @rel in shared sections (default: true)
      requireChildRelCommentsInShared: true,
      // Require child @rel in interaction sections (default: false)
      requireChildRelCommentsInInteraction: false,
      // Require child -> parent @rel (default: true)
      requireParentRelComment: true,
      // Directory name for child Block SCSS (default: 'scss')
      childScssDir: 'scss'
    }
  },

  // Variant/state representation policy (default uses data attributes)
  selectorPolicy: {
    // Naming rules for data values (shared default)
    valueNaming: {
      case: 'kebab', // 'kebab' | 'snake' | 'camel' | 'pascal'
      maxWords: 2    // max words (default: 2)
    },
    variant: {
      // 'data' | 'class'
      mode: 'data',
      // Allowlist of data attributes for variants (default: ['data-variant'])
      dataKeys: ['data-variant']
    },
    state: {
      // 'data' | 'class'
      mode: 'data',
      // Data attribute key for state (default: 'data-state')
      dataKey: 'data-state',
      // Allowlist of aria attributes for state
      ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
      // valueNaming: { maxWords: 1 } // override only for state
    }
  },

  // Output attribute for HTML placeholders (default: 'class')
  htmlFormat: {
    // 'class' | 'className'
    classAttribute: 'class'
  },

  // Settings for HTML-to-SCSS generators (VS Code extension / CLI)
  generator: {
    // Path for `@use "<path>" as *;` injected into generated SCSS (default: '@styles/partials/global')
    globalScssModule: '@styles/partials/global',
    // Alias for page entry comments (default: 'assets')
    pageEntryAlias: 'assets',
    // Subdirectory for page entry comments (default: 'css')
    pageEntrySubdir: 'css',
    // Root SCSS filename case (preserve / kebab / snake / camel / pascal / default: 'preserve')
    rootFileCase: 'preserve',
    // Directory name for child Block SCSS output (default: 'scss')
    childScssDir: 'scss',
    // Layout mixin list (default: ['@include breakpoint-up(md)'])
    layoutMixins: ['@include breakpoint-up(md)']
  }
}

export default config
