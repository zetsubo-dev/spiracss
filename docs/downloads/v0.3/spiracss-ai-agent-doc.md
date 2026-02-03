# SpiraCSS AI Agent Guide v0.3.4

This document is self-contained (rules + fix guidance live here). For decision-making, assume only this file and spiracss.config.js are authoritative; sample configs below are reference examples.
Lint messages are actionable fix guidance derived from the current implementation. If they conflict with this document, follow the tool output and report the mismatch; config remains highest priority.

## 0. Source of Truth and Fix Guidance (must follow)

1. spiracss.config.js (project-specific; always read first)
2. Tool output (Stylelint / HTML CLI). If it conflicts with this document, follow the tool output and report doc drift; config still overrides.
3. This document (rules + workflow; use it to interpret and apply tool output)

Defaults are only a fallback for HTML tools when config is missing. Stylelint requires a config (path or object) with aliasRoots; if missing, stop and report. If you use a path, spiracss.config.js must be readable. Do not use defaults for final decisions if config exists.

Version compatibility: @spiracss/stylelint-plugin v0.3.4, @spiracss/html-cli v0.3.4.
If actual tool versions differ or cannot be confirmed, stop and ask before applying rules from this document.

## 1. Design Overview (minimum)

Principles:
- Minimal structure: Block > (Block | Element)
- Deterministic naming over subjective judgment
- Variant vs State separation
- Tool-verifiable rules first

Layers:
- Global: tokens, mixins, utilities, shared keyframes
- Page: placement and page-level layout. Page layer focuses on wiring/placing components; avoid styling internals of imported components, creating page-specific scss/ directories, or writing @keyframes/transition.
- Component: Block/Element structure, Variant/State, interaction rules

Component model:
- One Block per SCSS file by default (config may relax)
- Elements are internal to a Block; do not use Element as a structural container for Blocks
- Two internal sections: --shared (intra-block reuse) and --interaction (state, pseudo, ARIA)
- Parent controls placement/margins of child Blocks; child controls its internal layout

Note: Most lint rules do not enforce layer intent (Page vs Component responsibility). The page-layer rule adds limited enforcement for page entry SCSS, but you must still follow this document’s guidance when generating structure and placement.

## 2. AI Decision Flow (execute in this order)

1) Load spiracss.config.js from project root.
2) Resolve effective settings (naming, structure, selectorPolicy, interaction, keyframes, rel).
3) Classify classes and decide Block/Element/Modifier/Utility/External.
4) Place rules into correct sections (basic/shared/interaction) based on selectorPolicy.
5) Generate or modify code.
6) Run lint tools; fix code to satisfy config. Change config only if explicitly requested.

If config is missing or a key is absent, mark the decision as tentative and prefer asking before final changes.
If config is missing, Stylelint-based fixes are blocked (createRules errors). Only HTML tools can proceed with fallback defaults, and results must be treated as provisional.

## 3. Effective Config Resolution (how settings are derived)

### 3.1 Stylelint createRules / createRulesAsync

- createRules/createRulesAsync require aliasRoots. If you pass a path, spiracss.config.js must be readable; if you pass a config object, a file is not required.
- stylelint.base.comments.shared / interaction are merged into per-rule comments when not explicitly set:
  - class.comments
  - placement.comments
  - interactionScope.comments
  - interactionProps.comments
  - rel.comments
- Per-rule comments override base comments (shared/interaction).
- Comment patterns accept RegExp or string. Strings become new RegExp(pattern, 'i').
  - With stylelint validation enabled, invalid patterns are reported as invalid options and the rule stops.
  - With validation disabled, invalid patterns fall back to defaults.
- selectorPolicy:
  - Top-level selectorPolicy is used when stylelint.base.selectorPolicy is not set.
  - stylelint.base.selectorPolicy fills class/placement/interactionScope selectorPolicy unless overridden.
- Shared naming defaults to stylelint.base.naming; if missing, stylelint.class.naming is used.
- interactionProps inherits naming + external from stylelint.base/stylelint.class unless explicitly set in interactionProps.
- keyframes inherits naming + external from stylelint.base/stylelint.class unless explicitly set in keyframes.
- rel inherits naming + external from stylelint.base/stylelint.class unless explicitly set in rel.
- pageLayer inherits naming + external from stylelint.base/stylelint.class; cache from stylelint.base.cache; componentsDirs from stylelint.base.paths.components (fallback: aliasRoots.components); pageEntryAlias/pageEntrySubdir from generator; aliasRoots from spiracss.aliasRoots.
- stylelint.base.paths.childDir fills class.childDir / rel.childDir when missing.
- stylelint.base.paths.components fills class.componentsDirs / pageLayer.componentsDirs when missing (fallback: aliasRoots.components).
- generator.childScssDir fills class.childDir / rel.childDir when missing.
- generator.rootFileCase fills class.rootCase / rel.fileCase when missing.
- generator.childFileCase fills class.childFileCase / rel.childFileCase when missing.
- spiracss.fileCase.root fills class.rootCase / rel.fileCase when missing.
- spiracss.fileCase.child fills class.childFileCase / rel.childFileCase when missing.
- stylelint.base.cache fills per-rule cache when missing.
- placement.elementDepth defaults to class.elementDepth when missing.

