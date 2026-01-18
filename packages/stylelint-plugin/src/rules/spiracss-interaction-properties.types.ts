import type { NamingOptions, NormalizedCacheSizes } from '../types'

export type Options = {
  comments: {
    shared: RegExp
    interaction: RegExp
  }
  naming?: NamingOptions
  external: {
    classes: string[]
    prefixes: string[]
  }
  cache: NormalizedCacheSizes
}
