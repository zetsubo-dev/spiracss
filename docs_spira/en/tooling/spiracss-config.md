# spiracss.config.js Guide

`spiracss.config.js` is the shared configuration file for SpiraCSS tooling.
Main sections:

- **aliasRoots**: path resolution for Comment Links / Stylelint
- **stylelint**: rule settings (base / class / placement / interactionScope / interactionProps / keyframes / pseudo / rel, etc.)
- **selectorPolicy**: variant/state representation policy (lint / generator / HTML lint)
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
  - **Stylelint**: `cwd` (running from a subdirectory changes the base path; `createRulesAsync(path)` only specifies the config file path and does not change the project root; run Stylelint from the project root or set the task runner working directory / Node API `cwd`)
  - **Comment Links**: the VS Code workspace folder
- Stylelint cannot resolve aliases not defined in `aliasRoots`
- Comment Links only link aliases defined in `aliasRoots` or the built-in defaults (`@src` / `@components` / `@styles` / `@assets` / `@pages` / `@parts` / `@common`)
- CLI tools do not use `aliasRoots`
- `aliasRoots` is required when using `createRules()` or `createRulesAsync()` in the SpiraCSS Stylelint plugin (missing it throws an error)

### `stylelint`

Rule settings for the SpiraCSS Stylelint plugin.
When using `createRules()` or `createRulesAsync()`, `base` / `class` / `placement` / `interactionScope` / `interactionProps` / `keyframes` / `pseudo` / `rel` are optional; defaults apply if omitted (`aliasRoots` is required).
Use `createRulesAsync()` if you want to pass a config path in ESM.
If you set `stylelint`, it must be a **plain object** (`stylelint: []` or `new Map()` are invalid).

#### `stylelint.base`

Shared settings used across multiple rules. `comments` / `external` / `naming` / `cache` / `selectorPolicy` / `paths` can be overridden per rule.

