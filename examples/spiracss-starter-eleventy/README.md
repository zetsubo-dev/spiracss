# Eleventy Simple (SpiraCSS Sample)

A minimal Eleventy (11ty) sample to try SpiraCSS with WebC and plain SCSS.

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
3. `.eleventy.cjs` paths aligned with `spiracss.config.js`

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
- The About page is HTML-first so you can try the SCSS generation flow
- Layout + includes live under `src/_includes/` (WebC)

## Structure

- `src/index.webc`
  - Styled page
  - Includes `data-variant` / `data-state` / `aria-selected` examples
- `src/about.webc`
  - HTML-first workflow content
- `src/_includes/layouts/base.webc`
  - Layout with header/footer
- `src/_includes/partials/`
  - Header/Footer includes
- `src/_includes/blocks/`
  - Hero/Card blocks
- `src/assets/css/home.scss` / `src/assets/css/about.scss`
  - Page entry SCSS (page layer + `@rel` wiring)
- `src/assets/css/global.scss` / `src/assets/css/common.scss`
  - Global styles shared by all pages
- `spiracss.config.js`
  - SpiraCSS config (shared by HTML CLI / Stylelint)
- `spiracss-ai-agent-doc.md`
  - AI operation guide (rules and decision criteria)
  - If you use AI, load this document into your AI context first

## SCSS generation flow

`src/about.webc` is HTML-first and the layout wraps it, so generating from the full file in Root mode may fail.
Select `<main class="about-flow"> ... </main>` and generate from that selection.
For manual work, use the VS Code extension. For AI usage, you can base your flow on the HTML CLI.

### VS Code (manual)

1. Open `src/about.webc` and select `<main class="about-flow"> ... </main>`
2. Run `Generate SpiraCSS SCSS from Root` from the editor context menu or a shortcut
3. Save the generated SCSS (e.g., `src/assets/css/about-flow.scss`)
4. Update the parent comment to `// @assets/css/about.scss` if needed
5. Wire it from `src/assets/css/about.scss` with a placement rule and `@rel` comment
6. Cmd/Ctrl+Click `// @rel/...` in SCSS to jump to related files
7. Apply your design styles on top of the generated structure
8. If Stylelint reports errors, fix them (ask AI if needed)

## What to check

- Top page (index)
  - `data-variant` / `data-state` / `aria-selected` are separated in SCSS
  - Page-layer wiring is visible via `@rel` comments
- About page
  - SCSS can be generated from HTML-first content
