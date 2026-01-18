# SpiraCSS HTML CLI

A CLI tool that uses the same logic as the VS Code extension and is suitable for CI/CD and scripts.
For parsing rules and template-handling details, see [SpiraCSS HTML to SCSS](html-to-scss.md).

## Install

```bash
yarn add -D @spiracss/html-cli
# or
npm install -D @spiracss/html-cli
```

## Commands

| Command | Description |
| --- | --- |
| `spiracss-html-to-scss` | Generate SCSS from HTML |
| `spiracss-html-lint` | Validate HTML structure against SpiraCSS rules |
| `spiracss-html-format` | Insert placeholder classes (defaults: `block-box` / `element`) |

## spiracss-html-to-scss

Generates SCSS files from HTML files or templates. Runs structure linting by default and exits on errors (use `--ignore-structure-errors` to continue).

### Basic usage

```bash
# Root mode (generate from the root element)
npx spiracss-html-to-scss --root path/to/file.html

# Selection mode (treat input as a fragment)
npx spiracss-html-to-scss --selection path/to/fragment.html

# From stdin
cat file.html | npx spiracss-html-to-scss --selection --stdin --base-dir src/components/sample
```

### Options

| Option | Description |
| --- | --- |
| `--root` | Generate from the root element (treated as the root Block; default) |
| `--selection` | Treat input as a fragment (selection mode) |
| `--stdin` | Read HTML from stdin |
| `--base-dir PATH` | Output directory for SCSS (overrides the input file directory; when using `--stdin`, defaults to the current directory) |
| `--dry-run` | Print output paths only (no files written) |
| `--json` | Output results as JSON to stdout (no files written; for AI/scripts) |
| `--ignore-structure-errors` | Continue even if structure linting errors occur |

**Note**: Mode is determined by the presence of `--selection`, so `--root` is kept for backward compatibility (if both are set, `--selection` wins).

**Note**: In `--root` mode, a single element from the input is treated as the root, and SCSS is generated for the root and its descendants. If that element has no `class`, generation fails. Use this mode for component-level input.

**Note**: In `--selection` mode, if no elements have a `class` attribute, the CLI exits with an error.

**Note**: Error message text can change; do not depend on exact strings.

### Output example

```text
your-component/
├─ hero-section.scss      -> root Block
├─ scss/
│   ├─ feature-card.scss  -> child Block
│   └─ index.scss         -> @use merged automatically
└─ your-template.html
```

### Output rules

- Output goes to the same directory as the input file when a path is specified (`--base-dir` overrides)
- `--stdin`: `--base-dir` (defaults to the current directory)
- Child Blocks go under `childScssDir` (default: `scss`)

### Generation notes

- When multiple elements share the same base class, modifier / variant / state / ARIA attributes are deduplicated and merged
- Reserved keys can be changed via `selectorPolicy` (e.g. `data-theme`, `data-status`, `aria-hidden`, `aria-expanded`)
- In data mode, variants are emitted in the base structure (you may manually move initial interaction values to the interaction section)

## spiracss-html-lint

Validates HTML structure against SpiraCSS Block / Element / Modifier rules.

### Basic usage

```bash
# Validate as a root element
npx spiracss-html-lint --root path/to/file.html

# Validate a fragment from stdin
cat fragment.html | npx spiracss-html-lint --selection --stdin

# Output JSON
npx spiracss-html-lint --root path/to/file.html --json
```

### Options

| Option | Description |
| --- | --- |
| `--root` | Treat the root as a single Block (default) |
| `--selection` | Treat input as multiple fragments |
| `--stdin` | Read HTML from stdin |
| `--json` | Output as JSON: `{ file, mode, ok, errors[] }` |

**Note**: In `--root` mode, a single element from the input is treated as the root and the root plus its descendants are validated. If the root element has no `class`, `INVALID_BASE_CLASS` is reported. Use this mode for component-level input. If you have multiple root Blocks, use `--selection`.

**Note**: Mode is determined by the presence of `--selection`, so `--root` is kept for backward compatibility (if both are set, `--selection` wins).

### Error codes

| Code | Description |
| --- | --- |
| `INVALID_BASE_CLASS` | Base class violates Block/Element naming rules, or the root has no class, or no eligible elements were found |
| `MODIFIER_WITHOUT_BASE` | Modifier class without a base class |
| `DISALLOWED_MODIFIER` | Modifier class used in data mode (both variant/state are `data`) |
| `UTILITY_WITHOUT_BASE` | Utility class without a base class |
| `MULTIPLE_BASE_CLASSES` | Multiple base classes found |
| `ROOT_NOT_BLOCK` | Root element is not a Block |
| `ELEMENT_WITHOUT_BLOCK_ANCESTOR` | Element has no Block ancestor |
| `ELEMENT_PARENT_OF_BLOCK` | Element is the parent of a Block |
| `DISALLOWED_VARIANT_ATTRIBUTE` | Variant attributes (e.g. `data-variant`) used in class mode |
| `DISALLOWED_STATE_ATTRIBUTE` | State attributes (e.g. `data-state`, `aria-*`) used in class mode |
| `INVALID_VARIANT_VALUE` | Variant value violates `valueNaming` in data mode |
| `INVALID_STATE_VALUE` | State value violates `valueNaming` in data mode |

