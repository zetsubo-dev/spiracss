import assert from 'assert'
import { describe, it } from 'mocha'
import { parseExpression } from '@babel/parser'
import { ESLint } from 'eslint'
import { plugin } from '../src/eslint'
import { createMarkupRuleContext, generateFromMarkupDocument } from '../src/generator-core'
import { lintMarkup, loadMarkupParsers, type MarkupConfig } from '../src/markup'
import { SourceIndex } from '../src/markup/source'
import { evaluateClassExpression, type ExpressionNode } from '../src/markup/expressions'
import { validateMarkup } from '../src/markup/validate'
import type { ClassAlternative, MarkupDocument } from '../src/markup/types'

const keys = (count: number) => Array.from({ length: count }, (_, i) => `"u-flag${i}":flag${i}`).join(',')
async function both(expression: string, config: MarkupConfig = {}, spread = '') {
  const source = `import cx from "clsx";function Card(${Array.from({ length: 32 }, (_, i) => 'flag' + i).join(',')}){return <div className={${expression}} ${spread}/>}`
  const native = lintMarkup(source, { format: 'jsx', mode: 'root', config, parsers: await loadMarkupParsers(['jsx']) })
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.jsx'],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { spiracss: plugin },
        rules: { 'spiracss/markup': ['error', { format: 'jsx', config }] }
      }
    ] as never
  })
  const host = (await eslint.lintText(source, { filePath: 'r2.jsx' }))[0]
  assert.deepStrictEqual(
    host.messages.map((message) => message.messageId).sort(),
    native.errors.map((issue) => issue.code).sort()
  )
  return native
}
function document(expression: string, config: MarkupConfig, optimize: boolean): MarkupDocument {
  const index = new SourceIndex(expression)
  const rules = createMarkupRuleContext(config)
  const classes = evaluateClassExpression(parseExpression(expression) as unknown as ExpressionNode, {
    index,
    offset: 0,
    scope: 'fixture',
    helpers: new Set(['cx']),
    members: undefined,
    ...(optimize ? { classifyBase: rules.classify, inertClassExtra: rules.inertClassExtra } : {})
  })
  return {
    roots: [
      {
        tag: 'div',
        range: [0, expression.length],
        openRange: [0, expression.length],
        attributes: [],
        classes,
        children: []
      }
    ],
    issues: [],
    index,
    outOfScope: 0
  }
}
const generation = { globalScssModule: '', pageEntryPrefix: '', childScssDir: 'scss', layoutMixins: [] }
const diagnostics = (doc: MarkupDocument, config: MarkupConfig) =>
  validateMarkup(doc, config, 'root').errors.map((issue) => [issue.code, issue.range])

describe('pre-product inert optional removal', () => {
  it('passes 9/16/32 utilities without constructing their Cartesian product and retains a conditional bad token', async () => {
    for (const count of [9, 16, 32]) {
      const result = await both(`cx("card-list",{${keys(count)}})`)
      assert.strictEqual(result.status, 'pass')
      assert.strictEqual(result.metrics.inertOptionalTokens, count)
      assert.ok(result.metrics.classExpressionProducts <= 3)
      const invalid = await both(`cx("card-list",{${keys(count)},"Bad_Name":bad})`)
      assert.strictEqual(invalid.errors[0].code, 'UNCLASSIFIED_CLASS_TOKEN')
      assert.ok(invalid.errors[0].condition?.includes('bad'))
    }
  })
  it('matches completed small enumeration for diagnostics, guards and generated file order/content', () => {
    const config: MarkupConfig = { selectorPolicy: { variant: { mode: 'class' }, state: { mode: 'class' } } }
    for (const expression of [
      `cx("card-list",{${keys(8)}})`,
      `cx("card-list",{${keys(7)},"Bad_Name":flag7})`,
      'cx("card-list",a&&"body",b&&"title")',
      'cx("card-list",a&&"Bad_Name",b&&"Bad_Name")',
      'cx("card-list",a&&"-large",b&&"-large")',
      'cx("card-list",a?"-a":"-b",b&&"-c")'
    ]) {
      const before = document(expression, config, false),
        after = document(expression, config, true)
      assert.deepStrictEqual(
        generateFromMarkupDocument(after, '/tmp/r2-enumeration', true, { ...generation, ...config }),
        generateFromMarkupDocument(before, '/tmp/r2-enumeration', true, { ...generation, ...config }),
        expression
      )
      const flags = expression.includes('flag') ? Array.from({ length: 8 }, (_, i) => 'flag' + i) : ['a', 'b']
      for (let assignment = 0; assignment < 2 ** flags.length; assignment++) {
        const select = (values: ClassAlternative[]) =>
          values
            .filter((value) =>
              Object.entries(value.guard).every(
                ([key, when]) =>
                  Boolean(assignment & (1 << flags.indexOf(key.slice(key.lastIndexOf(':') + 1)))) === when
              )
            )
            .map((value) => ({ ...value, guard: {} }))
        const sample = (doc: MarkupDocument): MarkupDocument => ({
          ...doc,
          roots: [{ ...doc.roots[0], classes: select(doc.roots[0].classes) }]
        })
        assert.deepStrictEqual(
          diagnostics(sample(after), config),
          diagnostics(sample(before), config),
          expression + ':' + assignment
        )
      }
    }
    const ordered = generateFromMarkupDocument(
      document('cx("card-list",a?"-a":"-b",b&&"-c")', config, true),
      '/tmp/r2-order',
      true,
      { ...generation, ...config }
    )[0].content
    assert.ok(ordered.indexOf('&.-a') < ordered.indexOf('&.-c') && ordered.indexOf('&.-c') < ordered.indexOf('&.-b'))
  })
  it('does not broaden removal across base changes, unknown spreads or effective modifier/external settings', async () => {
    for (const [expression, config, spread] of [
      [`cx({${keys(9)}},"card-list")`, {}, ''],
      [`cx("card-list",{${keys(9)}})`, { external: { classes: ['card-list'] } }, ''],
      [`cx("card-list",{${keys(9)}})`, { naming: { customPatterns: { modifier: /^u-flag\d+$/ } } }, ''],
      [`cx(ok?"card-list":"hero-panel",{${keys(9)}})`, {}, ''],
      [`cx("card-list",{${keys(9)}})`, {}, '{...props}']
    ] as Array<[string, MarkupConfig, string]>) {
      const result = await both(expression, config, spread)
      assert.strictEqual(result.metrics.inertOptionalTokens, 0)
      assert.notStrictEqual(result.status, 'pass')
    }
  })
})
