# SpiraCSS Stylelint Plugin

A Stylelint plugin for validating SpiraCSS design rules.

For SpiraCSS design principles, see [Design Principles](../principles.md).
This document summarizes what linting can enforce and how to install and configure the plugin.

**Note**: This document is the source of truth for Stylelint installation and configuration.  
For rule details, see the [Stylelint rule reference](stylelint-rules/index.md).

## Overview

- Package: `@spiracss/stylelint-plugin`
- Rules:
  - `spiracss/class-structure`
  - `spiracss/property-placement`
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

> When using `createRules()` or `createRulesAsync()`, **`aliasRoots` is required** (missing it throws an error). The `stylelint` sub-sections (`base` / `class` / `placement` / `interactionScope` / `interactionProps` / `keyframes` / `pseudo` / `rel`) are optional and fall back to defaults.
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

`createRules()` returns a `rules` object that bundles the seven SpiraCSS rules.
Shared/interaction comment detection can be centralized in `stylelint.base.comments`. See [spiracss-config.md](spiracss-config.md) for details.

## Rules

For OK / NG / Why details, see the [Stylelint rule reference](stylelint-rules/index.md).

### `spiracss/class-structure`

Validates naming, parent-child structure, and section structure. See [class-structure](stylelint-rules/class-structure.md).

### `spiracss/property-placement`

Validates property placement (container / item / internal). See [property-placement](stylelint-rules/property-placement.md).

### `spiracss/interaction-scope`

Validates interaction section placement and structure. See [interaction-scope](stylelint-rules/interaction-scope.md).

### `spiracss/interaction-properties`

Validates transition / animation usage inside interaction. See [interaction-properties](stylelint-rules/interaction-properties.md).

### `spiracss/keyframes-naming`

Validates `@keyframes` placement and naming. See [keyframes-naming](stylelint-rules/keyframes-naming.md).

### `spiracss/pseudo-nesting`

Validates pseudo-class / pseudo-element nesting. See [pseudo-nesting](stylelint-rules/pseudo-nesting.md).

### `spiracss/rel-comments`

Validates `@rel` comments for parent-child links. See [rel-comments](stylelint-rules/rel-comments.md).

### Rule responsibility breakdown

The seven Stylelint rules are organized by the sections they validate.

| Rule | Target sections |
|--------|--------------|
| **`class-structure`** | [Naming conventions](../component.md#naming-conventions), [Parent-child rules](../component.md#parent-child-rules), [SCSS section structure](../component.md#scss-section-structure) |
| **`property-placement`** | [Property placement cheat sheet](../component.md#property-placement-cheat-sheet), vertical margin side unification |
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
