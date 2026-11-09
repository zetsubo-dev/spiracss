import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'

const pluginRequire = createRequire(new URL('../packages/stylelint-plugin/package.json', import.meta.url))
const extensionRequire = createRequire(new URL('../vscode/spiracss-html-to-scss/package.json', import.meta.url))
const mochaRequire = createRequire(pluginRequire.resolve('mocha'))
const cliRequire = createRequire(extensionRequire.resolve('@vscode/test-cli'))
const vsceRequire = createRequire(extensionRequire.resolve('@vscode/vsce'))
const c8Require = createRequire(cliRequire.resolve('c8'))
const excludeRequire = createRequire(c8Require.resolve('test-exclude'))
const parents = [
  ['Mocha', mochaRequire],
  ['VS Code test CLI', cliRequire],
  ['VSIX packager', vsceRequire],
  ['coverage test-exclude', excludeRequire]
]

const fixture = (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spiracss-tooling-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  for (const file of ['src/main.js', 'src/nested/child.ts', 'src/skip.test.js', 'src/.hidden.js', 'vendor/ignore.js']) {
    const target = path.join(dir, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, 'export const value = 1\n')
  }
  return dir
}

for (const [name, parentRequire] of parents) {
  test(`${name}: patched glob preserves sync/async discovery and ignores`, async (t) => {
    const cwd = fixture(t)
    assert.equal(parentRequire('glob/package.json').version, '14.0.4')
    const glob = parentRequire('glob')
    const options = { cwd, nodir: true, dot: true, posix: true, windowsPathsNoEscape: true, ignore: ['**/*.test.js'] }
    const expected = ['src/.hidden.js', 'src/main.js', 'src/nested/child.ts']
    const pattern = 'src/**/*.{js,ts}'
    assert.equal(glob.hasMagic(pattern), true)
    assert.deepEqual(glob.sync(pattern, options).sort(), expected)
    assert.deepEqual((await glob.glob(pattern, options)).sort(), expected)
    const manifest = parentRequire('glob/package.json')
    const esmEntry = manifest.exports['.'].import.default
    const esmUrl = new URL(esmEntry, pathToFileURL(parentRequire.resolve('glob/package.json')))
    assert.notEqual(esmUrl.href, pathToFileURL(parentRequire.resolve('glob')).href)
    const esm = await import(esmUrl.href)
    assert.deepEqual((await esm.glob(pattern, options)).sort(), expected)

    // Mocha watch mode uses these Pattern methods, not the removed isRegExp API.
    const [first] = new glob.Glob('src/**/*.js', options).patterns
    assert.equal(first.globString(), 'src/**/*.js')
    assert.equal(first.pattern(), 'src')
    assert.notEqual(typeof first.rest().pattern(), 'string')
  })

  test(`${name}: patched minimatch preserves include/exclude matching`, () => {
    assert.equal(parentRequire('minimatch/package.json').version, '11.0.5')
    const { minimatch } = parentRequire('minimatch')
    assert.equal(minimatch('src/nested/child.ts', 'src/**/*.{js,ts}'), true)
    assert.equal(minimatch('src/skip.test.js', '**/*.test.js'), true)
    assert.equal(minimatch('src/.hidden.js', 'src/**/*.js'), false)
    assert.equal(minimatch('src/.hidden.js', 'src/**/*.js', { dot: true }), true)
    assert.equal(minimatch('vendor/ignore.js', 'src/**/*.js'), false)
  })
}

test('Mocha: patched diff keeps CommonJS reporter APIs', () => {
  assert.equal(mochaRequire('diff/package.json').version, '8.0.3')
  const diff = mochaRequire('diff')
  const changes = diff.diffLines('before\n', 'after\n')
  assert.ok(changes.some((part) => part.removed && part.value === 'before\n'))
  assert.ok(changes.some((part) => part.added && part.value === 'after\n'))
  assert.match(diff.createPatch('sample', 'before\n', 'after\n'), /-before\n\+after/)
  const reporter = mochaRequire('./lib/reporters/base')
  const output = reporter.generateDiff('before\n', 'after\n')
  assert.match(output, /before/)
  assert.match(output, /after/)
})

test('Mocha: patched serializer retains safe option serialization', () => {
  assert.equal(mochaRequire('serialize-javascript/package.json').version, '7.1.4')
  const serialize = mochaRequire('serialize-javascript')
  const text = serialize({ grep: /sample/gi, date: new Date('2026-01-01T00:00:00Z'), text: '</script>' })
  assert.doesNotMatch(text, /<\/script>/i)
  const value = runInNewContext(`(${text})`)
  assert.equal(value.grep.source, 'sample')
  assert.equal(value.grep.flags, 'gi')
  assert.equal(value.date.toISOString(), '2026-01-01T00:00:00.000Z')
  assert.equal(value.text, '</script>')
})

test('coverage: test-exclude uses patched glob and minimatch together', async (t) => {
  const cwd = fixture(t)
  const TestExclude = c8Require('test-exclude')
  const exclude = new TestExclude({
    cwd,
    include: ['src/**/*'],
    exclude: ['**/*.test.js'],
    extension: ['.js', '.ts']
  })
  assert.equal(exclude.shouldInstrument(path.join(cwd, 'src/main.js')), true)
  assert.equal(exclude.shouldInstrument(path.join(cwd, 'src/skip.test.js')), false)
  assert.equal(exclude.shouldInstrument(path.join(cwd, 'vendor/ignore.js')), false)
  const expected = ['src/.hidden.js', 'src/main.js', 'src/nested/child.ts']
  assert.deepEqual(exclude.globSync().sort(), expected)
  assert.deepEqual((await exclude.glob()).sort(), expected)
})
