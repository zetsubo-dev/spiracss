# Changelog

All notable changes to this package will be documented in this file.

## 0.3.0

### Breaking Changes

- **Stylelint config restructured**: `stylelint.classStructure` replaced by `stylelint.base` / `stylelint.class`, plus new per-rule sections (`stylelint.placement`, `stylelint.pageLayer`, `stylelint.interactionProps`, `stylelint.keyframes`, `stylelint.pseudo`, `stylelint.rel`).
- **Section renames**: `interactionProperties` → `interactionProps`, `keyframesNaming` → `keyframes`, `pseudoNesting` → `pseudo`, `relComments` → `rel`.
- **Comment/cache keys renamed**: `stylelint.sectionCommentPatterns` → `stylelint.base.comments`, `stylelint.cacheSizes` → `stylelint.base.cache`, `sharedCommentPattern` / `interactionCommentPattern` → `comments.shared` / `comments.interaction`.
- **External allowlist moved**: `allowExternalClasses` / `allowExternalPrefixes` → `external.classes` / `external.prefixes`.
- **New rules enabled by default**: `spiracss/property-placement`, `spiracss/page-layer`.

### Added

- **New rule: `spiracss/page-layer`** — Validates page-layer SCSS (component link comments required for child Blocks)
- **New rule: `spiracss/property-placement`** — Validates property placement (container/item/internal) based on selector role
- `stylelint.pseudo.enabled` option

### Changed

- Improved selector parsing and validation logic
- Error messages updated for clarity
- Better support for `selectorPolicy` (data/class mode)

### Documentation

- Documentation moved to official site (spiracss.jp)
- Wording update: "AI" → "AI agents" for consistency

## 0.2.2-beta

### Added

- `keyframes.enabled` option to disable the `spiracss/keyframes-naming` rule entirely

### Documentation

- Add SpiraCSS Design Principles link to README
- Add Japanese documentation links to Docs section

## 0.2.1-beta

- First beta release.

---

## 0.1.x (Alpha)

Experimental releases during initial development.
