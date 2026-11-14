import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import { createMarkupEslintConfig, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers, type MarkupConfig } from '../src/markup'

async function both(source: string, config: MarkupConfig = {}) {
  const native = lintMarkup(source, {
    format: 'webc',
    mode: 'root',
    config,
    parsers: await loadMarkupParsers(['webc'])
  })
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [createMarkupEslintConfig(config, htmlParser)] as never
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

describe('WebC input type evidence', () => {
  const wrap = (input: string) => `<div class="card-list">${input}</div>`
  const cases: {
    name: string
    input: string
    config?: MarkupConfig
    codes: string[]
    expectedRangeText?: string
    expectedExpressionParses?: number
  }[] = [
    { name: 'dynamic hidden', input: '<input :type="\'hidden\'">', codes: [] },
    { name: 'spread hidden', input: '<input @attributes="({type: \'hidden\'})">', codes: [] },
    {
      name: 'dynamic unknown',
      input: '<input :type="kind">',
      codes: ['SOURCE_RELATION_UNRESOLVED'],
      expectedRangeText: 'kind'
    },
    {
      name: 'spread text overriding hidden',
      input: '<input type="hidden" @attributes="({type: \'text\'})">',
      codes: ['CLASSLESS_TAG_NOT_ALLOWED']
    },
    {
      name: 'conditional text branch',
      input: "<input :type=\"flag ? 'hidden' : 'text'\">",
      codes: ['CLASSLESS_TAG_NOT_ALLOWED']
    },
    { name: 'classed unknown', input: '<input class="body" :type="kind">', codes: [] },
    {
      name: 'disabled classless check',
      input: '<input :type="kind">',
      config: { htmlLint: { classlessTagCheck: false } },
      codes: []
    },
    { name: 'static hidden', input: '<input type="hidden">', codes: [] },
    { name: 'static text', input: '<input type="text">', codes: ['CLASSLESS_TAG_NOT_ALLOWED'] },
    {
      name: 'later static text',
      input: '<input :type="\'hidden\'" type="text">',
      codes: ['CLASSLESS_TAG_NOT_ALLOWED']
    },
    { name: 'later dynamic hidden', input: '<input type="text" :type="\'hidden\'">', codes: [] },
    { name: 'uppercase hidden', input: '<input :type="\'HIDDEN\'">', codes: [] },
    {
      name: 'malformed relevant type',
      input: '<input :type="foo(">',
      codes: ['SOURCE_RELATION_UNRESOLVED'],
      expectedRangeText: 'foo('
    },
    {
      name: 'dynamic class makes malformed type irrelevant',
      input: '<input :class="\'body\'" :type="foo(">',
      codes: [],
      expectedExpressionParses: 2
    }
  ]
  for (const { name, input, config, codes, expectedRangeText, expectedExpressionParses } of cases) {
    it(`uses validator-owned type decisions for ${name}`, async () => {
      const result = await both(wrap(input), config)
      assert.deepStrictEqual(
        result.errors.map((issue) => issue.code),
        codes
      )
      assert.strictEqual(result.status, codes.length ? 'failed' : 'pass')
      if (expectedRangeText !== undefined)
        assert.strictEqual(wrap(input).slice(...result.errors[0].range!), expectedRangeText)
      if (expectedExpressionParses !== undefined)
        assert.strictEqual(result.metrics.expressionParses, expectedExpressionParses)
    })
  }

  const controls: { name: string; input: string; config?: MarkupConfig }[] = [
    { name: 'non-input', input: '<button class="body" :type="foo("></button>' },
    { name: 'classed input', input: '<input class="body" :type="foo(">' },
    { name: 'disabled input check', input: '<input :type="foo(">', config: { htmlLint: { classlessTagCheck: false } } },
    {
      name: 'allowlisted input',
      input: '<input :type="foo(">',
      config: { htmlLint: { classlessTagAllowlist: ['input'] } }
    }
  ]
  for (const { name, input, config = {} } of controls) {
    it(`does not parse an irrelevant type for ${name}`, async () => {
      const source = wrap(input)
      const result = await both(source, config)
      assert.strictEqual(result.status, 'pass')
      assert.deepStrictEqual(result.errors, [])
      assert.strictEqual(result.metrics.expressionParses, 0)
      const flat = createMarkupEslintConfig(config, htmlParser)
      const expressions = flat.languageOptions.parser.parseForESLint(source, { filePath: 'review.webc' }).services
        ?.spiracssWebcExpressions
      assert.ok(expressions instanceof Map)
      assert.strictEqual(expressions.size, 0)
    })
  }

  it('does not establish hidden type when the host wrapper is bypassed', async () => {
    const flat = createMarkupEslintConfig({}, htmlParser)
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [{ ...flat, languageOptions: { parser: htmlParser } }] as never
    })
    const host = (await eslint.lintText(wrap('<input :type="\'hidden\'">'), { filePath: 'review.webc' }))[0]
    assert.deepStrictEqual(
      host.messages.map((message) => message.messageId),
      ['SOURCE_RELATION_UNRESOLVED']
    )
  })
})
