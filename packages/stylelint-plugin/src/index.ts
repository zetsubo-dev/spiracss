import spiracssClassStructure from './rules/spiracss-class-structure'
import spiracssInteractionProperties from './rules/spiracss-interaction-properties'
import spiracssInteractionScope from './rules/spiracss-interaction-scope'
import spiracssKeyframesNaming from './rules/spiracss-keyframes-naming'
import spiracssPageLayer from './rules/spiracss-page-layer'
import spiracssPropertyPlacement from './rules/spiracss-property-placement'
import spiracssPseudoNesting from './rules/spiracss-pseudo-nesting'
import spiracssRelComments from './rules/spiracss-rel-comments'

// Stylelint v17 plugin format:
// default export is an array of rule plugin definitions.
export default [
  spiracssClassStructure,
  spiracssPageLayer,
  spiracssInteractionScope,
  spiracssInteractionProperties,
  spiracssKeyframesNaming,
  spiracssPropertyPlacement,
  spiracssPseudoNesting,
  spiracssRelComments
]

// Helper to build SpiraCSS rules from spiracss.config.js
export { createRules, createRulesAsync } from './helpers'
