import * as assert from 'assert'
import * as path from 'path'
import * as vscode from 'vscode'
import * as fs from 'fs'

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
    "    rootFileCase: 'pascal'",
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
    "    rootFileCase: 'pascal'",
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
    "    rootFileCase: 'camel'",
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
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
    editor.selection = new vscode.Selection(fullRange.start, fullRange.end)
    return editor
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

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('spiracss.spiracss-html-to-scss'))
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

  test('Generate SCSS from HTML fixture file', async function () {
    // Increase timeout (file generation can take time)
    this.timeout(10000)

    const htmlFile = path.join(fixturesDir, 'html/sample-box.html')
    const docDir = path.dirname(htmlFile)
    const childScssDir = 'scss-test'
    const rootFile = path.join(docDir, 'SampleBox.scss')
    const childDir = path.join(docDir, childScssDir)
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
      assert.ok(fs.existsSync(indexFile), 'Child index.scss should be generated')

      const rootScss = fs.readFileSync(rootFile, 'utf8')
      assert.ok(
        rootScss.includes('@use "@styles/fixtures-global" as *;'),
        'globalScssModule from config should be reflected'
      )
    } finally {
      // Cleanup
      removePath(rootFile)
      removePath(childDir)
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
      assert.ok(
        rootScss.includes('&[data-variant="primary"]'),
        'data-variant selector should be present'
      )
      assert.ok(
        rootScss.includes('&[data-state="loading"]'),
        'data-state selector should be present'
      )
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
    fs.writeFileSync(indexFile, '@use "child-box";\n', 'utf8')

    try {
      await openAndSelectAll(htmlFile)

      const ext = vscode.extensions.getExtension('spiracss.spiracss-html-to-scss')
      assert.ok(ext)
      await ext.activate()

      await vscode.commands.executeCommand('extension.generateSpiracssScssFromRoot')

      const merged = fs.readFileSync(indexFile, 'utf8')
      const childUses = merged.match(/@use "child-box";/g) ?? []
      assert.strictEqual(childUses.length, 1, 'Existing @use entries should not be duplicated')
      assert.ok(merged.includes('@use "extra-box";'), 'Missing @use entries should be added')
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
      assert.ok(
        updated.includes('className="block-box"'),
        'className output should follow htmlFormat.classAttribute'
      )
      assert.ok(
        updated.includes('className="element"'),
        'element placeholder should be inserted'
      )
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
        rootScss.includes('@use "@styles/esm-global" as *;'),
        'globalScssModule from ESM config should be reflected'
      )
    } finally {
      removePath(rootFile)
      removePath(childDir)
      writeConfig(cjsConfigContent)
      writePackageJson(null)
    }
  })
})
