# SpiraCSS Comment Links

A VS Code extension that lets you Cmd/Ctrl-click on comment links such as `// @rel/...` or
`// @components/...` in SCSS files to jump to the target files. Link comments are a convenient
shortcut to related files; without them, you have to trace targets manually.

Designed to be used with the SpiraCSS design principles (see [Design Principles](../principles.md)).

```scss
// @rel/child.scss
// @components/button.scss
```

## Install

Install from the VS Code Marketplace by searching for `SpiraCSS Comment Links`.

→ [Install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)

## Usage

### Relative links `@rel`

Resolved relative to the current file's directory.
Leading `/` is ignored.

```scss
// @rel/sibling.scss     -> sibling.scss in the same directory
// @rel/../parent.scss   -> parent.scss in the parent directory
// @rel//sibling.scss    -> leading slash is ignored
```

### Alias links

Use shortcuts like `@components/...` to reference paths resolved from alias roots. The resolver joins the alias base with the comment path and strips any leading `/`. Only keys defined in `aliasRoots` or the built-in defaults are recognized. Targets outside the project root are ignored.

| Alias | Resolves to (fallback when `aliasRoots` is undefined) |
| --- | --- |
| `@src` | `src/` |
| `@components` | `src/components/` |
| `@styles` | `src/styles/` |
| `@assets` | `src/assets/` |
| `@pages` | `src/components/pages/` |
| `@parts` | `src/components/parts/` |
| `@common` | `src/components/common/` |

```scss
// @components/button.scss -> src/components/button.scss
// @styles/variables.scss  -> src/styles/variables.scss
```

## Configuration

This extension uses `aliasRoots` in `spiracss.config.js` at the project root to
resolve aliases. Keys defined in `aliasRoots` are recognized; if a key is missing,
only built-in defaults are used and unknown keys are not linked.

Minimal example:

```js
// spiracss.config.js
module.exports = {
  aliasRoots: {
    components: ['src/components'],
    // Add custom aliases as needed
    // layouts: ['src/layouts'],
  },
}
```

Define keys without the `@` prefix (e.g., `components` becomes `@components/...` in comments).

If `package.json` has `"type": "module"`, use `export default` instead of
`module.exports`.

See [spiracss-config.md](spiracss-config.md) for full configuration options.

## Limitations

- Only SCSS line comments (`// ...`) are supported (block comments `/* ... */` are not)
- The `@` must appear at the start of the comment text (e.g., `// TODO @components/...` is ignored)
- Alias links only match the `@alias/...` form (`@alias` or `@aliasFoo` are ignored)
- Alias bases outside the workspace emit a warning and are ignored
- The workspace folder must be opened

## Example

```scss
@use "sass:meta";

// hero-section.scss

// @assets/css/home.scss

.hero-section {
  @include meta.load-css("scss");

  > .feature-card {
    // @rel/scss/feature-card.scss
  }
}
```

## Related tools
### Tools
- [SpiraCSS Stylelint Plugin](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- SpiraCSS Comment Links
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
