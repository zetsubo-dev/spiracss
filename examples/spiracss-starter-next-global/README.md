# Next Global (SpiraCSS Sample)

A minimal Next.js sample to try SpiraCSS with global SCSS (no CSS Modules).

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
3. `tsconfig.json` paths aligned with `spiracss.config.js`
4. `next.config.mjs` includes Sass includePaths

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
- Global class names are used (e.g. `className="hero-section"`)

## Structure

- `src/app/page.tsx`
  - Styled page
  - Includes `data-variant` / `data-state` / `aria-selected` examples
- `src/app/about/page.tsx`
  - About page wrapper for the workflow content
- `src/components/pages/about/AboutFlow/AboutFlow.tsx`
  - Workflow content to scaffold SCSS from
- `src/styles/pages/common.scss` / `src/styles/pages/home.scss`
  - Page entry SCSS (placement / wiring)
- `src/styles/globals.scss`
  - Global styles entry (loaded in RootLayout)
- `src/components/**/*.scss` + `scss/`
  - Component SCSS files and child SCSS files
- `spiracss.config.js`
  - SpiraCSS config (shared by HTML CLI / Stylelint)
- `spiracss-ai-agent-doc.md`
  - AI operation guide (rules and decision criteria)
  - If you use AI, load this document into your AI context first

## SCSS generation flow

This sample does not use CSS Modules. Keep className values as plain strings.
To avoid accidental extraction from non-style objects, `spiracss.config.js` disables member access extraction with `jsxClassBindings.memberAccessAllowlist: []`.
For manual work, use the VS Code extension. For AI usage, you can base your flow on the HTML CLI.

### VS Code (manual)

1. Open `src/components/pages/about/AboutFlow/AboutFlow.tsx` and select `<main ...> ... </main>`
2. Run `Generate SpiraCSS SCSS from Selection` from the editor context menu (right-click) or a shortcut
3. Generated files are written under `src/components/pages/about/AboutFlow/scss/`
4. Wire it from `src/styles/globals.scss` (so Next.js loads it as global SCSS), for example:
   - `@use "components/pages/about/AboutFlow/scss/index";`
5. Cmd/Ctrl+Click `// @rel/...` in SCSS to jump to related files
6. Apply your design styles on top of the generated structure
7. If Stylelint reports errors, fix them (ask AI if needed)

## What to check

- Top page (home)
  - `data-variant` / `data-state` / `aria-selected` are separated in SCSS
  - Page-layer wiring is visible via `@rel` comments
- About page
  - HTML-first structure for SCSS scaffolding
