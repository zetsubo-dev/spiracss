import assert from 'assert'
import { ESLint } from 'eslint'
import * as tsParser from '@typescript-eslint/parser'
import { before, describe, it } from 'mocha'
import { plugin } from '../src/eslint'
import { generateFromMarkupDocument, type GeneratorOptions } from '../src/generator-core'
import { lintMarkup, loadMarkupParsers, type MarkupParsers } from '../src/markup'

describe('JSX and TSX root coexistence', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['jsx', 'tsx'])
  })
  const exclusiveArray = '[flag && <div className="product-card"/>, !flag && <div className="other-card"/>]'
  const exclusiveFragment = '<>{flag && <div className="product-card"/>}{!flag && <div className="other-card"/>}</>'
  const view = (expression: string) => `export default function View({flag}) { return ${expression} }`

  for (const format of ['jsx', 'tsx'] as const) {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: [`**/*.${format}`],
          languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } }
          },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config: {}, format, mode: 'root' }] }
        }
      ]
    })

    for (const entry of ['native', 'eslint'] as const) {
      describe(`${format} ${entry}`, () => {
        const diagnostics = async (expression: string) => {
          const source = view(expression)
          if (entry === 'native') {
            const result = lintMarkup(source, { format, mode: 'root', config: {}, parsers })
            assert.notStrictEqual(result.status, 'blocked', JSON.stringify(result.errors))
            assert.strictEqual(result.status, result.errors.length ? 'failed' : 'pass')
            return result.errors.map((issue) => ({ code: issue.code, range: issue.range, message: issue.message }))
          }
          const [result] = await eslint.lintText(source, { filePath: `root-coexistence.${format}` })
          assert.strictEqual(result.fatalErrorCount, 0, JSON.stringify(result.messages))
          return result.messages.map((issue) => {
            assert.strictEqual(issue.ruleId, 'spiracss/markup')
            assert.strictEqual(issue.line, 1)
            assert.strictEqual(issue.endLine, 1)
            assert.ok(issue.endColumn)
            return { code: issue.messageId, range: [issue.column - 1, issue.endColumn - 1], message: issue.message }
          })
        }

        it('accepts mutually exclusive array roots', async () => {
          assert.deepStrictEqual(await diagnostics(exclusiveArray), [])
        })

        it('accepts the equivalent mutually exclusive Fragment roots', async () => {
          assert.deepStrictEqual(await diagnostics(exclusiveFragment), [])
        })

        for (const [name, expression] of [
          ['two coexisting array roots', '[<div className="product-card"/>, <div className="other-card"/>]'],
          [
            'three array roots with a coexisting pair',
            '[flag && <div className="product-card"/>, !flag && <div className="other-card"/>, <div className="third-card"/>]'
          ]
        ]) {
          it(`rejects ${name} at the original array range`, async () => {
            const issues = await diagnostics(expression)
            assert.deepStrictEqual(
              issues.map(({ code, range }) => ({ code, range })),
              [{ code: 'MULTIPLE_ROOT_ELEMENTS', range: [46, 46 + expression.length] }]
            )
            assert.ok(issues[0].message.startsWith('Root array contains multiple source elements.'))
          })
        }

        it('preserves coexisting Fragment diagnostics and their original range', async () => {
          const expression = '<><div className="product-card"/><div className="other-card"/></>'
          const issues = await diagnostics(expression)
          assert.deepStrictEqual(
            issues.map(({ code, range }) => ({ code, range })),
            [{ code: 'MULTIPLE_ROOT_ELEMENTS', range: [46, 46 + expression.length] }]
          )
          assert.ok(issues[0].message.startsWith('Root Fragment contains multiple coexisting source elements.'))
        })
      })
    }

    it(`${format} generates the same Blocks for exclusive arrays and Fragments`, () => {
      const parser = parsers[format]
      assert.ok(parser?.available)
      if (!parser?.available) throw new Error('JSX or TSX parser is unavailable.')
      const options: GeneratorOptions = {
        globalScssModule: '@styles/partials/global',
        pageEntryPrefix: '@assets/css',
        childScssDir: 'scss',
        layoutMixins: [],
        naming: {},
        selectorPolicy: { variant: { mode: 'class' }, state: { mode: 'class' } }
      }
      const generate = (expression: string) => {
        const source = view(expression)
        const result = lintMarkup(source, { format, mode: 'root', config: {}, parsers })
        assert.strictEqual(result.status, 'pass', JSON.stringify(result.errors))
        return generateFromMarkupDocument(parser.parse(source, 'root', {}), '/tmp/jsx-root-coexistence', true, options)
      }
      const files = generate(exclusiveArray)
      assert.strictEqual(files.length, 2)
      assert.deepStrictEqual(files, generate(exclusiveFragment))
    })
  }
})
