import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { loadMarkupParsers, type MarkupConfig, type MarkupFormat } from '../src/markup'
import { generateFromMarkupDocument } from '../src/generator-core'

async function generated(source: string, format: MarkupFormat = 'astro', config: MarkupConfig = {}) {
  const parser = (await loadMarkupParsers([format]))[format]!
  assert.ok(parser.available)
  return generateFromMarkupDocument(parser.parse(source, 'root', config), '/tmp/r6-generation', true, {
    globalScssModule: '',
    pageEntryPrefix: '',
    childScssDir: 'scss',
    layoutMixins: [],
    ...config
  } as Parameters<typeof generateFromMarkupDocument>[3])
}

describe('finite original-source and generation contract', () => {
  const fragments = [
    ['<div class="card-list"><><span class="title"/></><><p class="body"/></></div>', 'body'],
    ['<div class="card-list">\n<><span class="title">😀</span></>\n<><p class="body"/></>\n</div>', 'body'],
    ['<div class="card-list"><><span class="title"/></><span class="body"/></div>', 'body'],
    ['<div class="card-list"><><span class="title"/></><Foo/><br/><></></div>'],
    ['<div class="card-list">{ <> </> }</div>'],
    ['<div class="card-list"><><span class="title"/></><span class="body"/><><p class="body"/></></div>', 'body'],
    ['<><div class="card-list"/>text</>', 'card-list'],
    ['<><div class="card-list"/>{label}</>', 'card-list'],
    ['<><div class="card-list"></div>text</>', 'card-list'],
    ['<><div class="card-list"></div>{label}</>', 'card-list'],
    ['<div class="card-list"><><span class="title"/>text</></div>', 'title'],
    ['<div class="card-list"><><span class="title"></span>{label}</></div>', 'title'],
    ['---\n---\n<><><div class="card-list"/></></>'],
    ['---\r\nconst label="日本😀";\r\n---\r\n<><><div class="card-list"/></></>']
  ] as const
  for (const [number, [source, mutation]] of fragments.entries())
    it(`original order ${number + 1}`, async () => {
      const control = source.replace(/<>/g, '<Fragment>').replace(/<\/>/g, '</Fragment>')
      const positive = await lintBothEntries(source, 'astro'),
        positiveControl = await lintBothEntries(control, 'astro')
      assertEntryParity(source, positive)
      assertEntryParity(control, positiveControl)
      assert.strictEqual(positive.native.status, 'pass', source)
      assert.strictEqual(positiveControl.native.status, 'pass', control)
      const files = await generated(source)
      assert.ok(files.length > 0, source)
      assert.deepStrictEqual(files, await generated(control))
      if (mutation) {
        const token = `class="${mutation}"`
        assert.ok(source.includes(token), `Missing mutation token: ${token}`)
        const input = source.replace(token, 'class="Bad_Name"'),
          other = control.replace(token, 'class="Bad_Name"')
        assert.notStrictEqual(input, source)
        assert.notStrictEqual(other, control)
        const result = await lintBothEntries(input, 'astro'),
          expected = await lintBothEntries(other, 'astro')
        assertEntryParity(input, result)
        assertEntryParity(other, expected)
        assert.strictEqual(result.native.status, 'failed', input)
        assert.strictEqual(expected.native.status, 'failed', other)
        const start = input.indexOf('Bad_Name')
        assert.ok(
          result.native.errors.some(
            (e) => e.code === 'INVALID_BASE_CLASS' && e.range?.[0] === start && e.range[1] === start + 8
          ),
          input
        )
        assert.deepStrictEqual(
          result.native.errors
            .filter((e) => e.code === 'INVALID_BASE_CLASS')
            .map((e) => [e.code, e.range && input.slice(...e.range)]),
          expected.native.errors
            .filter((e) => e.code === 'INVALID_BASE_CLASS')
            .map((e) => [e.code, e.range && other.slice(...e.range)]),
          input
        )
      }
    })
  it('preserves exact post-fragment UTF-16 attribute ranges with or without whitespace', async () => {
    for (const separator of ['', ' ', '\r\n']) {
      const source = `<div class="card-list"><><span class="title">😀</span></>${separator}<span class="Bad_Name"/></div>`
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.ok(
        result.native.errors.some(
          (e) =>
            e.code === 'INVALID_BASE_CLASS' &&
            e.range?.[0] === source.indexOf('Bad_Name') &&
            e.range[1] === source.indexOf('Bad_Name') + 8
        )
      )
    }
  })
  it('top-level sibling fragments keep root/selection semantics, not unconditional pass', async () => {
    const source = '---\n---\n<><div class="card-list"/></><><div class="hero-panel"/></>'
    const control = source.replace(/<>/g, '<Fragment>').replace(/<\/>/g, '</Fragment>')
    for (const mode of ['root', 'selection'] as const) {
      const result = await lintBothEntries(source, 'astro', {}, mode),
        other = await lintBothEntries(control, 'astro', {}, mode)
      assertEntryParity(source, result)
      assertEntryParity(control, other)
      assert.strictEqual(result.native.status, mode === 'root' ? 'failed' : 'pass')
      assert.strictEqual(other.native.status, mode === 'root' ? 'failed' : 'pass')
      assert.deepStrictEqual(
        result.native.errors.map((e) => e.code),
        mode === 'root' ? ['MULTIPLE_ROOT_ELEMENTS'] : []
      )
      assert.deepStrictEqual(
        result.native.errors.map((e) => e.code),
        other.native.errors.map((e) => e.code)
      )
    }
  })
  it('keeps a dynamic data value after the corrected opening at its actual attribute range', async () => {
    const source = '<div class="card-list"><><span class="body"/></><span class="body" data-variant={variant}/></div>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.ok(
      result.native.errors.some(
        (e) => e.code === 'SOURCE_RELATION_UNRESOLVED' && e.range && source.slice(...e.range) === 'variant'
      )
    )
  })
  for (const source of [
    '{ <> }',
    '<div class="card-list"><><span class="body"/></div>',
    '<><><div class="card-list"/></>',
    '<div class="card-list"><><span class="body"/></span>'
  ]) {
    it(`negative complete fragment proof ${source}`, async () => {
      const { native, host } = await lintBothEntries(source, 'astro')
      assert.notStrictEqual(native.status, 'pass')
      assert.ok(host.errorCount > 0)
      await assert.rejects(() => generated(source))
    })
  }
  it('same-generated-body valid controls remain valid', async () => {
    for (const source of [
      '<><><div class="card-list"/></></>',
      '<div class="card-list"><><span class="body"/></></div>'
    ]) {
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.ok((await generated(source)).length)
    }
  })
  for (const format of ['tsx', 'jsx', 'vue', 'astro'] as const)
    for (const expression of ['open', 'String(open)']) {
      it(`${format} dynamic ARIA ${expression} is lint-valid, not enumerable`, async () => {
        const source =
          format === 'vue'
            ? `<template><button class="menu-button" :aria-expanded="${expression}"/></template>`
            : format === 'astro'
              ? `<button class="menu-button" aria-expanded={${expression}}/>`
              : `function Card({open}){return <button className="menu-button" aria-expanded={${expression}}/>}`
        const result = await lintBothEntries(source, format)
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, 'pass')
        assert.strictEqual(result.host.errorCount, 0)
        assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 1)
        assert.ok(!(await generated(source, format)).some((f) => f.content.includes('[aria-expanded')))
      })
    }
  for (const [format, attributes, expected, count] of [
    ['astro', '{...{"aria-expanded":maybe}} aria-expanded="true" aria-expanded="never"', ['true'], 1],
    ['tsx', 'aria-expanded="never" aria-expanded={maybe}', [], 1],
    ['vue', ':aria-expanded="\'never\'" v-bind="{\'aria-expanded\':maybe}"', [], 1],
    ['astro', 'aria-expanded="true" {...{"aria-expanded":maybe}}', ['true'], 0],
    ['tsx', '{...{"aria-expanded":maybe}} aria-expanded="true"', ['true'], 0],
    ['vue', 'v-bind="{\'aria-expanded\':maybe}" :aria-expanded="\'true\'"', ['true'], 0]
  ] as const)
    it(`reachable generation winners ${format} ${attributes}`, async () => {
      const source =
        format === 'vue'
          ? `<template><div class="card-list" ${attributes}/></template>`
          : format === 'astro'
            ? `<div class="card-list" ${attributes}/>`
            : `const card=<div className="card-list" ${attributes}/>`
      const result = await lintBothEntries(source, format)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.strictEqual(result.native.coverage.generationUnenumeratedSites, count)
      const files = await generated(source, format),
        contents = files.map((f) => f.content).join('\n')
      const known = expected.map((value) => `aria-expanded="${value}"`).join(' ')
      const control =
        format === 'vue'
          ? `<template><div class="card-list" ${known}/></template>`
          : format === 'astro'
            ? `<div class="card-list" ${known}/>`
            : `const card=<div className="card-list" ${known}/>`
      assert.deepStrictEqual(files, await generated(control, format))
      for (const value of ['true', 'never'])
        assert.strictEqual(
          contents.includes(`[aria-expanded="${value}"]`),
          expected.some((v) => v === value)
        )
    })
  it('counts element/key sites once across guards, classes and generated files using effective config', async () => {
    const config: MarkupConfig = { selectorPolicy: { state: { ariaKeys: ['aria-pressed'] } } }
    const source =
      '<div class="card-list"><button class:list={[x ? "body" : "title"]} aria-pressed={x?maybe:other}/><span class="body" aria-expanded={maybe}/></div>'
    const result = await lintBothEntries(source, 'astro', config)
    assertEntryParity(source, result)
    assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 1)
    assert.strictEqual(result.native.coverage.unresolved, 0)
    assert.strictEqual(result.native.status, 'pass')
    const absent = await lintBothEntries('<div class="card-list" aria-pressed={null}/>', 'astro', config)
    assert.strictEqual(absent.native.coverage.generationUnenumeratedSites, 0)
  })
  it('Vue direct component null is absent, not an unenumerated generation site', async () => {
    const source = '<template><Card class="card-list" :aria-expanded="null"/></template>'
    const result = await lintBothEntries(source, 'vue')
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.host.errorCount, 0)
    assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 0)
    assert.strictEqual(result.native.coverage.unresolved, 0)
    assertEntryParity(source, result)
    const files = await generated(source, 'vue')
    assert.ok(files.length > 0)
    assert.ok(!files.some((file) => file.content.includes('[aria-expanded')))
    assert.deepStrictEqual(files, await generated('<template><Card class="card-list"/></template>', 'vue'))
  })
  it('Vue direct native null agrees with ESLint and permits standalone generation', async () => {
    const source = '<template><div class="card-list" :data-variant="null"/></template>'
    const result = await lintBothEntries(source, 'vue')
    assert.strictEqual(result.host.errorCount, 0)
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.native.coverage.unresolved, 0)
    assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 0)
    assertEntryParity(source, result)
    const files = await generated(source, 'vue')
    assert.ok(files.length > 0)
    assert.ok(!files.some((file) => file.content.includes('[data-variant')))
    assert.deepStrictEqual(files, await generated('<template><div class="card-list"/></template>', 'vue'))
  })
  for (const binding of ['direct', 'object'] as const)
    for (const expression of ['null', 'undefined', 'true', 'open'])
      it(`V fallback ${binding} attribute ${expression} preserves absence, literals and unknown values`, async () => {
        for (const key of ['aria-expanded', 'data-variant']) {
          const attributes =
            binding === 'direct' ? `:${key}="${expression}"` : `v-bind="{'${key}':${expression}}"`
          const source = `<template><div class="card-list" ${attributes}/></template>`
          const result = await lintBothEntries(source, 'vue')
          assertEntryParity(source, result)
          const unresolved = expression === 'open' && key === 'data-variant'
          assert.strictEqual(result.native.status, unresolved ? 'failed' : 'pass', source)
          assert.strictEqual(result.host.errorCount, unresolved ? 1 : 0, source)
          assert.strictEqual(result.native.coverage.unresolved, unresolved ? 1 : 0, source)
          assert.strictEqual(
            result.native.coverage.generationUnenumeratedSites,
            expression === 'open' && key === 'aria-expanded' ? 1 : 0,
            source
          )
          if (unresolved) {
            assert.strictEqual(result.native.errors[0].code, 'SOURCE_RELATION_UNRESOLVED')
            assert.strictEqual(source.slice(...result.native.errors[0].range!), 'open')
          } else {
            const files = await generated(source, 'vue')
            assert.ok(files.length > 0, source)
            assert.strictEqual(
              files.some((file) => file.content.includes(`[${key}="true"]`)),
              expression === 'true',
              source
            )
            const control = `<template><div class="card-list"${expression === 'true' ? ` ${key}="true"` : ''}/></template>`
            assert.deepStrictEqual(files, await generated(control, 'vue'))
          }
        }
      })
  for (const directive of ['v-if', 'v-else-if'])
    for (const expression of ['null', 'undefined', 'true', 'open'])
      it(`V fallback ${directive} ${expression} keeps only reachable branch violations`, async () => {
        const prior = directive === 'v-else-if' ? '<span v-if="false" class="unused"/>' : ''
        const source = `<template><div class="card-list">${prior}<span ${directive}="${expression}" class="Bad_Name"/><span v-else class="body"/></div></template>`
        const result = await lintBothEntries(source, 'vue')
        assertEntryParity(source, result)
        if (expression === 'null' || expression === 'undefined') {
          assert.strictEqual(result.native.status, 'pass', source)
          assert.strictEqual(result.host.errorCount, 0)
          assert.deepStrictEqual(
            await generated(source, 'vue'),
            await generated('<template><div class="card-list"><span class="body"/></div></template>', 'vue')
          )
          const mutation = source.replace('class="body"', 'class="Bad_Name"')
          const invalid = await lintBothEntries(mutation, 'vue')
          assertEntryParity(mutation, invalid)
          assert.strictEqual(invalid.native.status, 'failed')
          assert.deepStrictEqual(
            invalid.native.errors.filter((issue) => issue.code === 'INVALID_BASE_CLASS').map((issue) => issue.range),
            [[mutation.lastIndexOf('Bad_Name'), mutation.lastIndexOf('Bad_Name') + 8]]
          )
        } else {
          assert.strictEqual(result.native.status, 'failed', source)
          assert.ok(
            result.native.errors.some(
              (issue) =>
                issue.code === 'INVALID_BASE_CLASS' &&
                issue.range?.[0] === source.indexOf('Bad_Name') &&
                issue.range[1] === source.indexOf('Bad_Name') + 8
            ),
            source
          )
        }
      })
  for (const expression of ['null', 'undefined', 'true', 'open']) {
    it(`V fallback direct class ${expression} distinguishes empty contributions from unknowns`, async () => {
      const source = `<template><div class="card-list" :class="${expression}"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, expression === 'open' ? 'failed' : 'pass', source)
      assert.strictEqual(result.native.coverage.unresolved, expression === 'open' ? 1 : 0)
      if (expression === 'open') {
        assert.strictEqual(result.native.errors[0].code, 'DYNAMIC_CLASS_UNRESOLVED')
        assert.strictEqual(source.slice(...result.native.errors[0].range!), 'open')
      } else {
        assert.deepStrictEqual(
          await generated(source, 'vue'),
          await generated('<template><div class="card-list"/></template>', 'vue')
        )
        const mutation = source.replace('class="card-list"', 'class="Bad_Name"')
        const invalid = await lintBothEntries(mutation, 'vue')
        assertEntryParity(mutation, invalid)
        assert.strictEqual(invalid.native.status, 'failed')
        assert.ok(invalid.native.errors.some((issue) => issue.code === 'INVALID_BASE_CLASS'))
      }
    })
    it(`V fallback object class ${expression} keeps truthy key violations`, async () => {
      const source = `<template><div class="card-list"><span class="body" :class="{'Bad_Name':${expression}}"/></div></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      const absent = expression === 'null' || expression === 'undefined'
      assert.strictEqual(result.native.status, absent ? 'pass' : 'failed', source)
      if (absent)
        assert.deepStrictEqual(
          await generated(source, 'vue'),
          await generated('<template><div class="card-list"><span class="body"/></div></template>', 'vue')
        )
      else {
        assert.deepStrictEqual(
          result.native.errors.map((issue) => [issue.code, issue.range]),
          [['UNCLASSIFIED_CLASS_TOKEN', [source.indexOf('Bad_Name'), source.indexOf('Bad_Name') + 8]]]
        )
      }
    })
    it(`V fallback whole v-bind ${expression} distinguishes absent and unknown props`, async () => {
      const source = `<template><div class="card-list" v-bind="${expression}"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      const absent = expression === 'null' || expression === 'undefined'
      assert.strictEqual(result.native.status, absent ? 'pass' : 'failed', source)
      assert.strictEqual(result.native.coverage.unresolved, absent ? 0 : 1)
      assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 0)
      if (absent) {
        assert.deepStrictEqual(result.native.errors, [])
        assert.deepStrictEqual(
          await generated(source, 'vue'),
          await generated('<template><div class="card-list"/></template>', 'vue')
        )
      } else {
        assert.strictEqual(result.native.errors[0].code, 'DYNAMIC_CLASS_UNRESOLVED')
        assert.strictEqual(source.slice(...result.native.errors[0].range!), `v-bind="${expression}"`)
      }
    })
  }
  for (const format of ['astro', 'jsx', 'vue'] as const) {
    const sourceFor = (attributes: string) =>
      format === 'vue'
        ? `<template><Card class="card-list" ${attributes}/></template>`
        : format === 'astro'
          ? `<Card class="card-list" ${attributes}/>`
          : `const view=<Card className="card-list" ${attributes}/>`
    it(`${format} counts explicit component ARIA unknowns and keeps static selector controls`, async () => {
      for (const [attributes, count, hasSelector] of [
        ['aria-expanded="true"', 0, true],
        [format === 'vue' ? ':aria-expanded="open"' : 'aria-expanded={open}', 1, false]
      ] as const) {
        const source = sourceFor(attributes),
          result = await lintBothEntries(source, format)
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, 'pass', source)
        assert.strictEqual(result.native.coverage.unresolved, 0)
        assert.strictEqual(result.native.coverage.generationUnenumeratedSites, count, source)
        const files = await generated(source, format)
        assert.ok(files.length > 0)
        assert.strictEqual(
          files.some((f) => f.content.includes('[aria-expanded="true"]')),
          hasSelector,
          source
        )
        if (!hasSelector) assert.ok(!files.some((f) => f.content.includes('[aria-expanded')))
      }
    })
    it(`${format} excludes whole props, nonconfigured keys, absence and defeated unknowns from the count`, async () => {
      for (const [attributes, config] of [
        [format === 'vue' ? 'v-bind="props"' : '{...props}', {}],
        [
          format === 'vue' ? ':aria-expanded="open"' : 'aria-expanded={open}',
          { selectorPolicy: { state: { ariaKeys: ['aria-pressed'] } } }
        ],
        [format === 'vue' ? 'v-bind="{\'aria-expanded\':null}"' : 'aria-expanded={null}', {}],
        [
          format === 'vue'
            ? 'v-bind="{\'aria-expanded\':open}" aria-expanded="true"'
            : '{...{"aria-expanded":open}} aria-expanded="true"',
          {}
        ]
      ] as Array<[string, MarkupConfig]>) {
        const source = sourceFor(attributes),
          result = await lintBothEntries(source, format, config)
        assertEntryParity(source, result)
        assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 0, source)
      }
    })
  }
})

import * as vueParser from 'vue-eslint-parser'
import { lintMarkup } from '../src/markup'
import { adaptVueAst } from '../src/markup/adapters/vue'
import { SourceIndex } from '../src/markup/source'

describe('Vue omitted bindings and supplied tag boundaries', () => {
  const missingReason =
    'Supplied Vue AST tag boundary is unresolved: the supplied tree ends this element without an explicit end tag (a missing end tag, or an HTML implied close such as a block element inside <p>).'
  const strayReason =
    'Supplied Vue AST tag boundary is unresolved: this end tag matches no open element in the supplied tree (a stray end tag, or its element was implicitly closed earlier).'
  const missingCondition =
    'Parent-child relationships and class names in this template were not checked using the supplied Vue AST. Check the original template with the native SpiraCSS CLI before making any edits. Do not change tags or class names based on the supplied tree alone.'
  const strayCondition =
    'Parent-child relationships and class names in this template were not checked using the supplied Vue AST. Check the original template with the native SpiraCSS CLI before making any edits. Do not change tags or class names based on the supplied tree alone.'
  const supplied = (source: string, config: MarkupConfig = {}) => {
    const parsed = vueParser.parseForESLint(source, { range: true, loc: true })
    return lintMarkup(source, {
      format: 'vue',
      mode: 'root',
      config,
      parsers: {
        vue: {
          available: true,
          parse: () => adaptVueAst(source, parsed.ast, 'root', config, parsed.services.getDocumentFragment())
        }
      }
    })
  }
  const hostRanges = (source: string, result: Awaited<ReturnType<typeof lintBothEntries>>) => {
    const index = new SourceIndex(source)
    return result.host.messages.map((message) => [
      message.messageId,
      [
        index.lineStarts[message.line - 1] + message.column - 1,
        index.lineStarts[(message.endLine ?? message.line) - 1] + (message.endColumn ?? message.column) - 1
      ]
    ])
  }
  for (const key of ['data-variant', 'data-state'])
    for (const classMode of [false, true])
      it(`omitted ${key} is unknown with original argument range, class mode ${classMode}`, async () => {
        const source = `<template>\n😀<div class="card-list" :${key}/></template>`
        const config: MarkupConfig = classMode
          ? { selectorPolicy: { variant: { mode: 'class' }, state: { mode: 'class' } } }
          : {}
        const result = await lintBothEntries(source, 'vue', config)
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, 'failed')
        assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.kind, issue.range]), [
          ['SOURCE_RELATION_UNRESOLVED', 'unresolved', [source.indexOf(key), source.indexOf(key) + key.length]]
        ])
        assert.strictEqual(result.native.metrics.expressionParses, 0)
        assert.strictEqual(supplied(source, config).metrics.expressionParses, 0)
      })
  it('omitted ARIA is pass with one unenumerated site and no generated selector', async () => {
    const source = '<template><div class="card-list" :aria-expanded/></template>'
    const result = await lintBothEntries(source, 'vue')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 1)
    assert.strictEqual(supplied(source).coverage.generationUnenumeratedSites, 1)
    const files = await generated(source, 'vue')
    assert.ok(files.length > 0)
    assert.ok(!files.some((file) => file.content.includes('[aria-expanded')))
  })
  it('omitted class without compiler expression stays unresolved at its argument', async () => {
    const source = '<template><div class="card-list" :class/></template>'
    const result = await lintBothEntries(source, 'vue')
    assertEntryParity(source, result)
    assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]), [
      ['DYNAMIC_CLASS_UNRESOLVED', [source.lastIndexOf('class'), source.lastIndexOf('class') + 5]]
    ])
    assert.strictEqual(result.native.metrics.expressionParses, 0)
  })
  for (const attributes of [
    'v-bind="{\'data-variant\':\'small\'}" :data-variant',
    ':data-variant v-bind="{\'data-variant\':\'small\'}"'
  ])
    it(`preserves ordered winners ${attributes}`, async () => {
      const source = `<template><div class="card-list" ${attributes}/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, attributes.startsWith(':') ? 'pass' : 'failed')
      if (attributes.startsWith(':')) {
        const files = await generated(source, 'vue')
        assert.ok(files.some((file) => file.content.includes('[data-variant="small"]')))
      }
    })
  it('retains a supplied absolute-offset-zero AST and its camelized identifier', () => {
    const source = '<template><div class="card-list" :data-variant/></template>'
    const parsed = vueParser.parseForESLint(source, { range: true, loc: true })
    const template = parsed.ast.templateBody!
    const attribute = template.children.find((node) => node.type === 'VElement')!.startTag.attributes[1]
    assert.ok(attribute.directive && attribute.value?.expression?.type === 'Identifier')
    assert.strictEqual(attribute.value.expression.name, 'dataVariant')
    const document = adaptVueAst(source, parsed.ast, 'root', {})
    assert.deepStrictEqual(document.roots[0].attributes.find((item) => item.name === 'data-variant')!.alternatives?.[0].range, attribute.value.expression.range)
    assert.strictEqual(document.index.metrics.expressionParses, 0)
  })
  for (const key of ['data-variant', 'class'])
    it(`explicit empty ${key} uses its source start after newline and non-BMP`, async () => {
      const source = `<template>\n😀<div class="card-list" :${key}=""/></template>`
      const result = await lintBothEntries(source, 'vue')
      const start = source.indexOf('=""') + 2
      const code = key === 'class' ? 'DYNAMIC_CLASS_UNRESOLVED' : 'SOURCE_RELATION_UNRESOLVED'
      assert.deepStrictEqual(hostRanges(source, result), [[code, [start, start]]])
      assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]), [[code, [start, start]]])
    })
  const malformed = [
    ['v-if', '<template><div class="card-list"><span v-if="a +" class="body"/></div></template>', [], 45],
    ['class', '<template><div class="card-list" :class="a +"/></template>', [['DYNAMIC_CLASS_UNRESOLVED', [41, 44]]], 41],
    ['data', '<template><div class="card-list" :data-variant="a +"/></template>', [['SOURCE_RELATION_UNRESOLVED', [48, 51]]], 48],
    ['duplicate', '<template><div class="card-list" class="body"/></template>', [['PARSE_ERROR', [33, 33]]], 33],
    ['unclosed quote', '<template><div class="card-list" :data-variant="open></div></template>', [['PARSE_ERROR', [70, 70]]], 70],
    ['interpolation', '<template><div class="card-list">{{ a + }}</div></template>', [], 36]
  ] as const
  for (const [label, source, expected, nativeStart] of malformed)
    it(`retains Spira checks and structural host records for ${label}`, async () => {
      const result = await lintBothEntries(source, 'vue')
      assert.deepStrictEqual(hostRanges(source, result), expected)
      const direct = supplied(source)
      assert.deepStrictEqual(direct.errors.map((issue) => [issue.code, issue.range]), expected)
      const syntax = expected.find(([code]) => code === 'PARSE_ERROR')
      assert.strictEqual(direct.status, syntax ? 'blocked' : expected.length ? 'failed' : 'pass')
      if (syntax) {
        const raw = vueParser.parseForESLint(source, { range: true, loc: true }).ast.templateBody!
        const first = raw.errors.find((error) => error.index === syntax[1][0])!
        assert.ok(first)
        assert.strictEqual(direct.errors[0].message, first.message)
      }
      assert.strictEqual(result.native.errors[0].code, 'PARSE_ERROR')
      assert.strictEqual(result.native.errors[0].range?.[0], nativeStart)
    })
  it('ignores out-of-template records and unclassified codes rather than blanket failing', () => {
    const source = '<template><div class="card-list">1 < 2</div></template><script>const n=1</script>'
    const parsed = vueParser.parseForESLint(source, { range: true, loc: true })
    parsed.ast.templateBody!.errors.push({ code: 'duplicate-attribute', index: source.length, message: 'outside' } as never)
    const document = adaptVueAst(source, parsed.ast, 'root', {})
    assert.strictEqual(document.issues.length, 0)
    assert.strictEqual(supplied(source).status, 'pass')
  })
  const boundaries = [
    ['missing pair', '<div class="card-list"><span class="body">', [[10, 33], [33, 52]], []],
    ['implicit p', '<div class="card-list"><p class="body"><div class="title"></div></p></div>', [[33, 49]], [[74, 74]]],
    ['implicit li', '<ul class="card-list"><li class="body">a<li class="title">b</li></ul>', [[32, 49]], []],
    ['stray', '<div class="card-list"></span></div>', [], [[33, 33]]],
    ['component', '<Card class="card-list"><span class="body"></span>', [[10, 34]], []],
    ['svg', '<svg class="card-list"><path d="M0 0"></svg>', [[33, 48]], []]
  ] as const
  for (const [label, body, missing, stray] of boundaries)
    it(`${label} reports only exact supplied boundaries and dedicated repair`, async () => {
      const source = `<template>${body}</template>`
      const result = await lintBothEntries(source, 'vue')
      const direct = supplied(source)
      const expected = [...missing.map((range) => [range, missingReason, missingCondition]), ...stray.map((range) => [range, strayReason, strayCondition])]
      assert.strictEqual(direct.status, 'failed')
      assert.strictEqual(direct.coverage.elements, 0)
      assert.deepStrictEqual(direct.errors.map((issue) => [issue.range, issue.reason, issue.repair?.conditions[0]]), expected)
      for (const issue of direct.errors) {
        assert.strictEqual(issue.code, 'SOURCE_RELATION_UNRESOLVED')
        assert.strictEqual(issue.kind, 'unresolved')
        assert.deepStrictEqual(issue.repair, { conditions: [issue.reason === missingReason ? missingCondition : strayCondition], effective: {} })
      }
      assert.deepStrictEqual(hostRanges(source, result), expected.map(([range]) => ['SOURCE_RELATION_UNRESOLVED', range]))
      if (label === 'implicit p') assert.strictEqual(result.native.status, 'pass')
      else assert.strictEqual(result.native.status, 'blocked')
    })
  it('suppresses recovered-tree naming and root-count alternatives', async () => {
    const source = '<template><Card class="Bad_Name"><span class="Bad_Name"></span></template>'
    const result = await lintBothEntries(source, 'vue')
    assert.deepStrictEqual(result.host.messages.map((message) => message.messageId), ['SOURCE_RELATION_UNRESOLVED'])
    assert.ok(supplied(source).errors.every((issue) => issue.reason === missingReason))
  })
  it('takes priority over recovered boundaries', () => {
    const source = '<template><div class="Bad_Name" class="title"><span></template>'
    const result = supplied(source)
    assert.deepStrictEqual(result.errors.map((issue) => issue.code), ['PARSE_ERROR'])
  })
  for (const body of [
    '<div class="card-list"><span class="body"></span></div>',
    '<div class="card-list"><span class="body"/></div>',
    '<div class="card-list"><br><input class="body"></div>',
    '<div class="card-list"><br></br></div>',
    '<div class="card-list">1 < 2</div>',
    '<div class="card-list">1 &lt; 2</div>'
  ])
    it(`valid boundary control ${body}`, async () => {
      const source = `<template>${body}</template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.strictEqual(supplied(source).status, 'pass')
    })
})

describe('case-sensitive void boundaries in supplied Vue AST', () => {
  const missingReason =
    'Supplied Vue AST tag boundary is unresolved: the supplied tree ends this element without an explicit end tag (a missing end tag, or an HTML implied close such as a block element inside <p>).'
  const strayReason =
    'Supplied Vue AST tag boundary is unresolved: this end tag matches no open element in the supplied tree (a stray end tag, or its element was implicitly closed earlier).'
  const missingCondition =
    'Parent-child relationships and class names in this template were not checked using the supplied Vue AST. Check the original template with the native SpiraCSS CLI before making any edits. Do not change tags or class names based on the supplied tree alone.'
  const strayCondition =
    'Parent-child relationships and class names in this template were not checked using the supplied Vue AST. Check the original template with the native SpiraCSS CLI before making any edits. Do not change tags or class names based on the supplied tree alone.'
  const cases = [
    ['missing Input', '<Input class="card-list">', 'missing', [10, 35], [10, 10]],
    ['missing Link', '<Link class="card-list">', 'missing', [10, 34], [10, 10]],
    ['nested missing BR', '<div class="card-list"><BR></div>', 'missing', [33, 37], [33, 33]],
    ['stray Input', '<div class="card-list"></Input></div>', 'stray', [33, 33], [33, 33]],
    ['missing Card control', '<Card class="card-list">', 'missing', [10, 34], [10, 10]],
    ['lowercase input control', '<input class="card-list">', 'none', [], []],
    ['explicitly closed Input control', '<Input class="card-list"></Input>', 'none', [], []],
    ['stray lowercase input control', '<div class="card-list"></input></div>', 'none', [], []],
    ['br void end control', '<div class="card-list"><br></br></div>', 'none', [], []]
  ] as const
  for (const [label, body, kind, range, nativeRange] of cases)
    it(`preserves Vue raw tag case for ${label}`, async () => {
      const source = `<template>${body}</template>`
      const result = await lintBothEntries(source, 'vue')
      const parsed = vueParser.parseForESLint(source, { range: true, loc: true })
      const direct = lintMarkup(source, {
        format: 'vue',
        mode: 'root',
        config: {},
        parsers: {
          vue: {
            available: true,
            parse: () => adaptVueAst(source, parsed.ast, 'root', {}, parsed.services.getDocumentFragment())
          }
        }
      })
      const index = new SourceIndex(source)
      const host = result.host.messages.map((message) => [
        message.messageId,
        [
          index.lineStarts[message.line - 1] + message.column - 1,
          index.lineStarts[(message.endLine ?? message.line) - 1] + (message.endColumn ?? message.column) - 1
        ]
      ])
      assert.strictEqual(result.native.status, kind === 'none' ? 'pass' : 'blocked')
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.range]),
        kind === 'none' ? [] : [['PARSE_ERROR', nativeRange]]
      )
      assert.deepStrictEqual(host, kind === 'none' ? [] : [['SOURCE_RELATION_UNRESOLVED', range]])
      assert.strictEqual(direct.status, kind === 'none' ? 'pass' : 'failed')
      if (kind === 'none') assert.deepStrictEqual(direct.errors, [])
      else {
        const reason = kind === 'stray' ? strayReason : missingReason
        const condition = kind === 'stray' ? strayCondition : missingCondition
        assert.strictEqual(direct.coverage.elements, 0)
        assert.strictEqual(direct.errors.length, 1)
        const issue = direct.errors[0]
        assert.strictEqual(issue.code, 'SOURCE_RELATION_UNRESOLVED')
        assert.strictEqual(issue.kind, 'unresolved')
        assert.deepStrictEqual(issue.range, range)
        assert.strictEqual(issue.message, reason)
        assert.strictEqual(issue.reason, reason)
        assert.deepStrictEqual(issue.repair, { conditions: [condition], effective: {} })
      }
    })
})

import { ESLint } from 'eslint'
import * as tsParser from '@typescript-eslint/parser'
import { plugin } from '../src/eslint'

describe('valid Vue expression settings', () => {
  for (const [label, source, withTs, disableFilter] of [
    ['default', '<template><div class="card-list">{{ flags | (mask) }}</div></template>', true, false],
    ['filter-disabled', '<template><div class="card-list">{{ flags | (mask) }}</div></template>', true, true],
    ['no-ts', '<template><div class="card-list" :title="x as string"></div></template>', false, false],
    ['ts', '<template><div class="card-list" :title="x as string"></div></template>', true, false]
  ] as const)
    it(`${label} does not promote host expression recovery to Spira syntax`, async () => {
      const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: [{
          files: ['**/*.vue'],
          languageOptions: {
            parser: vueParser,
            parserOptions: {
              ecmaVersion: 'latest',
              sourceType: 'module',
              ecmaFeatures: { jsx: true },
              ...(withTs ? { parser: tsParser } : {}),
              ...(disableFilter ? { vueFeatures: { filter: false } } : {})
            }
          },
          plugins: { spiracss: plugin },
          rules: { 'spiracss/markup': ['error', { config: {}, format: 'vue', mode: 'root' }] }
        }]
      })
      const host = (await eslint.lintText(source, { filePath: 'r3.vue' }))[0]
      assert.deepStrictEqual(host.messages, [], label)
      const native = lintMarkup(source, { format: 'vue', mode: 'root', config: {}, parsers: await loadMarkupParsers(['vue']) })
      assert.strictEqual(native.status, 'pass', label)
      assert.deepStrictEqual(native.errors, [], label)
    })
})

describe('supplied Vue static bind spelling', () => {
  const source = '<template><Comp class="card-list" :itemId="a" :itemid="b"/></template>'
  for (const [label, config] of [
    ['default', {}],
    ['configured itemid', { selectorPolicy: { variant: { dataKeys: ['itemid'] } } }]
  ] satisfies Array<[string, MarkupConfig]>)
    it(`${label} checks distinct raw keys at the original value range`, async () => {
      const result = await lintBothEntries(source, 'vue', config)
      const parsed = vueParser.parseForESLint(source, { range: true, loc: true })
      const direct = lintMarkup(source, {
        format: 'vue',
        mode: 'root',
        config,
        parsers: {
          vue: {
            available: true,
            parse: () => adaptVueAst(source, parsed.ast, 'root', config, parsed.services.getDocumentFragment())
          }
        }
      })
      const configured = label === 'configured itemid'
      assert.strictEqual(direct.status, configured ? 'failed' : 'pass', JSON.stringify(direct))
      assert.strictEqual(direct.coverage.elements, 1)
      assert.strictEqual(direct.coverage.unresolved, configured ? 1 : 0)
      assert.strictEqual(result.native.status, direct.status)
      assert.deepStrictEqual(direct.errors, result.native.errors)
      assert.strictEqual(result.host.messages.length, configured ? 1 : 0)
      assertEntryParity(source, result)
      if (configured) {
        assert.strictEqual(direct.errors.length, 1)
        const issue = direct.errors[0]
        assert.strictEqual(issue.code, 'SOURCE_RELATION_UNRESOLVED')
        assert.deepStrictEqual(issue.range, [55, 56])
        assert.strictEqual(source.slice(...issue.range), 'b')
        assert.deepStrictEqual(issue.repair?.effective.selectorPolicy?.variant.dataKeys, ['itemid'])
        assert.strictEqual(result.host.messages[0].messageId, 'SOURCE_RELATION_UNRESOLVED')
      } else {
        assert.deepStrictEqual(direct.errors, [])
        assert.deepStrictEqual(result.host.messages, [])
      }
    })
  it('retains the host parse error for the same raw bind spelling', () => {
    const control = '<template><Comp class="card-list" :itemid="a" :itemid="b"/></template>'
    const parsed = vueParser.parseForESLint(control, { range: true, loc: true })
    const result = lintMarkup(control, {
      format: 'vue',
      mode: 'root',
      config: {},
      parsers: {
        vue: {
          available: true,
          parse: () => adaptVueAst(control, parsed.ast, 'root', {}, parsed.services.getDocumentFragment())
        }
      }
    })
    assert.strictEqual(result.status, 'blocked')
    assert.deepStrictEqual(result.errors.map((issue) => [issue.code, issue.range, issue.message]), [
      ['PARSE_ERROR', [46, 46], 'duplicate-attribute']
    ])
  })
})

describe('whole Vue v-bind nullish contributions', () => {
  for (const [expression, start] of [
    ['null', 101],
    ['undefined', 106]
  ] as const) {
    it(`${expression} retains the independent class violation and its repair at the original range`, async () => {
      const source = `<template><div class="card-list" data-variant="compact" v-bind="${expression}" data-state="open"><span class="Bad_Name"/></div></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed')
      assert.strictEqual(result.native.coverage.unresolved, 0)
      assert.strictEqual(result.native.coverage.outOfScope, 0)
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.range]),
        [['INVALID_BASE_CLASS', [start, start + 8]]]
      )
      assert.strictEqual(source.slice(...result.native.errors[0].range!), 'Bad_Name')
      const omitted = source.replace(` v-bind="${expression}"`, '')
      const control = await lintBothEntries(omitted, 'vue')
      assert.strictEqual(result.native.errors[0].reason, control.native.errors[0].reason)
      assert.deepStrictEqual(result.native.errors[0].repair, control.native.errors[0].repair)
      assert.deepStrictEqual(await generated(source, 'vue'), await generated(omitted, 'vue'))
    })
    it(`${expression} preserves props-group winners across the empty contribution`, async () => {
      for (const [first, last] of [
        ['compact', 'wide'],
        ['wide', 'compact']
      ]) {
        const source = `<template><div class="card-list" data-variant="${first}" v-bind="${expression}" :data-variant="'${last}'"/></template>`
        const result = await lintBothEntries(source, 'vue')
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, 'pass', source)
        assert.deepStrictEqual(result.native.errors, [])
        assert.strictEqual(result.native.coverage.unresolved, 0)
        const empty = source.replace(`v-bind="${expression}"`, 'v-bind="{}"')
        const control = await lintBothEntries(empty, 'vue')
        assertEntryParity(empty, control)
        assert.strictEqual(control.native.status, 'pass')
        const files = await generated(source, 'vue')
        assert.deepStrictEqual(files, await generated(empty, 'vue'))
        assert.ok(
          files.some((file) => file.content.includes(`[data-variant="${last}"]`)),
          source
        )
        assert.ok(!files.some((file) => file.content.includes(`[data-variant="${first}"]`)), source)
      }
    })
    it(`${expression} contributes no props to a component`, async () => {
      const source = `<template><Card class="card-list" v-bind="${expression}"/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(result.native.errors, [])
      assert.strictEqual(result.native.coverage.unresolved, 0)
      assert.strictEqual(result.native.coverage.generationUnenumeratedSites, 0)
      assert.deepStrictEqual(
        await generated(source, 'vue'),
        await generated('<template><Card class="card-list"/></template>', 'vue')
      )
    })
  }
  it('keeps shadowed undefined and class-bearing objects unresolved', async () => {
    for (const source of [
      '<script setup>const undefined = "shadowed";</script><template><div class="card-list" v-bind="undefined"/></template>',
      '<template><div class="card-list" v-bind="{ class: \'other-block\' }"/></template>',
      '<template><div class="card-list" v-bind="{ ...open }"/></template>'
    ]) {
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed', source)
      assert.strictEqual(result.native.coverage.unresolved, 1)
      assert.deepStrictEqual(
        result.native.errors.map((issue) => issue.code),
        ['DYNAMIC_CLASS_UNRESOLVED']
      )
    }
  })
})

describe('nullish bindings preserve effective Vue class prefixes', () => {
  const utilities = Array.from({ length: 9 }, (_, index) => `'u-flag${index}':flag${index}`).join(',')
  const dynamic = `:class="{${utilities}}"`
  for (const expression of ['null', 'undefined'])
    it(`${expression} leaves nine optional utilities equivalent to an omitted binding`, async () => {
      const omitted = `<template><div class="card-list" ${dynamic}/></template>`
      const control = await lintBothEntries(omitted, 'vue')
      assertEntryParity(omitted, control)
      assert.strictEqual(control.native.status, 'pass')
      assert.deepStrictEqual(control.native.errors, [])
      for (const attributes of [
        `class="card-list" ${dynamic} v-bind="${expression}"`,
        `class="card-list" v-bind="${expression}" ${dynamic}`
      ]) {
        const source = `<template><div ${attributes}/></template>`
        const result = await lintBothEntries(source, 'vue')
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, 'pass', source)
        assert.deepStrictEqual(result.native.errors, [])
        assert.strictEqual(result.native.coverage.unresolved, 0)
        assert.deepStrictEqual(result.native.coverage, control.native.coverage)
        assert.deepStrictEqual(result.host.messages, [])
        assert.strictEqual(result.native.metrics.inertOptionalTokens, 9)
        assert.strictEqual(result.native.metrics.classExpressionProducts, 2)
      }
    })
  it('retains genuine unknowns, shadowing and mixed nullish/dynamic-argument bindings', async () => {
    for (const [script, attributes, unresolved] of [
      ['', 'v-bind="open"', 'v-bind="open"'],
      ['', 'v-bind="true"', 'v-bind="true"'],
      ['<script setup>const undefined = "shadowed";</script>', 'v-bind="undefined"', 'v-bind="undefined"'],
      ['', 'v-bind="null" :[key]="open"', ':[key]="open"'],
      ['', ':[key]="open" v-bind="undefined"', ':[key]="open"'],
      ['', 'v-bind="null" :[key]="null"', ':[key]="null"']
    ]) {
      const source = `${script}<template><div class="card-list" ${dynamic} ${attributes}/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed', source)
      assert.strictEqual(result.native.coverage.unresolved, 1)
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.range && source.slice(...issue.range)]),
        [['DYNAMIC_CLASS_UNRESOLVED', unresolved]]
      )
      assert.strictEqual(result.native.metrics.inertOptionalTokens, 0)
    }
  })
})

