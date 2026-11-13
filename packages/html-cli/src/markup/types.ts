import type {
  ExternalOptions,
  HtmlLintIssue,
  HtmlLintMode,
  HtmlLintOptions,
  HtmlTargetPath,
  JsxClassBindingsConfig,
  NamingOptions,
  SelectorPolicy
} from '../generator-core'
import type { SourceIndex, SourceRange } from './source'

export type MarkupFormat = 'html' | 'webc' | 'jsx' | 'tsx' | 'astro' | 'vue'
export type MarkupConfig = {
  naming?: NamingOptions
  selectorPolicy?: SelectorPolicy
  external?: ExternalOptions
  jsxClassBindings?: JsxClassBindingsConfig
  htmlLint?: HtmlLintOptions
}
export type ClassToken = { value: string; range: SourceRange }
export type Guard = Record<string, boolean>
export type ClassAlternative = {
  tokens: ClassToken[]
  guard: Guard
  unresolved?: SourceRange
  correlationUnknown?: boolean
  ownerUnknown?: boolean
}
export type AttributeAlternative = {
  value?: string
  range: SourceRange
  guard: Guard
  unresolved?: boolean
  attributeRange?: SourceRange
  present?: boolean
  winnerUnknown?: boolean
  /** Reachable generation-only literals; never definite lint values or repair sites. */
  generationValues?: string[]
  overwrittenBy?: SourceRange
}
export type MarkupAttribute = {
  name: string
  value: string
  range: SourceRange
  valueRange: SourceRange
  alternatives?: AttributeAlternative[]
  overwrittenBy?: SourceRange
  present?: boolean
  winnerUnknown?: boolean
}
export type MarkupElement = {
  detached?: boolean
  tag: string
  range: SourceRange
  openRange: SourceRange
  namespace?: string
  classes: ClassAlternative[]
  attributes: MarkupAttribute[]
  children: MarkupElement[]
  implicit?: boolean
  component?: boolean
  rootRule?: boolean
  ancestryUnknown?: boolean
  guard?: Guard
  targetPath?: HtmlTargetPath
  relationUnknown?: SourceRange
  htmlRecovery?: boolean
}
export type MarkupDocument = {
  generationUnresolved?: boolean
  roots: MarkupElement[]
  issues: HtmlLintIssue[]
  index: SourceIndex
  outOfScope: number
  checkRootCount?: boolean
}
export type MarkupParser =
  | { available: true; parse(source: string, mode: HtmlLintMode, config: MarkupConfig): MarkupDocument }
  | { available: false; reason: string }
export type MarkupParsers = Partial<Record<MarkupFormat, MarkupParser>>
export type MarkupLintResult = {
  ok: boolean
  status: 'pass' | 'failed' | 'blocked'
  errors: HtmlLintIssue[]
  format: MarkupFormat
  coverage: {
    scope: 'source'
    path: 'parser' | 'supplied-ast'
    elements: number
    unresolved: number
    outOfScope: number
    generationUnenumeratedSites: number
  }
  metrics: SourceIndex['metrics']
}
export type MarkupLintOptions = {
  format: MarkupFormat
  mode: HtmlLintMode
  parsers: MarkupParsers
  config: MarkupConfig
}