### 3.2 HTML tools (html-lint / html-to-scss / html-format)

- All HTML tools load spiracss.config.js from the current working directory.
- Run tools from the directory that contains spiracss.config.js.
- spiracss-html-lint: uses stylelint.base.naming (fallback: stylelint.class.naming), merged external (base + class), and top-level selectorPolicy.
- spiracss-html-to-scss (generator): uses generator.globalScssModule, pageEntryAlias, pageEntrySubdir, childScssDir, layoutMixins, rootFileCase; also uses naming + external (base + class) + selectorPolicy for classification.
- spiracss-html-format: uses htmlFormat.classAttribute ("class" | "className"); data-spiracss-classname is an internal placeholder and is normalized back to class/className (do not author it).
- If config is missing, HTML tools fall back to defaults. If unreadable, tools exit with error.
- Stylelint does not fall back; it requires a config (path or object) with aliasRoots.

## 4. Naming and Classification (Block / Element / Modifier / Utility / External)

### 4.1 Base class selection (HTML lint)

- The base class is the first class token in HTML.
- HTML lint reports INVALID_BASE_CLASS when the base is invalid (including modifier/utility prefixes), or when an External base is mixed with any non-external class later.
- Modifier/Utility as base can also emit MODIFIER_WITHOUT_BASE or UTILITY_WITHOUT_BASE when no Block/Element exists.
- External-only elements are treated as non-Spira structure; avoid using them as component roots.

### 4.2 Classification order (HTML base classification priority)

1) Matches external.prefixes / external.classes -> External.
2) Matches modifier pattern (modifierPrefix + modifierCase or customPatterns.modifier) -> Modifier (never a base class).
3) Starts with "u-" -> Utility (never a base class).
4) Starts with "-" or "_" -> Invalid as base.
5) Matches customPatterns.block -> Block.
6) Matches customPatterns.element -> Element.
7) Word count >= 2 and <= blockMaxWords -> Block.
8) Word count == 1 -> Element.
9) Otherwise -> Invalid.

This order is for HTML base classification. Stylelint validates class names individually (no base-first semantics).
Reserved prefixes ("u-", "-", "_") are fixed for HTML base classification when not treated as External.
customPatterns cannot override reserved prefixes; only external.* can bypass them, which removes the class from structure checks.
If customPatterns.block is set, Block classification uses only that pattern (word-count Block classification is skipped).

### 4.3 Word count rules

- kebab: split by "-" (card-list -> 2 words)
- snake: split by "_" (card_list -> 2 words)
- camel: split by uppercase transitions (cardList -> 2 words)
- pascal: split by uppercase transitions (CardList -> 2 words)

Element is 1 word by default only when customPatterns.element is not set.
Internal capitals create additional words; camel/pascal multi-word names become Block only when blockCase is camel/pascal.
- ✅ title (elementCase=kebab/snake/camel), Title (elementCase=pascal)
- ❌ bodyText, BodyText (these are multi-word and become Block only when blockCase is camel/pascal; otherwise invalid unless overridden)

### 4.4 Custom patterns

- customPatterns.block/element/modifier must be RegExp.
- RegExp flags "g" and "y" are invalid for customPatterns.
- customPatterns.block replaces the default Block pattern (blockCase + blockMaxWords); word-count Block classification is disabled while it is set.
- When customPatterns.element is set, it replaces the default 1-word Element rule entirely and may allow multi-word names.

### 4.5 Modifiers

- modifierPrefix + modifierCase define modifier tokens unless customPatterns.modifier is set (then it replaces the default pattern).
- Modifiers are validated by pattern (default: 1-2 words). "-foo-bar-baz" is invalid by default.
- In SCSS, modifiers must be written as "&.<modifier>" inside the Block.
- Only modifiers may be appended to "&".

### 4.6 External classes

- external.classes (exact) / external.prefixes (prefix) exclude classes from structure checks.
- If an element mixes External and Spira classes, the base must be Block/Element (External cannot be the base).
- If all classes are External, the element is treated as non-Spira structure.
- Avoid referencing utilities in SCSS. Only consider external.prefixes for utilities if the project explicitly requires it and config changes are authorized.
- `u-` is not automatically External for Stylelint class-structure; add it to external.prefixes if you want to skip naming checks. Placement treats `u-` as external only for placement rules.
- Recommended: follow the project config (official examples often include external.prefixes: ['u-']). If `u-` is not external, class-structure may report invalid names while placement skips them. Do not change config without approval.

