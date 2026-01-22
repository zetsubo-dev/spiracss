import type { NamingOptions, NormalizedCacheSizes } from '../types'

export type AliasRoots = Record<string, string[]>

export type Options = {
  pageEntry: {
    alias: string
    subdir: string
  }
  paths: {
    components: string[]
    aliases?: AliasRoots
  }
  naming?: NamingOptions
  external: {
    classes: string[]
    prefixes: string[]
  }
  cache: NormalizedCacheSizes
}
