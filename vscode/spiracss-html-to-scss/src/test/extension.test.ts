import * as assert from 'assert'
import * as path from 'path'
import * as vscode from 'vscode'
import * as fs from 'fs'
import { createRequire } from 'module'
import { generationCoverageLine } from '../generation-output'
import {
  adjustLintIssuePositions,
  diagnosticsForLintIssues,
  formatLintIssueLines,
  getLintRuleMessage,
  isProvisionalContinuationConfirmed
} from '../extension'

suite('SpiraCSS HTML to SCSS Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.')

  const fixturesDir = path.join(__dirname, '../../fixtures')
  const configPath = path.join(fixturesDir, 'spiracss.config.js')
  const packageJsonPath = path.join(fixturesDir, 'package.json')
  const cjsConfigContent = [
    'module.exports = {',
    '  generator: {',
    "    globalScssModule: '@styles/fixtures-global',",
    "    pageEntryAlias: 'assets',",
    "    pageEntrySubdir: 'css',",
    "    childScssDir: 'scss-test',",
    "    layoutMixins: ['@include breakpoint-up(md)'],",
    "    rootFileCase: 'pascal',",
    "    childFileCase: 'pascal'",
    '  },',
    '  selectorPolicy: {',
    "    variant: { mode: 'class' },",
    "    state: { mode: 'class' }",
    '  },',
    '  htmlFormat: {',
    "    classAttribute: 'className'",
    '  }',
    '}',
    ''
  ].join('\n')
  const cjsFileCaseConfigContent = [
    'module.exports = {',
    "  fileCase: { root: 'pascal', child: 'kebab' },",
    '  generator: {',
    "    globalScssModule: '@styles/fixtures-global',",
    "    pageEntryAlias: 'assets',",
    "    pageEntrySubdir: 'css',",
    "    childScssDir: 'scss-test',",
    "    layoutMixins: ['@include breakpoint-up(md)']",
    '  },',
    '  selectorPolicy: {',
    "    variant: { mode: 'class' },",
    "    state: { mode: 'class' }",
    '  },',
    '  htmlFormat: {',
    "    classAttribute: 'className'",
    '  }',
    '}',
    ''
  ].join('\n')
  const cjsDataConfigContent = [
    'module.exports = {',
    '  generator: {',
    "    globalScssModule: '@styles/fixtures-global',",
    "    pageEntryAlias: 'assets',",
    "    pageEntrySubdir: 'css',",
    "    childScssDir: 'scss-test',",
    "    layoutMixins: ['@include breakpoint-up(md)'],",
    "    rootFileCase: 'pascal',",
    "    childFileCase: 'pascal'",
    '  },',
    '  selectorPolicy: {',
    "    variant: { mode: 'data', dataKeys: ['data-variant'] },",
    "    state: { mode: 'data', dataKey: 'data-state' }",
    '  },',
    '  htmlFormat: {',
    "    classAttribute: 'className'",
    '  }',
    '}',
    ''
  ].join('\n')
  const esmConfigContent = [
    'export default {',
    '  generator: {',
    "    globalScssModule: '@styles/esm-global',",
    "    pageEntryAlias: 'assets',",
    "    pageEntrySubdir: 'css',",
    "    childScssDir: 'scss-esm',",
    "    layoutMixins: ['@include breakpoint-up(md)'],",
    "    rootFileCase: 'camel',",
    "    childFileCase: 'camel'",
    '  },',
    '  selectorPolicy: {',
    "    variant: { mode: 'class' },",
    "    state: { mode: 'class' }",
    '  },',
    '  htmlFormat: {',
    "    classAttribute: 'className'",
    '  }',
    '}',
    ''
  ].join('\n')
  const esmPackageJsonContent = JSON.stringify({ type: 'module' }, null, 2) + '\n'
  let originalConfig: string | null = null
  let originalPackageJson: string | null = null
  let configWriteSeed = 0

  const removePath = (target: string): void => {
    if (!fs.existsSync(target)) return
    fs.rmSync(target, { recursive: true, force: true })
  }

  const writeConfig = (content: string): void => {
    fs.writeFileSync(configPath, content, 'utf8')
    const mtime = new Date(Date.now() + configWriteSeed)
    configWriteSeed += 1
    fs.utimesSync(configPath, mtime, mtime)
  }

  const writePackageJson = (content: string | null): void => {
    if (content === null) {
      removePath(packageJsonPath)
      return
    }
    fs.writeFileSync(packageJsonPath, content, 'utf8')
  }

  const openAndSelectAll = async (filePath: string): Promise<vscode.TextEditor> => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath))
    const editor = await vscode.window.showTextDocument(doc)
    assert.strictEqual(vscode.window.activeTextEditor?.document.uri.toString(), doc.uri.toString())
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
    editor.selection = new vscode.Selection(fullRange.start, fullRange.end)
    return editor
  }

  // A lint failure reveals the Output panel; its focused document would stay the active editor for later commands.
  const hideOutputPanel = async (): Promise<void> => {
    const shown = (): boolean =>
      vscode.window.visibleTextEditors.some((editor) => editor.document.uri.scheme === 'output')
    const until = (expected: boolean): Promise<void> =>
      new Promise((resolve) => {
        if (shown() === expected) return resolve()
        const listener = vscode.window.onDidChangeVisibleTextEditors(() => {
          if (shown() !== expected) return
          listener.dispose()
          resolve()
        })
      })
    await until(true)
    await vscode.commands.executeCommand('workbench.action.closePanel')
    await until(false)
  }

  suiteSetup(() => {
    if (fs.existsSync(configPath)) {
      originalConfig = fs.readFileSync(configPath, 'utf8')
    }
    if (fs.existsSync(packageJsonPath)) {
      originalPackageJson = fs.readFileSync(packageJsonPath, 'utf8')
    }
    writeConfig(cjsConfigContent)
    writePackageJson(null)
  })

  suiteTeardown(() => {
    if (originalConfig === null) {
      removePath(configPath)
    } else {
      writeConfig(originalConfig)
    }
    if (originalPackageJson === null) {
      writePackageJson(null)
    } else {
      writePackageJson(originalPackageJson)
    }
  })

  test('Shared config defaults to explicit scope and selects other root styles', async function () {
    this.timeout(20000)
    const htmlFile = path.join(fixturesDir, 'html/sample-box.html')
    const docDir = path.dirname(htmlFile)
    const rootFile = path.join(docDir, 'SampleBox.scss')
    const childDir = path.join(docDir, 'scss-test')
    try {
      const extension = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(extension)
      await extension.activate()
      for (const style of [undefined, 'class', 'scope', 'scope-explicit']) {
        writeConfig(
          cjsConfigContent.replace(
            "    rootFileCase: 'pascal',",
            style ? `    scssRootStyle: '${style}',\n    rootFileCase: 'pascal',` : "    rootFileCase: 'pascal',"
          )
        )
        removePath(rootFile)
        removePath(childDir)
        await openAndSelectAll(htmlFile)
        await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')
        const content = fs.readFileSync(rootFile, 'utf8')
        assert.strictEqual(content.includes('@scope (.sample-box) {'), style !== 'class')
        assert.strictEqual(content.includes('  :scope {'), style === undefined || style === 'scope-explicit')
        assert.ok(!content.includes('@scope (.hero-header)'))
        const childContent = fs.readFileSync(path.join(childDir, 'HeroHeader.scss'), 'utf8')
        assert.ok(childContent.includes('.hero-header {'))
        assert.ok(!childContent.includes('@scope'))
        removePath(childDir)
        await openAndSelectAll(htmlFile)
        await vscode.commands.executeCommand('extension.generateSpiracssScssFromSelection')
        const selectionContent = fs.readFileSync(path.join(childDir, 'SampleBox.scss'), 'utf8')
        assert.ok(selectionContent.includes('.sample-box {'))
        assert.ok(!selectionContent.includes('@scope'))
      }
    } finally {
      writeConfig(cjsConfigContent)
      removePath(rootFile)
      removePath(childDir)
    }
  })

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('spiracss.spiracss-html-to-scss'))
  })

  test('Provisional continuation is recorded only after confirmation', () => {
    assert.strictEqual(isProvisionalContinuationConfirmed(undefined, 'Continue with provisional settings'), false)
    assert.strictEqual(isProvisionalContinuationConfirmed('Cancel', 'Continue with provisional settings'), false)
    assert.strictEqual(
      isProvisionalContinuationConfirmed('Continue with provisional settings', 'Continue with provisional settings'),
      true
    )
  })

  test('MAX_DEPTH_EXCEEDED has an actionable diagnostic message', () => {
    assert.match(getLintRuleMessage('MAX_DEPTH_EXCEEDED'), /safety limit/i)
  })

  test('lint output includes the source position when available', async () => {
    // Load public core with its own asset directory, not the test bundle's directory.
    const { lintMarkup, loadMarkupParsers } = createRequire(path.join(__dirname, '../../package.json'))(
      '@spiracss/html-cli'
    ) as typeof import('@spiracss/html-cli')
    const parsers = await loadMarkupParsers(['astro'])
    for (const [value, count] of [
      ['open', 1],
      ['"true"', 0]
    ] as const) {
      const result = lintMarkup(`<div class="card-list" aria-expanded={${value}}/>`, {
        format: 'astro',
        mode: 'root',
        config: {},
        parsers
      })
      assert.strictEqual(result.status, 'pass', JSON.stringify(result.errors))
      const line = generationCoverageLine(result.coverage)
      assert.strictEqual(Boolean(line), count > 0)
      if (count) assert.ok(line?.includes('1'))
    }
    assert.strictEqual(generationCoverageLine(undefined), undefined)
    const lines = formatLintIssueLines(
      {
        code: 'CLASSLESS_TAG_NOT_ALLOWED',
        message: 'Add a class.',
        baseClass: '',
        path: ['hero'],
        position: { offset: 10, line: 4, column: 2, endOffset: 20, endLine: 4, endColumn: 10 }
      },
      true
    )
    assert.ok(lines.some((line) => /line 4/.test(line) && /column 2/.test(line)))
  })

  test('lint positions are adjusted from a trimmed selection to document coordinates', () => {
    const adjusted = adjustLintIssuePositions(
      [
        {
          code: 'CLASSLESS_TAG_NOT_ALLOWED',
          message: 'Add a class.',
          baseClass: '',
          path: [],
          range: [0, 5],
          position: { offset: 0, line: 1, column: 1, endOffset: 5, endLine: 1, endColumn: 6 }
        }
      ],
      ' \n  <div></div>\n',
      new vscode.Position(4, 3),
      100
    )
    assert.strictEqual(adjusted[0]?.position?.offset, 104)
    assert.strictEqual(adjusted[0]?.position?.line, 6)
    assert.strictEqual(adjusted[0]?.position?.column, 3)
    assert.deepStrictEqual(adjusted[0]?.range, [104, 109])
  })

  test('keeps positionless issues in output without a fabricated squiggle', async () => {
    const document = await vscode.workspace.openTextDocument({ content: '日本😀\r\nBad_Name', language: 'html' })
    const issue = { code: 'INVALID_BASE_CLASS' as const, message: 'Unknown source location.', baseClass: '', path: [] }
    const located = { ...issue, position: { offset: 6, line: 2, column: 1, endOffset: 14, endLine: 2, endColumn: 9 } }
    const diagnostics = diagnosticsForLintIssues([issue, located], document)
    assert.strictEqual(diagnostics.length, 1)
    assert.strictEqual(document.getText(diagnostics[0].range), 'Bad_Name')
    assert.ok(formatLintIssueLines(issue, true).some((line) => line.includes('Unknown source location.')))
    assert.strictEqual(
      adjustLintIssuePositions([issue], ' \r\n<div/>', new vscode.Position(3, 1), 20)[0].position,
      undefined
    )
  })

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
    assert.ok(ext)
    await ext.activate()
    assert.strictEqual(ext.isActive, true)
  })

  test('generateSpiracssScssFromRoot command should be registered', async () => {
    const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
    assert.ok(ext)
    await ext.activate()

    const commands = await vscode.commands.getCommands(true)
    assert.ok(
      commands.includes('extension.generateSpiracssScssFromRoot'),
      'generateSpiracssScssFromRoot command should be registered'
    )
  })

  test('insertSracssPlaceholders command should be registered', async () => {
    const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
    assert.ok(ext)
    await ext.activate()

    const commands = await vscode.commands.getCommands(true)
    assert.ok(
      commands.includes('extension.insertSracssPlaceholders'),
      'insertSracssPlaceholders command should be registered'
    )
  })

  test('Legacy template extensions keep legacy diagnostics when associated with HTML', async function () {
    this.timeout(20000)
    const extension = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
    assert.ok(extension)
    await extension.activate()

    const source = '<div class="product-card"><p class="title <%= active ? \'-active\' : \'\' %>"></p></div>'
    const formalCodes = ['MULTIPLE_BASE_CLASSES', ...Array.from({ length: 6 }, () => 'UNCLASSIFIED_CLASS_TOKEN')]
    const cases = [
      ...['ejs', 'njk', 'nunjucks', 'svelte'].map((suffix) => ({
        name: `sample.${suffix}`,
        scheme: 'file',
        expectedCodes: ['DYNAMIC_CLASS_UNRESOLVED']
      })),
      { name: 'sample.html', scheme: 'file', expectedCodes: formalCodes },
      { name: 'untitled-source', scheme: 'untitled', expectedCodes: formalCodes }
    ]
    const tempDir = fs.mkdtempSync(path.join(fixturesDir, 'format-selection-'))
    try {
      // Untitled documents have no workspace folder, so config resolves from the document directory.
      fs.writeFileSync(path.join(tempDir, 'spiracss.config.js'), cjsConfigContent, { flag: 'wx' })
      for (const { name, scheme, expectedCodes } of cases) {
        const filePath = path.join(tempDir, name)
        if (scheme === 'file') fs.writeFileSync(filePath, source, { flag: 'wx' })
        const uri = vscode.Uri.file(filePath).with({ scheme })
        const document = await vscode.languages.setTextDocumentLanguage(
          await vscode.workspace.openTextDocument(uri),
          'html'
        )
        const editor = await vscode.window.showTextDocument(document)
        assert.strictEqual(vscode.window.activeTextEditor?.document.uri.toString(), document.uri.toString())
        try {
          if (scheme === 'untitled') {
            assert.ok(await editor.edit((edit) => edit.insert(new vscode.Position(0, 0), source)))
          }
          assert.strictEqual(document.languageId, 'html')
          editor.selection = new vscode.Selection(document.positionAt(0), document.positionAt(source.length))
          const entries = fs.readdirSync(tempDir).sort()

          await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')
          await hideOutputPanel()

          const diagnostics = vscode.languages.getDiagnostics(document.uri).filter((issue) => issue.source === 'SpiraCSS')
          assert.deepStrictEqual(diagnostics.map((issue) => issue.code), expectedCodes, uri.toString())
          assert.deepStrictEqual(fs.readdirSync(tempDir).sort(), entries, 'Lint failures must not generate SCSS')
        } finally {
          await vscode.window.showTextDocument(document)
          await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor')
        }
      }
    } finally {
      removePath(tempDir)
    }
  })

  test('Generate SCSS from HTML fixture file', async function () {
    // Increase timeout (file generation can take time)
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/sample-box.html')
    const docDir = path.dirname(htmlFile)
    const childScssDir = 'scss-test'
    const rootFile = path.join(docDir, 'SampleBox.scss')
    const childDir = path.join(docDir, childScssDir)
    const childFile = path.join(childDir, 'HeroHeader.scss')
    const indexFile = path.join(childDir, 'index.scss')

    removePath(rootFile)
    removePath(childDir)

    try {
      await openAndSelectAll(htmlFile)

      // Ensure the extension is activated
      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()
      assert.strictEqual(ext.isActive, true)

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      assert.ok(fs.existsSync(rootFile), 'Root SCSS should be generated with config rootFileCase')
      assert.ok(fs.existsSync(childDir), 'Child SCSS directory should be generated with config')
      assert.ok(fs.existsSync(childFile), 'Child SCSS should use childFileCase')
      assert.ok(fs.existsSync(indexFile), 'Child index.scss should be generated')

      const rootScss = fs.readFileSync(rootFile, 'utf8')
      assert.ok(
        rootScss.includes("@use '@styles/fixtures-global' as *;"),
        'globalScssModule from config should be reflected'
      )
    } finally {
      // Cleanup
      removePath(rootFile)
      removePath(childDir)
    }
  })

  test('Generate SCSS uses top-level fileCase when generator cases are missing', async function () {
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/sample-box.html')
    const docDir = path.dirname(htmlFile)
    const childScssDir = 'scss-test'
    const rootFile = path.join(docDir, 'SampleBox.scss')
    const childDir = path.join(docDir, childScssDir)
    const childFile = path.join(childDir, 'hero-header.scss')

    removePath(rootFile)
    removePath(childDir)
    writeConfig(cjsFileCaseConfigContent)

    try {
      await openAndSelectAll(htmlFile)

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      assert.ok(fs.existsSync(rootFile), 'Root SCSS should use fileCase.root')
      assert.ok(fs.existsSync(childFile), 'Child SCSS should use fileCase.child')
    } finally {
      removePath(rootFile)
      removePath(childDir)
      writeConfig(cjsConfigContent)
    }
  })

  test('Generate SCSS from data-mode fixture file', async function () {
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/data-box.html')
    const docDir = path.dirname(htmlFile)
    const childScssDir = 'scss-test'
    const rootFile = path.join(docDir, 'DataBox.scss')
    const childDir = path.join(docDir, childScssDir)
    removePath(rootFile)
    removePath(childDir)
    writeConfig(cjsDataConfigContent)

    try {
      await openAndSelectAll(htmlFile)

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      assert.ok(fs.existsSync(rootFile), 'Root SCSS should be generated for data mode')
      const rootScss = fs.readFileSync(rootFile, 'utf8')
      assert.ok(rootScss.includes('&[data-variant="primary"]'), 'data-variant selector should be present')
      assert.ok(rootScss.includes('&[data-state="loading"]'), 'data-state selector should be present')
    } finally {
      removePath(rootFile)
      removePath(childDir)
      writeConfig(cjsConfigContent)
    }
  })

  test('Generate SCSS from selection writes to childScssDir only', async function () {
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/sample-box.html')
    const docDir = path.dirname(htmlFile)
    const childScssDir = 'scss-test'
    const childDir = path.join(docDir, childScssDir)
    const rootInChild = path.join(childDir, 'SampleBox.scss')
    const rootInDoc = path.join(docDir, 'SampleBox.scss')

    removePath(rootInChild)
    removePath(rootInDoc)
    removePath(childDir)

    try {
      await openAndSelectAll(htmlFile)

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromSelection')

      assert.ok(fs.existsSync(rootInChild), 'Selection mode should write under childScssDir')
      assert.ok(!fs.existsSync(rootInDoc), 'Selection mode should not write root file in docDir')
    } finally {
      removePath(rootInChild)
      removePath(rootInDoc)
      removePath(childDir)
    }
  })

  test('index.scss merges new entries without duplicating existing ones', async function () {
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/index-merge.html')
    const docDir = path.dirname(htmlFile)
    const childScssDir = 'scss-test'
    const childDir = path.join(docDir, childScssDir)
    const indexFile = path.join(childDir, 'index.scss')
    const rootFile = path.join(docDir, 'MergeBox.scss')

    removePath(rootFile)
    removePath(childDir)

    fs.mkdirSync(childDir, { recursive: true })
    fs.writeFileSync(indexFile, '@use "ChildBox";\n', 'utf8')

    try {
      await openAndSelectAll(htmlFile)

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      const merged = fs.readFileSync(indexFile, 'utf8')
      const childUses = merged.match(/@use "ChildBox";/g) ?? []
      assert.strictEqual(childUses.length, 1, 'Existing @use entries should not be duplicated')
      assert.ok(merged.includes("@use 'ExtraBox';"), 'Missing @use entries should be added')
    } finally {
      removePath(rootFile)
      removePath(childDir)
    }
  })

  test('insertSracssPlaceholders should add placeholders to HTML', async function () {
    this.timeout(10000)

    const tempFile = path.join(fixturesDir, 'temp-placeholder-test.html')

    const originalContent = '<div><span>Content</span></div>'

    fs.writeFileSync(tempFile, originalContent, 'utf8')

    try {
      const doc = (await openAndSelectAll(tempFile)).document

      // Ensure the extension is activated
      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.insertSracssPlaceholders')

      const updated = doc.getText()
      assert.ok(updated.includes('className="block-box"'), 'className output should follow htmlFormat.classAttribute')
      assert.ok(updated.includes('className="element"'), 'element placeholder should be inserted')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('insertSracssPlaceholders skips template syntax', async function () {
    this.timeout(10000)

    const tempFile = path.join(fixturesDir, 'temp-template-test.html')
    const originalContent = '<div class="test-box"><% if (ok) { %><span>OK</span><% } %></div>'

    fs.writeFileSync(tempFile, originalContent, 'utf8')

    try {
      const doc = (await openAndSelectAll(tempFile)).document

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.insertSracssPlaceholders')

      assert.strictEqual(doc.getText(), originalContent, 'Template syntax should not be modified')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('ESM spiracss.config.js is loaded from workspace root', async function () {
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/sample-box.html')
    const docDir = path.dirname(htmlFile)
    const childDir = path.join(docDir, 'scss-esm')
    const rootFile = path.join(docDir, 'sampleBox.scss')

    removePath(rootFile)
    removePath(childDir)

    writePackageJson(esmPackageJsonContent)
    writeConfig(esmConfigContent)

    try {
      await openAndSelectAll(htmlFile)

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      assert.ok(fs.existsSync(rootFile), 'rootFileCase from ESM config should be applied')
      assert.ok(fs.existsSync(childDir), 'childScssDir from ESM config should be applied')

      const rootScss = fs.readFileSync(rootFile, 'utf8')
      assert.ok(
        rootScss.includes("@use '@styles/esm-global' as *;"),
        'globalScssModule from ESM config should be reflected'
      )

      removePath(rootFile)
      removePath(childDir)
      const reloadedChildDir = path.join(docDir, 'scss-esm-reloaded')
      removePath(reloadedChildDir)
      writeConfig(esmConfigContent.replace('esm-global', 'esm-reloaded').replace('scss-esm', 'scss-esm-reloaded'))

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      assert.ok(fs.existsSync(reloadedChildDir), 'Updated ESM childScssDir should be applied in the same session')
      assert.ok(!fs.existsSync(childDir), 'Stale ESM childScssDir should not be reused')
      const reloadedRootScss = fs.readFileSync(rootFile, 'utf8')
      assert.ok(
        reloadedRootScss.includes("@use '@styles/esm-reloaded' as *;"),
        'Updated ESM globalScssModule should be applied in the same session'
      )
    } finally {
      removePath(rootFile)
      removePath(childDir)
      removePath(path.join(docDir, 'scss-esm-reloaded'))
      writeConfig(cjsConfigContent)
      writePackageJson(null)
    }
  })
})
