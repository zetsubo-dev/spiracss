# Astro Simple (SpiraCSS Sample)

A minimal sample project to try SpiraCSS with a simple structure.

## Requirements

- Node.js 20+ (recommended)

## Setup

```bash
npm install
```

## Initial setup

The following settings are already configured in this sample:

1. `spiracss.config.js` (aliasRoots / generator / selectorPolicy)
2. `stylelint.config.js` with `@spiracss/stylelint-plugin` enabled
3. `astro.config.mjs` aliases aligned with `spiracss.config.js`

### VS Code Extensions (Install Separately)

If not installed, please install the following extensions:

- **SpiraCSS HTML to SCSS**
  - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)
  - [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-html-to-scss)
- **SpiraCSS Comment Links**
  - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)
  - [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-comment-links)

## Dev server

```bash
npm run dev
```

## Goals

- The top page is already styled and shows data-mode variants/states
- The About page is HTML-only so you can try the SCSS generation flow

## Structure

- `src/pages/index.astro`
  - Styled page
  - Includes `data-variant` / `data-state` / `aria-*` examples
- `src/pages/about.astro`
  - HTML only (SCSS is generated from it)
- `src/assets/css/home.scss` / `src/assets/css/about.scss`
  - Page entry SCSS
- `src/assets/css/common.scss`
  - Common components entry (loaded in BaseLayout)
- `src/assets/css/global.scss`
  - Global styles shared by all pages (loaded in BaseLayout)
- `spiracss.config.js`
  - SpiraCSS config (shared by HTML CLI / Stylelint)
- `spiracss-ai-agent-doc.md`
  - AI operation guide (rules and decision criteria)
  - If you use AI, load this document into your AI context first

## SCSS generation flow

`src/pages/about.astro` starts with `<BaseLayout>`, so generating from the full file in Root mode will fail.
Select `<main class="about-flow"> ... </main>` and generate from that selection.
For manual work, use the VS Code extension. For AI usage, you can base your flow on the HTML CLI.

### VS Code (manual)

1. Open `src/pages/about.astro` and select `<main class="about-flow"> ... </main>`
2. Run `Generate SpiraCSS SCSS from Root` from the editor context menu or a shortcut
3. Add the generated SCSS to `src/assets/css/about.scss` with `@use`
4. If the generated comment is `// @assets/css/index.scss`, change it to `about.scss`
5. Cmd/Ctrl+Click `// @rel/...` in SCSS to jump to related files
6. Apply your design styles on top of the generated SCSS
7. If Stylelint reports errors, fix them (ask AI if needed, and check the links in the error message for the reason)

## What to check

- Top page (index)
  - `data-variant` / `data-state` / `aria-selected` are separated in SCSS
  - Page-layer wiring is visible via `@rel` comments
- About page
  - SCSS can be generated from HTML only
