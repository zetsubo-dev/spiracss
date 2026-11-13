import assert from 'assert'
import { describe, it } from 'mocha'
import * as vueParser from 'vue-eslint-parser'
import { lintMarkup, type MarkupConfig } from '../src/markup'
import { adaptVueAst } from '../src/markup/adapters/vue'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'

const suppliedVue = (source: string, config: MarkupConfig = {}) => {
  const parsed = vueParser.parseForESLint(source, { range: true, loc: true })
  return lintMarkup(source, {
    format: 'vue',
    mode: 'root',
    config,
    parsers: {
      vue: {
        available: true,
        parse: () => adaptVueAst(source, parsed.ast, 'root', config, parsed.services.getDocumentFragment())
      }
    }
  })
}

const checkVue = async (source: string, config: MarkupConfig = {}) => {
  const result = await lintBothEntries(source, 'vue', config)
  const direct = suppliedVue(source, config)
  assertEntryParity(source, result)
  assert.strictEqual(direct.status, result.native.status)
  assert.deepStrictEqual(direct.errors, result.native.errors)
  assert.deepStrictEqual(direct.coverage, result.native.coverage)
  return result
}

describe('Vue source-site forwarding coverage', () => {
  for (const [binding, count] of [
    ['', 0],
    [':class="styles"', 1],
    [':class', 1],
    ['v-bind="props"', 1],
    [':class="styles" v-bind="props"', 1]
  ] as const)
    it(`counts ${binding || 'static props'} once per component in both parser entries`, async () => {
      const source = `<template><Card class="card-list" ${binding}/></template>`
      const result = await checkVue(source)
      assert.strictEqual(result.native.coverage.outOfScope, count)
      assert.deepStrictEqual(result.native.errors, [])
      assert.deepStrictEqual(result.host.messages, [])
    })

  it('preserves a proven invalid class and its original range beside unknown forwarding', async () => {
    const source = '<template><Card class="Bad_Name" v-bind="props"/></template>'
    const result = await checkVue(source)
    assert.strictEqual(result.native.coverage.outOfScope, 1)
    assert.deepStrictEqual(
      result.native.errors.map((issue) => issue.code),
      ['INVALID_BASE_CLASS']
    )
    assert.strictEqual(source.slice(...result.native.errors[0].range!), 'Bad_Name')
  })

  it('deduplicates a v-else component converted for several guards', async () => {
    const source =
      '<template><div class="card-list"><Card v-if="a && b" class="title"/><Card v-else class="title" :class="styles"/></div></template>'
    const result = await checkVue(source)
    assert.strictEqual(result.native.coverage.outOfScope, 1)
    assert.deepStrictEqual(result.native.errors, [])
  })

  it('does not count native unknown classes or unrelated component props as forwarding', async () => {
    for (const markup of ['<div class="card-list" :class="styles"/>', '<Card class="card-list" :title="label"/>']) {
      const result = await checkVue(`<template>${markup}</template>`)
      assert.strictEqual(result.native.coverage.outOfScope, 0)
    }
  })
})

