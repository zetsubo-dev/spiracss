import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { loadMarkupParsers } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'

describe('finite emitted attribute contracts', () => {
  it('distinguishes compiler aliases before native ASCII canonicalization', async () => {
    const rows: Array<[string, boolean]> = [
      ['className="Bad_Name" class="card-list"', true],
      ['className={"Bad_Name"} class="card-list"', false],
      ['{...{className:"Bad_Name"}} class="card-list"', false],
      ['class="card-list" {...{className:"Bad_Name"}}', true],
      ['className={`Bad_Name`} class="card-list"', false],
      ['{...{className:"card-list",class:"Bad_Name",className:"hero-panel"}}', true],
      ['{...{class:"card-list",className:"Bad_Name",class:"hero-panel"}}', true],
      ['CLASS="Bad_Name" class="card-list"', false],
      ['class="card-list" DATA-VARIANT="Bad_Name"', false]
    ]
    for (const [attributes, pass] of rows) {
      const source = `<div ${attributes}/>`
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source)
      if (!pass)
        assert.ok(
          result.native.errors.some((issue) => issue.range && source.slice(...issue.range) === 'Bad_Name'),
          source
        )
    }
    const source = '<section class="card-list"><input TYPE="HIDDEN"/></section>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    const shorthand = '---\nconst className = value\n---\n<div {className} class="card-list"/>'
    const dynamic = await lintBothEntries(shorthand, 'astro')
    assertEntryParity(shorthand, dynamic)
    assert.ok(
      dynamic.native.errors.some(
        (issue) =>
          issue.code === 'DYNAMIC_CLASS_UNRESOLVED' &&
          issue.range &&
          shorthand.slice(...issue.range).includes('className')
      )
    )
  })
  it('advances only non-emitting class branches, not empty/whitespace or ordinary false', async () => {
    const rows: Array<[string, boolean]> = [
      ['class={null}', true],
      ['class={undefined}', true],
      ['class:list={[]}', true],
      ['class:list={false}', true],
      ['class=""', false],
      ['class={""}', false],
      ['class={false}', false],
      ['class:list={" "}', false],
      ['class:list={[" "]}', false]
    ]
    for (const [first, pass] of rows) {
      const source = `<div ${first} {...{class:"card-list"}}/>`
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source)
    }
    const source = '<div class={flag ? null : "hero-panel"} {...{class:"Bad_Name"}}/>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.ok(
      result.native.errors.some(
        (issue) => issue.range && source.slice(...issue.range) === 'Bad_Name' && issue.condition?.includes('flag')
      )
    )
  })
  it('resolves reserved-key emission once for lint and generated selectors', async () => {
    const source = '<div {...{"data-variant":null}} class="card-list" data-variant="Bad_Name"/>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.ok(
      result.native.errors.some(
        (issue) => issue.code === 'INVALID_VARIANT_VALUE' && source.slice(...issue.range!) === 'Bad_Name'
      )
    )
    const parser = (await loadMarkupParsers(['astro'])).astro!
    assert.ok(parser.available)
    const generate = (attributes: string) =>
      generateFromMarkupDocument(parser.parse(`<div ${attributes}/>`, 'root', {}), '/tmp/r4-selectors', true, {
        globalScssModule: '',
        pageEntryPrefix: '',
        childScssDir: 'scss',
        layoutMixins: []
      })
    assert.deepStrictEqual(
      generate('{...{"data-variant":null}} class="card-list" data-variant="compact"'),
      generate('class="card-list" data-variant="compact"')
    )
    for (const first of ['null', 'undefined']) {
      const input = `<div class="card-list" {...{"data-variant":${first}}} data-variant="Bad_Name"/>`
      const both = await lintBothEntries(input, 'astro')
      assertEntryParity(input, both)
      assert.ok(both.native.errors.some((issue) => issue.code === 'INVALID_VARIANT_VALUE'))
    }
    const falseSource = '<div class="card-list" {...{"data-variant":false}} data-variant="Bad_Name"/>'
    const falseResult = await lintBothEntries(falseSource, 'astro')
    assertEntryParity(falseSource, falseResult)
    assert.strictEqual(falseResult.native.status, 'pass')
    assert.deepStrictEqual(
      generate('class="card-list" {...{"data-variant":false}} data-variant="compact"'),
      generate('class="card-list" data-variant="false"')
    )
  })
  it('applies type only to relevant classless branches and preserves host overwrite order', async () => {
    const rows: Array<['jsx' | 'astro' | 'vue', string, boolean]> = [
      ['jsx', 'type={"HIDDEN"}', true],
      ['jsx', 'type="hidden" {...{type:"text"}}', false],
      ['jsx', 'type="text" {...{type:"hidden"}}', true],
      ['astro', 'type={"HIDDEN"}', true],
      ['astro', 'type="hidden" {...{type:"text"}}', true],
      ['astro', 'type="text" {...{type:"hidden"}}', false],
      ['astro', '{...{type:null}} type="HIDDEN"', true],
      ['vue', ':type="\'HIDDEN\'"', true],
      ['vue', 'type="hidden" :type="\'text\'"', true],
      ['vue', 'type="text" :type="\'hidden\'"', false],
      ['vue', 'type="text" v-bind="{type:\'hidden\'}"', true],
      ['vue', 'v-bind="{type:\'text\'}" type="hidden"', true]
    ]
    const wrap = (format: 'jsx' | 'astro' | 'vue', attributes: string, classed = false) => {
      const body = `<section ${format === 'jsx' ? 'className' : 'class'}="card-list"><input ${classed ? `${format === 'jsx' ? 'className' : 'class'}="body" ` : ''}${attributes}/></section>`
      return format === 'vue' ? `<template>${body}</template>` : body
    }
    for (const [format, attributes, pass] of rows) {
      const source = wrap(format, attributes),
        result = await lintBothEntries(source, format)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source + JSON.stringify(result.native.errors))
    }
    for (const format of ['jsx', 'astro', 'vue'] as const) {
      const unknown = format === 'vue' ? ':type="maybe"' : 'type={maybe}'
      for (const [classed, off] of [
        [false, false],
        [true, false],
        [false, true]
      ]) {
        const source = wrap(format, unknown, classed),
          result = await lintBothEntries(source, format, off ? { htmlLint: { classlessTagCheck: false } } : {})
        assertEntryParity(source, result)
        if (classed || off) assert.strictEqual(result.native.status, 'pass', source)
        else {
          assert.ok(!result.native.errors.some((issue) => issue.code === 'CLASSLESS_TAG_NOT_ALLOWED'))
          assert.ok(
            result.native.errors.some(
              (issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED' && source.slice(...issue.range!).includes('maybe')
            )
          )
          const typeIssue = result.native.errors.find((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED')!
          assert.match(typeIssue.reason ?? '', /type|hidden/i)
          assert.ok(
            !/Place exactly|Block uses|Additional classes|add.*class|naming/i.test(JSON.stringify(typeIssue.repair))
          )
        }
      }
      const conditional = format === 'vue' ? ":type=\"flag ? 'hidden' : 'text'\"" : 'type={flag ? "hidden" : "text"}'
      const source = wrap(format, conditional),
        result = await lintBothEntries(source, format)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.errors.filter((issue) => issue.code === 'CLASSLESS_TAG_NOT_ALLOWED').length, 1)
      assert.ok(result.native.errors.some((issue) => issue.condition?.includes('flag')))
    }
  })
  it('retains folded class:list keys before component prop overwrite, in both orders', async () => {
    for (const attributes of [
      'class="card-list" class:list={["u-only"]} {...{class:"hero-panel"}}',
      '{...{class:"hero-panel"}} class:list={["u-only"]} class="card-list"'
    ]) {
      const source = `<Widget ${attributes}/>`,
        result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      const issue = result.native.errors.find((issue) => issue.code === 'MULTIPLE_BASE_CLASSES')!
      assert.ok(issue, source)
      assert.strictEqual(issue.baseClass, 'hero-panel')
      assert.strictEqual(source.slice(...issue.range!), 'card-list')
    }
    for (const attributes of [
      'class="card-list" {...{class:"hero-panel"}}',
      '{...{class:"hero-panel"}} class="card-list"'
    ]) {
      const source = `<Widget ${attributes}/>`,
        result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
    }
  })
})
