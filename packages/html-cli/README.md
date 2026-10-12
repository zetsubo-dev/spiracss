# @spiracss/html-cli

A CLI tool designed primarily for AI agents and automation scripts—generates SCSS from HTML, validates structure, and formats placeholders. The [VS Code extension](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) uses this package internally; for manual use, prefer the extension.

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture designed to stay intact. HTML structure decides where styles belong, and Stylelint enforces it — no matter who writes, human or AI.

This CLI is designed to be used with the [SpiraCSS Design Principles](https://spiracss.jp/architecture/principles/).

→ [See how it works](https://spiracss.jp)

## Status

Beta release. Breaking changes may still occur.

## Requirements

- Node.js >= 20

## Install

```bash
pnpm add -D @spiracss/html-cli
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
cat file.html | pnpm exec spiracss-html-to-scss --root --stdin --base-dir src/pages

# Generate SCSS from fragments (selection mode)
cat fragment.html | pnpm exec spiracss-html-to-scss --selection --stdin --base-dir src/pages

# Lint a component root
cat file.html | pnpm exec spiracss-html-lint --root --stdin

# Lint fragments
cat fragment.html | pnpm exec spiracss-html-lint --selection --stdin

# Insert placeholders
cat file.html | pnpm exec spiracss-html-format --stdin
```

Note: If you use npm, replace `pnpm exec` with `npx` or `npm exec`.

HTML lint and HTML-to-SCSS require `spiracss.config.js` by default. If the project config is intentionally unavailable, pass `--allow-provisional` explicitly; the result uses fallback defaults and must not be treated as final project validation. Without that flag, the commands fail with `CONFIG_MISSING` (including JSON mode).

## Configuration

SpiraCSS tools share a common configuration file at the project root: `spiracss.config.js` (htmlFormat, htmlLint, selectorPolicy, generator options, naming).
See the config guide for full options (EN/JA links below).

Minimal example:

```js
export default {
  htmlFormat: { classAttribute: 'class' },
  htmlLint: {
    classlessTagCheck: true,
    // Built-in baseline; append project-specific structural tags when needed.
    classlessTagAllowlist: ['picture', 'source', 'img', 'track', 'map', 'area', 'br', 'wbr']
  },
  jsxClassBindings: { memberAccessAllowlist: ['styles', 'classes'] },
  generator: {
    globalScssModule: '@styles/partials/global',
    childScssDir: 'scss'
  }
}
```

HTML structure lint requires a class on HTML elements by default. Built-in classless structural tags are `picture`, `source`, `img`, `track`, `map`, `area`, `br`, and `wbr`. SVG/MathML root elements still require a class; SVG/MathML-native drawing internals do not need SpiraCSS classes, while HTML integration points such as `foreignObject` and HTML `annotation-xml` are checked in HTML context. `htmlLint.classlessTagAllowlist` adds project-specific tags to the built-in list.

Set `htmlLint.classlessTagCheck` to `false` to disable only the classless-tag check while keeping the other HTML structure checks enabled.

When a class value is dynamic and cannot be verified statically, lint reports `DYNAMIC_CLASS_UNRESOLVED` instead of treating the tag as classless. Resolve the template binding before applying a classless-tag fix. JSON lint results include `target.siblingIndex` and `targetPath` when repeated tags or ancestors share the same structural path.

JSON CLI results expose `status` as `pass`, `provisional`, `ignored`, `failed`, or `blocked`; only `pass` returns `ok: true` and exit code 0. `--allow-provisional` and `--ignore-structure-errors` may continue processing, but remain non-pass so AI and CI callers cannot mistake fallback or ignored validation for success.

Note: If your project is CommonJS (no `"type": "module"` in `package.json`), use `module.exports = { ... }` instead of `export default`.

## Notes

- Template syntax (EJS/Nunjucks/Astro) is skipped for formatting to avoid breaking markup.
- `generator.layoutMixins` defaults to an empty array (disabled). Set it only if your project defines the referenced mixins.
- JSX class/className supports best-effort extraction when static class names are present (strings, template literals with static parts plus string literals or member access inside `${}`; string literals inside dynamic expressions may still be extracted, and member access like `styles.foo` or `styles["foo"]`). If `jsxClassBindings.memberAccessAllowlist` is set, only the listed base identifiers are treated as class sources (empty array disables member access extraction entirely). Chained member access (e.g. `styles.layout.hero`) is treated as dynamic and skipped.
- Placeholder formatting skips JSX bindings that include dynamic expressions (e.g. conditions, props, function calls, non-static `${}` segments). When formatting JSX/TSX, bindings are normalized to plain class strings for placeholders; treat the output as scaffolding (not CSS Modules-safe).
- The conversion spec is shared with the VS Code HTML to SCSS extension.

## SCSS root style

### Migration from v0.4.x

Version 0.5.0 changes the component root default to `scope-explicit`. To keep an existing project's SCSS and cascade unchanged, set `generator.scssRootStyle: 'class'` before upgrading. This also preserves class-form component roots in Stylelint's `createRules()` configuration. Existing files are not rewritten, and HTML lint rules are unchanged. Migrate component roots deliberately; do not convert every child Block file.

Set `generator.scssRootStyle` in `spiracss.config.js` to `scope-explicit` (default), `scope`, or `class`. `scope-explicit` wraps the component body in `@scope (.block-name)` and `:scope`; `scope` writes the body directly inside `@scope`, while `class` selects the previous class-selector output. The setting is shared with the VS Code extension and applies only to the component root SCSS generated in root mode, which loads the child Block styles with `meta.load-css()` only when independent child Blocks are present. Those loaded Block files and their selectors remain in class form; they do not get individual scopes. Selection mode generates class-form Blocks to be loaded by the component root. HTML classes and HTML lint rules are unchanged.

The default is the recommended form for SCSS compiled with Sass; it can also be selected explicitly:

```js
generator: {
  scssRootStyle: 'scope-explicit'
}
```

This changes the default for newly generated component roots, not existing stylesheets. Select `class` to retain the previous generation syntax. The direct `scope` form remains available and valid for CSS linting, but Sass currently warns about leading child combinators directly inside `@scope`. Direct declarations such as `padding: 20px` are a separate, supported CSS feature; the warning is not a reason to require a `:scope` wrapper in lint. These forms have different CSS specificity and are not interchangeable cascade rewrites. Do not silently convert an existing direct scope to the explicit form.

SpiraCSS requires class-form child and descendant Block files under the configured `childDir`. Stylelint rejects every `@scope` in these files, including thematic wrappers, for all root style settings and direct rule configurations. The generator already emits these files in class form.

This is a SpiraCSS safety policy, not a native CSS limitation: Sass can prepend the loading parent's selector to a child scope, producing the non-matching `:scope :scope`. Keep `meta.load-css()` inside the root's `:scope` body in `scope-explicit` mode; its placement and generated child specificity are unchanged. Do not automatically move the include or rewrite existing child scopes. See the [child scope policy](https://spiracss.jp/configuration/options/#scope-root-syntax).

A root-mode component remains a component root even without independent child Blocks. It still follows the configured root syntax; only the unnecessary `meta.load-css()` call is omitted. Adding or removing children does not switch its root syntax.

When Stylelint is configured through `createRules()` / `createRulesAsync()`, the root style setting also controls `spiracss/class-structure`: `scope` or `scope-explicit` requires `@scope` for the component root, accepting either direct contents or a `:scope` wrapper. Class-form component roots receive an error with the setting, cause, and repair example. Child scopes receive a separate error with the configured directory, Sass risk, and class-form repair. `@container`, `@layer`, `@media`, and `@supports` wrappers do not bypass these checks or become errors themselves.

## Docs

- [HTML CLI](https://spiracss.jp/tooling/html-cli/)
- [HTML to SCSS (VS Code)](https://spiracss.jp/tooling/html-to-scss/)
- [Configuration](https://spiracss.jp/configuration/)

## Related Tools

- [SpiraCSS Stylelint Plugin (npm)](https://www.npmjs.com/package/@spiracss/stylelint-plugin)
- SpiraCSS Comment Links ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-comment-links))
- SpiraCSS HTML to SCSS ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) / [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-html-to-scss))
