# spiracss/interaction-properties

Validates transition / animation declarations inside the interaction section.

## Purpose

- Centralize interaction-related declarations in one place
- Make it explicit what moves to improve maintainability

## What it checks

- `transition` / `transition-*` / `animation` / `animation-*` are allowed only inside the interaction section
- `transition` must declare target properties
- `transition: none` / `transition-property: none` are not allowed
- Properties listed in `transition` must not be declared outside interaction

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

- Explicit target properties reduce unintended side effects
- Spreading declarations outside interaction makes initial values and states drift

## Error list

### needInteraction (declaration outside interaction)


**Example:**
```scss
// NG
.sample-block {
  transition: opacity 0.2s ease;
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
```

**Reason:** centralize state-related declarations

### missingTransitionProperty (missing target properties)


**Example:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: 0.2s ease;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
```

**Reason:** explicitly state what changes

### transitionAll (disallow `all`)


**Example:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: all 0.2s ease;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
```

**Reason:** avoid unintended side effects

### transitionNone (disallow `none`)


**Example:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: none;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition-duration: 0.001s;
  }
}
```

**Reason:** preserve consistent handling in interaction

### invalidTransitionProperty (invalid target)


**Example:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: var(--prop) 0.2s;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s;
  }
}
```

**Reason:** allow only parseable targets

### initialOutsideInteraction (initial value outside interaction)


**Example:**
```scss
// NG
.sample-block {
  opacity: 0;
  // --interaction
  @at-root & {
    transition: opacity 0.2s;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s;
  }
}
```

**Reason:** keep the origin of state changes in one place

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

- [spiracss.config.js / stylelint.interactionProps](../spiracss-config.md#stylelintinteractionprops)

## Related

- [Components: interaction section](../../component.md#interaction-section)
