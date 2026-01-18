# spiracss/pseudo-nesting

Require pseudo-classes / pseudo-elements to be nested under `&`.

## Purpose

- Clarify boundaries between structure and state
- Make selector intent easier to read

## OK

```scss
.button {
  &:hover {
    opacity: 0.8;
  }
  &::before {
    content: "";
  }
}
```

## NG

```scss
.button:hover { // NG: no nesting
  opacity: 0.8;
}
```

```scss
& > .button:hover { // NG: pseudo should be nested under the target selector
  opacity: 0.8;
}
```

## Why

- Pseudos should read as responsibilities of the target selector

## Error list

### needNesting (pseudos must be nested under `&`)



**Example:**
```scss
// NG
.button:hover {
  opacity: 0.8;
}

// NG
& > .button:hover {
  opacity: 0.8;
}

// OK
.button {
  &:hover {
    opacity: 0.8;
  }
}
```

**Reason:** make pseudos read as responsibilities of the target selector

### selectorParseFailed (selector parse failed)


**Example:**
```scss
// NG
.button {
  > : {
    color: #111;
  }
}

// OK
.button {
  > .item {
    color: #111;
  }
}
```

**Reason:** unparseable selectors cannot be validated


## Settings

- [spiracss.config.js / stylelint.pseudo](../spiracss-config.md#stylelintpseudo)

## Related

- [Components: SCSS section structure](../../component.md#scss-section-structure)
