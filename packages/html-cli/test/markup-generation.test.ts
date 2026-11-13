import assert from 'assert'
import * as os from 'os'
import { describe, it } from 'mocha'
import { generateFromHtml, generateFromMarkupDocument, type GeneratorOptions } from '../src/generator-core'
import { lintMarkup, loadMarkupParsers, type MarkupDocument } from '../src/markup'

describe('one source parse followed by generation-only aggregation', () => {
  const options: GeneratorOptions = {
    globalScssModule: '@styles/partials/global',
    pageEntryPrefix: '@assets/css',
    childScssDir: 'scss',
    layoutMixins: [],
    naming: {},
    selectorPolicy: { variant: { mode: 'class' }, state: { mode: 'class' } }
  }
  it('keeps allowed legacy and native filenames/order/content byte-identical', async () => {
    const parsers = await loadMarkupParsers(['html'])
    for (const source of [
      '<section class="card-list"><p class="body -one"></p><p class="body -two"></p></section>',
      '<table class="data-table"><tr class="row"><td class="cell"></td></tr></table>'
    ]) {
      const parser = parsers.html!
      assert.ok(parser.available)
      if (!parser.available) throw new Error(parser.reason)
      const document = parser.parse(source, 'root', options)
      for (const scssRootStyle of ['class', 'scope', 'scope-explicit'] as const) {
        const config = { ...options, scssRootStyle }
        assert.deepStrictEqual(
          generateFromMarkupDocument(document, os.tmpdir(), true, config),
          generateFromHtml(source, os.tmpdir(), true, config)
        )
      }
    }
  })

  it('does not reparse between lint and generation, or aggregate lint occurrences', async () => {
    const source = '<section class="card-list"><p class="body"></p><p class="body"></p></section>'
    const parsers = await loadMarkupParsers(['html'])
    const parser = parsers.html!
    assert.ok(parser.available)
    if (!parser.available) throw new Error(parser.reason)
    let calls = 0
    let document: MarkupDocument | undefined
    const result = lintMarkup(source, {
      format: 'html',
      mode: 'root',
      config: options,
      parsers: {
        html: {
          available: true,
          parse: (...args) => {
            calls += 1
            document = parser.parse(...args)
            return document
          }
        }
      }
    })
    assert.strictEqual(result.status, 'pass')
    assert.strictEqual(result.coverage.elements, 3)
    generateFromMarkupDocument(document!, os.tmpdir(), true, options)
    assert.strictEqual(calls, 1)
    assert.strictEqual(document!.index.metrics.markupParses, 1)
  })
})
