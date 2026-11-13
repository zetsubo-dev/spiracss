import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import { createMarkupEslintConfig, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

describe('source HTML recovery contract', () => {
  const native = async (source: string) =>
    lintMarkup(source, { format: 'html', mode: 'root', config: {}, parsers: await loadMarkupParsers(['html']) })
  it('preserves raw text, the nearest table boundary and hidden input exception in both hosts', async () => {
    const outer =
      '<div class="root-block"><table class="outer-table"><tr class="row"><td class="cell"><table class="inner">'
    const end = '</table></td></tr></table></div>'
    const fixtures: Array<[string, boolean]> = [
      ...['textarea', 'iframe'].flatMap(
        (tag) =>
          [
            [`<div class="card-list"><${tag} class="body"><div class="Bad_Name"></div></${tag}></div>`, false],
            [
              `<div class="card-list"><${tag} class="body"><div>x</div></${tag}><p class="body Bad_Name"></p></div>`,
              false
            ]
          ] as Array<[string, boolean]>
      ),
      [outer + '<div class="body"></div>' + end, true],
      [outer + '<tr class="row"><td class="cell"><div class="body"></div></td></tr>' + end, false],
      ['<table class="data-table"><input type="hidden" class="field"></table>', false],
      ['<table class="data-table"><input type="text" class="field"></table>', true]
    ]
    for (const [source, recovery] of fixtures) {
      const result = await native(source)
      const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: [createMarkupEslintConfig({}, htmlParser)] as never
      })
      const messages = (await eslint.lintText(source, { filePath: 'r2.html' }))[0].messages
      assert.deepStrictEqual(
        messages.map((message) => message.messageId).sort(),
        result.errors.map((issue) => issue.code).sort(),
        source
      )
      assert.strictEqual(
        result.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'),
        recovery,
        source
      )
      if (source.includes('<p class="body Bad_Name">'))
        assert.ok(result.errors.some((issue) => issue.code === 'UNCLASSIFIED_CLASS_TOKEN'))
      else if (!recovery) assert.strictEqual(result.status, 'pass', JSON.stringify(result.errors))
    }
  })
  it('observes select loss, table moves and non-void self-closing in the same parse', async () => {
    for (const [source, reason] of [
      [
        '<div class="card-list"><select class="body"><div class="Bad_Name"></div></select></div>',
        'HTML source relation is unresolved: select-dropped-start-tag.'
      ],
      [
        '<div class="root-block"><table class="table"><div class="card-list"></div></table></div>',
        'HTML source relation is unresolved: table-foster-parenting.'
      ],
      [
        '<table class="data-table"><div class="card-list"></div></table>',
        'HTML source relation is unresolved: table-foster-parenting.'
      ],
      [
        '<div class="root-block"><span class="body"/><p class="title"></p></div>',
        'HTML source relation is unresolved: non-void-self-closing.'
      ]
    ]) {
      const result = await native(source)
      assert.strictEqual(result.status, 'failed', source)
      assert.strictEqual(result.metrics.markupParses, 1)
      const issues = result.errors.filter((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED' && issue.reason === reason)
      assert.ok(issues.length > 0, source)
      for (const issue of issues)
        assert.deepStrictEqual(issue.repair, {
          conditions: [
            'Check the intended parent-child relationship at the reported start tag in the original markup, then rerun lint. Do not rename classes to match the parser-recovered tree.'
          ],
          effective: {}
        })
      const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: [createMarkupEslintConfig({}, htmlParser)] as never
      })
      const messages = (await eslint.lintText(source, { filePath: 'review.html' }))[0].messages
      const sort = (values: unknown[][]) => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      assert.deepStrictEqual(
        sort(messages.map((message) => [message.messageId, message.message, message.column, message.endColumn])),
        sort(
          result.errors.map((issue) => [
            issue.code,
            diagnosticMessage(issue),
            issue.position?.column,
            issue.position?.endColumn
          ])
        )
      )
      assert.ok(
        result.errors.every((issue) => issue.kind === 'unresolved'),
        JSON.stringify(result.errors)
      )
    }
  })

  it('keeps supported omission, raw text and unrelated text errors successful', async () => {
    for (const source of [
      '<table class="data-table"><tr class="row"><td class="cell"><div class="body"></div></td></tr></table>',
      '<div class="card-list"><textarea class="body"><div class="Bad_Name"></div></textarea></div>',
      '<div class="card-list">&copy 2026</div>',
      '<div class="card-list">a < b</div>'
    ])
      assert.strictEqual((await native(source)).status, 'pass', JSON.stringify((await native(source)).errors))
  })
})
