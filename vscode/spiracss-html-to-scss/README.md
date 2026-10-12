# SpiraCSS HTML to SCSS

VS Code extension that generates SpiraCSS SCSS files from HTML structure and can insert placeholder classes.

## Demo

![Demo](https://github.com/zetsubo-dev/spiracss/raw/master/vscode/spiracss-html-to-scss/demo.gif)

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture designed to stay intact. HTML structure decides where styles belong, and Stylelint enforces it — no matter who writes, human or AI.

This extension is designed to be used with the [SpiraCSS Design Principles](https://spiracss.jp/architecture/principles/).

→ [See how it works](https://spiracss.jp)

## Requirements

- VS Code >= 1.99.0

## Features

- Generate SCSS from a selected HTML fragment or root block
- Insert placeholder classes (block-box / element)
- Reads naming and generator options from `spiracss.config.js`
- Generation logic is powered by `@spiracss/html-cli`

## Commands

| Command                                            | Keybinding   |
| -------------------------------------------------- | ------------ |
| Generate SpiraCSS SCSS from Root                   | `Cmd+Ctrl+A` |
| Generate SpiraCSS SCSS from Selection              | `Cmd+Ctrl+S` |
| Insert SpiraCSS placeholders (block-box / element) | `Cmd+Ctrl+D` |

## Quick Start

1. Create `spiracss.config.js` in your project root.
2. Select an HTML fragment.
3. Run a SpiraCSS command from the Command Palette or use the keybinding.

## SCSS root syntax

When upgrading an existing v0.4.x project, set `generator.scssRootStyle: 'class'` to retain previous root generation and root syntax lint behavior without rewriting existing stylesheets. This does not disable the child scope prohibition: existing child scopes require manual migration. The new default is `scope-explicit`; choosing it is a deliberate component-root migration, not a conversion of every child file.

Version 0.5.0 reads `generator.scssRootStyle` from the same `spiracss.config.js` as the HTML CLI:

```js
generator: {
  scssRootStyle: 'scope-explicit' // Default: @scope with a :scope body
}
```

Root mode applies this setting only to the component root SCSS. Independent child Block files loaded through `meta.load-css()` retain class selectors. A component without independent children still follows the root setting; it simply omits the unnecessary `meta.load-css()` call. Selection mode retains class-form output for Blocks to be loaded by a component root.

Choose `scope` for direct scope contents or `class` for the previous root syntax. Existing files are not migrated automatically. Child and descendant Block files under configured `childDir` must stay in class form: Stylelint rejects every child-file `@scope`, including thematic wrappers, for all root style settings. When configured through `createRules()`, scope settings require scope on component roots but do not require a `:scope` wrapper in lint. HTML classes and HTML structure rules are unchanged. Versions before v0.5.0 do not support this option.

The child restriction prevents Sass from prepending the parent's `:scope` to a child scope and producing the non-matching `:scope :scope`. Keep the root's include placement unchanged; moving it would lower child specificity. Existing child scopes require a manual migration, not an automatic fix. See the [child scope policy](https://spiracss.jp/configuration/options/#scope-root-syntax).

## Docs

- [HTML to SCSS](https://spiracss.jp/tooling/html-to-scss/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- SpiraCSS Comment Links ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-comment-links))

## Development Notes

- In this monorepo, `@spiracss/html-cli` is linked as a workspace dependency.
- Install dependencies from the repository root with `pnpm install`.
- Build `packages/html-cli` before compiling or packaging this extension; generation logic remains in the CLI package, not duplicated here.
