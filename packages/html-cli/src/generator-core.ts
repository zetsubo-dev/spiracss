/* =========================================================
 *  SpiraCSS HTML to SCSS - Core Generator (VS Code agnostic)
 * ========================================================= */

import { type CheerioAPI, load } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'

/* ---------- type guards ---------- */
const hasClassAttribute = (node: Element): boolean => {
  const value = node.attribs?.class
  return typeof value === 'string' && value.trim() !== ''
}

function isTagElement(node: AnyNode): node is Element {
  return node.type === 'tag'
}

function isRootCandidate(node: AnyNode): node is Element {
  if (!isTagElement(node)) return false
  return !ROOT_IGNORED_TAGS.has(node.tagName)
}

function isElement(node: AnyNode): node is Element {
  return isTagElement(node) && hasClassAttribute(node as Element)
}

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
const CDATA_RE = /<!\[CDATA\[[\s\S]*?\]\]>/g
const QUOTED_VALUE_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g
const TEXT_CONTAINER_RE =
  /<\s*(template|textarea|noscript|xmp|listing|foreignObject)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi
const SCRIPT_STYLE_RE = /<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi
const ROOT_IGNORED_TAGS = new Set([
  'template',
  'textarea',
  'script',
  'style',
  'head',
  'noscript',
  'xmp',
  'listing'
])

const stripForRootScan = (html: string): string =>
  html
    .replace(HTML_COMMENT_RE, '')
    .replace(CDATA_RE, '')
    .replace(SCRIPT_STYLE_RE, '')
    .replace(QUOTED_VALUE_RE, '""')
    .replace(TEXT_CONTAINER_RE, '')

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

const TAG_RE = /<\/?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?>/g

const detectExplicitRoot = (html: string): 'html' | 'body' | null => {
  const cleaned = stripForRootScan(html)
  TAG_RE.lastIndex = 0
  let depth = 0

  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(cleaned)) !== null) {
    const full = match[0]
    const tag = match[1].toLowerCase()
    const isClosing = full.startsWith('</')
    const isSelfClosing = full.endsWith('/>')

    if (isClosing) {
      if (depth > 0) depth -= 1
      continue
    }

    if (isSelfClosing || VOID_TAGS.has(tag)) {
      continue
    }

    if (depth === 0) {
      if (tag === 'html') return 'html'
      if (tag === 'body') return 'body'
    }

    depth += 1
  }

  return null
}

const findExplicitRoot = ($: CheerioAPI, root: 'html' | 'body' | null): Element | undefined => {
  if (root === 'html') return $('html').get().find(isTagElement)
  if (root === 'body') return $('body').get().find(isTagElement)
  return undefined
}

const findFirstElement = ($: CheerioAPI): Element | undefined =>
  $('*').get().find(isTagElement)

