import type { NamingOptions } from './generator-core'

type WarnReporter = (message: string) => void

const CUSTOM_PATTERN_KEYS = ['block', 'element', 'modifier'] as const

const formatCustomPatternKey = (
  key: (typeof CUSTOM_PATTERN_KEYS)[number]
): string => `stylelint.classStructure.naming.customPatterns.${key}`

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export const warnInvalidCustomPatterns = (
  naming: NamingOptions,
  warn: WarnReporter
): void => {
  const raw = naming.customPatterns as unknown
  if (raw === undefined) return
  if (!isPlainObject(raw)) {
    warn(
      'WARN [INVALID_CUSTOM_PATTERN] stylelint.classStructure.naming.customPatterns must be a plain object of RegExp values. Ignored.'
    )
    return
  }

  CUSTOM_PATTERN_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) return
    const value = (raw as Record<string, unknown>)[key]
    if (value === undefined) return
    if (!(value instanceof RegExp)) {
      warn(
        `WARN [INVALID_CUSTOM_PATTERN] ${formatCustomPatternKey(
          key
        )} must be a RegExp. Ignored.`
      )
      return
    }
    if (value.flags.includes('g') || value.flags.includes('y')) {
      warn(
        `WARN [INVALID_CUSTOM_PATTERN] ${formatCustomPatternKey(
          key
        )} must not include "g" or "y" flags. Ignored.`
      )
    }
  })
}
