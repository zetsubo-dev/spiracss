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
  grid-template-columns: 1fr 1fr;
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
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
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
    display: flex;
  }
}`,
        warnings: [
          {
            message:
              '"display" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "display" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"display" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "display" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"display" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "display" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"display" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "display" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"gap" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "gap" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"grid-auto-flow" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "grid-auto-flow" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"margin-top" is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Move "margin-top" to a direct child selector. Example: define `.block > .element` and place "margin-top" there. (spiracss/property-placement)'
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
              '"padding" is an internal property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "padding" to the child Block\'s own file. If parent control is needed, use CSS custom properties or data-variant. (spiracss/property-placement)'
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
              '"padding" is an internal property and cannot be used on a child Block selector. Selector: `.block-name > .a > .b > .c > .d > .child-block`. Move "padding" to the child Block\'s own file. If parent control is needed, use CSS custom properties or data-variant. (spiracss/property-placement)'
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
              'Selector: `body > .main`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              'Selector: `body[data-x]`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              'Selector: `body:hover`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              'Selector: `body, #main`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              'Selector: `body, :global(.foo)`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              'Selector: `:global(.foo), body`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              'Selector: `body#main`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              '"display" is a container-side property. Selector: `body`. Page roots are decoration-only and cannot define layout. Create a page root Block class (e.g., ".main-container") and define "display" there. (spiracss/property-placement)'
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
              '"padding" is an internal property. Selector: `body`. Page roots are decoration-only and cannot define layout. Define "padding" on the page root Block class instead. (spiracss/property-placement)'
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
              '"margin-top" is an item-side property. Selector: `body`. Page roots are decoration-only and cannot define layout. Use a page root Block class with a direct child selector instead. Example: `.main-container > .element`. (spiracss/property-placement)'
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
              '@at-root is not allowed in basic/shared sections. Context: `.block-name`. Move this rule to the --interaction section, or remove @at-root and restructure the selector. (spiracss/property-placement)'
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
              '@at-root is not allowed in basic/shared sections. Context: `.block-name > .title`. Move this rule to the --interaction section, or remove @at-root and restructure the selector. (spiracss/property-placement)'
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
              '@extend is not allowed in SpiraCSS. Context: `.block-name` extends `%placeholder`. Use a mixin, CSS custom properties, or apply the styles directly. (spiracss/property-placement)'
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
              '@extend is not allowed in SpiraCSS. Context: `.block-name > .title` extends `%placeholder`. Use a mixin, CSS custom properties, or apply the styles directly. (spiracss/property-placement)'
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
              '"display" is a container-side property. Selector: `#main`. Page roots are decoration-only and cannot define layout. Create a page root Block class (e.g., ".main-container") and define "display" there. (spiracss/property-placement)'
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
              '"margin-top" is an item-side property. Selector: `#main`. Page roots are decoration-only and cannot define layout. Use a page root Block class with a direct child selector instead. Example: `.main-container > .element`. (spiracss/property-placement)'
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
              'Selector: `#main > .container`. Page-layer roots must be used alone. No extra selectors, attributes, or pseudos are allowed. Define layout on the page root Block class (e.g., ".main-container") instead. (spiracss/property-placement)'
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
              '"display" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .wrapper > .child-block`. Move "display" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"flex-grow" is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Move "flex-grow" to a direct child selector. Example: define `.block > .element` and place "flex-grow" there. (spiracss/property-placement)'
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
              '"grid-area" is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Move "grid-area" to a direct child selector. Example: define `.block > .element` and place "grid-area" there. (spiracss/property-placement)'
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
              '"grid-template-rows" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "grid-template-rows" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"grid-template" is a container-side property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "grid-template" to the child Block\'s own file, or use a Self selector like `.block` or `.block > .element`. (spiracss/property-placement)'
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
              '"padding-inline" is an internal property and cannot be used on a child Block selector. Selector: `.block-name > .child-block`. Move "padding-inline" to the child Block\'s own file. If parent control is needed, use CSS custom properties or data-variant. (spiracss/property-placement)'
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
              '"padding" is an internal property and cannot be used on a child Block selector. Selector: `.block-name > .child-block + .child-block`. Move "padding" to the child Block\'s own file. If parent control is needed, use CSS custom properties or data-variant. (spiracss/property-placement)'
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
              '"margin-top" is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name.-active`. Move "margin-top" to a direct child selector. Example: define `.block > .element` and place "margin-top" there. (spiracss/property-placement)'
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
              '@at-root is not allowed in basic/shared sections. Context: `.block-name`. Move this rule to the --interaction section, or remove @at-root and restructure the selector. (spiracss/property-placement)'
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
              '"margin-block" is an item-side property and cannot be placed on a root Block selector. Selector: `.block-name`. Move "margin-block" to a direct child selector. Example: define `.block > .element` and place "margin-block" there. (spiracss/property-placement)'
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
      }
    ]
  })
})