/* ---------- RegExp cache (for sanitize) ---------- */
const RX = {
  CLASS_TEMPLATE: /class\s*=\s*\{\s*`([^`]*)`\s*\}/g,
  CLASSNAME_TEMPLATE: /className\s*=\s*\{\s*`([^`]*)`\s*\}/g,
  CLASSNAME_DQ: /className\s*=\s*"([^"]*)"/g,
  CLASSNAME_SQ: /className\s*=\s*'([^']*)'/g,
  CLASSNAME_BRACE_DQ: /className\s*=\s*\{\s*"([^"]*)"\s*\}/g,
  CLASSNAME_BRACE_SQ: /className\s*=\s*\{\s*'([^']*)'\s*\}/g,
  CLASS_BRACE_DQ: /class\s*=\s*\{\s*"([^"]*)"\s*\}/g,
  CLASS_BRACE_SQ: /class\s*=\s*\{\s*'([^']*)'\s*\}/g,
  CLASSNAME_REST: /className\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g,
  ASTRO_FRONTMATTER: /^---[\s\S]*?---\s*/,
  BACKTICK_ATTR: /=`([^`]*)`/g,
  SELF_CLOSING: /<([A-Z][\w.-]*)([^>]*)\/>/g,
  CLASS_CLEAN: /class="([^"]*)"/g,
  SPREAD: /\{\.\.\.[^}]+\}/g,
  EJS: /<%[\s\S]*?%>/g,
  NUN_VAR: /\{\{[\s\S]*?\}\}/g,
  NUN_TAG: /\{%[\s\S]*?%\}/g,
  NUN_COMM: /\{#[\s\S]*?#\}/g,
  JSX_COMMENT: /\{\/\*[\s\S]*?\*\/\}/g,
  JSX_FRAGMENT: /<>\s*|<\/>/g,
  DIR_ATTR:
    /\s+(?:(?:on|bind|class|use|transition|in|out|animate|let|client|set):[\w-]+|v-[\w-]+|[:@#][\w-]+)(?:=(?:"[^"]*"|'[^']*'))?/g,
  REACT_EVENT: /\s+on[A-Z][\w-]*(?:=(?:"[^"]*"|'[^']*'))?/g,
  DANGEROUS_HTML: /\s+dangerouslySetInnerHTML=(?:"[^"]*"|\{[\s\S]*?\})/g,
  PLACEHOLDER: /\$\{[\s\S]*?\}/g,
  MULTI_SPACE: /\s{2,}/g,
  TRIM_ATTR: /=\s*"(\s*[^"]*?\s*)"\s*/g
} as const

/** Patterns removed at the attribute level. */
const REMOVE_PATTERNS: RegExp[] = [
  RX.SPREAD,
  RX.EJS,
  RX.NUN_VAR,
  RX.NUN_TAG,
  RX.NUN_COMM,
  RX.JSX_COMMENT,
  RX.JSX_FRAGMENT,
  RX.DIR_ATTR,
  RX.REACT_EVENT,
  RX.DANGEROUS_HTML,
  RX.PLACEHOLDER,
  RX.MULTI_SPACE
]

/* ---------- Utils ---------- */
const INDENTS: string[] = ['']
function indent(lv: number): string {
  if (!INDENTS[lv]) INDENTS[lv] = '  '.repeat(lv)
  return INDENTS[lv]
}

function camelize(s: string): string {
  return s
    .split(/[-_]/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ''))
    .join('')
}

export type WordCase = 'kebab' | 'snake' | 'camel' | 'pascal'
export type FileNameCase = 'preserve' | WordCase
export type VariantMode = 'data' | 'class'
export type StateMode = 'data' | 'class'
export type ValueNamingOptions = {
  case?: WordCase
  maxWords?: number
}

type ValueNaming = {
  case: WordCase
  maxWords: number
}

function normalizeFileNameCase(value: unknown): FileNameCase {
  if (value === 'preserve') return value
  if (value === 'kebab' || value === 'snake' || value === 'camel' || value === 'pascal') {
    return value
  }
  return 'preserve'
}

function isWordCase(value: unknown): value is WordCase {
  return value === 'kebab' || value === 'snake' || value === 'camel' || value === 'pascal'
}

function normalizeValueNaming(
  raw: unknown,
  fallback: ValueNaming,
  fieldName: string
): ValueNaming {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const value = raw as ValueNamingOptions
  if (value.case !== undefined && !isWordCase(value.case)) {
    throw new Error(`${fieldName}.case must be "kebab" | "snake" | "camel" | "pascal".`)
  }
  if (value.maxWords !== undefined) {
    if (
      typeof value.maxWords !== 'number' ||
      !Number.isInteger(value.maxWords) ||
      value.maxWords < 1
    ) {
      throw new Error(`${fieldName}.maxWords must be a positive integer.`)
    }
  }
  return {
    case: value.case ?? fallback.case,
    maxWords: value.maxWords ?? fallback.maxWords
  }
}

function splitWords(input: string): string[] {
  if (!input.trim()) return []
  const normalized = input
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return normalized.trim().split(/\s+/).filter(Boolean)
}

function formatFileBase(input: string, fileCase: FileNameCase): string {
  if (!input) return input
  if (fileCase === 'preserve') return input

  const words = splitWords(input)
  if (words.length === 0) return input

  const lower = words.map((w) => w.toLowerCase())
  const capitalize = (word: string): string =>
    word ? word[0].toUpperCase() + word.slice(1) : ''

  switch (fileCase) {
    case 'kebab':
      return lower.join('-')
    case 'snake':
      return lower.join('_')
    case 'camel': {
      const [head, ...rest] = lower
      return head + rest.map(capitalize).join('')
    }
    case 'pascal':
      return lower.map(capitalize).join('')
    default:
      return input
  }
}

export type NamingOptions = {
  /**
   * Block name style (default: 'kebab' = hero-banner).
   */
  blockCase?: WordCase
  /**
   * Max words for Block name (default: 2). Minimum is fixed at 2.
   */
  blockMaxWords?: number
  /**
   * Element name style (default: 'kebab' = title).
   */
  elementCase?: WordCase
  /**
   * Modifier style (default: 'kebab' = primary-large).
   */
  modifierCase?: WordCase
  /**
   * Modifier prefix (default: '-' -> .block.-primary). Can be changed to '_' etc.
   */
  modifierPrefix?: string
  /**
   * Escape hatch for fully custom patterns.
   * If set, overrides block/element/modifier regexes.
   */
  customPatterns?: {
    block?: RegExp
    element?: RegExp
    modifier?: RegExp
  }
}

function normalizeBlockMaxWords(value: unknown): number {
  const normalized = typeof value === 'number' && Number.isInteger(value) ? value : 2
  if (normalized < 2) return 2
  if (normalized > 100) return 100
  return normalized
}

function normalizeCustomPattern(value: unknown): RegExp | undefined {
  if (!(value instanceof RegExp)) return undefined
  if (value.flags.includes('g') || value.flags.includes('y')) return undefined
  return value
}

export type SelectorPolicy = {
  valueNaming?: ValueNamingOptions
  variant?: {
    mode?: VariantMode
    dataKeys?: string[]
    valueNaming?: ValueNamingOptions
  }
  state?: {
    mode?: StateMode
    dataKey?: string
    ariaKeys?: string[]
    valueNaming?: ValueNamingOptions
  }
}

type NormalizedSelectorPolicy = {
  valueNaming: ValueNaming
  variant: {
    mode: VariantMode
    dataKeys: string[]
    valueNaming: ValueNaming
  }
  state: {
    mode: StateMode
    dataKey: string
    ariaKeys: string[]
    valueNaming: ValueNaming
  }
}

export type GeneratorOptions = {
  globalScssModule: string
  pageEntryPrefix: string
  childScssDir: string
  layoutMixins: string[]
  naming: NamingOptions
  rootFileCase?: FileNameCase
  childFileCase?: FileNameCase
  selectorPolicy?: SelectorPolicy
  external?: ExternalOptions
}

export type ExternalOptions = {
  classes?: string[]
  prefixes?: string[]
}

type NormalizedExternalOptions = {
  classes: string[]
  prefixes: string[]
}

export type GeneratedFile = {
  path: string
  content: string
}

export type RootBlockSummary = {
  baseClass: string
  count: number
}

type AttributeSelector = {
  key: string
  value: string
}

const defaultSelectorPolicy: NormalizedSelectorPolicy = {
  valueNaming: { case: 'kebab', maxWords: 2 },
  variant: {
    mode: 'data',
    dataKeys: ['data-variant'],
    valueNaming: { case: 'kebab', maxWords: 2 }
  },
  state: {
    mode: 'data',
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
    valueNaming: { case: 'kebab', maxWords: 2 }
  }
}

function normalizeSelectorPolicy(raw?: SelectorPolicy): NormalizedSelectorPolicy {
  if (!raw || typeof raw !== 'object') return { ...defaultSelectorPolicy }
  const variant = raw.variant || {}
  const state = raw.state || {}
  if (Array.isArray(variant.dataKeys)) {
    const invalid = variant.dataKeys.find((key) => typeof key !== 'string')
    if (invalid !== undefined) {
      throw new Error('selectorPolicy.variant.dataKeys must be an array of strings.')
    }
  }
  if (Array.isArray(state.ariaKeys)) {
    const invalid = state.ariaKeys.find((key) => typeof key !== 'string')
    if (invalid !== undefined) {
      throw new Error('selectorPolicy.state.ariaKeys must be an array of strings.')
    }
  }
  const variantModeRaw = variant.mode
  const hasVariantMode = Object.prototype.hasOwnProperty.call(variant, 'mode')
  if (hasVariantMode && variantModeRaw !== 'data' && variantModeRaw !== 'class') {
    throw new Error('selectorPolicy.variant.mode must be "data" or "class".')
  }
  const variantMode: VariantMode = variantModeRaw ?? defaultSelectorPolicy.variant.mode

  const stateModeRaw = state.mode
  const hasStateMode = Object.prototype.hasOwnProperty.call(state, 'mode')
  if (hasStateMode && stateModeRaw !== 'data' && stateModeRaw !== 'class') {
    throw new Error('selectorPolicy.state.mode must be "data" or "class".')
  }
  const stateMode: StateMode = stateModeRaw ?? defaultSelectorPolicy.state.mode

  const normalizeKeyList = (value: unknown, fallback: string[], fieldName: string): string[] => {
    if (!Array.isArray(value)) return [...fallback]
    if (value.length === 0) return [...fallback]
    const list: string[] = []
    value.forEach((item) => {
      if (typeof item !== 'string') {
        throw new Error(`${fieldName} must be an array of non-empty strings.`)
      }
      const trimmed = item.trim()
      if (!trimmed) {
        throw new Error(`${fieldName} must be an array of non-empty strings.`)
      }
      list.push(trimmed)
    })
    return list
  }

  const dataKeys = normalizeKeyList(
    variant.dataKeys,
    defaultSelectorPolicy.variant.dataKeys,
    'selectorPolicy.variant.dataKeys'
  )
  const dataKeyRaw = typeof state.dataKey === 'string' ? state.dataKey.trim() : ''
  const dataKey = dataKeyRaw ? dataKeyRaw : defaultSelectorPolicy.state.dataKey
  const ariaKeys = normalizeKeyList(
    state.ariaKeys,
    defaultSelectorPolicy.state.ariaKeys,
    'selectorPolicy.state.ariaKeys'
  )

  const baseValueNaming = normalizeValueNaming(
    (raw as SelectorPolicy).valueNaming,
    defaultSelectorPolicy.valueNaming,
    'selectorPolicy.valueNaming'
  )
  const variantValueNaming = normalizeValueNaming(
    variant.valueNaming,
    baseValueNaming,
    'selectorPolicy.variant.valueNaming'
  )
  const stateValueNaming = normalizeValueNaming(
    state.valueNaming,
    baseValueNaming,
    'selectorPolicy.state.valueNaming'
  )

  return {
    valueNaming: baseValueNaming,
    variant: {
      mode: variantMode,
      dataKeys,
      valueNaming: variantValueNaming
    },
    state: {
      mode: stateMode,
      dataKey,
      ariaKeys,
      valueNaming: stateValueNaming
    }
  }
}

/* ---------- sanitizeHtml ---------- */
export function sanitizeHtml(raw: string): string {
  let html = raw
    .replace(RX.CLASSNAME_TEMPLATE, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASS_TEMPLATE, (_m, inner) => `class="${inner}"`)
    .replace(RX.ASTRO_FRONTMATTER, '')
    .replace(CDATA_RE, '')

  // Remove <script> / <style> tags (exclude inline JS/CSS)
  html = html.replace(SCRIPT_STYLE_RE, '')

  html = REMOVE_PATTERNS.reduce((acc, re) => acc.replace(re, ''), html)
  html = html.replace(RX.BACKTICK_ATTR, '="$1"')
  html = html
    .replace(RX.CLASSNAME_BRACE_DQ, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASSNAME_BRACE_SQ, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASSNAME_DQ, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASSNAME_SQ, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASS_BRACE_DQ, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASS_BRACE_SQ, (_m, inner) => `class="${inner}"`)
    .replace(RX.CLASSNAME_REST, '')
  html = html.replace(RX.SELF_CLOSING, '<$1$2></$1>')
  html = html.replace(RX.CLASS_CLEAN, (_m, v) => {
    const cleaned = v
      .split(/\s+/)
      .filter((c: string) => c !== '-' && c !== '_')
      .join(' ')
      .trim()
    return cleaned ? `class="${cleaned}"` : ''
  })
  html = html.replace(RX.TRIM_ATTR, '="$1"')
  return html
}

/* ---------- ComponentStructure & Tree Logic ---------- */
export interface ComponentStructure {
  baseClass: string
  isIndependent: boolean
  modifiers: string[]
  variantAttributes: AttributeSelector[]
  stateAttributes: AttributeSelector[]
  nestedChildren: ComponentStructure[]
  independentChildren: ComponentStructure[]
  orderedChildren: ComponentStructure[]
  elementTag: string
  isRoot?: boolean
  viaDeep?: boolean
}

export type HtmlLintMode = 'root' | 'selection'

export type HtmlLintIssueCode =
  | 'INVALID_BASE_CLASS'
  | 'UNBALANCED_HTML'
  | 'MULTIPLE_ROOT_ELEMENTS'
  | 'MODIFIER_WITHOUT_BASE'
  | 'DISALLOWED_MODIFIER'
  | 'UTILITY_WITHOUT_BASE'
  | 'MULTIPLE_BASE_CLASSES'
  | 'ROOT_NOT_BLOCK'
  | 'ELEMENT_WITHOUT_BLOCK_ANCESTOR'
  | 'ELEMENT_PARENT_OF_BLOCK'
  | 'DISALLOWED_VARIANT_ATTRIBUTE'
  | 'DISALLOWED_STATE_ATTRIBUTE'
  | 'INVALID_VARIANT_VALUE'
  | 'INVALID_STATE_VALUE'

export type HtmlLintIssue = {
  code: HtmlLintIssueCode
  message: string
  baseClass: string
  path: string[]
}

type UnbalancedTags = {
  missing: string[]
  unexpected: string[]
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    if (seen.has(value)) return
    seen.add(value)
    result.push(value)
  })
  return result
}

function findUnbalancedTags(html: string): UnbalancedTags | null {
  const cleaned = stripForRootScan(html)
  TAG_RE.lastIndex = 0
  const stack: string[] = []
  const missing: string[] = []
  const unexpected: string[] = []

  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(cleaned)) !== null) {
    const full = match[0]
    const tag = match[1].toLowerCase()
    const isClosing = full.startsWith('</')
    const isSelfClosing = full.endsWith('/>')

    if (!isClosing) {
      if (isSelfClosing || VOID_TAGS.has(tag)) continue
      stack.push(tag)
      continue
    }

    if (stack.length === 0) {
      if (tag === 'html' || tag === 'body' || tag === 'head') continue
      unexpected.push(tag)
      continue
    }

    const last = stack[stack.length - 1]
    if (last === tag) {
      stack.pop()
      continue
    }

    const idx = stack.lastIndexOf(tag)
    if (idx === -1) {
      unexpected.push(tag)
      continue
    }
    for (let i = stack.length - 1; i > idx; i -= 1) {
      missing.push(stack[i])
    }
    stack.length = idx
  }

  if (stack.length > 0) {
    missing.push(...stack.reverse())
  }

  const uniqMissing = uniqueStrings(missing)
  const uniqUnexpected = uniqueStrings(unexpected)
  if (uniqMissing.length === 0 && uniqUnexpected.length === 0) return null
  return { missing: uniqMissing, unexpected: uniqUnexpected }
}

function formatUnbalancedMessage(result: UnbalancedTags): string {
  const parts: string[] = []
  if (result.missing.length > 0) {
    parts.push(`Missing closing tags: ${result.missing.join(', ')}`)
  }
  if (result.unexpected.length > 0) {
    parts.push(`Unexpected closing tags: ${result.unexpected.join(', ')}`)
  }
  if (parts.length === 0) {
    return 'HTML tags are not balanced.'
  }
  return `HTML tags are not balanced. ${parts.join(' / ')}`
}

function isModifierClass(name: string, naming: NamingOptions): boolean {
  if (!name) return false
  const pattern = buildModifierPattern(naming)
  return pattern.test(name)
}

// SpiraCSS-based Block detection
export function isBlockClass(name: string, naming: NamingOptions): boolean {
  if (!name) return false
  // Do not treat names starting with utility/modifier/special prefixes as Blocks
  if (isModifierClass(name, naming)) return false
  if (name.startsWith('u-') || name.startsWith('-') || name.startsWith('_')) return false

  const custom = normalizeCustomPattern(naming.customPatterns?.block)
  if (custom) return custom.test(name)

  const blockCase: WordCase = naming.blockCase || 'kebab'
  const blockMaxWords = normalizeBlockMaxWords(naming.blockMaxWords)
  const blockSegments = Math.max(1, blockMaxWords - 1)
  const blockRange = `{1,${blockSegments}}`

  switch (blockCase) {
    case 'kebab':
      return new RegExp(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)${blockRange}$`).test(name)
    case 'snake':
      return new RegExp(`^[a-z][a-z0-9]*(?:_[a-z0-9]+)${blockRange}$`).test(name)
    case 'camel':
      return new RegExp(`^[a-z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*)${blockRange}$`).test(name)
    case 'pascal':
      return new RegExp(`^[A-Z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*)${blockRange}$`).test(name)
    default:
      return new RegExp(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)${blockRange}$`).test(name)
  }
}

function isElementBase(name: string, naming: NamingOptions): boolean {
  if (!name) return false
  // Do not treat names starting with utility/modifier/special prefixes as Elements
  if (isModifierClass(name, naming)) return false
  if (name.startsWith('u-') || name.startsWith('-') || name.startsWith('_')) return false

  const custom = normalizeCustomPattern(naming.customPatterns?.element)
  if (custom) return custom.test(name)

  const elementCase: WordCase = naming.elementCase || 'kebab'

  // Same rules as the stylelint plugin:
  // - Element is always one word
  // - kebab/snake/camel: lowercase only (title)
  // - pascal: one word starting with uppercase (Title)
  switch (elementCase) {
    case 'kebab':
    case 'snake':
      // SpiraCSS default: one lowercase word (no hyphen/underscore)
      return /^[a-z][a-z0-9]*$/.test(name)
    case 'camel':
      // camelCase: one lowercase word only (bodyText is invalid)
      return /^[a-z][a-z0-9]*$/.test(name)
    case 'pascal':
      // PascalCase: one word starting with uppercase only (BodyText is invalid)
      return /^[A-Z][a-z0-9]*$/.test(name)
    default:
      return /^[a-z][a-z0-9]*$/.test(name)
  }
}

export function classifyBaseClass(
  name: string,
  naming: NamingOptions
): 'block' | 'element' | 'invalid' {
  if (isBlockClass(name, naming)) return 'block'
  if (name.startsWith('-') || name.startsWith('u-')) return 'invalid'
  if (isElementBase(name, naming)) return 'element'
  return 'invalid'
}

type BaseKind = 'block' | 'element' | 'invalid' | 'external'

const normalizeExternalOptions = (raw?: ExternalOptions): NormalizedExternalOptions => {
  const classes = Array.isArray(raw?.classes)
    ? raw.classes.filter((item) => typeof item === 'string' && item.trim() !== '')
    : []
  const prefixes = Array.isArray(raw?.prefixes)
    ? raw.prefixes.filter((item) => typeof item === 'string' && item.trim() !== '')
    : []
  return { classes, prefixes }
}

const isExternalClass = (name: string, external: NormalizedExternalOptions): boolean =>
  external.classes.includes(name) || external.prefixes.some((prefix) => name.startsWith(prefix))

const classifyBaseClassWithExternal = (
  name: string,
  naming: NamingOptions,
  external: NormalizedExternalOptions
): BaseKind => {
  if (isExternalClass(name, external)) return 'external'
  return classifyBaseClass(name, naming)
}

const findFirstNonExternalBaseKind = (
  modifiers: string[],
  naming: NamingOptions,
  external: NormalizedExternalOptions
): 'block' | 'element' | null => {
  let elementCandidate = false
  for (const modifier of modifiers) {
    if (isExternalClass(modifier, external)) continue
    if (isBlockClass(modifier, naming)) return 'block'
    if (isElementBase(modifier, naming)) elementCandidate = true
  }
  return elementCandidate ? 'element' : null
}


function buildModifierPattern(naming: NamingOptions): RegExp {
  const customModifier = normalizeCustomPattern(naming.customPatterns?.modifier)
  if (customModifier) return customModifier

  const modifierCase: WordCase = naming.modifierCase || 'kebab'
  const modifierPrefix = naming.modifierPrefix ?? '-'
  const prefixEscaped = modifierPrefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const base = (() => {
    switch (modifierCase) {
      case 'kebab': {
        const one = '[a-z0-9]+'
        const two = '[a-z0-9]+-[a-z0-9]+'
        return `(?:${one}|${two})`
      }
      case 'snake': {
        const one = '[a-z0-9]+'
        const two = '[a-z0-9]+_[a-z0-9]+'
        return `(?:${one}|${two})`
      }
      case 'camel': {
        const one = '[a-z][a-zA-Z0-9]*'
        const two = '[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*'
        return `(?:${one}|${two})`
      }
      case 'pascal': {
        const one = '[A-Z][a-zA-Z0-9]*'
        const two = '[A-Z][a-z0-9]*[A-Z][a-zA-Z0-9]*'
        return `(?:${one}|${two})`
      }
      default: {
        const one = '[a-z0-9]+'
        const two = '[a-z0-9]+-[a-z0-9]+'
        return `(?:${one}|${two})`
      }
    }
  })()
  return new RegExp(`^${prefixEscaped}${base}$`)
}

function buildValuePattern(naming: ValueNaming): RegExp {
  const maxWords = naming.maxWords
  switch (naming.case) {
    case 'kebab': {
      const word = '[a-z0-9]+'
      const rest = maxWords > 1 ? `(?:-${word}){0,${maxWords - 1}}` : ''
      return new RegExp(`^${word}${rest}$`)
    }
    case 'snake': {
      const word = '[a-z0-9]+'
      const rest = maxWords > 1 ? `(?:_${word}){0,${maxWords - 1}}` : ''
      return new RegExp(`^${word}${rest}$`)
    }
    case 'camel': {
      const head = '[a-z][a-zA-Z0-9]*'
      const rest = maxWords > 1 ? `(?:[A-Z][a-zA-Z0-9]*){0,${maxWords - 1}}` : ''
      return new RegExp(`^${head}${rest}$`)
    }
    case 'pascal': {
      const head = '[A-Z][a-zA-Z0-9]*'
      const rest = maxWords > 1 ? `(?:[A-Z][a-zA-Z0-9]*){0,${maxWords - 1}}` : ''
      return new RegExp(`^${head}${rest}$`)
    }
    default: {
      const word = '[a-z0-9]+'
      const rest = maxWords > 1 ? `(?:-${word}){0,${maxWords - 1}}` : ''
      return new RegExp(`^${word}${rest}$`)
    }
  }
}

const filterModifierTokens = (
  modifiers: string[],
  naming: NamingOptions,
  external?: NormalizedExternalOptions
): string[] => {
  if (modifiers.length === 0) return []
  const pattern = buildModifierPattern(naming)
  return modifiers.filter(
    (modifier) => pattern.test(modifier) && !(external && isExternalClass(modifier, external))
  )
}

function dedupAttributeSelectors(list: AttributeSelector[]): AttributeSelector[] {
  const map = new Map<string, AttributeSelector>()
  for (const item of list) {
    const key = `${item.key}=${item.value}`
    map.set(key, item)
  }
  return Array.from(map.values())
}

function collectAttributeSelectors(
  attribs: Record<string, string> | undefined,
  policy: NormalizedSelectorPolicy
): { variantAttributes: AttributeSelector[]; stateAttributes: AttributeSelector[] } {
  const variantAttributes: AttributeSelector[] = []
  const stateAttributes: AttributeSelector[] = []
  if (!attribs) return { variantAttributes, stateAttributes }

  Object.entries(attribs).forEach(([key, value]) => {
    if (key === 'class' || key === 'data-spiracss-classname') return
    // Boolean attributes (e.g., data-state only) become empty strings in cheerio, so treat them as empty selectors.
    // HTML lint/generation only targets selectorPolicy reserved keys (dataKeys/dataKey/ariaKeys); non-reserved keys are ignored.
    const normalizedValue = typeof value === 'string' ? value.trim() : ''
    if (policy.variant.dataKeys.includes(key)) {
      variantAttributes.push({ key, value: normalizedValue })
    }
    if (key === policy.state.dataKey || policy.state.ariaKeys.includes(key)) {
      stateAttributes.push({ key, value: normalizedValue })
    }
  })

  return {
    variantAttributes: dedupAttributeSelectors(variantAttributes),
    stateAttributes: dedupAttributeSelectors(stateAttributes)
  }
}

function formatAttributeSelector(attr: AttributeSelector): string {
  return attr.value ? `[${attr.key}="${attr.value}"]` : `[${attr.key}]`
}

function splitClassModifiers(
  modifiers: string[],
  policy: NormalizedSelectorPolicy,
  naming?: NamingOptions,
  external?: NormalizedExternalOptions
): { variantClassModifiers: string[]; stateClassModifiers: string[] } {
  const modifierTokens = filterModifierTokens(modifiers, naming ?? {}, external)
  const variantClassModifiers: string[] = []
  const stateClassModifiers: string[] = []
  if (modifierTokens.length === 0) {
    return { variantClassModifiers, stateClassModifiers }
  }

  if (policy.state.mode === 'data') {
    if (policy.variant.mode === 'class') {
      variantClassModifiers.push(...modifierTokens)
    }
    return { variantClassModifiers, stateClassModifiers }
  }

  if (policy.variant.mode === 'data') {
    stateClassModifiers.push(...modifierTokens)
    return { variantClassModifiers, stateClassModifiers }
  }

  // class+class is ambiguous, so treat modifiers as variants
  variantClassModifiers.push(...modifierTokens)
  return { variantClassModifiers, stateClassModifiers }
}

type ElementStateEntry = {
  path: string[]
  selectors: string[]
}

function buildStateSelectors(
  node: ComponentStructure,
  policy: NormalizedSelectorPolicy,
  naming: NamingOptions,
  external: NormalizedExternalOptions
): string[] {
  const selectors = new Set<string>()
  const { stateClassModifiers } = splitClassModifiers(node.modifiers, policy, naming, external)

  if (policy.state.mode === 'data') {
    node.stateAttributes.forEach((attr) => {
      selectors.add(`&${formatAttributeSelector(attr)}`)
    })
  }

  stateClassModifiers.forEach((m) => {
    selectors.add(`&.${m}`)
  })

  return [...selectors]
}

function collectElementStateEntries(
  node: ComponentStructure,
  policy: NormalizedSelectorPolicy,
  naming: NamingOptions,
  external: NormalizedExternalOptions,
  path: string[] = []
): ElementStateEntry[] {
  const entries: ElementStateEntry[] = []
  node.orderedChildren.forEach((child) => {
    if (child.isIndependent) return
    const nextPath = [...path, child.baseClass]
    const selectors = buildStateSelectors(child, policy, naming, external)
    if (selectors.length > 0) {
      entries.push({ path: nextPath, selectors })
    }
    entries.push(...collectElementStateEntries(child, policy, naming, external, nextPath))
  })
  return entries
}

function formatElementPath(path: string[]): string {
  return path.map((name) => `> .${name}`).join(' ')
}

function dedup(arr: ComponentStructure[]): ComponentStructure[] {
  const map = new Map<string, ComponentStructure>()
  for (const item of arr) {
    const ex = map.get(item.baseClass)
    if (!ex) {
      map.set(item.baseClass, {
        ...item,
        modifiers: [...item.modifiers],
        variantAttributes: [...item.variantAttributes],
        stateAttributes: [...item.stateAttributes],
        nestedChildren: [...item.nestedChildren],
        independentChildren: [...item.independentChildren],
        orderedChildren: [...item.orderedChildren]
      })
    } else {
      ex.modifiers = Array.from(new Set([...ex.modifiers, ...item.modifiers]))
      ex.variantAttributes = dedupAttributeSelectors([
        ...ex.variantAttributes,
        ...item.variantAttributes
      ])
      ex.stateAttributes = dedupAttributeSelectors([
        ...ex.stateAttributes,
        ...item.stateAttributes
      ])
      ex.nestedChildren.push(...item.nestedChildren)
      ex.independentChildren.push(...item.independentChildren)
      item.orderedChildren.forEach((child) => {
        if (!ex.orderedChildren.some((x) => x.baseClass === child.baseClass)) {
          ex.orderedChildren.push(child)
        }
      })
    }
  }
  return Array.from(map.values()).map((c) => {
    const nestedChildren = dedup(c.nestedChildren)
    const independentChildren = dedup(c.independentChildren)
    const orderedChildren = c.orderedChildren.map(
      (child) =>
        nestedChildren.find((n) => n.baseClass === child.baseClass) ??
        independentChildren.find((i) => i.baseClass === child.baseClass) ??
        child
    )
    return {
      ...c,
      nestedChildren,
      independentChildren,
      orderedChildren
    }
  })
}

const MAX_DEPTH = 256

function collectDeep(
  $: CheerioAPI,
  node: AnyNode,
  naming: NamingOptions,
  policy: NormalizedSelectorPolicy,
  external: NormalizedExternalOptions,
  depth = 0
): ComponentStructure[] {
  if (depth > MAX_DEPTH) return []
  const list: ComponentStructure[] = []
  $(node)
    .children()
    .each((_, ch) => {
      if (!isElement(ch)) return
      const comp = buildTreeInternal($, ch, naming, policy, external, depth + 1)
      if (comp) {
        comp.viaDeep = true
        list.push(comp)
      } else {
        list.push(...collectDeep($, ch, naming, policy, external, depth + 1))
      }
    })
  return list
}

function buildTreeInternal(
  $: CheerioAPI,
  elem: Element,
  naming: NamingOptions,
  policy: NormalizedSelectorPolicy,
  external: NormalizedExternalOptions,
  depth = 0
): ComponentStructure | null {
  if (depth > MAX_DEPTH) return null
  const [base, ...mods] = elem.attribs.class?.split(/\s+/) ?? []
  if (!base) return null
  const { variantAttributes, stateAttributes } = collectAttributeSelectors(elem.attribs, policy)
  let resolvedBase = base
  let resolvedMods = mods
  const isExternalBase = isExternalClass(resolvedBase, external)
  const node: ComponentStructure = {
    baseClass: resolvedBase,
    isIndependent: !isExternalBase && isBlockClass(resolvedBase, naming),
    modifiers: resolvedMods,
    variantAttributes,
    stateAttributes,
    nestedChildren: [],
    independentChildren: [],
    orderedChildren: [],
    elementTag: elem.tagName
  }

  $(elem)
    .children()
    .each((_, ch) => {
      if (!isElement(ch)) return
      const direct = buildTreeInternal($, ch, naming, policy, external, depth + 1)
      const comps = direct ? [direct] : collectDeep($, ch, naming, policy, external, depth + 1)
      comps.forEach((c) => {
        const tgt = c.isIndependent ? node.independentChildren : node.nestedChildren
        const oth = c.isIndependent ? node.nestedChildren : node.independentChildren
        const dup = tgt.find((x) => x.baseClass === c.baseClass)
        const swp = oth.find((x) => x.baseClass === c.baseClass)
        if (swp) {
          oth.splice(oth.indexOf(swp), 1)
          tgt.push(swp)
        }
        if (dup) {
          dup.modifiers.push(...c.modifiers.filter((m) => !dup.modifiers.includes(m)))
          dup.variantAttributes = dedupAttributeSelectors([
            ...dup.variantAttributes,
            ...c.variantAttributes
          ])
          dup.stateAttributes = dedupAttributeSelectors([
            ...dup.stateAttributes,
            ...c.stateAttributes
          ])
          dup.nestedChildren.push(...c.nestedChildren)
          dup.independentChildren.push(...c.independentChildren)
          c.orderedChildren.forEach((child) => {
            if (!dup.orderedChildren.some((x) => x.baseClass === child.baseClass)) {
              dup.orderedChildren.push(child)
            }
          })
          dup.viaDeep = dup.viaDeep && c.viaDeep!
        } else {
          tgt.push(c)
        }
        if (!node.orderedChildren.some((x) => x.baseClass === c.baseClass)) {
          node.orderedChildren.push(c)
        }
      })
    })

  node.nestedChildren = dedup(node.nestedChildren)
  node.independentChildren = dedup(node.independentChildren)
  node.orderedChildren = node.orderedChildren.map(
    (c) =>
      node.nestedChildren.find((n) => n.baseClass === c.baseClass) ??
      node.independentChildren.find((i) => i.baseClass === c.baseClass) ??
      c
  )
  return node
}

export function buildTree(
  $: CheerioAPI,
  elem: Element,
  naming: NamingOptions,
  depth?: number
): ComponentStructure | null
export function buildTree(
  $: CheerioAPI,
  elem: Element,
  naming: NamingOptions,
  selectorPolicy?: SelectorPolicy,
  depth?: number
): ComponentStructure | null
export function buildTree(
  $: CheerioAPI,
  elem: Element,
  naming: NamingOptions,
  selectorPolicy?: SelectorPolicy,
  externalOptions?: ExternalOptions,
  depth?: number
): ComponentStructure | null
export function buildTree(
  $: CheerioAPI,
  elem: Element,
  naming: NamingOptions,
  selectorPolicyOrDepth?: SelectorPolicy | number,
  externalOptionsOrDepth?: ExternalOptions | number,
  depth = 0
): ComponentStructure | null {
  let selectorPolicy: SelectorPolicy | undefined
  let externalOptions: ExternalOptions | undefined
  let resolvedDepth = depth
  if (typeof selectorPolicyOrDepth === 'number') {
    resolvedDepth = selectorPolicyOrDepth
  } else {
    selectorPolicy = selectorPolicyOrDepth
  }
  if (typeof externalOptionsOrDepth === 'number') {
    resolvedDepth = externalOptionsOrDepth
  } else {
    externalOptions = externalOptionsOrDepth
  }
  const policy = normalizeSelectorPolicy(selectorPolicy)
  const external = normalizeExternalOptions(externalOptions)
  return buildTreeInternal($, elem, naming, policy, external, resolvedDepth)
}

/* ---------- HTML Structure Lint ---------- */

function lintNodeStructure(
  node: ComponentStructure,
  parent: ComponentStructure | null,
  ancestorBlock: ComponentStructure | null,
  naming: NamingOptions,
  policy: NormalizedSelectorPolicy,
  external: NormalizedExternalOptions,
  pathStack: string[],
  isRootNode: boolean,
  isRootMode: boolean,
  issues: HtmlLintIssue[]
): void {
  const base = node.baseClass
  const fullClasses = [base, ...node.modifiers]
  const modifierPattern = buildModifierPattern(naming)
  const modifierTokens = filterModifierTokens(node.modifiers, naming, external)
  const baseIsModifier = modifierPattern.test(base) && !isExternalClass(base, external)

  const baseKind = classifyBaseClassWithExternal(base, naming, external)
  const inferredBaseKind =
    baseKind === 'external' ? findFirstNonExternalBaseKind(node.modifiers, naming, external) : null
  const hasNonExternalClass =
    baseKind === 'external'
      ? node.modifiers.some((modifier) => !isExternalClass(modifier, external))
      : false
  const hasBlockAncestor = ancestorBlock != null

  const path = [...pathStack, base]

  const isExternalBase = baseKind === 'external'
  const hasBase = baseKind === 'block' || baseKind === 'element'
  const effectiveBaseKind =
    baseKind === 'external' && inferredBaseKind ? inferredBaseKind : baseKind

  if (isExternalBase && hasNonExternalClass) {
    const message = inferredBaseKind
      ? `External class "${base}" cannot be used as the base class. Place Block/Element first.`
      : `External class "${base}" cannot be used as the base class. No Block/Element class found.`
    issues.push({
      code: 'INVALID_BASE_CLASS',
      message,
      baseClass: base,
      path
    })
  }

  if (!isExternalBase && baseKind === 'invalid') {
    issues.push({
      code: 'INVALID_BASE_CLASS',
      message: `Invalid base class "${base}" (must be Block or Element).`,
      baseClass: base,
      path
    })
  }

  if (!isExternalBase && hasBase) {
    if (policy.variant.mode === 'class' && node.variantAttributes.length > 0) {
      node.variantAttributes.forEach((attr) => {
        issues.push({
          code: 'DISALLOWED_VARIANT_ATTRIBUTE',
          message: `Variant attribute "${attr.key}" is not allowed when selectorPolicy.variant.mode is "class".`,
          baseClass: base,
          path
        })
      })
    }

    if (policy.state.mode === 'class' && node.stateAttributes.length > 0) {
      node.stateAttributes.forEach((attr) => {
        issues.push({
          code: 'DISALLOWED_STATE_ATTRIBUTE',
          message: `State attribute "${attr.key}" is not allowed when selectorPolicy.state.mode is "class".`,
          baseClass: base,
          path
        })
      })
    }
  }

  if (!isExternalBase && hasBase) {
    const variantValuePattern = buildValuePattern(policy.variant.valueNaming)
    const stateValuePattern = buildValuePattern(policy.state.valueNaming)

    if (policy.variant.mode === 'data') {
      node.variantAttributes.forEach((attr) => {
        if (!attr.value) return
        if (!variantValuePattern.test(attr.value)) {
          issues.push({
            code: 'INVALID_VARIANT_VALUE',
            message: `Attribute "${attr.key}" value "${attr.value}" does not match selectorPolicy valueNaming.`,
            baseClass: base,
            path
          })
        }
      })
    }

    if (policy.state.mode === 'data') {
      node.stateAttributes.forEach((attr) => {
        if (!attr.key.startsWith('data-')) return
        if (!attr.value) return
        if (!stateValuePattern.test(attr.value)) {
          issues.push({
            code: 'INVALID_STATE_VALUE',
            message: `Attribute "${attr.key}" value "${attr.value}" does not match selectorPolicy valueNaming.`,
            baseClass: base,
            path
          })
        }
      })
    }
  }

  const modifiersAllowed = !(policy.variant.mode === 'data' && policy.state.mode === 'data')
  if (!isExternalBase && !modifiersAllowed && hasBase) {
    modifierTokens.forEach((modifier) => {
      issues.push({
        code: 'DISALLOWED_MODIFIER',
        message:
          `Modifier "${modifier}" is not allowed when selectorPolicy variant/state are both "data".`,
        baseClass: base,
        path
      })
    })
  }

  const hasModifier = modifierTokens.length > 0 || baseIsModifier
  const hasUtility = fullClasses.some((c) => c.startsWith('u-'))

  if (!isExternalBase && !hasBase && hasModifier) {
    issues.push({
      code: 'MODIFIER_WITHOUT_BASE',
      message: `Modifier class used without Block/Element base (classes: "${fullClasses.join(' ')}").`,
      baseClass: base,
      path
    })
  }

  if (!isExternalBase && !hasBase && hasUtility) {
    issues.push({
      code: 'UTILITY_WITHOUT_BASE',
      message: `Utility class used without Block/Element base (classes: "${fullClasses.join(' ')}").`,
      baseClass: base,
      path
    })
  }

  if (!isExternalBase && hasBase) {
    for (const other of node.modifiers) {
      if (isExternalClass(other, external)) continue
      if (isBlockClass(other, naming) || isElementBase(other, naming)) {
        issues.push({
          code: 'MULTIPLE_BASE_CLASSES',
          message: `Multiple Block/Element-like classes on the same element ("${base}", "${other}").`,
          baseClass: base,
          path
        })
        break
      }
    }
  }

  if (!isExternalBase && isRootMode && isRootNode && baseKind !== 'block') {
    issues.push({
      code: 'ROOT_NOT_BLOCK',
      message: `Root element base class "${base}" must be a Block.`,
      baseClass: base,
      path
    })
  }

  if (!isExternalBase && baseKind === 'element' && !hasBlockAncestor) {
    issues.push({
      code: 'ELEMENT_WITHOUT_BLOCK_ANCESTOR',
      message: `Element "${base}" does not have any Block ancestor.`,
      baseClass: base,
      path
    })
  }

  if (!isExternalBase && baseKind === 'block' && parent) {
    const parentKind = classifyBaseClassWithExternal(parent.baseClass, naming, external)
    if (parentKind === 'element') {
      issues.push({
        code: 'ELEMENT_PARENT_OF_BLOCK',
        message: `Block "${base}" cannot be nested directly under Element "${parent.baseClass}".`,
        baseClass: base,
        path
      })
    }
  }

  const nextAncestorBlock = effectiveBaseKind === 'block' ? node : ancestorBlock

  const children = [...node.nestedChildren, ...node.independentChildren]
  for (const child of children) {
    lintNodeStructure(
      child,
      node,
      nextAncestorBlock,
      naming,
      policy,
      external,
      path,
      false,
      isRootMode,
      issues
    )
  }
}

export function lintHtmlStructure(
  rawHtml: string,
  isRootMode: boolean,
  naming: NamingOptions,
  selectorPolicy?: SelectorPolicy,
  externalOptions?: ExternalOptions
): HtmlLintIssue[] {
  const raw = isRootMode ? rawHtml : `<wrapper>${rawHtml}</wrapper>`
  const sanitized = sanitizeHtml(raw)
  const explicitRoot = detectExplicitRoot(sanitized)
  const $: CheerioAPI = explicitRoot ? load(sanitized) : load(sanitized, null, false)
  const policy = normalizeSelectorPolicy(selectorPolicy)
  const external = normalizeExternalOptions(externalOptions)

  const issues: HtmlLintIssue[] = []
  const unbalanced = findUnbalancedTags(sanitized)
  if (unbalanced) {
    issues.push({
      code: 'UNBALANCED_HTML',
      message: formatUnbalancedMessage(unbalanced),
      baseClass: '',
      path: []
    })
  }
  let roots: Element[]
  if (isRootMode) {
    if (!explicitRoot) {
      const rootElements = $.root().children().get().filter(isRootCandidate)
      if (rootElements.length > 1) {
        issues.push({
          code: 'MULTIPLE_ROOT_ELEMENTS',
          message:
            'Multiple root elements found. Root mode expects a single root element.',
          baseClass: '',
          path: []
        })
      }
    }
    const explicitNode = findExplicitRoot($, explicitRoot)
    const node = explicitNode ?? findFirstElement($)
    if (!node) {
      issues.push({
        code: 'INVALID_BASE_CLASS',
        message: 'No element found.',
        baseClass: '',
        path: []
      })
      return issues
    }
    if (!hasClassAttribute(node)) {
      issues.push({
        code: 'INVALID_BASE_CLASS',
        message: 'Root element does not have a class attribute.',
        baseClass: '',
        path: []
      })
      return issues
    }
    roots = [node]
  } else {
    roots = $('wrapper').children().get().filter(isElement)
  }
  if (roots.length === 0) {
    issues.push({
      code: 'INVALID_BASE_CLASS',
      message: 'No element with class attribute found.',
      baseClass: '',
      path: []
    })
    return issues
  }

  for (const rootEl of roots) {
    const tree = buildTree($, rootEl, naming, policy, external)
    if (!tree) continue
    lintNodeStructure(tree, null, null, naming, policy, external, [], true, isRootMode, issues)
  }

  return issues
}

/* ---------- SCSS Writer ---------- */
function block(
  c: ComponentStructure,
  lv: number,
  layoutMixins: string[],
  childScssDir: string,
  childFileCase: FileNameCase,
  policy: NormalizedSelectorPolicy,
  naming: NamingOptions,
  external: NormalizedExternalOptions,
  isRoot: boolean = false
): string {
  const ind = indent(lv)
  const buf: string[] = []
  const hasIndependentChildren = c.orderedChildren.some((ch) => ch.isIndependent)

  // If the root Block has independent child Blocks, prepend meta.load-css().
  if (isRoot && hasIndependentChildren) {
    buf.push(`${ind}@include meta.load-css("${childScssDir}");`, '')
  }

  if (layoutMixins.length === 0) {
    buf.push(`${ind}// ${c.isIndependent ? 'block' : 'element'} base styles`, '')
  } else {
    layoutMixins.forEach((mixin) => {
      buf.push(
        `${ind}${mixin} {`,
        `${indent(lv + 1)}// layout mixin`,
        `${ind}}`,
        ''
      )
    })
  }

  const variantSelectors = new Set<string>()
  const stateSelectors = new Set<string>()
  const { variantClassModifiers, stateClassModifiers } = splitClassModifiers(
    c.modifiers,
    policy,
    naming,
    external
  )

  variantClassModifiers.forEach((m) => {
    variantSelectors.add(`&.${m}`)
  })

  if (policy.variant.mode !== 'class') {
    c.variantAttributes.forEach((attr) => {
      variantSelectors.add(`&${formatAttributeSelector(attr)}`)
    })
  }

  if (policy.state.mode === 'data') {
    c.stateAttributes.forEach((attr) => {
      stateSelectors.add(`&${formatAttributeSelector(attr)}`)
    })
  }
  stateClassModifiers.forEach((m) => {
    stateSelectors.add(`&.${m}`)
  })

  const elementStateEntries = c.isIndependent
    ? collectElementStateEntries(c, policy, naming, external)
    : []

  variantSelectors.forEach((sel) => {
    if (layoutMixins.length === 0) {
      buf.push(
        `${ind}${sel} {`,
        `${indent(lv + 1)}// variant styles`,
        `${ind}}`,
        ''
      )
    } else {
      layoutMixins.forEach((mixin) => {
        buf.push(
          `${ind}${sel} {`,
          `${indent(lv + 1)}${mixin} {`,
          `${indent(lv + 2)}// variant styles`,
          `${indent(lv + 1)}}`,
          `${ind}}`,
          ''
        )
      })
    }
  })

  c.orderedChildren.forEach((ch) => {
    if (ch.isIndependent) {
      // In SpiraCSS, Block > Block is always a direct child, so always use >.
      const sel = `> .${ch.baseClass}`
      const childFileBase = formatFileBase(ch.baseClass, childFileCase)
      const childRelBase = c.isRoot ? `${childScssDir}/${childFileBase}` : childFileBase
      if (layoutMixins.length === 0) {
        buf.push(
          `${ind}${sel} {`,
          `${indent(lv + 1)}// @rel/${childRelBase}.scss`,
          `${indent(lv + 1)}// child component layout`,
          `${ind}}`,
          ''
        )
      } else {
        layoutMixins.forEach((mixin) => {
          buf.push(
            `${ind}${sel} {`,
            `${indent(lv + 1)}// @rel/${childRelBase}.scss`,
            `${indent(lv + 1)}${mixin} {`,
            `${indent(lv + 2)}// child component layout`,
            `${indent(lv + 1)}}`,
            `${ind}}`,
            ''
          )
        })
      }
    } else {
      buf.push(
        `${ind}> .${ch.baseClass} {`,
        block(ch, lv + 1, layoutMixins, childScssDir, childFileCase, policy, naming, external),
        `${ind}}`,
        ''
      )
    }
  })

  // SpiraCSS section layout: shared / interaction (added to every Block)
  if (c.isIndependent) {
    buf.push(
      '',
      `${ind}// --shared ----------------------------------------`,
      '',
      `${ind}// --interaction -----------------------------------`
    )

    if (stateSelectors.size > 0 || elementStateEntries.length > 0) {
      buf.push(`${ind}@at-root & {`)
      stateSelectors.forEach((sel) => {
        buf.push(
          `${indent(lv + 1)}${sel} {`,
          `${indent(lv + 2)}// state styles`,
          `${indent(lv + 1)}}`,
          ''
        )
      })
      elementStateEntries.forEach((entry) => {
        const pathSelector = formatElementPath(entry.path)
        buf.push(`${indent(lv + 1)}${pathSelector} {`)
        entry.selectors.forEach((sel) => {
          buf.push(
            `${indent(lv + 2)}${sel} {`,
            `${indent(lv + 3)}// state styles`,
            `${indent(lv + 2)}}`,
            ''
          )
        })
        buf.push(`${indent(lv + 1)}}`, '')
      })
      buf.push(`${ind}}`, '')
    } else {
      buf.push(`${ind}// @at-root & {`, `${ind}// }`, '')
    }
  }

  return buf.join('\n').trimEnd()
}

