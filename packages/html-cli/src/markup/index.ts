import { parseHtmlSource } from './adapters/html'
import { parseJsxSource } from './adapters/jsx'
import { parseAstroSource, type AstroCompiler } from './adapters/astro'
import { parseVueSource } from './adapters/vue'
import { applyWebcBindings, parseWebcAttributeExpressions } from './adapters/webc'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { SourceIndex } from './source'
import { completeDiagnostic } from './repair'
import { validateMarkup } from './validate'
import { createMarkupRuleContext } from '../generator-core'
import { markupFailure } from './failures'
import type { MarkupFormat, MarkupLintOptions, MarkupLintResult, MarkupParsers } from './types'

export * from './types'

/** Handles belong to the caller, not to mutable last-loaded process state. */
export async function loadMarkupParsers(formats: readonly MarkupFormat[]): Promise<MarkupParsers> {
  const parsers: MarkupParsers = {}
  for (const format of formats) {
    if (format === 'astro') {
      try {
        const sidecar = path.join(__dirname, 'parsers/astro.cjs')
        const compiler = createRequire(__filename)(
          existsSync(sidecar) ? sidecar : '@astrojs/compiler/sync'
        ) as AstroCompiler
        parsers.astro = {
          available: true,
          parse: (source, mode, config) => parseAstroSource(source, compiler, config, mode)
        }
      } catch (error) {
        parsers.astro = { available: false, reason: error instanceof Error ? error.message : String(error) }
      }
      continue
    }
    parsers[format] =
      format === 'html'
        ? { available: true, parse: parseHtmlSource }
        : format === 'webc'
          ? {
              available: true,
              parse: (source, mode, config) => {
                const document = parseHtmlSource(source, mode, config)
                return applyWebcBindings(document, config, parseWebcAttributeExpressions(document, config))
              }
            }
          : format === 'jsx' || format === 'tsx'
            ? {
                available: true,
                parse: (source, mode, config) => parseJsxSource(source, mode, config, format === 'tsx')
              }
            : format === 'vue'
              ? { available: true, parse: parseVueSource }
              : { available: false, reason: `Unsupported markup format: ${format}.` }
  }
  return parsers
}

export function lintMarkup(source: string, options: MarkupLintOptions): MarkupLintResult {
  try {
    createMarkupRuleContext(options.config)
  } catch (error) {
    const index = new SourceIndex(source)
    return {
      ok: false,
      status: 'blocked',
      errors: [markupFailure(error, options.config, index, true)],
      format: options.format,
      coverage: {
        scope: 'source',
        path: 'parser',
        elements: 0,
        unresolved: 0,
        outOfScope: 0,
        generationUnenumeratedSites: 0
      },
      metrics: index.metrics
    }
  }
  const parser = options.parsers[options.format]
  if (!parser?.available) {
    const index = new SourceIndex(source)
    const issue = completeDiagnostic(
      {
        code: 'PARSER_UNAVAILABLE',
        kind: 'unsupported',
        message: parser && !parser.available ? parser.reason : `No ${options.format} parser handle supplied.`,
        baseClass: '',
        path: []
      },
      options.config,
      index
    )
    return {
      ok: false,
      status: 'blocked',
      errors: [issue],
      format: options.format,
      coverage: {
        scope: 'source',
        path: 'parser',
        elements: 0,
        unresolved: 0,
        outOfScope: 0,
        generationUnenumeratedSites: 0
      },
      metrics: index.metrics
    }
  }
  try {
    return {
      ...validateMarkup(parser.parse(source, options.mode, options.config), options.config, options.mode),
      format: options.format
    }
  } catch (error) {
    const index = new SourceIndex(source)
    index.metrics.markupParses = 1
    const issue = markupFailure(error, options.config, index)
    return {
      ok: false,
      status: 'blocked',
      errors: [issue],
      format: options.format,
      coverage: {
        scope: 'source',
        path: 'parser',
        elements: 0,
        unresolved: 0,
        outOfScope: 0,
        generationUnenumeratedSites: 0
      },
      metrics: index.metrics
    }
  }
}
