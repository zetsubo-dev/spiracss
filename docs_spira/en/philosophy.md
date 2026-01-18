# SpiraCSS Design Philosophy

SpiraCSS is a CSS architecture that distills the structural characteristics of HTML/CSS into a minimal set of principles. It reduces inconsistencies in structural decisions by replacing individual intuition with clear principles. Designed for implementation with AI agents and tool-based validation, it aims to shorten development time and keep quality consistent.

Unlike utility-first approaches such as Tailwind CSS, SpiraCSS follows the lineage of BEM / SMACSS / RSCSS, expressing structure through class names and splitting files by component.

> For specific rules and code examples, treat [Design Principles](principles.md) and [Components](component.md) as the source of truth. This page focuses on the "why."

## Problems SpiraCSS solves

Throughout the history of CSS architecture, many methodologies have been proposed, such as BEM / SMACSS / OOCSS / RSCSS / ITCSS / CUBE CSS. They all tackle the shared question: how to structure CSS and keep it maintainable.

However, these approaches share a common issue:

**"Decisions about component boundaries depend on human interpretation."**

- How far does a single Block (component) extend?
- Is this element an Element, or an independent Block?
- Should layout responsibility belong to the parent or the child?
- How should relationships between components be managed?

These decisions are offered as guidelines but are ultimately left to the implementer's experience or intuition. As a result:

- The same methodology is interpreted differently across projects, and component granularity is inconsistent.
- Code reviews spend time debating whether something is a Block or an Element.
- Visual variation and state (Modifier/state classes) are hard to keep consistently separated in practice.
- Even when instructing AI to follow a methodology, decisions can drift and consistency can break.

BEM and RSCSS also recommended "1 Block = 1 file" as a core idea. But partly because tooling to offset the navigation cost of file splitting was insufficient, the practice often failed to gain traction in real projects, and only the naming conventions were widely adopted.

## SpiraCSS solutions

SpiraCSS turns structural decisions into invariants instead of interpretations. It then provides validation and operational support to keep those invariants intact during everyday implementation.

### Make structural decisions "invariants"

- **Make structure readable from naming**: A Block has two words; an Element has one (default)
- **Treat structure as repetition**: view all structure as a repetition of `Block > (Block | Element)`
- **Unify entry points**: 1 Block = 1 file (a single entry point for each component)

See [Design Principles](principles.md) for details.

### Give meaning to property placement, not just naming

Traditional CSS methodologies tend to focus on naming to convey structure, but SpiraCSS gives **structural meaning to where properties are written**.
By separating container / item / internal responsibilities, Stylelint can validate intent, so you don't need to memorize fine-grained rules.
Because the criteria are machine-checkable, the approach also aligns well with AI-assisted generation and corrections.
This principle is distilled into the one-sentence rule in [Design Principles](principles.md).

### Separate Variant / State

SpiraCSS splits traditional Modifiers into **Variant (visual variations)** and **State (interaction state)**, and clarifies responsibility and placement. By default, it uses data attributes.

- Variant: `data-variant="primary"` (base structure)
- State: `data-state="active"` / `aria-*` (`--interaction`)

See [Design Principles](principles.md) and [Components](component.md) for details.

### Decide what tools can validate

SpiraCSS treats areas where decisions tend to vary as local invariants and makes them verifiable via Stylelint / HTML lint.

- Naming (Block / Element / Utility)
- Parent-child structure (`Block > Block` / `Block > Element`)
- One root Block per file and filename alignment
- Variant / State separation and placement (data mode)
- Property placement (container / item / internal)
- Relationship links via `@rel` comments

See [Stylelint](tooling/stylelint.md), [HTML CLI](tooling/html-cli.md), and [Tooling overview](tooling/index.md) for details.

### Operational support for 1 Block = 1 file

Dart Sass modules (`@use` / `@forward`) make it easier to split styles by module. SpiraCSS assumes "1 Block = 1 file = 1 module" and reduces navigation costs with tooling.

