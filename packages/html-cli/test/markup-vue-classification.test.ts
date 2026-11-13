import assert from 'assert'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as vueParser from 'vue-eslint-parser'
import { plugin } from '../src/eslint'
import { generateFromMarkupDocument } from '../src/generator-core'
import { lintMarkup, loadMarkupParsers } from '../src/markup'

async function both(source: string) {
  const parsers = await loadMarkupParsers(['vue'])
  const native = lintMarkup(source, { format: 'vue', mode: 'root', config: {}, parsers })
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.vue'],
        languageOptions: { parser: vueParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
        plugins: { spiracss: plugin },
        rules: { 'spiracss/markup': ['error', { config: {}, format: 'vue' }] }
      }
    ] as never
  })
  const host = (await eslint.lintText(source, { filePath: 'review.vue' }))[0]
  assert.deepStrictEqual(
    host.messages.map((message) => message.messageId).sort(),
    native.errors.map((issue) => issue.code).sort()
  )
  return { native, parsers }
}

describe('Vue source classification and empty markup', () => {
  it('classifies kebab-case and core components using the compiler native-tag policy', async () => {
    const { native } = await both(
      '<template><div class="card-list"><router-view/><transition><my-card/></transition><component :is="view"/></div></template>'
    )
    assert.strictEqual(native.status, 'pass')
  })
  it('keeps the complete opening tag after a quoted greater-than sign', async () => {
    const source = '<template><div class="card-list"><p v-if="n > 0"></p></div></template>'
    const { native } = await both(source)
    const issue = native.errors.find((entry) => entry.code === 'CLASSLESS_TAG_NOT_ALLOWED')!
    assert.strictEqual(source.slice(...issue.range!), '<p v-if="n > 0">')
  })
  it('accepts normal script-only lint but rejects empty generation and unsupported templates', async () => {
    const source = '<script setup>const value=1</script>'
    const { native, parsers } = await both(source)
    assert.strictEqual(native.status, 'pass')
    assert.strictEqual(native.coverage.elements, 0)
    const parser = parsers.vue!
    assert.ok(parser.available)
    const document = parser.parse(source, 'root', {})
    assert.throws(
      () =>
        generateFromMarkupDocument(document, '/tmp/spiracss-review-empty', true, {
          naming: {},
          globalScssModule: '',
          pageEntryPrefix: '',
          childScssDir: '',
          layoutMixins: []
        }),
      /No source Block/
    )
    for (const template of ['<template src="./external.html"></template>', '<template lang="pug">div</template>']) {
      const { native: result } = await both(template)
      assert.strictEqual(result.status, 'blocked')
      assert.deepStrictEqual(
        result.errors.map((issue) => issue.code),
        ['FORMAT_UNSUPPORTED']
      )
    }
  })
})
