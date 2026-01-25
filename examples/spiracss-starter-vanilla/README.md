# Vite Simple (SpiraCSS Starter)

A minimal sample to try the basic SpiraCSS setup with vanilla Vite (no framework).

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
3. `vite.config.js` aliases aligned with `spiracss.config.js`

### VS Code Extensions (Install Separately)

If not installed, please install the following extensions:

- **SpiraCSS HTML to SCSS**
  - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)
  - [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-html-to-scss)
- **SpiraCSS Comment Links**
  - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)
  - [Open VSX](https://open-vsx.org/extension/spiracss/spiracss-comment-links)

## Dev Server

```bash
npm run dev
```

## Goals

- The top page is already styled, so you can verify data-mode variant/state
- The About page is HTML-only, so you can try the SCSS generation flow

## Structure

- `index.html`
  - Styled page (Vite MPA)
  - Includes examples of `data-variant` / `data-state` / `aria-*`
- `about/index.html`
  - HTML-only page (generate SCSS from here)
- `src/assets/css/home.scss` / `src/assets/css/about.scss`
  - Page entry SCSS
- `src/assets/css/common.scss`
  - Common component entry (loaded on all pages)
- `src/assets/css/global.scss`
  - Global styles shared across all pages (reset/base/utility/tokens)
- `spiracss.config.js`
  - SpiraCSS configuration (shared by HTML CLI / Stylelint)
- `spiracss-ai-agent-doc.md`
  - AI guide (rules and decision criteria)

## SCSS Generation Flow

Since `about/index.html` contains shared header/footer, generating from the entire file as Root may include unrelated blocks.
Select `<main class="about-flow"> ... </main>` to generate.
For manual work, use the VS Code extension. For AI usage, you can base your flow on the HTML CLI.

### Notes (Vanilla Vite)

- Vanilla Vite has no component system, so common parts like header/footer are duplicated in HTML in this sample.
- SCSS generation outputs to the directory where the original HTML file is located by default (common behavior for VS Code extension / `spiracss-html-to-scss`).
  - Generating from `about/index.html` outputs to `about/` (cannot directly create in `src/components/`).

### VS Code (Manual)

The VS Code extension cannot specify an output directory and always outputs next to the original HTML.

#### Recommended (for vanilla Vite): Generate first, then move

1. Open `about/index.html` and select `<main class="about-flow"> ... </main>`
2. Run `Generate SpiraCSS SCSS from Root`
3. Files like the following are generated next to `about/index.html`:
   - `about/AboutFlow.scss`
   - `about/scss/*` (and `about/scss/index.scss`)
4. Move the generated root SCSS and `scss/` directory together to `src/components/` (keep root and scss at the same level):
   - `src/components/pages/about/AboutFlow/AboutFlow.scss`
   - `src/components/pages/about/AboutFlow/scss/*`
5. Open `src/components/pages/about/AboutFlow/AboutFlow.scss` and fix the entry comment at the top if needed:
   - If it says `// @assets/css/index.scss`, change it to `// @assets/css/about.scss`
6. Wire from page entry `src/assets/css/about.scss`:
   - Add `@use "@pages/about/AboutFlow/AboutFlow";`
   - Add placement rule (example):

     ```scss
     > .about-flow {
       // @pages/about/AboutFlow/AboutFlow.scss
     }
     ```
7. Run `npm run lint:scss` and adjust according to Stylelint instructions

## Checkpoints

- Top page (`index.html`)
  - `data-variant` / `data-state` / `aria-selected` are separated in SCSS
  - Page layer wiring (`@rel` comments) is visible
- About page
  - SCSS can be generated from HTML
