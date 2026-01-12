# SpiraCSS HTML to SCSS

A VS Code extension that automatically generates SCSS files from HTML or template fragments according to the [SpiraCSS Design Principles](../principles.md).
This page covers VS Code extension usage as well as the conversion rules shared with the CLI.

## VS Code Extension Usage

### Install

Search for `SpiraCSS HTML to SCSS` in the VS Code Marketplace and install it.

→ [Install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)

### Commands

| Command | Keybinding | Description |
|-----------------------------------|-------------|------|
| Generate SpiraCSS SCSS from Root | `Cmd+Ctrl+A` | Generate multiple SCSS files from the root element |
| Generate SpiraCSS SCSS from Selection | `Cmd+Ctrl+S` | Generate SCSS files from the selection |
| Insert SpiraCSS placeholders (block-box / element) | `Cmd+Ctrl+D` | Insert placeholder classes into HTML (no SCSS generation) |

### Root mode

1. Select a range that includes the root Block element
2. Run `Cmd+Ctrl+A` or choose the command from the context menu
3. Generates the root SCSS in the same folder as the current file, and child SCSS files under `childScssDir/` (default: `scss/`)

**Note**: Root mode treats a single element in the selection as the root and generates SCSS for the root and its descendants. If that element has no `class`, generation fails.

### Selection mode

1. Select the Block elements you want to convert to SCSS
2. Run `Cmd+Ctrl+S` or choose the command from the context menu
3. Generates SCSS for each Block under `childScssDir/` (default: `scss/`)

**Note**: If the selection contains multiple Blocks, each one is generated. If no top-level elements have a `class` attribute, an error is raised. If no top-level elements qualify as Blocks, nothing is generated (no error).

### Insert placeholders

Adds placeholder classes to HTML without generating SCSS. Useful for aligning the structure before naming classes.

1. Select a range that includes the element you want to treat as the root
2. Run `Cmd+Ctrl+D` or choose the command from the context menu
3. Recursively walks all descendants and normalizes them into a Block > Element structure:
   - Elements with children: prepend a Block placeholder
   - Leaf elements: prepend an Element placeholder
   - Elements that already have a Block name: keep and process descendants
   - Elements with an Element name that have children: convert to Block form (e.g. `title` -> `title-box`)

**Note**: For the root element, Element-to-Block conversion is not performed; a Block placeholder is prepended (e.g. `block-box title`, even for names that are neither Block nor Element).

Placeholder names change based on `blockCase` / `elementCase` (configured independently):

| Case | Block placeholder | Element placeholder |
|------|-------------------|---------------------|
| `kebab` (default) | `block-box` | `element` |
| `camel` | `blockBox` | `element` |
| `pascal` | `BlockBox` | `Element` |
| `snake` | `block_box` | `element` |

The output attribute follows `htmlFormat.classAttribute` in `spiracss.config.js` (default: `class`). Set `htmlFormat.classAttribute` to `className` if you want `className` output.

### Configuration

You can customize behavior in `spiracss.config.js` at the project root. See [spiracss-config.md](spiracss-config.md) and [spiracss.config.example.js](spiracss.config.example.js) for full settings. If `package.json` has `"type": "module"`, use `export default`.

## Conversion spec (shared with CLI)

### Conversion example

```html
<!-- Selected HTML -->
<section class="hero-section">
  <h1 class="title">Welcome</h1>
  <p class="body">Introduction text...</p>
  <div class="feature-card">
    <h2 class="heading">Feature</h2>
  </div>
  <div class="cta-box">
    <a class="link" href="#">Learn more</a>
  </div>
</section>
```

Generates SpiraCSS-style SCSS:

**hero-section.scss** (root Block):
```scss
@use "@styles/partials/global" as *;
@use "sass:meta";

// @assets/css/index.scss

.hero-section {
  @include meta.load-css("scss");

  @include breakpoint-up(md) {
    // layout mixin
  }

  > .title {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }

  > .body {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }

  > .feature-card {
    // @rel/scss/feature-card.scss
    @include breakpoint-up(md) {
      // child component layout
    }
  }

  > .cta-box {
    // @rel/scss/cta-box.scss
    @include breakpoint-up(md) {
      // child component layout
    }
  }

  // --shared ----------------------------------------

  // --interaction -----------------------------------
  // @at-root & {
  // }
}
```

