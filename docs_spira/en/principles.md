# SpiraCSS Design Principles

SpiraCSS is a CSS architecture that distills the structural characteristics of HTML/CSS into a minimal set of principles. It reduces inconsistencies in structural decisions that are common in CSS design by replacing personal intuition with clear principles. It is designed for AI-assisted implementation and tool-based validation to shorten development time and keep quality consistent.

This page is the entry point to SpiraCSS. It is a quick reference that summarizes only the key points of the **default practice**. For exceptions, configuration, and detailed code examples, treat the dedicated documents as the source of truth.

## Overview

### CSS Layers

Split project-wide CSS into three layers.

| Layer | Role | Examples |
| ----- | ---- | -------- |
| **Global layer** | Site-wide values, functions, mixins, utilities | `variables.scss`, `utilities.scss` |
| **Page layer** | Per-page entry CSS (component placement) | `home.scss`, `about.scss` |
| **Component layer** | Component design with Block/Element + Variant/State | `hero-container.scss` |

### Components

1. **A Block has two words; an Element has one** — you can determine structure from the class name alone
2. **By default, represent Variant/State using attributes** — `data-variant` / `data-state` (State also includes ARIA states; the allowlist follows [spiracss.config.js](tooling/spiracss-config.md))
3. **Build all structure by repeating `Block > (Block | Element)`** — keep it predictable
4. **One Block per file** — keep each Block’s entry point in one place

#### 1. Naming (Block / Element / Utility)

Separate structural classes (Block/Element) from utilities (`u-`).

| Type | Rule | Examples |
| ---- | ---- | -------- |
| **Block** | Two words (default; separator is configurable) | `.hero-container`, `.card-list` |
| **Element** | Exactly one word | `.title`, `.body` |
| **Utility** | `u-` prefix | `.u-hidden`, `.u-sr-only` |

Terminology: in this document, a "word" refers to a naming segment. In kebab-case (the default), segments are hyphen-separated. For example, `hero-container` has two words.

Note: An Element is **always** one word (see [Components](component.md) for details).

#### 2. Variant / State

In **data mode** (default), represent Variant with `data-variant` and State with `data-state` to separate concerns between appearance and state. ARIA states are also treated as State; the allowlist follows [spiracss.config.js](tooling/spiracss-config.md). You can change the expression mode and naming rules there as well.

| Type | HTML | SCSS |
| ---- | ---- | ---- |
| **Variant** | `data-variant="primary"` | `&[data-variant="primary"]` |
| **State** | `data-state="active"` | `&[data-state="active"]` |
| **ARIA state** | `aria-expanded="true"` | `&[aria-expanded="true"]` |

**Default naming**: values are kebab-case, 1–2 words (e.g. `data-variant="primary-dark"`). ARIA attribute values are out of scope for validation.

**Placement rules:**
- As a rule, put `data-variant` in the base structure section. You may put initial interaction values in `--interaction`.
- Put `data-state` and ARIA states in the interaction section.
- If state changes the appearance, implement it on the State side.

Note: The default is data mode, but you can choose class mode or hybrid per project policy (see [Components](component.md) / [spiracss.config.js](tooling/spiracss-config.md)).

#### 3. Structure rules (parent-child)

SpiraCSS assumes that **Blocks define structure (hierarchy)**. Elements are parts of a Block and do not become structural parents. If you need nesting, extract a child Block.

- **Allowed**: `Block > Block`, `Block > Element`
- **Disallowed**: `Element > Block`, `Element > Element` (exception: only for non-layout decorative/semantic purposes)
- In the base structure section, selectors that express “structure” should generally use the child combinator `>` one level at a time (this can be relaxed in `shared` / `interaction` depending on intent)

#### 4. Files (one Block per file)

- Each Block maps to one SCSS file.
- Each SCSS file defines exactly one Block with the same name as the file.
- If you use Stylelint, the default rules validate “one file, one root Block” (installation/configuration: treat [Stylelint](tooling/stylelint.md) as the source of truth).
- Put child Blocks under `scss/` and load them from the root Block with `meta.load-css()` (default).
- Use link comments (`@assets` / `@rel`) to make related files navigable (default; see [Components](component.md)).

### SCSS Section Structure

SCSS is generally organized into these three sections (use `--shared` / `--interaction` only when needed):

- **Base structure**: Block structure + Variant
- **`--shared`**: local shared classes under the Block (only when needed)
- **`--interaction`**: State / hover / ARIA states, plus transition/animation-related declarations (only when needed)

See [Components](component.md) for details, including writing rules and code examples.

### Configuration and tooling

Standardize your workflow with a shared config ([spiracss.config.js](tooling/spiracss-config.md)) and tools. For installation and configuration, see [Tooling](tooling/index.md).

- **Generate**: automate tedious parts (e.g. `@rel` comments and structural SCSS) with CLIs / VS Code extensions
- **Validate**: Stylelint detects violations with the same criteria for both humans and AI
- **Customize via config**: adjust naming, comment formats, validation strength, etc. in [spiracss.config.js](tooling/spiracss-config.md) to match project/team policy

Because generation and validation both read the same config file, changing policy in config keeps tools aligned. You can still hand-author styles, but the architecture is especially compatible with a “generate and validate” workflow.

## Next steps

→ [Quickstart](quickstart.md): the shortest path to get started

## SpiraCSS docs
- Design Principles
- [Quickstart](quickstart.md)
- [CSS Layers](layers.md)
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
