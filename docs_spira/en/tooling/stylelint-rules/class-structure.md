# spiracss/class-structure

Validates SpiraCSS naming rules and selector structure.

## Purpose

- Keep Block / Element structure machine-readable
- Stabilize parent-child responsibilities

## What it checks

- Naming (Block / Element / Modifier)
- Parent-child rules for Block / Element (e.g. disallow `Element > Block`)
- Require `>` for direct children of a Block (relaxed in shared; interaction is excluded from structure checks)
- Child selectors of a Block must be nested inside that Block (top-level `.block > .child` is invalid)
- Placement of shared / interaction sections
- One root Block per file (`rootSingle`)
- Root Block name matches the SCSS file name (`rootFile`)
- Handling of data/state according to `selectorPolicy`

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
  .title { // NG: in base structure, direct children should use `>`
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

- Enforcing `>` makes the parent-decides-child-layout structure explicit
- Limiting Element chain depth keeps responsibilities from becoming ambiguous

## Exceptions / notes

- In the shared section, only the `>` requirement is relaxed
- In the interaction section, structural checks are skipped (naming checks still apply)

## Error list

### invalidName (naming rule violation)


**Example:**
```scss
// NG
.HeroBanner {
  color: #222;
}

.titleText {
  font-weight: 600;
}

// OK
.hero-banner {
  color: #222;
}

.title {
  font-weight: 600;
}
```

**Reason:** structure is determined from naming

**Notes:** follows `stylelint.base.naming` / `naming.customPatterns`

### elementChainTooDeep (Element chain is too deep)


**Example:**
```scss
// NG
.card-list {
  > .item {
    > .content {
      > .title {
        font-size: 16px;
      }
    }
  }
}

// OK
.card-list {
  > .item {
    > .title {
      font-size: 16px;
    }
  }
}
```

**Reason:** deep Element chains make responsibilities ambiguous

**Notes:** depth limit is `elementDepth`

### elementCannotOwnBlock (Block under Element)


**Example:**
```scss
// NG
.card-list {
  > .item {
    > .price-tag {
      color: #333;
    }
  }
}

// OK
.card-list {
  > .price-tag {
    color: #333;
  }
}
```

**Reason:** Elements are parts of a Block and do not become parents

### blockDescendantSelector (grandchild selector directly under Block)


**Example:**
```scss
// NG
.card-list {
  > .item > .title {
    margin-top: 8px;
  }
}

// OK
.card-list {
  > .item {
    margin-top: 8px;
  }
}
```

**Reason:** make it clear that the parent decides child layout

### blockTargetsGrandchildElement (directly targeting a grandchild Element)


**Example:**
```scss
// NG
.card-list {
  > .price-tag {
    > .amount {
      font-weight: 700;
    }
  }
}

// OK
.price-tag {
  > .amount {
    font-weight: 700;
  }
}
```

**Reason:** parent Blocks should not touch grandchild Elements directly

### tooDeepBlockNesting (too many nested Blocks)


**Example:**
```scss
// NG
.card-list {
  > .price-tag {
    > .icon-badge {
      color: #fff;
    }
  }
}

// OK
.card-list {
  > .price-tag {
    color: #fff;
  }
}
```

**Reason:** Block > Block > Block chains make responsibilities unclear

### multipleRootBlocks (multiple root Blocks)


**Example:**
```scss
// NG
.hero-banner {
  color: #222;
}

.card-list {
  color: #333;
}

// OK
.hero-banner {
  color: #222;
}
```

**Reason:** keep a single entry point per file

### needChild (missing `>` direct child)


**Example:**
```scss
// NG
.card-list {
  .title {
    margin-top: 8px;
  }
}

// OK
.card-list {
  > .title {
    margin-top: 8px;
  }
}
```

**Reason:** make direct parent-child relationships explicit

### needChildNesting (top-level child selector is not allowed)

**Example:**
```scss
// NG
.hero-banner > .title {
  font-size: 16px;
}

// OK
.hero-banner {
  > .title {
    font-size: 16px;
  }
}
```

**Reason:** keep structure inside the Block and unify reading order

### sharedNeedRootBlock (shared comment placement)


**Example:**
```scss
// NG
.card-list {
  > .title {
    // --shared
    .helper {
      color: #999;
    }
  }
}

// OK
.card-list {
  // --shared
  .helper {
    color: #999;
  }
}
```

**Reason:** keep the shared section scope unambiguous

### needAmpForMod (Modifier must use `&.<modifier>`)


**Example:**
```scss
// NG
.card-list.-primary {
  color: #111;
}

// OK
.card-list {
  &.-primary {
    color: #111;
  }
}
```

**Reason:** treat Modifiers as Block-internal states

### needModifierPrefix (invalid `&` attachment)


**Example:**
```scss
// NG
.card-list {
  &.title {
    color: #111;
  }
}

// OK
.card-list {
  &.-primary {
    color: #111;
  }
}
```

**Reason:** only Modifiers can be attached to `&`

### disallowedModifier (Modifier disallowed in data mode)


**Example:**
```scss
// NG
.card-list {
  &.-primary {
    color: #111;
  }
}

// OK
.card-list {
  &[data-variant="primary"] {
    color: #111;
  }
}
```

**Reason:** Variant/State should be expressed with data attributes

### invalidVariantAttribute (variant uses class mode)


**Example:**
```scss
// NG
.card-list {
  &[data-variant="primary"] {
    color: #111;
  }
}

// OK
.card-list {
  &.-primary {
    color: #111;
  }
}
```

**Reason:** in class mode, use Modifiers

### invalidStateAttribute (state uses class mode)


**Example:**
```scss
// NG
.card-list {
  &[data-state="active"] {
    opacity: 1;
  }
}

// OK
.card-list {
  &.-active {
    opacity: 1;
  }
}
```

**Reason:** in class mode, use Modifiers

### invalidDataValue (invalid data value naming)


**Example:**
```scss
// NG
.card-list {
  &[data-variant="primary-dark-large"] {
    color: #111;
  }
}

// OK
.card-list {
  &[data-variant="primary-dark"] {
    color: #111;
  }
}
```

**Reason:** data values must follow naming rules

### rootSelectorMissingBlock (selector missing the root Block)


**Example:**
```scss
// NG
.swiper {
  margin-top: 8px;
}

// OK
.tab-panels {
  > .swiper {
    margin-top: 8px;
  }
}
```

**Reason:** structure is read starting from the root Block

### missingRootBlock (no root Block)


**Example:**
```scss
// NG
.title {
  font-size: 16px;
}

// OK
.card-list {
  font-size: 16px;
}
```

**Reason:** one file, one root Block is assumed

### selectorParseFailed (selector parse failed)


**Example:**
```scss
// NG
.card-list {
  > : {
    color: #111;
  }
}

// OK
.card-list {
  > .item {
    color: #111;
  }
}
```

**Reason:** unparseable selectors cannot be validated

### fileNameMismatch (file name does not match Block name)


**Example:**
```scss
// NG
// file: list.scss
.card-list {
  color: #111;
}

// OK
// file: card-list.scss
.card-list {
  color: #111;
}
```

**Reason:** keep file-to-Block mapping stable


## Settings

- [spiracss.config.js / stylelint.class](../spiracss-config.md#stylelintclass)
- Section comment patterns can also be changed via `stylelint.base.comments`

## Related

- [Components: naming conventions](../../component.md#naming-conventions)
- [Components: parent-child rules](../../component.md#parent-child-rules)
- [Components: SCSS section structure](../../component.md#scss-section-structure)
