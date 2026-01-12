# Fixtures

Template snippets used to validate SpiraCSS HTML-to-SCSS generation and HTML structure checks.

## Contents

- `html/sample-box.html` ... Plain HTML baseline.
- `jsx/sample-box.jsx` ... React/Next-style; includes template literals, fragments, and conditional rendering.
- `astro/sample-box.astro` ... Astro front-matter (`--- ... ---`) + JSX-like syntax.
- `ejs/sample-box.ejs` ... EJS `<% ... %>` syntax.
- `nunjucks/sample-box.njk` ... `{{ ... }}` / `{% ... %}` / `{# ... #}` syntax.
- `svelte/sample-box.svelte` ... Svelte `{#if}` / `bind:` / `on:` directives.
- `vue/sample-box.vue` ... Vue `v-*` / `:prop` / `@event` directives.
- `webc/sample-box.webc` ... WebC template syntax.

## Expected outputs

Expected SCSS outputs for `html/sample-box.html` are stored in `html/sample-box.scss` and `html/scss/*.scss`.
Automated tests compare generated SCSS against these files to detect regressions.
