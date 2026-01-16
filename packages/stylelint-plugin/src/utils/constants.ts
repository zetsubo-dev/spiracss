export const ROOT_WRAPPER_NAMES = new Set([
  'layer',
  'supports',
  'media',
  'container',
  'scope'
])

export const NON_SELECTOR_AT_RULE_NAMES = new Set([
  'keyframes',
  '-webkit-keyframes',
  '-moz-keyframes',
  '-o-keyframes',
  '-ms-keyframes',
  'property'
])

export const PSEUDO_ELEMENTS = new Set([
  'before',
  'after',
  'first-letter',
  'first-line',
  'selection',
  'marker',
  'backdrop',
  'placeholder',
  'file-selector-button',
  'part',
  'slotted'
])
