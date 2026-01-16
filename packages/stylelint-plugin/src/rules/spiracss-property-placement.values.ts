import valueParser from 'postcss-value-parser'

type ValueToken = { type: 'word' | 'function' | 'string'; value: string }

type ValueTokenResult = { tokens: ValueToken[]; hasInvalidSeparator: boolean }

type MarginSideCheckResult = 'ok' | 'error' | 'skip'

export type PositionValueParseResult =
  | { status: 'known'; value: string }
  | { status: 'unknown'; value: string; reason: 'dynamic' | 'unknown' }
  | { status: 'skip' }

type ValueTokenHelpers = {
  checkMarginSide: (
    prop: string,
    value: string,
    marginSide: 'top' | 'bottom'
  ) => MarginSideCheckResult
  parsePositionValue: (value: string) => PositionValueParseResult
  isZeroMinSize: (prop: string, value: string) => boolean
}

const GLOBAL_VALUE_KEYWORDS = new Set(['inherit', 'unset', 'revert', 'revert-layer'])
const ALLOWED_MARGIN_KEYWORDS = new Set(['auto', 'initial'])
const POSITION_KEYWORDS = new Set(['static', 'relative', 'absolute', 'fixed', 'sticky'])
// CSS-wide keywords + initial: skip validation to allow intentional resets.
const POSITION_SKIP_KEYWORDS = new Set([...GLOBAL_VALUE_KEYWORDS, 'initial'])

const MIN_SIZE_PROP_NAMES = new Set([
  'min-width',
  'min-height',
  'min-inline-size',
  'min-block-size'
])

const NUMBER_WITH_UNIT_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[a-z%]+)?$/i

const containsInterpolation = (value: string): boolean => value.includes('#{')
const startsWithSassVariable = (value: string): boolean => value.startsWith('$')

const isZeroNumeric = (value: string): boolean => {
  if (!NUMBER_WITH_UNIT_PATTERN.test(value)) return false
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed === 0
}

const getMarginTargetIndex = (
  count: number,
  targetSide: 'top' | 'bottom'
): number | null => {
  if (count === 1 || count === 2) {
    return 0
  }
  if (count === 3 || count === 4) {
    return targetSide === 'top' ? 0 : 2
  }
  return null
}

const getMarginBlockTargetIndex = (
  count: number,
  targetSide: 'top' | 'bottom'
): number | null => {
  if (count === 1) return 0
  if (count === 2) return targetSide === 'top' ? 0 : 1
  return null
}

const createValueTokenCache = (): Map<string, ValueTokenResult> => new Map()

const collectValueTokens = (
  raw: string,
  cache: Map<string, ValueTokenResult>
): ValueTokenResult => {
  const cached = cache.get(raw)
  if (cached) return cached

  const tokens: ValueToken[] = []
  let hasInvalidSeparator = false

  valueParser(raw).nodes.forEach((node) => {
    if (node.type === 'comment' || node.type === 'space') return
    if (node.type === 'div') {
      if (node.value === ',' || node.value === '/') hasInvalidSeparator = true
      return
    }
    if (node.type === 'word') {
      const normalized = node.value.trim().toLowerCase()
      const important = normalized.startsWith('!') ? normalized.slice(1) : normalized
      if (important === 'important') return
      tokens.push({ type: 'word', value: node.value })
      return
    }
    if (node.type === 'function') {
      tokens.push({ type: 'function', value: node.value })
      return
    }
    if (node.type === 'string') {
      tokens.push({ type: 'string', value: node.value })
    }
  })

  const result = { tokens, hasInvalidSeparator }
  cache.set(raw, result)
  return result
}

const isZeroOnlyValue = (value: string, cache: Map<string, ValueTokenResult>): boolean => {
  const { tokens, hasInvalidSeparator } = collectValueTokens(value, cache)
  if (hasInvalidSeparator || tokens.length !== 1) return false
  const token = tokens[0]
  if (token.type !== 'word') return false
  if (containsInterpolation(token.value)) return false
  return isZeroNumeric(token.value)
}

const evaluateMarginToken = (token: ValueToken): MarginSideCheckResult => {
  if (token.type !== 'word') return 'error'
  const raw = token.value
  const lowered = raw.toLowerCase()
  if (containsInterpolation(raw)) return 'error'
  // Global keywords are only valid as the entire value (shorthand positions are invalid).
  if (GLOBAL_VALUE_KEYWORDS.has(lowered)) return 'error'
  if (ALLOWED_MARGIN_KEYWORDS.has(lowered)) return 'ok'
  if (startsWithSassVariable(raw)) return 'error'
  return isZeroNumeric(raw) ? 'ok' : 'error'
}

export const createValueTokenHelpers = (): ValueTokenHelpers => {
  const cache = createValueTokenCache()

  const isZeroMinSize = (prop: string, value: string): boolean =>
    MIN_SIZE_PROP_NAMES.has(prop) && isZeroOnlyValue(value, cache)

  const checkMarginSide = (
    prop: string,
    value: string,
    marginSide: 'top' | 'bottom'
  ): MarginSideCheckResult => {
    const { tokens, hasInvalidSeparator } = collectValueTokens(value, cache)
    if (hasInvalidSeparator || tokens.length === 0) return 'skip'
    if (tokens.length === 1 && tokens[0].type === 'word') {
      const lowered = tokens[0].value.toLowerCase()
      if (GLOBAL_VALUE_KEYWORDS.has(lowered)) return 'skip'
    }

    const targetSide = marginSide === 'top' ? 'bottom' : 'top'

    if (prop === 'margin-top' || prop === 'margin-block-start') {
      if (targetSide !== 'top') return 'ok'
      return evaluateMarginToken(tokens[0])
    }

    if (prop === 'margin-bottom' || prop === 'margin-block-end') {
      if (targetSide !== 'bottom') return 'ok'
      return evaluateMarginToken(tokens[0])
    }

    if (prop === 'margin-block') {
      const index = getMarginBlockTargetIndex(tokens.length, targetSide)
      if (index === null) return 'skip'
      return evaluateMarginToken(tokens[index])
    }

    if (prop === 'margin') {
      const index = getMarginTargetIndex(tokens.length, targetSide)
      if (index === null) return 'skip'
      return evaluateMarginToken(tokens[index])
    }

    return 'skip'
  }

  const parsePositionValue = (value: string): PositionValueParseResult => {
    const trimmed = value.trim()
    if (!trimmed) return { status: 'unknown', value: trimmed, reason: 'dynamic' }
    if (startsWithSassVariable(trimmed)) {
      return { status: 'unknown', value: trimmed, reason: 'dynamic' }
    }
    if (containsInterpolation(trimmed)) {
      return { status: 'unknown', value: trimmed, reason: 'dynamic' }
    }
    const { tokens, hasInvalidSeparator } = collectValueTokens(value, cache)
    if (hasInvalidSeparator || tokens.length !== 1) {
      return { status: 'unknown', value: trimmed, reason: 'dynamic' }
    }
    const token = tokens[0]
    if (token.type !== 'word') {
      return { status: 'unknown', value: trimmed, reason: 'dynamic' }
    }
    const lowered = token.value.toLowerCase()
    if (POSITION_SKIP_KEYWORDS.has(lowered)) return { status: 'skip' }
    if (!POSITION_KEYWORDS.has(lowered)) {
      return { status: 'unknown', value: trimmed, reason: 'unknown' }
    }
    return { status: 'known', value: lowered }
  }

  return {
    checkMarginSide,
    parsePositionValue,
    isZeroMinSize
  }
}