## 5. Structure and Sections

### 5.1 Section order and placement

Order:
1. Basic structure
2. --shared
3. --interaction

Rules:
- --shared and --interaction must be direct children of the root Block.
- Root wrappers like @layer/@supports/@media/@container/@scope are allowed.
- Comment patterns control section detection; requireComment=true makes them mandatory.
- interactionProps always uses comment patterns to detect the interaction section.

### 5.2 Structure constraints

- Allowed: Block > Block, Block > Element.
- Element cannot contain Block in basic/shared sections (interaction is exempt).
- Block > Block > Block (3+ levels) is invalid in basic/shared sections (interaction is exempt). There is no config option to allow this; refactor or disable the rule.
- Element chain depth is limited by elementDepth (interaction is exempt).
- Element > Element chains should be rare and limited to decorative/semantic grouping; avoid using them for layout. Promote to Block when in doubt.
- childCombinator=true requires ">" under Block direct children (shared/interaction are exempt).
- childNesting=true forbids top-level child selectors; nest them inside the Block.
- Shared section relaxes the ">" requirement but still enforces structure rules.
- Do not target a grandchild Element from a parent Block when Block > Block exists (interaction is exempt).
- Root-level selectors must include the root Block (no stray root rules).
- rootSingle=true requires a single root Block per file; it applies only to top-level selectors that include Spira classes (External-only selectors are excluded from this check).

### 5.3 Variant and State placement

- Variant is written in basic structure by default.
- State and ARIA go in interaction.
- Variant selectors may appear in interaction only for transition initial values when needed.
- Do not mix data-variant with data-state / aria-* in the same selector.

### 5.4 Root file naming (rootFile)

- Applies only inside componentsDirs (supports nested paths).
- Skips assets/css, index.scss, and files starting with "_" (partials).
- Both *.scss and *.module.scss are accepted (CSS Modules; ".module" is ignored).
- If the path includes childDir, expected filename is the root Block name formatted by childFileCase.
- Otherwise, expected filename is the root Block name formatted by rootCase.
- If rootFile=false, no filename checks are applied.

### 5.5 Page layer (page-layer)

- Applies only to page entry SCSS under pageEntryAlias/pageEntrySubdir (resolved via aliasRoots). Files outside are skipped.
- Direct child Block rules in page entry SCSS must begin with a link comment to a component file (first node in the rule body).
- Link targets must resolve inside componentsDirs (e.g., `// @components/...`). This rule resolves aliases and checks whether the path falls under componentsDirs, but it does not verify that the target file actually exists. For file existence checks, use `spiracss/rel-comments` with `validatePath=true`.
- Element selectors are not validated by this rule; use class-structure if you need structure checks.
- selectorParseFailed means some selectors could not be parsed; treat coverage as partial.

## 6. Property Placement (placement)

Property placement enforces the parent/child responsibility split:
- Parent decides layout and placement of children.
- Child decides its own internal layout in its own file.

### 6.1 What it checks (summary)

- Page-root selectors (standalone `body` or standalone `#id`) are decoration-only:
  - Do not place layout/container/item/internal properties on them.
  - Do not use compound selectors like `body > .main` (page-root is treated as standalone).
  - Do not add attributes or pseudos (page-root must be bare).
- Container properties are allowed on the root Block/Element but disallowed on child Block selectors. Child Element selectors (`> .element`) are treated as root — allowed.
- Item properties are allowed on any direct child selector (`> .child-block` or `> .element`), not on the root Block itself. In practice, child Block is the most common placement context.
- Internal properties are allowed on the root Block/Element but disallowed on child Block selectors. Child Element selectors (`> .element`) are treated as root — allowed.
- Enforces one-sided vertical margin (`marginSide`).
- Restricts `position` on child Block selectors (when `position=true`).
- `@extend` is always forbidden; `@at-root` is allowed only in the interaction section
  (including external-only roots composed solely of external classes).

### 6.2 Property categories (defaults)

Container (examples):
- `display: flex|inline-flex|grid|inline-grid`
- `gap`, `row-gap`, `column-gap`
- `justify-content`, `justify-items`, `align-content`, `align-items`
- `grid`, `grid-template*`, `grid-auto-*`
- `flex-direction`, `flex-wrap`

Item (examples):
- `margin*`, `margin-inline*`, `margin-block*`
- `flex`, `flex-grow`, `flex-shrink`, `flex-basis`, `order`, `align-self`, `justify-self`
- `grid-column`, `grid-row`, `grid-area`

