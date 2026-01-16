import type {
  NamingOptions,
  NormalizedCacheSizes,
  NormalizedSelectorPolicyBase
} from '../types'

export type Options = {
  allowElementChainDepth: number
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  marginSide: 'top' | 'bottom'
  enablePosition: boolean
  enableSizeInternal: boolean
  responsiveMixins: string[]
  naming?: NamingOptions
  selectorPolicy: NormalizedSelectorPolicyBase
  sharedCommentPattern: RegExp
  interactionCommentPattern: RegExp
  cacheSizes: NormalizedCacheSizes
}
