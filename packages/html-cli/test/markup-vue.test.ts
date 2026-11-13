import assert from 'assert'
import { before, describe, it } from 'mocha'
import { lintMarkup, loadMarkupParsers, type MarkupParsers } from '../src/markup'

describe('Vue source adapter', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['vue'])
  })
  const run = (source: string) => lintMarkup(source, { format: 'vue', mode: 'root', parsers, config: {} })

  it('handles SFC template and snippet class-list bindings with original token ranges', () => {
    const snippet = '<section class="card-list"><p :class="[\'body\', { \'Bad_Name\': ok }]"/></section>'
    for (const source of [
      snippet,
      '<script setup lang="ts">const label="日本😀";</script>\r\n<template>' +
        snippet +
        '</template><style>.x{color:red}</style>'
    ]) {
      const result = run(source)
      const issue = result.errors.find((item) => item.code === 'UNCLASSIFIED_CLASS_TOKEN')!
      assert.strictEqual(source.slice(...issue.range!), 'Bad_Name', JSON.stringify(result.errors))
      assert.ok(issue.condition?.includes('ok'))
      assert.strictEqual(result.metrics.markupParses, 1)
      assert.strictEqual(
        result.errors.some((item) => item.baseClass === 'template'),
        false
      )
    }
  })

  it('preserves class merge and alternative v-if roots', () => {
    for (const source of [
      '<template><div v-if="ok" class="card-list"/><div v-else class="hero-panel"/></template>',
      '<section class="card-list" :class="{\'u-extra\': ok}"><p :class="\'title\'"/></section>'
    ])
      assert.strictEqual(run(source).status, 'pass', JSON.stringify(run(source).errors))
  })

  it('keeps unresolvable class binding non-pass without pretending classless', () => {
    const result = run('<section :class="props.className"/>')
    assert.strictEqual(result.status, 'failed')
    assert.ok(result.errors.some((item) => item.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    assert.ok(result.errors.every((item) => item.code !== 'CLASSLESS_TAG_NOT_ALLOWED'))
  })

  it('does not trust an imported helper shadowed by a v-for or slot binding', () => {
    const prefix = '<script setup>import clsx from "clsx"</script><template><div class="card-list">'
    for (const scoped of [
      '<p v-for="clsx in items" :class="clsx(\'body\')"/>',
      '<template #default="{clsx}"><p :class="clsx(\'body\')"/></template>'
    ]) {
      assert.ok(
        run(prefix + scoped + '</div></template>').errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED')
      )
    }
    assert.strictEqual(
      run(prefix + '<p v-for="item in items" :class="clsx(\'body\')"/></div></template>').status,
      'pass'
    )
  })
})
