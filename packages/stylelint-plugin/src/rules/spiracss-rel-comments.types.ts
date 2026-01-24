import type { Comment } from 'postcss'

import type { FileNameCase, NamingOptions, NormalizedCacheSizes } from '../types'

export type AliasRoots = Record<string, string[]>

export type Options = {
  require: {
    scss: boolean
    meta: boolean
    parent: boolean
    child: {
      enabled: boolean
      shared: boolean
      interaction: boolean
    }
  }
  fileCase: FileNameCase
  validate: {
    path: boolean
  }
  skip: {
    noRules: boolean
  }
  paths: {
    childDir: string
    aliases?: AliasRoots
  }
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

export type RelComment = {
  target: string
  node: Comment
}