function scssContent(
  c: ComponentStructure,
  parent: ComponentStructure | undefined,
  hint: string,
  opts: GeneratorOptions,
  policy: NormalizedSelectorPolicy,
  external: NormalizedExternalOptions,
  childFileCase: FileNameCase,
  parentRootFileBase?: string
): string {
  const { globalScssModule, pageEntryPrefix, layoutMixins, childScssDir } = opts

  const header = c.isRoot
    ? `@use "${globalScssModule}" as *;\n@use "sass:meta";\n\n// ${pageEntryPrefix}/${hint}\n\n`
    : `@use "${globalScssModule}" as *;\n\n${
        parent
          ? `// @rel/${
              parentRootFileBase
                ? `../${parentRootFileBase}`
                : parent.isRoot
                  ? `../${camelize(parent.baseClass)}`
                  : formatFileBase(parent.baseClass, childFileCase)
            }.scss\n\n`
          : '// @rel/(parent-block).scss\n\n'
      }`

  return `${header}.${c.baseClass} {\n${block(
    c,
    1,
    layoutMixins,
    childScssDir,
    childFileCase,
    policy,
    opts.naming,
    external,
    c.isRoot ?? false
  )}\n}\n`
}

/* ---------- public: HTML -> GeneratedFile[] ---------- */

