# SpiraCSS Comment Links

VS Code extension that turns SpiraCSS link comments into clickable file links.

## Demo

![Demo](https://github.com/zetsubo-dev/spiracss/raw/master/vscode/spiracss-comment-links/demo.gif)

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture built on minimal structural principles derived from HTML/CSS. It reduces inconsistencies in structural decisions that are common in CSS design by replacing individual intuition with clear principles. Designed for AI-assisted implementation and tool-based validation, it aims to shorten development time and ensure consistent quality.

Overview: [SpiraCSS Design Principles](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/principles.md)

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

- [SpiraCSS Design Principles](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/principles.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/principles.md)\]
- [Comment Links guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/comment-links.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/comment-links.md)\]
- [`spiracss.config.js` guide](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/en/tooling/spiracss-config.md) | \[[JA](https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/spiracss-config.md)\]

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- [SpiraCSS HTML to SCSS (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)
