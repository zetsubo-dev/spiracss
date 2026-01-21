# SpiraCSS Comment Links

VS Code extension that turns SpiraCSS link comments into clickable file links.

## Demo

![Demo](https://github.com/zetsubo-dev/spiracss/raw/master/vscode/spiracss-comment-links/demo.gif)

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture built on minimal structural principles derived from HTML/CSS. It reduces inconsistencies in structural decisions that are common in CSS design by replacing individual intuition with clear principles. Designed for implementation with AI agents and tool-based validation, it aims to shorten development time and ensure consistent quality.

Overview: [Design Principles](https://spiracss.jp/architecture/principles/)

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

- [Design Principles](https://spiracss.jp/architecture/principles/)
- [Comment Links](https://spiracss.jp/tooling/comment-links/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- [SpiraCSS HTML to SCSS (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)
