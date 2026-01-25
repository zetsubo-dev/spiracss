// Best-effort extraction of static class names from JSX class/className bindings.
export type JsxClassBindingOptions = {
  markUnsupportedOnEmpty?: boolean
  strict?: boolean
  memberAccessAllowlist?: string[]
}

export type JsxClassBindingResult = {
  html: string
  hadUnsupportedBindings: boolean
}

type ClassExtraction = {
  classes: string[]
  hadUnsupported: boolean
  tokens: TokenEntry[]
}

type FoundAttribute = {
  name: 'className' | 'class'
  index: number
}

type StringLiteralResult = {
  value: string
  endIndex: number
  rawLength: number
  valueStart: number
}

type BracedExpressionResult = {
  expression: string
  endIndex: number
}

type TemplateLiteralResult = {
  endIndex: number
  rawLength: number
}

type TokenEntry = {
  value: string
  pos: number
  order: number
}

type ExtractOptions = {
  strict?: boolean
  offset?: number
  memberAccessAllowlist?: string[]
}
const RESERVED_PROPERTY_NAMES = new Set(['class', 'className'])
// Treat member access as class names to support CSS Modules and common helpers.
const WORD_CHAR_RE = /[A-Za-z0-9_$-]/
const IDENT_CHAR_RE = /[A-Za-z0-9_$]/
const IDENT_START_RE = /[A-Za-z_$]/
const DISALLOWED_MEMBER_BASES = new Set(['props', 'state', 'context', 'ctx', 'this'])

const isWhitespace = (ch: string): boolean => /\s/.test(ch)
const isWordChar = (ch: string): boolean => ch !== '' && WORD_CHAR_RE.test(ch)
const isIdentifierChar = (ch: string): boolean => ch !== '' && IDENT_CHAR_RE.test(ch)
const isIdentifierStart = (ch: string): boolean => ch !== '' && IDENT_START_RE.test(ch)

const normalizeAllowlist = (values?: string[]): Set<string> | null => {
  if (!Array.isArray(values)) return null
  const normalized = values
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim())
  if (normalized.length === 0) return new Set()
  return new Set(normalized)
}

const isAllowedMemberBase = (base: string, allowlist: Set<string> | null): boolean => {
  if (!allowlist) return true
  return allowlist.has(base)
}

function getPreviousNonWhitespaceChar(input: string, start: number): string {
  let i = start
  while (i >= 0 && isWhitespace(input[i])) i -= 1
  return i >= 0 ? input[i] : ''
}

function getNextNonWhitespaceChar(input: string, start: number): string {
  let i = start
  while (i < input.length && isWhitespace(input[i])) i += 1
  return i < input.length ? input[i] : ''
}

function isComparisonContext(input: string, start: number, end: number): boolean {
  const before = input.slice(0, start).replace(/\s+$/g, '')
  const after = input.slice(end).replace(/^\s+/g, '')
  const beforeMatch = before.match(/(===|!==|==|!=|>=|<=|>|<)$/)
  if (beforeMatch) return true
  const afterMatch = after.match(/^(===|!==|==|!=|>=|<=|>|<)/)
  if (afterMatch) return true
  return false
}

function isAttributeBoundary(input: string, start: number, length: number): boolean {
  const before = start > 0 ? input[start - 1] : ''
  const after = start + length < input.length ? input[start + length] : ''
  return !isWordChar(before) && !isWordChar(after)
}

function findNextClassAttribute(input: string, start: number): FoundAttribute | null {
  let cursor = start
  while (cursor < input.length) {
    const nextClassName = input.indexOf('className', cursor)
    const nextClass = input.indexOf('class', cursor)
    if (nextClassName === -1 && nextClass === -1) return null

    let index = -1
    let name: FoundAttribute['name'] | null = null

    if (nextClassName !== -1 && (nextClass === -1 || nextClassName <= nextClass)) {
      index = nextClassName
      name = 'className'
    } else {
      index = nextClass
      name = 'class'
    }

    if (name && isAttributeBoundary(input, index, name.length)) {
      return { name, index }
    }
    cursor = index + (name?.length ?? 0)
  }
  return null
}

function readStringLiteral(
  input: string,
  start: number,
  quote: "'" | '"'
): StringLiteralResult | null {
  let i = start + 1
  let value = ''
  let escaped = false
  while (i < input.length) {
    const ch = input[i]
    if (escaped) {
      value += ch
      escaped = false
      i += 1
      continue
    }
    if (ch === '\\') {
      escaped = true
      i += 1
      continue
    }
    if (ch === quote) {
      return { value, endIndex: i + 1, rawLength: i + 1 - start, valueStart: start + 1 }
    }
    value += ch
    i += 1
  }
  return null
}

