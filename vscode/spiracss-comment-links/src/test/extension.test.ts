import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

suite('SpiraCSS Comment Links Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.')

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('spiracss.spiracss-comment-links'))
  })

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('spiracss.spiracss-comment-links')
    assert.ok(ext)
    await ext.activate()
    assert.strictEqual(ext.isActive, true)
  })

  test('DocumentLinkProvider should provide links for @rel comment', async () => {
    // Test using a real file
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const docUri = vscode.Uri.file(path.join(fixturesDir, 'test-rel.scss'))

    const doc = await vscode.workspace.openTextDocument(docUri)

    // Run DocumentLinkProvider
    const links = (await vscode.commands.executeCommand(
      'vscode.executeLinkProvider',
      doc.uri
    )) as vscode.DocumentLink[]

    // Ensure @rel links are detected
    assert.ok(links.length > 0, 'Should detect @rel link in comment')

    // Ensure the link range is correct
    const relLink = links.find((link) => {
      const text = doc.getText(link.range)
      return text.includes('@rel')
    })
    assert.ok(relLink, '@rel link should be found')
  })

  test('DocumentLinkProvider should provide links for @components alias', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const docUri = vscode.Uri.file(path.join(fixturesDir, 'test-components.scss'))

    const doc = await vscode.workspace.openTextDocument(docUri)

    const links = (await vscode.commands.executeCommand(
      'vscode.executeLinkProvider',
      doc.uri
    )) as vscode.DocumentLink[]

    const componentsLink = links.find((link) => {
      const text = doc.getText(link.range)
      return text.includes('@components')
    })
    assert.ok(componentsLink, '@components link should be found')
  })

  test('DocumentLinkProvider should provide links for @assets alias', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const docUri = vscode.Uri.file(path.join(fixturesDir, 'test-assets.scss'))

    const doc = await vscode.workspace.openTextDocument(docUri)

    const links = (await vscode.commands.executeCommand(
      'vscode.executeLinkProvider',
      doc.uri
    )) as vscode.DocumentLink[]

    const assetsLink = links.find((link) => {
      const text = doc.getText(link.range)
      return text.includes('@assets')
    })
    assert.ok(assetsLink, '@assets link should be found')
  })

  test('DocumentLinkProvider should resolve default alias shortcuts', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const docUri = vscode.Uri.file(path.join(fixturesDir, 'test-aliases.scss'))

    const doc = await vscode.workspace.openTextDocument(docUri)

    const links = (await vscode.commands.executeCommand(
      'vscode.executeLinkProvider',
      doc.uri
    )) as vscode.DocumentLink[]

    const cases = [
      { token: '@src', expected: path.join('src', 'index.scss') },
      { token: '@styles', expected: path.join('src', 'styles', 'variables.scss') },
      { token: '@pages', expected: path.join('src', 'components', 'pages', 'home', 'home.scss') },
      { token: '@parts', expected: path.join('src', 'components', 'parts', 'card', 'card.scss') },
      { token: '@common', expected: path.join('src', 'components', 'common', 'header', 'header.scss') }
    ]

    for (const { token, expected } of cases) {
      const link = links.find((link) => doc.getText(link.range).includes(token))
      assert.ok(link, `${token} link should be found`)
      assert.ok(
        link?.target?.fsPath.endsWith(expected),
        `${token} should resolve to ${expected}`
      )
    }
  })

  test('DocumentLinkProvider should resolve @rel variants', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const docUri = vscode.Uri.file(path.join(fixturesDir, 'scss', 'test-rel-variants.scss'))

    const doc = await vscode.workspace.openTextDocument(docUri)

    const links = (await vscode.commands.executeCommand(
      'vscode.executeLinkProvider',
      doc.uri
    )) as vscode.DocumentLink[]

    const cases = [
      {
        token: '@rel/child.scss',
        expected: path.join(fixturesDir, 'scss', 'child.scss')
      },
      {
        token: '@rel/../parent.scss',
        expected: path.join(fixturesDir, 'parent.scss')
      }
    ]

    for (const { token, expected } of cases) {
      const link = links.find((link) => doc.getText(link.range).includes(token))
      assert.ok(link, `${token} link should be found`)
      assert.strictEqual(link?.target?.fsPath, expected)
    }
  })

  test('DocumentLinkProvider should handle line comments', async () => {
    const content = '// @rel/scss/child.scss\n.block {}'
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const tempFile = path.join(fixturesDir, 'temp-test.scss')

    // Create a temporary file
    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      const relLink = links.find((link) => {
        const text = doc.getText(link.range)
        return text.includes('@rel')
      })
      assert.ok(relLink, 'Line comment link should be found')
    } finally {
      // Cleanup
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('DocumentLinkProvider should ignore block comments', async () => {
    const content = '/* @rel/scss/child.scss */\n.block {}'
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const tempFile = path.join(fixturesDir, 'temp-block-test.scss')

    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      // @rel inside block comments should not be detected
      assert.strictEqual(links.length, 0, 'Block comment link should be ignored')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('DocumentLinkProvider should not provide links for non-comment text', async () => {
    const content = '.block {\n  content: "@rel/test.scss";\n}'
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const tempFile = path.join(fixturesDir, 'temp-no-comment.scss')

    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      // @rel outside comments should not be detected
      assert.strictEqual(links.length, 0, 'Non-comment text should not produce links')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('DocumentLinkProvider should ignore @rel when not at comment start', async () => {
    const content = '// TODO @rel/scss/child.scss\n.block {}'
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const tempFile = path.join(fixturesDir, 'temp-prefixed-rel.scss')

    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      assert.strictEqual(links.length, 0, 'Prefixed @rel should not be linked')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('DocumentLinkProvider should ignore unknown aliases', async () => {
    const content = '// @unknown/child.scss\n.block {}'
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const tempFile = path.join(fixturesDir, 'temp-unknown-alias.scss')

    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      assert.strictEqual(links.length, 0, 'Unknown alias should not be linked')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('DocumentLinkProvider should ignore alias without path', async () => {
    const content = '// @components\n.block {}'
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const tempFile = path.join(fixturesDir, 'temp-alias-no-path.scss')

    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      assert.strictEqual(links.length, 0, 'Alias without path should not be linked')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  })

  test('DocumentLinkProvider should ignore alias roots outside workspace', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const configPath = path.join(fixturesDir, 'spiracss.config.js')
    const tempFile = path.join(fixturesDir, 'temp-outside-alias.scss')
    const content = '// @external/outside.scss\n.block {}'

    const configContent = `module.exports = {\n  aliasRoots: {\n    external: ['../outside']\n  }\n}`

    fs.writeFileSync(configPath, configContent, 'utf8')
    fs.writeFileSync(tempFile, content, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      assert.strictEqual(links.length, 0, 'Alias roots outside workspace should be ignored')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath)
      }
    }
  })

  test('DocumentLinkProvider should resolve @components alias using default aliasRoots', async () => {
    // Test path resolution with default aliasRoots (src/components)
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const componentsDir = path.join(fixturesDir, 'src', 'components')
    const createdComponentsDir = !fs.existsSync(componentsDir)
    const testFile = path.join(componentsDir, 'button.scss')
    const scssContent = '// @components/button.scss\n.button { padding: 10px; }'
    const tempFile = path.join(fixturesDir, 'test-default-alias.scss')

    // Create the fixtures directory structure
    if (createdComponentsDir) {
      fs.mkdirSync(componentsDir, { recursive: true })
    }
    fs.writeFileSync(testFile, '.button { padding: 10px; }', 'utf8')
    fs.writeFileSync(tempFile, scssContent, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      const componentsLink = links.find((link) => {
        const text = doc.getText(link.range)
        return text.includes('@components')
      })

      assert.ok(componentsLink, '@components link should be resolved using default aliasRoots')
      assert.ok(
        componentsLink?.target?.fsPath.includes('button.scss'),
        'Link should point to button.scss'
      )
    } finally {
      // Cleanup
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile)
      }
      if (createdComponentsDir && fs.existsSync(componentsDir)) {
        fs.rmSync(componentsDir, { recursive: true, force: true })
      }
    }
  })

  test('DocumentLinkProvider should trim trailing punctuation from @components paths', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const componentsDir = path.join(fixturesDir, 'src', 'components')
    const createdComponentsDir = !fs.existsSync(componentsDir)
    const testFile = path.join(componentsDir, 'button.scss')
    const scssContent = '// @components/button.scss,\n.button { padding: 10px; }'
    const tempFile = path.join(fixturesDir, 'temp-punct-alias.scss')

    if (createdComponentsDir) {
      fs.mkdirSync(componentsDir, { recursive: true })
    }
    fs.writeFileSync(testFile, '.button { padding: 10px; }', 'utf8')
    fs.writeFileSync(tempFile, scssContent, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      const componentsLink = links.find((link) => doc.getText(link.range).includes('@components'))
      assert.ok(componentsLink, '@components link should be found')
      assert.ok(
        componentsLink?.target?.fsPath.endsWith(path.join('src', 'components', 'button.scss')),
        'Trailing punctuation should be ignored when resolving'
      )
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile)
      if (createdComponentsDir && fs.existsSync(componentsDir)) {
        fs.rmSync(componentsDir, { recursive: true, force: true })
      }
    }
  })

  test('DocumentLinkProvider should trim trailing punctuation from @rel paths', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const relDir = path.join(fixturesDir, 'temp-rel-dir')
    const childFile = path.join(relDir, 'child.scss')
    const tempFile = path.join(relDir, 'parent.scss')

    if (!fs.existsSync(relDir)) {
      fs.mkdirSync(relDir, { recursive: true })
    }
    fs.writeFileSync(childFile, '.child {}', 'utf8')
    fs.writeFileSync(tempFile, '// @rel/child.scss.\n.parent {}', 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      const relLink = links.find((link) => doc.getText(link.range).includes('@rel'))
      assert.ok(relLink, '@rel link should be found')
      assert.ok(relLink?.target?.fsPath.endsWith(path.join('temp-rel-dir', 'child.scss')))
    } finally {
      if (fs.existsSync(relDir)) {
        fs.rmSync(relDir, { recursive: true, force: true })
      }
    }
  })

  test('DocumentLinkProvider should recognize custom alias keys from spiracss.config.js', async () => {
    const fixturesDir = path.join(__dirname, '../../fixtures')
    const layoutsDir = path.join(fixturesDir, 'src', 'layouts')
    const createdLayoutsDir = !fs.existsSync(layoutsDir)
    const layoutFile = path.join(layoutsDir, 'main.scss')
    const tempFile = path.join(fixturesDir, 'temp-custom-alias.scss')
    let configPath = ''
    let existingConfig: string | null = null

    // Define custom alias @layouts in spiracss.config.js
    const scssContent = '// @layouts/main.scss\n.layout { display: flex; }'

    // Create fixtures
    if (createdLayoutsDir) {
      fs.mkdirSync(layoutsDir, { recursive: true })
    }
    fs.writeFileSync(layoutFile, '.layout { display: flex; }', 'utf8')
    fs.writeFileSync(tempFile, scssContent, 'utf8')

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFile))
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri)
      assert.ok(workspaceFolder, 'Workspace folder should be available for fixtures')

      const workspaceRoot = workspaceFolder.uri.fsPath
      configPath = path.join(workspaceRoot, 'spiracss.config.js')
      if (fs.existsSync(configPath)) {
        existingConfig = fs.readFileSync(configPath, 'utf8')
      }

      const layoutsRelative = path.relative(workspaceRoot, layoutsDir)
      const configContent = `module.exports = {\n  aliasRoots: {\n    layouts: ['${layoutsRelative.replace(/\\\\/g, '/')}']\n  }\n}`

      fs.writeFileSync(configPath, configContent, 'utf8')
      const configDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath))
      await configDoc.save()

      const links = (await vscode.commands.executeCommand(
        'vscode.executeLinkProvider',
        doc.uri
      )) as vscode.DocumentLink[]

      const layoutsLink = links.find((link) => doc.getText(link.range).includes('@layouts'))
      assert.ok(layoutsLink, '@layouts custom alias should be recognized')
      assert.ok(
        layoutsLink?.target?.fsPath.endsWith(path.join('src', 'layouts', 'main.scss')),
        'Custom alias should resolve to correct path'
      )
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (configPath) {
        if (existingConfig !== null) {
          fs.writeFileSync(configPath, existingConfig, 'utf8')
        } else if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath)
        }
      }
      if (fs.existsSync(layoutFile)) fs.unlinkSync(layoutFile)
      if (createdLayoutsDir && fs.existsSync(layoutsDir)) {
        fs.rmSync(layoutsDir, { recursive: true, force: true })
      }
    }
  })

})