**scss/feature-card.scss** (child Block):
```scss
@use "@styles/partials/global" as *;

// @rel/../hero-section.scss

.feature-card {
  @include breakpoint-up(md) {
    // layout mixin
  }

  > .heading {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }

  // --shared ----------------------------------------

  // --interaction -----------------------------------
  // @at-root & {
  // }
}
```

**scss/cta-box.scss** (child Block):
```scss
@use "@styles/partials/global" as *;

// @rel/../hero-section.scss

.cta-box {
  @include breakpoint-up(md) {
    // layout mixin
  }

  > .link {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }

  // --shared ----------------------------------------

  // --interaction -----------------------------------
  // @at-root & {
  // }
}
```

**scss/index.scss** (child Block index file):
```scss
@use "cta-box";
@use "feature-card";
```

```text
your-component/
├─ hero-section.scss      -> root Block
├─ scss/
│   ├─ cta-box.scss       -> child Block
│   ├─ feature-card.scss  -> child Block
│   └─ index.scss         -> auto-merged via @use
└─ your-template.html
```

### Supported templates

**Note**: This section describes **SCSS generation**. For placeholder insertion, see the limitations below.

| Template | Support |
|--------------|----------|
| Plain HTML | Fully supported |
| Astro | Frontmatter removed automatically |
| EJS | `<% ... %>` removed automatically |
| Nunjucks | `{{ }}` / `{% %}` / `{# #}` removed automatically |
| JSX | Extracts static classes from `class` / `className` |
| Vue / Svelte | Removes attributes like `v-*` / `:prop` (in some cases, `v-bind:class` may leave `:class` behind) |

Template syntax is stripped using regular expressions.

- `<%...%>` (EJS)
- `{{...}}` / `{%...%}` / `{#...#}` (Nunjucks)
- JSX comments `{/*...*/}`
- JSX fragments `<>...</>`
- `<script>...</script>` / `<style>...</style>` blocks
- `dangerouslySetInnerHTML` attributes
- attribute spreads like `{...foo}`
- template literals `${...}`

Generic `{...}` patterns are not removed, and static class names are extracted from `class` / `className`.

### Block/Element detection

The **first token** in the class attribute is treated as the base class. It is treated as a Block only when the first token matches `blockCase` (or `customPatterns.block`). Put the class you want to treat as the Block/Element first.

| `blockCase` | Block examples | `elementCase` | Element examples |
|-------------|---------------|---------------|------------------|
| `kebab` (default) | `hero-section`, `feature-card` | `kebab` (default) | `title`, `body` |
| `camel` | `heroSection`, `featureCard` | `camel` | `title`, `body` |
| `pascal` | `HeroSection`, `FeatureCard` | `pascal` | `Title`, `Body` |
| `snake` | `hero_section`, `feature_card` | `snake` | `title`, `body` |

**Note**: Element names are **always a single word**. `elementCase=camel` allows only a single lowercase word (e.g. `title`), and `elementCase=pascal` allows only a single capitalized word (e.g. `Title`); names like `bodyText` / `BodyText` that contain multiple words are not allowed. If you set `customPatterns`, those patterns take priority; ensure placeholders (`block-box` / `element`) still match your naming rules. Classes starting with `-`, `_`, or `u-` are treated as Modifier/Utility and cannot be base classes (even if they match `customPatterns`).

### Limitations

#### Placeholder insertion

The **Insert SpiraCSS placeholders** command does not apply to HTML that includes template syntax (EJS `<% %>`, Nunjucks `{{ }}` / `{% %}` / `{# #}`, Astro frontmatter, etc.). These constructs can be broken by HTML parsing, so use only static HTML fragments.

#### Dynamic classes

- Static classes inside Vue/Svelte `:class` bindings are not extracted (place them in `class="..."` instead). In some cases, `v-bind:class` may leave `:class` behind.
- Dynamically appearing class names are not tracked
- JSX `class` / `className` are processed only when they are **string or template literals**. Non-literal bindings like `className={styles.foo}` are stripped during SCSS generation, and placeholder insertion skips the entire HTML.
- Non-literal `class={styles.foo}` is unsupported; SCSS generation cannot resolve a base class (no output), and placeholder insertion skips the entire HTML.

## Related tools
### Tools
- [SpiraCSS Stylelint Plugin](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- SpiraCSS HTML to SCSS

### Configuration
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS docs
- [Design Principles](../principles.md)
- [Quickstart](../quickstart.md)
- [CSS Layers](../layers.md)
- [Components](../component.md)
- [Guidelines](../guidelines.md)
- [Design Philosophy](../philosophy.md)
