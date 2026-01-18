import type { CacheSizes, NamingOptions, NormalizedCacheSizes } from '../types'
import { normalizeCacheSizes } from './cache'
import {
  type InvalidOptionReporter,
  normalizeCommentPattern,
  normalizeStringArray
} from './normalize'

type CommonOptionsInput = Partial<{
  comments: {
    shared?: RegExp | string
    interaction?: RegExp | string
  }
  naming: NamingOptions
  external: {
    classes?: string[]
    prefixes?: string[]
  }
  cache: CacheSizes
}>

type CommonOptionValues = {
  comments: {
    shared: RegExp
    interaction: RegExp
  }
  naming: NamingOptions | undefined
  external: {
    classes: string[]
    prefixes: string[]
  }
  cache: NormalizedCacheSizes
}

type CommonOptionsDefaults = Partial<CommonOptionValues>

type NormalizedCommonOptions<T extends CommonOptionsDefaults> = {
  [K in keyof T]-?: CommonOptionValues[K & keyof CommonOptionValues]
}

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

export const normalizeCommonOptions = <T extends CommonOptionsDefaults>(
  raw: CommonOptionsInput,
  defaults: T,
  reportInvalid?: InvalidOptionReporter
): NormalizedCommonOptions<T> => {
  const result: Partial<CommonOptionValues> = {}
  const rawComments = raw.comments
  const rawExternal = raw.external

  if (hasOwn(defaults, 'comments')) {
    const fallback = defaults.comments as CommonOptionValues['comments']
    result.comments = {
      shared: normalizeCommentPattern(
        rawComments?.shared,
        fallback.shared,
        'comments.shared',
        reportInvalid
      ),
      interaction: normalizeCommentPattern(
        rawComments?.interaction,
        fallback.interaction,
        'comments.interaction',
        reportInvalid
      )
    }
  }

  if (hasOwn(defaults, 'naming')) {
    result.naming = raw.naming ?? defaults.naming
  }

  if (hasOwn(defaults, 'external')) {
    const fallback = defaults.external as CommonOptionValues['external']
    result.external = {
      classes: normalizeStringArray(rawExternal?.classes, fallback.classes ?? []),
      prefixes: normalizeStringArray(rawExternal?.prefixes, fallback.prefixes ?? [])
    }
  }

  if (hasOwn(defaults, 'cache')) {
    result.cache = normalizeCacheSizes(raw.cache, reportInvalid)
  }

  return result as NormalizedCommonOptions<T>
}

export const pickCommonDefaults = (defaults: CommonOptionsDefaults): CommonOptionsDefaults => ({
  comments: defaults.comments,
  naming: defaults.naming,
  external: defaults.external,
  cache: defaults.cache
})
