# Guidelines

This document lists recommended SpiraCSS rules that are not enforced by the SpiraCSS Stylelint plugin.

## Configuration

SpiraCSS recommends the default settings, but you can change them in `spiracss.config.js` to match your framework or project conventions.

Examples:
- Switch block naming from kebab-case to camelCase (e.g., React or Vue)
- Switch variant/state from data attributes to class-based mode
- Customize delimiters and patterns
- Exclude external library classes from validation (e.g., Swiper)
- Toggle whether `@rel` comments are required

See [spiracss.config.js](tooling/spiracss-config.md) for details.

## Layout

| Rule | Notes |
| --- | --- |
| **Use only top margins** (`margin-top`) for vertical spacing; do not use bottom margins. | Simplifies spacing calculations and prevents duplicates. |

> From a design perspective, treating elements as having their own space above them is more natural, so use top margins.

## Class naming

| Rule | Notes |
| --- | --- |
| **Use `*-box` for layout classes within a Block** and, as a rule, do not use relative names such as `wrapper` / `inner` / `outer`. | Example: `.content-box`, `.media-box` |

> `wrapper` / `inner` / `outer` imply relative structure and can become misleading when the structure changes. `*-box` does not constrain meaning, so it is easier to swap or split.

### Naming idea

- If you standardize the root Block class (defined in each component's root SCSS file) as `<name>-container`, the root Block becomes easier to identify and component boundaries are easier to track.

## SpiraCSS docs
- [Design Principles](principles.md)
- [Quickstart](quickstart.md)
- [CSS Layers](layers.md)
- [Components](component.md)
- Guidelines
- [Design Philosophy](philosophy.md)

## Tools
- [Tooling overview](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint Plugin](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