Internal (examples):
- `padding*`, `overflow*`
- When `sizeInternal=true` (default): `width/height`, `inline-size/block-size`, `min-*`, `max-*`
- When `sizeInternal=false`: size properties become **unchecked** (not reclassified as item; placement validation is skipped for them)

### 6.3 Fix heuristics

- If a container/internal property is reported under a child Block selector (`> .child-block`), move it into the child Block file (the file where `.child-block { ... }` is defined). Child Element selectors are treated as root, so this error only fires for child Blocks.
- If an item property is reported on a root Block selector, move it to the parent’s direct child selector (the file that places the child Block, typically linked via `@rel`).
- If the parent needs to influence a child's internal value, prefer:
  - CSS custom properties exposed by the child, or
  - Variant/State (data attributes or modifiers depending on `selectorPolicy`).
- Size example (sizeInternal=true): the child exposes `width: var(--child-block-width, auto)`, the parent sets `> .child-block { --child-block-width: 200px; }`. Do NOT write `width` directly on `> .child-block`.
- Other internal values (e.g., padding): same pattern — `padding: var(--child-padding, 16px)`.

Notes:
- Placement checks treat `u-` classes as external and skip them (placement only; class-structure still validates unless configured).
- Selector analysis supports only direct combinators and trailing sibling combinators; descendant combinators are unsupported. `.block + .block` and mid-chain `+`/`~` are rejected. Unsupported selectors may be skipped without warnings; selectorParseFailed/selectorResolutionSkipped are not guaranteed.
- `@scope` is treated as a context boundary; wrapper at-rules like `@media/@supports/@container/@layer` are treated as the same context.
- `responsiveMixins` can mark `@include` wrappers as transparent for context checks.
- Some selectors may be skipped when resolution becomes too complex; Stylelint reports `selectorResolutionSkipped` in that case.

## 7. Variant/State Policy (selectorPolicy)

Keys:
- variant.dataKeys: array of allowed data-* keys for Variant.
- state.dataKey: a single data-* key for State.
- state.ariaKeys: array of allowed aria-* keys for State.
- valueNaming (or per-variant/state override): applies to data values only.

Mode matrix:

| variant.mode | state.mode | Variant in HTML | State in HTML | Modifiers | Variant/State attributes |
| --- | --- | --- | --- | --- | --- |
| data | data | data-variant (variant.dataKeys) | data-state + aria-* | disallowed | allowed |
| class | data | modifier | data-state + aria-* | allowed | data-variant disallowed |
| data | class | data-variant | modifier | allowed | data-state/aria disallowed |
| class | class | modifier (variant) | modifier (indistinguishable) | allowed | data-* disallowed |

Notes:
- Variant can use multiple keys (e.g., data-variant, data-size). State uses one data key (e.g., data-state) plus optional aria-*.
- When variant.mode=class and state.mode=class, modifiers represent Variant and State cannot be distinguished.
- valueNaming defaults to { case: kebab, maxWords: 2 }.
- selectorPolicy applies only to reserved keys (variant.dataKeys, state.dataKey, state.ariaKeys). Unrelated attributes (e.g., data-testid) are ignored and should not be removed.
- Non-reserved attribute selectors in SCSS can cause placement selector analysis to skip without warnings; treat placement results as provisional if you use them.

## 8. Interaction and Pseudo Nesting

interactionScope:
- requireAtRoot=true: use @at-root & { ... } and selectors must start with "&".
- requireAtRoot=false: @at-root wrapper is optional, but pseudo-nesting still requires "&".
- requireComment=true: // --interaction is mandatory.
- requireTail=true: interaction block must be the last non-comment node inside the root Block.
- requireTail is checked only when the interaction section is detected (comment + @at-root &).
- commentOnly=true: only validate sections with the comment.
  - false: pseudo/state selectors without comment are detected and reported.
- pseudos is configured by stylelint.interactionScope.pseudos.

pseudo:
- Pseudo-classes/elements must be nested under "&".
- ✅ .block { &:hover {} }
- ✅ .block { > .child { &:hover {} } }
- ❌ .block:hover {}
- ❌ & > .child:hover {}

Default pseudos: :hover, :focus, :focus-visible, :active, :visited.

## 9. Transition / Animation (interactionProps)

Rules:
- transition / animation only in interaction section.
- transition must specify target properties.
- transition: all, transition: none, transition-property: all, transition-property: none are prohibited.
- inherit / initial / unset / revert / revert-layer are prohibited.
- custom properties / var(...) are not allowed as transition targets.
- transition target properties should not appear outside interaction for the same Block/Element.

Example:

```scss
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;                      // initial value inside interaction
    transition: opacity 0.2s ease;
    &:hover { opacity: 1; }
  }
}
```

## 10. Keyframes (keyframes)

