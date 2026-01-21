# SpiraCSS HTML to SCSS

VS Code extension that generates SpiraCSS SCSS files from HTML structure and can insert placeholder classes.

## Demo

![Demo](https://github.com/zetsubo-dev/spiracss/raw/master/vscode/spiracss-html-to-scss/demo.gif)

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture built on minimal structural principles derived from HTML/CSS. It reduces inconsistencies in structural decisions that are common in CSS design by replacing individual intuition with clear principles. Designed for implementation with AI agents and tool-based validation, it aims to shorten development time and ensure consistent quality.

Overview: [Design Principles](https://spiracss.jp/architecture/principles/)

## Requirements

- VS Code >= 1.99.0

## Features

- Generate SCSS from a selected HTML fragment or root block
- Insert placeholder classes (block-box / element)
- Reads naming and generator options from `spiracss.config.js`
- Generation logic is powered by `@spiracss/html-cli`

## Commands

| Command | Keybinding |
|---------|------------|
| Generate SpiraCSS SCSS from Root | `Cmd+Ctrl+A` |
| Generate SpiraCSS SCSS from Selection | `Cmd+Ctrl+S` |
| Insert SpiraCSS placeholders (block-box / element) | `Cmd+Ctrl+D` |

## Quick Start

1. Create `spiracss.config.js` in your project root.
2. Select an HTML fragment.
3. Run a SpiraCSS command from the Command Palette or use the keybinding.

## Docs

- [Design Principles](https://spiracss.jp/architecture/principles/)
- [HTML to SCSS](https://spiracss.jp/tooling/html-to-scss/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- [SpiraCSS HTML CLI (npm)](https://www.npmjs.com/package/@spiracss/html-cli)
- [SpiraCSS Comment Links (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)