export function generateFromHtml(
  rawHtml: string,
  docDir: string,
  isRootMode: boolean,
  opts: GeneratorOptions
): GeneratedFile[] {
  const raw = isRootMode ? rawHtml : `<wrapper>${rawHtml}</wrapper>`
  const sanitized = sanitizeHtml(raw)
  const explicitRoot = detectExplicitRoot(sanitized)
  const $: CheerioAPI = explicitRoot ? load(sanitized) : load(sanitized, null, false)
  const policy = normalizeSelectorPolicy(opts.selectorPolicy)
  const external = normalizeExternalOptions(opts.external)

  let roots: Element[]
  if (isRootMode) {
    if (!explicitRoot) {
      const rootElements = $.root().children().get().filter(isRootCandidate)
      if (rootElements.length > 1) {
        throw new Error(
          'Multiple root elements found. Root mode expects a single root element.'
        )
      }
    }
    const explicitNode = findExplicitRoot($, explicitRoot)
    const node = explicitNode ?? findFirstElement($)
    if (!node) {
      throw new Error('No root element found.')
    }
    if (!hasClassAttribute(node)) {
      throw new Error('Root element does not have a class attribute.')
    }
    roots = [node]
  } else {
    roots = $('wrapper').children().get().filter(isElement)
    if (roots.length === 0) {
      throw new Error('No elements with a class attribute found.')
    }
  }

  const results: GeneratedFile[] = []
  const uses = new Set<string>()
  const childDir = opts.childScssDir
  const rootFileCase = normalizeFileNameCase(opts.rootFileCase)
  const childFileCase = normalizeFileNameCase(opts.childFileCase)

  const gatherIndependent = (root: ComponentStructure): string[] => {
    const out: string[] = []
    const stack = [...root.independentChildren]
    while (stack.length) {
      const n = stack.pop()!
      out.push(`${formatFileBase(n.baseClass, childFileCase)}.scss`)
      stack.push(...n.independentChildren)
    }
    return out
  }

  const emitComponents = (
    comp: ComponentStructure,
    parent: ComponentStructure | undefined,
    rootFileBase?: string
  ): void => {
    if (parent && comp.isIndependent && parent !== comp) {
      const childFileBase = formatFileBase(comp.baseClass, childFileCase)
      const relPath = `${childDir}/${childFileBase}.scss`
      const parentRootFileBase = parent.isRoot ? rootFileBase : undefined
      // parent always exists, so hint is unused (pass empty string just in case)
      results.push({
        path: relPath,
        content: scssContent(
          comp,
          parent,
          '',
          opts,
          policy,
          external,
          childFileCase,
          parentRootFileBase
        )
      })
    }
    for (const ch of comp.independentChildren) {
      emitComponents(ch, comp, rootFileBase)
    }
  }

  const rootTrees: ComponentStructure[] = []
  for (const rootEl of roots) {
    const tree = buildTree($, rootEl, opts.naming, policy, external)
    if (!tree || !tree.isIndependent) continue
    tree.isRoot = isRootMode
    rootTrees.push(tree)
  }

  const mergedRoots = isRootMode ? rootTrees : dedup(rootTrees)

  for (const tree of mergedRoots) {
    const rootFileBase = formatFileBase(tree.baseClass, rootFileCase)
    const rootFile = isRootMode
      ? `${rootFileBase}.scss`
      : `${childDir}/${rootFileBase}.scss`
    // When isRootMode, the parent file is typically a page entry like index.scss.
    const pageEntryHint = isRootMode ? 'index.scss' : 'page-entry.scss'
    results.push({
      path: rootFile,
      content: scssContent(tree, undefined, pageEntryHint, opts, policy, external, childFileCase)
    })

    if (!isRootMode) {
      uses.add(`@use "${rootFileBase}";`)
    }
    gatherIndependent(tree).forEach((f) => uses.add(`@use "${f.replace(/\.scss$/, '')}";`))

    emitComponents(tree, tree, rootFileBase)
  }

  if (uses.size > 0) {
    results.push({
      path: `${childDir}/index.scss`,
      content: Array.from(uses).join('\n') + '\n'
    })
  }

  // Result paths are relative to docDir (caller joins).
  return results
}

