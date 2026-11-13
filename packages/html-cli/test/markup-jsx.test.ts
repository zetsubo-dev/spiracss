import assert from 'assert'
import { before, describe, it } from 'mocha'
import { lintMarkup, loadMarkupParsers, type MarkupParsers } from '../src/markup'

describe('formal JSX/TSX source semantics', () => {
  let parsers: MarkupParsers
  before(async () => {
    parsers = await loadMarkupParsers(['jsx', 'tsx'])
  })
  const run = (source: string) => lintMarkup(source, { format: 'tsx', mode: 'root', config: {}, parsers })

  it('handles TSX generics, separate functions, exclusive roots, and scalar class alternatives', () => {
    for (const source of [
      'function A(){useState<string>("");return <div className="card-list"/>} function B(){return <div className="hero-panel"/>}',
      'function A({ok}){return ok ? <div className="card-list"/> : <div className="hero-panel"/>}',
      'function A({ok}){return <div className={ok ? "card-list" : "hero-panel"}/>}',
      'function A(){return <div className="card-list"><span className="icon"/><section className="hero-panel"/></div>}'
    ])
      assert.strictEqual(run(source).status, 'pass', JSON.stringify(run(source).errors))
  })

  it('links the supported single const child without inventing a second root', () => {
    const source =
      'function Card(){const title=<h2 className="title"/>;return <div className="card-list">{title}</div>}'
    assert.strictEqual(run(source).status, 'pass', JSON.stringify(run(source).errors))
  })

  it('does not make map callbacks into component roots', () => {
    const source =
      'function Card({items}){return <div className="card-list">{items.map(item=><p className="title"/>)}</div>}'
    assert.strictEqual(run(source).status, 'pass', JSON.stringify(run(source).errors))
  })

  it('does not lose visible class literals in arrays or logical fallback children', () => {
    for (const children of ['[<p className="body Bad_Name"/>]', 'value || <p className="body Bad_Name"/>']) {
      const result = run(`function Card({value}){return <div className="card-list">{${children}}</div>}`)
      assert.ok(
        result.errors.some((issue) => issue.code === 'UNCLASSIFIED_CLASS_TOKEN'),
        JSON.stringify(result.errors)
      )
    }
  })

  it('keeps correlated parent/child branches and conditional proven violations', () => {
    const valid =
      'function A({ok}){return <div className="root-block"><section className={ok ? "card-list" : "body"}>{ok ? <div className="hero-panel"/> : <p className="title"/>}</section></div>}'
    assert.strictEqual(run(valid).status, 'pass', JSON.stringify(run(valid).errors))
    const invalid =
      'function A({ok}){return <div className="root-block"><section className={ok ? "body" : "card-list"}>{ok ? <div className="hero-panel"/> : <p className="title"/>}</section></div>}'
    const issue = run(invalid).errors.find((entry) => entry.code === 'ELEMENT_PARENT_OF_BLOCK')
    assert.ok(issue?.condition?.includes('ok'), JSON.stringify(run(invalid).errors))
  })

  it('distinguishes raw array/object scalar props from recognized imported helpers', () => {
    for (const value of ['["card-list"]', '{"card-list":true}', 'cn("card-list")', '`card-${size}`']) {
      assert.ok(
        run(`function A(){return <div className={${value}}/>}`).errors.some(
          (issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'
        )
      )
    }
    assert.strictEqual(
      run('import clsx from "clsx";function Card(){return <div className={clsx("card-list")}/>}').status,
      'pass'
    )
    for (const prefix of ['const {clsx}=helpers;', 'const {rename:clsx}=helpers;', 'function clsx(){}']) {
      assert.ok(
        run(
          `import clsx from "clsx";function Card(){${prefix}return <div className={clsx("card-list")}/>} `
        ).errors.some((issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED')
      )
    }
    assert.ok(
      run('import clsx from "clsx";function Card({clsx}){return <div className={clsx("card-list")}/>}').errors.some(
        (issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED'
      )
    )
    assert.strictEqual(
      run(
        'import clsx from "clsx";function Other(clsx){clsx=1;}function Card(){return <div className={clsx("card-list")}/>}'
      ).status,
      'pass'
    )
  })

  it('preserves spread overwrite order and precise unresolved ranges', () => {
    assert.strictEqual(run('function A(p){return <div {...p} className="card-list"/>}').status, 'pass')
    const source = 'function A(p){return <div className="card-list" {...p}/>}'
    const issue = run(source).errors.find((entry) => entry.code === 'DYNAMIC_CLASS_UNRESOLVED')!
    assert.strictEqual(source.slice(...issue.range!), '{...p}')
  })

  it('blocks adjacent JSX with an original syntax position and rejects multiple fragment roots', () => {
    const syntax = run('<div className="card-list"/><div className="hero-panel"/>')
    assert.strictEqual(syntax.status, 'blocked')
    assert.strictEqual(syntax.errors[0].code, 'PARSE_ERROR')
    assert.ok(syntax.errors[0].range![0] > 0)
    assert.ok(
      run('function A(){return <><div className="card-list"/><div className="hero-panel"/></>}').errors.some(
        (issue) => issue.code === 'MULTIPLE_ROOT_ELEMENTS'
      )
    )
  })
})
