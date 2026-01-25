import * as assert from 'assert'
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { loadSpiracssConfig } from '../src/config-loader'

describe('config-loader', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures')
  const cjsConfigPath = path.join(fixturesDir, 'cjs', 'spiracss.config.js')
  const esmConfigPath = path.join(fixturesDir, 'esm', 'spiracss.config.js')
  const invalidConfigPath = path.join(fixturesDir, 'invalid', 'spiracss.config.js')
  const missingConfigPath = path.join(fixturesDir, 'missing', 'spiracss.config.js')

  it('loads a CJS config', async () => {
    const config = await loadSpiracssConfig(cjsConfigPath)
    assert.ok(config)
    const jsxBindings = (config as Record<string, unknown>)
      .jsxClassBindings as Record<string, unknown>
    const allowlist = (jsxBindings?.memberAccessAllowlist as string[]) ?? []
    const generator = (config as Record<string, unknown>).generator as Record<string, unknown>
    assert.strictEqual(generator.childScssDir, 'scss')
    assert.deepStrictEqual(allowlist, ['styles', 'classes'])
  })

  it('loads an ESM config via import fallback', async () => {
    const config = await loadSpiracssConfig(esmConfigPath)
    assert.ok(config)
    const jsxBindings = (config as Record<string, unknown>)
      .jsxClassBindings as Record<string, unknown>
    const allowlist = (jsxBindings?.memberAccessAllowlist as string[]) ?? []
    const htmlFormat = (config as Record<string, unknown>).htmlFormat as Record<string, unknown>
    assert.strictEqual(htmlFormat.classAttribute, 'className')
    assert.deepStrictEqual(allowlist, ['styles'])
  })

  it('returns undefined when config does not exist', async () => {
    const config = await loadSpiracssConfig(missingConfigPath)
    assert.strictEqual(config, undefined)
  })

  it('throws when config format is invalid', async () => {
    await assert.rejects(loadSpiracssConfig(invalidConfigPath), /Failed to load spiracss.config.js/)
  })

  it('throws when config exists but is not readable', async function () {
    if (process.platform === 'win32') {
      this.skip()
    }
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      this.skip()
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-'))
    const configPath = path.join(tempDir, 'spiracss.config.js')
    fs.writeFileSync(configPath, 'module.exports = {}', 'utf8')

    try {
      fs.chmodSync(configPath, 0o000)
      await assert.rejects(loadSpiracssConfig(configPath), /Cannot access spiracss.config.js/)
    } finally {
      try {
        fs.chmodSync(configPath, 0o600)
      } catch {
        // ignore cleanup errors
      }
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('throws when config path is a directory', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-dir-'))
    try {
      await assert.rejects(loadSpiracssConfig(tempDir), /Cannot access spiracss.config.js/)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('handles ESM config when code generation is disallowed', function () {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-'))
    const configPath = path.join(tempDir, 'spiracss.config.js')
    const pkgPath = path.join(tempDir, 'package.json')
    const lintCliPath = path.resolve(__dirname, '../dist/html-lint.js')

    try {
      fs.writeFileSync(pkgPath, '{ "type": "module" }', 'utf8')
      fs.writeFileSync(configPath, 'export default { htmlFormat: { classAttribute: "class" } }', 'utf8')
      const result = spawnSync(
        process.execPath,
        ['--disallow-code-generation-from-strings', lintCliPath, '--stdin'],
        {
          cwd: tempDir,
          input: '<div class="hero-banner"></div>',
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }
      )
      if (result.status === 0) {
        assert.match(result.stdout || '', /No SpiraCSS HTML structure errors\./)
      } else {
        assert.match(result.stderr || '', /Dynamic import is unavailable/)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
