import type { NamingOptions, NormalizedCacheSizes } from '../types'

export type BlockNameSource = 'selector' | 'file' | 'selector-or-file'

export type Options = {
  actionMaxWords: number
  blockNameSource: BlockNameSource
  warnOnMissingBlock: boolean
  sharedPrefixes: string[]
  sharedFiles: RegExp[]
  ignoreFiles: RegExp[]
  ignorePatterns: RegExp[]
  ignorePlacementForIgnored: boolean
  naming?: NamingOptions
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  cacheSizes: NormalizedCacheSizes
}
