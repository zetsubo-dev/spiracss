import type {
  FileNameCase,
  NamingOptions,
  NormalizedCacheSizes,
  NormalizedSelectorPolicyBase,
  SelectorPolicyBase,
  WordCase
} from '../types'

export type { FileNameCase }

export type ValueNamingOptions = {
  case?: WordCase
  maxWords?: number
}

export type ValueNaming = {
  case: WordCase
  maxWords: number
}

export type SelectorPolicy = SelectorPolicyBase & {
  valueNaming?: ValueNamingOptions
  variant?: SelectorPolicyBase['variant'] & { valueNaming?: ValueNamingOptions }
  state?: SelectorPolicyBase['state'] & { valueNaming?: ValueNamingOptions }
}

export type NormalizedSelectorPolicy = NormalizedSelectorPolicyBase & {
  valueNaming: ValueNaming
  variant: NormalizedSelectorPolicyBase['variant'] & { valueNaming: ValueNaming }
  state: NormalizedSelectorPolicyBase['state'] & { valueNaming: ValueNaming }
}

export type Options = {
  allowElementChainDepth: number
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  enforceChildCombinator: boolean
  enforceSingleRootBlock: boolean
  enforceRootFileName: boolean
  rootFileCase: FileNameCase
  childScssDir: string
  componentsDirs: string[]
  naming?: NamingOptions
  sharedCommentPattern: RegExp
  interactionCommentPattern: RegExp
  selectorPolicy: NormalizedSelectorPolicy
  cacheSizes: NormalizedCacheSizes
}

export type Patterns = {
  blockRe: RegExp
  elementRe: RegExp
  modifierRe: RegExp
}

export type SelectorPolicyData = {
  reservedVariantKeys: Set<string>
  reservedStateKey: string
  reservedAriaKeys: Set<string>
  variantValuePattern: RegExp
  stateValuePattern: RegExp
}

export type Kind = 'block' | 'element' | 'modifier' | 'external' | 'invalid'
