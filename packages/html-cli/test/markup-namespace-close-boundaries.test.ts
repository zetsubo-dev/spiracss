import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { lintMarkup, loadMarkupParsers } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'

describe('bounded Astro relation proofs', () => {
  it('keeps verified SVG namespaces across partial ancestors and HTML integration points', async () => {
    const parsers = await loadMarkupParsers(['astro'])
    for (const source of [
      '<div class="card-list"><svg class="icon"><g><path/></svg></div>',
      '<div class="card-list"><svg class="icon"><g><path/></g></svg></div>'
    ]) {
      const result = lintMarkup(source, { format: 'astro', mode: 'root', config: {}, parsers })
      assert.ok(
        !result.errors.some(
          (issue) => issue.code === 'CLASSLESS_TAG_NOT_ALLOWED' && issue.range?.[0] === source.indexOf('<path')
        )
      )
      assert.strictEqual(result.status, source.includes('</g>') ? 'pass' : 'failed')
    }
    const source = '<div class="card-list"><svg class="icon"><foreignObject><div/></foreignObject></svg></div>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.ok(result.native.errors.some((issue) => issue.code === 'CLASSLESS_TAG_NOT_ALLOWED'))
  })
  it('does not call post-parse relation failures resource faults or prove omissions from EOF', async () => {
    const sources = [
      '---\nif (!ok) return Astro.redirect("/x")\n---\n<div class="card-list">{</div>',
      '<div class="card-list">{a</div>',
      '<div class="card-list"><!-- x</div>',
      '<div class="card-list"><p class="title">{x</p></div>',
      '<div class="card-list"><div class="hero-panel">x</div>',
      '<section class="card-list"><section class="hero-panel"><section class="body-x">x</section></section>',
      '<ul class="item-list"><li class="item">a</li><ul class="sub-list"></ul>',
      '<div class="card-list"><div class="hero-panel">x</div><div class="body-x">y</div>',
      '{a && <div class="card-list"><div class="hero-panel">z</div>}</div>',
      '<p class="x" </p>',
      '<div {...}>',
      '{ <> }'
    ]
    const parsers = await loadMarkupParsers(['astro'])
    for (const source of sources) {
      const result = lintMarkup(source, { format: 'astro', mode: 'selection', config: {}, parsers })
      assert.notStrictEqual(result.status, 'pass', source)
      const text = JSON.stringify(result.errors)
      assert.ok(
        !/Restore parser|restore runtime resources|class uses|Block uses|Additional classes must/.test(text),
        source + text
      )
      if (source.includes('{x</p>')) assert.ok(!/omitted|explicit closing/i.test(text))
      assert.strictEqual(result.metrics.generatedParses, 1)
    }
  })
  it('accepts only the three local closing proofs and retains lint/generation parity', async () => {
    const parsers = await loadMarkupParsers(['astro']),
      parser = parsers.astro!
    assert.ok(parser.available)
    const generate = (source: string) =>
      generateFromMarkupDocument(parser.parse(source, 'root', {}), '/tmp/r4-layout', true, {
        globalScssModule: '',
        pageEntryPrefix: '',
        childScssDir: 'scss',
        layoutMixins: []
      })
    const scripts = [
      '<script src="a.js" type="module"></script>',
      '<script async src="a.js" is:inline></script>',
      '<script type="application/ld+json" is:inline set:html={"{}"}></script>'
    ]
    for (const script of scripts) {
      const source = script + '<main class="page-main"/>'
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass', source + JSON.stringify(result.native.errors))
      assert.deepStrictEqual(generate(source), generate('<main class="page-main"/>'))
      const bad = source.replace('page-main', 'page-main Bad_Name'),
        invalid = await lintBothEntries(bad, 'astro')
      assertEntryParity(bad, invalid)
      assert.ok(invalid.native.errors.some((issue) => issue.range && bad.slice(...issue.range) === 'Bad_Name'))
    }
    for (const source of [
      '<!doctype html>\n<html>\n<head><title>T</title></head>\n<body><main class="page-main"/></body>\n</html>',
      '<html>\n<head><title>T</title></head>\n<body>\n<main class="page-main"/>\n</body>\n</html>'
    ]) {
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass', JSON.stringify(result.native.errors))
      assert.deepStrictEqual(generate(source), generate('<main class="page-main"/>'))
    }
    for (const source of scripts) {
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.ok(result.native.errors.some((issue) => /No source element/.test(issue.message)))
    }
  })
  it('folds only verified native HTML close names and records the host-fatal boundary', async () => {
    const source = '<div class="card-list"></DIV>',
      result = await lintBothEntries(source, 'astro')
    assert.strictEqual(result.native.status, 'pass')
    assert.ok(result.host.messages.some((issue) => issue.fatal))
    for (const bad of ['<div class="card-list"></span>', '<div class="card-list">']) {
      const { native } = await lintBothEntries(bad, 'astro')
      assert.notStrictEqual(native.status, 'pass')
    }
  })
})
