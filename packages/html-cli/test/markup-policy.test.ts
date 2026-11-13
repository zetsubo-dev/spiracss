import assert from 'assert'
import { before, describe, it } from 'mocha'
import { lintMarkup, loadMarkupParsers, type MarkupConfig, type MarkupFormat, type MarkupParsers } from '../src/markup'

describe('reserved selectorPolicy values across AST expressions', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['jsx', 'vue', 'astro'])
  })
  const run = (source: string, format: MarkupFormat, config: MarkupConfig = {}) =>
    lintMarkup(source, { format, mode: 'root', parsers, config })
  const fixtures = (value: string) =>
    [
      ['jsx', `export default function Card({value,ok}){return <div className="card-list" data-variant={${value}}/>}`],
      ['vue', `<template><div class="card-list" :data-variant="${value.replace(/"/g, "'")}"/></template>`],
      ['astro', `<div class="card-list" data-variant={${value}}></div>`]
    ] as Array<[MarkupFormat, string]>

  it('reports known invalid literal values at their original ranges', () => {
    for (const [format, source] of fixtures('"Bad_Name"')) {
      const issue = run(source, format).errors.find((item) => item.code === 'INVALID_VARIANT_VALUE')!
      assert.ok(issue, format + JSON.stringify(run(source, format).errors))
      assert.strictEqual(source.slice(...issue.range!), 'Bad_Name', format)
      assert.ok(issue.repair?.effective.selectorPolicy)
    }
  })

  it('keeps unknown values unresolved and finite valid alternatives pass', () => {
    for (const [format, source] of fixtures('value')) {
      const result = run(source, format)
      assert.strictEqual(result.status, 'failed', format)
      assert.ok(result.errors.some((item) => item.kind === 'unresolved'))
      assert.ok(result.errors.find((item) => item.kind === 'unresolved')?.repair?.effective.selectorPolicy)
    }
    for (const [format, source] of fixtures('ok ? "small" : "large"'))
      assert.strictEqual(run(source, format).status, 'pass', format + JSON.stringify(run(source, format).errors))
  })

  it('includes the relevant custom policy for an unknown reserved value only', () => {
    const config: MarkupConfig = {
      selectorPolicy: { variant: { dataKeys: ['data-tone'], valueNaming: { case: 'snake', maxWords: 3 } } }
    }
    for (const [format, original] of fixtures('value')) {
      const source = original.replace('data-variant', 'data-tone')
      const issue = run(source, format, config).errors.find((item) => item.kind === 'unresolved')!
      const effective = issue.repair?.effective.selectorPolicy as {
        variant: { dataKeys: string[]; valueNaming: { case: string; maxWords: number } }
      }
      assert.deepStrictEqual(effective.variant.dataKeys, ['data-tone'])
      assert.deepStrictEqual(effective.variant.valueNaming, { case: 'snake', maxWords: 3 })
    }
  })

  it('requires presence evidence under class policy and retains definite forbidden attributes', () => {
    for (const [format, source] of fixtures('value')) {
      const result = run(source, format, { selectorPolicy: { variant: { mode: 'class' } } })
      assert.ok(
        result.errors.some((item) => item.code === 'SOURCE_RELATION_UNRESOLVED'),
        format
      )
      assert.ok(!result.errors.some((item) => item.code === 'DISALLOWED_VARIANT_ATTRIBUTE'), format)
    }
    for (const [format, source] of fixtures('"small"'))
      assert.ok(
        run(source, format, { selectorPolicy: { variant: { mode: 'class' } } }).errors.some(
          (item) => item.code === 'DISALLOWED_VARIANT_ATTRIBUTE'
        ),
        format
      )
  })
})
