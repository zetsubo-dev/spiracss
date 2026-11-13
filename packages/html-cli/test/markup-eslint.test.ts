import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import { createMarkupEslintConfig, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers } from '../src/markup'
import type { MarkupConfig } from '../src/markup'
import { adaptHtmlAst } from '../src/markup/adapters/html-ast'
import { plugin } from '../src/eslint'
import * as tsParser from '@typescript-eslint/parser'
import * as vueParser from 'vue-eslint-parser'

describe('optional ESLint HTML/WebC host', () => {
  const lint = async (source: string, config: MarkupConfig, filePath = 'component.html') => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [createMarkupEslintConfig(config, htmlParser)] as never
    })
    return (await eslint.lintText(source, { filePath }))[0]
  }

  it('actually lints .html and .webc with the real flat config', async () => {
    const source = '<section class="card-list"><p class="title Bad_Name"></p></section>'
    const parsers = await loadMarkupParsers(['html'])
    const expected = lintMarkup(source, { format: 'html', mode: 'root', config: {}, parsers }).errors
    for (const file of ['component.html', 'component.webc']) {
      const result = await lint(source, {}, file)
      assert.strictEqual(result.errorCount, expected.length)
      assert.strictEqual(result.warningCount, 0)
      assert.deepStrictEqual(
        result.messages.map((message) => message.messageId),
        expected.map((issue) => issue.code)
      )
      assert.deepStrictEqual(
        result.messages.map((message) => message.message),
        expected.map(diagnosticMessage)
      )
      assert.deepStrictEqual(
        result.messages.map((message) => message.column),
        expected.map((issue) => issue.position!.column)
      )
      assert.deepStrictEqual(
        result.messages.map((message) => message.endColumn),
        expected.map((issue) => issue.position!.endColumn)
      )
    }
  })

  it('does not reparse a supplied HTML tree', () => {
    const source = '<div class="card-list"></div>'
    const ast = htmlParser.parseForESLint(source).ast
    const document = adaptHtmlAst(source, ast)
    assert.strictEqual(document.index.metrics.markupParses, 0)
    assert.strictEqual(document.index.metrics.expressionParses, 0)
  })

  it('keeps duplicate relevant HTML attributes non-pass using the supplied AST', async () => {
    for (const source of [
      '<div class="card-list" class="other-block"></div>',
      '<div class="card-list" data-variant="small" data-variant="Bad_Name"></div>'
    ]) {
      const result = await lint(source, {})
      const expected = lintMarkup(source, {
        format: 'html',
        mode: 'root',
        config: {},
        parsers: await loadMarkupParsers(['html'])
      }).errors
      assert.deepStrictEqual(
        result.messages.map((message) => message.messageId),
        expected.map((issue) => issue.code)
      )
      assert.deepStrictEqual(
        result.messages.map((message) => message.message),
        expected.map(diagnosticMessage)
      )
      assert.deepStrictEqual(
        result.messages.map((message) => [message.column! - 1, message.endColumn! - 1]),
        expected.map((issue) => issue.range)
      )
    }
  })

  it('normalizes the valid paragraph end implied by a following section without reparsing', async () => {
    const source =
      '<div class="root-block"><p class="body">Text<section class="card-list"><p class="title">Title</p></section></div>'
    assert.strictEqual((await lint(source, {})).errorCount, 0)
    const native = lintMarkup(source, {
      format: 'html',
      mode: 'root',
      config: {},
      parsers: await loadMarkupParsers(['html'])
    })
    assert.strictEqual(native.status, 'pass')
  })

  it('uses supplied Vue template binding variables for helper shadowing', async () => {
    const source =
      '<script setup>import clsx from "clsx"</script><template><div class="card-list"><p v-for="clsx in items" :class="clsx(\'body\')"/></div></template>'
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.vue'],
          languageOptions: { parser: vueParser },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config: {} }] }
        }
      ] as never
    })
    const result = (await eslint.lintText(source, { filePath: 'card.vue' }))[0]
    assert.ok(result.messages.some((message) => message.messageId === 'DYNAMIC_CLASS_UNRESOLVED'))
    const expected = lintMarkup(source, {
      format: 'vue',
      mode: 'root',
      config: {},
      parsers: await loadMarkupParsers(['vue'])
    })
    assert.deepStrictEqual(
      result.messages.map((message) => message.message),
      expected.errors.map(diagnosticMessage)
    )
  })

  it('keeps Vue dynamic binding keys unresolved in both AST entry points', async () => {
    const source = '<template><div class="card-list" v-bind:[key]="value"/></template>'
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.vue'],
          languageOptions: { parser: vueParser },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config: {} }] }
        }
      ] as never
    })
    const messages = (await eslint.lintText(source, { filePath: 'card.vue' }))[0].messages
    const expected = lintMarkup(source, {
      format: 'vue',
      mode: 'root',
      config: {},
      parsers: await loadMarkupParsers(['vue'])
    })
    assert.ok(expected.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    assert.deepStrictEqual(
      messages.map((message) => message.message),
      expected.errors.map(diagnosticMessage)
    )
  })

  it('does not mix alternating project naming configurations', async () => {
    const source = '<section class="C_Card"></section>'
    const custom: MarkupConfig = { naming: { customPatterns: { block: /^C_[A-Z][a-z]+$/ } } }
    assert.strictEqual((await lint(source, custom)).errorCount, 0)
    assert.ok((await lint(source, {})).errorCount > 0)
    assert.strictEqual((await lint(source, custom)).errorCount, 0)
  })

  it('uses the host ESTree JSX tree with matching conditional diagnostics', async () => {
    const source =
      'import clsx from "clsx";function Card({ok}){return <div className={ok ? "card-list Bad_Name" : "hero-panel"}/>;}'
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.jsx'],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config: {} }] }
        }
      ] as never
    })
    const result = (await eslint.lintText(source, { filePath: 'card.jsx' }))[0]
    const expected = lintMarkup(source, {
      format: 'jsx',
      mode: 'root',
      config: {},
      parsers: await loadMarkupParsers(['jsx'])
    })
    assert.strictEqual(result.errorCount, expected.errors.length)
    assert.deepStrictEqual(
      result.messages.map((message) => message.messageId),
      expected.errors.map((issue) => issue.code)
    )
    assert.deepStrictEqual(
      result.messages.map((message) => message.message),
      expected.errors.map(diagnosticMessage)
    )
  })

  it('matches supplied TSX, Vue and Astro expression ASTs without reparsing', async () => {
    const astroParser = await import('astro-eslint-parser')
    const cases = [
      {
        format: 'tsx' as const,
        parser: tsParser,
        source:
          'function Card({ok}:{ok:boolean}){return <div className="card-list"><p className={ok ? "body Bad_Name" : "title"}/></div>}'
      },
      {
        format: 'vue' as const,
        parser: vueParser,
        source: '<template><div class="card-list"><p :class="[\'body\', {\'Bad_Name\': ok}]"/></div></template>'
      },
      {
        format: 'astro' as const,
        parser: astroParser,
        source: '---\nconst ok=true;\n---\n<div class="card-list"><p class:list={["body", {"Bad_Name":ok}]}/></div>'
      }
    ]
    for (const fixture of cases) {
      const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: [
          {
            files: [`**/*.${fixture.format}`],
            languageOptions: { parser: fixture.parser },
            plugins: { spiracss: plugin },
            rules: { 'spiracss/markup': ['error', { config: {}, format: fixture.format }] }
          }
        ] as never
      })
      const result = (await eslint.lintText(fixture.source, { filePath: `card.${fixture.format}` }))[0]
      const expected = lintMarkup(fixture.source, {
        format: fixture.format,
        mode: 'root',
        config: {},
        parsers: await loadMarkupParsers([fixture.format])
      })
      assert.deepStrictEqual(
        result.messages.map((message) => message.messageId),
        expected.errors.map((issue) => issue.code),
        fixture.format + JSON.stringify(result.messages)
      )
      assert.deepStrictEqual(
        result.messages.map((message) => message.message),
        expected.errors.map(diagnosticMessage),
        fixture.format
      )
      assert.deepStrictEqual(
        result.messages.map((message) => [message.line, message.column, message.endLine, message.endColumn]),
        expected.errors.map((issue) => [
          issue.position!.line,
          issue.position!.column,
          issue.position!.endLine,
          issue.position!.endColumn
        ]),
        fixture.format
      )
    }
  })
})
