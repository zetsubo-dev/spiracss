# CSS Layers

Split project-wide CSS into the following three layers.

```text
src/
├── styles/                         # Global layer
│   └── partials/
│       ├── global/
│       │   ├── config.scss
│       │   ├── function.scss
│       │   ├── index.scss
│       │   └── mixin.scss
│       ├── base.scss
│       ├── keyframes.scss
│       ├── print.scss
│       ├── reset.scss
│       ├── utilities.scss
│       └── variables.scss
├── components/                     # Component layer
│   ├── common/                     # Shared across the entire site
│   │   └── site-header/
│   │       └── site-header.scss
│   ├── parts/                      # Shared across multiple pages
│   │   └── hero-banner/
│   │       └── hero-banner.scss
│   └── pages/                      # Page-specific
│       ├── home/
│       │   └── home-hero/
│       │       └── home-hero.scss
│       └── about/
│           └── about-intro/
│               └── about-intro.scss
└── assets/
    └── css/                        # Page layer
        ├── home.scss
        └── about.scss
```

## Global Layer (Base / Layout / Utilities)

Responsible for site-wide typography, colors, resets, and utility classes.

### global/config.scss / variables.scss

**global/config.scss**: manages shared “configuration values” for the site, such as breakpoints and common base values.

**variables.scss**: centralizes design values such as color palettes, typography, and spacing.

> **Workflow rule**: When you need a new design value, add it to `global/config.scss` or `variables.scss` before using it. Do not hardcode values directly.

### global/function.scss / global/mixin.scss

**global/function.scss**: collects numeric conversion utility functions used across multiple components.

Examples:

- a function to scale sizes based on viewport width
- functions for fluid typography
- functions to derive tracking/line-height from design values

**global/mixin.scss**: defines general-purpose mixins for breakpoints and layout.

- a mixin that generates media queries from breakpoint names/values
- shorthand mixins that bundle commonly used typography settings

### base.scss / print.scss / reset.scss

**base.scss**: defines baseline styles for common elements (headings, paragraphs, etc.).  
**print.scss**: defines baseline styles for print output.  
**reset.scss**: defines resets to normalize browser differences.

### global/index.scss

**global/index.scss**: the entry file for `@use "@styles/partials/global"` that gathers the `global/` partials.

### utilities.scss

Sparingly define **single-purpose utility classes that do not depend on structure or skin**. Limit additions to the minimum set of utilities reused across the site; avoid turning styles used only within a component into utilities.

For typography/text helpers, place only single-purpose helpers that do not depend on a particular Block (e.g. font-family switch, visually-hidden helper) in `utilities.scss`.

#### Naming rules (utilities only)

- Utility classes always start with the `u-` prefix (e.g. `.u-hidden`, `.u-sr-only`).
- This prefix clearly distinguishes “structural classes (Block/Element) and class-mode Modifiers” from utility classes.
- Utility classes starting with `.u-*` are treated as a separate category from Block/Element (and class-mode Modifiers). **Including `u-` in `allowExternalPrefixes` to allow standalone utilities is the recommended practice**. Strict constraints like "two words / one word" apply only to structural classes; utilities are treated as an auxiliary layer.

Examples:

- `.u-hidden` and variants (e.g. breakpoint-specific hiding)
- text utilities such as `.u-sr-only`
- the minimum helper classes needed project-wide

### keyframes.scss

`@keyframes` are global by CSS spec. Centralize shared animations in `styles/partials/keyframes.scss` and use a prefix such as `kf-`.  
Place `@keyframes` at the root level only (not inside @media/@layer/etc).  
Keep this file keyframes-only, or group `@keyframes` at the end of the file (only comments/blank lines may follow).

---

## Page Layer (page entry CSS)

A thin layer composed of per-page entry SCSS (e.g. `assets/css/home.scss`, `assets/css/about.scss`). In each file, write only the placement of imported components and page-specific appearance inside the page’s root class (e.g. `.main-container`).

### Typical contents and example

A page entry typically includes:

1. **Import components used on the page** (load them with `@use`)
2. **Page-wide styles** (background, fonts, container max width, etc.)
3. **Placement/layout adjustments for child Blocks** (e.g. `> .hero-container { margin-top: ... }`)
4. **Child Block references** (use `// @components/...` comments to declare which Blocks are used)

**Example:**

```scss
// assets/css/home.scss
@use "@styles/partials/global" as *;

// Load components used on this page
@use "@components/hero/hero-container";
@use "@components/feature/feature-container";
@use "@components/cta/cta-container";

.main-container {
  background: linear-gradient(to bottom, #f0f0f0, #ffffff);

  > .hero-container {
    // @components/hero/hero-container.scss
    margin-top: 0; // no margin at the very top of the page
  }

  > .feature-container {
    // @components/feature/feature-container.scss
    margin-top: 80px;
  }

  > .cta-container {
    // @components/cta/cta-container.scss
    margin-top: 120px;
  }
}
```

#### What a page entry does / does not do

- Does: imports components with `@use`, then decides the ordering and page-specific spacing between child components inside the page root (e.g. `.main-container`).
- Does not: define internal structure/skin/internal layout of each component. That is the responsibility of the component layer’s SCSS; the page layer should stop at “which components are placed in what order and with what spacing”.

#### Sharing page structures

- If page structures/adjustments repeat, extract that structure itself as a shared component in the component layer (e.g. a `.standard-layout`, `.two-column` under `components/parts/**`), and reuse it via `@use` from page entry CSS.
- Keep the page layer as an entry point that declares “what components go where on this page”, and avoid growing page-specific layout components that bloat structure.

> **Note (one Block per file)**  
> This principle applies to shared components. For page-layer root classes (like `.main-container`), keep them entirely within the page entry SCSS and do not create a page-specific `scss/` directory per page.

---

## Component Layer

Organize rules consistently for structural design with Block/Element, separation of Variant/State, SCSS section structure, and file management.

- **Block (two words)**: the component itself (e.g. `.hero-container`)
- **Element (one word)**: an element within a Block (e.g. `.title`)
- **Variant / State**: expressed via data attributes (default) or class mode
- **One Block per file**: each Block maps to one SCSS file
- **@keyframes**: component-specific keyframes go at the root level and end of each component SCSS

See [Components](component.md) for details.

---

## Next steps

→ [Components](component.md): naming, parent-child rules, Variant/State, SCSS, file structure

## SpiraCSS docs
- [Design Principles](principles.md)
- [Quickstart](quickstart.md)
- CSS Layers
- [Components](component.md)
- [Guidelines](guidelines.md)
- [Design Philosophy](philosophy.md)

## Tools
- [Tooling overview](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint Plugin](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