export function summarizeRootBlocks(
  rawHtml: string,
  isRootMode: boolean,
  opts: GeneratorOptions
): RootBlockSummary[] {
  const raw = isRootMode ? rawHtml : `<wrapper>${rawHtml}</wrapper>`
  const sanitized = sanitizeHtml(raw)
  const explicitRoot = detectExplicitRoot(sanitized)
  const $: CheerioAPI = explicitRoot ? load(sanitized) : load(sanitized, null, false)
  const policy = normalizeSelectorPolicy(opts.selectorPolicy)
  const external = normalizeExternalOptions(opts.external)

  let roots: Element[]
  if (isRootMode) {
    const explicitNode = findExplicitRoot($, explicitRoot)
    const node = explicitNode ?? findFirstElement($)
    if (!node || !hasClassAttribute(node)) return []
    roots = [node]
  } else {
    roots = $('wrapper').children().get().filter(isElement)
  }

  const counts = new Map<string, number>()
  for (const rootEl of roots) {
    const tree = buildTree($, rootEl, opts.naming, policy, external)
    if (!tree || !tree.isIndependent) continue
    const current = counts.get(tree.baseClass) ?? 0
    counts.set(tree.baseClass, current + 1)
  }

  return Array.from(counts, ([baseClass, count]) => ({ baseClass, count }))
}
