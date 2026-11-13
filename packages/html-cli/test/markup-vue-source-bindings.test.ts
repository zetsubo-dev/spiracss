import assert from 'assert'
import { describe, it } from 'mocha'
import * as vueParser from 'vue-eslint-parser'
import { adaptVueAst } from '../src/markup/adapters/vue'
import { validateMarkup } from '../src/markup/validate'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'

describe('Vue source bindings and original ranges', () => {
  it('keeps ordinary script helpers unavailable to template expressions', async () => {
    const source = '<script>import cx from "clsx"</script><template><div :class="cx(\'card-list\')"/></template>'
    const result = await lintBothEntries(source, 'vue')
    assertEntryParity(source, result)
    assert.deepStrictEqual(result.native.errors.map((issue) => issue.code), ['DYNAMIC_CLASS_UNRESOLVED'])
  })

  it('recognizes default and named helpers from setup scripts in both entries', async () => {
    for (const declaration of [
      'import cx from "clsx"',
      'import {default as cx} from "clsx"',
      'import {clsx as cx} from "clsx"',
      'import cx from "classnames"',
      'import {default as cx} from "classnames"'
    ]) {
      const source = `<script setup>${declaration}</script><template><div :class="cx('card-list')"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass', declaration)
    }
  })

  it('limits helpers to statements inside setup when both script blocks exist', async () => {
    const prefix = '<script>import ordinary from "clsx";export default {};</script>\n' +
      '<script setup>import setupHelper from "classnames";</script>\n'
    for (const [name, status] of [['ordinary', 'failed'], ['setupHelper', 'pass']] as const) {
      const source = prefix + `<template><div :class="${name}('product-card')"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, status)
      assert.deepStrictEqual(result.native.errors.map((issue) => issue.code),
        status === 'failed' ? ['DYNAMIC_CLASS_UNRESOLVED'] : [])
    }
  })

  it('limits ordinary identifier bindings to setup script ranges', async () => {
    for (const setup of [false, true]) {
      const source = `<script${setup ? ' setup' : ''}>const undefined = value</script>` +
        '<template><div class="card-list" :data-variant="undefined"/></template>'
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.deepStrictEqual(result.native.errors.map((issue) => issue.code),
        setup ? ['SOURCE_RELATION_UNRESOLVED'] : [])
    }
  })

  it('does not infer setup helpers or bindings without a supplied document fragment', () => {
    const source = '<script setup>import cx from "clsx"; const undefined = value</script>' +
      '<template><div :class="cx(\'card-list\')" :data-variant="undefined"/></template>'
    const parsed = vueParser.parseForESLint(source, { range: true, ecmaVersion: 'latest', sourceType: 'module' })
    const result = validateMarkup(adaptVueAst(source, parsed.ast, 'root', {}), {}, 'root')
    assert.deepStrictEqual(result.errors.map((issue) => issue.code), ['DYNAMIC_CLASS_UNRESOLVED'])
  })

  it('does not treat type-only imports as runtime class helpers', async () => {
    for (const declaration of ['import type cx from "clsx"', 'import {type clsx as cx} from "clsx"']) {
      const source = `<script setup lang="ts">${declaration}</script><template><div :class="cx('card-list')"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.deepStrictEqual(result.native.errors.map((issue) => issue.code), ['DYNAMIC_CLASS_UNRESOLVED'])
    }
  })

  for (const lang of ['tsx', 'jsx'])
    it(`accepts JSX syntax in a setup script declared as ${lang}`, async () => {
      const source = `<script setup lang="${lang}">const icon = <i/>;</script>\n` +
        '<template><div class="card-list"></div></template>'
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.strictEqual(result.native.metrics.scriptParses, 1)
    })

  it('reports script syntax errors at the original file offset without a relative suffix', async () => {
    const source = '<template><div class="card-list"></div></template>\n' +
      '<script setup lang="ts">\nconst ok = ;\n</script>'
    const { native } = await lintBothEntries(source, 'vue')
    assert.strictEqual(native.status, 'blocked')
    assert.strictEqual(native.errors[0].code, 'PARSE_ERROR')
    assert.deepStrictEqual(native.errors[0].range, [87, 87])
    assert.strictEqual(native.errors[0].position?.line, 3)
    assert.ok(!/\(\d+:\d+\)$/.test(native.errors[0].message))
  })

  it('reuses the SFC parse for a custom documentation block before the template', async () => {
    const source = '<docs>\n# Card\n</docs>\n' +
      '<template><div class="card-list"><p class="title"></p></div></template>\n' +
      '<script setup>const ok = true</script>'
    const result = await lintBothEntries(source, 'vue')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.native.metrics.markupParses, 1)
  })

  for (const [name, source] of [
    ['script', '<docs>…</docs>\n<script>export default {}</script>'],
    ['style', '<i18n>{}</i18n>\n<style>.a{}</style>']
  ]) {
    it(`accepts a custom block before ${name} without a template in both entries`, async () => {
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(result.native.errors, [])
      assert.strictEqual(result.native.metrics.markupParses, 1)
    })

    it(`rejects a custom block before ${name} without a supplied fragment`, () => {
      const parsed = vueParser.parseForESLint(source, { range: true, ecmaVersion: 'latest', sourceType: 'module' })
      assert.throws(() => adaptVueAst(source, parsed.ast, 'root', {}), { code: 'PARSER_UNAVAILABLE' })
    })
  }

  it('rejects a custom-first source with a native top-level element as a supplied SFC', async () => {
    const source = '<docs>x</docs>\n<div class="product-card"></div>\n<script>export default {}</script>'
    const result = await lintBothEntries(source, 'vue')
    assert.deepStrictEqual(result.host.messages.map((message) => message.messageId), ['PARSER_UNAVAILABLE'])
    assert.strictEqual(result.native.status, 'failed')
    assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]),
      [['MULTIPLE_ROOT_ELEMENTS', [15, 41]]])
    assert.strictEqual(result.native.metrics.markupParses, 2)
  })

  it('keeps native-first fragments in HTML mode with a single markup parse', async () => {
    const source = '<div class="product-card"></div><template v-if="flag">' +
      '<div class="other-card"></div></template>'
    const { native } = await lintBothEntries(source, 'vue')
    assert.deepStrictEqual(native.errors.map((issue) => [issue.code, issue.range]),
      [['MULTIPLE_ROOT_ELEMENTS', [54, 78]]])
    assert.strictEqual(native.metrics.markupParses, 1)
  })

  it('checks child classes after a rejected custom-first SFC trial and counts both parses', async () => {
    const source = '<MyCard class="card-list"><p class="Bad_Name"/></MyCard>'
    const { native } = await lintBothEntries(source, 'vue')
    assert.strictEqual(native.status, 'failed')
    assert.deepStrictEqual(native.errors.map((issue) => [issue.code, issue.range]),
      [['INVALID_BASE_CLASS', [36, 44]]])
    assert.strictEqual(native.metrics.markupParses, 2)

    const broken = '<MyCard class="card-list"><p class="Bad_Name"></MyCard>'
    const { native: blocked } = await lintBothEntries(broken, 'vue')
    assert.strictEqual(blocked.status, 'blocked')
    assert.deepStrictEqual(blocked.errors.map((issue) => [issue.code, issue.range]),
      [['PARSE_ERROR', [26, 26]]])
    assert.strictEqual(blocked.metrics.markupParses, 2)
  })

  it('keeps entity-decoded native bindings unresolved over the complete original expression', async () => {
    const source = '<template><div class="card-list"><p :class="{ &quot;title&quot;: ok, Bad_Name: ok }"></p></div></template>'
    const result = await lintBothEntries(source, 'vue')
    assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]),
      [['DYNAMIC_CLASS_UNRESOLVED', [44, 83]]])
    assert.deepStrictEqual(
      result.host.messages.map((message) => [
        message.messageId, message.line, message.column, message.endLine, message.endColumn
      ]),
      [
        ['CLASSLESS_TAG_NOT_ALLOWED', 1, 34, 1, 86],
        ['UNCLASSIFIED_CLASS_TOKEN', 1, 70, 1, 78]
      ]
    )
  })

  it('splits entity-decoded host string values into class tokens with whole-literal ranges', async () => {
    const source = '<template><div class="card-list"><p :class="n &gt; 1 ? &apos;title Bad_Name&apos; : &apos;title&apos;"></p></div></template>'
    const result = await lintBothEntries(source, 'vue')
    const start = source.indexOf('n &gt;')
    const end = source.indexOf('\"></p>')
    assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]),
      [['DYNAMIC_CLASS_UNRESOLVED', [start, end]]])
    assert.deepStrictEqual(result.host.messages.map((message) => message.messageId), ['UNCLASSIFIED_CLASS_TOKEN'])
    const message = result.host.messages[0]
    assert.strictEqual(source.slice(message.column - 1, (message.endColumn ?? 1) - 1), '&apos;title Bad_Name&apos;')
    assert.ok(!message.message.includes('INVALID_BASE_CLASS'))
  })
})
