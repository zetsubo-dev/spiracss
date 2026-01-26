# Change Log

All notable changes to this extension will be documented in this file.

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
