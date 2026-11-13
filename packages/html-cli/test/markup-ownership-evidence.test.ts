import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import * as vueParser from 'vue-eslint-parser'
import { createMarkupEslintConfig, diagnosticMessage, plugin } from '../src/eslint'
import { generateFromMarkupDocument, lintHtmlStructure, type GeneratorOptions } from '../src/generator-core'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

const config: GeneratorOptions = {
  globalScssModule: '@styles/partials/global',
  pageEntryPrefix: '@assets/css',
  childScssDir: 'scss',
  layoutMixins: [],
  naming: {},
  selectorPolicy: { variant: { mode: 'class' }, state: { mode: 'class' } }
}

describe('invariant ownership and diagnostic evidence', () => {
  it('visits a depth16 modifier-only chain once per source occurrence in lint and generation', async () => {
    const parsers = await loadMarkupParsers(['vue'])
    const source =
      '<template><article class="card-list">' +
      Array.from(
        { length: 16 },
        (_, i) => `<div class="body" :class="{ '-a': a${i}, '-b': b${i}, '-c': c${i} }">`
      ).join('') +
      '<span class="label"/>' +
      '</div>'.repeat(16) +
      '</article></template>'
    const parser = parsers.vue!
    assert.ok(parser.available)
    const document = parser.parse(source, 'root', config)
    const result = lintMarkup(source, {
      format: 'vue',
      mode: 'root',
      config,
      parsers: { vue: { available: true, parse: () => document } }
    })
    assert.strictEqual(result.status, 'pass', JSON.stringify(result.errors))
    assert.strictEqual(result.coverage.elements, 18)
    assert.strictEqual(result.metrics.validationFrames, 18)
    assert.strictEqual(result.metrics.childPropagations, 17)
    const files = generateFromMarkupDocument(document, '/tmp/spiracss-review-core', true, config)
    assert.strictEqual(document.index.metrics.generationVisits, 18)
    assert.ok(files.some((file) => file.content.includes('.-a')))
    assert.ok(files.some((file) => file.content.includes('label')))
  })

  it('does not broaden non-exhaustive owner alternatives when propagating guards', async () => {
    const parsers = await loadMarkupParsers(['jsx'])
    for (const [condition, violation] of [
      ['a', false],
      ['!a', true]
    ] as const) {
      const source = `function Card(){return <div className="root-block"><div className={a ? 'card-list' : 'body'}>{${condition} && <section className="hero-panel"/>}</div></div>}`
      const result = lintMarkup(source, { format: 'jsx', mode: 'root', config, parsers })
      assert.strictEqual(
        result.errors.some((error) => error.code === 'ELEMENT_PARENT_OF_BLOCK'),
        violation
      )
    }
  })

  it('limits root rules to source units rather than descendants without a classed parent', async () => {
    const source = '<div><section><p class="title"></p></section></div>'
    const result = lintMarkup(source, {
      format: 'html',
      mode: 'root',
      config,
      parsers: await loadMarkupParsers(['html'])
    })
    assert.strictEqual(result.errors.filter((error) => error.code === 'INVALID_BASE_CLASS').length, 1)
    assert.ok(!result.errors.some((error) => error.code === 'ROOT_NOT_BLOCK'))
  })

  it('keeps class-token diagnostics off unrelated attributes of the same name', async () => {
    for (const [source, token, code] of [
      ['<input class="field name" name="name">', 'name', 'MULTIPLE_BASE_CLASSES'],
      ['<abbr class="title" title="…"></abbr>', 'title', 'ELEMENT_WITHOUT_BLOCK_ANCESTOR']
    ]) {
      const result = lintMarkup(source, {
        format: 'html',
        mode: 'selection',
        config,
        parsers: await loadMarkupParsers(['html'])
      })
      const issue = result.errors.find((error) => error.code === code)!
      assert.deepStrictEqual(issue.range, [source.indexOf(token), source.indexOf(token) + token.length])
    }
  })

  it('uses merged policy naming and normalized keys in repair evidence', async () => {
    const source = '<div class="card-list" data-kind="one-two-three-four"></div>'
    const policy = {
      valueNaming: { case: 'snake' as const, maxWords: 3 },
      variant: { dataKeys: [' data-kind '], valueNaming: { case: 'kebab' as const } }
    }
    const result = lintMarkup(source, {
      format: 'html',
      mode: 'root',
      config: { selectorPolicy: policy },
      parsers: await loadMarkupParsers(['html'])
    })
    const issue = result.errors.find((error) => error.code === 'INVALID_VARIANT_VALUE')!
    const effective = issue.repair!.effective.selectorPolicy as {
      variant: { dataKeys: string[]; valueNaming: unknown }
    }
    assert.deepStrictEqual(effective.variant.valueNaming, { case: 'kebab', maxWords: 3 })
    assert.deepStrictEqual(effective.variant.dataKeys, ['data-kind'])
    assert.deepStrictEqual(issue.range, [
      source.indexOf('one-two'),
      source.indexOf('one-two') + 'one-two-three-four'.length
    ])
  })

  it('does not invent an original position for legacy unbalanced diagnostics', () => {
    const issue = lintHtmlStructure('<div class="card-list">', true, {}, config.selectorPolicy).find(
      (error) => error.code === 'UNBALANCED_HTML'
    )!
    assert.ok(issue)
    assert.strictEqual(issue.range, undefined)
    assert.strictEqual(issue.position, undefined)
  })

  it('matches supplied HTML diagnostic evidence and handles the same Vue modifier chain', async () => {
    for (const source of [
      '<input class="field name" name="name">',
      '<div><section><p class="title"></p></section></div>'
    ]) {
      const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: [createMarkupEslintConfig(config, htmlParser)] as never
      })
      const messages = (await eslint.lintText(source, { filePath: 'review.html' }))[0].messages
      const expected = lintMarkup(source, {
        format: 'html',
        mode: 'root',
        config,
        parsers: await loadMarkupParsers(['html'])
      }).errors
      const sorted = (values: unknown[][]) => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      assert.deepStrictEqual(
        sorted(messages.map((message) => [message.messageId, message.message, message.column, message.endColumn])),
        sorted(
          expected.map((issue) => [
            issue.code,
            diagnosticMessage(issue),
            issue.position?.column,
            issue.position?.endColumn
          ])
        )
      )
    }
    const source =
      '<template><article class="card-list">' +
      "<div class=\"body\" :class=\"{ '-a': a, '-b': b, '-c': c }\">".repeat(16) +
      '<span class="label"/>' +
      '</div>'.repeat(16) +
      '</article></template>'
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.vue'],
          languageOptions: { parser: vueParser },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config, format: 'vue' }] }
        }
      ] as never
    })
    assert.strictEqual((await eslint.lintText(source, { filePath: 'review.vue' }))[0].errorCount, 0)
  })
})