- @keyframes must be at root level and file end (unless ignored by config).
- Naming: {block}-{action} or {block}-{element}-{action}.
- {block}-{element}-{action}: if the token after {block} matches an element in the same file, it is treated as {element}. If not, the token is treated as part of the {action} (still valid if it matches action naming).
- actionMaxWords applies to action part (capped at 3 by implementation); action case follows blockCase.
Note: Some projects may enforce strict element matching by convention. If so, require the element to exist even though the implementation allows the fallback.
- blockSource:
  - selector: use root Block selector
  - file: use filename
  - selector-or-file: try selector first, then file
- blockWarnMissing=true: emits warning if block cannot be determined; naming checks are skipped.
- ignoreFiles / ignorePatterns can skip files or names.
- ignoreSkipPlacement skips placement checks for ignored names.
- Names starting with sharedPrefixes are shared keyframes: use `{prefix}{action}` and place them only in sharedFiles.
- sharedPrefixes default: ["kf-"]
- sharedFiles default: ["keyframes.scss"]

## 11. @rel Comments (rel)

aliasRoots:
- Required for Stylelint; not used by HTML CLI.
- Key pattern: [a-z][a-z0-9-]* (e.g., components, assets).
- Values are arrays of paths.

Example:
```js
aliasRoots: {
  components: ['src/components'],
  styles: ['src/styles'],
  assets: ['src/assets']
}
```

Requirement flags:
- requireMeta: if true, a parent file using meta.load-css requires a page @rel at root scope.
- requireScss: if true, SCSS under childDir requires child -> parent @rel.
- requireChild enables parent -> child @rel checks.
- requireChildShared / requireChildInteraction control checks inside those sections (only when requireChild=true).
- requireParent enables the root-scope @rel requirement when applicable.

Placement rules (when required by config):
- Parent Block -> Page: // @assets/css/page.scss at root scope, before rules.
- Child Block -> Parent: // @rel/../parent-block.scss at root scope, before rules.
- Parent -> Child: // @rel/scss/child-block.scss as the first node inside "> .child-block" rule.
- Root Block must be the first rule in the file when requireParent applies (after any @use/@forward/@import).

Filename case checks (childMismatch):
- fileCase: expected filename case for child targets.
- childFileCase: optional filename case used only when the @rel target path includes childDir (defaults to fileCase).
- Both *.scss and *.module.scss are accepted when matching child target filenames.

## 12. Tooling Constraints

HTML CLI:
- SCSS generation extracts static class names from JSX class/className (string literals, template literal static parts, member access like styles.foo). When `jsxClassBindings.memberAccessAllowlist` is set, only the listed base identifiers are treated as class sources (empty array disables member access extraction), and chained access (e.g. `styles.layout.hero`) is treated as dynamic. Dynamic expressions are dropped.
- Placeholder insertion skips JSX bindings that include dynamic expressions (conditions, props, interpolations).
- Template syntax (EJS/Nunjucks/Astro/etc) is skipped for formatting to avoid breaking markup.

Note: Dynamic class usage or template syntax may hide structural violations from HTML CLI. If detected in input, stop and report even if lint can run.

Stylelint:
- createRules/createRulesAsync require a config (path or object) with aliasRoots; no defaults are applied.
- CSS Modules `:global` / `:local` are treated as transparent (the inner selector is linted; they do not bypass SpiraCSS checks).
- Path-based loading requires a readable spiracss.config.js. In ESM, use createRulesAsync(path) or createRules(config).
- Path resolution uses the current working directory as the project root. Run Stylelint from the directory that contains spiracss.config.js to avoid false `@rel` path errors.

### 12.1 Execution preconditions

- If Node/Stylelint/CLI are not installed, stop and ask before proceeding.
- `npx` may auto-install packages; do not run it without explicit approval.
- Do not run `npm install` or other dependency changes without explicit approval.
- If HTML CLI prints `WARN [INVALID_CUSTOM_PATTERN]`, stop and ask; customPatterns are ignored and naming rules may be wrong.

### 12.2 Minimal execution recipes (reference)

Stylelint config (CommonJS):
```js
// stylelint.config.cjs
const spiracss = require('@spiracss/stylelint-plugin')
const plugin = spiracss.default ?? spiracss
const { createRules } = spiracss

module.exports = {
  plugins: [plugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules('./spiracss.config.js'),
    'scss/at-rule-no-unknown': true
  }
}
```

Stylelint config (ESM + createRulesAsync):
```js
// stylelint.config.js (type: module)
import spiracssPlugin, { createRulesAsync } from '@spiracss/stylelint-plugin'

const rules = await createRulesAsync('./spiracss.config.js')

export default {
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...rules,
    'scss/at-rule-no-unknown': true
  }
}
```

