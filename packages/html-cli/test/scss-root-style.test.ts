import assert from 'node:assert/strict'

import { resolveProjectOptions } from '../src/config-options'
import { generateFromHtml, type GeneratorOptions } from '../src/generator-core'

const options: GeneratorOptions = {
  globalScssModule: '@styles/global',
  pageEntryPrefix: '@assets/css',
  childScssDir: 'scss',
  layoutMixins: [],
  naming: { blockCase: 'kebab' }
}
const html =
  '<section class="test-card"><h2 class="title">Title</h2><div class="child-card"><p class="text">Text</p></div></section>'

describe('SCSS root style selection', () => {
  it('uses explicit scope only for the component root by default', () => {
    const defaults = generateFromHtml(html, '/tmp/project', true, options)
    const explicit = generateFromHtml(html, '/tmp/project', true, { ...options, scssRootStyle: 'scope-explicit' })
    assert.deepEqual(defaults, explicit)
    const root = defaults.find((file) => file.path === 'test-card.scss')!
    const child = defaults.find((file) => file.path === 'scss/child-card.scss')!
    assert.ok(root.content.includes('@scope (.test-card) {\n  :scope {'))
    assert.ok(root.content.includes("@scope (.test-card) {\n  :scope {\n    @include meta.load-css('scss');"))
    assert.ok(root.content.includes('> .child-card {'))
    assert.ok(!root.content.includes('@scope (.child-card)'))
    assert.equal((root.content.match(/@scope /g) ?? []).length, 1)
    assert.ok(root.content.includes("@include meta.load-css('scss');"))
    assert.ok(child.content.includes('.child-card {'))
    assert.ok(!child.content.includes('@scope'))
    const conventional = generateFromHtml(html, '/tmp/project', true, { ...options, scssRootStyle: 'class' })
    assert.deepEqual(
      defaults.filter((file) => file.path !== root.path),
      conventional.filter((file) => file.path !== root.path)
    )
  })

  it('keeps the conventional class output selectable', () => {
    const [root] = generateFromHtml(html, '/tmp/project', true, { ...options, scssRootStyle: 'class' })
    assert.ok(root.content.includes('.test-card {'))
    assert.ok(!root.content.includes('@scope'))
  })

  it('keeps component root syntax consistent when there are no independent child Blocks to load', () => {
    const source = '<section class="test-card"><h2 class="title">Title</h2></section>'
    for (const scssRootStyle of [undefined, 'class', 'scope', 'scope-explicit'] as const) {
      const [root] = generateFromHtml(source, '/tmp/project', true, { ...options, scssRootStyle })
      assert.equal(root.path, 'test-card.scss')
      assert.equal(root.content.includes('@scope (.test-card)'), scssRootStyle !== 'class')
      assert.ok(!root.content.includes('meta.load-css'))
    }
  })

  it('generates direct scope contents only for the component root', () => {
    const files = generateFromHtml(html, '/tmp/project', true, { ...options, scssRootStyle: 'scope' })
    const root = files.find((file) => file.path === 'test-card.scss')!
    const child = files.find((file) => file.path === 'scss/child-card.scss')!
    assert.ok(root.content.includes('@scope (.test-card) {\n'))
    assert.ok(root.content.includes('  > .title {'))
    assert.ok(!root.content.includes('  :scope {'))
    assert.ok(child.content.includes('.child-card {'))
    assert.ok(!child.content.includes('@scope'))
    assert.ok(root.content.includes('// @rel/scss/child-card.scss'))
    assert.ok(child.content.includes('// @rel/../test-card.scss'))
  })

  it('can explicitly wrap the scope body in :scope', () => {
    const files = generateFromHtml(html, '/tmp/project', true, { ...options, scssRootStyle: 'scope-explicit' })
    assert.ok(files[0].content.includes('@scope (.test-card) {\n  :scope {\n'))
    assert.ok(files[0].content.includes('    > .title {'))
  })

  it('keeps every meta-loaded descendant Block in class form for all root styles', () => {
    const source =
      '<section class="test-card"><div class="child-card"><div class="inner-card"><p class="text">Text</p></div></div></section>'
    for (const scssRootStyle of ['class', 'scope', 'scope-explicit'] as const) {
      const files = generateFromHtml(source, '/tmp/project', true, { ...options, scssRootStyle })
      for (const file of files.filter((file) => file.path.startsWith('scss/') && file.path !== 'scss/index.scss')) {
        assert.ok(!file.content.includes('@scope'), file.path)
        assert.ok(!file.content.includes(':scope'), file.path)
      }
      assert.ok(files.some((file) => file.path === 'scss/inner-card.scss'))
    }
  })

  it('does not add scopes in selection mode, which has no component root', () => {
    const conventional = generateFromHtml(html, '/tmp/project', false, { ...options, scssRootStyle: 'class' })
    for (const scssRootStyle of [undefined, 'scope', 'scope-explicit'] as const) {
      const files = generateFromHtml(html, '/tmp/project', false, { ...options, scssRootStyle })
      assert.deepEqual(files, conventional)
      assert.ok(files.every((file) => !file.content.includes('@scope')))
    }
  })

  it('uses root references for direct-scope variants and interactions', () => {
    const source =
      '<section class="test-card" data-variant="wide" data-state="open"><p class="text" data-state="active">Text</p></section>'
    const [file] = generateFromHtml(source, '/tmp/project', true, {
      ...options,
      scssRootStyle: 'scope',
      selectorPolicy: { variant: { mode: 'data' }, state: { mode: 'data' } }
    })
    assert.ok(file.content.includes(':scope[data-variant="wide"] {'))
    assert.ok(file.content.includes('@at-root :scope {'))
    assert.ok(file.content.includes('&[data-state="open"] {'))
    assert.ok(file.content.includes('> .text {'))
  })

  it('loads all styles from the shared SpiraCSS config and rejects unknown values', () => {
    assert.equal(resolveProjectOptions().scssRootStyle, 'scope-explicit')
    for (const scssRootStyle of ['class', 'scope', 'scope-explicit'] as const) {
      assert.equal(resolveProjectOptions({ generator: { scssRootStyle } }).scssRootStyle, scssRootStyle)
    }
    for (const scssRootStyle of ['scoped', false, null]) {
      assert.throws(() => resolveProjectOptions({ generator: { scssRootStyle } }), /generator\.scssRootStyle/)
    }
  })
})
