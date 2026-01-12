import type { Comment } from 'postcss'

import type { NamingOptions, NormalizedCacheSizes } from '../types'

export type AliasRoots = Record<string, string[]>

export type Options = {
  requireInScssDirectories: boolean
  requireWhenMetaLoadCss: boolean
  validatePath: boolean
  skipFilesWithoutRules: boolean
  requireChildRelComments: boolean
  requireChildRelCommentsInShared: boolean
  requireChildRelCommentsInInteraction: boolean
  requireParentRelComment: boolean
  childScssDir?: string
  aliasRoots?: AliasRoots
  sharedCommentPattern: RegExp
  interactionCommentPattern: RegExp
  naming?: NamingOptions
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  cacheSizes?: NormalizedCacheSizes
}

export type RelComment = {
  target: string
  node: Comment
}
