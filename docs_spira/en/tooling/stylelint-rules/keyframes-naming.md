# spiracss/keyframes-naming

Validates `@keyframes` placement and naming.

## Purpose

- Make animation ownership and placement clear
- Avoid naming collisions and improve discoverability

## What it checks

- `@keyframes` must be at the root (not inside `@media` / `@layer`)
- `@keyframes` are grouped at the end of the file
- Naming must be `{block}-{action}` or `{block}-{element}-{action}`
- Block / element casing follows `stylelint.base.naming`
- Element names must exist in the same file
- Action uses the `blockCase` format and is 1-3 words (`actionMaxWords`)

## OK

```scss
.sample-block {}

@keyframes sample-block-fade-in {
  to {
    opacity: 1;
  }
}
```

## NG

```scss
@media (min-width: 768px) {
  @keyframes sample-block-fade-in {} // NG: not at root
}
```

```scss
@keyframes sample-block-unknown-fade {} // NG: element does not exist
```

## Why

- Root-level placement keeps animations easy to find and manage
- Naming tied to Block / Element avoids collisions

## Exceptions / notes

- Shared animations should use a prefix like `kf-` and be grouped in `keyframes.scss`
- If the root Block cannot be resolved, naming is skipped with a warning (configurable via `blockSource`)

## Configuration

- [spiracss.config.js / stylelint.keyframes](../spiracss-config.md#stylelintkeyframes)

## Related

- [Components: @keyframes](../../component.md#keyframes)
