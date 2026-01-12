import assert from 'assert'
import scss from 'postcss-scss'
import type { PostcssResult, RuleContext } from 'stylelint'

import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import interactionScope from '../dist/esm/rules/spiracss-interaction-scope.js'

const createValidateFalseResult = (): { result: PostcssResult; warnings: string[] } => {
  const warnings: string[] = []
  const result = {
    warn: (text: string) => {
      warnings.push(text)
    },
    opts: {},
    stylelint: {
      config: { validate: false },
      stylelintError: false
    }
  } as unknown as PostcssResult
  return { result, warnings }
}

describe('validate=false - rule behavior', () => {
  it('class-structure ignores invalid options without warnings', () => {
    const { result, warnings } = createValidateFalseResult()
    const root = scss.parse('.block-name { > .title {} }')
    const run = classStructure.rule(
      true,
      {
        allowExternalClasses: [''],
        enforceChildCombinator: true,
        naming: { blockCase: 'kebab' }
      },
      {} as RuleContext
    )
    run(root, result)
    assert.strictEqual(warnings.length, 0)
    assert.strictEqual(result.stylelint?.stylelintError, false)
  })

  it('interaction-scope ignores invalid options without warnings', () => {
    const { result, warnings } = createValidateFalseResult()
    const root = scss.parse('.block-name { color: red; }')
    const run = interactionScope.rule(
      true,
      {
        allowedPseudos: ['']
      },
      {} as RuleContext
    )
    run(root, result)
    assert.strictEqual(warnings.length, 0)
    assert.strictEqual(result.stylelint?.stylelintError, false)
  })
})