function skipLineComment(input: string, start: number): number {
  let i = start
  while (i < input.length && input[i] !== '\n') i += 1
  return i
}

function skipBlockComment(input: string, start: number): number {
  let i = start + 2
  while (i < input.length) {
    if (input[i] === '*' && input[i + 1] === '/') {
      return i + 2
    }
    i += 1
  }
  return input.length
}

function skipTemplateLiteral(input: string, start: number): TemplateLiteralResult | null {
  let i = start + 1
  while (i < input.length) {
    const ch = input[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '`') {
      return { endIndex: i + 1, rawLength: i + 1 - start }
    }
    if (ch === '$' && input[i + 1] === '{') {
      const nested = readBracedExpression(input, i + 1)
      if (!nested) return null
      i = nested.endIndex
      continue
    }
    i += 1
  }
  return null
}

function readBracedExpression(input: string, start: number): BracedExpressionResult | null {
  if (input[start] !== '{') return null
  let i = start + 1
  let depth = 1
  while (i < input.length) {
    const ch = input[i]
    if (ch === "'" || ch === '"') {
      const literal = readStringLiteral(input, i, ch)
      if (!literal) return null
      i = literal.endIndex
      continue
    }
    if (ch === '`') {
      const template = skipTemplateLiteral(input, i)
      if (!template) return null
      i = template.endIndex
      continue
    }
    if (ch === '/' && input[i + 1] === '/') {
      i = skipLineComment(input, i + 2)
      continue
    }
    if (ch === '/' && input[i + 1] === '*') {
      i = skipBlockComment(input, i)
      continue
    }
    if (ch === '{') {
      depth += 1
      i += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return { expression: input.slice(start + 1, i), endIndex: i + 1 }
      }
      i += 1
      continue
    }
    i += 1
  }
  return null
}

function readBracketStringLiteral(input: string, start: number): StringLiteralResult | null {
  if (input[start] !== '[') return null
  let i = start + 1
  while (i < input.length && isWhitespace(input[i])) i += 1
  const quote = input[i]
  if (quote !== "'" && quote !== '"') return null
  const literal = readStringLiteral(input, i, quote)
  if (!literal) return null
  i = literal.endIndex
  while (i < input.length && isWhitespace(input[i])) i += 1
  if (input[i] !== ']') return null
  return {
    value: literal.value,
    endIndex: i + 1,
    rawLength: i + 1 - start,
    valueStart: literal.valueStart
  }
}

