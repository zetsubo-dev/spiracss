# Components

The component layer is the most detailed layer in SpiraCSS’s three-layer architecture. It organizes structural design with Block/Element, separation of appearance and state with Variant/State, SCSS section structure, and file management under a single set of rules.

- [File structure](#file-structure)
- [Naming conventions](#naming-conventions)
- [Parent-child rules](#parent-child-rules)
- [Variant / State](#variant--state)
- [SCSS section structure](#scss-section-structure)
- [@keyframes](#keyframes)
- [@rel comments](#rel-comments)

## File structure

**One Block per SCSS file** is the default. For the overall directory structure, see [CSS Layers](layers.md).

```text
article-card/
├── article-card.webc      # template
├── article-card.scss      # root Block
└── scss/                  # stores child Blocks
    ├── card-header.scss
    ├── card-body.scss
    └── index.scss         # aggregates child Blocks with @use
```

- **Template**: follow your framework’s naming convention (WebC/Nunjucks: kebab-case, Astro/Next.js/Nuxt: PascalCase, etc.)
- **SCSS**: a file with the same name as the Block (naming format is configurable)
- **scss/**: place child Blocks flat, and aggregate them in `index.scss`
- **Top-level**: use the root Block as the entry point, and nest other classes inside it

### Scoping child Blocks

When you call `@include meta.load-css("scss")` in the root Block, child Blocks are expanded and nested under the parent selector, so styles do not leak outside the parent Block.

Example: root Block SCSS (`article-card.scss`)

```scss
@use "sass:meta";

.article-card {
  @include meta.load-css("scss"); // expand child Blocks
}
```

By default, place child Blocks under the parent Block’s `scss/` directory and keep them within the `meta.load-css` scope.

### When you need shared code

Decide where to place it based on scope:

- **Shared classes under the same parent Block** → group them in the `--shared` section
- **Shared across multiple components on the same page** → create a page-only shared component (a new parent Block) under `components/pages/...`
- **Shared across multiple pages** → extract it under `components/parts/` (or `components/common/` for site-wide)

## Naming conventions

In SpiraCSS, clearly separate **structure (Block / Element)** from **Variant / State (variation/state)**.

### Block / Element / Utility

| Type | Naming rule | Examples |
| ---- | ----------- | -------- |
| **Block** | kebab-case, two words (default) | `.hero-container`, `.feature-list` |
| **Element** | exactly one word | `.title`, `.body` |
| **Utility** | `u-` prefix | `.u-hidden`, `.u-sr-only` |

Terminology: in this document, a “word” refers to a naming segment. In kebab-case (the default), segments are hyphen-separated. For example, `hero-container` has two words.

- A Block represents a UI component or section (i.e. a meaningful unit).
- An Element is meaningful only within the Block (do not use it outside the Block).
- A Utility is a single-purpose helper class, not part of structure (Block/Element).

**Note**: An Element is **always** one word. Even if `elementCase` is set to `camel` or `pascal`, do not use multi-word names (e.g. `bodyText` / `BodyText` are not allowed).

> Prioritize clarity and readability over brevity.  
> Note: when using `customPatterns`, the result may not match HTML placeholders (`block-box` / `element`), so verify consistency.

## Parent-child rules

The relationship between component class selectors (Block/Element) follows these rules, assuming the naming conventions above.

### Allowed structures

- `Block > Block`
- `Block > Element`

### Disallowed structures (by default)

- `Element > Block`
- `Element > Element`
- In a parent Block’s SCSS, targeting a child Block’s Elements directly, such as `> .child-block > .element`

### Exceptions (when Element > Element is allowed)

`Element > Element` is allowed only for non-layout decorative or semantic grouping, and is recommended when you need that kind of grouping (e.g. `.content > .paragraph > .emphasis > .strong`).

### Nesting depth

**Block nesting:**

- `Block > Block` is allowed, but avoid chaining three or more Blocks such as `Block > Block > Block`.
- If a “meaningful unit” appears at grandchild depth or deeper, consider promoting it into a separate Block directly under the parent Block (i.e., reorganize into `Parent Block > Child Block`).
- At the SCSS-file level, the parent Block’s SCSS should only cover itself and its immediate `> .child`. Leave grandchild selectors such as `> .child-block > .element` to the child Block’s SCSS.

**Element nesting:**

- Element chains (`Element > Element > ...`) are only allowed for the exception above (non-layout decoration/semantics).
- As a rule of thumb, keep it within four levels (`Block > Element > Element > Element > Element`).
- Decide how strictly to enforce this per team. If you go beyond 4 levels, prefer promoting to a Block or revisiting markup first.

### Hierarchy examples

Correct structure from the parent Block (`search-form.scss`)

```scss
.search-form {
  // Block (two words)
  > .field {
    // Element (one word)
  }
  > .actions-container {
    // child Block (two words)
    // Only specify placement of the child Block in this Block
    // (leave internal layout to actions-container.scss)
  }
}
```

Incorrect structure from the parent Block (`search-form.scss`)

```scss
.search-form {
  > .actions-container {
    > .button {
      // Incorrect: the parent Block (.search-form) reaches into the child Block (.actions-container)
      // and targets its Element (.button) directly
    }
  }
}
```

Correct structure from the child Block (`actions-container.scss`)

```scss
.actions-container {
  // Treat `.actions-container` as its own component (Block)
  // and centralize internal layout/skin here

  > .button {
    // Element (one word)
  }
}
```

At its core, a component is expressed entirely as a repetition of `Block > (Block | Element)`. By constraining even the most complex UIs to this simple pattern, structure is less likely to bloat or collapse.

## Variant / State

### Role breakdown

- **Structure (Block / Element)**: expressed with classes (as before)
- **Variant**: static appearance differences (size/tone/layout, etc.)
- **State**: dynamic toggles (open/closed/loading/selected, etc.)

**Important**: whether JS toggles it is not a classification criterion. Decide by meaning.

### Expression modes

Variant/State can be expressed with **data mode** (default/recommended) or **class mode**.  
Choose per project/team policy in `spiracss.config.js`.

#### Data mode (default)

| Type | Purpose | HTML | SCSS | Section placement |
| ---- | ------- | ---- | ---- | ----------------- |
| **Variant** | visual variations | `data-variant="primary"` | `&[data-variant="primary"]` | base structure (as a rule) |
| **State** | interaction state | `data-state="active"` | `&[data-state="active"]` | `--interaction` |
| **ARIA state** | accessibility state | `aria-expanded="true"` | `&[aria-expanded="true"]` | `--interaction` |

> This separation removes ambiguity (“is this a visual variant or an interaction state?”) and makes default placement in SCSS explicit.

**Placement rules:**
- As a rule, put `data-variant` in the base structure section. You may put initial interaction values in the `--interaction` section.
- Put `data-state` / `aria-*` in the `--interaction` section.
- If state changes the appearance, implement it on the State side (not Variant).

#### Class mode

| Type | Naming rule | Examples |
| ---- | ----------- | -------- |
| **Modifier** | prefix `-` (kebab-case, 1–2 words) | `.-primary`, `.-active` |

> In class mode, Variant and State are both Modifiers, so you cannot distinguish them from class names alone. SCSS section placement requires the implementer’s judgment.  
> Use the same criteria as data mode: state-driven changes go to `--interaction`, and static appearance differences go to base structure.

### Data attribute naming and value rules

| Type | Default attribute | Value format | Example |
| ---- | ----------------- | ------------ | ------- |
| **Variant** | `data-variant` | kebab-case, 1–2 words | `data-variant="primary-dark"` |
| **State** | `data-state` | kebab-case, 1–2 words | `data-state="loading"` |

- You can split Variant into multiple attributes (e.g. combine `data-variant="primary"` and `data-size="large"`).
- You can also configure modes separately (e.g. Variant=data, State=class).

When set in config, it affects both Stylelint validation and CLI generation.

### Configuration example

```js
// spiracss.config.js
module.exports = {
  selectorPolicy: {
    valueNaming: { case: 'kebab', maxWords: 2 },
    variant: {
      mode: 'class', // Variant uses class mode
    },
    state: {
      mode: 'data', // State uses data mode
      dataKey: 'data-state',
      ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
    }
  }
}
```

## SCSS section structure

Each Block’s SCSS file generally arranges sections in this order:

1. **Base structure section**: the Block itself and layout/skin for `Block > Block` / `Block > Element` + Variant
2. **the `--shared` section**: local shared classes used within the Block tree (only when needed)
3. **the `--interaction` section**: state changes and interaction styles such as hover/focus (only when needed)

Place the `--shared` and `--interaction` sections directly under the root Block (wrapping with `@layer` / `@supports` / `@media` / `@container` / `@scope` is allowed).

> Stylelint section marker comments (`// --shared` / `// --interaction`) can be changed in `spiracss.config.js`.

### Example: overall SCSS structure

```scss
.sample-block {
  // Base structure ------------------------------
  display: block;

  &[data-variant="primary"] { ... } // Variant is usually base structure (initial interaction values may be in `--interaction`)

  > .sample-header {
    // layout/skin for a child Block/Element
  }

  > .sample-body {
    // layout/skin for a child Block/Element
  }

  // --shared ------------------------------------
  .btn {
    // a button-like shared style used only under this Block
  }

  // --interaction -------------------------------
  @at-root & {
    &:hover { ... }
    &[data-state="active"] { ... }  // State goes in the `--interaction` section
    &[aria-expanded="true"] { ... } // ARIA states also go in `--interaction`
  }
}
```

### 1. Base structure section

This section explains what belongs in the base structure section.

#### Property placement cheat sheet

| Category | Typical properties | Where to write |
| -------- | ------------------ | -------------- |
| Container-side layout | `display:flex/grid`, `gap`, `justify-*`, `align-*`, `grid-template-*` | on the Block itself (e.g. `.sample-block { ... }`) |
| Item-side layout as seen from the parent | `margin-top` (vertical spacing), parent-based `width/height/max-*`, `flex`, `order`, `align-self` | on the parent Block’s immediate child rule (e.g. `.sample-block > .child { ... }`) |
| Internal layout inside a child Block | `text-align`, `line-height`, `padding`, internal `gap` inside a child | on the child Block/Element itself |

#### Decision criteria

When unsure, decide based on “whose responsibility is this property?”

- **Container-side**: how to arrange immediate children (flex/grid, `gap`, etc.) → write on the Block itself
- **Item-side**: change a child’s size/position/spacing due to the parent’s needs → write on the parent’s `> .child`
- **Child gets complex**: the child starts “arranging its own children” → extract it as a new Block

**Note on `:global(...)`:** The linter strips global-only selectors and validates only the remaining local portion.
If the rightmost target becomes global (e.g. `.block :global(.foo)` / `.block:is(:global(.foo))`), that selector is treated as out-of-scope and placement checks are skipped.
Global-only selectors are out-of-scope, so `@at-root` / `@extend` restrictions do not apply.
If a selector becomes ambiguous after removing `:global(...)` (e.g., some pseudo selectors lose their selector list),
placement checks are skipped for that rule, but `@at-root` / `@extend` restrictions still apply.

**Note on placement approximations:** Placement checks use a selector “family” heuristic.
Variant/state *values* are not distinguished, and `@media` / `@supports` / `@container` / `@layer` wrappers are treated
as the same context. Extremely complex selectors (or selector explosions from deep nesting) are skipped to avoid false
positives and performance issues.

### 2. --shared section

The `--shared` section is where you collect shared classes reused only within the Block’s tree (including descendants).

```scss
// --shared ----------------------------------------
```

**Target:**
- classes that are meaningful only within the Block tree and need to be reused across multiple places under the same Block

**Writing rules:**
- In the `--shared` section, you may target any descendant (not limited to direct children), and `>` is not required.
- The structure rules themselves (Block/Element relationships) are the same as the base structure rules.
- Place the `--shared` section directly under the root Block (do not put it inside child rules). Wrapping with `@layer` / `@supports` / `@media` / `@container` / `@scope` is allowed.

<a id="interaction-section"></a>
### 3. --interaction section

The `--interaction` section is where you collect styles related to state changes and interactions such as `:hover` / `:focus-visible`.

```scss
// --interaction -----------------------------------
@at-root & {
  // ...
}
```

**Target:**
- dynamically toggled states (`data-state` / `aria-*`, or Modifiers in class mode)
- style changes based on user interaction (e.g. `:hover`, `:focus-visible`, `:active`)
- animation/transition related declarations (including initial values)

**Writing rules:**
- As a rule, put `data-variant` in the base structure section. You may put initial interaction values in the `--interaction` section.
- Put `data-state` / `aria-*` in the `--interaction` section.
- Keep `transition` / `transition-*` / `animation` / `animation-*` inside the interaction section (`transition-*` includes `transition-property` / `transition-duration` / `transition-delay` / `transition-timing-function` / `transition-behavior`).
- `transition` must list target properties explicitly (no `transition: all`, `transition-property: all`, omitted properties, `var(...)`-only values, or keywords like `inherit` / `initial` / `unset` / `revert` / `revert-layer`).
- `transition: none` / `transition-property: none` are not allowed (use a tiny `transition-duration` instead).
- Do not declare properties listed in `transition` outside the interaction section for the same Block/Element (pseudo-elements are separate; initial values belong in interaction).
- Place the `--interaction` section directly under the root Block (do not put it inside child rules). Wrapping with `@layer` / `@supports` / `@media` / `@container` / `@scope` is allowed.
- Write pseudo-classes / pseudo-elements by nesting them under the target selector (avoid flat selectors like `> .child:hover`; use `> .child { &:hover { ... } }`).
- In the `--interaction` section, deeper selectors may be needed depending on state; there is no fixed maximum selector depth.
- In the `--interaction` section, Block/Element parent-child constraints are not applied (a parent may directly target grandchild Blocks/Elements if needed).

**Example:**

```scss
.button-container {
  // basic layout/style (static)
  display: inline-block;
  padding: 10px 20px;
  background: #fff;

  // --interaction -----------------------------------
  @at-root & {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;

    > .icon {
      &:hover {
        opacity: 0.8;
      }
    }

    &[data-state="visible"] {
      opacity: 1;
      transform: translateY(0);
    }

    &:hover {
      transform: translateY(-2px);
    }

    &[aria-disabled="true"] {
      opacity: 0.5;
      pointer-events: none;
    }
  }
}
```

## @keyframes

`@keyframes` is **global by CSS spec**. To avoid collisions, include the Block name in the keyframes name and keep placement rules consistent.

**Placement rules:**
- Place `@keyframes` at the **root level** (not inside @media/@layer/etc).
- Group `@keyframes` at the **end of the file** (only comments/blank lines may follow).

**Naming rules:**
- `{block}-{action}` or `{block}-{element}-{action}`
- Block/Element casing follows `classStructure.naming`
- Element names are allowed only when they exist in the same file.
- Action uses `blockCase` and must be **1–3 words** (configurable via `actionMaxWords`)
- The separator between block and action is always `-` (e.g. `cardList-fadeIn` / `CardList-fadeIn`).

**Shared animations:**
- Use a prefix such as `kf-` and centralize in `keyframes.scss`
- See [CSS Layers](layers.md) for the global layer placement.
- Prefer importing via an alias like `@styles/partials/keyframes`

Example:

```scss
.sample-block {}

@keyframes sample-block-fade-in {
  to {
    opacity: 1;
  }
}
```

## @rel comments

Declare parent-child relationships between Blocks with comments, so you can navigate across files quickly.  
Link comments (such as `@rel`) let you jump to related files with a single click. Without them, you must trace references manually, which increases workflow overhead.  
When generating SCSS, the VS Code extension / CLI inserts appropriate comment paths automatically based on the HTML structure.

Example: parent Block SCSS (`components/home-section/home-section.scss`)

```scss
@use "sass:meta";

// @assets/css/home.scss          ← page entry that uses this file

.home-section {
  @include meta.load-css("scss");

  > .home-hero {
    // @rel/scss/home-hero.scss   ← link to a child Block
  }
}
```

Example: child Block SCSS (`components/home-section/scss/home-hero.scss`)

```scss
// @rel/../home-section.scss      ← link to the parent Block

.home-hero {
  // ...
}
```

Example: page entry SCSS (`assets/css/home.scss`)

```scss
.main-container {
  > .home-section {
    // @components/home-section/home-section.scss  ← link to a Block
  }
}
```

**Rules:**

- **Parent → child**: in the parent Block’s `> .child` rule, put a link to the child Block as the first comment
- **Child → parent**: near the top of the child Block file, put a link to the parent Block
- **Parent → page**: near the top of the parent Block file, put a link to the page entry
  - On the page entry side, writing `@components/...` inside the `> .block` rule enables round-trip navigation

> Alias resolution (e.g. `@components`) is handled by `aliasRoots` in `spiracss.config.js`. Whether link comments are required/optional and whether their paths are validated are configured under `stylelint.relComments` (= `spiracss/rel-comments`).

## Next steps

→ [Guidelines](guidelines.md): recommended rules not enforced by Stylelint

## SpiraCSS docs
- [Design Principles](principles.md)
- [Quickstart](quickstart.md)
- [CSS Layers](layers.md)
- Components
- [Guidelines](guidelines.md)
- [Design Philosophy](philosophy.md)

## Tools
- [Tooling overview](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint Plugin](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
