import type { Plugin, Rule, RuleBase, RuleMessages } from 'stylelint'
import stylelint from 'stylelint'

export type SpiraPlugin = Plugin & { ruleName: string }

export const createRule = <P = unknown, S = unknown, M extends RuleMessages = RuleMessages>(
  ruleName: string,
  messages: M,
  rule: RuleBase<P, S>,
  meta?: Rule['meta']
): Rule<P, S, M> => Object.assign(rule, { ruleName, messages, meta })

export const createPlugin = (ruleName: string, rule: Rule): SpiraPlugin => {
  const plugin = stylelint.createPlugin(ruleName, rule) as SpiraPlugin
  plugin.ruleName = ruleName
  return plugin
}

const formatInvalidOptionValue = (value: unknown): string => {
  if (value instanceof RegExp) return `"${value.toString()}"`
  if (typeof value === 'string') return `"${value}"`
  return `"${JSON.stringify(value)}"`
}

export const reportInvalidOption = (
  result: stylelint.PostcssResult,
  ruleName: string,
  optionName: string,
  value: unknown,
  detail?: string
): void => {
  if (result.stylelint?.config?.validate === false) return
  const detailSuffix = detail ? ` (${detail})` : ''
  result.warn(
    `Invalid value ${formatInvalidOptionValue(value)} for option "${optionName}" of rule "${ruleName}"${detailSuffix}`,
    { stylelintType: 'invalidOption' }
  )
  result.stylelint.stylelintError = true
}

export type ArrayOption = { name: string; value: unknown }

export const validateArrayOptions = (
  options: ArrayOption[],
  isValid: (value: unknown) => boolean,
  reportInvalid?: (optionName: string, value: unknown, detail?: string) => void,
  detail?: string | ((optionName: string, value: unknown) => string | undefined)
): boolean => {
  let hasInvalid = false
  options.forEach(({ name, value }) => {
    if (value === undefined) return
    if (isValid(value)) return
    hasInvalid = true
    const detailText = typeof detail === 'function' ? detail(name, value) : detail
    reportInvalid?.(name, value, detailText)
  })
  return hasInvalid
}

export const validateOptionsArrayFields = (
  rawOptions: unknown,
  fieldNames: string[],
  isValid: (value: unknown) => boolean,
  reportInvalid?: (optionName: string, value: unknown, detail?: string) => void,
  detail?: string | ((optionName: string, value: unknown) => string | undefined)
): boolean => {
  const optionsObject =
    rawOptions && typeof rawOptions === 'object' ? (rawOptions as Record<string, unknown>) : null
  if (!optionsObject) return false
  const arrayOptions = fieldNames.map((name) => ({ name, value: optionsObject[name] }))
  return validateArrayOptions(arrayOptions, isValid, reportInvalid, detail)
}
