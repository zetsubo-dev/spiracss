import stylelint from 'stylelint'

import { ruleName } from './spiracss-property-placement.constants'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  containerInChildBlock: (prop: string, selector: string) =>
    `"${prop}" is a container-side property and cannot be used on a child Block selector. ` +
    `Selector: \`${selector}\`. ` +
    `Move "${prop}" to the child Block's own file, or use a Self selector like \`.block\` or \`.block > .element\`.`,
  itemInRoot: (prop: string, selector: string) =>
    `"${prop}" is an item-side property and cannot be placed on a root Block selector. ` +
    `Selector: \`${selector}\`. ` +
    `Move "${prop}" to a direct child selector. ` +
    `Example: define \`.block > .element\` and place "${prop}" there.`,
  internalInChildBlock: (prop: string, selector: string) =>
    `"${prop}" is an internal property and cannot be used on a child Block selector. ` +
    `Selector: \`${selector}\`. ` +
    `Move "${prop}" to the child Block's own file. ` +
    'If parent control is needed, use CSS custom properties or data-variant.',
  pageRootContainer: (prop: string, selector: string) =>
    `"${prop}" is a container-side property. ` +
    `Selector: \`${selector}\`. ` +
    'Page roots are decoration-only and cannot define layout. ' +
    `Create a page root Block class (e.g., ".main-container") and define "${prop}" there.`,
  pageRootItem: (prop: string, selector: string) =>
    `"${prop}" is an item-side property. ` +
    `Selector: \`${selector}\`. ` +
    'Page roots are decoration-only and cannot define layout. ' +
    'Use a page root Block class with a direct child selector instead. ' +
    'Example: `.main-container > .element`.',
  pageRootInternal: (prop: string, selector: string) =>
    `"${prop}" is an internal property. ` +
    `Selector: \`${selector}\`. ` +
    'Page roots are decoration-only and cannot define layout. ' +
    `Define "${prop}" on the page root Block class instead.`,
  pageRootNoChildren: (selector: string) =>
    `Selector: \`${selector}\`. ` +
    'Page-layer roots must be used alone. ' +
    'No extra selectors, attributes, or pseudos are allowed. ' +
    'Define layout on the page root Block class (e.g., ".main-container") instead.',
  forbiddenAtRoot: (selector: string) =>
    '@at-root is not allowed in basic/shared sections. ' +
    `Context: \`${selector}\`. ` +
    'Move this rule to the --interaction section, or remove @at-root and restructure the selector.',
  forbiddenExtend: (selector: string, placeholder: string) =>
    '@extend is not allowed in SpiraCSS. ' +
    `Context: \`${selector}\` extends \`${placeholder}\`. ` +
    'Use a mixin, CSS custom properties, or apply the styles directly.'
})
