# spiracss/rel-comments

Validates parent-child links via `@rel` comments.

## Purpose

- Make the relationship between page entry SCSS and Blocks / child Blocks explicit
- Stabilize automatic navigation by comment links

## What it checks

- Parent Block `@rel` must be placed at the top of the root scope (`@use` / `@forward` / `@import` can come before it; it is not allowed inside the root Block)
- Parent Block must be the first rule in the same scope (when parent-link is required)
- The first node under a `> .child-block` rule must be an `@rel` comment
- The shared section is in scope; the interaction section is excluded by default
- Optionally verifies that the path in the comment exists

## OK

```scss
// @rel ../components/card-list

.page-home {
  > .card-list {
    // @rel ./scss/card-list
    margin-top: 8px;
  }
}
```

## NG

```scss
.page-home {
  // @rel ../components/card-list // NG: not at the top of the root scope
  > .card-list {
    margin-top: 8px;
  }
}
```

```scss
.page-home {
  > .card-list {
    margin-top: 8px; // NG: @rel is not the first node
  }
}
```

## Why

- Fixing the parent-child entry point stabilizes link resolution

## Error list

### missingParentRel (missing parent `@rel`)


**Example:**
```scss
// NG
.page-home {
  color: #111;
}

// OK
// @rel ../components/page-home
.page-home {
  color: #111;
}
```

**Reason:** fix the entry point for the parent link

### misplacedParentRel (invalid parent `@rel` placement)


**Example:**
```scss
// NG
.page-home {
  // @rel ../components/page-home
  color: #111;
}

// OK
// @rel ../components/page-home
.page-home {
  color: #111;
}
```

**Reason:** make the parse entry point unambiguous

### rootBlockNotFirst (root Block is not the first rule)


**Example:**
```scss
// NG
.util-reset {
  box-sizing: border-box;
}
.page-home {
  color: #111;
}

// OK
.page-home {
  color: #111;
}
.util-reset {
  box-sizing: border-box;
}
```

**Reason:** keep consistency with the parent-link entry placement

### missingChildRel (missing child `@rel`)


**Example:**
```scss
// NG
.page-home {
  > .card-list {
    margin-top: 8px;
  }
}

// OK
.page-home {
  > .card-list {
    // @rel ./scss/card-list
    margin-top: 8px;
  }
}
```

**Reason:** make links to child Blocks explicit

### notFound (target path does not exist)


**Example:**
```scss
// NG
// @rel ../components/missing-block
.page-home {
  color: #111;
}

// OK
// @rel ../components/card-list
.page-home {
  color: #111;
}
```

**Reason:** keep navigation consistent

### childMismatch (child Block name does not match `@rel`)


**Example:**
```scss
// NG
.page-home {
  > .card-list {
    // @rel ./scss/hero-banner
    margin-top: 8px;
  }
}

// OK
.page-home {
  > .card-list {
    // @rel ./scss/card-list
    margin-top: 8px;
  }
}
```

**Reason:** keep file mapping stable

### selectorParseFailed (selector parse failed)


**Example:**
```scss
// NG
.page-home {
  > : {
    margin-top: 8px;
  }
}

// OK
.page-home {
  > .card-list {
    margin-top: 8px;
  }
}
```

**Reason:** unparseable selectors cannot be validated


## Settings

- [spiracss.config.js / stylelint.rel](../spiracss-config.md#stylelintrel)

## Related

- [Components: @rel comments](../../component.md#rel-comments)
- [Comment Links](../comment-links.md)
