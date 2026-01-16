import safeRegex from 'safe-regex'

import type {
  NormalizedSelectorPolicyBase,
  SelectorPolicyBase,
  StateMode,
  VariantMode
} from '../types'

const ERROR_PREFIX = '[spiracss]'
const DEBUG_ENV = 'SPIRACSS_DEBUG'

const shouldReportNormalizeError = (): boolean => {
  const debug = process.env[DEBUG_ENV]
  if (!debug) return false
  if (debug === '1') return true
  return debug
    .split(',')
    .map((entry) => entry.trim())
    .includes('config')
}

const reportNormalizeError = (label: string, value: unknown): void => {
  if (!shouldReportNormalizeError()) return
  const detail = value instanceof RegExp ? value.toString() : String(value)
  console.warn(`${ERROR_PREFIX} Invalid ${label}: ${detail}`)
}

export type InvalidOptionReporter = (
  optionName: string,
  value: unknown,
  detail?: string
) => void

export const normalizeCommentPattern = (
  pattern: unknown,
  fallback: RegExp,
  label = 'comment pattern',
  reportInvalid?: InvalidOptionReporter
): RegExp => {
  const report = (value: unknown): void => {
    if (reportInvalid) reportInvalid(label, value)
    else reportNormalizeError(label, value)
  }
  const isSafe = (regex: RegExp): boolean => {
    try {
      return safeRegex(regex)
    } catch {
      return false
    }
  }
  if (pattern instanceof RegExp) {
    if (!isSafe(pattern)) {
      report(pattern)
      return fallback
    }
    return pattern
  }
  if (typeof pattern === 'string' && pattern.trim()) {
    try {
      const regex = new RegExp(pattern, 'i')
      if (!isSafe(regex)) {
        report(pattern)
        return fallback
      }
      return regex
    } catch {
      report(pattern)
      return fallback
    }
  }
  return fallback
}

export const normalizeBoolean = (
  value: unknown,
  fallback: boolean,
  options?: { coerce?: boolean }
): boolean => {
  if (value === undefined) return fallback
  if (options?.coerce) {
    if (typeof value === 'boolean') return value
    if (value instanceof Boolean) return value.valueOf()
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return Boolean(value)
  }
  return typeof value === 'boolean' ? value : fallback
}

export const normalizeString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed : fallback
}

export const normalizeStringArray = (
  value: unknown,
  fallback: string[]
): string[] => {
  if (!Array.isArray(value)) return fallback
  if (value.length === 0) return []
  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return normalized.length > 0 ? normalized : fallback
}

export const normalizeKeyList = (
  value: unknown,
  fallback: string[],
  fieldName: string,
  reportInvalid?: InvalidOptionReporter
): string[] => {
  const message = `${ERROR_PREFIX} ${fieldName} must be an array of non-empty strings.`
  if (!Array.isArray(value)) {
    if (value !== undefined) {
      reportInvalid?.(fieldName, value, message)
    }
    return [...fallback]
  }
  if (value.length === 0) {
    reportInvalid?.(fieldName, value, message)
    return [...fallback]
  }
  const list: string[] = []
  let hasInvalid = false
  value.forEach((item) => {
    if (typeof item !== 'string') {
      hasInvalid = true
      return
    }
    const trimmed = item.trim()
    if (!trimmed) {
      hasInvalid = true
      return
    }
    list.push(trimmed)
  })
  if (hasInvalid || list.length === 0) {
    reportInvalid?.(fieldName, value, message)
    return [...fallback]
  }
  return list
}

export const normalizeSelectorPolicyBase = (
  raw: unknown,
  defaults: NormalizedSelectorPolicyBase,
  reportInvalid?: InvalidOptionReporter
): NormalizedSelectorPolicyBase => {
  if (!raw || typeof raw !== 'object') return { ...defaults }
  const policy = raw as SelectorPolicyBase
  const variant = policy.variant || {}
  const state = policy.state || {}

  const variantModeRaw = variant.mode
  const hasVariantMode = Object.prototype.hasOwnProperty.call(variant, 'mode')
  if (hasVariantMode && variantModeRaw !== 'data' && variantModeRaw !== 'class') {
    throw new Error(
      `${ERROR_PREFIX} selectorPolicy.variant.mode must be "data" or "class".`
    )
  }
  const variantMode: VariantMode = variantModeRaw ?? defaults.variant.mode

  const stateModeRaw = state.mode
  const hasStateMode = Object.prototype.hasOwnProperty.call(state, 'mode')
  if (hasStateMode && stateModeRaw !== 'data' && stateModeRaw !== 'class') {
    throw new Error(
      `${ERROR_PREFIX} selectorPolicy.state.mode must be "data" or "class".`
    )
  }
  const stateMode: StateMode = stateModeRaw ?? defaults.state.mode

  const dataKeys = normalizeKeyList(
    variant.dataKeys,
    defaults.variant.dataKeys,
    'selectorPolicy.variant.dataKeys',
    reportInvalid
  )
  const dataKeyRaw = typeof state.dataKey === 'string' ? state.dataKey.trim() : ''
  const dataKey = dataKeyRaw ? dataKeyRaw : defaults.state.dataKey
  const ariaKeys = normalizeKeyList(
    state.ariaKeys,
    defaults.state.ariaKeys,
    'selectorPolicy.state.ariaKeys',
    reportInvalid
  )

  return {
    variant: {
      mode: variantMode,
      dataKeys
    },
    state: {
      mode: stateMode,
      dataKey,
      ariaKeys
    }
  }
}

const cloneSelectorPolicyBase = (
  defaults: NormalizedSelectorPolicyBase
): NormalizedSelectorPolicyBase => ({
  variant: {
    mode: defaults.variant.mode,
    dataKeys: [...defaults.variant.dataKeys]
  },
  state: {
    mode: defaults.state.mode,
    dataKey: defaults.state.dataKey,
    ariaKeys: [...defaults.state.ariaKeys]
  }
})

export const safeNormalizeSelectorPolicyBase = (
  raw: unknown,
  defaults: NormalizedSelectorPolicyBase,
  reportInvalid?: InvalidOptionReporter
): NormalizedSelectorPolicyBase => {
  try {
    return normalizeSelectorPolicyBase(raw, defaults, reportInvalid)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    reportInvalid?.('selectorPolicy', raw, detail)
    return cloneSelectorPolicyBase(defaults)
  }
}
