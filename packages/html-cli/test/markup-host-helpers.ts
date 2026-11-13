import assert from 'assert'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import * as tsParser from '@typescript-eslint/parser'
import * as vueParser from 'vue-eslint-parser'
import { createMarkupEslintConfig, plugin } from '../src/eslint'
import { lintMarkup, loadMarkupParsers, type MarkupConfig, type MarkupFormat } from '../src/markup'
import { SourceIndex } from '../src/markup/source'

export async function lintBothEntries(
  source: string,
  format: MarkupFormat,
  config: MarkupConfig = {},
  mode: 'root' | 'selection' = 'root'
) {
  const native = lintMarkup(source, { format, mode, config, parsers: await loadMarkupParsers([format]) })
  const parser = format === 'astro' ? await import('astro-eslint-parser') : format === 'vue' ? vueParser : tsParser
  const flat =
    format === 'html' || format === 'webc'
      ? createMarkupEslintConfig(config, htmlParser)
      : {
          files: [`**/*.${format}`],
          languageOptions: {
            parser,
            parserOptions: {
              ecmaVersion: 'latest',
              sourceType: 'module',
              ecmaFeatures: { jsx: true },
              ...(format === 'vue' ? { parser: tsParser } : {})
            }
          },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config, format, mode }] }
        }
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [flat] as never })
  const host = (await eslint.lintText(source, { filePath: `r3.${format}` }))[0]
  return { native, host }
}
export function assertEntryParity(source: string, result: Awaited<ReturnType<typeof lintBothEntries>>) {
  const index = new SourceIndex(source)
  const offset = (line: number, column: number) => index.lineStarts[line - 1] + column - 1
  assert.ok(!result.host.messages.some((message) => message.fatal), JSON.stringify(result.host.messages))
  assert.deepStrictEqual(
    result.host.messages
      .map((message) =>
        JSON.stringify([
          message.messageId,
          offset(message.line, message.column),
          message.endLine && message.endColumn ? offset(message.endLine, message.endColumn) : undefined
        ])
      )
      .sort(),
    result.native.errors
      .map((issue) => JSON.stringify([issue.code, ...(issue.range ?? [undefined, undefined])]))
      .sort(),
    source
  )
}
