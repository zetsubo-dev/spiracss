# SpiraCSS

SpiraCSS is a CSS architecture built on minimal structural principles derived from HTML/CSS. It reduces inconsistencies in structural decisions that are common in CSS design by replacing individual intuition with clear principles. Designed for implementation with AI agents and tool-based validation, it aims to shorten development time and ensure consistent quality.

Key points:
- Structural decisions can be derived from class names and HTML structure.
- Property placement (container/item/internal) has structural meaning, and Stylelint guides the fine-grained rules so memorization is unnecessary.
- `shared`/`interaction`/`rel` comment conventions can be treated as tool-verifiable contracts.
- SpiraCSS projects should place [`spiracss.config.js`](tooling/spiracss-config.md) at the project root so that generation and validation follow the same selectorPolicy.
- Download [`spiracss-ai-agent-doc.md`](../ai/spiracss-ai-agent-doc.md) and use it as a reference document for AI-agent workflows.

Tool roles:
- Generation: HTML CLI + VS Code HTML to SCSS
- HTML validation: HTML CLI
- SCSS rule validation: Stylelint
- Navigation: Comment Links

Status: Beta

## Documentation

- [Design Principles](principles.md)
- [Quickstart](quickstart.md)
- [CSS Layers](layers.md)
- [Components](component.md)
- [Guidelines](guidelines.md)
- [Design Philosophy](philosophy.md)

## Tools

- [Tooling overview](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint Plugin](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)

## Links

Official site: https://spiracss.jp
