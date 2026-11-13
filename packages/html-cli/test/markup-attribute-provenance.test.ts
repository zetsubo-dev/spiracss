import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { loadMarkupParsers, type MarkupConfig, type MarkupFormat } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'

const classMode: MarkupConfig = { selectorPolicy: { variant: { mode: 'class' }, state: { mode: 'class' } } }
async function generated(source: string, format: MarkupFormat, config: MarkupConfig = {}) {
  const parser = (await loadMarkupParsers([format]))[format]!
  assert.ok(parser.available)
  return generateFromMarkupDocument(parser.parse(source, 'root', config), '/tmp/r5-generation', true, {
    globalScssModule: '',
    pageEntryPrefix: '',
    childScssDir: 'scss',
    layoutMixins: [],
    ...config
  } as Parameters<typeof generateFromMarkupDocument>[3])
}

describe('effective existing-key facts', () => {
  it('keeps actual winning attribute and value ranges on each reachable branch', async () => {
    for (const [key, code] of [
      ['data-variant', 'DISALLOWED_VARIANT_ATTRIBUTE'],
      ['data-state', 'DISALLOWED_STATE_ATTRIBUTE']
    ]) {
      for (const absent of ['null', 'undefined']) {
        const source = `<div {...{"${key}":${absent}}} class="card-list" ${key}="compact"/>`,
          result = await lintBothEntries(source, 'astro', classMode)
        assertEntryParity(source, result)
        const issue = result.native.errors.find((issue) => issue.code === code)!
        assert.ok(issue)
        assert.strictEqual(source.slice(...issue.range!), `${key}="compact"`)
      }
      const source = `<div class="card-list" {...{"${key}":flag ? "wide" : null}} ${key}="compact"/>`,
        result = await lintBothEntries(source, 'astro', classMode)
      assertEntryParity(source, result)
      const issues = result.native.errors.filter((issue) => issue.code === code)
      assert.strictEqual(issues.length, 2)
      assert.ok(
        issues.some((issue) => source.slice(...issue.range!) === `${key}="compact"` && issue.condition?.includes('!'))
      )
      assert.ok(
        issues.some(
          (issue) => source.slice(...issue.range!).includes('flag ? "wide"') && !issue.condition?.startsWith('!')
        )
      )
    }
    const source = '<div {...{"data-variant":null}} class="card-list" data-variant="Bad_Name"/>',
      result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(
      source.slice(...result.native.errors.find((issue) => issue.code === 'INVALID_VARIANT_VALUE')!.range!),
      'Bad_Name'
    )
  })
  it('folds only supported object keys by first insertion and last value for tokens and emission', async () => {
    for (const [object, pass] of [
      ['{"card-list":true,"card-list":false}', false],
      ['{"card-list":false,"card-list":true}', true],
      ['{"card-list":false,"u-only":true,"card-list":true}', true]
    ] as const) {
      const source = `<div class:list={${object}} {...{class:"Bad_Name"}}/>`,
        result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source)
      if (!pass)
        assert.ok(result.native.errors.some((issue) => issue.range && source.slice(...issue.range) === 'Bad_Name'))
    }
    assert.deepStrictEqual(
      await generated('<div class:list={{"card-list":false,"u-only":true,"card-list":true}}/>', 'astro'),
      await generated('<div class:list={{"card-list":true,"u-only":true}}/>', 'astro')
    )
    for (const object of ['{["card-list"]:true}', '{...props,"card-list":true}']) {
      const source = `<div class:list={${object}}/>`,
        result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.ok(result.native.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    }
  })
  it('leaves only relevant input type uncertain across unknown spreads and honors later explicit values', async () => {
    for (const attributes of [
      'type="hidden" {...props} className={null}',
      '{...props} className={null}',
      'type="hidden" {...one} {...two} className={null}'
    ]) {
      const source = `<section className="card-list"><input ${attributes}/></section>`,
        result = await lintBothEntries(source, 'tsx')
      assertEntryParity(source, result)
      assert.notStrictEqual(result.native.status, 'pass', source)
      assert.ok(!result.native.errors.some((issue) => issue.code === 'CLASSLESS_TAG_NOT_ALLOWED'))
      const type = result.native.errors.find((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED')!
      assert.ok(type && type.range && source.slice(...type.range).includes('...'))
      assert.ok(!/Place exactly|Block uses|Additional classes|add.*class/i.test(JSON.stringify(type.repair)))
      const off = await lintBothEntries(source, 'tsx', { htmlLint: { classlessTagCheck: false } })
      assert.strictEqual(off.native.status, 'pass')
    }
    for (const [attributes, pass] of [
      ['type="hidden" {...props} className={null} type="hidden"', true],
      ['type="hidden" {...props} className={null} type="text"', false],
      ['type="hidden" {...props} className="body"', true]
    ] as const) {
      const source = `<section className="card-list"><input ${attributes}/></section>`,
        result = await lintBothEntries(source, 'tsx')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source)
      assert.ok(!result.native.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'))
    }
  })
  it('distinguishes unknown presence from certain prohibition without inventing a winner', async () => {
    for (const [key, code] of [
      ['data-variant', 'DISALLOWED_VARIANT_ATTRIBUTE'],
      ['data-state', 'DISALLOWED_STATE_ATTRIBUTE'],
      ['aria-expanded', 'DISALLOWED_STATE_ATTRIBUTE']
    ]) {
      const unknown = `<div class="card-list" {...{"${key}":maybe}}/>`,
        result = await lintBothEntries(unknown, 'astro', classMode)
      assertEntryParity(unknown, result)
      assert.ok(result.native.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'))
      assert.ok(!result.native.errors.some((issue) => issue.code === code))
      for (const value of ['null', 'undefined', '""', '"compact"']) {
        const source = `<div class="card-list" {...{"${key}":${value}}}/>`,
          both = await lintBothEntries(source, 'astro', classMode)
        assertEntryParity(source, both)
        assert.strictEqual(
          both.native.errors.some((issue) => issue.code === code),
          value.startsWith('"'),
          source
        )
      }
      const source = `<div class="card-list" {...{"${key}":maybe}} ${key}="compact"/>`,
        both = await lintBothEntries(source, 'astro', classMode)
      assert.ok(
        both.native.errors.some((issue) => issue.code === code),
        JSON.stringify(both.native.errors)
      )
      const forbidden = both.native.errors.find((issue) => issue.code === code)!
      assert.strictEqual(forbidden.range, undefined, 'Neither candidate can be called the actual winner.')
      assert.deepStrictEqual(
        both.host.messages.map((issue) => issue.messageId).sort(),
        both.native.errors.map((issue) => issue.code).sort()
      )
    }
  })
  it('separates valid ARIA lint from incomplete enumeration without inventing provenance', async () => {
    const source = '<div class="card-list" {...{"aria-expanded":maybe}} aria-expanded="true"/>',
      result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 1)
    assert.ok(!result.native.errors.some((issue) => /INVALID_.*_VALUE/.test(issue.code)))
    assert.deepStrictEqual(await generated(source, 'astro'), await generated(source.replace('maybe', 'null'), 'astro'))
    assert.deepStrictEqual(
      await generated(source.replace('maybe', 'null'), 'astro'),
      await generated('<div class="card-list" aria-expanded="true"/>', 'astro')
    )
    for (const input of ['<div class="card-list" data-note={maybe}/>', '<div class="u-only" data-variant={maybe}/>']) {
      const both = await lintBothEntries(input, 'astro', classMode)
      assertEntryParity(input, both)
      assert.ok(!both.native.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'))
    }
  })
  it('shares type winner order with configured scalar selector keys and generates winners only', async () => {
    for (const [attributes, pass] of [
      ['data-variant="Bad_Name" :data-variant="\'compact\'"', false],
      [':data-variant="\'compact\'" data-variant="Bad_Name"', true],
      ['data-variant="compact" v-bind="{\'data-variant\':\'Bad_Name\'}"', false],
      ['v-bind="{\'data-variant\':\'Bad_Name\'}" data-variant="compact"', true]
    ] as const) {
      const source = `<template><div class="card-list" ${attributes}/></template>`,
        result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass, source)
    }
    for (const [attributes, winner] of [
      ['data-variant="wide" :data-variant="\'compact\'"', 'wide'],
      [':data-variant="\'compact\'" data-variant="wide"', 'compact'],
      ['data-variant="wide" v-bind="{\'data-variant\':\'compact\'}"', 'compact'],
      ['v-bind="{\'data-variant\':\'compact\'}" data-variant="wide"', 'wide']
    ]) {
      const source = `<template><div class="card-list" ${attributes}/></template>`,
        result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(
        await generated(source, 'vue'),
        await generated(`<template><div class="card-list" data-variant="${winner}"/></template>`, 'vue'),
        source
      )
    }
  })
  it('treats the falsy short-circuit list branch as no contribution, keeping true-branch violations', async () => {
    const source = '<div class:list={[x && "card-list"]} {...{class:"card-list"}}/>',
      result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    const control = source.replace('x && "card-list"', 'x ? "card-list" : false')
    assert.deepStrictEqual(await generated(source, 'astro'), await generated(control, 'astro'))
    const bad = source.replace('x && "card-list"', 'x && "u-a"'),
      invalid = await lintBothEntries(bad, 'astro')
    assertEntryParity(bad, invalid)
    assert.ok(invalid.native.errors.some((issue) => issue.condition && !issue.condition.startsWith('!')))
    assert.ok(
      !invalid.native.errors.some(
        (issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED' && issue.condition?.startsWith('!')
      )
    )
  })
  it('recognizes only original exact class:list before native HTML name canonicalization', async () => {
    for (const attributes of [
      'CLASS:LIST={["u-only"]} class="card-list"',
      '{...{"CLASS:LIST":["u-only"]}} class="card-list"'
    ]) {
      const source = `<div ${attributes}/>`,
        result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass', source)
      assert.deepStrictEqual(await generated(source, 'astro'), await generated('<div class="card-list"/>', 'astro'))
    }
    const source = '<div class:list={["u-only"]} {...{class:"card-list"}}/>',
      result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.notStrictEqual(result.native.status, 'pass')
  })
})
