import type { CacheSizes, NamingOptions, NormalizedCacheSizes } from '../types'
import { normalizeCacheSizes } from './cache'
import {
  type InvalidOptionReporter,
  normalizeCommentPattern,
  normalizeStringArray
} from './normalize'

type CommonOptionsInput = Partial<{
  sharedCommentPattern: RegExp | string
  interactionCommentPattern: RegExp | string
  naming: NamingOptions
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  cacheSizes: CacheSizes
}>

type CommonOptionValues = {
  sharedCommentPattern: RegExp
  interactionCommentPattern: RegExp
  naming: NamingOptions | undefined
  allowExternalClasses: string[]
  allowExternalPrefixes: string[]
  cacheSizes: NormalizedCacheSizes
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

  if (hasOwn(defaults, 'sharedCommentPattern')) {
    result.sharedCommentPattern = normalizeCommentPattern(
      raw.sharedCommentPattern,
      defaults.sharedCommentPattern as RegExp,
      'sharedCommentPattern',
      reportInvalid
    )
  }

  if (hasOwn(defaults, 'interactionCommentPattern')) {
    result.interactionCommentPattern = normalizeCommentPattern(
      raw.interactionCommentPattern,
      defaults.interactionCommentPattern as RegExp,
      'interactionCommentPattern',
      reportInvalid
    )
  }

  if (hasOwn(defaults, 'naming')) {
    result.naming = raw.naming ?? defaults.naming
  }

  if (hasOwn(defaults, 'allowExternalClasses')) {
    result.allowExternalClasses = normalizeStringArray(
      raw.allowExternalClasses,
      defaults.allowExternalClasses ?? []
    )
  }

  if (hasOwn(defaults, 'allowExternalPrefixes')) {
    result.allowExternalPrefixes = normalizeStringArray(
      raw.allowExternalPrefixes,
      defaults.allowExternalPrefixes ?? []
    )
  }

  if (hasOwn(defaults, 'cacheSizes')) {
    result.cacheSizes = normalizeCacheSizes(raw.cacheSizes, reportInvalid)
  }

  return result as NormalizedCommonOptions<T>
}

export const pickCommonDefaults = (defaults: CommonOptionsDefaults): CommonOptionsDefaults => ({
  sharedCommentPattern: defaults.sharedCommentPattern,
  interactionCommentPattern: defaults.interactionCommentPattern,
  naming: defaults.naming,
  allowExternalClasses: defaults.allowExternalClasses,
  allowExternalPrefixes: defaults.allowExternalPrefixes,
  cacheSizes: defaults.cacheSizes
})