describe('Astro Fragment source correspondence and ownership', () => {
  const config = { rootFileCase: 'preserve' } as const
  const families = [
    ['conditional', '<div class="card-list"><>{open && <p class="body"/>}</></div>', 2, 44, 52],
    ['map', '<div class="card-list"><>{items.map(i => <p class="body"/>)}</></div>', 2, 51, 59],
    ['html-comment', '<><div class="card-list"/><!-- note --></>', 1, 14, 22],
    ['prefix-comment', '<!-- note --><><><div class="card-list"/></></>', 1, 29, 45],
    ['prefix-text', 'text<><><div class="card-list"/></></>', 1, 20, 36],
    ['prefix-doctype', '<!doctype html><><><div class="card-list"/></></>', 1, 31, 47]
  ] as const
  for (const [family, source, elements, shorthandStart, namedStart] of families) {
    const named = source.replace(/<>/g, '<Fragment>').replace(/<\/>/g, '</Fragment>')
    it(`${family} keeps normal classes and nonempty generation through either Fragment spelling`, async () => {
      for (const input of [source, named]) {
        const result = await lintBothEntries(input, 'astro', config)
        assertEntryParity(input, result)
        assert.strictEqual(result.native.status, 'pass', input)
        assert.strictEqual(result.native.ok, true)
        assert.deepStrictEqual(result.native.errors, [])
        assert.strictEqual(result.native.coverage.unresolved, 0)
        assert.strictEqual(result.native.coverage.elements, elements)
        assert.strictEqual(result.native.metrics.astroConversions, 1)
        assert.strictEqual(result.native.metrics.generatedParses, 1)
        const files = await generated(input, 'astro', config)
        assert.strictEqual(files.length, 1)
        assert.strictEqual(files[0].path, 'card-list.scss')
        assert.match(files[0].content, /@scope \(\.card-list\)/)
        if (elements === 2) assert.match(files[0].content, /^    > \.body \{/m)
        assert.deepStrictEqual(files, await generated(named, 'astro', config))
      }
    })
    it(`${family} reports real invalid classes at their own UTF-16 ranges with repair context`, async () => {
      for (const [input, start] of [[source, shorthandStart], [named, namedStart]] as const) {
        const bad = input.replace(elements === 2 ? 'class="body"' : 'class="card-list"', 'class="Bad_Name"')
        const result = await lintBothEntries(bad, 'astro', config)
        assertEntryParity(bad, result)
        assert.strictEqual(result.native.status, 'failed', bad)
        assert.strictEqual(result.native.ok, false)
        assert.strictEqual(result.native.coverage.unresolved, 0)
        assert.strictEqual(result.native.coverage.elements, elements)
        const codes = elements === 2 ? ['INVALID_BASE_CLASS'] : ['INVALID_BASE_CLASS', 'ROOT_NOT_BLOCK']
        assert.deepStrictEqual(result.native.errors.map((issue) => issue.code).sort(), codes)
        for (const issue of result.native.errors) {
          assert.strictEqual(issue.kind, 'violation')
          assert.deepStrictEqual(issue.range, [start, start + 8])
          assert.strictEqual(issue.baseClass, 'Bad_Name')
          assert.deepStrictEqual(issue.path, elements === 2 ? ['card-list', 'Bad_Name'] : ['Bad_Name'])
          assert.strictEqual(issue.condition, family === 'conditional' ? '(open)' : undefined)
          assert.strictEqual(issue.position?.offset, start)
          assert.strictEqual(issue.position?.endOffset, start + 8)
          assert.ok(issue.reason)
          assert.ok(issue.repair?.conditions.length)
          assert.strictEqual(issue.repair?.effective.naming.blockCase, 'kebab')
          assert.strictEqual(issue.repair?.effective.naming.modifierPrefix, '-')
        }
      }
    })
  }
  const expressions = [
    ['inline', '<div class="card-list"><>{open && <p class="body">text</p>}</></div>', 2],
    ['multiline', '<ul class="card-list">\n  <>\n    {items.map((item) => (\n      <li class="item">{item.name}</li>\n    ))}\n  </>\n</ul>', 2],
    ['nested', '<div class="card-list"><>{open && <p class="body">{more && <span class="label">x</span>}</p>}</></div>', 3],
    ['ternary', '<div class="card-list"><>{open ? <p class="body">a</p> : <span class="label">b</span>}</></div>', 3],
    ['two', '<div class="card-list"><>{a && <p class="body">x</p>}{b && <i class="label">y</i>}</></div>', 3],
    ['inner-fragment', '<div class="card-list">{items.map((i) => <>{ok && <p class="body">x</p>}<b class="label"/></>)}</div>', 3]
  ] as const
  for (const [name, source, elements] of expressions)
    it(`${name} preserves complete expressions, authored fragments and generated child order`, async () => {
      const control = name === 'inner-fragment'
        ? '<div class="card-list"><p class="body">x</p><b class="label"/></div>'
        : source.replace('<>', '').replace('</>', '')
      for (const input of [source, control]) {
        const result = await lintBothEntries(input, 'astro', config)
        assertEntryParity(input, result)
        assert.strictEqual(result.native.status, 'pass', input)
        assert.deepStrictEqual(result.native.errors, [])
        assert.strictEqual(result.native.coverage.elements, elements)
        assert.strictEqual(result.native.coverage.unresolved, 0)
        assert.strictEqual(result.native.metrics.astroConversions, 1)
        assert.strictEqual(result.native.metrics.generatedParses, 1)
      }
      const files = await generated(source, 'astro', config)
      assert.ok(files.length > 0)
      assert.deepStrictEqual(files, await generated(control, 'astro', config))
      if (name === 'inner-fragment') {
        assert.strictEqual(files.length, 1)
        assert.strictEqual(files[0].path, 'card-list.scss')
        assert.match(files[0].content, /@scope \(\.card-list\) \{\n  :scope \{/)
        assert.match(files[0].content, /    > \.body \{\n      \/\/ element base styles\n    \}\n\n    > \.label \{/)
        assert.strictEqual((files[0].content.match(/> \.body \{/g) ?? []).length, 1)
        assert.strictEqual((files[0].content.match(/> \.label \{/g) ?? []).length, 1)
      }
    })
  it('keeps the inline condition and UTF-16 class violation after complete expression matching', async () => {
    for (const [source, start, condition] of [
      ['<div class="card-list"><>{open && <p class="Bad_Name">text</p>}</></div>', 44, '(open)'],
      ['---\r\nconst label="日本😀";\r\n---\r\n<div class="card-list"><><span class="Bad_Name">{label}</span></></div>', 69, undefined]
    ] as const) {
      const result = await lintBothEntries(source, 'astro', config)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed')
      assert.strictEqual(result.native.coverage.unresolved, 0)
      assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.kind, issue.range]), [
        ['INVALID_BASE_CLASS', 'violation', [start, start + 8]]
      ])
      assert.deepStrictEqual(result.native.errors[0].path, ['card-list', 'Bad_Name'])
      assert.strictEqual(result.native.errors[0].condition, condition)
    }
  })
  for (const [source, start, end] of [
    ['<><div class="card-list"/><!-- note --><div class="item-list"/></>', 39, 63],
    ['<Fragment><div class="card-list"/><!-- note --><div class="item-list"/></Fragment>', 47, 71],
    ['<Fragment><div class="card-list"/><div class="other-list"/></Fragment>', 34, 59],
    ['<Fragment slot="example"><div class="card-list"/><div class="other-list"/></Fragment>', 49, 74]
  ] as const)
    it(`counts real roots and points to the second root at ${start}`, async () => {
      const result = await lintBothEntries(source, 'astro', config)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed')
      assert.strictEqual(result.native.coverage.elements, 2)
      assert.strictEqual(result.native.coverage.unresolved, 0)
      assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.kind, issue.range]), [
        ['MULTIPLE_ROOT_ELEMENTS', 'violation', [start, end]]
      ])
      const selection = await lintBothEntries(source, 'astro', config, 'selection')
      assertEntryParity(source, selection)
      assert.strictEqual(selection.native.status, 'pass')
      assert.strictEqual(selection.native.coverage.elements, 2)
    })
  it('does not count mutually exclusive named Fragment children as coexisting roots', async () => {
    const source = '<Fragment>{open ? <div class="card-list"/> : <div class="other-list"/>}</Fragment>'
    const result = await lintBothEntries(source, 'astro', config)
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.deepStrictEqual(result.native.errors, [])
    assert.strictEqual(result.native.coverage.elements, 2)
  })
  it('makes a static slot wrapper transparent without inventing an owner for orphan Elements', async () => {
    for (const [source, ranges] of [
      ['<Card><Fragment slot="header"><h2 class="title"/><p class="lead"/></Fragment></Card>', [[41, 46], [59, 63]]],
      ['<Card><h2 class="title"/><p class="lead"/></Card>', [[17, 22], [35, 39]]]
    ] as const) {
      const result = await lintBothEntries(source, 'astro', config)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed')
      assert.strictEqual(result.native.coverage.elements, 3)
      assert.strictEqual(result.native.coverage.unresolved, 0)
      assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.kind, issue.range]),
        ranges.map((range) => ['ELEMENT_WITHOUT_BLOCK_ANCESTOR', 'violation', range]))
    }
  })
  const children = '<div class="card-list"/><div class="other-list"/>'
  for (const declaration of [
    'import Fragment from "./User.astro";',
    'import { Fragment } from "./user";',
    'import type Fragment from "./types";',
    'import { type Fragment } from "./types";',
    'const Fragment = () => "user";'
  ])
    it(`keeps a bound Fragment opaque for ${declaration}`, async () => {
      const source = `---\n${declaration}\n---\n<Fragment>${children}</Fragment>`
      const result = await lintBothEntries(source, 'astro', config)
      if (!declaration.includes('type ')) assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(result.native.errors, [])
      assert.strictEqual(result.native.coverage.elements, 3)
    })
  for (const source of [
    `{items.map((Fragment) => <Fragment>${children}</Fragment>)}`,
    `---\nimport * as UI from "./user";\n---\n<UI.Fragment>${children}</UI.Fragment>`,
    `---\nconst content = "<b>x</b>";\n---\n<Fragment set:html={content}>${children}</Fragment>`,
    `---\nconst content = "x";\n---\n<Fragment set:text={content}>${children}</Fragment>`,
    `<Fragment id="example">${children}</Fragment>`,
    `<Fragment slot>${children}</Fragment>`,
    `<Fragment slot={"header"}>${children}</Fragment>`,
    `<Fragment {...{slot:"header"}}>${children}</Fragment>`
  ])
    it(`retains an opaque component boundary for ${source}`, async () => {
      const result = await lintBothEntries(source, 'astro', config)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(result.native.errors, [])
      assert.strictEqual(result.native.coverage.elements, 3)
    })
  it('keeps an opaque set:html Fragment without children', async () => {
    const source = '---\nconst content = "<b>x</b>";\n---\n<Fragment set:html={content}/>'
    const result = await lintBothEntries(source, 'astro', config)
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.strictEqual(result.native.coverage.elements, 1)
  })
  for (const format of ['jsx', 'tsx'] as const)
    it(`keeps an unbound named Fragment a component in ${format}`, async () => {
      const source = 'function Card(){return <Fragment><div className="card-list"/><div className="other-list"/></Fragment>}'
      const result = await lintBothEntries(source, format, config)
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.strictEqual(result.native.coverage.elements, 3)
    })
  for (const source of [
    '<div class="card-list"><>{open && <p class="body"/>}</div>',
    '<><div class="card-list"/><!-- note -->'
  ])
    it(`does not accept matched leaves as proof of a missing fragment close for ${source}`, async () => {
      const result = await lintBothEntries(source, 'astro', config)
      assert.notStrictEqual(result.native.status, 'pass')
      await assert.rejects(() => generated(source, 'astro', config))
    })
})

