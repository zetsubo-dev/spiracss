import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { lintMarkup, loadMarkupParsers } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'
import { parseAstroSource } from '../src/markup/adapters/astro'

describe('representative Astro attribute and failure table', () => {
  it('keeps original attribute provenance across whitespace, order and explicit endings', async () => {
    const rows = [
      '<div class="card-list" @click={() => 123}/>',
      '<div @click={() => 123} class="card-list"/>',
      '<div class="card-list" @click={() => 123}></div>',
      '<div { ...{class:"card-list"} }/>',
      '<div {\n...{class:"card-list"}\n}/>',
      '<div {...{class:"card-list"}}/>',
      '---\nconst title="x"\n---\n<div class="card-list" {title}/>',
      '<UI.Card/>',
      '<div :data-x="x" class="card-list" x-on:keyup.enter="y"/>',
      '<div class="card-list" @click={() => <span class="Bad_Name"/>}/>'
    ]
    for (const source of rows) {
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(
        result.native.status === 'pass',
        !source.includes('Bad_Name'),
        JSON.stringify(result.native.errors)
      )
      if (source.includes('Bad_Name')) assert.strictEqual(source.slice(...result.native.errors[0].range!), 'Bad_Name')
    }
    for (const spacing of ['...props', ' ...props ', '\n...props\n']) {
      const source = `<div {${spacing}} class="card-list"/>`,
        result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.errors[0].code, 'DYNAMIC_CLASS_UNRESOLVED')
      assert.ok(source.slice(...result.native.errors[0].range!).includes('...props'))
    }
  })
  it('classifies proved missing-close drift before attribute anchors and retains safe independent subtrees', async () => {
    const sources = [
      '<div class="card-list"><ul class="list"><li class="body">a<li class="title">b</ul></div><section class="hero-panel"/>',
      '<main class="page-main"><section class="hero-panel"><p class="Bad_Two">x</p></section><ul class="card-list"><li class="item">a<li class="item">b</ul></main><footer class="site-footer"><p class="Bad_Three">x</p></footer>',
      '<div class="card-list"><span class="title">x</div><div class="hero-panel"/>'
    ]
    const parsers = await loadMarkupParsers(['astro'])
    for (const source of sources) {
      const result = lintMarkup(source, { format: 'astro', mode: 'selection', config: {}, parsers })
      assert.strictEqual(result.status, 'failed', JSON.stringify(result.errors))
      assert.ok(
        !result.errors.some(
          (issue) =>
            issue.code === 'PARSER_RUNTIME_ERROR' ||
            issue.code === 'ELEMENT_PARENT_OF_BLOCK' ||
            issue.code === 'MULTIPLE_ROOT_ELEMENTS'
        )
      )
      const unresolved = result.errors.find((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED')!
      const anchor = source.includes('<li') ? '<li' : '<span'
      assert.strictEqual(unresolved.range?.[0], source.indexOf(anchor))
      assert.ok(
        unresolved.repair?.conditions.some((condition) =>
          /explicit closing|opening\/closing correspondence/i.test(condition)
        )
      )
      if (source.includes('Bad_Two')) {
        assert.ok(result.errors.some((issue) => issue.range && source.slice(...issue.range) === 'Bad_Two'))
        assert.ok(result.coverage.elements >= 2)
      }
      const parser = parsers.astro!
      assert.ok(parser.available)
      const document = parser.parse(source, 'selection', {})
      assert.throws(
        () =>
          generateFromMarkupDocument(document, '/tmp/r3-uncertain', false, {
            globalScssModule: '',
            pageEntryPrefix: '',
            childScssDir: 'scss',
            layoutMixins: []
          }),
        /boundar|unresolved/i
      )
    }
  })
  it('proves frontmatter syntax under tolerated grammars and never exposes generated coordinates', async () => {
    for (const body of ['function f() {', 'if (a) {', 'const a = ;', 'const a = (']) {
      const source = `---\r\nconst label="日本😀";\r\n${body}\r\n---\r\n<div class="card-list"/>`
      const { native } = await lintBothEntries(source, 'astro')
      assert.strictEqual(native.status, 'blocked')
      const issue = native.errors[0]
      assert.strictEqual(issue.code, 'PARSE_ERROR', JSON.stringify(issue))
      assert.ok(issue.range && issue.range[0] >= 5 && issue.range[1] <= source.indexOf('---', 5))
      assert.ok(!/\(\d+:\d+\)/.test(issue.message + ' ' + issue.reason))
      assert.strictEqual(
        native.metrics.scriptParses,
        2,
        'Both tolerated grammar attempts must survive the public lintMarkup failure catch.'
      )
      assert.strictEqual(native.metrics.astroConversions, 1)
      assert.strictEqual(native.metrics.generatedParses, 1)
    }
    for (const body of [
      'if (!ok) return Astro.redirect("/x")',
      'const value = await Promise.resolve(1)',
      'const n = <number>value',
      'const node = <b/>'
    ]) {
      const source = `---\n${body}\n---\n{items.map(i => <li class="item"><span class="title">{i}</li>)}`
      const { native } = await lintBothEntries(source, 'astro')
      assert.strictEqual(native.status, 'blocked')
      assert.notStrictEqual(native.errors[0].code, 'PARSE_ERROR', JSON.stringify(native.errors))
      assert.ok(/cannot.*(?:distinguish|determine)|cannot be distinguished/i.test(native.errors[0].reason ?? ''))
      assert.ok(
        !native.errors[0].repair?.conditions.some((condition) =>
          /Restore parser|Correct the reported source syntax/.test(condition)
        )
      )
    }
  })
  it('keeps the public successful path at conversion1/generated parse1/source parse0', async () => {
    const { native } = await lintBothEntries('---\nif (!ok) return Astro.redirect("/x")\n---\n<div class="card-list"/>', 'astro')
    assert.strictEqual(native.status, 'pass')
    assert.strictEqual(native.metrics.astroConversions, 1)
    assert.strictEqual(native.metrics.generatedParses, 1)
    assert.strictEqual(native.metrics.scriptParses, 0)
  })
  it('leaves an unrelated missing-map failure as runtime without a fabricated range', () => {
    const compiler = require('@astrojs/compiler/sync')
    const source = '<div class="card-list"/>'
    const converted = compiler.convertToTSX(source)
    const result = lintMarkup(source, {
      format: 'astro',
      mode: 'root',
      config: {},
      parsers: {
        astro: {
          available: true,
          parse: () =>
            parseAstroSource(
              source,
              { convertToTSX: () => ({ ...converted, map: { ...converted.map, mappings: '' } }) },
              {}
            )
        }
      }
    })
    assert.strictEqual(result.errors[0].code, 'PARSER_RUNTIME_ERROR')
    assert.strictEqual(result.errors[0].range, undefined)
  })
})
