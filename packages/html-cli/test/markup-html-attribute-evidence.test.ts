import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'

describe('HTML attribute and namespace evidence', () => {
  for (const format of ['html', 'webc'] as const) {
    it(`retains recovered class values without an ownership cascade in ${format}`, async () => {
      const source = '<div class="card-list"id="x"><p class="body"></p></div>'
      const result = await lintBothEntries(source, format)
      assert.strictEqual(result.native.status, 'failed')
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.kind, issue.range]),
        [['SOURCE_RELATION_UNRESOLVED', 'unresolved', [22, 22]]]
      )
      const issue = result.native.errors[0]
      assert.strictEqual(
        issue.reason,
        'HTML recovery may affect local source relations: missing-whitespace-between-attributes.'
      )
      assert.deepStrictEqual(issue.repair, {
        conditions: [
          'Check the original markup at the reported location, then rerun lint. Do not rename classes to match the parser-recovered tree.'
        ],
        effective: {}
      })
      assert.deepStrictEqual(result.host.messages, [])
    })

    it(`reports an invalid recovered class within its original start tag in ${format}`, async () => {
      const source = '<div class="Bad_Name"id="x"><p class="body"></p></div>'
      const result = await lintBothEntries(source, format)
      const issue = result.native.errors.find((issue) => issue.code === 'INVALID_BASE_CLASS')
      assert.ok(issue, JSON.stringify(result.native.errors))
      assert.strictEqual(issue.baseClass, 'Bad_Name')
      assert.deepStrictEqual(issue.range, [5, 10])
      assert.ok(issue.range[0] > 0 && issue.range[1] <= source.indexOf('>'))
      assert.ok(!result.native.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
      assert.deepStrictEqual(
        result.native.errors.filter((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED').map((issue) => issue.range),
        [[21, 21]]
      )
    })

    for (const [name, source, range, allowlist] of [
      [
        'SVG description',
        '<div class="product-card"><svg><desc><span></span></desc></svg></div>',
        [37, 43],
        ['svg', 'desc']
      ],
      [
        'MathML text',
        '<div class="product-card"><math><mtext><span></span></mtext></math></div>',
        [39, 45],
        ['math', 'mtext']
      ],
      [
        'SVG foreign object',
        '<div class="product-card"><svg><foreignObject><span></span></foreignObject></svg></div>',
        [46, 52],
        ['svg', 'foreignobject']
      ],
      [
        'MathML HTML annotation',
        '<div class="product-card"><math><annotation-xml encoding="text/html"><span></span></annotation-xml></math></div>',
        [69, 75],
        ['math', 'annotation-xml']
      ]
    ] as const)
      it(`checks classless HTML children at the ${name} integration point in ${format}`, async () => {
        const result = await lintBothEntries(source, format, {
          htmlLint: { classlessTagCheck: true, classlessTagAllowlist: [...allowlist] }
        })
        assertEntryParity(source, result)
        assert.deepStrictEqual(
          result.native.errors.map((issue) => [issue.code, issue.range]),
          [['CLASSLESS_TAG_NOT_ALLOWED', [...range]]]
        )
      })
  }

  for (const format of ['html', 'webc', 'jsx', 'tsx', 'astro', 'vue'] as const) {
    const jsx = format === 'jsx' || format === 'tsx'
    const offset = jsx ? 15 : format === 'vue' ? 10 : 0
    for (const [name, content, range] of [
      ['keeps mglyph in MathML under mtext', '<math><mtext><mglyph></mglyph></mtext></math>', null],
      ['keeps malignmark in MathML under mtext', '<math><mtext><malignmark></malignmark></mtext></math>', null],
      ['checks classless span as HTML under mtext', '<math><mtext><span></span></mtext></math>', [39, 45]],
      ['checks classless mglyph in ordinary HTML', '<mglyph></mglyph>', [26, 34]]
    ] as const)
      it(`${name} in ${format}`, async () => {
        const markup = `<div ${jsx ? 'className' : 'class'}="product-card">${content}</div>`
        const source = jsx ? `const view=${markup}` : format === 'vue' ? `<template>${markup}</template>` : markup
        const result = await lintBothEntries(source, format, {
          htmlLint: { classlessTagCheck: true, classlessTagAllowlist: ['math', 'mtext'] }
        })
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, range ? 'failed' : 'pass')
        assert.deepStrictEqual(
          result.native.errors.map((issue) => [issue.code, issue.range]),
          range ? [['CLASSLESS_TAG_NOT_ALLOWED', range.map((value) => value + offset)]] : []
        )
      })
  }
})
