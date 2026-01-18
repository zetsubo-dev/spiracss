# spiracss/keyframes-naming

Validates placement and naming of `@keyframes`.

## Purpose

- Clarify animation responsibilities and placement
- Avoid naming collisions and improve discoverability

## What it checks

- `@keyframes` must be at the root only (not inside `@media` / `@layer`)
- `@keyframes` must be grouped at the end of the file
- Names are `{block}-{action}` or `{block}-{element}-{action}`
- Block/Element casing follows `stylelint.base.naming`
- Element must match an element name that exists in the file
- Action is 1-3 words in the `blockCase` case (adjustable via `actionMaxWords`)

## OK

```scss
.sample-block {
  opacity: 0;
}

@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

## NG

```scss
@media (min-width: 768px) {
  @keyframes sample-block-fade-in { // NG: not at the root
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}
```

```scss
@keyframes sample-block-unknown-fade { // NG: element does not exist
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

## Why

- Grouping at the root and at the end makes animations easier to find/manage
- Tying names to Block/Element avoids collisions

## Exceptions / notes

 - For shared animations, use a prefix like `kf-` and consolidate them in `keyframes.scss`
 - If the root Block cannot be resolved, it warns and skips naming checks (configurable via `blockSource` / `blockWarnMissing`)

## Error list

### needRoot (`@keyframes` must be at the root)


**Example:**
```scss
// NG
@media (min-width: 768px) {
  @keyframes sample-block-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}

// OK
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Reason:** group animation definitions for easier discovery

### needTail (must be placed at the end of the file)


**Example:**
```scss
// NG
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sample-block {
  opacity: 0;
}

// OK
.sample-block {
  opacity: 0;
}

@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Reason:** make animation definitions easy to find

### invalidName (invalid naming)


**Example:**
```scss
// NG
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Reason:** tie names to Block/Element to avoid collisions

### invalidSharedName (invalid shared animation name)


**Example:**
```scss
// NG
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
@keyframes kf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Reason:** make shared animations explicit

### sharedFileOnly (shared animation in the wrong file)


**Example:**
```scss
// NG
// in card-list.scss
@keyframes kf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
// in keyframes.scss
@keyframes kf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Reason:** fix the location for shared definitions

### missingBlock (cannot resolve root Block)


**Example:**
```scss
// NG
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
.sample-block {
  opacity: 0;
}
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Reason:** cannot bind the name to a Block

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

- [spiracss.config.js / stylelint.keyframes](../spiracss-config.md#stylelintkeyframes)

## Related

- [Components: @keyframes](../../component.md#keyframes)
