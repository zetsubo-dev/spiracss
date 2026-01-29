# @spiracss/stylelint-plugin

SpiraCSS Stylelint plugin. Validates class structure, property placement, interaction scope/properties, keyframes naming, pseudo nesting, and rel-comment links.

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture based on one principle. The HTML structure determines how to write styles, eliminating the need for individual judgment. Validated by tools, with errors designed for both humans and AI agents.

This plugin is designed to be used with the [SpiraCSS Design Principles](https://spiracss.jp/architecture/principles/).

→ [See how it works](https://spiracss.jp)

## Status

Beta release. Breaking changes may still occur.

## Requirements

- Node.js >= 20
- Stylelint v16+

## Install

```bash
yarn add -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

## Usage

The canonical setup guide is:
- [Stylelint Plugin](https://spiracss.jp/tooling/stylelint/)

```js
// stylelint.config.js (ESM)
import spiracss, { createRules } from '@spiracss/stylelint-plugin'
import spiracssConfig from './spiracss.config.js'

export default {
  plugins: [spiracss, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules(spiracssConfig),
    'scss/at-rule-no-unknown': true
  }
}
```

CommonJS example:

```js
// stylelint.config.js (CommonJS)
const spiracss = require('@spiracss/stylelint-plugin')
const plugin = spiracss.default ?? spiracss
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

## Helpers

`createRules()` and `createRulesAsync()` are also available via a dedicated subpath export.
Use the same config object as the main example (see the guide above).

```js
import { createRules } from '@spiracss/stylelint-plugin/helpers'
```

## Configuration

SpiraCSS tools share a common configuration file: `spiracss.config.js` at the project root.
`createRules()` requires `aliasRoots`; `stylelint` sub-sections are optional and fall back to defaults.
See the config guide for full options (EN/JA links below).

Minimal example:

```js
export default {
  aliasRoots: {
    components: ['src/components'],
    styles: ['src/styles']
  }
}
```

Note: If your project is CommonJS (no `"type": "module"` in `package.json`), use `module.exports = { ... }` instead of `export default`.

## Notes

- In ESM-only projects, either import the config and pass the object to `createRules(config)` or use `createRulesAsync(path)`.
- ESM config path shortcut:
  ```js
  import { createRulesAsync } from '@spiracss/stylelint-plugin'
  const rules = await createRulesAsync('./spiracss.config.js')
  ```
- `stylelint.pseudo.enabled` disables the pseudo-nesting rule when set to `false` (defaults to `true`).

## Docs

- [Stylelint Plugin](https://spiracss.jp/tooling/stylelint/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- SpiraCSS Comment Links ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-comment-links))
- SpiraCSS HTML to SCSS ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-html-to-scss))
