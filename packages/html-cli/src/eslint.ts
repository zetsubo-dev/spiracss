import type { Rule } from 'eslint'
import { adaptHtmlAst } from './markup/adapters/html-ast'
import { adaptJsxAst } from './markup/adapters/jsx'
import { adaptVueAst } from './markup/adapters/vue'
import { sourceFormat } from './markup/format'
import { validateMarkup } from './markup/validate'
import { SourceIndex } from './markup/source'
import type { MarkupConfig, MarkupFormat } from './markup/types'
import { createMarkupRuleContext, type HtmlLintIssue } from './generator-core'
import { markupFailure } from './markup/failures'
import {
  allMarkupAttributes,
  applyWebcBindings,
  parseWebcAttributeExpressions,
  type WebcExpressions
} from './markup/adapters/webc'

const codes = [
  'INVALID_BASE_CLASS',
  'UNBALANCED_HTML',
  'MULTIPLE_ROOT_ELEMENTS',
  'MODIFIER_WITHOUT_BASE',
  'DISALLOWED_MODIFIER',
  'UTILITY_WITHOUT_BASE',
  'MULTIPLE_BASE_CLASSES',
  'ROOT_NOT_BLOCK',
  'ELEMENT_WITHOUT_BLOCK_ANCESTOR',
  'ELEMENT_PARENT_OF_BLOCK',
  'DISALLOWED_VARIANT_ATTRIBUTE',
  'DISALLOWED_STATE_ATTRIBUTE',
  'INVALID_VARIANT_VALUE',
  'INVALID_STATE_VALUE',
  'DYNAMIC_CLASS_UNRESOLVED',
  'CLASSLESS_TAG_NOT_ALLOWED',
  'MAX_DEPTH_EXCEEDED',
  'UNCLASSIFIED_CLASS_TOKEN',
  'PARSE_ERROR',
  'PARSER_RUNTIME_ERROR',
  'CONFIG_INVALID',
  'PARSER_UNAVAILABLE',
  'FORMAT_UNSUPPORTED',
  'SOURCE_RELATION_UNRESOLVED',
  'CONFIG_MISSING'
]

export function diagnosticMessage(issue: HtmlLintIssue): string {
  return `${issue.message} Reason: ${issue.reason}. Repair: ${JSON.stringify(issue.repair)}${issue.condition ? ` Condition: ${issue.condition}.` : ''} Docs: ${issue.docs}`
}

const markupRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate source markup using the shared SpiraCSS core.',
      url: 'https://spiracss.jp/tooling/html-cli/'
    },
    schema: [
      {
        type: 'object',
        properties: {
          config: { type: 'object' },
          format: { enum: ['html', 'webc', 'jsx', 'tsx', 'astro', 'vue'] },
          mode: { enum: ['root', 'selection'] },
          customPatternsIdentity: { type: 'object' }
        },
        additionalProperties: false
      }
    ],
    messages: Object.fromEntries(codes.map((code) => [code, '{{message}}']))
  },
  create(context) {
    const options = context.options[0] as
      | { config?: MarkupConfig; format?: MarkupFormat; mode?: 'root' | 'selection' }
      | undefined
    return {
      'Program:exit'() {
        const sourceCode = context.sourceCode
        const source = sourceCode.text
        if (!options?.config) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'CONFIG_MISSING',
            data: {
              message: 'Preload the project config with loadProjectOptions and pass its resolved options to this rule.'
            }
          })
          return
        }
        let issues: HtmlLintIssue[]
        let configValidated = false
        try {
          createMarkupRuleContext(options.config)
          configValidated = true
          const format = options.format ?? sourceFormat(context.filename)
          let document =
            format === 'jsx' || format === 'tsx'
              ? adaptJsxAst(source, sourceCode.ast, options.mode ?? 'root', options.config)
              : format === 'astro'
                ? adaptJsxAst(source, sourceCode.ast, options.mode ?? 'root', options.config, 'astro')
                : format === 'vue'
                  ? adaptVueAst(
                      source,
                      sourceCode.ast,
                      options.mode ?? 'root',
                      options.config,
                      typeof sourceCode.parserServices.getDocumentFragment === 'function'
                        ? sourceCode.parserServices.getDocumentFragment()
                        : undefined
                    )
                  : adaptHtmlAst(source, sourceCode.ast, options.config)
          if (format === 'webc') {
            const service = sourceCode.parserServices.spiracssWebcExpressions as WebcExpressions | undefined
            document = applyWebcBindings(document, options.config, service ?? new Map())
          }
          issues = validateMarkup(document, options.config, options.mode ?? 'root').errors
        } catch (error) {
          const index = new SourceIndex(source)
          issues = [markupFailure(error, options.config, index, !configValidated)]
        }
        for (const issue of issues) {
          const range = issue.range ?? [0, 0]
          context.report({
            loc: { start: sourceCode.getLocFromIndex(range[0]), end: sourceCode.getLocFromIndex(range[1]) },
            messageId: issue.code,
            data: { message: diagnosticMessage(issue) }
          })
        }
      }
    }
  }
}

export const rules = { markup: markupRule }
export const plugin = { meta: { name: '@spiracss/html-cli/eslint' }, rules }

/** Supply the host parser explicitly; importing the ordinary CLI needs no ESLint. */
export function createMarkupEslintConfig(config: MarkupConfig, parser: unknown, files = ['**/*.html', '**/*.webc']) {
  const customPatternsIdentity = Object.fromEntries(
    Object.entries(config.naming?.customPatterns ?? {}).flatMap(([name, pattern]) =>
      pattern instanceof RegExp ? [[name, { source: pattern.source, flags: pattern.flags }]] : []
    )
  )
  const host = parser as {
    parseForESLint(
      source: string,
      options?: Record<string, unknown>
    ): { ast: unknown; services?: Record<string, unknown> }
  }
  const wrapped = {
    meta: { name: '@spiracss/html-cli/html-host' },
    parseForESLint(source: string, options?: Record<string, unknown>) {
      const parsed = host.parseForESLint(source, options)
      if (sourceFormat(typeof options?.filePath === 'string' ? options.filePath : undefined) !== 'webc') return parsed
      const document = adaptHtmlAst(source, parsed.ast, config)
      const expressions = parseWebcAttributeExpressions(allMarkupAttributes(document), config, document.index)
      return {
        ...parsed,
        services: {
          ...parsed.services,
          spiracssWebcExpressions: expressions
        }
      }
    }
  }
  return {
    files,
    languageOptions: { parser: wrapped },
    plugins: { spiracss: plugin },
    rules: { 'spiracss/markup': ['error', { config, customPatternsIdentity }] }
  }
}

export default plugin
