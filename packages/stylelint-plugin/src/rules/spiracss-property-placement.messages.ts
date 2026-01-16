import stylelint from 'stylelint'

import { ruleName } from './spiracss-property-placement.constants'
import type { WordCase } from '../types'
import {
  formatCode,
  formatConfigList,
  formatPattern,
  formatSelectorParseFailed,
  type RuleMessageArg,
  type RuleMessageArgs
} from '../utils/messages'

const formatModifierHint = (
  modifierPrefix: string,
  modifierCase: WordCase,
  customModifierPattern: RegExp | string
): string => {
  if (customModifierPattern) {
    return `use modifier classes matching ${formatCode(
      'naming.customPatterns.modifier'
    )} (current: ${formatPattern(customModifierPattern)})`
  }
  const prefixLabel = modifierPrefix === '' ? '(none)' : modifierPrefix
  const example =
    modifierPrefix === '' ? '&.<modifier>' : `&.${modifierPrefix}<modifier>`
  return `use modifier classes (prefix: ${formatCode(
    prefixLabel
  )}, case: ${formatCode(modifierCase)}; e.g., ${formatCode(example)})`
}

const formatPolicyHint = (
  label: 'variant' | 'state',
  mode: string,
  keys: string[],
  modifierPrefix: string,
  modifierCase: WordCase,
  customModifierPattern: RegExp | string
): string => {
  if (mode === 'class') {
    return formatModifierHint(
      modifierPrefix,
      modifierCase,
      customModifierPattern
    )
  }
  const attrType = label === 'variant' ? 'data' : 'state'
  return `use ${attrType} attributes (keys: ${formatConfigList(keys)})`
}

const pageRootBase = (prop: string, selector: string, propType: string): string =>
  `${formatCode(prop)} is ${propType}. ` +
  `Selector: ${formatCode(selector)}. ` +
  'Page roots are decoration-only and cannot define layout. '

const internalInChildBlockBase = (prop: string, selector: string): string =>
  `${formatCode(
    prop
  )} is an internal property (affects the Block's own content/layout) ` +
  'and cannot be used on a child Block selector. ' +
  `Selector: ${formatCode(selector)}. ` +
  `Move ${formatCode(prop)} to the child Block's own file. ` +
  `To control it from parent, expose a CSS variable (e.g., ${formatCode(
    `--child-${prop}`
  )}) and consume it in the child Block, or use the project's variant mechanism.`

const internalInChildBlockVariantHint = (
  variantMode: string,
  variantKeys: string[],
  modifierPrefix: string,
  modifierCase: WordCase,
  customModifierPattern: RegExp | string
): string =>
  `Variant (${formatCode(variantMode)}): ${formatPolicyHint(
    'variant',
    variantMode,
    variantKeys,
    modifierPrefix,
    modifierCase,
    customModifierPattern
  )}.`

const internalInChildBlockStateHint = (
  stateMode: string,
  stateKeys: string[],
  modifierPrefix: string,
  modifierCase: WordCase,
  customModifierPattern: RegExp | string
): string =>
  `State (${formatCode(stateMode)}): ${formatPolicyHint(
    'state',
    stateMode,
    stateKeys,
    modifierPrefix,
    modifierCase,
    customModifierPattern
  )}.`

type PositionUnknownReason = 'dynamic' | 'unknown'

const isPositionUnknownReason = (
  value: RuleMessageArg | undefined
): value is PositionUnknownReason => value === 'dynamic' || value === 'unknown'