Run Stylelint (from the directory containing spiracss.config.js):
```bash
npx stylelint "**/*.scss"
```
Note: examples use `npx`. `npx` may auto-install packages; do not run it without explicit approval (see §12.1). Use `yarn stylelint` or `pnpm stylelint` if that matches the project setup.

HTML CLI examples (run from the directory containing spiracss.config.js):
```bash
# Lint HTML (root mode)
npx spiracss-html-lint --root path/to/file.html

# Lint HTML (selection mode, stdin)
cat fragment.html | npx spiracss-html-lint --selection --stdin

# Generate SCSS
npx spiracss-html-to-scss --root path/to/file.html

# Format HTML
npx spiracss-html-format path/to/file.html
```
Note: examples use `npx`. npx may auto-install packages; do not run it without explicit approval (see §12.1). Use `yarn spiracss-html-lint` / `yarn spiracss-html-to-scss` / `yarn spiracss-html-format` if that matches the project setup.

### 12.3 HTML CLI options for automation (reference)

- spiracss-html-to-scss: `--json`, `--dry-run`, `--base-dir`, `--ignore-structure-errors`, `--selection`, `--stdin`
- spiracss-html-lint: `--json`, `--selection`, `--stdin`
- spiracss-html-format: `--output` (`-o`), `--stdin`

## 13. Lint-Driven Fix Loop (use error messages)

Lint messages are designed to be actionable. Read the message first, then map to the config section below.
Tool output is required for autonomous fixes because it provides message keys and locations; do not proceed without it.
If a message conflicts with config, re-check the config. If a message conflicts with this document, follow the tool output and report doc drift. Only change config when explicitly instructed.

Stylelint rules -> config section -> typical fixes:
- spiracss/class-structure -> stylelint.class
  - Fix naming, child combinators, depth, modifier placement.
- spiracss/page-layer -> stylelint.pageLayer
  - Ensure direct child Blocks in page entry SCSS have a `// @components/...` link comment and it resolves to componentsDirs.
- spiracss/property-placement -> stylelint.placement
  - Fix placement rules (margin side, position, size/internal, responsive mixins).
- spiracss/interaction-scope -> stylelint.interactionScope
  - Fix @at-root &, leading &, comment, tail placement.
- spiracss/interaction-properties -> stylelint.interactionProps
  - Move transition/animation to interaction; specify targets; move initial values.
- spiracss/keyframes-naming -> stylelint.keyframes
  - Move @keyframes to root/end; rename to {block}-{action}.
- spiracss/pseudo-nesting -> stylelint.pseudo
  - Nest pseudo under &; do not attach pseudo directly to selector.
- spiracss/rel-comments -> stylelint.rel
  - Add/move @rel comments; fix alias paths; ensure root Block is first rule when required.

HTML lint error codes -> typical fixes:
- INVALID_BASE_CLASS: base class is invalid (modifier/utility/invalid pattern), external class is first with non-external later, no root element, or root has no class; put a valid Block/Element first and ensure the element exists.
- MODIFIER_WITHOUT_BASE: add a Block/Element base class first.
- DISALLOWED_MODIFIER: use data-* (when data mode) or change selectorPolicy.
- UTILITY_WITHOUT_BASE: add a Block/Element base class first.
- MULTIPLE_BASE_CLASSES: keep one base class per element.
- UNBALANCED_HTML: fix invalid markup (missing/extra closing tags).
- MULTIPLE_ROOT_ELEMENTS: in root mode, ensure a single root element or switch to selection mode.
- ROOT_NOT_BLOCK: root base must be Block.
- ELEMENT_WITHOUT_BLOCK_ANCESTOR: move Element inside a Block.
- ELEMENT_PARENT_OF_BLOCK: promote parent Element to Block or refactor.
- DISALLOWED_VARIANT_ATTRIBUTE / DISALLOWED_STATE_ATTRIBUTE: use modifiers in class mode.
- INVALID_VARIANT_VALUE / INVALID_STATE_VALUE: fix data value to match valueNaming.

Definition of done:
- If any HTML was modified or used as input for SCSS generation, HTML lint must pass in the appropriate mode. If dynamic class bindings or template syntax are present, stop and report (lint results are not sufficient).
- Stylelint passes AND @rel path validation passes (when validatePath=true).

### 13.1 Stylelint message keys (v0.3.4)

Stylelint messages include a stable message key and a docs URL with an anchor like `#invalidName`.
This document lists keys + meanings only; exact message text may change, so rely on tool output.
If you need deeper guidance, open the linked rule page and anchor.

