# Changelog

All notable changes to this package will be documented in this file.

## 0.3.2-beta

### Changed

- Treat CSS Modules `:global` / `:local` as transparent across rules (the inner selector is linted).
- Improve selector handling for `:global` wrappers (including rightmost `:global(...)` targets and selector lists).
- `spiracss/class-structure` root filename checks accept `*.module.scss` and support `childFileCase` for files under `childDir`.

## 0.3.1-beta

### Added

- `stylelint.rel.fileCase` option to control expected file name casing for child `@rel` comments.
- Accepts `*.module.scss` for child link comments (CSS Modules).
- `stylelint.class.rootCase` now defaults `stylelint.rel.fileCase` when using `createRules()`.
- `stylelint.rel.childFileCase` option to control expected file name casing when the `@rel` path includes `childDir`.

### Changed

- Child link checks now use `childFileCase` for targets under `childDir` and `fileCase` for other targets.
- `stylelint.rel.fileCase` no longer inherits `stylelint.class.rootCase` automatically.

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
