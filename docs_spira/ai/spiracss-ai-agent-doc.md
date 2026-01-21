# SpiraCSS AI Agent Guide v0.2.2

This document is self-contained. Assume only this file and spiracss.config.js exist in the project.
Lint messages are actionable fix guidance derived from the current implementation. If they conflict with this document, follow the tool output and report the mismatch; config remains highest priority.

## 0. Source of Truth and Fix Guidance (must follow)

1. spiracss.config.js (project-specific; always read first)
2. This document (rules + workflow)
3. Tool output (procedural fix hints; if it conflicts with this document, follow the tool output and report doc drift; config still overrides)

Defaults are only a fallback when config is missing. Do not use defaults for final decisions if config exists.

Version compatibility: @spiracss/stylelint-plugin v0.2.2, @spiracss/html-cli v0.2.2.

## 1. Design Overview (minimum)

Principles:
- Minimal structure: Block > (Block | Element)
- Deterministic naming over subjective judgment
- Variant vs State separation
- Tool-verifiable rules first

Layers:
- Global: tokens, mixins, utilities, shared keyframes
- Page: placement and page-level layout only. Page layer does NOT define component internal structure, create page-specific scss/ directories, or write @keyframes/transition.
- Component: Block/Element structure, Variant/State, interaction rules

Component model:
- One Block per SCSS file by default (config may relax)
- Elements are internal to a Block; do not use Element as a structural container for Blocks
- Two internal sections: --shared (intra-block reuse) and --interaction (state, pseudo, ARIA)
- Parent controls placement/margins of child Blocks; child controls its internal layout

Note: Lint rules do not enforce layer intent (Page vs Component responsibility). Follow this document’s guidance when generating structure.

## 2. AI Decision Flow (execute in this order)

1) Load spiracss.config.js from project root.
2) Resolve effective settings (naming, structure, selectorPolicy, interaction, keyframes, rel).
3) Classify classes and decide Block/Element/Modifier/Utility/External.
4) Place rules into correct sections (basic/shared/interaction) based on selectorPolicy.
5) Generate or modify code.
6) Run lint tools; fix code to satisfy config. Change config only if explicitly requested.

If config is missing or a key is absent, mark the decision as tentative and prefer asking before final changes.
If config is missing or invalid, any output based on fallback defaults must be treated as provisional.

## 3. Effective Config Resolution (how settings are derived)

### 3.1 Stylelint createRules / createRulesAsync

- stylelint.base.comments.shared / interaction are merged into per-rule comments when not explicitly set:
  - class.comments
  - placement.comments
  - interactionScope.comments
  - interactionProps.comments
  - rel.comments
- Per-rule comments override base comments (shared/interaction).
- Comment patterns accept RegExp or string. Strings become new RegExp(pattern, 'i').
  - Unsafe/invalid patterns fall back to defaults.
- selectorPolicy:
  - Top-level selectorPolicy is used when stylelint.base.selectorPolicy is not set.
  - stylelint.base.selectorPolicy fills class/placement/interactionScope selectorPolicy unless overridden.
- Shared naming defaults to stylelint.base.naming; if missing, stylelint.class.naming is used.
- interactionProps inherits naming + external from stylelint.base/stylelint.class unless explicitly set in interactionProps.
- keyframes inherits naming + external from stylelint.base/stylelint.class unless explicitly set in keyframes.
- rel inherits naming + external from stylelint.base/stylelint.class unless explicitly set in rel.
- stylelint.base.paths.childDir / components fill class.childDir / componentsDirs when missing.
- generator.rootFileCase / childScssDir fill class.rootCase / childDir if missing.
- generator.childScssDir fills rel.childDir if missing.
- stylelint.base.cache fills per-rule cache when missing.
- placement.elementDepth defaults to class.elementDepth when missing.

### 3.2 HTML tools (html-lint / html-to-scss / html-format)

- All HTML tools load spiracss.config.js from the current working directory.
- Run tools from the directory that contains spiracss.config.js.
- spiracss-html-lint: uses stylelint.base.naming (fallback: stylelint.class.naming), merged external (base + class), and top-level selectorPolicy.
- spiracss-html-to-scss (generator): uses generator.globalScssModule, pageEntryAlias, pageEntrySubdir, childScssDir, layoutMixins, rootFileCase; also uses naming + external (base + class) + selectorPolicy for classification.
- spiracss-html-format: uses htmlFormat.classAttribute ("class" | "className"); data-spiracss-classname is an internal placeholder and is normalized back to class/className (do not author it).
- If config is missing, defaults apply. If unreadable, tools exit with error.

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
- OK: title (elementCase=kebab/snake/camel), Title (elementCase=pascal)
- NG: bodyText, BodyText (these are multi-word and become Block only when blockCase is camel/pascal; otherwise invalid unless overridden)

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
- childCombinator=true requires ">" under Block direct children (shared/interaction are exempt).
- Shared section relaxes the ">" requirement but still enforces structure rules.
- Do not target a grandchild Element from a parent Block when Block > Block exists (interaction is exempt).
- rootSingle=true requires a single root Block per file; it applies only to top-level selectors that include Spira classes.

### 5.3 Variant and State placement

- Variant is written in basic structure by default.
- State and ARIA go in interaction.
- Variant selectors may appear in interaction only for transition initial values when needed.
- Do not mix data-variant with data-state / aria-* in the same selector.

