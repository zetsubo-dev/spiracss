# Change Log

All notable changes to this extension will be documented in this file.

## 0.5.0

### Added

- Use the shared HTML CLI's `generator.scssRootStyle` selection for conventional, direct-scope, and explicit-scope SCSS generation.
- Document the shared root setting and verify root, child Block, and selection output through the extension commands.

### Changed

- Default newly generated component root SCSS to `scope-explicit` through the shared HTML CLI. The Block files loaded by `meta.load-css()` and selection-mode output retain class selectors; existing files are not converted automatically.
- Update the bundled `@spiracss/html-cli` dependency to `0.5.0` and align the extension version with the monorepo release.
- Document Stylelint's child scope prohibition and manual migration; generated child classes and include placement are unchanged.

## 0.4.5

### Fixed

- Update the shared `@spiracss/html-cli` dependency to `0.4.5`, including the timeout and custom-component handling fixes.

### Changed

- Align the extension version with the monorepo release.

## 0.4.4

### Changed

- Use the shared `@spiracss/html-cli` configuration, lint, and diagnostic logic.
- Align the extension version with the monorepo release.

## 0.4.3-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.4.3`.
- Align extension version with the monorepo release.

## 0.4.2-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.4.2`.
- Align extension version with the monorepo release.

## 0.4.1-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.4.1`.
- Align extension version with the monorepo release.

## 0.4.0-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.4.0`.
- Align extension version with the monorepo release.

## 0.3.4-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.3.4`.
- Align extension version with the monorepo release.

## 0.3.3-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.3.3`.
- Align extension version with the monorepo release.

## 0.3.2-beta

### Changed

- Update `@spiracss/html-cli` dependency to `^0.3.2`.
- Default `generator.layoutMixins` to an empty array (disabled) when not configured.

## 0.3.1-beta

### Changed

- Support `childFileCase` when generating child SCSS files and `@rel` comments.
- Update `@spiracss/html-cli` dependency to `^0.3.1`.

## 0.3.0

### Breaking Changes

- Config schema aligned with the new stylelint config: naming/external settings now read from `stylelint.base` / `stylelint.class` (old `stylelint.classStructure` keys removed).
- External allowlist renamed to `external.classes` / `external.prefixes`.

### Changed

- Config loading aligned with HTML CLI.
- Update `@spiracss/html-cli` dependency to `^0.3.0`.

### Documentation

- Documentation moved to official site (spiracss.jp)
- Wording update: "AI" → "AI agents" for consistency

## 0.2.2-beta

### Documentation

- Add SpiraCSS Design Principles link to README
- Add Japanese documentation links to Docs section

## 0.2.1-beta

- First beta release.

---

## 0.1.x (Alpha)

Experimental releases during initial development.
