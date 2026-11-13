import type { HtmlLintIssue } from '../generator-core'
import { completeDiagnostic } from './repair'
import type { MarkupConfig } from './types'
import type { SourceIndex } from './source'

export const isBlockingMarkupIssue = (issue: HtmlLintIssue): boolean =>
  [
    'PARSE_ERROR',
    'PARSER_UNAVAILABLE',
    'PARSER_RUNTIME_ERROR',
    'CONFIG_INVALID',
    'FORMAT_UNSUPPORTED',
    'MAX_DEPTH_EXCEEDED'
  ].includes(issue.code)

/** A parser/runtime failure must not ask users to rename classes or fix syntax. */
export function markupFailure(
  error: unknown,
  config: MarkupConfig,
  index: SourceIndex,
  configuration = false
): HtmlLintIssue {
  const detail = error instanceof Error ? error.message : String(error)
  const data =
    error && typeof error === 'object'
      ? (error as {
          code?: string
          pos?: number
          sourceRange?: [number, number]
          markupMetrics?: Partial<SourceIndex['metrics']>
        })
      : undefined
  if (data?.markupMetrics) Object.assign(index.metrics, data.markupMetrics)
  const syntax = error instanceof SyntaxError
  const unavailable = data?.code === 'PARSER_UNAVAILABLE'
  const code = configuration
    ? 'CONFIG_INVALID'
    : unavailable
      ? 'PARSER_UNAVAILABLE'
      : syntax
        ? 'PARSE_ERROR'
        : 'PARSER_RUNTIME_ERROR'
  const offset = Math.max(0, Math.min(index.source.length, data?.sourceRange?.[0] ?? data?.pos ?? 0))
  const issue = completeDiagnostic(
    {
      code,
      kind: syntax && !configuration ? 'syntax' : 'unsupported',
      message: detail,
      reason: detail,
      baseClass: '',
      path: [],
      ...(data?.sourceRange || typeof data?.pos === 'number'
        ? {
            range: [
              offset,
              Math.max(offset, Math.min(index.source.length, data?.sourceRange?.[1] ?? offset))
            ] as [number, number]
          }
        : {})
    },
    configuration ? {} : config,
    index
  )
  issue.repair = {
    conditions: [
      configuration
        ? 'Correct the reported project configuration before checking markup.'
        : syntax
          ? 'Correct the reported source syntax at this location, then rerun the parser.'
          : unavailable
            ? 'Supply the required format parser and host configuration before checking markup.'
            : data?.code === 'ASTRO_SOURCE_RELATION'
              ? 'Generated parsing succeeded, but the original source relation cannot be verified. Check expressions, comments and opening/closing correspondence' +
                (data.sourceRange || typeof data.pos === 'number'
                  ? ' in the reported source range'
                  : ' in the original source') +
                '; do not infer missing closing tags or a resource fault without evidence.'
              : data?.code === 'ASTRO_GENERATED_SYNTAX'
                ? 'The generated TSX cannot be parsed and the original expression syntax cannot be distinguished from a compiler conversion constraint. Reduce this expression to a supported, source-mappable form and rerun; do not edit frontmatter or restore runtime resources without evidence.'
                : 'Restore parser/runtime availability or resources; this is not evidence of a class-naming or source-syntax violation.'
    ],
    effective: {}
  }
  return issue
}
