# spiracss/class-structure

Validates SpiraCSS naming rules and selector structure.

## Purpose

- Keep Block / Element structure machine-readable
- Stabilize parent-child responsibilities

## What it checks

- Naming (Block / Element / Modifier)
- Parent-child constraints (e.g. disallow `Element > Block`)
- Require `>` for direct children of a Block (relaxed in shared; interaction is excluded from structure checks)
- Child selectors must be nested inside the Block (top-level `.block > .child` is invalid)
- Shared / interaction section placement
- Element chain depth limit (`elementDepth`)
- One root Block per file (`rootSingle`)
- Root Block name matches the SCSS file name (`rootFile`)
- `selectorPolicy` handling for data/state

## OK

```scss
.sample-block {
  > .title {
    font-size: 16px;
  }

  // --shared
  .helper {
    color: #999;
  }

  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

## NG

```scss
.sample-block {
  .title { // NG: direct children in base structure should use `>`
    font-size: 16px;
  }
}
```

```scss
.sample-block {
  > .title {
    > .detail {
      > .label {
        > .meta {
          > .text { // NG: Element chain too deep (exceeds elementDepth)
            color: #333;
          }
        }
      }
    }
  }
}
```

## Why

- `>` makes parent-owned layout explicit and predictable
- Limiting Element chain depth keeps responsibilities clear

## Exceptions / notes

- In the shared section, only the `>` requirement is relaxed
- In the interaction section, structure checks are skipped (naming checks still run)

## Configuration

- [spiracss.config.js / stylelint.class](../spiracss-config.md#stylelintclass)
- Section comment patterns can be overridden via `stylelint.base.comments`

## Related

- [Components: Naming conventions](../../component.md#naming-conventions)
- [Components: Parent-child rules](../../component.md#parent-child-rules)
- [Components: SCSS section structure](../../component.md#scss-section-structure)
