# @spiracss/stylelint-plugin

SpiraCSS Stylelint plugin. Validates class structure, interaction scope/properties, keyframes naming, pseudo nesting, and rel-comment links.

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture built on minimal structural principles derived from HTML/CSS. It reduces inconsistencies in structural decisions that are common in CSS design by replacing individual intuition with clear principles. Designed for AI-assisted implementation and tool-based validation, it aims to shorten development time and ensure consistent quality.

Key points:
- Structural decisions can be derived from class names and HTML structure.
- `shared`/`interaction`/`rel` comment conventions can be treated as tool-verifiable contracts.
- SpiraCSS projects should place [`spiracss.config.js`](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/spiracss-config.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/spiracss-config.md)\] at the project root so that generation and validation follow the same policy.
- Download [spiracss-ai-doc.md](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ai/spiracss-ai-doc.md) and use it as a reference document for AI-assisted workflows.

This plugin validates those contracts at lint time, keeping structure verifiable.

## Status

Beta release. Breaking changes may still occur.

## Requirements

- Node.js >= 20
- Stylelint v16+

## Install

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

## Usage

The canonical setup guide is:
- [Stylelint guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/stylelint.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint.md)\]

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
- `pseudoNesting` has no options; defaults apply even when omitted.

## Docs

- [Stylelint guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/stylelint.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint.md)\]
- [Quickstart](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/quickstart.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/quickstart.md)\]
- [`spiracss.config.js` guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/spiracss-config.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/spiracss-config.md)\]

## Related Tools

- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- [SpiraCSS Comment Links (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)
- [SpiraCSS HTML to SCSS (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)
