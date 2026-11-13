import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import { plugin, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

describe('portable Astro source bridge', () => {
  it('matches the current supplied-AST host across source ranges and actual Astro attribute meaning', async () => {
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
    const parsers = await loadMarkupParsers(['astro'])
    for (const source of [
      '<div class="card&#45;list"><p class="body Bad&#95;Name"/></div>',
      '<div class=card-list><p class=body /></div>',
      '<div class:list={["u-extra"]} class="card-list"><p class="body"/></div>',
      '---\r\nconst label="日本😀"\r\n---\r\n<div class="card-list">日本😀<p class:list={["body Bad_Name"]}/></div>',
      '---\nimport clsx from "clsx"\n---\n<div class="card-list">{items.map(clsx => <p class={clsx("body")}/>)}</div>',
      '<div class="card-list" {...p}/>',
      '<div {...p} class="card-list"/>',
      '<Item {...p}/>',
      '<div class="card-list"><svg class="icon"><path/></svg><slot/></div>',
      '<Fragment><div class="card-list"/></Fragment>',
      '<div class="card-list" class:list={{"u-one":true}}><p class=`body`/></div>'
    ]) {
      const native = lintMarkup(source, { format: 'astro', mode: 'root', config: {}, parsers })
      const host = (await eslint.lintText(source, { filePath: 'review.astro' }))[0]
      const sort = (values: unknown[][]) => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      assert.deepStrictEqual(
        sort(
          host.messages.map((message) => [
            message.messageId,
            message.message,
            message.line,
            message.column,
            message.endLine,
            message.endColumn
          ])
        ),
        sort(
          native.errors.map((issue) => [
            issue.code,
            diagnosticMessage(issue),
            issue.position?.line,
            issue.position?.column,
            issue.position?.endLine,
            issue.position?.endColumn
          ])
        ),
        source
      )
      assert.strictEqual(native.metrics.astroConversions, 1)
      assert.strictEqual(native.metrics.generatedParses, 1)
      assert.ok(native.errors.every((issue) => issue.range![0] <= issue.range![1] && issue.range![1] <= source.length))
    }
  })
  it('separates resource/runtime failures from syntax and counts failed rescue attempts', async () => {
    const result = lintMarkup('<div/>', {
      format: 'astro',
      mode: 'root',
      config: {},
      parsers: {
        astro: {
          available: true,
          parse: () => {
            throw new Error('simulated runtime allocation failure')
          }
        }
      }
    })
    assert.strictEqual(result.status, 'blocked')
    assert.strictEqual(result.errors[0].code, 'PARSER_RUNTIME_ERROR')
    assert.strictEqual(result.errors[0].kind, 'unsupported')
    assert.ok(
      !result.errors[0].repair!.conditions.some((condition) =>
        condition.startsWith('Correct the reported source syntax')
      )
    )
    const syntax = lintMarkup('<A/><B/>;doWork()', {
      format: 'jsx',
      mode: 'selection',
      config: {},
      parsers: await loadMarkupParsers(['jsx'])
    })
    assert.strictEqual(syntax.errors[0].code, 'PARSE_ERROR')
    assert.strictEqual(syntax.metrics.markupParses, 2)
  })
})
