import assert from 'assert'
import { before, describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import { createMarkupEslintConfig, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers, type MarkupParsers } from '../src/markup'

describe('WebC dynamic attribute source semantics', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['webc'])
  })
  const run = (source: string) => lintMarkup(source, { format: 'webc', mode: 'root', config: {}, parsers })

  it('resolves scalar literals and merges/deduplicates class in source order', () => {
    for (const source of [
      '<div :class="\'card-list\'"></div>',
      '<div class="card-list" :class="\'card-list u-extra\'"></div>'
    ])
      assert.strictEqual(run(source).status, 'pass', JSON.stringify(run(source).errors))
    const reversed = run('<div :class="\'title\'" class="card-list"></div>')
    assert.ok(reversed.errors.some((issue) => issue.code === 'ROOT_NOT_BLOCK'))
  })

  it('retains unresolved dynamic class and configured value checks', () => {
    assert.ok(
      run('<div class="card-list" :class="value"></div>').errors.some(
        (issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'
      )
    )
    const source = '<div class="card-list" :data-variant="\'Bad_Name\'"></div>'
    const issue = run(source).errors.find((item) => item.code === 'INVALID_VARIANT_VALUE')!
    assert.strictEqual(source.slice(...issue.range!), 'Bad_Name')
  })

  it('supplies parsed expressions in the host wrapper for the rule', async () => {
    const source = '<div class="card-list" :data-variant="\'Bad_Name\'"></div>'
    const flat = createMarkupEslintConfig({}, htmlParser)
    const parsed = flat.languageOptions.parser.parseForESLint(source, { filePath: 'component.webc' })
    const expressions = parsed.services?.spiracssWebcExpressions
    assert.ok(expressions instanceof Map)
    assert.deepStrictEqual(
      [...expressions].map(([offset, expression]) => [offset, expression.node?.type, expression.node?.value]),
      [[source.indexOf(':data-variant'), 'StringLiteral', 'Bad_Name']]
    )
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [flat] as never })
    const messages = (await eslint.lintText(source, { filePath: 'component.webc' }))[0].messages
    assert.deepStrictEqual(
      messages.map((message) => message.message),
      run(source).errors.map(diagnosticMessage)
    )
    assert.deepStrictEqual(
      messages.map((message) => [message.line, message.column, message.endLine, message.endColumn]),
      run(source).errors.map((issue) => [
        issue.position!.line,
        issue.position!.column,
        issue.position!.endLine,
        issue.position!.endColumn
      ])
    )
  })
})
