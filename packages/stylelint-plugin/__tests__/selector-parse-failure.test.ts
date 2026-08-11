import assert from 'node:assert/strict'

import stylelint from 'stylelint'

import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import interactionProperties from '../dist/esm/rules/spiracss-interaction-properties.js'
import interactionScope from '../dist/esm/rules/spiracss-interaction-scope.js'
import keyframesNaming from '../dist/esm/rules/spiracss-keyframes-naming.js'
import pageLayer from '../dist/esm/rules/spiracss-page-layer.js'
import propertyPlacement from '../dist/esm/rules/spiracss-property-placement.js'
import pseudoNesting from '../dist/esm/rules/spiracss-pseudo-nesting.js'
import relComments from '../dist/esm/rules/spiracss-rel-comments.js'
import { withClassMode } from './rule-test-utils.js'

describe('selector parse failure severity', () => {
  const parseFailureRules = [
    classStructure,
    interactionProperties,
    interactionScope,
    keyframesNaming,
    pageLayer,
    propertyPlacement,
    pseudoNesting,
    relComments
  ]

  const lint = async (plugin: { ruleName: string }, ruleConfig: unknown) =>
    stylelint.lint({
      code: '.foo:: { color: red; }',
      codeFilename: plugin === pageLayer ? 'src/assets/css/about.scss' : undefined,
      config: {
        plugins: [plugin],
        rules: {
          [plugin.ruleName]:
            plugin === pageLayer
              ? [
                  true,
                  {
                    aliasRoots: { assets: ['src/assets'], components: ['src/components'] },
                    pageEntryAlias: 'assets',
                    pageEntrySubdir: 'css',
                    componentsDirs: ['src/components']
                  }
                ]
              : ruleConfig
        }
      },
      customSyntax: 'postcss-scss'
    })

  for (const plugin of parseFailureRules) {
    it(`fails closed with the default Stylelint severity (${plugin.ruleName})`, async () => {
      const result = await lint(plugin, true)
      assert.equal(result.errored, true)
      assert.equal(result.results[0]?.warnings[0]?.severity, 'error')
    })
  }

  it('allows an explicit rule-level warning override', async () => {
    const result = await lint(classStructure, [true, { severity: 'warning' }])
    assert.equal(result.errored, false)
    assert.equal(result.results[0]?.warnings[0]?.severity, 'warning')
  })
})

describe('selector resolution failure severity', () => {
  const lint = async (warningOverride: boolean) => {
    const parentSelectors = Array.from({ length: 32 }, (_, index) => `.block-${index}`).join(', ')
    const childSelectors = Array.from({ length: 32 }, (_, index) => `.title-${index}`).join(', ')
    const ruleConfig = warningOverride
      ? [true, { severity: 'warning' }]
      : [
          true,
          withClassMode({
            elementDepth: 4,
            comments: { shared: /--shared/i, interaction: /--interaction/i }
          })
        ]
    return stylelint.lint({
      code: `${parentSelectors} { ${childSelectors} { margin-top: 8px; } }`,
      config: {
        plugins: [propertyPlacement],
        rules: { [propertyPlacement.ruleName]: ruleConfig }
      },
      customSyntax: 'postcss-scss'
    })
  }

  it('uses error by default for selector resolution skips', async () => {
    const result = await lint(false)
    const warning = result.results[0]?.warnings.find((entry) => entry.text.startsWith('Selector resolution exceeded'))
    assert.ok(warning)
    assert.strictEqual(warning.severity, 'error')
  })

  it('allows an explicit rule-level warning override', async () => {
    const result = await lint(true)
    const warning = result.results[0]?.warnings.find((entry) => entry.text.startsWith('Selector resolution exceeded'))
    assert.ok(warning)
    assert.strictEqual(warning.severity, 'warning')
  })
})
