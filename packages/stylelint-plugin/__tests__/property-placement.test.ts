import propertyPlacement from '../dist/esm/rules/spiracss-property-placement.js'
import { testRule, withClassMode, withDataMode } from './rule-test-utils.js'

describe('spiracss/property-placement', () => {
  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  display: flex;
}`
      },
      {
        code: `
.block-name {
  display: inline-flex;
}`
      },
      {
        code: `
.block-name {
  display: inline-grid;
}`
      },
      {
        code: `
.block-name {
  display: inline flex;
}`
      },
      {
        code: `
.block-name {
  display: block grid;
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name[data-variant="primary"] {
  display: flex;
}`
      },
      {
        code: `
.block-name[aria-expanded="true"] {
  display: flex;
}`
      },
      {
        code: `
.block-name {
  > .title {
    padding: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    display: block;
  }
}`
      },
      {
        code: `
.block-name {
  > .wrapper {
    display: flex;
  }
}`
      },
      {
        code: `
.block-name {
  > .outer {
    > .inner {
      display: grid;
    }
  }
}`
      },
      {
        code: `
.block-name {
  > .a > .b > .c > .d {
    display: flex;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name .title {
  margin-top: 8px;
}`
      },
      {
        code: `
.title {
  margin-top: 8px;
}`
      },
      {
        code: `
.block-name :global(.child-block) {
  display: flex;
}`
      },
      {
        code: `
:global(.foo) {
  @at-root & {
    color: inherit;
  }
}`
      },
      {
        code: `
:global(.foo) {
  @extend %placeholder;
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-inline: auto;
  }
}`
      },
      {
        code: `
.block-name {
  padding-block: 8px;
}`
      },
      {
        code: `
.block-name {
  > :is(.title, .lead) {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > :is(.title, .child-block) {
    display: flex;
  }
}`
      },
      {
        code: `
.block-name > .title,
.block-name > .child-block {
  display: flex;
}`
      },
      {
        code: `
.block-name {
  > :where(.title, .lead) {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > .title:not(.lead) {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > .title + .title {
    display: grid;
  }
}`
      },
      {
        code: `
.block-name {
  > .title + .title {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block ~ .child-block {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > :is(.child-one, .child-two) {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > :not(.child-block) {
    display: flex;
  }
}`
      },
      {
        code: `
.block-name {
  grid-template-columns: 1fr 1fr;
}`
      },
      {
        code: `
.block-name {
  grid: auto / 1fr;
}`
      },
      {
        code: `
.block-name {
  grid-template: "header" auto "main" 1fr / 1fr;
}`
      },
      {
        code: `
.block-name {
  grid-auto-flow: row;
}`
      },
      {
        code: `
.block-name {
  > .title {
    flex-grow: 1;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    order: 2;
  }
}`
      },
      {
        code: `
// --shared
.block-name {
  > .title {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > .a > .b > .c > .d > .e > .child-block {
    padding: 8px;
  }
}`
      },
      {
        code: `
.block-name + .block-next {
  display: flex;
}`
      },
      {
        code: `
.block-name ~ .block-next {
  display: flex;
}`
      },
      {
        code: `
#main {
  background: #fff;
}`
      },
      {
        code: `
body {
  background: #000;
}`
      },
      {
        code: `
.u-margin {
  margin: 8px;
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    min-width: 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;
    left: 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;

    &.-wide {
      left: 8px;
    }
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;

    @media (min-width: 600px) {
      left: 0;
    }
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: auto;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: initial;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: inherit;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: unset;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: revert;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: revert-layer;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: 8px 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: auto;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: initial;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: inherit;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin: 8px 16px 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin: auto;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin: initial;
  }
}`
      },
      {
        code: `
.block-name {
  > .title {
    margin: inherit;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    min-width: 0px;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    min-height: 0rem;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    min-inline-size: 0%;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    min-block-size: 0;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: static;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: initial;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: inherit;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: inherit !important;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: unset;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: revert;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: revert-layer;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;
    inset-inline-start: 0;
  }
}`
      },
      {
        code: `
.block-name, :global(.foo) {
  > .child-block {
    position: absolute;
    left: 0;
  }
}`
      },
      {
        code: `
@scope (.modal) {
  .block-name {
    > .child-block {
      position: absolute;
      left: 0;
    }
  }
}`
      },
      {
        code: `
@scope (.modal) to (.limit) {
  .block-name {
    > .child-block {
      position: absolute;
      left: 0;
    }
  }
}`
      },
      {
        code: `
@scope (.modal) {
  @scope (.inner) {
    .block-name {
      > .child-block {
        position: absolute;
        left: 0;
      }
    }
  }
}`
      },
      {
        code: `
@scope (.modal) {
  .block-name {
    > .child-block {
      position: absolute;
    }
  }
}

@scope (.modal) {
  .block-name {
    > .child-block {
      left: 0;
    }
  }
}`
      },
      {
        code: `
@scope( .modal ) {
  .block-name {
    > .child-block {
      position: absolute;
    }
  }
}

@scope (.modal) {
  .block-name {
    > .child-block {
      left: 0;
    }
  }
}`
      },
      {
        code: `
.block-name, :global(.foo) {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}`
      },
      {
        code: `
.block-name {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}`
      },
      {
        code: `
:global(.foo) {
  .block-name {
    @at-root & {
      color: inherit;
    }
  }
}`
      },
      {
        code: `
:global(.foo) {
  .block-name {
    @extend %placeholder;
  }
}`
      }
    ],

    reject: [
      {
        code: `
.block-name {
  > .child-block {
    display: flex;
  }
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `display` on the parent Block selector. If the child should be the container, move `display` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    display: inline flex;
  }
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `display` on the parent Block selector. If the child should be the container, move `display` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    display: inline-grid;
  }
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `display` on the parent Block selector. If the child should be the container, move `display` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    display: block grid;
  }
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `display` on the parent Block selector. If the child should be the container, move `display` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    gap: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`gap` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `gap` on the parent Block selector. If the child should be the container, move `gap` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    grid-auto-flow: row;
  }
}`,
        warnings: [
          {
            message:
              '`grid-auto-flow` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `grid-auto-flow` on the parent Block selector. If the child should be the container, move `grid-auto-flow` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    grid: auto / 1fr;
  }
}`,
        warnings: [
          {
            message:
              '`grid` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `grid` on the parent Block selector. If the child should be the container, move `grid` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Root Blocks should not define their own placement; the parent layout controls item spacing. Move `margin-top` to a direct child selector under the parent Block (use the parent file that places this Block, typically linked via `@rel`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name, :global(.foo) {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name, :global(.foo)`. Root Blocks should not define their own placement; the parent layout controls item spacing. Move `margin-top` to a direct child selector under the parent Block (use the parent file that places this Block, typically linked via `@rel`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    padding: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`padding` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `padding` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-padding`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    overflow: hidden;
  }
}`,
        warnings: [
          {
            message:
              '`overflow` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `overflow` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-overflow`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    overflow-x: hidden;
  }
}`,
        warnings: [
          {
            message:
              '`overflow-x` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `overflow-x` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-overflow-x`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    overflow-y: auto;
  }
}`,
        warnings: [
          {
            message:
              '`overflow-y` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `overflow-y` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-overflow-y`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    width: 100%;
  }
}`,
        warnings: [
          {
            message:
              '`width` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `width` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-width`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    height: 100%;
  }
}`,
        warnings: [
          {
            message:
              '`height` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `height` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-height`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    max-width: 200px;
  }
}`,
        warnings: [
          {
            message:
              '`max-width` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `max-width` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-max-width`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    max-height: 200px;
  }
}`,
        warnings: [
          {
            message:
              '`max-height` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `max-height` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-max-height`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    min-width: 200px;
  }
}`,
        warnings: [
          {
            message:
              '`min-width` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `min-width` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-min-width`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    position: fixed;
  }
}`,
        warnings: [
          {
            message:
              '`position: fixed` is not allowed on a child Block selector. Selector: `.block-name > .child-block`. If you need `fixed`/`sticky`, define it in the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    position: sticky;
  }
}`,
        warnings: [
          {
            message:
              '`position: sticky` is not allowed on a child Block selector. Selector: `.block-name > .child-block`. If you need `fixed`/`sticky`, define it in the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    position: relative;
  }
}`,
        warnings: [
          {
            message:
              '`position: relative` requires offset properties on a child Block selector. Selector: `.block-name > .child-block`. Add `top`/`right`/`bottom`/`left`/`inset`/`inset-block`/`inset-inline`/`inset-block-start`/`inset-block-end`/`inset-inline-start`/`inset-inline-end` in the same wrapper context (e.g., `@media`/`@supports`/`@container`/`@layer`/`@scope`, or `@include` listed in `responsiveMixins` (current: `none`), or move `position: relative` to the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    position: var(--pos);
  }
}`,
        warnings: [
          {
            message:
              '`position: var(--pos)` is not allowed on a child Block selector. Selector: `.block-name > .child-block`. Dynamic values are not allowed here. Use `static`, or use `relative`/`absolute` with offsets in the same wrapper context. If you need `fixed`/`sticky`, define it in the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    position: $pos;
  }
}`,
        warnings: [
          {
            message:
              '`position: $pos` is not allowed on a child Block selector. Selector: `.block-name > .child-block`. Dynamic values are not allowed here. Use `static`, or use `relative`/`absolute` with offsets in the same wrapper context. If you need `fixed`/`sticky`, define it in the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    position: foo;
  }
}`,
        warnings: [
          {
            message:
              '`position: foo` is not allowed on a child Block selector. Selector: `.block-name > .child-block`. Use `static`, or use `relative`/`absolute` with offsets in the same wrapper context. If you need `fixed`/`sticky`, define it in the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name, :global(.foo) {
  > .child-block {
    position: absolute;
  }
}`,
        warnings: [
          {
            message:
              '`position: absolute` requires offset properties on a child Block selector. Selector: `.block-name > .child-block, :global(.foo) > .child-block`. Add `top`/`right`/`bottom`/`left`/`inset`/`inset-block`/`inset-inline`/`inset-block-start`/`inset-block-end`/`inset-inline-start`/`inset-inline-end` in the same wrapper context (e.g., `@media`/`@supports`/`@container`/`@layer`/`@scope`, or `@include` listed in `responsiveMixins` (current: `none`), or move `position: absolute` to the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
@scope (.foo .bar) {
  .block-name {
    > .child-block {
      position: absolute;
    }
  }
}`,
        warnings: [
          {
            message:
              '`position: absolute` requires offset properties on a child Block selector. Selector: `.block-name > .child-block`. Add `top`/`right`/`bottom`/`left`/`inset`/`inset-block`/`inset-inline`/`inset-block-start`/`inset-block-end`/`inset-inline-start`/`inset-inline-end` in the same wrapper context (e.g., `@media`/`@supports`/`@container`/`@layer`/`@scope`, or `@include` listed in `responsiveMixins` (current: `none`), or move `position: absolute` to the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
@scope (.modal:hover) {
  .block-name {
    > .child-block {
      position: absolute;
    }
  }
}`,
        warnings: [
          {
            message:
              '`position: absolute` requires offset properties on a child Block selector. Selector: `.block-name > .child-block`. Add `top`/`right`/`bottom`/`left`/`inset`/`inset-block`/`inset-inline`/`inset-block-start`/`inset-block-end`/`inset-inline-start`/`inset-inline-end` in the same wrapper context (e.g., `@media`/`@supports`/`@container`/`@layer`/`@scope`, or `@include` listed in `responsiveMixins` (current: `none`), or move `position: absolute` to the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`margin-bottom` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: $spacing;
  }
}`,
        warnings: [
          {
            message:
              '`margin-bottom` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: calc(8px);
  }
}`,
        warnings: [
          {
            message:
              '`margin-bottom` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-bottom: var(--spacing);
  }
}`,
        warnings: [
          {
            message:
              '`margin-bottom` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-block-end: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`margin-block-end` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`margin-block` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin-block: 8px 16px;
  }
}`,
        warnings: [
          {
            message:
              '`margin-block` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin: 8px 16px 24px;
  }
}`,
        warnings: [
          {
            message:
              '`margin` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`margin` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin: 8px 16px;
  }
}`,
        warnings: [
          {
            message:
              '`margin` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin: 8px 16px 24px 32px;
  }
}`,
        warnings: [
          {
            message:
              '`margin` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    margin: #{$value}px;
  }
}`,
        warnings: [
          {
            message:
              '`margin` uses a bottom margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use top margins or set the bottom value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .a > .b > .c > .d > .child-block {
    padding: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`padding` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .a > .b > .c > .d > .child-block`. Move `padding` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-padding`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body {
  > .main {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              'Selector: `body > .main`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body[data-x] {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              'Selector: `body[data-x]`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body:hover {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              'Selector: `body:hover`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body, #main {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              'Selector: `body, #main`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body, :global(.foo) {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property. Selector: `body, :global(.foo)`. Page roots are decoration-only and cannot define layout. Use a page root Block class with a direct child selector instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
:global(.foo), body {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property. Selector: `:global(.foo), body`. Page roots are decoration-only and cannot define layout. Use a page root Block class with a direct child selector instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body#main {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              'Selector: `body#main`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body {
  display: flex;
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property. Selector: `body`. Page roots are decoration-only and cannot define layout. Create a page root Block class and define `display` there. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body {
  padding: 8px;
}`,
        warnings: [
          {
            message:
              '`padding` is an internal property. Selector: `body`. Page roots are decoration-only and cannot define layout. Define `padding` on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
body {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property. Selector: `body`. Page roots are decoration-only and cannot define layout. Use a page root Block class with a direct child selector instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  @at-root & {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`@at-root` is not allowed in basic/shared sections. Context: `.block-name`. `@at-root` breaks selector hierarchy and should only be used for interaction states. Move this rule to the interaction section using `interactionCommentPattern` (current: `/--interaction/i`), or remove `@at-root` and restructure the selector. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name, :global(.foo) {
  @at-root & {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`@at-root` is not allowed in basic/shared sections. Context: `.block-name, :global(.foo)`. `@at-root` breaks selector hierarchy and should only be used for interaction states. Move this rule to the interaction section using `interactionCommentPattern` (current: `/--interaction/i`), or remove `@at-root` and restructure the selector. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    @at-root & {
      margin-top: 8px;
    }
  }
}`,
        warnings: [
          {
            message:
              '`@at-root` is not allowed in basic/shared sections. Context: `.block-name > .title`. `@at-root` breaks selector hierarchy and should only be used for interaction states. Move this rule to the interaction section using `interactionCommentPattern` (current: `/--interaction/i`), or remove `@at-root` and restructure the selector. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  @extend %placeholder;
}`,
        warnings: [
          {
            message:
              '`@extend` is not allowed in SpiraCSS. Context: `.block-name` extends `%placeholder`. `@extend` creates implicit dependencies and can cause unexpected selector merging. Use a mixin, CSS custom properties, or apply the styles directly. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .title {
    @extend %placeholder;
  }
}`,
        warnings: [
          {
            message:
              '`@extend` is not allowed in SpiraCSS. Context: `.block-name > .title` extends `%placeholder`. `@extend` creates implicit dependencies and can cause unexpected selector merging. Use a mixin, CSS custom properties, or apply the styles directly. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
#main {
  display: flex;
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property. Selector: `#main`. Page roots are decoration-only and cannot define layout. Create a page root Block class and define `display` there. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
#main {
  margin-top: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property. Selector: `#main`. Page roots are decoration-only and cannot define layout. Use a page root Block class with a direct child selector instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
#main {
  > .container {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              'Selector: `#main > .container`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class instead. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .wrapper {
    > .child-block {
      display: flex;
    }
  }
}`,
        warnings: [
          {
            message:
              '`display` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .wrapper > .child-block`. If the parent should be the container, apply `display` on the parent Block selector. If the child should be the container, move `display` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  flex-grow: 1;
}`,
        warnings: [
          {
            message:
              '`flex-grow` is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Root Blocks should not define their own placement; the parent layout controls item spacing. Move `flex-grow` to a direct child selector under the parent Block (use the parent file that places this Block, typically linked via `@rel`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  grid-area: main;
}`,
        warnings: [
          {
            message:
              '`grid-area` is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Root Blocks should not define their own placement; the parent layout controls item spacing. Move `grid-area` to a direct child selector under the parent Block (use the parent file that places this Block, typically linked via `@rel`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    grid-template-rows: 1fr;
  }
}`,
        warnings: [
          {
            message:
              '`grid-template-rows` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `grid-template-rows` on the parent Block selector. If the child should be the container, move `grid-template-rows` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    grid-template: "a" 1fr / 1fr;
  }
}`,
        warnings: [
          {
            message:
              '`grid-template` is a container-side property (defines internal layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. If the parent should be the container, apply `grid-template` on the parent Block selector. If the child should be the container, move `grid-template` to the child Block\'s own stylesheet (the file where that Block is defined). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block {
    padding-inline: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`padding-inline` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `padding-inline` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-padding-inline`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  > .child-block + .child-block {
    padding: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`padding` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block + .child-block`. Move `padding` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-padding`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). State (`class`): use modifier classes (prefix: `-`, case: `kebab`; e.g., `&.-<modifier>`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  // --shared
  &.-active {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`margin-top` is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name.-active`. Root Blocks should not define their own placement; the parent layout controls item spacing. Move `margin-top` to a direct child selector under the parent Block (use the parent file that places this Block, typically linked via `@rel`). (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
// --shared
.block-name {
  @at-root & {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`@at-root` is not allowed in basic/shared sections. Context: `.block-name`. `@at-root` breaks selector hierarchy and should only be used for interaction states. Move this rule to the interaction section using `interactionCommentPattern` (current: `/--interaction/i`), or remove `@at-root` and restructure the selector. (spiracss/property-placement)'
          }
        ]
      },
      {
        code: `
.block-name {
  margin-block: 8px;
}`,
        warnings: [
          {
            message:
              '`margin-block` is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Root Blocks should not define their own placement; the parent layout controls item spacing. Move `margin-block` to a direct child selector under the parent Block (use the parent file that places this Block, typically linked via `@rel`). (spiracss/property-placement)'
          }
        ]
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        naming: {
          customPatterns: {
            modifier: /^is-[a-z]+$/
          }
        },
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
.block-name {
  > .child-block {
    padding: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`padding` is an internal property (affects the Block\'s own content/layout) and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move `padding` to the child Block\'s own file. To control it from parent, expose a CSS variable (e.g., `--child-padding`) and consume it in the child Block, or use the project\'s variant mechanism. Variant (`class`): use modifier classes matching `naming.customPatterns.modifier` (current: `/^is-[a-z]+$/`). State (`class`): use modifier classes matching `naming.customPatterns.modifier` (current: `/^is-[a-z]+$/`). (spiracss/property-placement)'
          }
        ]
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        responsiveMixins: ['clearfix'],
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block {
  > .child-block {
    position: absolute;

    @include clearfix {
      left: 0;
    }
  }
}
`
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        responsiveMixins: ['breakpoint-up', 'breakpoint-down', 'screen'],
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;

    @include breakpoint-down(md) {
      left: 0;
    }

    @include screen(md, lg) {
      right: 0;
    }
  }
}`
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        marginSide: 'bottom',
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  > .title {
    margin-bottom: 8px;
  }
}`
      }
    ],

    reject: [
      {
        code: `
.block-name {
  > .title {
    margin-top: 8px;
  }
}`,
        warnings: [
          {
            message:
              '`margin-top` uses a top margin value, which violates the margin-side rule. Selector: `.block-name > .title`. SpiraCSS enforces a single margin direction. Use bottom margins or set the top value to `0`/`auto`/`initial`. (spiracss/property-placement)'
          }
        ]
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enablePosition: false,
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  > .child-block {
    position: fixed;
  }
}`
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enableSizeInternal: false,
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  > .child-block {
    width: 100%;
  }
}`
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        responsiveMixins: ['breakpoint-up'],
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;

    @include breakpoint-up(md) {
      left: 0;
    }
  }
}`
      }
    ],

    reject: [
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;

    @include other-mixin(md) {
      left: 0;
    }
  }
}`,
        warnings: [
          {
            message:
              '`position: absolute` requires offset properties on a child Block selector. Selector: `.block-name > .child-block`. Add `top`/`right`/`bottom`/`left`/`inset`/`inset-block`/`inset-inline`/`inset-block-start`/`inset-block-end`/`inset-inline-start`/`inset-inline-end` in the same wrapper context (e.g., `@media`/`@supports`/`@container`/`@layer`/`@scope`, or `@include` listed in `responsiveMixins` (current: `breakpoint-up`), or move `position: absolute` to the child Block\'s own file. (spiracss/property-placement)'
          }
        ]
      }
    ]
  })

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withDataMode({
        allowElementChainDepth: 4,
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: `
.block-name[data-variant="primary"] {
  display: flex;
}`
      },
      {
        code: `
.block-name {
  > .title[aria-expanded="true"] {
    margin-top: 8px;
  }
}`
      },
      {
        code: `
.block-name {
  > .child-block {
    position: absolute;

    &[data-variant="shifted"] {
      left: 0;
    }
  }
}`
      }
    ]
  })
})

describe('spiracss/property-placement - selector parse failure', () => {
  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
.block-name > : {
  padding: 0;
}`,
        description: 'emit a single warning on selector parse failure',
        warnings: [
          {
            message:
              'Failed to parse one or more selectors, so some checks were skipped. Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: `.block-name > :`. (spiracss/property-placement)'
          }
        ]
      }
    ]
  })
})

describe('spiracss/property-placement - selector resolution explosion', () => {
  const parentSelectors = Array.from({ length: 1001 }, (_value, index) => {
    return `:global(.a${index})`
  }).join(', ')

  testRule({
    plugins: [propertyPlacement],
    ruleName: propertyPlacement.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        sharedCommentPattern: /--shared/i,
        interactionCommentPattern: /--interaction/i
      })
    ],
    customSyntax: 'postcss-scss',

    reject: [
      {
        code: `
${parentSelectors} {
  &.-mod {
    color: red;
  }
}`,
        description: 'emit a warning when selector resolution exceeds the limit',
        warnings: [
          {
            message:
              'Selector resolution exceeded `1000` combinations, so some checks were skipped. Example: `&.-mod`. (spiracss/property-placement)'
          }
        ]
      }
    ]
  })
})
