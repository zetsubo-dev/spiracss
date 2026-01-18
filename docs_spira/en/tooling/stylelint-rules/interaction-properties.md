# spiracss/interaction-properties

Validates transition / animation usage inside the interaction section.

## Purpose

- Keep interaction-related declarations in one place
- Make animated properties explicit and maintainable

## What it checks

- `transition` / `transition-*` / `animation` / `animation-*` only in the interaction section
- `transition` must list target properties explicitly
- `transition: none` / `transition-property: none` are not allowed
- Properties listed in `transition` should not be declared outside interaction

## OK

```scss
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }
}
```

## NG

```scss
.sample-block {
  transition: all 0.2s ease; // NG: outside interaction + all
}
```

```scss
.sample-block {
  // --interaction
  @at-root & {
    transition: none; // NG
  }
}
```

## Why

- Explicit targets reduce unexpected side effects
- Scattered declarations make initial and state styles harder to track

## Configuration

- [spiracss.config.js / stylelint.interactionProps](../spiracss-config.md#stylelintinteractionprops)

## Related

- [Components: interaction section](../../component.md#3-interaction-section)
