# spiracss/property-placement

Validates property placement (container / item / internal).

## Purpose

- Separate layout responsibilities between parent and child
- Prevent layout decisions from leaking into child Blocks

## What it checks

- Layout properties are disallowed on page-root selectors (single `body` or single `#id`)
- Container properties are allowed on the root Block / Element, disallowed on child Blocks
- Item properties are allowed only on the parent's `> .child` rules
- Internal properties are allowed on the root Block / Element, disallowed on child Blocks (`sizeInternal` controls width/height/min/max)
- Vertical margin unification (`marginSide`)
- `position` restrictions (`position: true`)
- `@extend` is always an error, `@at-root` is allowed only for interaction sections

## OK

```scss
.parent-block {
  display: flex; // container
  gap: 16px;

  > .child-block {
    margin-top: 16px; // item
  }

  > .title {
    padding: 8px; // internal
  }
}
```

## NG

```scss
.parent-block {
  > .child-block {
    padding: 16px; // NG: internal property on a child Block
  }
}
```

```scss
body {
  display: flex; // NG: layout properties are not allowed on page-root
}
```

```scss
.parent-block {
  > .child-block {
    margin-bottom: 16px; // NG when marginSide is top
  }
}
```

## Why

- Keeps the parent-decides-layout rule consistent and predictable
- Unifying vertical margins simplifies spacing and avoids duplication
- `@extend` and misuse of `@at-root` make placement tracking impossible

## Exceptions / notes

- `min-*` with value `0` is allowed on child Blocks
- The forbidden side allows `0` / `auto` / `initial`
- If the entire value is `inherit` / `unset` / `revert` / `revert-layer`, it is skipped
- If the forbidden side uses `var(...)` / function values / `$...` / `#{...}`, it is an error
- `@scope` is a context boundary; mixins listed in `responsiveMixins` are treated as transparent
- Global-only selectors are out of scope and placement checks are skipped

## Configuration

- [spiracss.config.js / stylelint.placement](../spiracss-config.md#stylelintplacement)

## Related

- [Components: Property placement cheat sheet](../../component.md#property-placement-cheat-sheet)
- [Components: Base structure section](../../component.md#1-base-structure-section)