### 5.4 Root file naming (rootFile)

- Applies only inside componentsDirs (supports nested paths).
- Skips assets/css, index.scss, and files starting with "_" (partials).
- If the path includes childDir, expected filename is the root Block name as-is.
- Otherwise, expected filename is the root Block name formatted by rootCase.
- If rootFile=false, no filename checks are applied.

## 6. Variant/State Policy (selectorPolicy)

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

## 7. Interaction and Pseudo Nesting

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
- OK: .block { &:hover {} }
- OK: .block { > .child { &:hover {} } }
- NG: .block:hover {}
- NG: & > .child:hover {}

Default pseudos: :hover, :focus, :focus-visible, :active, :visited.

## 8. Transition / Animation (interactionProps)

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

## 9. Keyframes (keyframes)

- @keyframes must be at root level and file end (unless ignored by config).
- Naming: {block}-{action} or {block}-{element}-{action}.
- actionMaxWords applies to action part; action case follows blockCase.
- blockSource:
  - selector: use root Block selector
  - file: use filename
  - selector-or-file: try selector first, then file
- blockWarnMissing=true: emits warning if block cannot be determined; naming checks are skipped.
- ignoreFiles / ignorePatterns can skip files or names.
- ignoreSkipPlacement skips placement checks for ignored names.
- sharedPrefixes default: ["kf-"]
- sharedFiles default: ["keyframes.scss"]

## 10. @rel Comments (rel)

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
- Parent -> Child: // @rel/scss/child-block.scss as the first node inside "> .child" rule.
- Root Block must be the first rule in the file when requireParent applies.

## 11. Tooling Constraints

HTML CLI:
- Processes literal class/className only (string or template literal). Dynamic bindings are skipped.
- Template syntax (EJS/Nunjucks/Astro/etc) is skipped for formatting to avoid breaking markup.

Note: Dynamic class usage may hide structural violations from HTML CLI.

Stylelint:
- createRules/createRulesAsync require aliasRoots.

## 12. Lint-Driven Fix Loop (use error messages)

Lint messages are designed to be actionable. Read the message first, then map to the config section below.
If a message conflicts with config, re-check the config. If a message conflicts with this document, follow the tool output and report doc drift. Only change config when explicitly instructed.

Stylelint rules -> config section -> typical fixes:
- spiracss/class-structure -> stylelint.class
  - Fix naming, child combinators, depth, modifier placement.
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
- INVALID_BASE_CLASS: put Block/Element first; add class; ensure element exists.
- MODIFIER_WITHOUT_BASE: add a Block/Element base class first.
- DISALLOWED_MODIFIER: use data-* (when data mode) or change selectorPolicy.
- UTILITY_WITHOUT_BASE: add a Block/Element base class first.
- MULTIPLE_BASE_CLASSES: keep one base class per element.
- ROOT_NOT_BLOCK: root base must be Block.
- ELEMENT_WITHOUT_BLOCK_ANCESTOR: move Element inside a Block.
- ELEMENT_PARENT_OF_BLOCK: promote parent Element to Block or refactor.
- DISALLOWED_VARIANT_ATTRIBUTE / DISALLOWED_STATE_ATTRIBUTE: use modifiers in class mode.
- INVALID_VARIANT_VALUE / INVALID_STATE_VALUE: fix data value to match valueNaming.

Definition of done:
- HTML lint passes (if used) AND Stylelint passes AND @rel path validation passes (when validatePath=true).

## 13. Examples

### 13.1 HTML structure (OK / NG)

OK:
```html
<div class="hero-section">
  <div class="content"></div>
  <h1 class="title"></h1>
</div>
```

NG (Element > Block):
```html
<div class="hero-section">
  <div class="title">
    <div class="badge-container"></div>
  </div>
</div>
```

NG (modifier first):
```html
<div class="-primary title"></div>
```

### 13.2 Variant/State (data mode)

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

### 13.3 Variant/State (class mode)

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

### 13.4 @rel placement (examples)

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

### 13.5 Generated SCSS header (example)

```scss
@use "@styles/partials/global" as *;
@use "sass:meta";

// @assets/css/page.scss

.sample-block {
  @include meta.load-css("scss");
}
```

### 13.6 Shared section (example)

```scss
.sample-block {
  // --shared
  .icon { width: 24px; }                // No ">" required
  .caption { }                          // Direct child; ">" not required
}
```

## 14. Fallback Defaults (use only if config is missing)

- class:
  - blockCase=kebab, blockMaxWords=2, elementCase=kebab, modifierCase=kebab, modifierPrefix="-"
  - childCombinator=true
  - childNesting=true
  - rootSingle=true
  - rootFile=true
  - rootCase="preserve"
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
- keyframes:
  - sharedPrefixes=["kf-"], sharedFiles=["keyframes.scss"], actionMaxWords=3
  - blockSource="selector", blockWarnMissing=true, ignoreSkipPlacement=false

## 15. Optional Official References (absolute URLs)

These links are optional. This document is self-contained.

- https://spiracss.jp
- https://spiracss.jp/architecture/principles/
- https://spiracss.jp/architecture/layers/
- https://spiracss.jp/architecture/components/
- https://spiracss.jp/configuration/
- https://spiracss.jp/tooling/stylelint/
- https://spiracss.jp/tooling/html-cli/
