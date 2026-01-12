# Quickstart

How to set up SpiraCSS tooling.

## Required files

For SpiraCSS workflows, prepare these two items:

- [spiracss.config.js](tooling/spiracss-config.md) (project root)
- [AI documentation](../ai/spiracss-ai-doc.md) (download and use as a reference document when integrating with AI)

If any of them are missing, decisions become uncertain and error-prone, so verify their presence before starting work (do not assume defaults).

## SpiraCSS Stylelint Plugin

Automatically validates SCSS structure and naming.

### Install

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

### Configure

The [SpiraCSS Stylelint plugin guide](tooling/stylelint.md) is the source of truth for Stylelint configuration.  
When using `createRules()`, `aliasRoots` is required. The `stylelint` sub-sections fall back to defaults when omitted.

### Run

```bash
npx stylelint "src/**/*.scss"
```

---

## SpiraCSS HTML CLI

Generates SCSS from HTML and validates HTML structure.

```bash
npm install -D @spiracss/html-cli
```

```bash
# Generate SCSS
echo "$HTML" | npx spiracss-html-to-scss --stdin

# Validate HTML
echo "$HTML" | npx spiracss-html-lint --stdin

# Add HTML placeholders
echo "$HTML" | npx spiracss-html-format --stdin
```

Note: For fragment HTML, use `--selection` with `spiracss-html-to-scss` / `spiracss-html-lint`. `spiracss-html-format` does not support `--selection` / `--root`.

---

## VS Code Extensions

### Comment Links

Link comments (such as `@rel`) let you jump to related files with a single click. Without them, you have to trace targets manually, which adds friction.

→ [Install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)

### HTML to SCSS

Generates SCSS templates from HTML.

→ [Install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)

---

## Shared configuration

All tools read `spiracss.config.js`. Create it at the project root.
When using Stylelint's `createRules()`, `aliasRoots` is required. The `stylelint` sub-sections are optional; defaults apply when omitted.

Depending on your module system, write `spiracss.config.js` as ESM (`export default`) or CommonJS (`module.exports`). See [spiracss.config.js](tooling/spiracss-config.md) for details.

### Minimal configuration (with Stylelint)

Stylelint sub-sections are optional (defaults apply).
The examples below use ESM syntax. For CommonJS, see [spiracss.config.js](tooling/spiracss-config.md).

```js
export default {
  aliasRoots: {
    src: ['src'],
    components: ['src/components'],
    common: ['src/components/common'],
    pages: ['src/components/pages'],
    parts: ['src/components/parts'],
    styles: ['src/styles'],
    assets: ['src/assets']
  }
}
```

### Use PascalCase filenames

```js
export default {
  aliasRoots: { /* ... */ },
  generator: {
    // Generated SCSS root filename: 'preserve' (default) / 'pascal'
    rootFileCase: 'pascal'
  }
}
```

### Use the className attribute

```js
export default {
  aliasRoots: { /* ... */ },
  htmlFormat: {
    // HTML class attribute: 'class' (default) or 'className'
    classAttribute: 'className'
  },
  generator: {
    // Generated SCSS root filename: 'preserve' (default) / 'pascal'
    rootFileCase: 'pascal'
  }
}
```

Customize other options to match your project or team guidelines.  
See [spiracss.config.js](tooling/spiracss-config.md) for details.

---

## Next steps

- [Components](component.md): SCSS authoring rules
- [Tooling overview](tooling/index.md): tool roles and workflow

## SpiraCSS docs
- [Design Principles](principles.md)
- Quickstart
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
