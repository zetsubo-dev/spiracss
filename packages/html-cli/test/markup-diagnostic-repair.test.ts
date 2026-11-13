import assert from 'assert'
import { describe, it } from 'mocha'
import { diagnosticMessage } from '../src/eslint'
import { lintMarkup } from '../src/markup'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'

const rootRepair = {
  conditions: [
    'Root mode checks one component root, but this source has more than one root element that can render together. Either give the source one intended root, or check a source that intentionally holds several components in selection mode. The classes on these roots are not the cause: do not rename or remove valid classes to resolve this.'
  ],
  effective: { mode: 'root' },
  missingInformation: [
    'Decide which element is the intended root, or whether this source should be checked in selection mode.'
  ]
}
const duplicateRepair = {
  conditions: [
    'This start tag repeats class or an attribute configured in selectorPolicy, so the value that takes effect is not established. Confirm the intended attribute in the original markup at the reported location, then rerun lint. Do not pick one occurrence or rename valid classes based on this diagnostic alone.'
  ],
  effective: {}
}

describe('Shared actionable markup diagnostics', () => {
  it('explains the Astro root decision without blaming valid root classes', async () => {
    const source = '<><div class="card-list"/><!-- note --><div class="item-list"/></>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'failed')
    assert.deepStrictEqual(
      result.native.errors.map((issue) => [issue.code, issue.kind, issue.range, issue.message]),
      [['MULTIPLE_ROOT_ELEMENTS', 'violation', [39, 63], 'Root mode expects a single source root.']]
    )
    const issue = result.native.errors[0]
    assert.deepStrictEqual(issue.repair, rootRepair)
    assert.strictEqual(issue.docs, 'https://spiracss.jp/tooling/html-cli/')
    assert.strictEqual(result.host.messages[0].message, diagnosticMessage(issue))
  })

  it('gives JSX roots the same source-level repair decision', async () => {
    const source = 'function A(){return <><div className="card-list"/><div className="hero-panel"/></>}'
    const result = await lintBothEntries(source, 'jsx')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'failed')
    assert.deepStrictEqual(result.native.errors.map((issue) => issue.code), ['MULTIPLE_ROOT_ELEMENTS'])
    const issue = result.native.errors[0]
    assert.deepStrictEqual(issue.repair, rootRepair)
    assert.strictEqual(result.host.messages[0].message, diagnosticMessage(issue))
  })

  for (const format of ['html', 'webc'] as const)
    it(`requests the intended duplicate attribute instead of choosing a value in ${format}`, async () => {
      const source = '<div class="card-list" class="body"></div>'
      const result = await lintBothEntries(source, format)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed')
      assert.strictEqual(result.native.coverage.elements, 1)
      assert.strictEqual(result.native.coverage.unresolved, 1)
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.kind, issue.range, issue.reason]),
        [[
          'SOURCE_RELATION_UNRESOLVED',
          'unresolved',
          [28, 28],
          'HTML recovery may affect local source relations: duplicate-attribute.'
        ]]
      )
      const issue = result.native.errors[0]
      assert.deepStrictEqual(issue.repair, duplicateRepair)
      assert.strictEqual(result.host.messages[0].message, diagnosticMessage(issue))
    })

  it('reports only the proven start when a syntax parser supplies pos alone', () => {
    const result = lintMarkup('<div/>', {
      format: 'html',
      mode: 'root',
      config: {},
      parsers: {
        html: {
          available: true,
          parse: () => {
            throw Object.assign(new SyntaxError('source failure'), { pos: 5 })
          }
        }
      }
    })
    assert.strictEqual(result.status, 'blocked')
    assert.deepStrictEqual(result.errors.map((issue) => [issue.code, issue.range]), [['PARSE_ERROR', [5, 5]]])
    assert.strictEqual(result.errors[0].position?.endOffset, 5)
  })

  it('leaves syntax locations absent when the parser supplies no location', () => {
    const result = lintMarkup('<div/>', {
      format: 'html',
      mode: 'root',
      config: {},
      parsers: {
        html: {
          available: true,
          parse: () => {
            throw new SyntaxError('source failure')
          }
        }
      }
    })
    assert.strictEqual(result.status, 'blocked')
    assert.deepStrictEqual(result.errors.map((issue) => issue.code), ['PARSE_ERROR'])
    const json = JSON.parse(JSON.stringify(result.errors[0]))
    assert.ok(!('range' in json) && !('position' in json))
  })

  it('preserves the actual Vue duplicate-binding parser point across native and ESLint', async () => {
    const source =
      `<template><div class="card-list" :class="{'u-flag0':flag0,'u-flag1':flag1,'u-flag2':flag2,` +
      `'u-flag3':flag3,'u-flag4':flag4,'u-flag5':flag5,'u-flag6':flag6,'u-flag7':flag7,` +
      `'u-flag8':flag8}" v-bind="{}" v-bind="open"/></template>`
    const result = await lintBothEntries(source, 'vue')
    assert.strictEqual(source.length, 226)
    assert.strictEqual(result.native.status, 'blocked')
    assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]), [['PARSE_ERROR', [200, 200]]])
    assertEntryParity(source, result)
  })
})
