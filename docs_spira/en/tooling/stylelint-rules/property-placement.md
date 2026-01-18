# spiracss/property-placement

Validates property placement (container / item / internal).

## Purpose

- Separate layout responsibilities between parent and child to clarify structural meaning
- Prevent layout decisions from leaking into the child side

## What it checks

- Disallow layout properties on page-root selectors (standalone `body` or standalone `#id`)
- Container properties allowed on root Block / Element, disallowed on child Blocks
- Item properties allowed only on direct child selectors (basically `> .child`; `+` / `~` are allowed only as trailing sibling selectors)
- Internal properties allowed on root Block / Element, disallowed on child Blocks (padding / overflow / and width/height/min/max when `sizeInternal` is enabled)
- Enforce one-sided vertical margin (`marginSide`)
- Restrict `position` (`position: true`)
- `@extend` is always an error; `@at-root` is only allowed in the interaction section

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
    padding: 16px; // NG: internal properties on a child Block
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
    margin-bottom: 16px; // NG: when marginSide is top
  }
}
```

## Why

- Preserve the responsibility split: the parent decides layout, the parent’s direct child rules adjust the child, and the child writes only internal styling
- Unifying vertical margin to one side simplifies spacing calculations and prevents duplication
- `@extend` / improper `@at-root` breaks placement tracing and collapses structure

## Exceptions / notes

- If `min-*` values are `0`, they are allowed even on child Blocks (when `sizeInternal` is enabled)
- `0` / `auto` / `initial` are allowed on the forbidden side
- If the entire value is `inherit` / `unset` / `revert` / `revert-layer` alone, it is skipped
- If the forbidden side is `var(...)` / a function value / `$...` / `#{...}`, it is an error
- `@scope` is treated as a context boundary; `@include` in `responsiveMixins` is treated as transparent
- `:global-only` selectors are out of scope and skipped
- `u-` is always treated as external (classes listed in `external` are also excluded)

## Error list

### containerInChildBlock (container properties in a child Block)


**Example:**
```scss
// NG
.parent-block {
  > .child-block {
    display: flex;
    gap: 8px;
  }
}

// OK
.parent-block {
  display: flex;
  gap: 8px;
}
```

**Reason:** container layout belongs to the parent or the child itself

### itemInRoot (item properties on a root Block)


**Example:**
```scss
// NG
.child-block {
  margin-top: 16px;
}

// OK
.parent-block {
  > .child-block {
    margin-top: 16px;
  }
}
```

**Reason:** a root Block does not decide its own placement; the parent does

### selectorKindMismatch (mixed selector kinds)


**Example:**
```scss
// NG
.parent-block {
  > .title,
  > .child-block {
    margin-top: 16px;
  }
}

// OK
.parent-block {
  > .title {
    margin-top: 16px;
  }

  > .child-block {
    margin-top: 16px;
  }
}
```

**Reason:** mixing root / Element / child Block makes placement detection impossible

### marginSideViolation (forbidden side of vertical margin)


**Example:**
```scss
// NG
.parent-block {
  > .title {
    margin-bottom: 16px;
  }
}

// OK
.parent-block {
  > .title {
    margin-top: 16px;
  }
}
```

**Reason:** unify to one side to simplify spacing

### internalInChildBlock (internal properties on a child Block)


**Example:**
```scss
// NG
.parent-block {
  > .child-block {
    padding: 16px;
  }
}

// OK
.child-block {
  padding: 16px;
}
```

**Reason:** internal properties belong to the child itself

### positionInChildBlock (position restrictions on a child Block)



**Example:**
```scss
// NG
.parent-block {
  > .child-block {
    position: fixed;
    top: 0;
  }
}

// NG
.parent-block {
  > .child-block {
    position: relative;
  }
}

// NG
.parent-block {
  > .child-block {
    position: var(--pos);
    top: 0;
  }
}

// OK
.parent-block {
  > .child-block {
    position: relative;
    top: 0;
  }
}
```

**Reason:** keep layout context between parent/child and enable offset checks

### pageRootContainer (container properties on page-root)


**Example:**
```scss
// NG
body {
  display: flex;
  gap: 12px;
}

// OK
.page-root {
  display: flex;
  gap: 12px;
}
```

**Reason:** page-root is decoration-only; layout should be delegated to Blocks

### pageRootItem (item properties on page-root)


**Example:**
```scss
// NG
body {
  margin-top: 16px;
}

// OK
.page-root {
  > .child {
    margin-top: 16px;
  }
}
```

**Reason:** page-root does not carry its own placement

### pageRootInternal (internal properties on page-root)


**Example:**
```scss
// NG
body {
  padding: 16px;
}

// OK
.page-root {
  padding: 16px;
}
```

**Reason:** internal properties belong to Blocks

### pageRootNoChildren (compound selector for page-root)


**Example:**
```scss
// NG
body > .main {
  color: #222;
}

// OK
body {
  color: #222;
}
```

**Reason:** page-root is treated as a standalone selector

### forbiddenAtRoot (`@at-root` outside interaction)


**Example:**
```scss
// NG
.parent-block {
  @at-root & {
    color: red;
  }
}

// OK
.parent-block {
  // --interaction
  @at-root & {
    color: red;
  }
}
```

**Reason:** `@at-root` breaks structure, so it is interaction-only

### forbiddenExtend (`@extend` is forbidden)


**Example:**
```scss
// NG
.parent-block {
  @extend %placeholder;
}

// OK
.parent-block {
  @include placeholder();
}
```

**Reason:** `@extend` introduces implicit dependencies and breaks placement tracing

### selectorResolutionSkipped (selector resolution skipped)

**Content:**
```scss
.parent-block {
  &.-a, &.-b, &.-c, &.-d, &.-e, &.-f, &.-g, &.-h {
    > .child {
      padding: 1px;
    }
  }
}
```

**Reason:** selectors too complex to resolve are skipped

### selectorParseFailed (selector parse failed)


**Example:**
```scss
// NG
.parent-block {
  > : {
    padding: 4px;
  }
}

// OK
.parent-block {
  > .title {
    padding: 4px;
  }
}
```

**Reason:** unparseable selectors cannot be validated


## Settings

- [spiracss.config.js / stylelint.placement](../spiracss-config.md#stylelintplacement)

## Related

- [Components: property placement cheat sheet](../../component.md#property-placement-cheat-sheet)
- [Components: base structure section](../../component.md#1-base-structure-section)
