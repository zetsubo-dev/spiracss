# spiracss/rel-comments

Validates parent-child links via `@rel` comments.

## Purpose

- Make relationships between page entry SCSS and Blocks explicit
- Keep comment link navigation stable

## What it checks

- Parent `@rel` is placed at the top of the root scope (not inside the root Block)
- Parent Block is the first rule in the same scope (when required)
- The first node under `> .child-block` is an `@rel` comment
- The shared section is included; the interaction section is excluded by default
- Path existence checks when enabled

## OK

```scss
// @rel ../components/card-list

.page-home {
  > .card-list {
    // @rel ./scss/card-list
  }
}
```

## NG

```scss
.page-home {
  // @rel ../components/card-list // NG: not at root scope head
  > .card-list {}
}
```

```scss
.page-home {
  > .card-list {
    padding: 8px; // NG: @rel is not the first node
  }
}
```

## Why

- Fixing the link entry point makes resolution predictable

## Configuration

- [spiracss.config.js / stylelint.rel](../spiracss-config.md#stylelintrel)

## Related

- [Components: @rel comments](../../component.md#rel-comments)
- [Comment Links](../comment-links.md)