spiracss/class-structure:
- invalidName: class name violates naming rules
- elementChainTooDeep: Element chain exceeds elementDepth
- elementCannotOwnBlock: Block cannot be nested under an Element (basic/shared)
- blockDescendantSelector: chained selector under a Block; style only direct children
- blockTargetsGrandchildElement: parent Block must not style grandchild Elements directly
- tooDeepBlockNesting: Block > Block > Block nesting is not allowed (basic/shared)
- multipleRootBlocks: multiple root Blocks in one file
- needChild: missing `>` for direct child selector (basic section)
- needChildNesting: top-level child selector; must be nested inside the Block
- sharedNeedRootBlock: shared section must be directly under the root Block
- needAmpForMod: modifier must be written as `&.<modifier>` inside the Block
- needModifierPrefix: only modifier classes may be appended to `&`
- disallowedModifier: modifiers are disabled when variant/state are both data mode
- invalidVariantAttribute: variant attributes are disabled when variant.mode=class
- invalidStateAttribute: state attributes are disabled when state.mode=class
- invalidDataValue: invalid data value naming (valueNaming)
- rootSelectorMissingBlock: selector must include the root Block
- missingRootBlock: no root Block found
- fileNameMismatch: root Block name must match filename (rootFile/rootCase)
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/page-layer:
- missingComponentLink: direct child Block in page entry SCSS lacks a link comment
- nonComponentLink: link comment does not resolve to componentsDirs
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/property-placement:
- containerInChildBlock: container property is not allowed on child Block selectors
- itemInRoot: item property is not allowed on a root Block selector
- selectorKindMismatch: mixed selector kinds prevent placement analysis
- marginSideViolation: forbidden vertical margin side per marginSide
- internalInChildBlock: internal property is not allowed on child Block selectors
- positionInChildBlock: position restrictions violated on a child Block selector
- pageRootContainer: container property is not allowed on page-root selectors
- pageRootItem: item property is not allowed on page-root selectors
- pageRootInternal: internal property is not allowed on page-root selectors
- pageRootNoChildren: page-root selector must be standalone (no extra selectors)
- forbiddenAtRoot: `@at-root` is only allowed in interaction (external-only roots are allowed
  only when all selectors are external classes; tags/ids/attributes/pseudos disqualify it)
- forbiddenExtend: `@extend` is forbidden
- selectorResolutionSkipped: selector resolution was skipped due to complexity (warning)
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/interaction-scope:
- needAtRoot: interaction selectors must be inside `@at-root & { ... }` and start with `&` (when enabled)
- needComment: missing `// --interaction` comment (when enabled)
- needTail: interaction section must be at the end (when enabled)
- needRootBlock: interaction section must be directly under the root Block
- mixedStateVariant: do not mix state selectors with variant selectors in the same selector
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/interaction-properties:
- needInteraction: transition/animation must be declared inside interaction
- missingTransitionProperty: transition must include explicit property names
- transitionAll: disallow `all` as a transition target
- transitionNone: disallow `none` as a transition target
- invalidTransitionProperty: disallow keywords/custom properties in transition targets
- initialOutsideInteraction: transitioned property is declared outside interaction
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/keyframes-naming:
- needRoot: `@keyframes` must be at root level
- needTail: `@keyframes` must be at file end
- invalidName: keyframes name must follow `{block}-{action}` or `{block}-{element}-{action}`
- invalidSharedName: shared keyframes name must follow `{prefix}{action}`
- sharedFileOnly: shared keyframes must be in a configured shared file
- missingBlock: cannot resolve root Block for keyframes naming (warning when blockWarnMissing=true)
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/pseudo-nesting:
- needNesting: pseudos must be nested under `&` on the same compound
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

spiracss/rel-comments:
- missingParentRel: missing top-of-file link comment to the parent
- misplacedParentRel: parent link comment must be at top of file
- rootBlockNotFirst: root Block must be the first rule in its root scope
- missingChildRel: missing child link comment inside direct child rule
- notFound: link target path does not exist (when validatePath=true)
- childMismatch: child name does not match the `@rel` target
- selectorParseFailed: selector parse failed; some checks were skipped (warning)

### 13.2 Autonomy coverage (v0.3.4)

Scope: static HTML classes and selectors; unsupported selectors may be skipped without warnings. Dynamic class bindings and selectorParseFailed/selectorResolutionSkipped reduce coverage.

| Category | Lint fixability | Notes |
| --- | --- | --- |
| Naming / classification | High | Dynamic HTML can hide violations |
| Structure / sections | High | Element chain intent may need judgment |
| Page layer | Medium-High | Requires valid page entry detection and component link resolution |
| Property placement | High | Selector warnings reduce certainty |
| Variant / State | High | Must match selectorPolicy |
| Interaction | High | |
| Keyframes | High | Element token is optional; if no match, it is treated as part of the action |
| Pseudo-nesting | High | Parseable selectors only |
| @rel comments | Medium-High | Path inference can require project context |
| HTML lint | High | Skips dynamic bindings/templates |

