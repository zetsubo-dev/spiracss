import assert from 'assert'
import path from 'path'

import { createRules, createRulesAsync } from '../dist/esm/helpers.js'

describe('helpers/createRules', () => {
  it('builds rules from a config object', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/components']
      },
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded'] }
      },
      generator: {
        childScssDir: 'scss',
        rootFileCase: 'kebab'
      },
      stylelint: {
        base: {
          comments: {
            shared: /--shared/i,
            interaction: /--interaction/i
          }
        },
        class: {},
        interactionScope: {},
        interactionProps: {},
        pseudo: {},
        rel: {}
      }
    })

    const ruleKeys = Object.keys(rules).sort()
    assert.deepStrictEqual(ruleKeys, [
      'spiracss/class-structure',
      'spiracss/interaction-properties',
      'spiracss/interaction-scope',
      'spiracss/keyframes-naming',
      'spiracss/page-layer',
      'spiracss/property-placement',
      'spiracss/pseudo-nesting',
      'spiracss/rel-comments'
    ])

    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { aliasRoots?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.deepStrictEqual(relComments[1].aliasRoots, { components: ['src/components'] })

    const classStructure = rules['spiracss/class-structure'] as [
      boolean,
      { comments?: { shared?: RegExp; interaction?: RegExp } }
    ]
    assert.ok(classStructure[1].comments?.shared instanceof RegExp)
    assert.ok(classStructure[1].comments?.interaction instanceof RegExp)
    assert.strictEqual(classStructure[1].comments?.shared?.source, '--shared')
    assert.strictEqual(classStructure[1].comments?.interaction?.source, '--interaction')
  })

  it('applies defaults when stylelint sections are missing', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/components']
      }
    })

    const ruleKeys = Object.keys(rules).sort()
    assert.deepStrictEqual(ruleKeys, [
      'spiracss/class-structure',
      'spiracss/interaction-properties',
      'spiracss/interaction-scope',
      'spiracss/keyframes-naming',
      'spiracss/page-layer',
      'spiracss/property-placement',
      'spiracss/pseudo-nesting',
      'spiracss/rel-comments'
    ])

    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { aliasRoots?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.deepStrictEqual(relComments[1].aliasRoots, { components: ['src/components'] })
  })

  it('uses aliasRoots.components as default componentsDirs', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/_includes/components']
      }
    })

    const classStructure = rules['spiracss/class-structure'] as [
      boolean,
      { componentsDirs?: unknown }
    ]
    assert.strictEqual(classStructure[0], true)
    assert.deepStrictEqual(classStructure[1].componentsDirs, ['src/_includes/components'])

    const pageLayer = rules['spiracss/page-layer'] as [
      boolean,
      { componentsDirs?: unknown }
    ]
    assert.strictEqual(pageLayer[0], true)
    assert.deepStrictEqual(pageLayer[1].componentsDirs, ['src/_includes/components'])
  })

  it('prefers stylelint.base.paths.components over aliasRoots.components', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/_includes/components']
      },
      stylelint: {
        base: {
          paths: {
            components: ['components']
          }
        }
      }
    })

    const classStructure = rules['spiracss/class-structure'] as [
      boolean,
      { componentsDirs?: unknown }
    ]
    assert.strictEqual(classStructure[0], true)
    assert.deepStrictEqual(classStructure[1].componentsDirs, ['components'])
  })

  it('does not propagate class.rootCase to rel.fileCase by default', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/components']
      },
      stylelint: {
        class: {
          rootCase: 'pascal'
        },
        rel: {}
      }
    })

    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { fileCase?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.strictEqual(relComments[1].fileCase, undefined)
  })

  it('propagates generator file cases to rel when missing', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/components']
      },
      generator: {
        rootFileCase: 'pascal',
        childFileCase: 'kebab'
      },
      stylelint: {
        rel: {}
      }
    })

    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { fileCase?: unknown; childFileCase?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.strictEqual(relComments[1].fileCase, 'pascal')
    assert.strictEqual(relComments[1].childFileCase, 'kebab')
  })

  it('propagates top-level fileCase to class and rel when missing', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/components']
      },
      fileCase: {
        root: 'pascal',
        child: 'kebab'
      },
      stylelint: {
        class: {},
        rel: {}
      }
    })

    const classStructure = rules['spiracss/class-structure'] as [
      boolean,
      { rootCase?: unknown }
    ]
    assert.strictEqual(classStructure[0], true)
    assert.strictEqual(classStructure[1].rootCase, 'pascal')

    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { fileCase?: unknown; childFileCase?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.strictEqual(relComments[1].fileCase, 'pascal')
    assert.strictEqual(relComments[1].childFileCase, 'kebab')
  })

  it('disables keyframes-naming when enabled is false', () => {
    const rules = createRules({
      aliasRoots: {
        components: ['src/components']
      },
      stylelint: {
        keyframes: {
          enabled: false
        }
      }
    })

    assert.strictEqual(rules['spiracss/keyframes-naming'], false)
  })

  it('rejects missing aliasRoots', () => {
    assert.throws(
      () => createRules({}),
      /Missing aliasRoots section in spiracss\.config\.js/
    )
  })

  it('rejects invalid aliasRoots', () => {
    assert.throws(
      () =>
        createRules({
          aliasRoots: [] as unknown as Record<string, string[]>
        }),
      /Invalid aliasRoots section in spiracss\.config\.js/
    )
  })

  it('rejects invalid stylelint section types', () => {
    assert.throws(
      () =>
        createRules({
          aliasRoots: { components: ['src/components'] },
          stylelint: [] as unknown as Record<string, unknown>
        }),
      /Invalid stylelint section in spiracss\.config\.js/
    )
  })

  it('rejects path usage in createRules (sync)', () => {
    // @ts-expect-error -- createRules no longer accepts string; verify runtime guard
    assert.throws(() => createRules('./spiracss.config.js'), /createRules\(\) requires a config object/)
  })

  it('loads an ESM config file via createRulesAsync', async () => {
    const configPath = path.resolve('__tests__/fixtures/spiracss.config.js')
    const rules = await createRulesAsync(configPath)
    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { aliasRoots?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.deepStrictEqual(relComments[1].aliasRoots, { components: ['src/components'] })
  })

  it('disables keyframes-naming when enabled is false in createRulesAsync', async () => {
    const rules = await createRulesAsync({
      aliasRoots: {
        components: ['src/components']
      },
      stylelint: {
        keyframes: {
          enabled: false
        }
      }
    })

    assert.strictEqual(rules['spiracss/keyframes-naming'], false)
  })

  it('rejects missing config files in createRulesAsync', async () => {
    const configPath = path.resolve('__tests__/fixtures/missing.config.js')
    await assert.rejects(createRulesAsync(configPath), /not found/)
  })

  it('rejects invalid config exports in createRulesAsync', async () => {
    const configPath = path.resolve('__tests__/fixtures/spiracss.invalid.js')
    await assert.rejects(createRulesAsync(configPath), /Failed to load spiracss.config.js/)
  })

  it('applies defaults when stylelint sections are missing in createRulesAsync', async () => {
    const configPath = path.resolve('__tests__/fixtures/spiracss.missing-stylelint.js')
    const rules = await createRulesAsync(configPath)
    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { aliasRoots?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.deepStrictEqual(relComments[1].aliasRoots, { components: ['src/components'] })
  })

  it('rejects invalid stylelint section types in createRulesAsync', async () => {
    const configPath = path.resolve('__tests__/fixtures/spiracss.invalid-stylelint.js')
    await assert.rejects(
      createRulesAsync(configPath),
      /Invalid stylelint section in spiracss\.config\.js/
    )
  })

})
