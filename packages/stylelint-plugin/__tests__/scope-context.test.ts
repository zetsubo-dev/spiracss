import assert from 'node:assert/strict'
import stylelint from 'stylelint'

import plugins from '../dist/esm/index.js'
import { createRules } from '../dist/esm/helpers.js'

const check = async (
  code: string,
  rules: Record<string, unknown> = {
    'spiracss/class-structure': true,
    'spiracss/property-placement': true,
    'spiracss/pseudo-nesting': true
  },
  filename: string | null = '/tmp/components/test-card.scss'
) => {
  const result = await stylelint.lint({
    code,
    codeFilename: filename ?? undefined,
    config: { plugins, customSyntax: 'postcss-scss', rules: rules as stylelint.Config['rules'] }
  })
  assert.deepEqual(result.results[0].invalidOptionWarnings, [])
  return result.results[0].warnings
}

describe('scoped SpiraCSS components', () => {
  it('propagates the shared root style setting into structure lint', () => {
    for (const scssRootStyle of [undefined, 'class', 'scope', 'scope-explicit'] as const) {
      const rules = createRules({ aliasRoots: { components: ['components'] }, generator: { scssRootStyle } })
      const [, options] = rules['spiracss/class-structure'] as [boolean, { scssRootStyle: string }]
      assert.equal(options.scssRootStyle, scssRootStyle ?? 'scope-explicit')
    }
  })

  it('reports the effective root style when a lint override differs from the generator', async () => {
    const allRules = createRules({
      aliasRoots: { components: ['components'] },
      generator: { scssRootStyle: 'class' },
      stylelint: { class: { scssRootStyle: 'scope' } }
    })
    const warnings = await check('.test-card { > .title {} }', {
      'spiracss/class-structure': allRules['spiracss/class-structure']
    })
    const issue = warnings.find((warning) => /requires an.*@scope/.test(warning.text))
    assert.ok(issue)
    assert.match(issue.text, /configured.*scssRootStyle.*scope/)
    assert.match(issue.text, /stylelint\.class\.scssRootStyle.*override/)
  })

  it('reports an actionable error for a class-form component root when configured for scope', async () => {
    for (const scssRootStyle of ['scope', 'scope-explicit'] as const) {
      const rules = { 'spiracss/class-structure': [true, { scssRootStyle }] }
      const warnings = await check(".test-card { @include meta.load-css('scss'); > .title {} }", rules)
      const issue = warnings.find((warning) => /requires an.*@scope/.test(warning.text))
      assert.ok(issue)
      assert.equal(issue.severity, 'error')
      assert.equal(issue.line, 1)
      assert.match(issue.text, /generator\.scssRootStyle/)
      assert.ok(issue.text.includes(scssRootStyle))
      assert.match(issue.text, /@scope \(\.test-card\) \{ :scope \{ \.\.\. \} \}/)
      assert.match(issue.text, /Keep.*@use.*outside/)
      assert.match(issue.text, /Keep meta-loaded child Block files in class form/)
    }
  })

  it('requires scope even without meta.load-css or filename and single-root checks', async () => {
    const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope', rootSingle: false, rootFile: false }] }
    assert.ok(
      (await check('.test-card { > .title {} }', rules)).some((warning) => /requires an.*@scope/.test(warning.text))
    )
  })

  it('accepts either scoped root form without requiring :scope for either scope setting', async () => {
    for (const scssRootStyle of ['scope', 'scope-explicit']) {
      const rules = { 'spiracss/class-structure': [true, { scssRootStyle }] }
      for (const body of ['padding: 20px; > .title {}', ':scope { padding: 20px; > .title {} }']) {
        assert.deepEqual(await check(`@scope (.test-card) { ${body} }`, rules), [])
      }
    }
  })

  it('requires class-form child files and excludes page entries from scope enforcement', async () => {
    const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope-explicit', childDir: 'styles/blocks' }] }
    assert.deepEqual(
      await check('.child-card { > .text {} }', rules, '/tmp/components/test-card/styles/blocks/child-card.scss'),
      []
    )
    const warnings = await check(
      '@scope (.child-card) { :scope { > .text {} } }',
      rules,
      '/tmp/components/test-card/styles/blocks/child-card.scss'
    )
    assert.ok(warnings.some((warning) => /Child Block file.*must use class syntax/.test(warning.text)))
    assert.deepEqual(await check('.test-card { > .title {} }', rules, '/tmp/assets/css/page.scss'), [])
  })

  it('accepts conventional roots when class output is selected or no root style is specified', async () => {
    assert.deepEqual(
      await check('.test-card { > .title {} }', { 'spiracss/class-structure': [true, { scssRootStyle: 'class' }] }),
      []
    )
    assert.deepEqual(await check('.test-card { > .title {} }'), [])
  })

  it('forbids child scopes independently of root settings and reports a precise repair', async () => {
    for (const scssRootStyle of [undefined, 'class', 'scope', 'scope-explicit'] as const) {
      const rules = {
        'spiracss/class-structure': [
          true,
          { rootFile: false, rootSingle: false, ...(scssRootStyle ? { scssRootStyle } : {}), childDir: 'styles/blocks' }
        ]
      }
      for (const body of [
        '@scope (.child-card) { :scope { > .text {} } }',
        '@scope (.child-card) { > .text {} }',
        '@scope (.theme-area) { .child-card { > .text {} } }',
        '@scope { .child-card { > .text {} } }'
      ]) {
        const warnings = await check(
          `// child\n@layer components { ${body} }`,
          rules,
          '/tmp/components/test-card/styles/blocks/nested/child-card.module.scss'
        )
        const issue = warnings.find((warning) => /Child Block file.*must use class syntax/.test(warning.text))
        assert.ok(issue)
        assert.equal(issue.severity, 'error')
        assert.equal(issue.line, 2)
        assert.match(issue.text, /styles\/blocks/)
        assert.match(issue.text, /meta\.load-css/)
        assert.match(issue.text, /\.child-card \{ \.\.\. \}/)
        assert.match(issue.text, /root.*unchanged/)
      }
    }
    assert.deepEqual(await check('@scope (.test-card) { :scope { @include meta.load-css("scss"); > .title {} } }'), [])
  })

  it('rejects scopes in child index and partial files without depending on a discovered Block', async () => {
    const rules = { 'spiracss/class-structure': [true, { rootFile: false, rootSingle: false }] }
    for (const file of ['index.scss', '_partial.scss']) {
      const warnings = await check('@scope (.theme-area) {}', rules, `/tmp/components/test-card/scss/${file}`)
      assert.ok(warnings.some((warning) => /Child Block file.*must use class syntax/.test(warning.text)))
    }
  })

  it('uses only the immediate child directory outside configured component paths', async () => {
    const allRules = createRules({ aliasRoots: { components: ['src/components'] } })
    const rules = { 'spiracss/class-structure': allRules['spiracss/class-structure'] }
    const code = '@scope (.child-card) { :scope { color: red; } }'
    assert.ok(
      (await check(code, rules, '/tmp/src/pages/home/scss/child-card.scss')).some((warning) =>
        /Child Block file.*must use class syntax/.test(warning.text)
      )
    )
    assert.deepEqual(await check(code, rules, '/tmp/src/pages/home/scss/sub/child-card.scss'), [])
    const configured = createRules({ aliasRoots: { components: ['src/components', 'src/pages'] } })
    const pageRules = { 'spiracss/class-structure': configured['spiracss/class-structure'] }
    assert.ok(
      (await check(code, pageRules, '/tmp/src/pages/home/scss/sub/child-card.scss')).some((warning) =>
        /Child Block file.*must use class syntax/.test(warning.text)
      )
    )
  })

  it('prioritizes configured component paths over the legacy assets/css page exclusion', async () => {
    const allRules = createRules({ aliasRoots: { components: ['src/assets/css/components'] } })
    const rules = { 'spiracss/class-structure': allRules['spiracss/class-structure'] }
    const filename = '/tmp/src/assets/css/components/test-card/test-card.scss'
    assert.ok(
      (await check('.test-card { > .title {} }', rules, filename)).some((warning) =>
        /requires an.*@scope/.test(warning.text)
      )
    )
    assert.deepEqual(await check('@scope (.test-card) { :scope { > .title {} } }', rules, filename), [])
    assert.deepEqual(await check('.test-card { > .title {} }', rules, '/tmp/src/assets/css/home.scss'), [])
    const wrongFile = await check(
      '@scope (.test-card) { :scope { > .title {} } }',
      rules,
      '/tmp/src/assets/css/components/test-card/wrong.scss'
    )
    assert.ok(wrongFile.some((warning) => /must be defined in/.test(warning.text)))
  })

  it('does not silently treat an ambiguous nested component scope as a theme', async () => {
    const rules = { 'spiracss/class-structure': [true, { rootFile: false }] }
    const code =
      '@scope (.test-card) { :scope { padding: 20px; } @scope (.child-card) { padding: 20px; > .text { color: red; } } }'
    for (const filename of [
      '/tmp/components/test-card/test-card.scss',
      '/tmp/components/test-card/styles.module.scss'
    ]) {
      const warnings = await check(code, rules, filename)
      assert.ok(warnings.some((warning) => /direct-child combinator/.test(warning.text)))
      assert.ok(warnings.some((warning) => /grandchild Elements/.test(warning.text)))
    }
    for (const filename of ['/tmp/components/generic/styles.module.scss', null]) {
      const warnings = await check(code, rules, filename)
      assert.ok(warnings.some((warning) => /Cannot determine Block ownership/.test(warning.text)))
      assert.ok(warnings.some((warning) => /external\.classes/.test(warning.text)))
    }
    const theme = '@scope (.theme-area) { :scope { color: red; } @scope (.test-card) { :scope { > .title {} } } }'
    assert.deepEqual(await check(theme, rules, '/tmp/components/test-card/styles.module.scss'), [])
    const declaredThemeRules = {
      'spiracss/class-structure': [true, { rootFile: false, external: { prefixes: ['theme-'] } }]
    }
    assert.deepEqual(await check(theme, declaredThemeRules, null), [])
  })

  it('does not mistake :scope conditions in thematic selectors for a component scope root', async () => {
    const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope' }] }
    for (const condition of [':not(:scope)', ':has(:scope)']) {
      const warnings = await check(`@scope (.theme-area) { .test-card${condition} { > .title {} } }`, rules)
      assert.ok(warnings.some((warning) => /requires an.*@scope/.test(warning.text)))
      assert.ok(!warnings.some((warning) => /theme-area.*must be defined in/.test(warning.text)))
    }
  })

  it('keeps thematic scope declarations separate from a component root in the same wrapper', async () => {
    for (const themeBody of [':scope { color: red; }', 'color: red;']) {
      const code = `@scope (.theme-area) { ${themeBody} .test-card { > .title {} } }`
      const warnings = await check(code, { 'spiracss/class-structure': [true, { scssRootStyle: 'scope' }] })
      assert.ok(warnings.some((warning) => /requires an.*@scope/.test(warning.text)))
      assert.ok(!warnings.some((warning) => /theme-area.*must be defined in/.test(warning.text)))
      assert.deepEqual(await check(code, { 'spiracss/class-structure': [true, { scssRootStyle: 'class' }] }), [])
    }
  })

  it('allows a themed scope wrapper around a separately scoped component root', async () => {
    const rules = {
      'spiracss/class-structure': [true, { scssRootStyle: 'scope' }],
      'spiracss/property-placement': true,
      'spiracss/pseudo-nesting': true
    }
    for (const themeBody of ['', ':scope { color: red; }', 'color: red;']) {
      assert.deepEqual(
        await check(
          `@scope (.theme-area) { ${themeBody} @scope (.test-card) { :scope { padding: 20px; > .title { color: red; } } } }`,
          rules
        ),
        []
      )
    }
  })

  it('preserves thematic declarations when filenames do not identify the component owner', async () => {
    for (const filename of ['/tmp/components/test-card/styles.module.scss', null]) {
      for (const themeBody of ['--theme-color: red;', ':scope { --theme-color: red; }']) {
        const classCode = `@scope (.theme-dark) { ${themeBody} .test-card { > .title { color: red; } } }`
        const scopedCode = `@scope (.theme-dark) { ${themeBody} @scope (.test-card) { :scope { > .title { color: red; } } } }`
        for (const scssRootStyle of [undefined, 'class', 'scope-explicit'] as const) {
          const rules = {
            'spiracss/class-structure': [
              true,
              { rootFile: false, ...(scssRootStyle ? { scssRootStyle } : {}), external: { classes: ['theme-dark'] } }
            ]
          }
          assert.deepEqual(await check(scopedCode, rules, filename), [])
          const warnings = await check(classCode, rules, filename)
          if (scssRootStyle === 'scope-explicit' && filename) {
            assert.equal(warnings.length, 1)
            assert.match(warnings[0].text, /requires an.*@scope/)
          } else {
            assert.deepEqual(warnings, [])
          }
        }
      }
    }
  })

  it('checks every class-form component root when multiple root definitions are permitted', async () => {
    const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope', rootSingle: false, rootFile: false }] }
    const code =
      '@scope (.test-card) { :scope { color: red; } }\n.test-card { > .title {} }\n.other-card { > .text {} }'
    const issues = (await check(code, rules)).filter((warning) => /requires an.*@scope/.test(warning.text))
    assert.equal(issues.length, 2)
    assert.equal(issues[0].line, 2)
    assert.match(issues[0].text, /\.test-card/)
    assert.equal(issues[1].line, 3)
    assert.match(issues[1].text, /\.other-card/)
  })

  it('includes every Block in a selector-list scope repair example', async () => {
    const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope', rootSingle: false, rootFile: false }] }
    const warnings = await check('.test-card, .other-card { color: red; }', rules)
    const issues = warnings.filter((warning) => /requires an.*@scope/.test(warning.text))
    assert.equal(issues.length, 1)
    assert.ok(issues[0].text.includes('Component root selector `.test-card, .other-card`'))
    assert.ok(issues[0].text.includes('@scope (.test-card, .other-card) { :scope { ... } }'))
    assert.deepEqual(await check('@scope (.test-card, .other-card) { :scope { color: red; } }', rules), [])
  })

  it('checks missing child Block combinators when the scope owns the file, preserving thematic scopes', async () => {
    for (const [filename, options] of [
      ['/tmp/components/test-card.scss', {}],
      ['/tmp/components/TestCard.module.scss', { rootCase: 'pascal' }]
    ] as const) {
      const rules = { 'spiracss/class-structure': [true, options] }
      const warnings = await check('@scope (.test-card) { .child-card {} }', rules, filename)
      assert.ok(warnings.some((warning) => /direct-child combinator/.test(warning.text)))
    }
    assert.ok(
      (
        await check(
          '@scope (.test-card) { .child-card {} }',
          { 'spiracss/class-structure': true },
          '/tmp/components/scss/child-card.scss'
        )
      ).some((warning) => /Child Block file.*must use class syntax/.test(warning.text))
    )
  })

  it('does not confuse ancestor directory names with the configured child Block directory', async () => {
    const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope', childFileCase: 'pascal' }] }
    const warnings = await check('.test-card { > .title {} }', rules, '/tmp/scss/project/components/test-card.scss')
    assert.ok(warnings.some((warning) => /requires an.*@scope/.test(warning.text)))
    assert.ok(!warnings.some((warning) => /must be defined in/.test(warning.text)))
    assert.deepEqual(
      await check('.child-card { > .text {} }', rules, '/tmp/scss/project/components/test-card/scss/ChildCard.scss'),
      []
    )
  })

  it('keeps class-form child Blocks valid even when they load more styles through meta', async () => {
    for (const childDir of ['scss', 'styles/blocks']) {
      const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope', childDir }] }
      const body = `.child-card { @include meta.load-css('${childDir}'); > .text {} }`
      assert.deepEqual(await check(body, rules, `/tmp/components/test-card/${childDir}/child-card.scss`), [])
    }
  })

  it('keeps configured child directory segments from resetting the component path base', async () => {
    for (const components of ['components', 'src/components']) {
      for (const childScssDir of ['scss/components', 'components/styles', 'styles/components/blocks']) {
        const allRules = createRules({
          aliasRoots: { components: [components] },
          generator: { scssRootStyle: 'scope', childScssDir, childFileCase: 'pascal' }
        })
        const rules = { 'spiracss/class-structure': allRules['spiracss/class-structure'] }
        const filename = `/tmp/${components}/test-card/${childScssDir}/ChildCard.scss`
        assert.deepEqual(await check('.child-card { > .text {} }', rules, filename), [])
        assert.ok(
          (await check('@scope (.child-card) { :scope { > .text {} } }', rules, filename)).some((warning) =>
            /Child Block file.*must use class syntax/.test(warning.text)
          )
        )
        const rootWarnings = await check(
          '.test-card { > .title {} }',
          rules,
          `/tmp/${components}/test-card/test-card.scss`
        )
        assert.ok(rootWarnings.some((warning) => /requires an.*@scope/.test(warning.text)))
      }
    }
  })

  it('identifies child subtrees independently of component aliases and deeper directory names', async () => {
    for (const components of [
      ['parts', 'components'],
      ['components', 'parts']
    ]) {
      const allRules = createRules({
        aliasRoots: { components },
        generator: { childScssDir: 'parts', childFileCase: 'pascal' }
      })
      const rules = { 'spiracss/class-structure': allRules['spiracss/class-structure'] }
      assert.deepEqual(
        await check('.child-card { > .text {} }', rules, '/tmp/components/test-card/parts/ChildCard.scss'),
        []
      )
    }
    const allRules = createRules({
      aliasRoots: { components: ['components'] },
      generator: { childFileCase: 'pascal' }
    })
    const rules = { 'spiracss/class-structure': allRules['spiracss/class-structure'] }
    assert.deepEqual(
      await check('.child-card { > .text {} }', rules, '/tmp/components/test-card/scss/components/ChildCard.scss'),
      []
    )
    assert.ok(
      (await check('.test-card { > .title {} }', rules)).some((warning) => /requires an.*@scope/.test(warning.text))
    )
  })

  it('identifies meta-loading roots outside component paths without matching distant ancestor names', async () => {
    for (const childDir of ['scss', 'styles/blocks']) {
      const rules = { 'spiracss/class-structure': [true, { scssRootStyle: 'scope', childDir }] }
      const code = `.test-card { @include meta.load-css('${childDir}'); > .title {} }`
      for (const filename of ['/tmp/pages/test-card.scss', `/tmp/${childDir}/project/pages/test-card.scss`]) {
        assert.ok((await check(code, rules, filename)).some((warning) => /requires an.*@scope/.test(warning.text)))
      }
      const childCode = `.child-card { @include meta.load-css('${childDir}'); > .text {} }`
      assert.deepEqual(await check(childCode, rules, `/tmp/pages/${childDir}/child-card.scss`), [])
    }
  })

  it('accepts container and layer wrappers without hiding genuine root or property violations', async () => {
    const rules = {
      'spiracss/class-structure': [true, { scssRootStyle: 'scope-explicit' }],
      'spiracss/property-placement': true,
      'spiracss/pseudo-nesting': true
    }
    for (const wrapper of [
      '@container card (width > 30rem)',
      '@layer components',
      '@media (width > 30rem)',
      '@supports (display: grid)'
    ]) {
      for (const body of [
        'padding: 20px; > .title { color: red; }',
        ':scope { padding: 20px; > .title { color: red; } }'
      ]) {
        assert.deepEqual(await check(`${wrapper} { @scope (.test-card) { ${body} } }`, rules), [])
      }
      assert.deepEqual(
        await check(`@scope (.test-card) { :scope { ${wrapper} { padding: 20px; > .title { color: red; } } } }`, rules),
        []
      )
      const classWarnings = await check(`${wrapper} { .test-card { > .title {} } }`, rules)
      assert.ok(classWarnings.some((warning) => /requires an.*@scope/.test(warning.text)))
      const placementWarnings = await check(`${wrapper} { @scope (.test-card) { :scope { margin: 20px; } } }`, rules)
      assert.ok(placementWarnings.some((warning) => warning.rule === 'spiracss/property-placement'))
      for (const childBody of ['.child-card { > .text {} }', '@scope (.child-card) { :scope { > .text {} } }']) {
        const warnings = await check(`${wrapper} { ${childBody} }`, rules, '/tmp/components/scss/child-card.scss')
        if (childBody.startsWith('@scope')) {
          assert.ok(warnings.some((warning) => /Child Block file.*must use class syntax/.test(warning.text)))
        } else {
          assert.deepEqual(warnings, [])
        }
      }
    }
  })

  for (const body of [
    'padding: 20px; > .title { color: red; }',
    ':scope { padding: 20px; > .title { color: red; } }',
    ':SCOPE { padding: 20px; > .title { color: red; } }',
    ':scope > .title { color: red; }',
    '& { padding: 20px; > .title { color: red; } }',
    ':scope { padding: 20px; } :scope { > .title { color: red; } }'
  ]) {
    it(`accepts a scope root without requiring a :scope wrapper: ${body}`, async () => {
      assert.deepEqual(await check(`@scope (.test-card) { ${body} }`), [])
    })
  }

  it('checks root declarations instead of skipping placement rules', async () => {
    for (const body of ['margin: 20px;', ':scope { margin: 20px; }', '& { margin: 20px; }']) {
      const warnings = await check(`@scope (.test-card) { ${body} }`)
      assert.ok(
        warnings.some((warning) => warning.rule === 'spiracss/property-placement' && /item property/.test(warning.text))
      )
    }
  })

  it('rejects all scope body forms in a meta-loaded child Block file', async () => {
    const rules = {
      'spiracss/class-structure': true,
      'spiracss/property-placement': true,
      'spiracss/pseudo-nesting': true,
      'spiracss/rel-comments': [true, { validatePath: false, requireMeta: false }]
    }
    for (const body of [
      'padding: 20px; > .text { color: red; }',
      ':scope { padding: 20px; > .text { color: red; } }',
      '& { padding: 20px; > .text { color: red; } }'
    ]) {
      assert.ok(
        (
          await check(
            `// @rel/../test-card.scss\n@scope (.child-card) { ${body} }`,
            rules,
            '/tmp/components/scss/child-card.scss'
          )
        ).some((warning) => /Child Block file.*must use class syntax/.test(warning.text))
      )
    }
  })

  it('checks component filenames against the scope root', async () => {
    const warnings = await check('@scope (.other-card) { padding: 20px; }')
    assert.ok(warnings.some((warning) => /file.*name|filename/i.test(warning.text)))
  })

  it('takes the scope subject as the Block rather than a contextual ancestor', async () => {
    assert.deepEqual(await check('@scope (.page-shell > .test-card) { padding: 20px; > .title {} }'), [])
    assert.deepEqual(await check('@scope (/* ignored ) */ .test-card) { padding: 20px; > .title {} }'), [])
  })

  it('recognizes scope subjects inside positive selector functions without losing placement checks', async () => {
    for (const fn of ['is', 'where']) {
      for (const rootSingle of [false, true]) {
        const rules = {
          'spiracss/class-structure': [true, { rootSingle, scssRootStyle: 'scope-explicit' }],
          'spiracss/property-placement': true
        }
        for (const start of [
          `:${fn}(.page-shell > .test-card)`,
          `:${fn}(.page-shell > :is(.inner-shell > .test-card))`
        ]) {
          assert.deepEqual(await check(`@scope (${start}) { :scope { padding: 20px; > .title {} } }`, rules), [])
          const warnings = await check(`@scope (${start}) { :scope { margin: 20px; > .title {} } }`, rules)
          assert.ok(warnings.some((warning) => warning.rule === 'spiracss/property-placement'))
          assert.ok(!warnings.some((warning) => /No root Block|multiple root Blocks/i.test(warning.text)))
        }
      }
    }
  })

  it('resolves the innermost scope root without inventing direct relationships', async () => {
    assert.deepEqual(await check('@scope (.test-card) { @scope (:scope > .child-card) { margin-top: 20px; } }'), [])
    const childStyles = await check(
      '@scope (.test-card) { @scope (:scope > .child-card) { padding: 20px; > .title {} } }'
    )
    assert.ok(childStyles.some((warning) => warning.rule === 'spiracss/property-placement'))
    assert.ok(childStyles.some((warning) => /grandchild Elements/.test(warning.text)))
    const warnings = await check('@scope (.test-card) { @scope (.child-card) { padding: 20px; } }')
    assert.ok(warnings.some((warning) => warning.rule === 'spiracss/class-structure'))
  })

  it('detects duplicate scope definitions but accepts repeated root references', async () => {
    const warnings = await check('@scope (.test-card) {} @scope (.test-card) {}')
    assert.ok(warnings.some((warning) => /more than once|multiple times|duplicate/i.test(warning.text)))
  })

  it('keeps the child combinator requirement for implicit scoped descendants', async () => {
    const warnings = await check('@scope (.test-card) { .title { color: red; } }')
    assert.ok(warnings.some((warning) => warning.rule === 'spiracss/class-structure'))
  })

  it('rejects Blocks inside Elements and excessive selector Block nesting', async () => {
    for (const body of ['> .title { > .child-card {} }', '> .child-card { > .grand-card {} }']) {
      const warnings = await check(`@scope (.test-card) { ${body} }`)
      assert.ok(warnings.some((warning) => warning.rule === 'spiracss/class-structure'))
    }
  })

  it('preserves thematic scopes wrapping conventional component selectors', async () => {
    assert.deepEqual(await check('@scope (.theme-area) { .test-card { padding: 20px; > .title {} } }'), [])
    assert.deepEqual(
      await check('@scope (.theme-area) { .test-card[title=":scope"] { padding: 20px; > .title {} } }'),
      []
    )
  })

  it('supports scoped boundaries and functional start selectors', async () => {
    for (const start of ['(.test-card) to (:scope > .limit)', '(:is(.test-card))']) {
      assert.deepEqual(await check(`@scope ${start} { padding: 20px; > .title {} }`), [])
    }
  })

  it('keeps pseudo nesting requirements for hover and for unscoped :scope', async () => {
    const warnings = await check('@scope (.test-card) { :scope:hover { opacity: .5; } }')
    assert.equal(warnings.filter((warning) => warning.rule === 'spiracss/pseudo-nesting').length, 1)
    assert.ok((await check(':scope {}', { 'spiracss/pseudo-nesting': true })).length > 0)
  })

  it('does not mutate the stylesheet when lint or fix is requested', async () => {
    const code = '@scope (.test-card) { :scope { margin: 20px; } }'
    const result = await stylelint.lint({
      code,
      fix: true,
      config: { plugins, rules: { 'spiracss/property-placement': true } }
    })
    assert.equal(result.code, code)
  })

  it('invalidates the scope view after another plugin fixes the original AST', async () => {
    const removeMargin = stylelint.createPlugin('test/remove-margin', () => (root) => {
      root.walkDecls('margin', (decl) => {
        decl.remove()
      })
    })
    const result = await stylelint.lint({
      code: '@scope (.test-card) { margin: 20px; }',
      fix: true,
      config: {
        plugins: [...plugins, removeMargin],
        rules: {
          'spiracss/class-structure': true,
          'test/remove-margin': true,
          'spiracss/property-placement': true
        }
      }
    })
    assert.deepEqual(result.results[0].warnings, [])
  })

  it('retains source lines for declarations and stylelint-disable comments', async () => {
    const code = '@scope (.test-card) {\n  margin: 20px;\n}'
    const warnings = await check(code)
    const issue = warnings.find((warning) => warning.rule === 'spiracss/property-placement')
    assert.equal(issue?.line, 2)
    assert.deepEqual(await check('/* stylelint-disable spiracss/property-placement */\n' + code), [])
  })

  it('uses the scope Block name for keyframes naming', async () => {
    const rules = { 'spiracss/keyframes-naming': [true, { blockWarnMissing: true }] }
    assert.deepEqual(await check('@scope (.test-card) {} @keyframes test-card-fade { to { opacity: 1; } }', rules), [])
    assert.ok(
      (await check('@scope (.test-card) {} @keyframes other-card-fade { to { opacity: 1; } }', rules)).length > 0
    )
  })

  it('validates child Block links in scoped page entry files', async () => {
    const rules = {
      'spiracss/page-layer': [
        true,
        {
          aliasRoots: { assets: ['src/assets'], components: ['src/components'] },
          pageEntryAlias: 'assets',
          pageEntrySubdir: 'css',
          componentsDirs: ['src/components']
        }
      ]
    }
    const warnings = await check('@scope (.test-card) { > .child-card {} }', rules, 'src/assets/css/home.scss')
    assert.ok(warnings.some((warning) => /link comment/.test(warning.text)))
  })

  it('validates parent and child rel comments for scoped components', async () => {
    const rules = { 'spiracss/rel-comments': [true, { validatePath: false, requireMeta: false }] }
    const warnings = await check('@scope (.test-card) { > .child-card {} }', rules)
    assert.ok(warnings.some((warning) => /parent|rel|link/i.test(warning.text)))
    assert.deepEqual(
      await check(
        '// @rel/parent-card.scss\n@scope (.test-card) { > .child-card {\n// @rel/child-card.scss\n} }',
        rules
      ),
      []
    )
  })

  it('keeps the interaction section and @at-root requirements', async () => {
    const rules = { 'spiracss/interaction-scope': true }
    assert.ok((await check('@scope (.test-card) { :scope { &:hover { opacity: .5; } } }', rules)).length > 0)
    assert.deepEqual(
      await check(
        '@scope (.test-card) { :scope {\n// --interaction\n@at-root & { &:hover { opacity: .5; } }\n} }',
        rules
      ),
      []
    )
    assert.deepEqual(
      await check('@scope (.test-card) {\n// --interaction\n@at-root :scope { &:hover { opacity: .5; } }\n}', rules),
      []
    )
  })

  it('checks interaction properties through the same scope root', async () => {
    const rules = { 'spiracss/interaction-properties': true }
    const body = '// --interaction\n@at-root & { opacity: 0; transition: opacity .2s; &:hover { opacity: 1; } }'
    assert.deepEqual(await check(`@scope (.test-card) { :scope { ${body} } }`, rules), [])
  })

  it('reports malformed selectors without crashing scope analysis', async () => {
    const warnings = await check('@scope (.test-card) { :scope[ { color: red; } }')
    assert.ok(warnings.length > 0)
  })
})
