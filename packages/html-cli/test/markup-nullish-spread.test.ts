import assert from 'assert'
import os from 'os'
import { describe, it } from 'mocha'
import { generateFromMarkupDocument, type GeneratorOptions } from '../src/generator-core'
import { loadMarkupParsers, type MarkupFormat } from '../src/markup'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'

const observable = (result: Awaited<ReturnType<typeof lintBothEntries>>) => ({
  status: result.native.status,
  coverage: result.native.coverage,
  errors: result.native.errors.map((issue) => [issue.code, issue.baseClass, issue.path, issue.condition])
})
const both = async (source: string, format: MarkupFormat) => {
  const result = await lintBothEntries(source, format)
  assertEntryParity(source, result)
  return result
}
const generationOptions: GeneratorOptions = {
  globalScssModule: '@styles/partials/global',
  pageEntryPrefix: '@assets/css',
  childScssDir: 'scss',
  layoutMixins: []
}

describe('JSX and Astro effective nullish spread attributes', () => {
  for (const format of ['jsx', 'astro'] as const) {
    const classKey = format === 'jsx' ? 'className' : 'class'
    const wrap = (markup: string, shadowed = false) =>
      format === 'jsx'
        ? `${shadowed ? 'const undefined="shadowed";' : ''}const view=${markup}`
        : `${shadowed ? '---\nconst undefined="shadowed";\n---\n' : ''}${markup}`
    const nativeMarkup = (spread: string) =>
      `<div ${classKey}="card-list" data-variant="compact"${spread ? ` {...${spread}}` : ''} data-state="open"><span ${classKey}="Bad_Name"/></div>`

    for (const spread of ['', 'null', 'undefined', 'open', 'shadowed-undefined'])
      it(`${format} native ${spread || 'omitted'} retains diagnostics and uncertainty`, async () => {
        const source = wrap(
          nativeMarkup(spread === 'shadowed-undefined' ? 'undefined' : spread),
          spread === 'shadowed-undefined'
        )
        const result = await both(source, format)
        const invalid = result.native.errors.find((issue) => issue.code === 'INVALID_BASE_CLASS')
        assert.ok(invalid, JSON.stringify(result.native.errors))
        assert.strictEqual(source.slice(...invalid.range!), 'Bad_Name')
        const noop = !spread || spread === 'undefined' || (spread === 'null' && format === 'jsx')
        if (noop) {
          const omitted = await both(wrap(nativeMarkup('')), format)
          assert.deepStrictEqual(observable(result), observable(omitted))
          assert.deepStrictEqual(
            result.native.errors.map((issue) => issue.code),
            ['INVALID_BASE_CLASS']
          )
        } else {
          assert.ok(result.native.coverage.unresolved > 0)
          const transfer = `{...${spread === 'shadowed-undefined' ? 'undefined' : spread}}`
          assert.ok(result.native.errors.some((issue) => source.slice(...issue.range!) === transfer))
        }
      })

    for (const [label, attributes, shadowed, count] of [
      ['static', `${classKey}="card-list"`, false, 0],
      ['dynamic-class', `${classKey}={styles}`, false, 1],
      ['unknown-props', `${classKey}="card-list" {...props}`, false, 1],
      ['null', `${classKey}="card-list" {...null}`, false, 0],
      ['undefined', `${classKey}="card-list" {...undefined}`, false, 0],
      ['empty-object', `${classKey}="card-list" {...{}}`, false, 0],
      ['shadowed-undefined', `${classKey}="card-list" {...undefined}`, true, 1]
    ] as const)
      it(`${format} component ${label} reports only genuine forwarding coverage`, async () => {
        const source = wrap(`<Card ${attributes}/>`, shadowed)
        const result = await both(source, format)
        assert.strictEqual(result.native.coverage.outOfScope, count)
        assert.deepStrictEqual(result.native.errors, [])
        assert.deepStrictEqual(result.host.messages, [])
      })

    for (const spread of format === 'jsx' ? ['null', 'undefined'] : ['undefined'])
      it(`${format} ${spread} preserves input type, explicit children and generator output`, async () => {
        const parsers = await loadMarkupParsers([format])
        const parser = parsers[format]!
        assert.ok(parser.available)
        if (!parser.available) throw new Error(parser.reason)
        for (const markup of [
          '<input {...NOOP}/>',
          '<input type="hidden" {...NOOP}/>',
          `<div ${classKey}="card-list" children={<span ${classKey}="body"/>} {...NOOP}/>`,
          `<div ${classKey}="card-list" data-variant="compact" {...NOOP} data-state="open"><span ${classKey}="body"/></div>`
        ]) {
          const source = wrap(markup.replace('NOOP', spread))
          const omittedSource = wrap(markup.replace(' {...NOOP}', ''))
          const result = await both(source, format)
          const omitted = await both(omittedSource, format)
          assert.deepStrictEqual(observable(result), observable(omitted), source)
          const generate = (input: string) =>
            generateFromMarkupDocument(parser.parse(input, 'root', {}), os.tmpdir(), true, generationOptions)
          if (markup.startsWith('<input')) {
            const expected = { message: 'No source Block is available for SCSS generation.' }
            assert.throws(() => generate(source), expected)
            assert.throws(() => generate(omittedSource), expected)
          } else assert.deepStrictEqual(generate(source), generate(omittedSource))
        }
      })
  }

  for (const spread of ['null', 'undefined'])
    it(`JSX ${spread} preserves optional clsx utilities in either attribute position`, async () => {
      const utilities = Array.from({ length: 9 }, (_, i) => `'u-flag${i}':flag${i}`).join(',')
      const className = `className={clsx('card-list',{${utilities}})}`
      const wrap = (attributes: string) => `import clsx from 'clsx';const view=<div ${attributes}/>`
      const omittedSource = wrap(className)
      const omitted = await both(omittedSource, 'jsx')
      assert.strictEqual(omitted.native.status, 'pass')
      const parsers = await loadMarkupParsers(['jsx'])
      const parser = parsers.jsx!
      assert.ok(parser.available)
      if (!parser.available) throw new Error(parser.reason)
      for (const attributes of [`${className} {...${spread}}`, `{...${spread}} ${className}`]) {
        const source = wrap(attributes)
        const result = await both(source, 'jsx')
        assert.deepStrictEqual(observable(result), observable(omitted))
        assert.deepStrictEqual(result.host.messages, [])
        assert.deepStrictEqual(
          generateFromMarkupDocument(parser.parse(source, 'root', {}), os.tmpdir(), true, generationOptions),
          generateFromMarkupDocument(parser.parse(omittedSource, 'root', {}), os.tmpdir(), true, generationOptions)
        )
      }
    })

  it('retains function-parameter shadowing of JSX undefined', async () => {
    for (const tag of ['div', 'Card']) {
      const source = `function View(undefined){return <${tag} className="card-list" {...undefined}/>}`
      const result = await both(source, 'jsx')
      if (tag === 'Card') assert.strictEqual(result.native.coverage.outOfScope, 1)
      else
        assert.ok(
          result.native.errors.some(
            (issue) => issue.code === 'DYNAMIC_CLASS_UNRESOLVED' && source.slice(...issue.range!) === '{...undefined}'
          )
        )
    }
  })
})
