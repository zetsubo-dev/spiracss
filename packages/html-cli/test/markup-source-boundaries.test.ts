import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { lintMarkup } from '../src/markup'
import { completeDiagnostic } from '../src/markup/repair'
import { SourceIndex } from '../src/markup/source'

describe('finite binding and truthful diagnostic boundaries', () => {
  it('counts runtime import aliases without treating type-only imports as values', async () => {
    for (const [declaration, unknown] of [
      ['import undefined from "./value"', true],
      ['import {value as undefined} from "./value"', true],
      ['import type {value as undefined} from "./value"', false],
      ['', false]
    ] as const) {
      const source = `<script setup lang="ts">${declaration}</script><template><div class="card-list" :data-variant="undefined"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(
        result.native.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED'),
        unknown
      )
    }
  })
  it('gives only proven unbound class undefined the same branches as null', async () => {
    for (const format of ['jsx', 'vue', 'astro'] as const) {
      const markup = (value: string) =>
        format === 'jsx'
          ? `function Card(){return <div className="card-list"><p className={ok?"title":${value}}/></div>}`
          : format === 'vue'
            ? `<template><div class="card-list"><p :class="ok?'title':${value}"/></div></template>`
            : `<div class="card-list"><p class={ok?'title':${value}}/></div>`
      const absent = await lintBothEntries(markup('undefined'), format),
        nil = await lintBothEntries(markup('null'), format)
      assertEntryParity(markup('undefined'), absent)
      assert.deepStrictEqual(
        absent.native.errors.map((issue) => [issue.code, issue.condition]),
        nil.native.errors.map((issue) => [issue.code, issue.condition])
      )
      assert.ok(!absent.native.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    }
    const source =
      'function Card(undefined){return <div className="card-list"><p className={ok?"title":undefined}/></div>}'
    const result = await lintBothEntries(source, 'jsx')
    assertEntryParity(source, result)
    assert.ok(result.native.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
  })
  it('omits unproven file positions but preserves real offset0, EOF and zero-width evidence', () => {
    for (const parsers of [
      {},
      {
        html: {
          available: true as const,
          parse: () => {
            throw new Error('runtime unavailable')
          }
        }
      }
    ]) {
      const issue = lintMarkup('<div/>', { format: 'html', mode: 'root', config: {}, parsers }).errors[0]
      const json = JSON.parse(JSON.stringify(issue))
      assert.ok(!('range' in json) && !('position' in json))
    }
    for (const sourceRange of [
      [0, 0],
      [0, 1],
      [6, 6]
    ] as Array<[number, number]>) {
      const issue = lintMarkup('<div/>', {
        format: 'html',
        mode: 'root',
        config: {},
        parsers: {
          html: {
            available: true,
            parse: () => {
              throw Object.assign(new SyntaxError('source failure'), { sourceRange })
            }
          }
        }
      }).errors[0]
      assert.deepStrictEqual(issue.range, sourceRange)
    }
  })
  it('keeps six supplied rawtext boundary losses non-pass without asking users to fix valid text', async () => {
    for (const format of ['html', 'webc'] as const)
      for (const tag of ['textarea', 'iframe', 'title']) {
        const source = `<div class="card-list"><${tag} class="field"><b class="x"></${tag}><span class="Bad_Name"></span></div>`
        const result = await lintBothEntries(source, format)
        assert.ok(result.native.errors.some((issue) => issue.code === 'INVALID_BASE_CLASS'))
        const issue = result.host.messages.find((message) => message.messageId === 'SOURCE_RELATION_UNRESOLVED')
        assert.ok(issue, source + JSON.stringify(result.host.messages))
        assert.ok(/supplied.*AST/i.test(issue.message) && /native CLI/i.test(issue.message))
        assert.ok(!/Restore the local source nesting|Place exactly one/.test(issue.message))
        for (const text of ['<b class="x"></b>', '<b class="x"></textareaX>']) {
          const closed = `<div class="card-list"><${tag} class="field">${text}</${tag}></div>`
          const valid = await lintBothEntries(closed, format)
          assertEntryParity(closed, valid)
          assert.strictEqual(valid.native.status, 'pass')
        }
        const eof = `<div class="card-list"><${tag} class="field"><b class="x">opaque until EOF`
        const opaque = await lintBothEntries(eof, format)
        assert.strictEqual(opaque.host.messages.length, 0, eof)
        assert.strictEqual(opaque.native.errors.length, 0, eof)
      }
  })
  it('uses dedicated blocked repair and respects ASCII-case-insensitive hidden values', async () => {
    for (const code of ['MAX_DEPTH_EXCEEDED', 'FORMAT_UNSUPPORTED', 'PARSER_UNAVAILABLE'] as const) {
      const issue = completeDiagnostic(
        { code, message: 'cannot inspect', baseClass: '', path: [], range: [0, 1] },
        {},
        new SourceIndex('x')
      )
      assert.strictEqual(issue.kind, 'unsupported')
      assert.ok(!issue.repair?.conditions.some((condition) => /Place exactly one|Additional classes/.test(condition)))
      if (code === 'MAX_DEPTH_EXCEEDED')
        assert.ok(issue.repair?.conditions.some((condition) => /simplif/i.test(condition)))
    }
    for (const type of ['hidden', 'HIDDEN', 'HiDdEn']) {
      const source = `<div class="card-list"><input type="${type}"></div>`
      const result = await lintBothEntries(source, 'html')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
    }
  })
  it('follows TS parameter-property bindings locally in Babel and ESTree', async () => {
    const source =
      'import cx from "clsx";class View{constructor(private cx){const item=<div className={cx("card-list")}/>}}function Card(){return <div className={cx("hero-panel")}/>};'
    const result = await lintBothEntries(source, 'tsx')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.errors.filter((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED').length, 1)
  })
})
