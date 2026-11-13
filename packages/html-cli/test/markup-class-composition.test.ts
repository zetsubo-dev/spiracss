import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { loadMarkupParsers } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'

const keys = (count: number, bad = false) =>
  Array.from({ length: count }, (_, i) => `'${bad && i === count - 1 ? 'Bad_Name' : 'u-flag' + i}':flag${i}`).join(',')
describe('representative class composition table', () => {
  it('shares only a proven effective prefix, retaining format order and source evidence', async () => {
    for (const count of [9, 16, 32])
      for (const format of ['vue', 'astro'] as const) {
        const dynamic = format === 'vue' ? `:class="{${keys(count)}}"` : `class:list={{${keys(count)}}}`
        const wrap = (attrs: string) => (format === 'vue' ? `<template><div ${attrs}/></template>` : `<div ${attrs}/>`)
        for (const attrs of [`class="card-list" ${dynamic}`, `${dynamic} class="card-list"`]) {
          const source = wrap(attrs),
            result = await lintBothEntries(source, format)
          assertEntryParity(source, result)
          const guaranteed = format === 'astro' || attrs.startsWith('class=')
          assert.strictEqual(result.native.status === 'pass', guaranteed, source)
          if (guaranteed) {
            assert.strictEqual(result.native.metrics.inertOptionalTokens, count)
            assert.ok(result.native.metrics.classExpressionProducts <= 3)
            const single = wrap(
              format === 'vue'
                ? `:class="['card-list',{${keys(count)}}]"`
                : `class:list={['card-list',{${keys(count)}}]}`
            )
            const parsers = await loadMarkupParsers([format]),
              parser = parsers[format]!
            assert.ok(parser.available)
            const generate = (input: string) =>
              generateFromMarkupDocument(parser.parse(input, 'root', {}), '/tmp/r3-compose', true, {
                globalScssModule: '',
                pageEntryPrefix: '',
                childScssDir: 'scss',
                layoutMixins: []
              })
            assert.deepStrictEqual(generate(source), generate(single))
          }
        }
        const bad = wrap(
          `class="card-list" ${format === 'vue' ? `:class="{${keys(count, true)}}"` : `class:list={{${keys(count, true)}}}`}`
        )
        const invalid = await lintBothEntries(bad, format)
        assertEntryParity(bad, invalid)
        assert.ok(
          invalid.native.errors.some(
            (issue) => issue.code === 'UNCLASSIFIED_CLASS_TOKEN' && issue.condition?.includes('flag' + (count - 1))
          )
        )
      }
  })
  it('distinguishes native spread class emissions from direct pairs and component props', async () => {
    const rows: Array<[string, boolean]> = [
      ['<div class:list={["u-only"]} {...{class:"card-list"}}/>', false],
      ['<div {...{class:"card-list"}} class:list={["u-only"]}/>', true],
      ['<div class="card-list" class:list={["u-only"]} {...{class:"hero-panel"}}/>', true],
      ['<div {...{class:"hero-panel"}} class:list={["u-only"]} class="card-list"/>', true],
      ['<Widget class:list={["u-only"]} {...{class:"card-list"}}/>', true],
      ['<Widget {...{class:"card-list"}} class:list={["u-only"]}/>', true],
      ['<Widget class="card-list" class:list={["u-only"]} {...{class:"hero-panel"}}/>', false]
    ]
    for (const [source, pass] of rows) {
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source + JSON.stringify(result.native.errors))
    }
    for (const source of [
      `<div {...props} class="card-list" class:list={{${keys(9)}}}/>`,
      `<template><div v-bind="props" class="card-list" :class="{${keys(9)}}"/></template>`
    ]) {
      const format = source.startsWith('<template>') ? 'vue' : 'astro'
      const result = await lintBothEntries(source, format)
      assertEntryParity(source, result)
      assert.notStrictEqual(result.native.status, 'pass')
      assert.strictEqual(result.native.metrics.inertOptionalTokens, 0)
    }
  })
})
