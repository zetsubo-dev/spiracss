# spiracss.config.js Guide

`spiracss.config.js` is the shared configuration file for SpiraCSS tooling.
Key sections:

- **aliasRoots**: path resolution for Comment Links / Stylelint
- **stylelint**: rule settings (classStructure / interactionScope / interactionProperties / keyframesNaming / pseudoNesting / relComments, etc.)
- **selectorPolicy**: variant/state representation policy (linting / generator / HTML lint)
- **htmlFormat**: output attribute for HTML placeholders
- **generator**: HTML-to-SCSS generation

## Setup

Place `spiracss.config.js` at the project root.
If `package.json` has `"type": "module"`, use ESM; otherwise use CommonJS.

For required files, see [Quickstart](../quickstart.md).

```js
// ESM
export default {
  // ...
}
```

```js
// CommonJS
module.exports = {
  // ...
}
```

## Loading behavior (common)

SpiraCSS tools share the same loading rules for `spiracss.config.js`.

- Only `spiracss.config.js` is considered (no automatic `.cjs` / `.mjs` discovery)
- Load location:
  - **HTML CLI**: relative to `process.cwd()`
  - **VS Code extensions**: workspace root
  - **Stylelint**: argument passed to `createRules()` / `createRulesAsync()`
- Failure behavior:
  - **HTML CLI**: if the file is missing, continue with defaults for backward compatibility (providing the file is recommended); if it exists but fails to load, exit with an error
  - **VS Code extensions**: warn and continue with defaults
  - **Stylelint**: throw an error and exit

