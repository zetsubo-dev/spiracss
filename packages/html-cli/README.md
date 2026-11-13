# @spiracss/html-cli

A CLI tool designed primarily for AI agents and automation scripts—generates SCSS from HTML, validates structure, and formats placeholders. The [VS Code extension](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss) uses this package internally; for manual use, prefer the extension.

## About SpiraCSS

[SpiraCSS](https://spiracss.jp) is a CSS architecture designed to stay intact. HTML structure decides where styles belong, and Stylelint enforces it — no matter who writes, human or AI.

This CLI is designed to be used with the [SpiraCSS Design Principles](https://spiracss.jp/architecture/principles/).

→ [See how it works](https://spiracss.jp)

## Status

Beta release. Breaking changes may still occur.

## Requirements

- Node.js >= 24.22.2 and < 25 (Node.js 24 LTS; from 0.5.1)

The published 0.5.1 minimum above is unchanged. Current development requires
Node.js >= 24.22.3 and < 25; use the latest Node.js 24 security patch.

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

## Unreleased source-aware engine

The development source adds HTML/WebC/JSX/TSX/Astro/Vue selection by extension or `--format`; stdin still defaults to HTML. This is not a claim that published 0.5.1 contains the new engine. Formal-parser failures do not fall back to text extraction.

`loadMarkupParsers(formats)` asynchronously loads invocation-local handles; `lintMarkup(source, { format, mode, parsers, config })` then runs synchronously. Resolve the project config with `loadProjectOptions()` first and reject missing/error config rather than accepting fallback defaults unintentionally. Existing synchronous APIs retain their signatures.

Diagnostics contain `code`, `kind`, `reason`, `repair.conditions`, relevant `repair.effective`, and `docs`. Original UTF-16 `range` and `position` are present only when attributable to the source. File-level parser/runtime/config/unsupported reports without that evidence omit both fields instead of inventing `[0, 0]` or 1:1; consumers must accept their absence. Proven source offset zero, zero-width and EOF locations remain valid. An AI can apply a minimal repair from the conditions and rerun lint without rereading a full guide. Ambiguous intent is not permission to delete or rename classes. Only pass is successful; unresolved evidence is failed and parser/config unavailability is blocked.

The optional `@spiracss/html-cli/eslint` subpath exports a single `markup` rule and `createMarkupEslintConfig(config, htmlParser)`. ESLint is not needed by the ordinary CLI. Host ASTs are consumed without rule reparsing. WebC dynamic attributes need the helper's thin host-parser wrapper: it performs their first expression parse and supplies that AST to the rule. Source scope does not expand component props, slots or rendered DOM.

Standalone Astro uses the official synchronous `convertToTSX` API, Babel and the official source map. Successful metrics report one `astroConversions`, one `generatedParses` and zero failure-only `scriptParses`. If generated parsing fails, an original-frontmatter check may attempt both TypeScript and TSX grammars; public metrics count every actual additional parse. Only proven original syntax is `PARSE_ERROR`; a generated-only failure whose source cause is unknown remains blocked as `PARSER_RUNTIME_ERROR`, but its repair explicitly withholds frontmatter-edit or resource-restoration advice without evidence. Generated line/column numbers are not presented as original locations. Real resource/internal parser failures also use `PARSER_RUNTIME_ERROR`, and invalid settings are `CONFIG_INVALID`; neither is evidence that a class name or Astro syntax needs changing.

Some omitted Astro closing tags (`li`, `p`, `td`) are accepted by the official conversion but cannot be restored to a trustworthy original tree. A proved local omission gets `SOURCE_RELATION_UNRESOLVED` and explicit-close guidance. A relation that cannot be verified after successful generated parsing instead asks users to check the range's expressions, comments and opening/closing correspondence; it does not call that a parse/resource failure, a naming problem or a proved omission. A local report uses a verified opening range; an unlocalizable failure is blocked with cause-unknown guidance, without an invented position. A missing backend/source map remains a real runtime failure. Independently verified siblings stay checked; uncertain regions stay uninspected, without definite naming, ownership or root-count claims. Generation is unavailable for that document, including direct document generation. The ESLint host may reject the source before the rule. Actual syntax failures retain a justified original token/frontmatter range.

Astro closing boundaries require verified original-source correspondence, not arbitrary tree recovery. Metadata/script-only roots retain the existing "No source element found" contract. Verified native HTML close names are ASCII case-insensitive; the existing Astro ESLint parser still rejects `</DIV>` before the rule, even when standalone accepts it. Component names and unproved foreign namespaces are not case-folded.

Optional class expansion only removes known tokens after a guaranteed effective Block/Element base when their presence cannot affect lint, generation or ownership. It does not reorder modifiers or general ternaries, drop invalid-token guards, increase budgets, or resolve arbitrary JavaScript. `classExpressionProducts` counts attempted expression-alternative pairs, including outer joins and guard-incompatible pairs; `inertOptionalTokens` counts static optional tokens removed before multiplication. Attribute-alternative budgets are separate and unchanged.

Class composition follows each host's semantics before a guaranteed prefix can be used: Vue keeps attribute order, so a later static base cannot rescue an earlier dynamic list. Astro combines a direct ordinary class before its direct `class:list` at the list's position. On native Astro elements, spread-class and direct-list emissions are separate HTML class attributes and the first actually emitted attribute wins. Component props use last same-name values after compiler folding, then normalize `class` before `class:list`: a later `class` spread does not erase the original class already folded into the separate list key. These orders are not interchangeable.

Native Astro's inspected class/selector attributes and relevant input type follow actual emission, not just attribute spelling. Static `className="x"` remains literal `className` (HTML-canonical `classname`), while dynamic/shorthand/template/spread `className` uses the `class` alias. This Astro alias selection precedes ASCII-canonicalization of emitted native HTML names and does not describe component props, JSX or Vue key handling. Nullish attribute values do not emit and allow a later candidate; empty ordinary class/whitespace do emit, and ordinary `false` emits the string `false`. A `class:list` emits only when its `clsx` result is nonempty, so `[]`/`false` differ from a whitespace string. Reserved selector attributes use the same selected alternatives for lint and SCSS generation. Unsupported scalar arrays remain conservatively unresolved.

Hidden input type is resolved only when classless checking needs it. JSX known props are last-wins; native Astro uses first emission; Vue duplicates in one props group are first-wins, separately from argumentless `v-bind`/`mergeProps` groups. Proven `hidden` is ASCII case-insensitive; unknown type gets a local `SOURCE_RELATION_UNRESOLVED` asking for static type evidence or intended hidden/non-hidden meaning, not a class rename/addition. A valid class or disabled classless check adds no unrelated type diagnostic. Only proven unbound `undefined` is absent as a value and false as a predicate; shadowed or unproven bindings remain unknown.

For the existing inspected keys, presence, value and repair provenance are separate branch facts. Attribute prohibitions point to the actual producing attribute, while value violations point to its value. A nullable unknown alone does not prove forbidden presence. Certain presence without a unique winner remains prohibited in class mode, without an invented repair range. Unknown values stay locally unresolved when a lint conclusion depends on them, including value-named variant/state data attributes. In default data mode, configured dynamic ARIA values such as `open` or `String(open)` are lint-valid if there are no other violations; ARIA has no value-naming rule. Do not force a boolean-string rewrite: it could change nullable attribute absence. Wholly unknown props forwarding and relevant hidden-input type uncertainty retain their existing scope.

Generation keeps only reachable known winners, never every written literal. For example, Astro `<div class="card-list" {...{"aria-expanded":open}} aria-expanded="true" aria-expanded="never"/>` passes lint, generates only the known `true` selector, and reports `coverage.generationUnenumeratedSites: 1`. This counts generation-target element/configured-key sites with reachable values that cannot be fully enumerated, once per site rather than per branch or generated file; absent, nonapplicable and definitely defeated unknowns do not count. It is separate from errors, unresolved coverage, status and exit code. Generation CLI and VS Code Output show one informational line only when nonzero; ESLint emits no diagnostic for this generation-only information. Existing synchronous `GeneratedFile[]` APIs keep their shape and do not carry this count: callers need the existing preflight lint coverage, as the CLI and extension do.

Dynamic configured data values remain unresolved, so results can differ from 0.5.1. Establish a statically known valid value or supported finite alternatives only when that preserves intent; unknown runtime values are neither assumed valid nor renamed blindly.

Vue applies its scalar props-group order to configured selector keys as well as relevant input type: first key in one group, later group across argumentless `v-bind`/`mergeProps`. Lint and SCSS consume the same effective winner; losing legal values are not added to generated selectors. Class/style/event merge is not expanded. Supported simple class-list objects use the last value at the first insertion position for both tokens and emission; a guarded falsy `x && value` contributes nothing to `class:list`. Only the original exact key `class:list` is a directive; `CLASS:LIST` remains ordinary even when its emitted HTML name is canonicalized.

Shorthand Astro fragments require verified original delimiters and source relationships. Unproved regions localize to a verified enclosing opening where possible; otherwise they remain positionless and blocked. Independently verified siblings stay checked, and uncertain document generation is unavailable.

HTML recovery reports select loss, table foster parenting and non-void self-closing as unresolved. If recovery retains a known static class without a precise value span, its diagnostic may use the original attribute range rather than a token range; recovery evidence remains unresolved. Some malformed inputs with an unclosed attribute quote (`eof-in-tag`) still differ: standalone reports unresolved evidence while the current supplied HTML host may not report the same recovery evidence. This is not a general HTML-validity guarantee; close the original quote and rerun the same host.

If a supplied HTML/WebC AST absorbs real following elements into RAWTEXT/RCDATA beyond an actual source closing tag, the rule reports a local `SOURCE_RELATION_UNRESOLVED` and recommends the native CLI. It does not tell users to change valid text, class names or nesting, and does not reparse or reattach the lost elements. Text that legitimately continues opaquely to EOF is still accepted.

For ESLint caching with `RegExp` custom naming patterns, use `createMarkupEslintConfig(config, parser, files)` with the relevant host parser/file matches. It includes each pattern's source and flags in the serialized rule identity; it is not a digest of arbitrary configuration or external state.

With `astro-eslint-parser` 3.2.0, `@astrojs/compiler-rs` 0.5.3 and ESLint 10.14.0, a 70,000-element Astro input did not finish within 45 seconds even with the SpiraCSS rule disabled. This time is spent in the host rather than the rule; it does not establish a particular upstream bug. Standalone completion is not a host performance guarantee. There is no input-size cap or legacy fallback; validate larger host inputs in your environment before relying on them.

Lint now retains each occurrence and reports later unclassified tokens as `UNCLASSIFIED_CLASS_TOKEN`; generation alone merges repeated class structures. Previously missed errors may stop default generation. See the [HTML CLI reference](https://spiracss.jp/tooling/html-cli/) for formats, repair loops and compatibility boundaries.

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