**Notes:**
- In `--selection` mode, only elements with a `class` attribute are validated (if none, `INVALID_BASE_CLASS`)
- `data-*` / `aria-*` are validated only when they match the reserved keys (`variant.dataKeys` / `state.dataKey` / `state.ariaKeys`)
- Data value naming is validated against `selectorPolicy.valueNaming` and `variant/state.valueNaming`
- Classes matching `stylelint.base.external.classes` / `stylelint.base.external.prefixes` are treated as external (excluded from base checks)
- If the first token is an external class and a non-external class appears later, it results in `INVALID_BASE_CLASS` (Block/Element must come first). Elements with only external classes are allowed
- When `variant.mode=class` and `state.mode=class`, state cannot be separated, so **all modifiers are treated as variants**
- Error message text can change; do not depend on exact strings

## spiracss-html-format

Formats HTML by inserting placeholder classes to normalize SpiraCSS structure.

### Basic usage

```bash
# Read from file and write to another file
npx spiracss-html-format path/to/file.html -o formatted.html

# Read from file and output to stdout
npx spiracss-html-format path/to/file.html

# Read from stdin and write to a file
cat file.html | npx spiracss-html-format --stdin -o formatted.html
```

### Options

| Option | Description |
| --- | --- |
| `--stdin` | Read HTML from stdin |
| `-o, --output PATH` | Output file path (defaults to stdout) |

The output attribute follows `htmlFormat.classAttribute` in `spiracss.config.js` (default: `class`). Set `htmlFormat.classAttribute` to `className` if you want `className` output. Internally, `class` / `className` are temporarily converted to `data-spiracss-classname` and restored on output.

### Inserted classes

Recursively walks all descendants and normalizes them into a Block > Element structure.

- **Elements with children** -> prepend a Block placeholder
- **Leaf elements** -> prepend an Element placeholder
- **Elements with an existing Block name** -> keep the name and process descendants
- **Elements with an Element name but with children** -> convert to Block form (e.g. `title` -> `title-box`)

**Note**: For the root element, Element -> Block conversion is not performed; instead, a Block placeholder is prepended (e.g. `block-box title`), even for names that are neither Block nor Element.

Placeholder names change based on `blockCase` / `elementCase` (configured independently):

| Case | Block placeholder | Element placeholder |
| --- | --- | --- |
| `kebab` (default) | `block-box` | `element` |
| `camel` | `blockBox` | `element` |
| `pascal` | `BlockBox` | `Element` |
| `snake` | `block_box` | `element` |

**Note**: Element names are **always a single word**. `elementCase=camel` allows only a single lowercase word (e.g. `element`), and `elementCase=pascal` allows only a single capitalized word (e.g. `Element`); internal capitals like `bodyText` / `BodyText` are not allowed. If you set `customPatterns`, ensure the placeholders (`block-box` / `element`) still match your naming rules.

### Limitations

HTML that includes template syntax (EJS `<% %>`, Nunjucks `{{ }}` / `{% %}` / `{# #}`, Astro frontmatter, etc.) is skipped. These constructs can be broken by HTML parsing, so only use static HTML fragments.

JSX `class` / `className` are supported only when they are a **string or template literal**; if a dynamic binding like `class={styles.foo}` / `className={styles.foo}` is present, the entire HTML is skipped.

When template syntax is detected:
- **Stdout mode** (no `-o`): output the original HTML and emit a warning to stderr
- **File output mode** (`-o`): skip writing the file and emit a warning to stderr (prevents mtime changes)
- Behavior is undefined when fragment HTML is missing closing tags for `<template>` / `<textarea>` (no explicit detection is performed)

## Configuration

All CLI commands read `spiracss.config.js`. See [spiracss-config.md](spiracss-config.md) and [spiracss.config.example.js](spiracss.config.example.js) for full settings. If `package.json` has `"type": "module"`, use `export default` instead of `module.exports`.

Because the HTML CLI is a CJS bundle, it cannot load ESM config when Node is launched with `--disallow-code-generation-from-strings`. If possible, switch to `module.exports` or remove the flag. In `"type": "module"` projects, `spiracss.config.js` cannot be CJS, so you effectively need to remove the flag (no automatic `.cjs` / `.mjs` discovery).

If `spiracss.config.js` exists but cannot be loaded, the CLI exits with an error (check the config syntax and `type: "module"`).

See [spiracss-config.md](spiracss-config.md) for full configuration options.

## Related tools
### Tools
- [SpiraCSS Stylelint Plugin](stylelint.md)
- SpiraCSS HTML CLI
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### Configuration
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS docs
- [Design Principles](../principles.md)
- [Quickstart](../quickstart.md)
- [CSS Layers](../layers.md)
- [Components](../component.md)
- [Guidelines](../guidelines.md)
- [Design Philosophy](../philosophy.md)