export const messages = stylelint.utils.ruleMessages(ruleName, {
  containerInChildBlock: (prop: string, selector: string) =>
    `${formatCode(
      prop
    )} is a container-side property (defines internal layout) and cannot be used on a child Block selector. ` +
    `Selector: ${formatCode(selector)}. ` +
    `If the parent should be the container, apply ${formatCode(
      prop
    )} on the parent Block selector. ` +
    `If the child should be the container, move ${formatCode(
      prop
    )} to the child Block's own stylesheet ` +
    '(the file where that Block is defined).',
  itemInRoot: (prop: string, selector: string) =>
    `${formatCode(
      prop
    )} is an item-side property and cannot be placed on a root Block selector. ` +
    `Selector: ${formatCode(selector)}. ` +
    'Root Blocks should not define their own placement; the parent layout controls item spacing. ' +
    `Move ${formatCode(
      prop
    )} to a direct child selector under the parent Block ` +
    `(use the parent file that places this Block, typically linked via ${formatCode(
      '@rel'
    )}).`,
  selectorKindMismatch: (selector: string) =>
    `Selector list mixes incompatible kinds (root/element/child Block). ` +
    `Selector: ${formatCode(selector)}. ` +
    'Split selectors into separate rules so placement checks can be applied correctly.',
  marginSideViolation: (prop: string, selector: string, disallowedSide: 'top' | 'bottom') =>
    `${formatCode(
      prop
    )} uses a ${disallowedSide} margin value, which violates the margin-side rule. ` +
    `Selector: ${formatCode(selector)}. ` +
    'SpiraCSS enforces a single margin direction. ' +
    `Use ${disallowedSide === 'top' ? 'bottom' : 'top'} margins or set the ${disallowedSide} value to ` +
    `${formatCode('0')}/${formatCode('auto')}/${formatCode('initial')}.`,
  internalInChildBlock: (
    prop: string,
    selector: string,
    variantMode: string,
    variantKeys: string[],
    stateMode: string,
    stateKeys: string[],
    modifierPrefix: string,
    modifierCase: WordCase,
    customModifierPattern: RegExp | string
  ) =>
    `${internalInChildBlockBase(prop, selector)} ` +
    `${internalInChildBlockVariantHint(
      variantMode,
      variantKeys,
      modifierPrefix,
      modifierCase,
      customModifierPattern
    )} ` +
    `${internalInChildBlockStateHint(
      stateMode,
      stateKeys,
      modifierPrefix,
      modifierCase,
      customModifierPattern
    )}`,
  positionInChildBlock: (
    value: string,
    selector: string,
    responsiveMixins: string[],
    unknownReason?: RuleMessageArg
  ) => {
    const base = formatCode(`position: ${value}`)
    const selectorPart = `Selector: ${formatCode(selector)}. `
    const moveHint = `Move ${formatCode(
      `position: ${value}`
    )} to the child Block's own file.`
    const moveHintLower = moveHint.replace(/^Move /, 'move ')
    const fixedStickyHint = `If you need ${formatCode(
      'fixed'
    )}/${formatCode('sticky')}, define it in the child Block's own file.`
    const lowered = value.toLowerCase()
    if (lowered === 'fixed' || lowered === 'sticky') {
      return (
        `${base} is not allowed on a child Block selector. ` + selectorPart + fixedStickyHint
      )
    }
    if (lowered === 'relative' || lowered === 'absolute') {
      return (
        `${base} requires offset properties on a child Block selector. ` +
        selectorPart +
        `Add ${formatCode('top')}/${formatCode('right')}/${formatCode(
          'bottom'
        )}/${formatCode('left')}/${formatCode('inset')}/${formatCode(
          'inset-block'
        )}/${formatCode('inset-inline')}/${formatCode(
          'inset-block-start'
        )}/${formatCode('inset-block-end')}/${formatCode(
          'inset-inline-start'
        )}/${formatCode('inset-inline-end')} ` +
        `in the same wrapper context (e.g., ${formatCode(
          '@media'
        )}/${formatCode('@supports')}/${formatCode(
          '@container'
        )}/${formatCode('@layer')}/${formatCode(
          '@scope'
        )}, or ${formatCode('@include')} listed in ${formatCode(
          'responsiveMixins'
        )} (current: ${formatConfigList(responsiveMixins)}), ` +
        `or ${moveHintLower}`
      )
    }
    return (
      `${base} is not allowed on a child Block selector. ` +
      selectorPart +
      `${isPositionUnknownReason(unknownReason) && unknownReason === 'dynamic' ? 'Dynamic values are not allowed here. ' : ''}` +
      `Use ${formatCode('static')}, or use ${formatCode(
        'relative'
      )}/${formatCode(
        'absolute'
      )} with offsets in the same wrapper context. ` +
      fixedStickyHint
    )
  },
  pageRootContainer: (prop: string, selector: string) =>
    pageRootBase(prop, selector, 'a container-side property') +
    `Create a page root Block class and define ${formatCode(prop)} there.`,
  pageRootItem: (prop: string, selector: string) =>
    pageRootBase(prop, selector, 'an item-side property') +
    'Use a page root Block class with a direct child selector instead.',
  pageRootInternal: (prop: string, selector: string) =>
    pageRootBase(prop, selector, 'an internal property') +
    `Define ${formatCode(prop)} on the page root Block class instead.`,
  pageRootNoChildren: (selector: string) =>
    `Selector: ${formatCode(selector)}. ` +
    'Page-layer roots must be used alone. ' +
    'No extra selectors, attributes, or pseudos are allowed. ' +
    'Define layout on the page root Block class instead.',
  forbiddenAtRoot: (selector: string, pattern: RegExp) =>
    `${formatCode('@at-root')} is not allowed in basic/shared sections. ` +
    `Context: ${formatCode(selector)}. ` +
    `${formatCode(
      '@at-root'
    )} breaks selector hierarchy and should only be used for interaction states. ` +
    `Move this rule to the interaction section using ${formatCode(
      'interactionCommentPattern'
    )} (current: ${formatPattern(
      pattern
    )}), ` +
    `or remove ${formatCode('@at-root')} and restructure the selector.`,
  forbiddenExtend: (selector: string, placeholder: string) =>
    `${formatCode('@extend')} is not allowed in SpiraCSS. ` +
    `Context: ${formatCode(selector)} extends ${formatCode(placeholder)}. ` +
    `${formatCode(
      '@extend'
    )} creates implicit dependencies and can cause unexpected selector merging. ` +
    'Use a mixin, CSS custom properties, or apply the styles directly.',
  selectorResolutionSkipped: (limit: RuleMessageArg, example?: RuleMessageArg) => {
    const limitText = formatCode(String(limit))
    const exampleText =
      example !== undefined
        ? ` Example: ${formatCode(String(example), { maxChars: 80 })}.`
      : ''
    return (
      `Selector resolution exceeded ${limitText} combinations, so some checks were skipped.` +
      exampleText
    )
  },
  selectorParseFailed: (...args: RuleMessageArgs) => formatSelectorParseFailed(args[0])
})
