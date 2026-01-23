# @spiracss/html-cli

A CLI tool designed primarily for AI agents and automation scripts—generates SCSS from HTML, validates structure, and formats placeholders. The [VS Code extension](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) uses this package internally; for manual use, prefer the extension.

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture based on one principle. The HTML structure determines how to write styles, eliminating the need for individual judgment. Designed for AI agents and tool-based validation.

This CLI is designed to be used with the [SpiraCSS Design Principles](https://spiracss.jp/architecture/principles/).

→ [See how it works](https://spiracss.jp)

## Status

Beta release. Breaking changes may still occur.

## Requirements

- Node.js >= 20

## Install

```bash
yarn add -D @spiracss/html-cli
```

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
cat file.html | yarn spiracss-html-to-scss --root --stdin --base-dir src/pages

# Generate SCSS from fragments (selection mode)
cat fragment.html | yarn spiracss-html-to-scss --selection --stdin --base-dir src/pages

# Lint a component root
cat file.html | yarn spiracss-html-lint --root --stdin

# Lint fragments
cat fragment.html | yarn spiracss-html-lint --selection --stdin

# Insert placeholders
cat file.html | yarn spiracss-html-format --stdin
```

Note: If you use npm, replace `yarn` with `npx` or `npm exec`.

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

- [HTML CLI](https://spiracss.jp/tooling/html-cli/)
- [HTML to SCSS (VS Code)](https://spiracss.jp/tooling/html-to-scss/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- SpiraCSS Comment Links ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-comment-links))
- SpiraCSS HTML to SCSS ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-html-to-scss))
