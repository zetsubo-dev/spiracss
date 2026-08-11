import * as assert from 'assert'
import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { loadSpiracssConfig } from '../src/config-loader'
import { resolveProjectOptions } from '../src/config-options'

describe('config-loader', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures')
  const cjsConfigPath = path.join(fixturesDir, 'cjs', 'spiracss.config.js')
  const esmConfigPath = path.join(fixturesDir, 'esm', 'spiracss.config.js')
  const invalidConfigPath = path.join(fixturesDir, 'invalid', 'spiracss.config.js')
  const missingConfigPath = path.join(fixturesDir, 'missing', 'spiracss.config.js')

  it('loads a CJS config', async () => {
    const config = await loadSpiracssConfig(cjsConfigPath)
    assert.ok(config)
    const jsxBindings = (config as Record<string, unknown>).jsxClassBindings as Record<string, unknown>
    const allowlist = (jsxBindings?.memberAccessAllowlist as string[]) ?? []
    const generator = (config as Record<string, unknown>).generator as Record<string, unknown>
    assert.strictEqual(generator.childScssDir, 'scss')
    assert.deepStrictEqual(allowlist, ['styles', 'classes'])
  })

  it('allows an empty page entry subdirectory', () => {
    const options = resolveProjectOptions({ generator: { pageEntrySubdir: '' } })
    assert.strictEqual(options.pageEntryPrefix, '@assets')
  })

  it('loads an ESM config via import fallback', async () => {
    const config = await loadSpiracssConfig(esmConfigPath)
    assert.ok(config)
    const jsxBindings = (config as Record<string, unknown>).jsxClassBindings as Record<string, unknown>
    const allowlist = (jsxBindings?.memberAccessAllowlist as string[]) ?? []
    const htmlFormat = (config as Record<string, unknown>).htmlFormat as Record<string, unknown>
    assert.strictEqual(htmlFormat.classAttribute, 'className')
    assert.deepStrictEqual(allowlist, ['styles'])
  })

  it('reloads ESM config content even when mtime and size are unchanged', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-reload-'))
    const configPath = path.join(tempDir, 'spiracss.config.js')
    const packageJsonPath = path.join(tempDir, 'package.json')
    const first = 'export default { generator: { childScssDir: "one", globalScssModule: "@one" } }'
    const second = 'export default { generator: { childScssDir: "two", globalScssModule: "@two" } }'
    const mtime = new Date('2026-01-01T00:00:00.000Z')

    try {
      fs.writeFileSync(packageJsonPath, '{ "type": "module" }', 'utf8')
      fs.writeFileSync(configPath, first, 'utf8')
      fs.utimesSync(configPath, mtime, mtime)
      const initial = await loadSpiracssConfig(configPath)

      fs.writeFileSync(configPath, second, 'utf8')
      fs.utimesSync(configPath, mtime, mtime)
      const reloaded = await loadSpiracssConfig(configPath)

      assert.strictEqual(first.length, second.length)
      assert.strictEqual((initial?.generator as Record<string, unknown>).childScssDir, 'one')
      assert.strictEqual((reloaded?.generator as Record<string, unknown>).childScssDir, 'two')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('reloads ESM dependencies when only an imported module changes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-dependency-'))
    const configPath = path.join(tempDir, 'spiracss.config.js')
    const sharedPath = path.join(tempDir, 'shared.js')
    const packageJsonPath = path.join(tempDir, 'package.json')

    try {
      fs.writeFileSync(packageJsonPath, '{ "type": "module" }', 'utf8')
      fs.writeFileSync(sharedPath, 'export default { childScssDir: "one", globalScssModule: "@one" }', 'utf8')
      fs.writeFileSync(configPath, 'import shared from "./shared.js"; export default { generator: shared }', 'utf8')

      const initial = await loadSpiracssConfig(configPath)
      fs.writeFileSync(sharedPath, 'export default { childScssDir: "two", globalScssModule: "@two" }', 'utf8')
      const reloaded = await loadSpiracssConfig(configPath)

      assert.strictEqual((initial?.generator as Record<string, unknown>).childScssDir, 'one')
      assert.strictEqual((reloaded?.generator as Record<string, unknown>).childScssDir, 'two')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects an ESM config that exits before returning a value', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-exit-'))
    const configPath = path.join(tempDir, 'spiracss.config.js')
    const packageJsonPath = path.join(tempDir, 'package.json')

    try {
      fs.writeFileSync(packageJsonPath, '{ "type": "module" }', 'utf8')
      fs.writeFileSync(configPath, 'process.exit(0)', 'utf8')
      await assert.rejects(loadSpiracssConfig(configPath), /exited before returning a result/)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects an ESM config that never settles at the safety timeout', async function () {
    this.timeout(15_000)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-config-timeout-'))
    const configPath = path.join(tempDir, 'spiracss.config.js')
    const packageJsonPath = path.join(tempDir, 'package.json')

    try {
      fs.writeFileSync(packageJsonPath, '{ "type": "module" }', 'utf8')
      fs.writeFileSync(configPath, 'setInterval(() => {}, 1000); await new Promise(() => {})', 'utf8')
      await assert.rejects(loadSpiracssConfig(configPath), /timed out after 10000ms/)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
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
      const result = spawnSync(process.execPath, ['--disallow-code-generation-from-strings', lintCliPath, '--stdin'], {
        cwd: tempDir,
        input: '<div class="hero-banner"></div>',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      if (result.status === 0) {
        assert.match(result.stdout || '', /No SpiraCSS HTML structure errors\./)
      } else {
        assert.match(result.stderr || '', /Failed to load spiracss.config.js/)
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
