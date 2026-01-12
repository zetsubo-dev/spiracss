# SpiraCSS Stylelint Plugin

A Stylelint plugin for validating SpiraCSS design rules.

For SpiraCSS design principles, see [Design Principles](../principles.md).
This document summarizes what linting can enforce and how to install and configure the plugin.

**Note**: This document is the source of truth for Stylelint installation and configuration.  
Other documents only provide a summary and should link here for details.

## Overview

- Package: `@spiracss/stylelint-plugin`
- Rules:
  - `spiracss/class-structure`
  - `spiracss/interaction-scope`
  - `spiracss/interaction-properties`
  - `spiracss/keyframes-naming`
  - `spiracss/pseudo-nesting`
  - `spiracss/rel-comments`

## Install

Stylelint v16 or later is required.

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
# or
yarn add -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

## Configuration

### Prepare the shared config (spiracss.config.js)

SpiraCSS tools (the Stylelint plugin, VS Code extensions, and the CLI) use the same configuration.
Place `spiracss.config.js` at the project root, and see [spiracss-config.md](spiracss-config.md) for configuration options.
For required files, see [Quickstart](../quickstart.md).

### Integrate with Stylelint

Once `spiracss.config.js` is in place, use `createRules()` in `stylelint.config.js`:

> When using `createRules()` or `createRulesAsync()`, **`aliasRoots` is required** (missing it throws an error). The `stylelint` sub-sections (`classStructure` / `interactionScope` / `interactionProperties` / `keyframesNaming` / `pseudoNesting` / `relComments`) are optional and fall back to defaults.
> If you set `stylelint`, it must be an object (`stylelint: []` is invalid).

```js
// stylelint.config.js
const spiracss = require('@spiracss/stylelint-plugin')
const plugin = spiracss.default ?? spiracss
// plugin and createRules come from the same package
const { createRules } = spiracss

module.exports = {
  plugins: [plugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules('./spiracss.config.js'),
    'scss/at-rule-no-unknown': true
  }
}
```

#### ESM (when `package.json` has `"type": "module"`)

In Node projects that treat `.js` as ES modules, `spiracss.config.js` also becomes ESM (`export default`).
In that case, pass the config in one of the following ways.

```js
// stylelint.config.js
import spiracssPlugin, { createRules } from '@spiracss/stylelint-plugin'
import spiracssConfig from './spiracss.config.js'

export default {
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules(spiracssConfig),
    'scss/at-rule-no-unknown': true
  }
}
```

If you want to pass a config path, use `createRulesAsync()` (because `require()` is unavailable in ESM).

```js
// stylelint.config.js
import spiracssPlugin, { createRulesAsync } from '@spiracss/stylelint-plugin'

const rules = await createRulesAsync('./spiracss.config.js')

export default {
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...rules,
    'scss/at-rule-no-unknown': true
  }
}
```

**Note**: `createRulesAsync(path)` uses a `new Function()`-based dynamic import **only when running in CJS and loading an ESM config**. With Node `--disallow-code-generation-from-strings`, that code path fails; in that case pass the config object to `createRules(spiracssConfig)` or remove the flag (pure ESM uses `import()` directly).

`createRules()` returns a `rules` object that bundles the six SpiraCSS rules.
Shared/interaction comment detection can be centralized in `stylelint.sectionCommentPatterns`. See [spiracss-config.md](spiracss-config.md) for details.

## Rules

### `spiracss/class-structure`

Validates SpiraCSS class structure (Block / Element / Modifier) and base selector structure.

- Naming (Block / Element / Modifier)
- Parent-child constraints between Block and Element (e.g., disallow `Element > Block`)
- Require `>` for direct children of a Block (relaxed in the shared section; the interaction section is excluded from structural checks; controlled by `enforceChildCombinator`)
- Naming validation still runs inside the interaction section, but structure rules (parent-child constraints / depth / combinators) do not
- Require shared section placement directly under the root Block (allowed inside @layer / @supports / @media / @container / @scope wrappers)
- Root Block restriction via `enforceSingleRootBlock`
- Top-level selectors must include the root Block (when `enforceSingleRootBlock` is enabled)
- Match the root Block class name to the SCSS file name via `enforceRootFileName`
- `selectorPolicy` for data/state handling

#### Shared section behavior

In the shared section, only the child-combinator requirement is relaxed; naming and structure rules remain.
The shared section must be placed directly under the root Block (do not place it inside child rules; wrappers like @layer / @supports / @media / @container / @scope are allowed).

```scss
.sample-block {
  > .title {}
  // --shared
  .utility {}
  .helper { .nested {} }
}
```

### `spiracss/interaction-scope`

Validates placement rules for the interaction section (`// --interaction` and `@at-root & { ... }`).

- Selectors that include pseudo-classes or state selectors (e.g., `[data-state]`, `[aria-expanded]`, `[aria-expanded="true"]`) are grouped under the `@at-root & { ... }` block and must start with `&` (leading combinators such as `>` are not allowed, e.g., `> &:hover`)
- The `// --interaction` comment must be placed immediately before the `@at-root` block (or its wrapper such as @layer / @supports / @media / @container / @scope)
- By default (`enforceWithCommentOnly: false`), pseudo-classes or state selectors are reported even without the comment, and you will be prompted to move them to the interaction section
- The interaction block must be placed at the end of the root Block
- The interaction block must be placed directly under the root Block (allowed inside @layer / @supports / @media / @container / @scope wrappers)
- `data-variant` is allowed in the interaction section (for initial interaction values; do not mix with `data-state` / `aria-*` in the same selector)

