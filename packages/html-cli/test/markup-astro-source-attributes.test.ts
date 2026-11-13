import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import { plugin } from '../src/eslint'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

async function both(source: string) {
  const native = lintMarkup(source, {
    format: 'astro',
    mode: 'root',
    config: {},
    parsers: await loadMarkupParsers(['astro'])
  })
  const parser = await import('astro-eslint-parser')
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.astro'],
        languageOptions: { parser },
        plugins: { spiracss: plugin },
        rules: { 'spiracss/markup': ['error', { config: {}, format: 'astro' }] }
      }
    ] as never
  })
  const host = (await eslint.lintText(source, { filePath: 'r2.astro' }))[0]
  return { native, host }
}
function parity(source: string, result: Awaited<ReturnType<typeof both>>) {
  assert.ok(!result.host.messages.some((message) => message.fatal), JSON.stringify(result.host.messages))
  const key = (code: unknown, start: unknown, end: unknown) => JSON.stringify([code, start, end])
  assert.deepStrictEqual(
    result.host.messages.map((message) => key(message.messageId, message.column, message.endColumn)).sort(),
    result.native.errors.map((issue) => key(issue.code, issue.position?.column, issue.position?.endColumn)).sort(),
    source
  )
}

describe('Astro scope, original mapping and relation boundaries', () => {
  it('preserves synthesized expression scope and object last-wins before native first-wins', async () => {
    for (const attribute of ['class={cx("body")}', '{...{class:cx("body")}}']) {
      for (const shadow of [true, false]) {
        const source = `---\nimport cx from "clsx"\n---\n<div class="card-list">{items.map(${shadow ? 'cx' : 'item'} => <p ${attribute}/>)}</div>`
        const result = await both(source)
        parity(source, result)
        assert.strictEqual(
          result.native.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'),
          shadow
        )
      }
    }
    for (const [first, last, pass] of [
      ['Bad_Name', 'card-list', true],
      ['card-list', 'Bad_Name', false]
    ] as const) {
      const source = `<div {...{class:"${first}",class:"${last}"}}/>`
      const result = await both(source)
      parity(source, result)
      assert.strictEqual(result.native.status === 'pass', pass)
      if (!pass)
        assert.strictEqual(
          result.native.errors.find((issue) => issue.code === 'INVALID_BASE_CLASS')?.range?.[0],
          source.lastIndexOf('Bad_Name')
        )
    }
  })
  it('excludes frontmatter JSX and separates detached units from template roots', async () => {
    for (const template of [
      '<div class="card-list"/>',
      '<div class="card-list">{html}</div>',
      '<div class="card-list"><p class="body Bad_Name"/></div>'
    ]) {
      const source = `---\nconst html=<span class="Bad_Name"/>\n---\n${template}`
      const result = await both(source)
      parity(source, result)
      assert.strictEqual(result.native.errors.length, template.includes('<p') ? 1 : 0)
      if (result.native.errors.length)
        assert.strictEqual(result.native.errors[0].range?.[0], source.lastIndexOf('Bad_Name'))
    }
    for (const value of ['title', 'title Bad_Name']) {
      const source = `<Tabs icon={<span class="${value}"/>}/>`
      const result = await both(source)
      parity(source, result)
      assert.strictEqual(result.native.errors.length, value.includes('Bad_Name') ? 1 : 0)
      assert.strictEqual(result.native.coverage.outOfScope, 1)
    }
  })
  it('matches single/multiple special attributes by original names and anchors, not index', async () => {
    for (const source of [
      '<div @click="card-list" class="Bad_Name"/>',
      '<div @click="foo" class="card-list"/>',
      '<div @click="x" :class="y" class="card-list"/>',
      '<div @click="x" class="card-list" x-on:keyup.enter="y"><p class="body Bad_Name"/></div>',
      '<div @click="x" class="card-list" @click.outside="y"/>',
      '<div @click="x" {...{class:"card-list"}} :class="y"/>'
    ]) {
      const result = await both(source)
      parity(source, result)
      assert.strictEqual(
        result.native.errors.length,
        source.includes('class="Bad_Name"') ? 2 : source.includes('Bad_Name') ? 1 : 0,
        JSON.stringify(result.native.errors)
      )
      if (source.includes('Bad_Name')) assert.strictEqual(source.slice(...result.native.errors[0].range!), 'Bad_Name')
    }
  })
  it('reports accepted-but-unrestorable omissions locally without asserting the generated tree', async () => {
    for (const [source, start] of [
      ['<ul class="card-list"><li class="body">a<li class="hero-panel">b</ul>', '<li'],
      ['<div class="card-list"><p class="body">a<div class="hero-panel"/></div>', '<p'],
      ['<table class="data-table"><tr class="row"><td class="cell">a<td class="hero-panel">b</tr></table>', '<td'],
      ['<div class="card-list"><p class="title">x</p>', '<div']
    ]) {
      const { native, host } = await both(source)
      assert.strictEqual(native.status, 'failed')
      assert.ok(
        native.errors.every((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'),
        JSON.stringify(native.errors)
      )
      assert.strictEqual(native.errors[0].range?.[0], source.indexOf(start))
      assert.ok(native.errors[0].repair?.conditions.some((condition) => /clos/i.test(condition)))
      assert.ok(
        host.messages.some((message) => message.fatal),
        'Existing host rejects before the rule; not the standalone constraint code.'
      )
    }
    for (const end of [';', '(']) {
      const source = `---\r\nconst label="日本😀";\r\nconst a = ${end}\r\n---\r\n<div class="card-list"/>`
      const { native } = await both(source)
      assert.strictEqual(native.status, 'blocked')
      const issue = native.errors[0]
      assert.strictEqual(issue.code, 'PARSE_ERROR')
      if (end === ';') assert.deepStrictEqual(issue.range, [source.lastIndexOf(';'), source.lastIndexOf(';')])
      else {
        assert.ok(issue.range![0] >= 3 && issue.range![1] > issue.range![0] + 1)
        assert.ok(source.slice(...issue.range!).includes('const a = ('))
      }
    }
  })
  it('counts a map callback element as inspected source', async () => {
    const source = '<div class="card-list">{items.map(item => <p class="title"/>)}</div>'
    const result = await both(source)
    parity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.native.coverage.elements, 2)
    assert.strictEqual(result.native.coverage.outOfScope, 0)
  })
})