## Table of contents
- [Loading behavior (common)](#loading-behavior-common)
- [aliasRoots](#aliasroots)
- [stylelint](#stylelint)
- [selectorPolicy](#selectorpolicy)
- [htmlFormat](#htmlformat)
- [generator](#generator)
- [Project customization examples](#project-customization-examples)
- [Troubleshooting](#troubleshooting)

## Configuration options

### `aliasRoots`

Defines root paths for alias resolution.

```js
aliasRoots: {
  components: ['src/components'],
  styles: ['src/styles']
}
```

- The `@` prefix is not required (e.g., `components` becomes `@components/...`)
- Keys should match `[a-z][a-z0-9-]*` (Stylelint resolves only this pattern; Comment Links can recognize any key defined in `aliasRoots`)
- Values must be arrays (relative paths recommended / absolute paths are allowed only within the project)
  - **Stylelint**: ignores candidates resolved outside the project root (does not validate bases)
  - **Comment Links**: ignores bases outside the project root and also ignores targets resolved outside the root
- Project root basis:
  - **Stylelint**: `cwd` (running from a subdirectory changes the base path; `createRulesAsync(path)` only specifies the config file path and does not change the project root—run Stylelint from the project root or set the task runner working directory / Node API `cwd`)
  - **Comment Links**: the VS Code workspace folder
- Stylelint cannot resolve aliases not defined in `aliasRoots`
- Comment Links only link aliases defined in `aliasRoots` or the built-in defaults (`@src` / `@components` / `@styles` / `@assets` / `@pages` / `@parts` / `@common`)
- CLI tools do not use `aliasRoots`
- `aliasRoots` is required when using `createRules()` or `createRulesAsync()` in the SpiraCSS Stylelint plugin (missing it throws an error)

### `stylelint`

Rule settings for the SpiraCSS Stylelint plugin.
When using `createRules()` or `createRulesAsync()`, `classStructure` / `interactionScope` / `interactionProperties` / `keyframesNaming` / `pseudoNesting` / `relComments` are optional; defaults apply if omitted.
Use `createRulesAsync()` if you want to pass a config path in ESM.
If you set `stylelint`, it must be a **plain object** (`stylelint: []` or `new Map()` are invalid).

#### `stylelint.sectionCommentPatterns`

Unifies comment matching for shared and interaction sections.
When using `createRules()` or `createRulesAsync()`, values here are expanded into each rule (per-rule overrides take priority).

```js
stylelint: {
  sectionCommentPatterns: {
    shared: /--shared/i,
    interaction: /--interaction/i
  }
}
```

**Note**: `shared` / `interaction` accept **RegExp or string**. Strings are treated as `new RegExp(pattern, 'i')`, and invalid/unsafe patterns fall back to the default. Use RegExp if you need more control.

#### `stylelint.cacheSizes`

Defines LRU cache sizes for Stylelint rules.
Defaults to **1000** for all caches.

```js
stylelint: {
  cacheSizes: {
    selector: 1000,
    patterns: 1000,
    naming: 1000,
    path: 1000
  }
}
```

- **`selector`**: selector parse cache (postcss-selector-parser)
- **`patterns`**: naming pattern generation cache
- **`naming`**: Block naming pattern cache
- **`path`**: @rel path existence cache

> Use positive integers only. Rule-level `cacheSizes` (classStructure / interactionScope / interactionProperties / keyframesNaming / pseudoNesting / relComments) override this value.

#### `stylelint.classStructure`

Defines class naming rules and selector structure.

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `allowElementChainDepth` | number | `4` | Max depth for Element chains |
| `allowExternalClasses` | string[] | `[]` | Exclude external classes (exact match) |
| `allowExternalPrefixes` | string[] | `[]` | Exclude external classes (prefix match) |
| `enforceChildCombinator` | boolean | `true` | Require `>` for direct children of a Block |
| `enforceSingleRootBlock` | boolean | `true` | Single root Block per file |
| `enforceRootFileName` | boolean | `true` | Require root Block name to match the filename |
| `rootFileCase` | `'preserve' \| 'kebab' \| 'snake' \| 'camel' \| 'pascal'` | `'preserve'` | Case for root Block filename |
| `childScssDir` | string | `'scss'` | Directory for child Block SCSS |
| `componentsDirs` | string[] | `['components']` | Directories treated as the component layer |
| `naming` | object | See below | Naming rule customization |
| `sharedCommentPattern` | RegExp / string | `/--shared/i` | Per-rule shared comment pattern (overrides `sectionCommentPatterns`) |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | Per-rule interaction comment pattern (overrides `sectionCommentPatterns`) |
| `selectorPolicy` | object | `data-variant` / `data-state` / `aria-*` | Rule-level override (when using `createRules()` or `createRulesAsync()`, top-level selectorPolicy takes priority) |
| `cacheSizes` | object | `stylelint.cacheSizes` | Rule-level override (falls back to `stylelint.cacheSizes`; otherwise 1000 each) |

**`naming` sub-items:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `blockCase` | `'kebab' \| 'camel' \| 'pascal' \| 'snake'` | `'kebab'` | Block case |
| `blockMaxWords` | number | `2` | Max words for Block names (2–100; minimum 2 is fixed, values above 100 are clamped) |
| `elementCase` | `'kebab' \| 'camel' \| 'pascal' \| 'snake'` | `'kebab'` | Element case |
| `modifierCase` | `'kebab' \| 'camel' \| 'pascal' \| 'snake'` | `'kebab'` | Modifier case |
| `modifierPrefix` | string | `'-'` | Modifier prefix |
| `customPatterns` | object | `undefined` | Custom regex (subkeys: `block` / `element` / `modifier`; values are RegExp) |

**`customPatterns` subkeys:**

| Subkey | Target | Example |
| --- | --- | --- |
| `block` | Block base class | `/^custom-block-.+$/` |
| `element` | Element base class | `/^icon-.+$/` |
| `modifier` | Modifier | `/^--[a-z]+(-[a-z]+)?$/` |

Example:

```js
stylelint: {
  classStructure: {
    allowElementChainDepth: 4,
    allowExternalClasses: [],
    allowExternalPrefixes: ['swiper-'],
    enforceChildCombinator: true,
    enforceSingleRootBlock: true,
    enforceRootFileName: true,
    rootFileCase: 'preserve',
    childScssDir: 'scss',
    componentsDirs: ['components'],
    naming: {
      blockCase: 'kebab',
      blockMaxWords: 2,
      elementCase: 'kebab',
      modifierCase: 'kebab',
      modifierPrefix: '-',
      customPatterns: {
        block: /^custom-block-.+$/,
        element: /^icon-.+$/,
        modifier: /^--[a-z]+(-[a-z]+)?$/
      }
    }
  }
}
```

**Notes:**

- If you use `customPatterns`, verify it stays consistent with HTML placeholders (`block-box` / `element`).
- `customPatterns` accept **RegExp only**. RegExp with `g` or `y` flags are invalid.
- Always treat element names as **a single word**. Even with camel/pascal case, internal capitals do not count as word boundaries (e.g. `bodyText` / `BodyText` are invalid because they appear to be multiple words).
- HTML lint / HTML generation also reference `classStructure.naming` / `allowExternalClasses` / `allowExternalPrefixes`.
- `enforceRootFileName` applies only under `componentsDirs`; `assets/css`, `index.scss`, and `_*.scss` are excluded.
- For `enforceRootFileName`, files under `childScssDir` expect the raw root Block name; files outside `childScssDir` use the `rootFileCase`-formatted name.
- When using `createRules()` or `createRulesAsync()`, `generator.rootFileCase` / `generator.childScssDir` are used as fallbacks for missing fields.

#### `stylelint.interactionScope`

Validates placement rules for the interaction section (`// --interaction` and `@at-root & { ... }`).

```js
stylelint: {
  interactionScope: {
    allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
    requireAtRoot: true,
    requireComment: true,
    requireTail: true,
    enforceWithCommentOnly: false,
    selectorPolicy: { ... } // optional (defaults to top-level selectorPolicy)
  }
}
```

The interaction section must **always be placed directly under the root Block** (this rule cannot be disabled; wrapper at-rules like @layer/@supports/@media/@container/@scope are allowed).

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `allowedPseudos` | string[] | `[':hover', ':focus', ':focus-visible', ':active', ':visited']` | Pseudo-classes to check |
| `requireAtRoot` | boolean | `true` | Require `@at-root & { ... }` and selectors that start with `&` |
| `requireComment` | boolean | `true` | Require `// --interaction` |
| `requireTail` | boolean | `true` | Require the interaction block to be at the end |
| `enforceWithCommentOnly` | boolean | `false` | Only validate blocks with the comment |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | Per-rule section comment pattern (overrides `sectionCommentPatterns`) |
| `selectorPolicy` | object | `data-variant` / `data-state` / `aria-*` | Rule-level override (uses top-level by default) |
| `cacheSizes` | object | `stylelint.cacheSizes` | Rule-level override (falls back to `stylelint.cacheSizes`; otherwise 1000 each) |

#### `stylelint.interactionProperties`

Validates transition/animation placement and transition target properties in the interaction section.

```js
stylelint: {
  interactionProperties: {
    // override section comment patterns if needed
    // sharedCommentPattern: /--shared/i,
    // interactionCommentPattern: /--interaction/i
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sharedCommentPattern` | RegExp / string | `/--shared/i` | Per-rule section comment pattern (overrides `sectionCommentPatterns`) |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | Per-rule section comment pattern (overrides `sectionCommentPatterns`) |
| `naming` | object | `classStructure.naming` | Naming settings (auto-inherited from `classStructure` when using `createRules()` / `createRulesAsync()`) |
| `allowExternalClasses` | string[] | `classStructure.allowExternalClasses` | External class exclusions (exact match; auto-inherited when using `createRules()` / `createRulesAsync()`) |
| `allowExternalPrefixes` | string[] | `classStructure.allowExternalPrefixes` | External class exclusions (prefix match; auto-inherited when using `createRules()` / `createRulesAsync()`) |
| `cacheSizes` | object | `stylelint.cacheSizes` | Rule-level override (falls back to `stylelint.cacheSizes`; otherwise 1000 each) |

#### `stylelint.keyframesNaming`

Validates `@keyframes` naming and placement rules.

```js
stylelint: {
  keyframesNaming: {
    actionMaxWords: 3,
    blockNameSource: 'selector',
    warnOnMissingBlock: true,
    sharedPrefixes: ['kf-'],
    sharedFiles: ['keyframes.scss'],
    ignoreFiles: [],
    ignorePatterns: [],
    // Skip placement checks for keyframes matched by ignorePatterns (default: false)
    ignorePlacementForIgnored: false
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `actionMaxWords` | number | `3` | Max words in the action segment (1–3) |
| `blockNameSource` | `'selector' \| 'file' \| 'selector-or-file'` | `'selector'` | Block name source (root selector, file name, or fallback) |
| `warnOnMissingBlock` | boolean | `true` | Warn when the root Block cannot be resolved |
| `sharedPrefixes` | string[] | `['kf-']` | Prefixes for shared keyframes |
| `sharedFiles` | (string \| RegExp)[] | `['keyframes.scss']` | File patterns allowed for shared keyframes (strings are suffix matches) |
| `ignoreFiles` | (string \| RegExp)[] | `[]` | File patterns to skip this rule (strings are suffix matches) |
| `ignorePatterns` | (string \| RegExp)[] | `[]` | Keyframes names to ignore (strings are treated as RegExp patterns) |
| `ignorePlacementForIgnored` | boolean | `false` | Skip placement checks (root/end) for keyframes matched by `ignorePatterns` |
| `naming` | object | `classStructure.naming` | Naming settings (auto-inherited from `classStructure` when using `createRules()` / `createRulesAsync()`) |
| `allowExternalClasses` | string[] | `classStructure.allowExternalClasses` | External class exclusions (exact match; auto-inherited when using `createRules()` / `createRulesAsync()`) |
| `allowExternalPrefixes` | string[] | `classStructure.allowExternalPrefixes` | External class exclusions (prefix match; auto-inherited when using `createRules()` / `createRulesAsync()`) |
| `cacheSizes` | object | `stylelint.cacheSizes` | Rule-level override (falls back to `stylelint.cacheSizes`; otherwise 1000 each) |

#### `stylelint.pseudoNesting`

Requires pseudo-classes/elements to be nested under `&`.

```js
stylelint: {
  pseudoNesting: {}
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `cacheSizes` | object | `stylelint.cacheSizes` | Rule-level override (falls back to `stylelint.cacheSizes`; otherwise 1000 each) |

- Allowed: `.btn { &:hover { ... } }`, `.btn { &::before { ... } }`
- Not allowed: `.btn:hover { ... }`, `& > .btn:hover { ... }`

#### `stylelint.relComments`

Defines rules for `@rel` link comments.

```js
stylelint: {
  relComments: {
    requireInScssDirectories: true,
    requireWhenMetaLoadCss: true,
    validatePath: true,
    skipFilesWithoutRules: true,
    requireChildRelComments: true,
    requireChildRelCommentsInShared: true,
    requireChildRelCommentsInInteraction: false,
    requireParentRelComment: true,
    childScssDir: 'scss'
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `requireInScssDirectories` | boolean | `true` | Require @rel in SCSS under `childScssDir` |
| `requireWhenMetaLoadCss` | boolean | `true` | Require a top-of-file comment when `@include meta.load-css("<childScssDir>")` is present |
| `validatePath` | boolean | `true` | Validate path existence |
| `skipFilesWithoutRules` | boolean | `true` | Skip SCSS files without selector rules |
| `requireChildRelComments` | boolean | `true` | Require parent-to-child @rel |
| `requireChildRelCommentsInShared` | boolean | `true` | Require child @rel even inside shared sections |
| `requireChildRelCommentsInInteraction` | boolean | `false` | Require child @rel even inside interaction sections |
| `requireParentRelComment` | boolean | `true` | Require child-to-parent @rel (only when `requireWhenMetaLoadCss` or `requireInScssDirectories` is enabled) |
| `childScssDir` | string | `'scss'` | Directory name for child Block SCSS (falls back to `generator.childScssDir` when using `createRules()` or `createRulesAsync()`) |
| `sharedCommentPattern` | RegExp / string | `/--shared/i` | Per-rule section comment pattern (overrides `sectionCommentPatterns`) |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | Per-rule section comment pattern (overrides `sectionCommentPatterns`) |
| `naming` | object | `classStructure.naming` | Naming settings (auto-inherited from `classStructure` when using `createRules()` or `createRulesAsync()`) |
| `allowExternalClasses` | string[] | `classStructure.allowExternalClasses` | External class exclusions (exact match; auto-inherited when using `createRules()` or `createRulesAsync()`) |
| `allowExternalPrefixes` | string[] | `classStructure.allowExternalPrefixes` | External class exclusions (prefix match; auto-inherited when using `createRules()` or `createRulesAsync()`) |
| `cacheSizes` | object | `stylelint.cacheSizes` | Rule-level override (falls back to `stylelint.cacheSizes`; otherwise 1000 each) |

Notes:
- Alias resolution uses `aliasRoots` (when `validatePath: true`)
- `requireParentRelComment` only fires when `requireWhenMetaLoadCss` is enabled and the parent Block includes `@include meta.load-css(...)`, or when `requireInScssDirectories` is enabled and the SCSS file lives under `childScssDir`

See [comment-links.md](comment-links.md) for details.

### `selectorPolicy`

Shared configuration for how variants/states are represented.
Defaults to **variant=`data-variant` / state=`data-state`**, and `aria-expanded` / `aria-selected` / `aria-disabled` are also treated as state.

```js
selectorPolicy: {
  valueNaming: {
    case: 'kebab',
    maxWords: 2
  },
  variant: {
    mode: 'data',
    dataKeys: ['data-variant']
  },
  state: {
    mode: 'data',
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `valueNaming` | object | `{ case: 'kebab', maxWords: 2 }` | Naming rules for data values (shared) |
| `variant` | object | `{ mode: 'data', dataKeys: ['data-variant'] }` | Variant representation |
| `state` | object | `{ mode: 'data', dataKey: 'data-state', ariaKeys: [...] }` | State representation |

Notes:
- `mode` supports only `data` / `class`
- Data value naming can be overridden by `variant/state.valueNaming`
- HTML lint validates only the reserved keys specified here
- If `variant.mode=class` and `state.mode=class` are both used, the HTML-to-SCSS generator treats modifiers as variants
- `aria-*` values are not validated because their spec and allowed values vary widely

#### `selectorPolicy.variant`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'data' \| 'class'` | `'data'` | Variant mode |
| `dataKeys` | string[] | `['data-variant']` | Allowlist of data attributes (empty array falls back to defaults; cannot disable) |
| `valueNaming` | object | `selectorPolicy.valueNaming` | Naming rules for data values |

#### `selectorPolicy.state`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'data' \| 'class'` | `'data'` | State mode |
| `dataKey` | string | `'data-state'` | Data attribute key for state (only one key allowed) |
| `ariaKeys` | string[] | `['aria-expanded', 'aria-selected', 'aria-disabled']` | Allowlist of aria attributes (empty array falls back to defaults; cannot disable) |
| `valueNaming` | object | `selectorPolicy.valueNaming` | Naming rules for data values |

### `htmlFormat`

Controls the output attribute when adding HTML placeholders.

#### `htmlFormat.classAttribute`

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `classAttribute` | `'class' \| 'className'` | `'class'` | Class attribute to output |

Notes:
- Input `class` / `className` is normalized to this setting
- Internally, `class` / `className` are temporarily converted to `data-spiracss-classname` and restored on output
- No file extension auto-detection is performed

### `generator`

Configuration for HTML-to-SCSS conversion.

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `globalScssModule` | string | `'@styles/partials/global'` | Inserts `@use "<value>" as *;` at the top of each generated SCSS file (in root mode, the root Block SCSS also includes `@use "sass:meta";` immediately after it) |
| `pageEntryAlias` | string | `'assets'` | Alias for the page entry comment |
| `pageEntrySubdir` | string | `'css'` | Subdirectory for the page entry comment |
| `rootFileCase` | `'preserve' \| 'kebab' \| 'snake' \| 'camel' \| 'pascal'` | `'preserve'` | Case for the root Block filename |
| `childScssDir` | string | `'scss'` | Output directory for child Block SCSS |
| `layoutMixins` | string[] | `['@include breakpoint-up(md)']` | Array of layout mixins |

Example:

```js
generator: {
  globalScssModule: '@styles/global',
  pageEntryAlias: 'assets',
  pageEntrySubdir: 'css',
  rootFileCase: 'kebab',
  childScssDir: 'scss',
  layoutMixins: ['@include breakpoint-up(md)', '@include breakpoint-up(lg)']
}
```

Notes:
- `pageEntryAlias` / `pageEntrySubdir`: in root mode, outputs a comment like `// @assets/css/index.scss` at the top of the root Block SCSS file (in selection mode, `// @rel/(parent-block).scss` is output instead)
- `pageEntrySubdir`: when empty, the subdirectory is omitted (e.g. `// @assets/index.scss`)
- `rootFileCase`: does not apply to child blocks
- `layoutMixins`: generates one `@include` block per entry (use an empty array to disable)

## Project customization examples

```js
module.exports = {
  aliasRoots: {
    components: ['components'],
    styles: ['styles']
  },
  stylelint: {
    classStructure: {
      allowElementChainDepth: 4,
      enforceChildCombinator: true,
      enforceSingleRootBlock: true
    },
    interactionScope: {
      allowedPseudos: [':hover', ':focus'],
      requireComment: true
    },
    pseudoNesting: {},
    relComments: {
      requireInScssDirectories: true
    }
  },
  generator: {
    globalScssModule: '@styles/global',
    childScssDir: 'scss',
    layoutMixins: ['@include breakpoint-up(md)']
  }
}
```

## Troubleshooting

### Comment Links path resolution fails

- Ensure there is no `@` in the `aliasRoots` keys
- Ensure the paths are relative to the project root
- Save `spiracss.config.js` and reload the workspace

### Stylelint rules are not applied

- Ensure the plugin is loaded in your Stylelint config
- Ensure `spiracss.config.js` exists in the `cwd` where Stylelint is run (if running from a subdirectory, use `createRulesAsync(path)` to specify the config path explicitly)

### Generated SCSS structure looks wrong

- Ensure `generator.globalScssModule` points to the correct path
- Ensure HTML class names follow the naming rules

## Related tools
### Tools
- [SpiraCSS Stylelint Plugin](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### Configuration example
- [spiracss.config.example.js](spiracss.config.example.js)

## SpiraCSS docs
- [Design Principles](../principles.md)
- [Quickstart](../quickstart.md)
- [CSS Layers](../layers.md)
- [Components](../component.md)
- [Guidelines](../guidelines.md)
- [Design Philosophy](../philosophy.md)
