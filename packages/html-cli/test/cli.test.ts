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
    assert.strictEqual(result.status, 0)
    const output = JSON.parse(result.stdout) as { ok: boolean; provisional: boolean }
    assert.strictEqual(output.ok, true)
    assert.strictEqual(output.provisional, true)
  })

  it('HTML-to-SCSS also supports explicit provisional mode', () => {
    const result = runTsCli(cliSource, ['--root', '--allow-provisional', '--json', htmlPath], projectDir)
    assert.strictEqual(result.status, 0)
    const output = JSON.parse(result.stdout) as { ok: boolean; provisional: boolean }
    assert.strictEqual(output.ok, true)
    assert.strictEqual(output.provisional, true)
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
})
