import assert from 'node:assert/strict'
import path from 'node:path'

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

describe('selector failure locations', () => {
  const plugins = [
    classStructure,
    interactionProperties,
    interactionScope,
    keyframesNaming,
    pageLayer,
    propertyPlacement,
    pseudoNesting,
    relComments
  ]
  const lint = async (plugin: { ruleName: string }, code: string) => {
    const result = await stylelint.lint({
      code,
      codeFilename: path.resolve('src/assets/css/about.scss'),
      config: {
        plugins: [plugin],
        rules: {
          [plugin.ruleName]:
            plugin === pageLayer
              ? [
                  true,
                  {
                    aliasRoots: { assets: [path.resolve('src/assets')], components: [path.resolve('src/components')] },
                    pageEntryAlias: 'assets',
                    pageEntrySubdir: 'css',
                    componentsDirs: [path.resolve('src/components')]
                  }
                ]
              : true
        }
      },
      customSyntax: 'postcss-scss'
    })
    return result.results[0]!.warnings.filter(
      (warning) =>
        warning.text.startsWith('Failed to parse one or more selectors') ||
        warning.text.startsWith('Sass nested property group') ||
        warning.text.startsWith('Selector resolution exceeded')
    )
  }

  for (const plugin of plugins) {
    for (const withBrokenSelector of [false, true]) {
      it(`handles Sass nested property groups${withBrokenSelector ? ' with a broken selector' : ''} (${plugin.ruleName})`, async () => {
        const code =
          '.test-card {\n  font: { family: serif; }\n  border: { color: red; }\n  background: { color: blue; }\n}' +
          (withBrokenSelector ? '\n.foo:: { color: red; }' : '')
        const warnings = await lint(plugin, code)
        const checksDeclarations = plugin === propertyPlacement || plugin === interactionProperties
        const docs = `Docs: https://spiracss.jp/stylelint-rules/${plugin.ruleName.replace('spiracss/', '')}/#selectorParseFailed (${plugin.ruleName})`
        const expected = checksDeclarations
          ? ['font:', 'border:', 'background:'].map((group, index) => ({
              line: index + 2,
              column: 3,
              severity: 'error',
              text:
                `Sass nested property group \`${group}\` is not analyzed by this rule, so the declarations inside it were not checked. ` +
                `Flatten the group into prefixed properties in the same owning rule, preserving all values. ${docs}`
            }))
          : []
        if (withBrokenSelector) {
          expected.push({
            line: 6,
            column: 1,
            severity: 'error',
            text:
              'Failed to parse one or more selectors, so some checks were skipped. ' +
              `Ensure selectors are valid CSS/SCSS or avoid interpolation in selectors. Example: \`.foo::\`. ${docs}`
          })
        }
        assert.deepEqual(
          warnings
            .map(({ line, column, severity, text }) => ({ line, column, severity, text }))
            .sort((a, b) => a.line - b.line || a.column - b.column),
          expected
        )
      })
    }

    it(`does not suppress a later failure with an unrelated disable (${plugin.ruleName})`, async () => {
      const code = `/* stylelint-disable-next-line ${plugin.ruleName} */\n.test-card {}\n.foo:: { color: red; }`
      const warnings = await lint(plugin, code)
      assert.deepEqual(
        warnings.map((warning) => warning.line),
        [3]
      )
    })

    it(`reports repeated selector failures per node with warm caches (${plugin.ruleName})`, async () => {
      const code = '.foo:: { color: red; }\n.foo:: { color: blue; }'
      for (let run = 0; run < 2; run += 1) {
        const warnings = await lint(plugin, code)
        assert.deepEqual(
          warnings.map((warning) => warning.line),
          [1, 2]
        )
      }
    })

    it(`suppresses only the disabled failure (${plugin.ruleName})`, async () => {
      const code = `/* stylelint-disable-next-line ${plugin.ruleName} */\n.foo:: { color: red; }\n.foo:: { color: blue; }`
      const warnings = await lint(plugin, code)
      assert.deepEqual(
        warnings.map((warning) => warning.line),
        [3]
      )
    })
  }

  it('does not attribute a failure to an unparsed matching rule', async () => {
    const warnings = await lint(propertyPlacement, '.test-card {\n.foo:: {}\n.foo:: { color: red; }\n}')
    assert.deepEqual(
      warnings.map((warning) => warning.line),
      [3]
    )
  })

  it('attributes ancestor parsing failures to the ancestor', async () => {
    const code = '.test-card {\n.foo:: {\n.bar { color: red; }\n}\n}'
    assert.deepEqual(
      (await lint(propertyPlacement, code)).map((warning) => warning.line),
      [2]
    )
    const disabled = code.replace('.foo::', `/* stylelint-disable-next-line ${propertyPlacement.ruleName} */\n.foo::`)
    assert.deepEqual(await lint(propertyPlacement, disabled), [])
  })

  it('preserves the original location through a scope view', async () => {
    const warnings = await lint(propertyPlacement, '@scope (.test-card) {\n.foo:: { color: red; }\n}')
    assert.deepEqual(
      warnings.map((warning) => warning.line),
      [2]
    )
  })

  const parents = Array.from({ length: 32 }, (_, index) => `.block-${index}`).join(', ')
  const children = Array.from({ length: 32 }, (_, index) => `.title-${index}`).join(', ')
  const overflowingChild = `${children} { margin-top: 8px; }`

  it('reports each overflowing child at its own location', async () => {
    const code = `${parents} {\n${overflowingChild}\n${overflowingChild}\n}`
    const warnings = await lint(propertyPlacement, code)
    assert.deepEqual(
      warnings.map((warning) => warning.line),
      [2, 3]
    )
  })

  it('uses the overflowing child for disable directives', async () => {
    const directive = `/* stylelint-disable-next-line ${propertyPlacement.ruleName} */`
    const unrelated = `${directive}\n${parents} {\n${overflowingChild}\n}`
    assert.deepEqual(
      (await lint(propertyPlacement, unrelated)).map((warning) => warning.line),
      [3]
    )
    const disabled = `${parents} {\n${directive}\n${overflowingChild}\n}`
    assert.deepEqual(await lint(propertyPlacement, disabled), [])
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
