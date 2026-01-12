import { isPlainObject, isRegExp, isString } from './validate'

export const SHARED_COMMENT_PATTERN_SCHEMA = {
  sharedCommentPattern: [isRegExp, isString]
}

export const INTERACTION_COMMENT_PATTERN_SCHEMA = {
  interactionCommentPattern: [isRegExp, isString]
}

export const NAMING_SCHEMA = {
  naming: [isPlainObject]
}

export const SELECTOR_POLICY_SCHEMA = {
  selectorPolicy: [isPlainObject]
}

export const CACHE_SIZES_SCHEMA = {
  cacheSizes: [isPlainObject]
}
