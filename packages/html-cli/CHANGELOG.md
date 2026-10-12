# Changelog

All notable changes to this package will be documented in this file.

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