Overall estimate (static inputs, parseable selectors): high but not guaranteed; treat warnings as manual review.

### 13.3 Warning handling (selectorParseFailed / selectorResolutionSkipped)

- Do not loop endlessly on warnings.
- Try: split selector lists, simplify combinators, or refactor complex selectors.
- If warnings persist after 3 attempts, stop and report with the selectors and context.
- If selectors contain unsupported combinators (descendant space, mid-chain `+`/`~`, `.block + .block`), treat lint pass as provisional and report; unsupported selectors may be skipped without warnings.

## 14. Examples

### 14.1 HTML structure (✅ / ❌)

✅
```html
<div class="hero-section">
  <div class="content"></div>
  <h1 class="title"></h1>
</div>
```

❌ (Element > Block):
```html
<div class="hero-section">
  <div class="title">
    <div class="badge-container"></div>
  </div>
</div>
```

❌ (modifier first):
```html
<div class="-primary title"></div>
```

### 14.2 Variant/State (data mode)

HTML:
```html
<div class="card-block" data-variant="primary" data-state="active" aria-expanded="true"></div>
```

SCSS:
```scss
.card-block {
  &[data-variant="primary"] {}

  // --interaction
  @at-root & {
    &[data-state="active"] {}
    &[aria-expanded="true"] {}
  }
}
```

### 14.3 Variant/State (class mode)

HTML:
```html
<div class="card-block -primary -active"></div>
```

SCSS:
```scss
.card-block {
  &.-primary {}

  // --interaction
  @at-root & {
    &.-active {}
  }
}
```

### 14.4 @rel placement (examples)

Parent Block file:
```scss
// @assets/css/home.scss

.parent-block {
  > .child-block {
    // @rel/scss/child-block.scss
  }
}
```

Child Block file:
```scss
// @rel/../parent-block.scss

.child-block {}
```

### 14.5 Generated SCSS header (example)

```scss
@use "@styles/partials/global" as *;
@use "sass:meta";

// @assets/css/page.scss

.sample-block {
  @include meta.load-css("scss");
}
```

### 14.6 Shared section (example)

```scss
.sample-block {
  // --shared
  .icon { width: 24px; }                // No ">" required
  .caption { }                          // Direct child; ">" not required
}
```

### 14.7 Page layer (✅ / ❌)

✅ (page entry SCSS):
```scss
.main-container {
  > .about-content {
    // @components/pages/about/about-content/about-content.scss
    margin-top: 2rem;
  }
}
```

❌ (missing link comment):
```scss
.main-container {
  > .about-content {
    margin-top: 2rem;
  }
}
```

## 15. Fallback Defaults (use only if config is missing)

Note: Stylelint does not fall back to these defaults; use them only for HTML tools or provisional reasoning.

- class:
  - blockCase=kebab, blockMaxWords=2, elementCase=kebab, modifierCase=kebab, modifierPrefix="-"
  - childCombinator=true
  - childNesting=true
  - rootSingle=true
  - rootFile=true
  - rootCase="preserve"
  - childFileCase="preserve"
  - childDir="scss"
  - componentsDirs=["components"]
  - elementDepth=4
  - comments.shared=/--shared/i, comments.interaction=/--interaction/i
- selectorPolicy:
  - valueNaming={ case: kebab, maxWords: 2 }
  - variant.mode=data, variant.dataKeys=[data-variant]
  - state.mode=data, state.dataKey=data-state, state.ariaKeys=[aria-expanded, aria-selected, aria-disabled]
- placement:
  - elementDepth=4, marginSide="top", position=true, sizeInternal=true, responsiveMixins=[]
- interactionScope:
  - requireAtRoot=true, requireComment=true, requireTail=true, commentOnly=false
  - pseudos=[:hover, :focus, :focus-visible, :active, :visited]
- rel:
  - requireScss=true
  - requireMeta=true
  - requireParent=true
  - requireChild=true
  - requireChildShared=true
  - requireChildInteraction=false
  - validatePath=true
  - skipNoRules=true
  - fileCase="preserve"
  - childFileCase=(unset; falls back to fileCase)
- keyframes:
  - sharedPrefixes=["kf-"], sharedFiles=["keyframes.scss"], actionMaxWords=3
  - blockSource="selector", blockWarnMissing=true, ignoreSkipPlacement=false

## 16. Optional Official References (absolute URLs)

These links are optional. This document is self-contained.

- https://spiracss.jp
- https://spiracss.jp/architecture/principles/
- https://spiracss.jp/architecture/layers/
- https://spiracss.jp/architecture/components/
- https://spiracss.jp/configuration/
- https://spiracss.jp/tooling/stylelint/
- https://spiracss.jp/tooling/html-cli/
