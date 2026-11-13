import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { lintMarkup, loadMarkupParsers } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'

describe('original fragment boundary proofs', () => {
  it('proves complete delimiters and belonging across mapped and verified adjacent boundaries', async () => {
    const parser = (await loadMarkupParsers(['astro'])).astro!
    assert.ok(parser.available)
    const generate = (source: string) =>
      generateFromMarkupDocument(parser.parse(source, 'root', {}), '/tmp/r5-fragments', true, {
        globalScssModule: '',
        pageEntryPrefix: '',
        childScssDir: 'scss',
        layoutMixins: []
      } as Parameters<typeof generateFromMarkupDocument>[3])
    for (const [source, control] of [
      ['<><div class="card-list"/></>', '<div class="card-list"/>'],
      ['<><div class="card-list"></div></>', '<div class="card-list"></div>'],
      [
        '<div class="card-list"><><span class="title">x</span></></div>',
        '<div class="card-list"><span class="title">x</span></div>'
      ],
      [
        '<ul class="card-list">{items.map(i => <><li class="body">x</li></>)}</ul>',
        '<ul class="card-list">{items.map(i => <li class="body">x</li>)}</ul>'
      ],
      ['{cond && <><div class="card-list"/></>}', '{cond && <div class="card-list"/>}'],
      ['<><><div class="card-list"/></></>', '<div class="card-list"/>'],
      [
        '---\r\nconst label="日本😀";\r\n---\r\n<>\r\n <div class="card-list"><p class="body">{label}</p></div>\r\n</>',
        '---\r\nconst label="日本😀";\r\n---\r\n<div class="card-list"><p class="body">{label}</p></div>'
      ]
    ]) {
      const result = await lintBothEntries(source, 'astro'),
        other = await lintBothEntries(control, 'astro')
      assertEntryParity(source, result)
      assertEntryParity(control, other)
      assert.strictEqual(result.native.status, other.native.status, source + JSON.stringify(result.native.errors))
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.range && source.slice(...issue.range)]),
        other.native.errors.map((issue) => [issue.code, issue.range && control.slice(...issue.range)])
      )
      if (result.native.status === 'pass') assert.deepStrictEqual(generate(source), generate(control), source)
    }
    const bad = '---\r\nconst label="日本😀";\r\n---\r\n<><div class="card-list Bad_Name"/></>'
    const invalid = await lintBothEntries(bad, 'astro')
    assertEntryParity(bad, invalid)
    assert.ok(invalid.native.errors.some((issue) => issue.range && bad.slice(...issue.range) === 'Bad_Name'))
  })
  it('localizes uncertainty without delimiter reuse and retains independent safe siblings', async () => {
    const parsers = await loadMarkupParsers(['astro'])
    for (const source of [
      '{ <> }',
      '<div class="card-list"><><span class="body"/></div>',
      '<><><div class="card-list"/></>'
    ]) {
      const { native: result, host } = await lintBothEntries(source, 'astro')
      assert.notStrictEqual(result.status, 'pass', source)
      assert.ok(host.errorCount > 0)
      assert.ok(!/Restore parser|restore runtime resources/.test(JSON.stringify(result.errors)))
    }
    const source =
      '<main class="page-main"><section class="card-list"><p class="body Bad_Name"/></section><div class="hero-panel"><><span class="title"/></div></main>'
    const result = lintMarkup(source, { format: 'astro', mode: 'root', parsers, config: {} })
    assert.ok(
      result.errors.some((issue) => issue.range && source.slice(...issue.range) === 'Bad_Name'),
      JSON.stringify(result.errors)
    )
    const unknown = result.errors.find((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED')!
    assert.ok(unknown?.range)
    assert.ok(!/Restore parser/.test(JSON.stringify(unknown)))
    const parser = parsers.astro!
    assert.ok(parser.available)
    assert.throws(
      () =>
        generateFromMarkupDocument(parser.parse(source, 'root', {}), '/tmp/r5-unverified', true, {
          globalScssModule: '',
          pageEntryPrefix: '',
          childScssDir: 'scss',
          layoutMixins: []
        } as Parameters<typeof generateFromMarkupDocument>[3]),
      /boundar|unresolved/i
    )
  })
  it('keeps positionless message and repair positionless, but retains real source and missing-map evidence', async () => {
    for (const source of ['<p class="x" </p>', '{ <> }']) {
      const { native } = await lintBothEntries(source, 'astro')
      const issue = native.errors[0]
      assert.strictEqual(issue.range, undefined)
      assert.strictEqual(issue.position, undefined)
      assert.ok(
        !/this range|reported source range|in the range/i.test(
          JSON.stringify({ message: issue.message, repair: issue.repair })
        )
      )
    }
    const { native } = await lintBothEntries('<div class="card-list"><p class="body">{x</p></div>', 'astro')
    assert.ok(native.errors.some((issue) => issue.range && issue.code === 'SOURCE_RELATION_UNRESOLVED'))
  })
})
