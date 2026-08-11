import assert from 'assert'
import { spawnSync } from 'child_process'
import { promises as fsp } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { after, before, describe, it } from 'mocha'

const cliSource = path.resolve('src/cli.ts')
const lintSource = path.resolve('src/html-lint.ts')
const tsNodeRegister = path.resolve('node_modules/ts-node/register/index.js')

function runTsCli(
  entry: string,
  args: string[],
  cwd: string
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ['-r', tsNodeRegister, entry, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      TS_NODE_PROJECT: path.resolve('tsconfig.json'),
      TS_NODE_TRANSPILE_ONLY: '1'
    }
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  }
}

describe('CLI config safety contract', () => {
  let projectDir: string
  let htmlPath: string

  before(async () => {
    projectDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'spiracss-html-cli-'))
    htmlPath = path.join(projectDir, 'component.html')
    await fsp.writeFile(htmlPath, '<div class="hero-section"><span class="title"></span></div>', 'utf8')
  })

  after(async () => {
    await fsp.rm(projectDir, { recursive: true, force: true })
  })

  it('rejects ambiguous or unknown CLI arguments', function () {
    this.timeout(15000)
    const cases = [
      ['--root', '--selection', '--allow-provisional', '--json', htmlPath],
      ['--base-dir', '--allow-provisional', '--json', htmlPath],
      ['--stdin', '--allow-provisional', '--json', htmlPath],
      ['--root', '--unknown-option', '--allow-provisional', '--json', htmlPath],
      ['--root', '--allow-provisional', '--json', htmlPath, 'extra.html']
    ]

    const entryCases: Array<[string, string[][]]> = [
      [cliSource, cases],
      [
        lintSource,
        [
          ...cases,
          ['--base-dir', projectDir, '--json', htmlPath],
          ['--dry-run', '--json', htmlPath],
          ['--ignore-structure-errors', '--json', htmlPath]
        ]
      ]
    ]
    for (const [entry, entryArgs] of entryCases) {
      for (const args of entryArgs) {
        const result = runTsCli(entry, args, projectDir)
        assert.strictEqual(result.status, 1)
        assert.match(result.stderr, /Usage error/)
      }
    }
  })

  it('HTML lint blocks missing config with a parseable JSON envelope', () => {
    const result = runTsCli(lintSource, ['--root', '--json', htmlPath], projectDir)
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as { ok: boolean; blocked?: { code: string }; provisional: boolean }
    assert.strictEqual(output.ok, false)
    assert.deepStrictEqual(output.blocked?.code, 'CONFIG_MISSING')
    assert.strictEqual(output.provisional, true)
  })

  it('HTML-to-SCSS blocks missing config with the input file in JSON', () => {
    const result = runTsCli(cliSource, ['--root', '--json', htmlPath], projectDir)
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as {
      ok: boolean
      file: string
      blocked?: { code: string }
      files: unknown[]
    }
    assert.strictEqual(output.ok, false)
    assert.strictEqual(output.file, htmlPath)
    assert.deepStrictEqual(output.blocked?.code, 'CONFIG_MISSING')
    assert.deepStrictEqual(output.files, [])
  })

  it('config blocking takes precedence over input file errors', () => {
    const missingInput = path.join(projectDir, 'does-not-exist.html')
    const result = runTsCli(lintSource, ['--root', '--json', missingInput], projectDir)
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as { blocked?: { code: string } }
    assert.deepStrictEqual(output.blocked?.code, 'CONFIG_MISSING')

    const generatorResult = runTsCli(cliSource, ['--root', '--json', missingInput], projectDir)
    assert.strictEqual(generatorResult.status, 1)
    const generatorOutput = JSON.parse(generatorResult.stdout) as { blocked?: { code: string } }
    assert.deepStrictEqual(generatorOutput.blocked?.code, 'CONFIG_MISSING')
  })

  it('explicit provisional mode remains available', () => {
    const result = runTsCli(lintSource, ['--root', '--allow-provisional', '--json', htmlPath], projectDir)
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as { ok: boolean; provisional: boolean; status: string }
    assert.strictEqual(output.ok, false)
    assert.strictEqual(output.provisional, true)
    assert.strictEqual(output.status, 'provisional')
  })

  it('HTML-to-SCSS also supports explicit provisional mode', () => {
    const result = runTsCli(cliSource, ['--root', '--allow-provisional', '--json', htmlPath], projectDir)
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as { ok: boolean; provisional: boolean; status: string }
    assert.strictEqual(output.ok, false)
    assert.strictEqual(output.provisional, true)
    assert.strictEqual(output.status, 'provisional')
  })

  it('ignored structure errors remain non-pass in the JSON contract', async () => {
    const invalidHtmlPath = path.join(projectDir, 'invalid.html')
    await fsp.writeFile(invalidHtmlPath, '<div class="hero-section"><p>Text</p></div>', 'utf8')
    const result = runTsCli(
      cliSource,
      ['--root', '--allow-provisional', '--ignore-structure-errors', '--json', invalidHtmlPath],
      projectDir
    )
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as { ok: boolean; status: string; errors: unknown[]; files: unknown[] }
    assert.strictEqual(output.ok, false)
    assert.strictEqual(output.status, 'ignored')
    assert.ok(output.errors.length > 0)
    assert.ok(output.files.length > 0)
  })

  it('keeps generation safety failures inside the JSON envelope', async () => {
    const deepHtmlPath = path.join(projectDir, 'deep.html')
    const depth = 258
    await fsp.writeFile(
      deepHtmlPath,
      `<div class="root-block">${'<div>'.repeat(depth - 1)}${'</div>'.repeat(depth - 1)}</div>`,
      'utf8'
    )
    const result = runTsCli(
      cliSource,
      ['--root', '--allow-provisional', '--ignore-structure-errors', '--json', deepHtmlPath],
      projectDir
    )
    assert.strictEqual(result.status, 1)
    const output = JSON.parse(result.stdout) as {
      ok: boolean
      status: string
      blocked?: { code: string }
      files: unknown[]
    }
    assert.strictEqual(output.ok, false)
    assert.strictEqual(output.status, 'blocked')
    assert.strictEqual(output.blocked?.code, 'MAX_DEPTH_EXCEEDED')
    assert.deepStrictEqual(output.files, [])

    const lintResult = runTsCli(lintSource, ['--root', '--allow-provisional', '--json', deepHtmlPath], projectDir)
    assert.strictEqual(lintResult.status, 1)
    const lintOutput = JSON.parse(lintResult.stdout) as {
      ok: boolean
      status: string
      blocked?: { code: string }
    }
    assert.strictEqual(lintOutput.ok, false)
    assert.strictEqual(lintOutput.status, 'blocked')
    assert.strictEqual(lintOutput.blocked?.code, 'MAX_DEPTH_EXCEEDED')

    const normalGeneratorResult = runTsCli(
      cliSource,
      ['--root', '--allow-provisional', '--json', deepHtmlPath],
      projectDir
    )
    assert.strictEqual(normalGeneratorResult.status, 1)
    const normalGeneratorOutput = JSON.parse(normalGeneratorResult.stdout) as {
      ok: boolean
      status: string
      blocked?: { code: string }
    }
    assert.strictEqual(normalGeneratorOutput.ok, false)
    assert.strictEqual(normalGeneratorOutput.status, 'blocked')
    assert.strictEqual(normalGeneratorOutput.blocked?.code, 'MAX_DEPTH_EXCEEDED')
  })

  it('JSON issues retain an unambiguous targetPath', () => {
    const repeatedHtmlPath = path.join(projectDir, 'repeated.html')
    return fsp
      .writeFile(
        repeatedHtmlPath,
        '<div class="root-block"><section class="card-block"><p>A</p></section><section class="card-block"><p>B</p></section></div>',
        'utf8'
      )
      .then(() => {
        const result = runTsCli(lintSource, ['--root', '--allow-provisional', '--json', repeatedHtmlPath], projectDir)
        assert.strictEqual(result.status, 1)
        const output = JSON.parse(result.stdout) as {
          errors: Array<{ targetPath?: Array<{ siblingIndex: number }> }>
        }
        const paths = output.errors
          .filter((issue) => issue.targetPath)
          .map((issue) => issue.targetPath?.map((target) => target.siblingIndex))
        assert.deepStrictEqual(paths, [
          [1, 1, 1],
          [1, 2, 1]
        ])
      })
  })

  it('malformed config returns JSON instead of mixing text into stdout', async () => {
    await fsp.writeFile(path.join(projectDir, 'spiracss.config.js'), 'module.exports = {', 'utf8')
    try {
      const result = runTsCli(lintSource, ['--root', '--json', htmlPath], projectDir)
      assert.strictEqual(result.status, 1)
      const output = JSON.parse(result.stdout) as { ok: boolean; blocked?: { code: string } }
      assert.strictEqual(output.ok, false)
      assert.deepStrictEqual(output.blocked?.code, 'CONFIG_LOAD_ERROR')

      const generatorResult = runTsCli(cliSource, ['--root', '--json', htmlPath], projectDir)
      assert.strictEqual(generatorResult.status, 1)
      const generatorOutput = JSON.parse(generatorResult.stdout) as { ok: boolean; blocked?: { code: string } }
      assert.strictEqual(generatorOutput.ok, false)
      assert.deepStrictEqual(generatorOutput.blocked?.code, 'CONFIG_LOAD_ERROR')
    } finally {
      await fsp.rm(path.join(projectDir, 'spiracss.config.js'), { force: true })
    }
  })

  it('invalid consumed config values fail closed for both CLI entry points', async () => {
    await fsp.writeFile(
      path.join(projectDir, 'spiracss.config.js'),
      'module.exports = { stylelint: { class: "broken" } }',
      'utf8'
    )
    try {
      const lintResult = runTsCli(lintSource, ['--root', '--json', htmlPath], projectDir)
      assert.strictEqual(lintResult.status, 1)
      const lintOutput = JSON.parse(lintResult.stdout) as { ok: boolean; blocked?: { code: string } }
      assert.strictEqual(lintOutput.ok, false)
      assert.strictEqual(lintOutput.blocked?.code, 'CONFIG_LOAD_ERROR')

      const generatorResult = runTsCli(cliSource, ['--root', '--json', htmlPath], projectDir)
      assert.strictEqual(generatorResult.status, 1)
      const generatorOutput = JSON.parse(generatorResult.stdout) as { ok: boolean; blocked?: { code: string } }
      assert.strictEqual(generatorOutput.ok, false)
      assert.strictEqual(generatorOutput.blocked?.code, 'CONFIG_LOAD_ERROR')
    } finally {
      await fsp.rm(path.join(projectDir, 'spiracss.config.js'), { force: true })
    }
  })

  it('rejects unknown consumed config keys instead of silently using defaults', async () => {
    await fsp.writeFile(
      path.join(projectDir, 'spiracss.config.js'),
      "module.exports = { generator: { childScssDri: 'outside' } }",
      'utf8'
    )
    try {
      const result = runTsCli(cliSource, ['--root', '--json', htmlPath], projectDir)
      assert.strictEqual(result.status, 1)
      const output = JSON.parse(result.stdout) as {
        ok: boolean
        blocked?: { code: string }
        config?: { status: string }
      }
      assert.strictEqual(output.ok, false)
      assert.strictEqual(output.blocked?.code, 'CONFIG_LOAD_ERROR')
      assert.strictEqual(output.config?.status, 'error')
    } finally {
      await fsp.rm(path.join(projectDir, 'spiracss.config.js'), { force: true })
    }
  })

  it('rejects a childScssDir that escapes the document directory', async () => {
    await fsp.writeFile(
      path.join(projectDir, 'spiracss.config.js'),
      "module.exports = { generator: { childScssDir: '../outside' } }",
      'utf8'
    )
    try {
      const result = runTsCli(cliSource, ['--root', '--json', htmlPath], projectDir)
      assert.strictEqual(result.status, 1)
      const output = JSON.parse(result.stdout) as { blocked?: { code: string }; ok: boolean }
      assert.strictEqual(output.ok, false)
      assert.strictEqual(output.blocked?.code, 'CONFIG_LOAD_ERROR')
    } finally {
      await fsp.rm(path.join(projectDir, 'spiracss.config.js'), { force: true })
    }
  })
})
