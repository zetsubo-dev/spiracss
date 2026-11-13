import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import { createMarkupEslintConfig, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

async function both(source: string) {
  const native = lintMarkup(source, {
    format: 'webc',
    mode: 'root',
    config: {},
    parsers: await loadMarkupParsers(['webc'])
  })
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [createMarkupEslintConfig({}, htmlParser)] as never
  })
  const host = (await eslint.lintText(source, { filePath: 'review.webc' }))[0]
  const sort = (values: unknown[][]) => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  assert.deepStrictEqual(
    sort(host.messages.map((message) => [message.messageId, message.message, message.column, message.endColumn])),
    sort(
      native.errors.map((issue) => [
        issue.code,
        diagnosticMessage(issue),
        issue.position?.column,
        issue.position?.endColumn
      ])
    )
  )
  return native
}

describe('verified WebC composition', () => {
  it('applies @attributes last in both written positions, retaining missing keys', async () => {
    for (const source of [
      '<div class="Bad_Name" @attributes="({class: \'card-list\'})"></div>',
      '<div @attributes="({class: \'card-list\'})" class="Bad_Name"></div>',
      '<div class="card-list" data-variant="Bad_Name" @attributes="({\'data-variant\': \'small\'})"></div>',
      '<div @attributes="({\'data-variant\': \'small\'})" class="card-list" data-variant="Bad_Name"></div>',
      '<div class="card-list" @attributes="({title: \'Example\'})"></div>'
    ])
      assert.strictEqual((await both(source)).status, 'pass')
  })
  it('keeps unknown transfer outside scope but marks ownership-dependent children unresolved', async () => {
    const leaf = await both('<div class="card-list" @attributes></div>')
    assert.strictEqual(leaf.status, 'pass')
    assert.strictEqual(leaf.coverage.outOfScope, 1)
    const children = await both('<div class="card-list" @attributes><p class="body"></p></div>')
    assert.ok(children.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'))
  })
  it('treats only adjacent if/elseif/else roots as exclusive', async () => {
    assert.strictEqual(
      (
        await both(
          '<div webc:if="flag" class="card-list"></div><div webc:elseif="other" class="hero-panel"></div><div webc:else class="site-header"></div>'
        )
      ).status,
      'pass'
    )
    const independent = await both(
      '<div webc:if="flag" class="card-list"></div><div webc:if="other" class="hero-panel"></div>'
    )
    assert.ok(independent.errors.some((issue) => issue.code === 'MULTIPLE_ROOT_ELEMENTS'))
  })
  it('classifies expression syntax failures as blocked at their original position', async () => {
    for (const source of [
      '<div :class="\'card-list\' +"></div>',
      '<div class="card-list" :data-variant="foo("></div>'
    ]) {
      const result = await both(source)
      assert.strictEqual(result.status, 'blocked')
      assert.strictEqual(result.errors[0].code, 'PARSE_ERROR')
      assert.strictEqual(result.errors[0].kind, 'syntax')
      assert.ok(result.errors[0].range![0] > source.indexOf('='))
    }
  })
})
