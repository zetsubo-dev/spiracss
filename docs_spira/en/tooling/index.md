# Tooling Overview

An overview of SpiraCSS tooling.

## Common prerequisites

- Place `spiracss.config.js` at the project root ([spiracss-config.md](spiracss-config.md)).
- Download [AI Agent documentation](../../ai/spiracss-ai-agent-doc.md) and use it as a reference document for AI-agent workflows.

If any of these are missing, AI outputs and tool behavior become unreliable and errors are more likely, so verify them before you start.

## Tool list

| Tool | Role | Document |
| ------ | ---- | ------------ |
| **spiracss.config.js** | Shared configuration file for all tools | [spiracss-config.md](spiracss-config.md) |
| **SpiraCSS Stylelint Plugin** | Automatically validates SCSS structure and naming | [stylelint.md](stylelint.md) |
| **SpiraCSS HTML CLI** | Generates SCSS from HTML and validates HTML structure (CLI commands) | [html-cli.md](html-cli.md) |
| **SpiraCSS Comment Links** | Opens target files via comment links | [comment-links.md](comment-links.md) |
| **SpiraCSS HTML to SCSS** | Generates SCSS templates from HTML (VS Code extension) | [html-to-scss.md](html-to-scss.md) |

**Note**: `spiracss-html-to-scss` is also a CLI command name, so be careful to distinguish it from the VS Code extension by context.

## Workflow

```
spiracss.config.js (shared config)
         │
         ├── SpiraCSS HTML CLI / SpiraCSS HTML to SCSS -> Generate SCSS templates
         │
         └── SpiraCSS Stylelint Plugin -> Automatically detect rule violations
```

1. Configure naming and validation rules in `spiracss.config.js`
2. Generate SCSS templates with SpiraCSS HTML CLI or SpiraCSS HTML to SCSS
3. Detect rule violations automatically with Stylelint

## Shared configuration

SpiraCSS tools use `spiracss.config.js` as a shared configuration file.

See [spiracss-config.md](spiracss-config.md) for details.

## Related tools
### Tools
- [SpiraCSS Stylelint Plugin](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### Configuration
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS docs
- [Design Principles](../principles.md)
- [Quickstart](../quickstart.md)
- [CSS Layers](../layers.md)
- [Components](../component.md)
- [Guidelines](../guidelines.md)
- [Design Philosophy](../philosophy.md)
