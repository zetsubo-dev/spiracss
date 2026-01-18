import stylelint from 'stylelint'

import { getRuleDocsUrl } from './rule-docs'

const DEFAULT_CODE_MAX_CHARS = 120
const DEFAULT_LIST_MAX_CHARS = 200
const DEFAULT_LIST_MAX_ITEMS = 5
const DEFAULT_LIST_MAX_ITEM_CHARS = 36

export const SELECTOR_PARSE_FAILED =
  'Failed to parse one or more selectors, so some checks were skipped. ' +
  'Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors.'

export type RuleMessageArg =
  | string
  | number
  | boolean
  | RegExp
  | Array<string | RegExp>

export type RuleMessageArgs = RuleMessageArg[]

const appendDocsLink = (message: string, ruleName: string): string => {
  const docsUrl = getRuleDocsUrl(ruleName)
  if (!docsUrl) return message
  if (message.includes('Docs:')) return message
  const suffix = `Docs: ${docsUrl}`
  const ruleTag = ` (${ruleName})`
  if (message.endsWith(ruleTag)) {
    return message.slice(0, -ruleTag.length) + ` ${suffix}` + ruleTag
  }
  const separator = message.endsWith('.') || message.endsWith('!') ? ' ' : '. '
  return `${message}${separator}${suffix}`
}

type RuleMessageValue = string | ((...args: any[]) => string)

export const createRuleMessages = <T extends Record<string, unknown>>(
  ruleName: string,
  messages: T
): T => {
  const wrapped: Record<string, RuleMessageValue> = {}
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'function') {
      wrapped[key] = (...args: any[]) =>
        appendDocsLink(
          (value as (...args: any[]) => string)(...args),
          ruleName
        )
      continue
    }
    wrapped[key] = appendDocsLink(value as string, ruleName)
  }
  return stylelint.utils.ruleMessages(ruleName, wrapped) as T
}

export { appendDocsLink }

const normalizeSelectorExample = (example: RuleMessageArg | undefined): string | undefined => {
  if (example === undefined) return undefined
  if (typeof example === 'string') return example
  if (typeof example === 'number' || typeof example === 'boolean') return String(example)
  if (example instanceof RegExp) return example.toString()
  if (Array.isArray(example)) {
    return example
      .map((entry) => (entry instanceof RegExp ? entry.toString() : String(entry)))
      .join(', ')
  }
  return String(example)
}

export const formatSelectorParseFailed = (example?: RuleMessageArg): string => {
  const normalized = normalizeSelectorExample(example)
  if (!normalized) return SELECTOR_PARSE_FAILED
  return `${SELECTOR_PARSE_FAILED} Example: ${formatCode(normalized, {
    maxChars: 80
  })}.`
}

export const selectorParseFailedArgs = (
  example?: string | null
): RuleMessageArgs => (example ? [example] : [])

const trimTo = (value: string, maxChars: number): string => {
  if (maxChars <= 0) return ''
  if (value.length <= maxChars) return value
  if (maxChars <= 3) return value.slice(0, maxChars)
  return value.slice(0, maxChars - 3) + '...'
}

export const escapeInlineCode = (value: string): string => {
  const normalized = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  return normalized.replace(/`/g, '\\`').replace(/\n/g, '\\n')
}

export const formatCode = (
  value: string,
  options?: { maxChars?: number }
): string => {
  const maxChars = options?.maxChars ?? DEFAULT_CODE_MAX_CHARS
  const escaped = escapeInlineCode(value)
  // Keep inline-code formatting even for empty/disabled outputs.
  if (maxChars <= 0) return '``'
  return `\`${trimTo(escaped, maxChars)}\``
}

export const formatPattern = (
  pattern: RegExp | string,
  options?: { maxChars?: number }
): string => {
  const value = typeof pattern === 'string' ? pattern : pattern.toString()
  return formatCode(value, options)
}

type FormatListOptions = {
  maxItems?: number
  maxItemChars?: number
  maxChars?: number
  separator?: string
  emptyValue?: string
}

export const formatList = (
  items: Array<string | RegExp>,
  options?: FormatListOptions
): string => {
  // maxChars is a soft ceiling; the +2 keeps backticks/suffixes readable.
  const {
    maxItems = DEFAULT_LIST_MAX_ITEMS,
    maxItemChars = DEFAULT_LIST_MAX_ITEM_CHARS,
    maxChars = DEFAULT_LIST_MAX_CHARS,
    separator = ', ',
    emptyValue = 'none'
  } = options ?? {}

  const softMaxChars = maxChars + 2
  const maxItemCharsForList = Math.max(1, Math.min(maxItemChars, softMaxChars))
  const codeOverhead = 2
  const minimumItemChars = 3
  const minItemFootprint = minimumItemChars + codeOverhead

  if (items.length === 0) {
    return formatCode(emptyValue, { maxChars: maxItemCharsForList })
  }

  const maxCount = Math.max(
    1,
    Math.min(
      maxItems,
      Math.floor((softMaxChars + separator.length) / (minItemFootprint + separator.length))
    )
  )
  const totalCount = items.length
  const values: string[] = []
  for (let i = 0; i < Math.min(totalCount, maxCount); i += 1) {
    const item = items[i]
    values.push(item instanceof RegExp ? item.toString() : String(item))
  }
  const buildItems = (count: number, perItemChars: number): string[] =>
    values
      .slice(0, count)
      .map((value) => formatCode(value, { maxChars: perItemChars }))

  const suffixVariants = (remaining: number): string[] => [
    `... (+${remaining} more)`,
    `(+${remaining} more)`,
    `+${remaining}`
  ]

  const tryBuildOutput = (count: number): string | null => {
    const remaining = totalCount - count
    const separatorsLength = separator.length * Math.max(0, count - 1)
    const variants = remaining > 0 ? suffixVariants(remaining) : ['']

    for (const suffixText of variants) {
      const suffixToken =
        remaining > 0 ? formatCode(suffixText, { maxChars: softMaxChars }) : ''
      if (remaining > 0 && !suffixToken.includes(String(remaining))) continue
      const suffixPart =
        remaining > 0
          ? count > 0
            ? `${separator}${suffixToken}`
            : suffixToken
          : ''
      const availableForItems =
        softMaxChars - suffixPart.length - separatorsLength - codeOverhead * count
      if (count === 0) {
        // When no items fit, return only the remaining-count suffix.
        if (suffixPart.length <= softMaxChars) {
          return suffixPart
        }
        continue
      }
      if (availableForItems < count * minimumItemChars) continue
      const perItemChars = Math.min(
        maxItemCharsForList,
        Math.floor(availableForItems / count)
      )
      if (perItemChars < minimumItemChars) continue
      const formattedItems = buildItems(count, perItemChars)
      const output = formattedItems.join(separator) + suffixPart
      if (output.length <= softMaxChars) return output
    }
    return null
  }

  for (let count = Math.min(totalCount, maxCount); count >= 0; count -= 1) {
    const output = tryBuildOutput(count)
    if (output) return output
  }

  const remaining = totalCount
  const fallbackSuffix = suffixVariants(remaining).at(-1) ?? ''
  return formatCode(fallbackSuffix, { maxChars: Math.max(1, maxChars) })
}

export const formatConfigList = (
  items: Array<string | RegExp>,
  options?: FormatListOptions
): string => {
  const maxItems = options?.maxItems ?? Math.max(items.length, 1)
  return formatList(items, { ...options, maxItems })
}