- **`@rel` comments + Comment Links** ([Comment Links](tooling/comment-links.md)): jump between parent and child Blocks with Cmd/Ctrl-click
- **HTML to SCSS generation** ([HTML CLI](tooling/html-cli.md) / [HTML to SCSS](tooling/html-to-scss.md)): parse HTML structure and generate SCSS templates
- **Dart Sass `meta.load-css()` for child Blocks**: one line in the parent Block to aggregate child Blocks under `scss/`

### Where humans decide

Some decisions still require team agreement (exception handling, layout conventions, naming case choices, etc.). See [Guidelines](guidelines.md) for details.

## Core principles (SPIRA)

**SpiraCSS** = **S**implified **P**ractical **I**ntegrated **R**elational **A**rchitecture for **CSS**

The acronym SPIRA represents the design pillars of SpiraCSS.

### Simplified

SpiraCSS narrows SMACSS / RSCSS down to **the smallest set of principles that are practical to apply**:

- Focus only on the most fundamental HTML/CSS structure rules (hierarchy and responsibility)
- Avoid strong dependence on specific libraries or naming prefixes, so the structure remains readable over time
- Works across SPA / SSR / SSG and other frameworks
- Works with CSS Modules, `<style scoped>`, or global CSS

### Practical

**Practical companion tools** improve the development experience:

- Automatic validation with the SpiraCSS Stylelint plugin
- Auto-generation and link navigation with VS Code extensions
- CLI tools for AI-agent workflows
- 1 Block = 1 file = 1 module structure (Dart Sass assumed)

### Integrated

HTML/CSS/tools are **tightly integrated**:

- Provide a unified standard for reading structural classes: [CSS Layers](layers.md) (global / page / component) x Block / Element + Variant / State
- Apply the same structural principles across all three CSS layers
- Minimal structural rules apply regardless of component scoping or implementation style
- Learn structural thinking naturally while writing code

### Relational

Make component dependencies **explicit**:

- Link parent-child Blocks with `@rel` comments
- Clarify relationships between files
- Make it easier to understand the impact and scope of refactors
- Improve maintainability and readability

### Architecture

**Organize the overall structure with consistent rules**:

- Separation of concerns via CSS Layers (global / page / component)
- 1 Block = 1 file = 1 module mapping
- Centralized configuration with `spiracss.config.js`
- Integration across Stylelint / CLI / VS Code extensions

## Background

SpiraCSS began as an internal HTML/CSS design guideline and operational tooling (such as VS Code extensions) used for many years. It was refined to keep consistent quality across teams with mixed experience levels, from new hires to external partners to senior engineers, and to converge toward a uniform structure regardless of who writes the code.

The starting problem was that even with guidelines, "personal judgment" remained. It was not enough to "formalize existing methodologies." We returned to the question, **"What is the essential structure of HTML/CSS?"** After reviewing design methods such as [BEM](https://en.bem.info/methodology/) and [SMACSS](https://smacss.com/), the common insight was simple: **"All structure is a repetition of `Block > (Block | Element)`."**

Pushing the question further, we drew inspiration from related approaches like [RSCSS](https://rstacruz.github.io/rscss/) and [CUBE CSS](https://cube.fyi/). We realized that this simple structural rule could be validated by Stylelint and serve as a constraint when AI writes code autonomously. Based on this, we published the Stylelint plugin and part of the AI workflow, and continue to develop the plugin and AI workflow.

## Conclusion

SpiraCSS is designed to make CSS structure readable by a shared yardstick rather than individual intuition. By sharing rules and running a generate-and-validate workflow, it reduces debate and review costs while keeping quality consistent. It also serves as a training tool: newcomers learn the separation of responsibilities in HTML/CSS by following the rules.

If SpiraCSS makes it a little easier for your team to write and read CSS and improves your development experience, that is the goal.

## SpiraCSS docs
- [Design Principles](principles.md)
- [Quickstart](quickstart.md)
- [CSS Layers](layers.md)
- [Components](component.md)
- [Guidelines](guidelines.md)
- Design Philosophy

## Tools
- [Tooling overview](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint Plugin](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
