import assert from 'assert'
import path from 'path'
import { lint } from './stylelint-helpers'

describe('native selector-max-type component recommendation', () => {
  const config = {
    customSyntax: 'postcss-scss',
    rules: { 'selector-max-type': null },
    overrides: [{ files: ['**/components/**/*.scss'], rules: { 'selector-max-type': 0 } }]
  }

  it('rejects tag selectors inside component scopes without a duplicate SpiraCSS rule', async () => {
    const result = await lint({
      code: '@scope (.card-list) { :scope { > p { color: red; } } }',
      codeFilename: path.resolve('src/components/card-list.scss'),
      config
    })
    assert.strictEqual(result.errored, true)
    assert.deepStrictEqual(
      result.results[0].warnings.map((warning) => warning.rule),
      ['selector-max-type']
    )
  })

  it('accepts class selectors and leaves page/global tag exceptions outside that override', async () => {
    for (const [file, code] of [
      ['src/components/card-list.scss', '@scope (.card-list) { :scope { > .body { color: red; } } }'],
      ['src/pages/home.scss', '@layer page { body { color: red; } }'],
      ['src/styles/global.scss', 'html, body { margin: 0; }']
    ]) {
      const result = await lint({ code, codeFilename: path.resolve(file), config })
      assert.strictEqual(result.errored, false, file)
      assert.deepStrictEqual(result.results[0].warnings, [], file)
    }
  })
})