describe('Vue classless whole bindings preserve effective class prefixes', () => {
  const utilities = Array.from({ length: 9 }, (_, index) => `'u-flag${index}':flag${index}`).join(',')
  const dynamic = `:class="{${utilities}}"`
  for (const expression of ['{}', "{ id: 'x' }"])
    it(`${expression} leaves nine optional utilities equivalent to an omitted binding`, async () => {
      const omitted = `<template><div class="card-list" ${dynamic}/></template>`
      const control = await lintBothEntries(omitted, 'vue')
      assertEntryParity(omitted, control)
      assert.strictEqual(control.native.status, 'pass')
      assert.deepStrictEqual(control.native.errors, [])
      assert.strictEqual(control.native.metrics.expressionParses, 1)
      for (const attributes of [
        `class="card-list" ${dynamic} v-bind="${expression}"`,
        `class="card-list" v-bind="${expression}" ${dynamic}`
      ]) {
        const source = `<template><div ${attributes}/></template>`
        const result = await lintBothEntries(source, 'vue')
        assertEntryParity(source, result)
        assert.strictEqual(result.native.status, 'pass', source)
        assert.deepStrictEqual(result.native.errors, [])
        assert.deepStrictEqual(result.native.coverage, control.native.coverage)
        assert.deepStrictEqual(result.host.messages, [])
        assert.strictEqual(result.native.metrics.inertOptionalTokens, 9)
        assert.strictEqual(result.native.metrics.classExpressionProducts, 2)
        assert.strictEqual(result.native.metrics.expressionParses, 2)
      }
    })
  it('retains a real unclassified token with an empty whole binding', async () => {
    const invalid = dynamic.replace("'u-flag8'", "'Bad_Name'")
    const omitted = `<template><div class="card-list" ${invalid}/></template>`
    const source = `<template><div class="card-list" ${invalid} v-bind="{}"/></template>`
    const control = await lintBothEntries(omitted, 'vue')
    const result = await lintBothEntries(source, 'vue')
    assertEntryParity(omitted, control)
    assertEntryParity(source, result)
    assert.strictEqual(control.native.status, 'failed')
    assert.strictEqual(result.native.status, 'failed')
    assert.deepStrictEqual(
      result.native.errors.map((issue) => [issue.code, issue.range]),
      [['UNCLASSIFIED_CLASS_TOKEN', [source.indexOf('Bad_Name'), source.indexOf('Bad_Name') + 8]]]
    )
    assert.deepStrictEqual(result.native.errors, control.native.errors)
    assert.deepStrictEqual(result.host.messages, control.host.messages)
    assert.deepStrictEqual(result.native.coverage, control.native.coverage)
  })
  for (const [attributes, unresolved] of [
    ["v-bind=\"{ class: 'other-block' }\"", "v-bind=\"{ class: 'other-block' }\""],
    ['v-bind="{ ...open }"', 'v-bind="{ ...open }"']
  ])
    it(`keeps the class contribution unresolved for ${attributes}`, async () => {
      const source = `<template><div class="card-list" ${dynamic} ${attributes}/></template>`
      const result = await lintBothEntries(source, 'vue')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'failed', source)
      assert.strictEqual(result.native.coverage.unresolved, 1)
      assert.deepStrictEqual(
        result.native.errors.map((issue) => [issue.code, issue.range]),
        [['DYNAMIC_CLASS_UNRESOLVED', [source.indexOf(unresolved), source.indexOf(unresolved) + unresolved.length]]]
      )
      assert.strictEqual(result.native.metrics.inertOptionalTokens, 0)
    })
})

