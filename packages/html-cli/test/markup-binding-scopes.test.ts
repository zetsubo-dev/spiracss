import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as tsParser from '@typescript-eslint/parser'
import * as vueParser from 'vue-eslint-parser'
import { plugin } from '../src/eslint'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

async function both(source: string, format: 'tsx' | 'vue' = 'tsx') {
  const native = lintMarkup(source, { format, mode: 'root', config: {}, parsers: await loadMarkupParsers([format]) })
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: [`**/*.${format}`],
        languageOptions: {
          parser: format === 'vue' ? vueParser : tsParser,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: { jsx: true },
            ...(format === 'vue' ? { parser: tsParser } : {})
          }
        },
        plugins: { spiracss: plugin },
        rules: { 'spiracss/markup': ['error', { format, config: {} }] }
      }
    ] as never
  })
  const host = (await eslint.lintText(source, { filePath: `r2.${format}` }))[0]
  assert.ok(!host.messages.some((message) => message.fatal), JSON.stringify(host.messages))
  assert.deepStrictEqual(
    host.messages.map((message) => message.messageId).sort(),
    native.errors.map((issue) => issue.code).sort(),
    source
  )
  return native
}

describe('finite syntax and binding repairs', () => {
  it('blocks expression depth truncation rather than silently dropping JSX', async () => {
    for (const depth of [250, 257]) {
      const source = `function Card(){return <div className="card-list">{${'a && ('.repeat(depth)}<p className="Bad_Name"/>${')'.repeat(depth)}}</div>}`
      const result = await both(source)
      assert.ok(
        result.errors.some((issue) => issue.code === (depth === 250 ? 'INVALID_BASE_CLASS' : 'MAX_DEPTH_EXCEEDED'))
      )
      if (depth === 257) assert.strictEqual(result.status, 'blocked')
    }
  })
  it('binds aliases, never the Vue iteration source', async () => {
    for (const loop of ['x in items.filter(Boolean)', 'x in 3', 'x in [1,2]', '(x, i) in items', 'x of items']) {
      assert.strictEqual(
        (await both(`<template><div class="card-list"><p v-for="${loop}" class="body"/></div></template>`, 'vue'))
          .status,
        'pass',
        loop
      )
    }
  })
  it('separates each reference scope without poisoning the outer import', async () => {
    const call = '<div className={cx("card-list")}/>'
    const outside = `function Outer(){return ${call}}`
    const fixtures: Array<[string, string, number]> = [
      ['parameter', `function View(cx){return ${call}}`, 1],
      ['function expression', `const View=function cx(){return ${call}}`, 1],
      ['arrow parameter', `const View=(cx)=>${call}`, 1],
      ['method', `const views={render(cx){return ${call}}}`, 1],
      ['class self', `const View=class cx{render(){return ${call}}}`, 1],
      ['switch cases', `function View(){switch(0){case 0:let cx;return ${call}}}`, 1],
      [
        'switch discriminant',
        `function View(){switch(${call}){case 0:let cx;return <div className="hero-panel"/>}}`,
        0
      ],
      ['static let', `class View{static{let cx;const item=${call}}}`, 1],
      ['static var', `class View{static{var cx;const item=${call}}}`, 1],
      ['catch', `function View(){try{}catch(cx){return ${call}}}`, 1],
      ['for', `function View(){for(let cx of items){const item=${call}}}`, 1],
      ['for in', `function View(){for(let cx in items){const item=${call}}}`, 1],
      ['for statement', `function View(){for(let cx=0;cx<1;cx++){const item=${call}}}`, 1],
      ['destructure', `function View({cx}){return ${call}}`, 1],
      ['default parameter body var', `function View(item=${call}){var cx;return <div className="hero-panel"/>}`, 0],
      ['computed method key', `const views={ [${call}](cx){return <div className="hero-panel"/>}}`, 0],
      ['namespace', `namespace Local{const cx=other;const item=${call}}`, 1],
      ['enum', `function View(){enum cx{A};return ${call}}`, 1],
      ['type alias', `function View(){type cx=string;return ${call}}`, 0]
    ]
    for (const [name, declaration, unresolved] of fixtures) {
      const result = await both(`import cx from 'clsx';${declaration};${outside}`)
      assert.strictEqual(
        result.errors.filter((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED').length,
        unresolved,
        name + JSON.stringify(result.errors)
      )
    }
    for (const declaration of ['import type cx from "clsx";', 'import {type clsx as cx} from "clsx";']) {
      const result = await both(declaration + outside)
      assert.ok(result.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    }
  })
  it('treats only unbound undefined as an absent attribute value', async () => {
    for (const [params, unresolved] of [
      ['', false],
      ['undefined', true]
    ] as const) {
      const result = await both(
        `function View(${params}){return <div className="card-list" data-variant={undefined}/>}`
      )
      assert.strictEqual(
        result.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'),
        unresolved
      )
    }
    for (const binding of ['v-for="undefined in values"', 'v-slot="{undefined}"']) {
      const result = await both(
        `<template><div class="card-list"><template ${binding}><p class="body" :data-variant="undefined"/></template></div></template>`,
        'vue'
      )
      assert.ok(result.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'))
    }
    const local = await both(
      '<script setup>const undefined = value</script><template><div class="card-list" :data-variant="undefined"/></template>',
      'vue'
    )
    assert.ok(local.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'))
    const typed = await both(
      '<script setup lang="ts">import type cx from "clsx"</script><template><div :class="cx(\'card-list\')"/></template>',
      'vue'
    )
    assert.ok(typed.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
  })
})
