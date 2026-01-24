import assert from 'assert'
import { spawnSync } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'

import { createRules, createRulesAsync } from '../dist/esm/helpers.js'

const requireCjs = createRequire(import.meta.url)

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

  it('propagates class.rootCase to rel.fileCase when not specified', () => {
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
    assert.strictEqual(relComments[1].fileCase, 'pascal')
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

  it('rejects path usage in ESM environments', () => {
    assert.throws(() => createRules('./spiracss.config.js'), /createRules\(\) cannot accept a file path/)
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

  it('loads an ESM config file via createRulesAsync in CJS build', async () => {
    const configPath = path.resolve('__tests__/fixtures/spiracss.config.js')
    const { createRulesAsync: createRulesAsyncCjs } = requireCjs('../dist/cjs/helpers.js') as {
      createRulesAsync: (configPathOrConfig?: string | Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const rules = await createRulesAsyncCjs(configPath)
    const relComments = rules['spiracss/rel-comments'] as [
      boolean,
      { aliasRoots?: unknown }
    ]
    assert.strictEqual(relComments[0], true)
    assert.deepStrictEqual(relComments[1].aliasRoots, { components: ['src/components'] })
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

  it('handles --disallow-code-generation-from-strings in ESM and CJS', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-test-'))
    const configPath = path.resolve('__tests__/fixtures/spiracss.config.js')
    const esmHelpersUrl = pathToFileURL(path.resolve('dist/esm/helpers.js')).href
    const cjsHelpersPath = path.resolve('dist/cjs/helpers.js')
    const esmScriptPath = path.join(tempDir, 'disallow-esm.mjs')
    const cjsScriptPath = path.join(tempDir, 'disallow-cjs.cjs')

    const runNodeWithNoCodeGen = (scriptPath: string) => {
      const result = spawnSync(process.execPath, ['--disallow-code-generation-from-strings', scriptPath], {
        cwd: process.cwd(),
        encoding: 'utf8'
      })
      if (result.error) {
        throw result.error
      }
      return result
    }

    try {
      fs.writeFileSync(
        esmScriptPath,
        [
          `import { createRulesAsync } from ${JSON.stringify(esmHelpersUrl)};`,
          `const configPath = ${JSON.stringify(configPath)};`,
          `const rules = await createRulesAsync(configPath);`,
          `if (!rules || !rules['spiracss/rel-comments']) {`,
          `  throw new Error('Missing rel-comments rules');`,
          `}`,
          `console.log('esm-ok');`
        ].join('\n')
      )

      fs.writeFileSync(
        cjsScriptPath,
        [
          `const { createRulesAsync } = require(${JSON.stringify(cjsHelpersPath)});`,
          `const configPath = ${JSON.stringify(configPath)};`,
          `;(async () => {`,
          `  try {`,
          `    await createRulesAsync(configPath);`,
          `    console.log('cjs-ok');`,
          `  } catch (error) {`,
          `    const message = error instanceof Error ? error.message : String(error);`,
          `    if (!message.includes('Dynamic import is unavailable')) {`,
          `      console.error(message);`,
          `      process.exit(1);`,
          `    }`,
          `    console.log('cjs-expected-error');`,
          `  }`,
          `})();`
        ].join('\n')
      )

      const esmResult = runNodeWithNoCodeGen(esmScriptPath)
      assert.strictEqual(esmResult.status, 0)
      assert.match(esmResult.stdout || '', /esm-ok/)

      const cjsResult = runNodeWithNoCodeGen(cjsScriptPath)
      assert.strictEqual(cjsResult.status, 0)
      assert.match(cjsResult.stdout || '', /cjs-(ok|expected-error)/)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