```js
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
    cache: {
      selector: 1000,
      patterns: 1000,
      naming: 1000,
      path: 1000
    },
    selectorPolicy: {
      // same shape as top-level selectorPolicy
    },
    paths: {
      childDir: 'scss',
      components: ['components']
    }
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `comments.shared` | RegExp / string | `/--shared/i` | Shared comment matcher |
| `comments.interaction` | RegExp / string | `/--interaction/i` | Interaction comment matcher |
| `external.classes` | string[] | `[]` | External class exclusions (exact match) |
| `external.prefixes` | string[] | `[]` | External class exclusions (prefix match) |
| `naming` | object | `undefined` | Naming rules (inherited by class / placement / keyframes / rel, etc.) |
| `cache.selector` | number | `1000` | Selector parse cache |
| `cache.patterns` | number | `1000` | Naming pattern generation cache |
| `cache.naming` | number | `1000` | Naming pattern cache |
| `cache.path` | number | `1000` | @rel path existence cache |
| `selectorPolicy` | object | top-level selectorPolicy | Rule-level selector policy override |
| `paths.childDir` | string | `'scss'` | Child Block SCSS directory (default for class / rel) |
| `paths.components` | string[] | `['components']` | Component-layer directories (default for class) |

**Note**: `comments.shared` / `comments.interaction` accept **RegExp or string**. Strings are treated as `new RegExp(pattern, 'i')`, and invalid/unsafe patterns fall back to defaults. Use RegExp if you need fine-grained control.

#### `stylelint.class`

Defines class naming rules and selector structure.

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `elementDepth` | number | `4` | Max Element chain depth |
| `childCombinator` | boolean | `true` | Require `>` for direct children of a Block |
| `childNesting` | boolean | `true` | Require child selectors to be nested inside the Block |
| `rootSingle` | boolean | `true` | Single root Block per file |
| `rootFile` | boolean | `true` | Require root Block name to match the filename |
| `rootCase` | `'preserve' \| 'kebab' \| 'snake' \| 'camel' \| 'pascal'` | `'preserve'` | Case for root Block filename |
| `childDir` | string | `'scss'` | Directory for child Block SCSS |
| `componentsDirs` | string[] | `['components']` | Directories treated as the component layer |
| `comments.shared` | RegExp / string | `/--shared/i` | Shared comment matcher (overrides `stylelint.base.comments`) |
| `comments.interaction` | RegExp / string | `/--interaction/i` | Interaction comment matcher (overrides `stylelint.base.comments`) |
| `external.classes` | string[] | `[]` | External class exclusions (exact match) |
| `external.prefixes` | string[] | `[]` | External class exclusions (prefix match) |
| `naming` | object | `stylelint.base.naming` | Naming rules |
| `selectorPolicy` | object | top-level selectorPolicy | Rule-level override (uses top-level selectorPolicy by default) |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

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
  class: {
    elementDepth: 4,
    childCombinator: true,
    childNesting: true,
    rootSingle: true,
    rootFile: true,
    rootCase: 'preserve',
    childDir: 'scss',
    componentsDirs: ['components'],
    external: {
      classes: [],
      prefixes: ['swiper-']
    },
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
- Element names are **always a single word**. Even with camel/pascal case, internal capitals do not count as word boundaries (`bodyText` / `BodyText` are invalid).
- HTML lint / HTML generation also reference `stylelint.base.naming` / `stylelint.base.external` (fallbacks to `stylelint.class` when base is missing).
- `rootFile` applies only under `componentsDirs`; `assets/css`, `index.scss`, and `_*.scss` are excluded.
- For `rootFile`, files under `childDir` expect the raw root Block name; files outside `childDir` use the `rootCase`-formatted name.
- When using `createRules()` or `createRulesAsync()`, `generator.rootFileCase` / `generator.childScssDir` are used as fallbacks for missing fields.

#### `stylelint.placement`

Validates property placement (container / item / internal).

```js
stylelint: {
  placement: {
    elementDepth: 4,
    marginSide: 'top',
    position: true,
    sizeInternal: true,
    responsiveMixins: []
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `elementDepth` | number | `class.elementDepth` | Max Element chain depth (fallback to class) |
| `marginSide` | `'top' \| 'bottom'` | `'top'` | Allowed vertical margin side |
| `position` | boolean | `true` | Enable child Block position restrictions |
| `sizeInternal` | boolean | `true` | Treat width/height/min/max as internal properties |
| `responsiveMixins` | string[] | `[]` | `@include` mixins treated as transparent |
| `comments.shared` | RegExp / string | `/--shared/i` | Shared comment matcher (overrides `stylelint.base.comments`) |
| `comments.interaction` | RegExp / string | `/--interaction/i` | Interaction comment matcher (overrides `stylelint.base.comments`) |
| `external.classes` | string[] | `stylelint.base.external.classes` | External class exclusions (exact match) |
| `external.prefixes` | string[] | `stylelint.base.external.prefixes` | External class exclusions (prefix match) |
| `naming` | object | `stylelint.base.naming` | Naming rules |
| `selectorPolicy` | object | top-level selectorPolicy | Rule-level override |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

#### `stylelint.interactionScope`

Validates placement rules for the interaction section (`// --interaction` and `@at-root & { ... }`).

```js
stylelint: {
  interactionScope: {
    pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
    requireAtRoot: true,
    requireComment: true,
    requireTail: true,
    commentOnly: false,
    selectorPolicy: { ... } // optional (defaults to top-level selectorPolicy)
  }
}
```

The interaction section must **always be placed directly under the root Block** (wrapper at-rules like @layer/@supports/@media/@container/@scope are allowed).

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `pseudos` | string[] | `[':hover', ':focus', ':focus-visible', ':active', ':visited']` | Pseudo-classes to check |
| `requireAtRoot` | boolean | `true` | Require `@at-root & { ... }` and selectors that start with `&` |
| `requireComment` | boolean | `true` | Require `// --interaction` |
| `requireTail` | boolean | `true` | Require the interaction block to be at the end |
| `commentOnly` | boolean | `false` | Only validate blocks with the comment |
| `comments.shared` | RegExp / string | `/--shared/i` | Shared comment matcher (overrides `stylelint.base.comments`) |
| `comments.interaction` | RegExp / string | `/--interaction/i` | Interaction comment matcher (overrides `stylelint.base.comments`) |
| `selectorPolicy` | object | top-level selectorPolicy | Rule-level override (uses top-level by default) |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

#### `stylelint.interactionProps`

Validates transition/animation placement and transition target properties in the interaction section.

```js
stylelint: {
  interactionProps: {
    // override section comment patterns if needed
    // comments: { shared: /--shared/i, interaction: /--interaction/i }
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `comments.shared` | RegExp / string | `/--shared/i` | Shared comment matcher (overrides `stylelint.base.comments`) |
| `comments.interaction` | RegExp / string | `/--interaction/i` | Interaction comment matcher (overrides `stylelint.base.comments`) |
| `naming` | object | `stylelint.base.naming` | Naming settings (auto-inherited from base when using `createRules()` / `createRulesAsync()`) |
| `external.classes` | string[] | `stylelint.base.external.classes` | External class exclusions (exact match; auto-inherited from base) |
| `external.prefixes` | string[] | `stylelint.base.external.prefixes` | External class exclusions (prefix match; auto-inherited from base) |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

#### `stylelint.keyframes`

Validates `@keyframes` naming and placement rules.

```js
stylelint: {
  keyframes: {
    enabled: true,
    actionMaxWords: 3,
    blockSource: 'selector',
    blockWarnMissing: true,
    sharedPrefixes: ['kf-'],
    sharedFiles: ['keyframes.scss'],
    ignoreFiles: [],
    ignorePatterns: [],
    // Skip placement checks for keyframes matched by ignorePatterns (default: false)
    ignoreSkipPlacement: false
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Disables this rule when set to `false` (only when using `createRules()` / `createRulesAsync()`) |
| `actionMaxWords` | number | `3` | Max words in the action segment (1–3) |
| `blockSource` | `'selector' \| 'file' \| 'selector-or-file'` | `'selector'` | Block name source (root selector, file name, or fallback) |
| `blockWarnMissing` | boolean | `true` | Warn when the root Block cannot be resolved |
| `sharedPrefixes` | string[] | `['kf-']` | Prefixes for shared keyframes |
| `sharedFiles` | (string \| RegExp)[] | `['keyframes.scss']` | File patterns allowed for shared keyframes (strings are suffix matches) |
| `ignoreFiles` | (string \| RegExp)[] | `[]` | File patterns to skip this rule (strings are suffix matches) |
| `ignorePatterns` | (string \| RegExp)[] | `[]` | Keyframes names to ignore (strings are treated as RegExp patterns) |
| `ignoreSkipPlacement` | boolean | `false` | Skip placement checks (root/end) for keyframes matched by `ignorePatterns` |
| `naming` | object | `stylelint.base.naming` | Naming settings (auto-inherited from base) |
| `external.classes` | string[] | `stylelint.base.external.classes` | External class exclusions (exact match; auto-inherited from base) |
| `external.prefixes` | string[] | `stylelint.base.external.prefixes` | External class exclusions (prefix match; auto-inherited from base) |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

#### `stylelint.pseudo`

Requires pseudo-classes/elements to be nested under `&`.

```js
stylelint: {
  pseudo: {}
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

- Allowed: `.btn { &:hover { ... } }`, `.btn { &::before { ... } }`
- Not allowed: `.btn:hover { ... }`, `& > .btn:hover { ... }`

#### `stylelint.rel`

Defines rules for `@rel` link comments.

```js
stylelint: {
  rel: {
    requireScss: true,
    requireMeta: true,
    requireParent: true,
    requireChild: true,
    requireChildShared: true,
    requireChildInteraction: false,
    validatePath: true,
    skipNoRules: true,
    childDir: 'scss'
  }
}
```

**Settings:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `requireScss` | boolean | `true` | Require @rel in SCSS under `childDir` |
| `requireMeta` | boolean | `true` | Require a top-of-file comment when `@include meta.load-css("<childDir>")` is present |
| `requireParent` | boolean | `true` | Require child-to-parent @rel (only when `requireMeta` / `requireScss` is enabled) |
| `requireChild` | boolean | `true` | Require parent-to-child @rel |
| `requireChildShared` | boolean | `true` | Require child @rel in shared sections |
| `requireChildInteraction` | boolean | `false` | Require child @rel in interaction sections |
| `validatePath` | boolean | `true` | Validate path existence |
| `skipNoRules` | boolean | `true` | Skip SCSS files without selector rules |
| `childDir` | string | `'scss'` | Directory name for child Block SCSS (falls back to `generator.childScssDir` when using `createRules()` or `createRulesAsync()`) |
| `aliasRoots` | object | `aliasRoots` | Alias roots for @rel resolution (defaults to top-level `aliasRoots`) |
| `comments.shared` | RegExp / string | `/--shared/i` | Shared comment matcher (overrides `stylelint.base.comments`) |
| `comments.interaction` | RegExp / string | `/--interaction/i` | Interaction comment matcher (overrides `stylelint.base.comments`) |
| `naming` | object | `stylelint.base.naming` | Naming settings (auto-inherited from base) |
| `external.classes` | string[] | `stylelint.base.external.classes` | External class exclusions (exact match; auto-inherited from base) |
| `external.prefixes` | string[] | `stylelint.base.external.prefixes` | External class exclusions (prefix match; auto-inherited from base) |
| `cache` | object | `stylelint.base.cache` | Rule-level override (falls back to base; otherwise 1000 each) |

Notes:
- Alias resolution uses `aliasRoots` (when `validatePath: true`)
- `requireParent` only fires when `requireMeta` is enabled and the parent Block includes `@include meta.load-css(...)`, or when `requireScss` is enabled and the SCSS file lives under `childDir`

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
    class: {
      elementDepth: 4,
      childCombinator: true,
      rootSingle: true
    },
    interactionScope: {
      pseudos: [':hover', ':focus'],
      requireComment: true
    },
    pseudo: {},
    rel: {
      requireScss: true
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

- Ensure the `generator.globalScssModule` path is correct
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