Example:

```scss
.sample-block {
  // --interaction
  @at-root & {
    > .icon {
      &:hover {}
    }
  }
}
```

### `spiracss/interaction-properties`

Collects transition/animation declarations inside the interaction section and requires explicit transition targets.

- `transition` / `transition-*` / `animation` / `animation-*` must live in the `// --interaction` section (`transition-*` includes `transition-property` / `transition-duration` / `transition-delay` / `transition-timing-function` / `transition-behavior`)
- `transition` must list target properties explicitly (`transition: all`, `transition-property: all`, omitted properties, `var(...)`-only values, or keywords like `inherit` / `initial` / `unset` / `revert` / `revert-layer` are not allowed)
- `transition: none` / `transition-property: none` are not allowed (use a tiny `transition-duration` instead)
- Properties listed in `transition` must not be declared outside the interaction section for the same Block/Element (pseudo-elements are separate; initial values belong in interaction)

Example:

```scss
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }
}
```

### `spiracss/keyframes-naming`

Validates placement and naming rules for `@keyframes`.

- `@keyframes` must be placed at the **root level** (not inside @media/@layer/etc)
- `@keyframes` must be grouped at the **end of the file** (ignoring comments/blank lines)
- Naming must follow `{block}-{action}` or `{block}-{element}-{action}`
- Block/Element casing follows `classStructure.naming`
- Element names are allowed only when they exist in the same file
- Action uses `blockCase` with **1–3 words** (configurable via `actionMaxWords`; e.g. `fade-in` / `fadeIn` / `fade_in`)
- The separator between block and action is always `-` (e.g. `cardList-fadeIn` / `CardList-fadeIn`)
- Shared animations should use a prefix such as `kf-` and be placed in `keyframes.scss`
- If the root Block cannot be resolved, the rule **warns and skips naming checks** (placement checks still run; configurable via `blockNameSource`)

Example:

```scss
.sample-block {}

@keyframes sample-block-fade-in {
  to {
    opacity: 1;
  }
}
```

### `spiracss/pseudo-nesting`

Requires pseudo-classes / pseudo-elements to be written as nested selectors under `&`.

- OK: `.btn { &:hover { ... } }`, `.btn { &::before { ... } }`
- Not allowed: `.btn:hover { ... }`, `& > .btn:hover { ... }`

### `spiracss/rel-comments`

Validates relationships between entry point (page entry) SCSS files, Blocks, and child Blocks using `@rel` / alias comments.
It corresponds to [@rel comments](../component.md#rel-comments).

- Parent/child link comments must appear at the top of the root scope (root wrappers such as @layer / @supports / @media / @container / @scope are allowed; placing them inside the root Block is an error)
- Parent Block must be the first rule in the same scope (when a parent `@rel` is required)
- The first node in the direct child rule under `> .child-block` must be the `@rel` comment (shared is included; interaction is excluded by default)
- Validate that comment paths exist (when enabled)

See [comment-links.md](comment-links.md) and [spiracss-config.md](spiracss-config.md) for details.

### Rule responsibility breakdown

The six Stylelint rules are organized by the sections they validate.

| Rule | Target sections |
|--------|--------------|
| **`class-structure`** | [Naming conventions](../component.md#naming-conventions), [Parent-child rules](../component.md#parent-child-rules), [SCSS section structure](../component.md#scss-section-structure) |
| **`interaction-scope`** | [SCSS section structure](../component.md#scss-section-structure) |
| **`interaction-properties`** | [Interaction section](../component.md#interaction-section) |
| **`keyframes-naming`** | [@keyframes](../component.md#keyframes) |
| **`pseudo-nesting`** | [SCSS section structure](../component.md#scss-section-structure) |
| **`rel-comments`** | [@rel comments](../component.md#rel-comments) |

> **Important:**
> This plugin can validate structural elements such as class names, selector structure, and `@rel` comments.
> It cannot automatically judge design decisions like the intent of Element chains or the validity of data/state, so supplement with design reviews or code reviews.

## Customization

Adjust rules in `spiracss.config.js` for each project.
If you use settings that deviate from the spec, align them in a design review and ensure Stylelint / VS Code extensions / CLI reference the same config.

If you want to disable a specific rule, override it in `stylelint.config.(c)js`.

```js
// stylelint.config.cjs
module.exports = {
  // ...
  rules: {
    ...createRules('./spiracss.config.js'),
    'spiracss/rel-comments': null
  }
}
```

See [spiracss-config.md](spiracss-config.md) for details.

## Related tools
### Tools
- SpiraCSS Stylelint Plugin
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### Configuration
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS docs
- [Design Principles](../principles.md)
- [Quickstart](../quickstart.md)
- [CSS Layers](../layers.md)
- [Components](../component.md)
- [Guidelines](../guidelines.md)
- [Design Philosophy](../philosophy.md)
