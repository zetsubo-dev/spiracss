import assert from 'assert'
import { before, describe, it } from 'mocha'
import { lintHtmlStructure } from '../src/generator-core'
import { lintMarkup, loadMarkupParsers, type MarkupConfig, type MarkupParsers } from '../src/markup'

describe('per-occurrence source lint and repair loop', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['html', 'webc'])
  })
  const run = (source: string, config: MarkupConfig = {}) =>
    lintMarkup(source, { format: 'html', mode: 'root', config, parsers })

  it('keeps both repeated siblings and reports the later original token', () => {
    const source =
      '<section class="card-list">\n<p class="title Bad_Name"></p>\n<p class="title Other_Bad"></p></section>'
    const result = run(source)
    const errors = result.errors.filter((issue) => issue.code === 'UNCLASSIFIED_CLASS_TOKEN')
    assert.strictEqual(errors.length, 2)
    assert.deepStrictEqual(
      errors.map((issue) => source.slice(...issue.range!)),
      ['Bad_Name', 'Other_Bad']
    )
    assert.deepStrictEqual(
      errors.map((issue) => issue.position?.line),
      [2, 3]
    )
    assert.strictEqual(result.metrics.markupParses, 1)
    assert.strictEqual(result.metrics.expressionParses, 0)
  })

  it('does not aggregate repeated legacy lint siblings', () => {
    const errors = lintHtmlStructure(
      '<section class="card-list"><p class="title other"></p><p class="title other"></p></section>',
      true,
      {}
    )
    assert.strictEqual(errors.filter((issue) => issue.code === 'MULTIPLE_BASE_CLASSES').length, 2)
  })

  it('keeps source sibling paths consistent with original ranges', () => {
    const result = run(
      '<div class="root-block"><section class="card-block"><p>A</p></section><section class="card-block"><p>B</p></section></div>'
    )
    assert.deepStrictEqual(
      result.errors.map((issue) => issue.targetPath?.map((part) => part.siblingIndex)),
      [
        [1, 1, 1],
        [1, 2, 1]
      ]
    )
  })

  it('guards excessive HTML depth during adaptation, not by catching RangeError', () => {
    const source = '<div class="root-block">' + '<div class="item">'.repeat(2000) + '</div>'.repeat(2001)
    const result = run(source)
    assert.strictEqual(result.status, 'blocked')
    assert.ok(result.errors.some((issue) => issue.code === 'MAX_DEPTH_EXCEEDED'))
    assert.ok(result.errors.every((issue) => issue.code !== 'PARSE_ERROR'))
  })

  it('preserves native control and namespace classless exceptions', () => {
    for (const content of [
      '<picture><source><img></picture><br><wbr>',
      '<select class="field"><option>Label</option></select>',
      '<svg><path d="M0 0"/></svg>',
      '<math><mi>x</mi></math>',
      '<input type="hidden">'
    ]) {
      const source = `<div class="card-list">${content}</div>`
      const oldCodes = lintHtmlStructure(source, true, {}).map((issue) => issue.code)
      assert.deepStrictEqual(
        run(source).errors.map((issue) => issue.code),
        oldCodes,
        source
      )
    }
  })

  it('accepts implicit and explicit tbody without invented classes', () => {
    const body = '<tr class="row"><td class="cell"></td></tr>'
    const implicit = run(`<table class="data-table">${body}</table>`)
    const explicit = run(`<table class="data-table"><tbody>${body}</tbody></table>`)
    assert.strictEqual(implicit.status, 'pass', JSON.stringify(implicit.errors))
    assert.strictEqual(explicit.status, 'pass', JSON.stringify(explicit.errors))
  })

  it('keeps document shell outside invented class requirements', () => {
    assert.strictEqual(
      run('<!doctype html><html><head><title>Title</title></head><body><main class="page-main"></main></body></html>')
        .status,
      'pass'
    )
  })

  it('supports diagnostic-only default/custom/policy minimal repair loops', () => {
    const cases: Array<{ source: string; repaired: string; config: MarkupConfig; expected: string }> = [
      {
        source: '<div class="card-list Bad_Name"></div>',
        repaired: '<div class="card-list u-extra"></div>',
        config: {},
        expected: 'UNCLASSIFIED_CLASS_TOKEN'
      },
      {
        source: '<div class="CardList"></div>',
        repaired: '<div class="C_Card"></div>',
        config: { naming: { customPatterns: { block: /^C_[A-Z][a-z]+$/ } } },
        expected: 'INVALID_BASE_CLASS'
      },
      {
        source: '<div class="card-list" data-variant="Bad_Value"></div>',
        repaired: '<div class="card-list" data-variant="good_value"></div>',
        config: { selectorPolicy: { variant: { valueNaming: { case: 'snake', maxWords: 2 } } } },
        expected: 'INVALID_VARIANT_VALUE'
      }
    ]
    for (const fixture of cases) {
      const result = run(fixture.source, fixture.config)
      const issue = result.errors.find((entry) => entry.code === fixture.expected)!
      assert.ok(issue?.reason && issue.range && issue.repair?.conditions.length && issue.docs)
      assert.ok(issue.repair.effective)
      assert.strictEqual(run(fixture.repaired, fixture.config).status, 'pass')
      if (fixture.expected === 'UNCLASSIFIED_CLASS_TOKEN') assert.ok(issue.repair.missingInformation?.length)
    }
  })

  it('never treats a missing parser as a successful HTML fallback', () => {
    const result = lintMarkup('<div class="card-list"></div>', { format: 'astro', mode: 'root', parsers, config: {} })
    assert.strictEqual(result.status, 'blocked')
    assert.strictEqual(result.errors[0].code, 'PARSER_UNAVAILABLE')
  })
})
