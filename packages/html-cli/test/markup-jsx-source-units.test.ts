import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import { plugin, diagnosticMessage } from '../src/eslint'
import { lintMarkup, loadMarkupParsers, type MarkupConfig } from '../src/markup'

const run = async (source: string, config: MarkupConfig = {}, mode: 'root' | 'selection' = 'root') =>
  lintMarkup(source, { format: 'tsx', mode, config, parsers: await loadMarkupParsers(['tsx']) })
async function matched(source: string) {
  const native = await run(source)
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.jsx'],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { spiracss: plugin },
        rules: { 'spiracss/markup': ['error', { config: {}, format: 'jsx' }] }
      }
    ] as never
  })
  const host = (await eslint.lintText(source, { filePath: 'review.jsx' }))[0]
  const sort = (values: unknown[][]) => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  assert.deepStrictEqual(
    sort(host.messages.map((message) => [message.messageId, message.message, message.column, message.endColumn])),
    sort(
      native.errors.map((issue) => [
        issue.code,
        diagnosticMessage(issue),
        issue.position?.column,
        issue.position?.endColumn
      ])
    )
  )
  return native
}

describe('JSX attributes, source units and selection', () => {
  it('evaluates known object reserved values in overwrite order', async () => {
    for (const attributes of [
      '{...{"data-variant":"Bad_Name"}}',
      'data-variant="small" {...{"data-variant":"Bad_Name"}}'
    ]) {
      const result = await matched(`function Card(){return <div className="card-list" ${attributes}/>}`)
      assert.ok(result.errors.some((issue) => issue.code === 'INVALID_VARIANT_VALUE'))
    }
    const result = await matched(
      'function Card(){return <div className="card-list" data-variant="Bad_Name" {...{"data-variant":"small"}}/>}'
    )
    assert.strictEqual(result.status, 'pass')
  })

  it('distinguishes earlier possibly-overwritten values and definite later values', async () => {
    const earlier = await matched(
      'function Card(p){return <div className="card-list" data-variant="Bad_Name" {...p}/>}'
    )
    assert.ok(
      earlier.errors.some((issue) => issue.code === 'SOURCE_RELATION_UNRESOLVED' && issue.kind === 'unresolved')
    )
    assert.ok(!earlier.errors.some((issue) => issue.code === 'INVALID_VARIANT_VALUE'))
    const later = await matched('function Card(p){return <div {...p} className="card-list" data-variant="Bad_Name"/>}')
    assert.ok(later.errors.some((issue) => issue.code === 'INVALID_VARIANT_VALUE'))
    assert.strictEqual((await matched('function Card(p){return <div {...p} className="card-list"/>}')).status, 'pass')
  })

  it('keeps component props out of scope and does not turn an uncertain owner into a child violation', async () => {
    const component = await matched('function Card(p){return <Item {...p}/>}')
    assert.strictEqual(component.status, 'pass')
    assert.ok(component.coverage.outOfScope > 0)
    const native = await matched(
      'function Card(p){return <section className="card-list" {...p}><p className="title"/></section>}'
    )
    assert.ok(native.errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'))
    assert.ok(!native.errors.some((issue) => issue.code === 'ELEMENT_WITHOUT_BLOCK_ANCESTOR'))
  })

  it('inspects native children in place and component attribute JSX as detached source units', async () => {
    const native = await matched(
      'function Card(){return <div className="card-list" children={<p className="body"><section className="hero-panel"/></p>}/>}'
    )
    assert.ok(native.errors.some((issue) => issue.code === 'ELEMENT_PARENT_OF_BLOCK'))
    const detached = await matched(
      'function Card(){return <Tabs icon={<span className="Bad_Name"/>} render={()=><p className="Bad_Two"/>}/>}'
    )
    assert.strictEqual(detached.errors.filter((issue) => issue.code === 'INVALID_BASE_CLASS').length, 2)
    assert.ok(detached.coverage.outOfScope >= 2)
    assert.ok(!detached.errors.some((issue) => issue.code === 'ROOT_NOT_BLOCK'))
  })

  it('propagates SVG/MathML and restores HTML rules in integration points', async () => {
    const svg = await matched(
      'function Card(){return <div className="card-list"><svg className="icon"><path/><circle/></svg><math className="formula"><mrow><mi>x</mi></mrow></math></div>}'
    )
    assert.strictEqual(svg.status, 'pass')
    const html = await matched(
      'function Card(){return <div className="card-list"><svg className="icon"><foreignObject><div/></foreignObject></svg></div>}'
    )
    assert.ok(html.errors.some((issue) => issue.code === 'CLASSLESS_TAG_NOT_ALLOWED' && issue.baseClass === 'div'))
  })

  it('rescues only explicit sibling selections and counts both parser attempts', async () => {
    const source = '<section className="card-list"/>\r\n<section className="hero-panel Bad_Name"/>'
    const result = await run(source, {}, 'selection')
    const issue = result.errors.find((entry) => entry.code === 'UNCLASSIFIED_CLASS_TOKEN')!
    assert.strictEqual(source.slice(...issue.range!), 'Bad_Name')
    assert.strictEqual(issue.position?.line, 2)
    assert.strictEqual(result.metrics.markupParses, 2)
    assert.strictEqual((await run(source)).status, 'blocked')
    for (const invalid of ['<A/><B/>;doWork()', 'const f=()=> <A/><B/>'])
      assert.strictEqual((await run(invalid, {}, 'selection')).status, 'blocked')
    const generic = await run('const f = <T,>(x:T)=>x', {}, 'selection')
    assert.strictEqual(generic.status, 'pass')
    assert.strictEqual(generic.metrics.markupParses, 1)
  })
})
