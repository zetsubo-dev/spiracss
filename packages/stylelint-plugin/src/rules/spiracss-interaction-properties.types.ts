import type { NamingOptions, NormalizedCacheSizes } from '../types'

export type Options = {
  sharedCommentPattern: RegExp
  interactionCommentPattern: RegExp
  naming?: NamingOptions
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  cacheSizes?: NormalizedCacheSizes
}
