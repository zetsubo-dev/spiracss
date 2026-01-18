# spiracss/interaction-scope

Validates placement and structure of the interaction section (`// --interaction` and `@at-root & { ... }`).

## Purpose

- Centralize state-driven styles
- Keep interaction structure consistent and easy to review

## What it checks

- Interaction styles are grouped under `@at-root & { ... }`
- `// --interaction` comment is placed immediately before the block
- Interaction block is directly under the root Block (wrappers are allowed)
- Selectors with pseudo/state parts start with `&`
- `data-variant` may be placed in interaction (for initial values) but must not be mixed with `data-state` / `aria-*` in the same selector

## OK

```scss
.sample-block {
  // --interaction
  @at-root & {
    &:hover {}
    &[data-state="active"] {}
  }
}
```

## NG

```scss
.sample-block {
  > .child {
    // --interaction
    @at-root & { // NG: not directly under the root Block
      &:hover {}
    }
  }
}
```

```scss
.sample-block {
  // --interaction
  @at-root & {
    > &:hover {} // NG: does not start with `&`
  }
}
```

## Why

- Keeps interaction logic in one place
- A fixed entry point reduces missed or scattered state styles

## Configuration

- [spiracss.config.js / stylelint.interactionScope](../spiracss-config.md#stylelintinteractionscope)

## Related

- [Components: interaction section](../../component.md#3-interaction-section)
