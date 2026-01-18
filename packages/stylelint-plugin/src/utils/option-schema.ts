import { isPlainObject } from './validate'

export const COMMENTS_SCHEMA = {
  comments: [isPlainObject]
}

export const NAMING_SCHEMA = {
  naming: [isPlainObject]
}

export const POLICY_SCHEMA = {
  selectorPolicy: [isPlainObject]
}

export const EXTERNAL_SCHEMA = {
  external: [isPlainObject]
}

export const PATHS_SCHEMA = {
  paths: [isPlainObject]
}

export const CACHE_SCHEMA = {
  cache: [isPlainObject]
}