describe('Astro residual source evidence preserves class structure', () => {
  for (const [source, control, start] of [
    [
      '<div class="card-list">{<p class="body"/>}</div>',
      '<div class="card-list">{(<p class="body"/>)}</div>',
      34
    ],
    [
      '<div class="card-list"><>{<p class="body"/>}</></div>',
      '<div class="card-list"><>{(<p class="body"/>)}</></div>',
      36
    ]
  ] as const)
    it(`keeps unparenthesized JSX child ownership at ${start}`, async () => {
      const result = await lintBothEntries(source, 'astro')
      assertEntryParity(source, result)
      assert.strictEqual(result.native.status, 'pass')
      assert.deepStrictEqual(result.native.errors, [])
      assert.deepStrictEqual(result.host.messages, [])
      assert.strictEqual(result.native.coverage.elements, 2)
      assert.strictEqual(result.native.coverage.unresolved, 0)
      assert.strictEqual(result.native.metrics.astroConversions, 1)
      assert.strictEqual(result.native.metrics.generatedParses, 1)
      assert.deepStrictEqual(await generated(source), await generated(control))

      const invalid = source.replace('class="body"', 'class="Bad_Name"')
      assert.strictEqual(invalid.indexOf('Bad_Name'), start)
      const negative = await lintBothEntries(invalid, 'astro')
      assertEntryParity(invalid, negative)
      assert.strictEqual(negative.native.status, 'failed')
      assert.strictEqual(negative.native.coverage.elements, 2)
      assert.strictEqual(negative.native.coverage.unresolved, 0)
      assert.deepStrictEqual(negative.native.errors.map((issue) => [issue.code, issue.range]), [
        ['INVALID_BASE_CLASS', [start, start + 8]]
      ])
      assert.strictEqual(negative.native.metrics.astroConversions, 1)
      assert.strictEqual(negative.native.metrics.generatedParses, 1)
    })

  it('uses the verified conditional child range across an HTML comment', async () => {
    const source = '<div class="card-list"><>{open && <p class="body"><!-- c --></p>}</></div>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.deepStrictEqual(result.native.errors, [])
    assert.deepStrictEqual(result.host.messages, [])
    assert.strictEqual(result.native.coverage.elements, 2)
    assert.strictEqual(result.native.coverage.unresolved, 0)
    assert.strictEqual(result.native.metrics.astroConversions, 1)
    assert.strictEqual(result.native.metrics.generatedParses, 1)
    assert.deepStrictEqual(await generated(source), await generated(source.replace('<!-- c -->', '')))
  })

  it('retains the real invalid sibling after a single-quoted conditional child', async () => {
    const source = '<div class="card-list"><>{open && <p class=\'body\'>t</p>}</><b class="Bad_Name"/></div>'
    assert.strictEqual(source.indexOf('Bad_Name'), 69)
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'failed')
    assert.strictEqual(result.native.coverage.elements, 3)
    assert.strictEqual(result.native.coverage.unresolved, 0)
    assert.deepStrictEqual(result.native.errors.map((issue) => [issue.code, issue.range]), [
      ['INVALID_BASE_CLASS', [69, 77]]
    ])
    assert.strictEqual(result.native.metrics.astroConversions, 1)
    assert.strictEqual(result.native.metrics.generatedParses, 1)

    const valid = source.replace('Bad_Name', 'label')
    const positive = await lintBothEntries(valid, 'astro')
    assertEntryParity(valid, positive)
    assert.strictEqual(positive.native.status, 'pass')
    assert.deepStrictEqual(positive.native.errors, [])
    assert.deepStrictEqual(positive.host.messages, [])
    assert.strictEqual(positive.native.coverage.elements, 3)
    assert.strictEqual(positive.native.coverage.unresolved, 0)
    assert.strictEqual(positive.native.metrics.astroConversions, 1)
    assert.strictEqual(positive.native.metrics.generatedParses, 1)
    assert.deepStrictEqual(await generated(valid), await generated(valid.replace("class='body'", 'class="body"')))
  })

  it('leaves an unmapped leading comment inert after a newline-separated doctype', async () => {
    const source = '<!doctype html>\n<!-- note -->\n<div class="card-list"/>'
    const result = await lintBothEntries(source, 'astro')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.status, 'pass')
    assert.deepStrictEqual(result.native.errors, [])
    assert.deepStrictEqual(result.host.messages, [])
    assert.strictEqual(result.native.coverage.elements, 1)
    assert.strictEqual(result.native.coverage.unresolved, 0)
    assert.strictEqual(result.native.metrics.astroConversions, 1)
    assert.strictEqual(result.native.metrics.generatedParses, 1)
    assert.deepStrictEqual(await generated(source), await generated('<div class="card-list"/>'))

    const invalid = source.replace('card-list', 'Bad_Name')
    assert.strictEqual(invalid.indexOf('Bad_Name'), 42)
    const negative = await lintBothEntries(invalid, 'astro')
    assertEntryParity(invalid, negative)
    assert.strictEqual(negative.native.status, 'failed')
    assert.strictEqual(negative.native.coverage.elements, 1)
    assert.strictEqual(negative.native.coverage.unresolved, 0)
    assert.deepStrictEqual(negative.native.errors.map((issue) => [issue.code, issue.range]), [
      ['INVALID_BASE_CLASS', [42, 50]],
      ['ROOT_NOT_BLOCK', [42, 50]]
    ])
    assert.strictEqual(negative.native.metrics.astroConversions, 1)
    assert.strictEqual(negative.native.metrics.generatedParses, 1)
  })
})
