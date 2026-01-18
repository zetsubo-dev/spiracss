import type { NamingOptions, NormalizedCacheSizes } from '../types'

export type BlockNameSource = 'selector' | 'file' | 'selector-or-file'

export type Options = {
  action: {
    maxWords: number
  }
  block: {
    source: BlockNameSource
    warnMissing: boolean
  }
  shared: {
    prefixes: string[]
    files: RegExp[]
  }
  ignore: {
    files: RegExp[]
    patterns: RegExp[]
    skipPlacement: boolean
  }
  naming?: NamingOptions
  external: {
    classes: string[]
    prefixes: string[]
  }
  cache: NormalizedCacheSizes
}
