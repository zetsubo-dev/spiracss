# @spiracss/html-cli

CLI tools for SpiraCSS HTML to SCSS generation, HTML structure linting, and placeholder formatting.

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture built on minimal structural principles derived from HTML/CSS. It reduces inconsistencies in structural decisions that are common in CSS design by replacing individual intuition with clear principles. Designed for implementation with AI agents and tool-based validation, it aims to shorten development time and ensure consistent quality.

Overview: [SpiraCSS Design Principles](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/principles.md)

Key points:
- Structural decisions can be derived from class names and HTML structure.
- `shared`/`interaction`/`rel` comment conventions can be treated as tool-verifiable contracts.
- SpiraCSS projects should place [spiracss.config.js](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/spiracss-config.md) at the project root so that generation and validation follow the same policy.
- Download [spiracss-ai-agent-doc.md](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ai/spiracss-ai-agent-doc.md) and use it as a reference document for AI-agent workflows.

This CLI provides the same SCSS starting point for both humans and AI.

## Status

Beta release. Breaking changes may still occur.

## Requirements

- Node.js >= 20

## Install

```bash
npm install -D @spiracss/html-cli
```

## Commands

- `spiracss-html-to-scss` : generate SCSS files from HTML
- `spiracss-html-lint` : validate SpiraCSS HTML structure
- `spiracss-html-format` : insert placeholder classes

## Examples

Use `--root` for a single component root. Use `--selection` for fragments.

```bash
# Generate SCSS from a component root (root mode)
cat file.html | npx spiracss-html-to-scss --root --stdin --base-dir src/pages

# Generate SCSS from fragments (selection mode)
cat fragment.html | npx spiracss-html-to-scss --selection --stdin --base-dir src/pages

# Lint a component root
cat file.html | npx spiracss-html-lint --root --stdin

# Lint fragments
cat fragment.html | npx spiracss-html-lint --selection --stdin

# Insert placeholders
cat file.html | npx spiracss-html-format --stdin
```

## Configuration

SpiraCSS tools share a common configuration file at the project root: `spiracss.config.js` (htmlFormat, selectorPolicy, generator options, naming).
See the config guide for full options (EN/JA links below).

Minimal example:

```js
export default {
  htmlFormat: { classAttribute: 'class' },
  generator: {
    globalScssModule: '@styles/partials/global',
    childScssDir: 'scss',
    layoutMixins: ['@include breakpoint-up(md)']
  }
}
```

Note: If your project is CommonJS (no `"type": "module"` in `package.json`), use `module.exports = { ... }` instead of `export default`.

## Notes

- Template syntax (EJS/Nunjucks/Astro) is skipped for formatting to avoid breaking markup.
- JSX class/className is processed only when it is a string or template literal.
- The conversion spec is shared with the VS Code HTML to SCSS extension.

## Docs

- [SpiraCSS Design Principles](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/principles.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/principles.md)\]
- [HTML CLI guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/html-cli.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/html-cli.md)\]
- [HTML to SCSS guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/html-to-scss.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/html-to-scss.md)\]
- [Quickstart](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/quickstart.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/quickstart.md)\]
- [spiracss.config.js guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/spiracss-config.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/spiracss-config.md)\]

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- [SpiraCSS Comment Links (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)
- [SpiraCSS HTML to SCSS (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)
