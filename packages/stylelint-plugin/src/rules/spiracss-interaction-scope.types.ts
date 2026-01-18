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
  pseudos: string[]
  require: {
    atRoot: boolean
    comment: boolean
    tail: boolean
  }
  commentOnly: boolean
  comments: {
    shared: RegExp
    interaction: RegExp
  }
  selectorPolicy: NormalizedSelectorPolicy
  cache: NormalizedCacheSizes
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
