import assert from 'assert'
import { describe, it } from 'mocha'
import { lintBothEntries, assertEntryParity } from './markup-host-helpers'
import { composeClassAlternatives, combineClasses } from '../src/markup/expressions'
import { SourceIndex } from '../src/markup/source'

describe('existing expression facts and metrics', () => {
  it('treats only proven unbound undefined as a false predicate across existing forms', async () => {
    for (const expression of [
      'undefined ? "Bad_Name" : "card-list"',
      'undefined && "Bad_Name"',
      'undefined || "card-list"',
      '["card-list",{Bad_Name:undefined}]'
    ]) {
      const source = `import clsx from "clsx"; function View(){return <div className={clsx(${expression})}/>} `
      const result = await lintBothEntries(source, 'tsx')
      assertEntryParity(source, result)
      assert.ok(
        !result.native.errors.some((issue) => issue.range && source.slice(...issue.range) === 'Bad_Name'),
        expression
      )
      if (expression !== 'undefined && "Bad_Name"') assert.strictEqual(result.native.status, 'pass')
      const shadow = source.replace('View()', 'View(undefined: unknown)')
      const unknown = await lintBothEntries(shadow, 'tsx')
      assertEntryParity(shadow, unknown)
      assert.notStrictEqual(unknown.native.status, 'pass')
    }
  })
  it('counts outer combinations and incompatible guards without increasing optional budgets', async () => {
    const index = new SourceIndex(''),
      context = { index, offset: 0, scope: 'test', helpers: new Set<string>(), members: undefined }
    const left = [
      { tokens: [], guard: { flag: true } },
      { tokens: [], guard: { flag: false } }
    ]
    const right = [
      { tokens: [], guard: { flag: true } },
      { tokens: [], guard: { flag: false } }
    ]
    assert.strictEqual(combineClasses(left, right, index).length, 2)
    assert.strictEqual(index.metrics.classExpressionProducts, 4)
    composeClassAlternatives(left, context, () => right, true)
    assert.strictEqual(index.metrics.classExpressionProducts, 8)
    const source = '<template><div class="card-list" :class="[\'u-one\']"/></template>',
      result = await lintBothEntries(source, 'vue')
    assertEntryParity(source, result)
    assert.strictEqual(result.native.metrics.classExpressionProducts, 3)
  })
})
