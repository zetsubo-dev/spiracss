import type {
  NormalizedCacheSizes,
  NormalizedSelectorPolicyBase,
  SelectorPolicyBase,
  StateMode as SelectorStateMode,
  VariantMode as SelectorVariantMode
} from '../types'
import type { SelectorPolicySetsBase } from '../utils/selector-policy'

export type SelectorPolicy = SelectorPolicyBase
export type NormalizedSelectorPolicy = NormalizedSelectorPolicyBase

export type VariantMode = SelectorVariantMode
export type StateMode = SelectorStateMode

export type Options = {
  allowedPseudos: string[]
  requireAtRoot: boolean
  requireComment: boolean
  requireTail: boolean
  enforceWithCommentOnly: boolean
  interactionCommentPattern: RegExp
  selectorPolicy: NormalizedSelectorPolicy
  cacheSizes: NormalizedCacheSizes
}

export type SelectorAttrState = {
  hasVariant: boolean
  hasState: boolean
  hasMixed: boolean
}

export type SelectorPolicySets = SelectorPolicySetsBase

export type SelectorAnalysis = SelectorAttrState & {
  hasAllowedPseudo: boolean
}