function extractStaticClassNames(
  expression: string,
  options: ExtractOptions = {}
): ClassExtraction {
  const strict = options.strict ?? false
  const offset = options.offset ?? 0
  const allowlist = normalizeAllowlist(options.memberAccessAllowlist)
  let tokenEntries: TokenEntry[] = []
  let order = 0
  let hadUnsupported = false

  const pushTokens = (value: string, pos: number, allowReserved = true): number => {
    let added = 0
    const tokenRe = /[^\s]+/g
    let match: RegExpExecArray | null
    while ((match = tokenRe.exec(value)) !== null) {
      const token = match[0]
      if (token === '-' || token === '_') continue
      if (!allowReserved && RESERVED_PROPERTY_NAMES.has(token)) continue
      tokenEntries.push({ value: token, pos: offset + pos + match.index, order })
      order += 1
      added += 1
    }
    return added
  }

  const mergeTokens = (tokens: TokenEntry[]): void => {
    tokens.forEach((token) => {
      tokenEntries.push({ value: token.value, pos: token.pos, order })
      order += 1
    })
  }

  const removeTokensInRange = (start: number, end: number): void => {
    const absStart = offset + start
    const absEnd = offset + end
    tokenEntries = tokenEntries.filter((token) => token.pos < absStart || token.pos >= absEnd)
  }

  const scanExpression = (input: string): string => {
    let stripped = ''
    let i = 0
    while (i < input.length) {
      const ch = input[i]
      if (ch === '/' && input[i + 1] === '/') {
        const end = skipLineComment(input, i + 2)
        stripped += ' '.repeat(end - i)
        i = end
        continue
      }
      if (ch === '/' && input[i + 1] === '*') {
        const end = skipBlockComment(input, i)
        stripped += ' '.repeat(end - i)
        i = end
        continue
      }
      if (ch === "'" || ch === '"') {
        const literal = readStringLiteral(input, i, ch)
        if (!literal) {
          hadUnsupported = true
          stripped += ch
          i += 1
          continue
        }
        if (!isComparisonContext(input, i, literal.endIndex)) {
          pushTokens(literal.value, literal.valueStart)
        }
        stripped += ' '.repeat(literal.rawLength)
        i = literal.endIndex
        continue
      }
      if (ch === '`') {
        let cursor = i + 1
        let segment = ''
        let segmentStart = cursor
        let closed = false
        while (cursor < input.length) {
          const current = input[cursor]
          if (current === '\\') {
            segment += input[cursor + 1] ?? ''
            cursor += 2
            continue
          }
          if (current === '`') {
            pushTokens(segment, segmentStart)
            cursor += 1
            closed = true
            break
          }
          if (current === '$' && input[cursor + 1] === '{') {
            pushTokens(segment, segmentStart)
            segment = ''
            const nested = readBracedExpression(input, cursor + 1)
            if (!nested) {
              hadUnsupported = true
              cursor = input.length
              break
            }
            const nestedResult = extractStaticClassNames(nested.expression, {
              ...options,
              offset: offset + cursor + 2
            })
            if (nestedResult.hadUnsupported) hadUnsupported = true
            mergeTokens(nestedResult.tokens)
            cursor = nested.endIndex
            segmentStart = cursor
            continue
          }
          segment += current
          cursor += 1
        }
        if (!closed) {
          hadUnsupported = true
          stripped += ch
          i += 1
          continue
        }
        stripped += ' '.repeat(cursor - i)
        i = cursor
        continue
      }
      stripped += ch
      i += 1
    }
    return stripped
  }

  const stripped = scanExpression(expression)
  const residual = stripped.split('')

  const maskRange = (start: number, end: number): void => {
    for (let i = start; i < end; i += 1) {
      residual[i] = ' '
    }
  }

  const memberRe = /([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\?\.|\.)\s*([A-Za-z_$][A-Za-z0-9_$]*)/g
  let match = memberRe.exec(stripped)
  while (match) {
    const leftStart = match.index
    const prev = getPreviousNonWhitespaceChar(stripped, leftStart - 1)
    const matchEnd = match.index + match[0].length
    const next = getNextNonWhitespaceChar(stripped, matchEnd)
    if (next === '.' || next === '?' || next === '[') {
      hadUnsupported = true
      match = memberRe.exec(stripped)
      continue
    }
    if (
      prev !== '.' &&
      prev !== ']' &&
      prev !== ')' &&
      prev !== '-' &&
      prev !== '+' &&
      next !== '(' &&
      !DISALLOWED_MEMBER_BASES.has(match[1])
    ) {
      if (!isAllowedMemberBase(match[1], allowlist)) {
        hadUnsupported = true
      } else {
        const propOffset = match[0].lastIndexOf(match[2])
        const added = pushTokens(match[2], match.index + propOffset, false)
        if (added > 0) maskRange(match.index, match.index + match[0].length)
      }
    }
    match = memberRe.exec(stripped)
  }

  let bracketIndex = stripped.indexOf('[')
  while (bracketIndex !== -1) {
    const bracket = readBracketStringLiteral(expression, bracketIndex)
    if (!bracket) {
      bracketIndex = stripped.indexOf('[', bracketIndex + 1)
      continue
    }

    let baseEnd = bracketIndex - 1
    while (baseEnd >= 0 && isWhitespace(stripped[baseEnd])) baseEnd -= 1

    if (baseEnd >= 0 && stripped[baseEnd] === '.') {
      let chainIndex = baseEnd - 1
      while (chainIndex >= 0 && isWhitespace(stripped[chainIndex])) chainIndex -= 1
      if (chainIndex >= 0 && stripped[chainIndex] === '?') {
        baseEnd = chainIndex - 1
        while (baseEnd >= 0 && isWhitespace(stripped[baseEnd])) baseEnd -= 1
      } else {
        bracketIndex = stripped.indexOf('[', bracket.endIndex)
        continue
      }
    }

    if (baseEnd < 0) {
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }

    if (!isIdentifierChar(stripped[baseEnd])) {
      removeTokensInRange(bracketIndex, bracket.endIndex)
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }

    let baseStart = baseEnd
    while (baseStart >= 0 && isIdentifierChar(stripped[baseStart])) baseStart -= 1
    baseStart += 1
    if (!isIdentifierStart(stripped[baseStart])) {
      removeTokensInRange(bracketIndex, bracket.endIndex)
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }
    const base = stripped.slice(baseStart, baseEnd + 1)

    const prev = getPreviousNonWhitespaceChar(stripped, baseStart - 1)
    const next = getNextNonWhitespaceChar(stripped, bracket.endIndex)
    if (
      prev === '.' ||
      prev === ']' ||
      prev === ')' ||
      next === '(' ||
      next === '.' ||
      next === '?' ||
      next === '['
    ) {
      removeTokensInRange(bracketIndex, bracket.endIndex)
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }

    const isReserved = RESERVED_PROPERTY_NAMES.has(bracket.value)
    if (prev === '-' || prev === '+') {
      removeTokensInRange(bracketIndex, bracket.endIndex)
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }

    if (!isAllowedMemberBase(base, allowlist)) {
      hadUnsupported = true
      removeTokensInRange(bracketIndex, bracket.endIndex)
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }

    if (DISALLOWED_MEMBER_BASES.has(base) || isReserved) {
      removeTokensInRange(bracketIndex, bracket.endIndex)
      bracketIndex = stripped.indexOf('[', bracket.endIndex)
      continue
    }

    const added = pushTokens(bracket.value, bracket.valueStart, false)
    if (added > 0) {
      maskRange(baseStart, bracket.endIndex)
    }
    bracketIndex = stripped.indexOf('[', bracket.endIndex)
  }

  if (!strict) {
    const objectKeyRe = /(?:^|[,{])\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g
    match = objectKeyRe.exec(stripped)
    while (match) {
      const keyOffset = match[0].lastIndexOf(match[1])
      const added = pushTokens(match[1], match.index + keyOffset, false)
      if (added > 0) maskRange(match.index, match.index + match[0].length)
      match = objectKeyRe.exec(stripped)
    }
  }

  if (strict) {
    const remaining = residual.join('').replace(/[\s()]/g, '')
    if (remaining.length > 0) {
      hadUnsupported = true
    }
  }

  const sorted = tokenEntries
    .slice()
    .sort((a, b) => (a.pos === b.pos ? a.order - b.order : a.pos - b.pos))
  const seen = new Set<string>()
  const classes: string[] = []
  sorted.forEach((token) => {
    if (seen.has(token.value)) return
    seen.add(token.value)
    classes.push(token.value)
  })

  return {
    classes,
    hadUnsupported,
    tokens: tokenEntries
  }
}

export function replaceJsxClassBindings(
  html: string,
  options: JsxClassBindingOptions = {}
): JsxClassBindingResult {
  const markUnsupportedOnEmpty = options.markUnsupportedOnEmpty ?? false
  const strict = options.strict ?? false
  let cursor = 0
  let output = ''
  let hadUnsupportedBindings = false

  while (cursor < html.length) {
    const found = findNextClassAttribute(html, cursor)
    if (!found) {
      output += html.slice(cursor)
      break
    }
    const { name, index } = found
    output += html.slice(cursor, index)
    let i = index + name.length
    while (i < html.length && isWhitespace(html[i])) i += 1
    if (html[i] !== '=') {
      output += html.slice(index, i)
      cursor = i
      continue
    }
    i += 1
    while (i < html.length && isWhitespace(html[i])) i += 1
    if (html[i] !== '{') {
      output += html.slice(index, i)
      cursor = i
      continue
    }

    const braced = readBracedExpression(html, i)
    if (!braced) {
      hadUnsupportedBindings = true
      output += html.slice(index, i)
      cursor = i
      continue
    }
    const extraction = extractStaticClassNames(braced.expression, {
      strict,
      memberAccessAllowlist: options.memberAccessAllowlist
    })
    if (extraction.hadUnsupported) {
      hadUnsupportedBindings = true
    }
    const classList = extraction.classes
    const isEmptyStatic = classList.length === 0 && !extraction.hadUnsupported && extraction.tokens.length === 0
    if (classList.length > 0) {
      output += `${name}="${classList.join(' ')}"`
    } else if (isEmptyStatic) {
      output += `${name}=""`
    } else {
      if (markUnsupportedOnEmpty) {
        hadUnsupportedBindings = true
      }
      output += html.slice(index, braced.endIndex)
    }
    cursor = braced.endIndex
  }

  return { html: output, hadUnsupportedBindings }
}

export function stripJsxClassBindings(html: string): string {
  let cursor = 0
  let output = ''

  while (cursor < html.length) {
    const found = findNextClassAttribute(html, cursor)
    if (!found) {
      output += html.slice(cursor)
      break
    }

    const { name, index } = found
    output += html.slice(cursor, index)
    let i = index + name.length
    while (i < html.length && isWhitespace(html[i])) i += 1
    if (html[i] !== '=') {
      output += html.slice(index, i)
      cursor = i
      continue
    }
    i += 1
    while (i < html.length && isWhitespace(html[i])) i += 1
    if (html[i] !== '{') {
      output += html.slice(index, i)
      cursor = i
      continue
    }

    const braced = readBracedExpression(html, i)
    if (!braced) {
      output += html.slice(index, i)
      cursor = i
      continue
    }

    cursor = braced.endIndex
  }

  return output
}
