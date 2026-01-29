# SpiraCSS Comment Links

VS Code extension that turns SpiraCSS link comments into clickable file links.

## Demo

![Demo](https://github.com/zetsubo-dev/spiracss/raw/master/vscode/spiracss-comment-links/demo.gif)

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture based on one principle. The HTML structure determines how to write styles, eliminating the need for individual judgment. Validated by tools, with errors designed for both humans and AI agents.

This extension is designed to be used with the [SpiraCSS Design Principles](https://spiracss.jp/architecture/principles/).

→ [See how it works](https://spiracss.jp)

## Requirements

- VS Code >= 1.99.0

## Features

- Open `// @rel/...` links in SCSS
- Resolve alias links like `// @components/...` and `// @assets/...`
- Reads alias roots from `spiracss.config.js`

## Quick Start

1. Create `spiracss.config.js` in your project root.
2. Add link comments in SCSS, e.g. `// @rel/scss/child.scss`.
3. Cmd/Ctrl+Click the link to open the target file.

## Docs

- [Comment Links](https://spiracss.jp/tooling/comment-links/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- SpiraCSS HTML to SCSS ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-html-to-scss))
