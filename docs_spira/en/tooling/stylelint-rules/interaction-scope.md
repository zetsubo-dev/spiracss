# spiracss/interaction-scope

Validates placement and structure of the interaction section (`// --interaction` and `@at-root & { ... }`).

## Purpose

- Centralize state-driven styles in one place
- Standardize interaction placement and shape to make reviews easier

## What it checks

- Whether interaction is consolidated under `@at-root & { ... }`
- Whether the `// --interaction` comment appears immediately before the `@at-root` block
- Whether the interaction block sits directly under the root Block (wrappers are allowed)
- Whether selectors that include pseudo/state selectors start with `&`
- `data-variant` is allowed in interaction (for initial values), but do not mix it with `data-state` / `aria-*` in the same selector

## OK

```scss
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }

    &[data-state="active"] {
      opacity: 1;
    }
  }
}
```

## NG

```scss
.sample-block {
  > .child {
    // --interaction
    @at-root & { // NG: not directly under the root Block
      &:hover {
        opacity: 0.8;
      }
    }
  }
}
```

```scss
.sample-block {
  // --interaction
  @at-root & {
    > &:hover { // NG: does not start with `&`
      opacity: 0.8;
    }
  }
}
```

## Why

- Centralizing state-related changes improves readability
- Fixing the interaction entry point reduces false positives and oversights

## Error list

### needAtRoot (interaction must be consolidated in `@at-root &`)


**Example:**
```scss
// NG
.sample-block {
  &:hover {
    opacity: 0.8;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**Reason:** consolidate state selectors into one block

### needComment (missing interaction comment)


**Example:**
```scss
// NG
.sample-block {
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**Reason:** stabilize section detection

### needTail (interaction is not at the end)


**Example:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }

  > .title {
    font-size: 16px;
  }
}

// OK
.sample-block {
  > .title {
    font-size: 16px;
  }

  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**Reason:** keep changes grouped at the end

### needRootBlock (not directly under the root Block)


**Example:**
```scss
// NG
.sample-block {
  > .child {
    // --interaction
    @at-root & {
      &:hover {
        opacity: 0.8;
      }
    }
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**Reason:** fix the interaction scope

### mixedStateVariant (mixing State and Variant)


**Example:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    &[data-state="active"][data-variant="primary"] {
      opacity: 1;
    }
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &[data-state="active"] {
      opacity: 1;
    }
    &[data-variant="primary"] {
      opacity: 1;
    }
  }
}
```

**Reason:** separate roles to keep it readable

### selectorParseFailed (selector parse failed)


**Example:**
```scss
// NG
.sample-block {
  > : {
    color: #111;
  }
}

// OK
.sample-block {
  > .title {
    color: #111;
  }
}
```

**Reason:** unparseable selectors cannot be validated


## Settings

- [spiracss.config.js / stylelint.interactionScope](../spiracss-config.md#stylelintinteractionscope)

## Related

- [Components: interaction section](../../component.md#interaction-section)
