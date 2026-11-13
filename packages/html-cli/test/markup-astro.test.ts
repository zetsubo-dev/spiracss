import assert from 'assert'
import { before, describe, it } from 'mocha'
import { lintMarkup, loadMarkupParsers, type MarkupParsers } from '../src/markup'

describe('official Astro compiler source adapter', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['astro'])
  })
  const run = (source: string) => lintMarkup(source, { format: 'astro', mode: 'root', parsers, config: {} })

  it('keeps class:list source tokens through one conversion and generated parse after Japanese/emoji/CRLF', () => {
    const source =
      '---\r\nconst label="日本😀";\r\n---\r\n<div class:list={["card-list"]}><p class:list={["body Bad_Name"]}/></div>'
    const result = run(source)
    const issue = result.errors.find((item) => item.code === 'UNCLASSIFIED_CLASS_TOKEN')!
    assert.strictEqual(source.slice(...issue.range!), 'Bad_Name', JSON.stringify(result.errors))
    assert.strictEqual(issue.position?.line, 4)
    assert.strictEqual(result.metrics.markupParses, 1)
    assert.strictEqual(result.metrics.astroConversions, 1)
    assert.strictEqual(result.metrics.generatedParses, 1)
    assert.strictEqual(result.metrics.expressionParses, 0)
    assert.strictEqual(result.metrics.scriptParses, 0)
  })

  it('joins static class and class:list under the actual list semantics', () => {
    const result = run('<div class="card-list" class:list={{"u-extra": true}}><p class:list={["title"]}/></div>')
    assert.strictEqual(result.status, 'pass', JSON.stringify(result.errors))
  })

  it('keeps exclusive template expressions separate', () => {
    const result = run('---\nconst ok=true;\n---\n{ok ? <div class="card-list"/> : <div class="hero-panel"/>}')
    assert.strictEqual(result.status, 'pass', JSON.stringify(result.errors))
  })

  it('keeps visible names in callback, array and logical fallback expressions', () => {
    for (const children of [
      'items.map(item => <p class="body Bad_Name"/>)',
      '[<p class="body Bad_Name"/>]',
      'value || <p class="body Bad_Name"/>'
    ]) {
      const result = run(`<div class="card-list">{${children}}</div>`)
      assert.ok(
        result.errors.some((issue) => issue.code === 'UNCLASSIFIED_CLASS_TOKEN'),
        JSON.stringify(result.errors)
      )
    }
  })
})
