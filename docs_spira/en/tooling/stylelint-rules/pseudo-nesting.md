# spiracss/pseudo-nesting

Requires pseudo-classes / pseudo-elements to be nested under `&`.

## Purpose

- Keep structure and state responsibilities clear
- Make selector intent easier to read

## OK

```scss
.button {
  &:hover {}
  &::before {}
}
```

## NG

```scss
.button:hover {} // NG: not nested
```

```scss
& > .button:hover {} // NG: nest pseudo under the target selector
```

## Why

- Pseudos should be read as part of the target selector's responsibility

## Configuration

- [spiracss.config.js / stylelint.pseudo](../spiracss-config.md#stylelintpseudo)

## Related

- [Components: SCSS section structure](../../component.md#scss-section-structure)
