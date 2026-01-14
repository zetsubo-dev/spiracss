export type WordCase = 'kebab' | 'snake' | 'camel' | 'pascal'

export type FileNameCase = 'preserve' | WordCase

export type CacheSizes = {
  selector?: number
  patterns?: number
  naming?: number
  path?: number
}

export type NormalizedCacheSizes = {
  selector: number
  patterns: number
  naming: number
  path: number
}

export type VariantMode = 'data' | 'class'
export type StateMode = 'data' | 'class'

export type SelectorPolicyBase = {
  variant?: {
    mode?: VariantMode
    dataKeys?: string[]
  }
  state?: {
    mode?: StateMode
    dataKey?: string
    ariaKeys?: string[]
  }
}

export type NormalizedSelectorPolicyBase = {
  variant: {
    mode: VariantMode
    dataKeys: string[]
  }
  state: {
    mode: StateMode
    dataKey: string
    ariaKeys: string[]
  }
}

export type NamingOptions = {
  /**
   * Block name style (default: 'kebab' = hero-banner).
   */
  blockCase?: WordCase
  /**
   * Max words for Block name (default: 2). The minimum is fixed at 2.
   */
  blockMaxWords?: number
  /**
   * Element name style (default: 'kebab' = title).
   */
  elementCase?: WordCase
  /**
   * Modifier segment style (default: 'kebab' = primary-large).
   */
  modifierCase?: WordCase
  /**
   * Modifier prefix (default: '-' -> .block.-primary).
   */
  modifierPrefix?: string
  /**
   * Escape hatch for fully custom patterns.
   * Overrides block/element/modifier regexes when provided.
   */
  customPatterns?: {
    block?: RegExp
    element?: RegExp
    modifier?: RegExp
  }
}

export type {
  Kind as ClassStructureKind,
  NormalizedSelectorPolicy as ClassStructureNormalizedSelectorPolicy,
  Options as ClassStructureOptions,
  Patterns as ClassStructurePatterns,
  SelectorPolicy as ClassStructureSelectorPolicy,
  SelectorPolicyData as ClassStructureSelectorPolicyData,
  ValueNaming as ClassStructureValueNaming,
  ValueNamingOptions as ClassStructureValueNamingOptions
} from './rules/spiracss-class-structure.types'

export type {
  Options as InteractionScopeOptions,
  NormalizedSelectorPolicy as InteractionScopeNormalizedSelectorPolicy,
  SelectorAnalysis as InteractionScopeSelectorAnalysis,
  SelectorAttrState as InteractionScopeSelectorAttrState,
  SelectorPolicy as InteractionScopeSelectorPolicy,
  SelectorPolicySets as InteractionScopeSelectorPolicySets,
  StateMode as InteractionScopeStateMode,
  VariantMode as InteractionScopeVariantMode
} from './rules/spiracss-interaction-scope.types'

export type { Options as InteractionPropertiesOptions } from './rules/spiracss-interaction-properties.types'

export type {
  AliasRoots as RelCommentsAliasRoots,
  Options as RelCommentsOptions,
  RelComment as RelCommentsRelComment
} from './rules/spiracss-rel-comments.types'

export type { Options as PropertyPlacementOptions } from './rules/spiracss-property-placement.types'

export type { Options as KeyframesNamingOptions } from './rules/spiracss-keyframes-naming.types'

export type { Options as PseudoNestingOptions } from './rules/spiracss-pseudo-nesting.types'