describe('Vue written keys and native HTML attribute names', () => {
  for (const [label, config] of [
    ['default', {}],
    ['configured itemid', { selectorPolicy: { variant: { dataKeys: ['itemid'] } } }]
  ] satisfies Array<[string, MarkupConfig]>)
    it(`${label} retains an ordinary mixed-case component key independently of a bind`, async () => {
      const source = '<template><Comp class="card-list" itemId="a" :itemid="b"/></template>'
      const result = await checkVue(source, config)
      const configured = label === 'configured itemid'
      assert.strictEqual(result.native.status, configured ? 'failed' : 'pass')
      assert.strictEqual(result.native.errors.length, configured ? 1 : 0)
      if (configured) {
        const issue = result.native.errors[0]
        assert.strictEqual(issue.code, 'SOURCE_RELATION_UNRESOLVED')
        assert.deepStrictEqual(issue.range, [54, 55])
        assert.deepStrictEqual(issue.repair?.effective.selectorPolicy?.variant.dataKeys, ['itemid'])
      }
    })

  for (const attribute of ['Data-Variant="compact"', ':Data-Variant="variant"', 'v-bind="{\'Data-Variant\':variant}"'])
    it(`folds native HTML ${attribute} without changing its value range`, async () => {
      const source = `<template><div class="card-list" ${attribute}/></template>`
      const result = await checkVue(source)
      assert.strictEqual(result.native.errors.length, attribute.startsWith('Data') ? 0 : 1)
      if (result.native.errors.length) {
        assert.strictEqual(result.native.errors[0].code, 'SOURCE_RELATION_UNRESOLVED')
        assert.strictEqual(source.slice(...result.native.errors[0].range!), 'variant')
      } else assert.strictEqual(result.native.status, 'pass')
    })

  for (const attribute of [
    ':Class="\'card-list\'"',
    'Class="card-list"',
    ':class.prop="\'card-list\'"',
    '.class="\'card-list\'"',
    ':class.attr="\'card-list\'"'
  ])
    it(`keeps ${attribute} unknown instead of claiming an exact class-list target`, async () => {
      const source = `<template><div ${attribute}/></template>`
      const result = await checkVue(source)
      assert.strictEqual(result.native.status, 'failed')
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, source.slice(...issue.range!)]),
        [['DYNAMIC_CLASS_UNRESOLVED', attribute]]
      )
    })

  it('keeps lowercase class and variant controls unchanged', async () => {
    const valid = await checkVue('<template><div :class="\'card-list\'" data-variant="compact"/></template>')
    assert.strictEqual(valid.native.status, 'pass')
    const source = '<template><div class="card-list" :data-variant="variant"/></template>'
    const unresolved = await checkVue(source)
    assert.deepStrictEqual(
      unresolved.native.errors.map((issue) => [issue.code, source.slice(...issue.range!)]),
      [['SOURCE_RELATION_UNRESOLVED', 'variant']]
    )
  })

  it('retains written case for component and foreign element keys', async () => {
    for (const markup of [
      '<Comp class="card-list" :Data-Variant="variant"/>',
      '<svg class="card-list"><g class="body" :Data-Variant="variant"/></svg>'
    ]) {
      const result = await checkVue(`<template>${markup}</template>`)
      assert.strictEqual(result.native.status, 'pass', markup)
      assert.deepStrictEqual(result.native.errors, [])
    }
  })

  it('marks a folded reserved-key collision at the second attribute instead of choosing a winner', async () => {
    const second = 'data-variant="compact"'
    const source = `<template><div class="card-list" :Data-Variant="variant" ${second}/></template>`
    const result = await checkVue(source)
    assert.deepStrictEqual(
      result.native.errors.map((issue) => [issue.code, source.slice(...issue.range!)]),
      [['SOURCE_RELATION_UNRESOLVED', second]]
    )
  })

  for (const attributes of ['foo="x" Foo="y"', '@click="first" @Click="second"'])
    it(`passes distinct written keys ${attributes} through the supplied host duplicate record`, async () => {
      const result = await checkVue(`<template><Comp class="card-list" ${attributes}/></template>`)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(result.host.messages, [])
    })

  for (const attributes of ['foo="x" foo="y"', '@click="first" @click="second"', ':itemid="a" :itemid="b"'])
    it(`retains parser errors for identical written keys ${attributes}`, async () => {
      const source = `<template><Comp class="card-list" ${attributes}/></template>`
      const result = await lintBothEntries(source, 'vue')
      const direct = suppliedVue(source)
      assert.strictEqual(result.native.status, 'blocked')
      assert.strictEqual(direct.status, 'blocked')
      assert.deepStrictEqual(
        result.native.errors.map((issue) => issue.code),
        ['PARSE_ERROR']
      )
      assert.deepStrictEqual(
        direct.errors.map((issue) => issue.code),
        ['PARSE_ERROR']
      )
      assert.strictEqual(direct.errors[0].message, 'duplicate-attribute')
      assert.deepStrictEqual(
        result.host.messages.map((message) => message.messageId),
        ['PARSE_ERROR']
      )
    })
})
