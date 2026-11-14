# Changelog

All notable changes to this package will be documented in this file.

## 0.6.0

### Added

- Add source-aware HTML, WebC, JSX, TSX, Astro and Vue validation through asynchronous `loadMarkupParsers()` handles and synchronous `lintMarkup()`, with bundled JavaScript parsers and the official Astro compiler WASM asset. Select the format by extension or explicit `--format`.
- Add the optional `@spiracss/html-cli/eslint` integration with the shared validator and repair conditions. The rule consumes supplied ASTs without reparsing; the WebC HTML-parser wrapper parses relevant attribute expressions first and supplies them through parser services.
- Add diagnostic kinds, reasons, branch conditions and effective-config repair conditions for AI correction loops. Diagnostics include original UTF-16 ranges only when source evidence supports them, without invented positions for file-level failures.
- Add source coverage and parser-operation metadata to JSON, including separate out-of-scope and unresolved evidence. ESLint config cache identity includes custom naming RegExp source and flags.

### Changed

- Lint each source occurrence and report later unclassified tokens as `UNCLASSIFIED_CLASS_TOKEN`, so newly detected violations can stop default generation. Generation alone aggregates repeated classes; existing synchronous API signatures and allowed-input generation and format output remain compatible.
- Evaluate supported finite class expressions with binding scopes, branch conditions and host-specific attribute composition. Lint and generated selectors use the same effective winners; only optional tokens proved irrelevant to validation, ownership and generation are removed before alternative expansion.
- Report in-scope unknowns as failed and syntax, parser, configuration or safety-limit failures as blocked. Unsupported and unresolved input is not a pass; only `status: "pass"` has `ok: true` and exit 0.
- Use official synchronous Astro `convertToTSX`, Babel and the official source map for standalone validation. Keep independently verified siblings checked around unresolved source relations, without asserting uncertain ancestry or permitting document generation.
- Allow configured dynamic ARIA in data mode without a value-naming rule or forced boolean rewrite. Generate reachable known selectors and report incomplete enumeration separately as `coverage.generationUnenumeratedSites`, with a nonzero-only generation CLI note; existing synchronous generated-file arrays carry no coverage.
- Treat dynamic configured data values as unresolved, so results can differ from published 0.5.1. Static valid and invalid values retain naming checks.
- Keep HTML naming, ownership, leaf Blocks, unlimited design-level Block depth and SCSS scope policy unchanged. Validation covers source, not component props forwarding, slots, rendered DOM or complete language grammar.
- Document the known Astro ESLint host limitation of 70,000 elements exceeding 45 seconds with the SpiraCSS rule disabled. Standalone completion does not establish large-input host support; see the README for host versions and boundaries.
- Require Node.js >=24.22.3 <25 and update bundled dependency notices. The historical 0.5.1 minimum below is unchanged.
- Remove unused internal paths without changing public API signatures or configuration.

### Fixed

- Pass relevant WebC dynamic input types and finite attribute objects to the shared validator. Keep the first expression parse in the parser or host wrapper, and avoid unrelated type diagnostics and type-expression parsing.
- Preserve existing comments, `@forward` statements, variables, and indentation when merging `index.scss`. Avoid adding duplicate bare `@use` statements for the same URL despite quote or tab differences, and leave content and modification time unchanged when no entries are missing. Multiline statements, comments, `as` or `with` clauses, trailing comments, and relative-URL resolution retain their existing limits.

## 0.5.1

### Changed

- Require Node.js >= 24.22.2 and < 25 and pin development to 24.22.2, including the October 2026 security fixes. CLI behavior is unchanged.
- Raise the Cheerio minimum to 1.2.0, refresh compatible dependency resolutions, and update Oxfmt to remove vulnerable Tinypool versions.
- Fix the remaining development-tool advisories through tested, parent-scoped security overrides documented in the workspace `SECURITY.md`.

## 0.5.0

### Added

- Add `generator.scssRootStyle`: `scope-explicit` (a `:scope` wrapper), `scope` (direct scope contents), or `class` (the previous syntax). Apply it only to root-mode component roots, with `meta.load-css()` when independent children exist; loaded child Block files and selection-mode output retain class selectors.
- Resolve and validate this option through the shared CLI/VS Code configuration API.

### Changed

- Default newly generated component root SCSS to `scope-explicit`, the recommended scoped form for Sass. Existing files are not converted automatically; `class` and direct `scope` remain selectable and supported by lint.
- Existing projects can set `generator.scssRootStyle: 'class'` to retain previous output without an automatic cascade migration.
- Document Stylelint's class-only child scope policy and retain the root include placement and generated child specificity.

## 0.4.5

### Fixed

- Prevent HTML lint and HTML-to-SCSS from timing out on quoted attributes and arbitrary custom WebC components.
- Preserve nested JSX spread expressions without corrupting opening tags, and keep source diagnostics efficient for large inputs.

## 0.4.4

### Added

- Add configurable classless HTML tag allowlists and structured diagnostics for AI-assisted lint fixes.

### Changed

- Share configuration and diagnostic handling across HTML lint, generation, formatting, and the VS Code integration.

## 0.4.3-beta

### Changed

- Align package version with the monorepo release.

## 0.4.2-beta

### Changed

- Align package version with the monorepo release.

## 0.4.1-beta

### Changed

- Align package version with the monorepo release.

## 0.4.0-beta

### Changed

- Align package version with the monorepo release.

## 0.3.4-beta

### Changed

- Align package version with the monorepo release.

## 0.3.3-beta

### Changed

- Align package version with the monorepo release.

## 0.3.2-beta

### Added

- Improve JSX class/className extraction (string/template literals, member access).
- `jsxClassBindings.memberAccessAllowlist` option to restrict member access extraction (empty array disables it).

### Changed

- Default `generator.layoutMixins` to an empty array (disabled) to avoid generating SCSS that won't compile unless mixins are defined.

## 0.3.1-beta

### Added

- Support `childFileCase` when generating child SCSS filenames and `@rel` comments.

## 0.3.0

### Breaking Changes

- Config schema aligned with the new stylelint config: naming/external settings now read from `stylelint.base` / `stylelint.class` (old `stylelint.classStructure` keys removed).
- External allowlist renamed to `external.classes` / `external.prefixes`.

### Changed

- HTML lint and SCSS generation now use the new `external` option shape.
- Config warnings now report the naming source.

### Documentation

- Wording update: "AI" → "AI agents" for consistency
- Documentation moved to official site (spiracss.jp)

## 0.2.2-beta

### Documentation

- Add SpiraCSS Design Principles link to README
- Add Japanese documentation links to Docs section
- Improve description wording for clarity

## 0.2.1-beta

- First beta release.

---

## 0.1.x (Alpha)

Experimental releases during initial development.
