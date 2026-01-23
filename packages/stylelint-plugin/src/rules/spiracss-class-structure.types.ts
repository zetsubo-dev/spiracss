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

export type ElementOptions = {
  depth: number
}

export type ExternalOptions = {
  classes: string[]
  prefixes: string[]
}

export type ChildOptions = {
  combinator: boolean
  nesting: boolean
}

export type RootOptions = {
  single: boolean
  file: boolean
  case: FileNameCase
}

export type PathsOptions = {
  childDir: string
  components: string[]
}

export type CommentOptions = {
  shared: RegExp
  interaction: RegExp
}

export type Options = {
  element: ElementOptions
  external: ExternalOptions
  child: ChildOptions
  root: RootOptions
  paths: PathsOptions
  naming?: NamingOptions
  comments: CommentOptions
  selectorPolicy: NormalizedSelectorPolicy
  cache: NormalizedCacheSizes
}

export type ClassifyOptions = Pick<Options, 'external' | 'naming'>

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
