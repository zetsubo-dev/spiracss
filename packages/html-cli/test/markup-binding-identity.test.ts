import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as vueParser from 'vue-eslint-parser'
import { plugin } from '../src/eslint'
import { lintMarkup, loadMarkupParsers, type MarkupConfig } from '../src/markup'

async function both(source: string, format: 'jsx' | 'vue', config: MarkupConfig = {}) {
  const native = lintMarkup(source, { format, mode: 'root', config, parsers: await loadMarkupParsers([format]) })
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: [`**/*.${format}`],
        languageOptions: format === 'vue' ? { parser: vueParser } : { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { spiracss: plugin },
        rules: { 'spiracss/markup': ['error', { format, config }] }
      }
    ] as never
  })
  const host = (await eslint.lintText(source, { filePath: 'review.' + format }))[0]
  assert.ok(!host.messages.some((message) => message.fatal), JSON.stringify(host.messages))
  assert.deepStrictEqual(
    host.messages.map((message) => message.messageId).sort(),
    native.errors.map((issue) => issue.code).sort()
  )
  return native
}

describe('binding identity and finite guards', () => {
  it('recognizes Babel method parameters without changing returned-root or outer-import semantics', async () => {
    for (const declaration of [
      'const views={render(clsx){return <div className={clsx("card-list")}/>}};',
      'class Views{render(clsx){return <div className={clsx("card-list")}/>}}'
    ]) {
      const result = await both(
        `import clsx from "clsx";${declaration}function Card(){return <div className={clsx("hero-panel")}/>}`,
        'jsx'
      )
      assert.strictEqual(result.errors.filter((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED').length, 1)
      assert.ok(!result.errors.some((issue) => issue.code === 'ROOT_NOT_BLOCK'))
      const unshadowed = await both(
        `import clsx from "clsx";${declaration.replace('render(clsx)', 'render(value)')}`,
        'jsx'
      )
      assert.strictEqual(unshadowed.status, 'pass')
      const elementRoot = await both(
        `import clsx from "clsx";${declaration.replace('render(clsx)', 'render(value)').replace('"card-list"', '"body"')}`,
        'jsx'
      )
      assert.ok(elementRoot.errors.some((issue) => issue.code === 'ROOT_NOT_BLOCK'))
    }
  })
  it('does not trust the self-name of a named function expression as an imported helper', async () => {
    const result = await both(
      'import clsx from "clsx";const Card=function clsx(){return <div className={clsx("card-list")}/>}',
      'jsx'
    )
    assert.ok(result.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    assert.strictEqual(
      (
        await both(
          'import clsx from "clsx";const Card=function named(){return <div className={clsx("card-list")}/>}',
          'jsx'
        )
      ).status,
      'pass'
    )
  })

  it('preserves unset, explicit, denied and chained member-access meanings', async () => {
    for (const [expression, allowlist, pass] of [
      ['styles["card-list"]', undefined, true],
      ['styles["card-list"]', ['styles'], true],
      ['styles["card-list"]', [], false],
      ['props["card-list"]', undefined, false],
      ['props["card-list"]', ['props'], false],
      ['styles.theme["card-list"]', undefined, false]
    ] as const) {
      const config: MarkupConfig =
        allowlist === undefined ? {} : { jsxClassBindings: { memberAccessAllowlist: [...allowlist] } }
      const result = await both(`function Card(){return <div className={${expression}}/>}`, 'jsx', config)
      assert.strictEqual(result.status === 'pass', pass, expression)
    }
  })

  it('preserves stable conjunction guards, their negative controls and impossible branches', async () => {
    for (const condition of ['a && b', 'a && (b)', 'a && (!b)']) {
      const result = await both(
        `function Card(){return <div className="root-block"><div className={a ? (b ? 'card-list' : 'body') : 'body'}>{${condition} && <section className="hero-panel"/>}</div></div>}`,
        'jsx'
      )
      assert.strictEqual(
        result.errors.some((issue) => issue.code === 'ELEMENT_PARENT_OF_BLOCK'),
        condition.includes('!b')
      )
    }
    const impossible = await both(
      'function Card(){return <div className="card-list">{ok && (!ok && <p className="Bad_Name"/>)}</div>}',
      'jsx'
    )
    assert.strictEqual(impossible.status, 'pass')
    assert.ok(!impossible.errors.some((issue) => issue.condition?.includes('impossible')))
  })

  it('keeps outer and v-for/slot bindings distinct without helper imports', async () => {
    for (const child of [
      '<div v-for="ok in flags" :class="ok ? \'hero-panel\' : \'title\'"/>',
      '<Widget v-slot="{ok}"><section :class="ok ? \'hero-panel\' : \'title\'"/></Widget>'
    ]) {
      const source = `<template><div class="root-block"><div :class="ok ? 'card-list' : 'body'">${child}</div></div></template>`
      const result = await both(source, 'vue')
      assert.ok(
        result.errors.some((issue) => issue.code === 'ELEMENT_PARENT_OF_BLOCK'),
        JSON.stringify(result.errors)
      )
    }
    const valid = await both(
      '<template><div class="root-block"><div :class="ok ? \'card-list\' : \'body\'"><section v-if="ok" class="hero-panel"/></div></div></template>',
      'vue'
    )
    assert.strictEqual(valid.status, 'pass')
  })
})
