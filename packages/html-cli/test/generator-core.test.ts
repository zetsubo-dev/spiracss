import assert from 'assert'
import { promises as fsp } from 'fs'
import * as path from 'path'

import {
  classifyBaseClass,
  generateFromHtml,
  type GeneratorOptions,
  isBlockClass,
  lintHtmlStructure,
  sanitizeHtml
} from '../src/generator-core'

const fixturesDir = path.join(__dirname, '..', 'fixtures')

function normalize(s?: string): string {
  return (s ?? '')
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  return haystack.split(needle).length - 1
}

const baseOptions: GeneratorOptions = {
  globalScssModule: '@styles/partials/global',
  pageEntryPrefix: '@assets/css',
  childScssDir: 'scss',
  layoutMixins: ['@include breakpoint-up(md)'],
  naming: { blockCase: 'kebab' },
  selectorPolicy: {
    variant: { mode: 'class' },
    state: { mode: 'class' }
  }
}

describe('generator-core', () => {
  it('clamps naming.blockMaxWords to 2..100', () => {
    const naming = { blockCase: 'kebab' as const, blockMaxWords: 1000 }
    const block100 = `a${'-a'.repeat(99)}`
    const block101 = `a${'-a'.repeat(100)}`

    assert.strictEqual(isBlockClass(block100, naming), true)
    assert.strictEqual(isBlockClass(block101, naming), false)
  })

  it('rejects customPatterns with g/y flags', () => {
    const base = { blockCase: 'kebab' as const, elementCase: 'kebab' as const }
    assert.strictEqual(
      classifyBaseClass('TITLE', { ...base, customPatterns: { element: /^[A-Z]+$/ } }),
      'element'
    )
    assert.strictEqual(
      classifyBaseClass('TITLE', { ...base, customPatterns: { element: /^[A-Z]+$/g } }),
      'invalid'
    )
    assert.strictEqual(
      classifyBaseClass('TITLE', { ...base, customPatterns: { element: /^[A-Z]+$/y } }),
      'invalid'
    )
  })

  it('sanitizes HTML fixtures (baseline)', async () => {
    const html = await fsp.readFile(path.join(fixturesDir, 'html/sample-box.html'), 'utf8')
    const sanitized = sanitizeHtml(html)
    assert.ok(sanitized.includes('sample-box'))
    assert.ok(!sanitized.includes('<%'))
  })

  it('sanitizes JSX template literals (static classes remain)', async () => {
    const jsx = await fsp.readFile(path.join(fixturesDir, 'jsx/sample-box.jsx'), 'utf8')
    const sanitized = sanitizeHtml(jsx)
    assert.ok(sanitized.includes('sample-box'))
    assert.ok(!sanitized.includes('${'))
  })

  it('sanitizes JSX className strings', () => {
    const jsx = '<div className="hero-section"><h1 className="title"></h1></div>'
    const sanitized = sanitizeHtml(jsx)
    assert.ok(sanitized.includes('class="hero-section"'))
    assert.ok(sanitized.includes('class="title"'))
    assert.ok(!sanitized.includes('className='))
  })

  it('sanitizes JSX className template literals (static parts only)', () => {
    const jsx = '<div className={`hero-section -wide ${foo}`}></div>'
    const sanitized = sanitizeHtml(jsx)
    assert.ok(sanitized.includes('class="hero-section -wide"'))
    assert.ok(!sanitized.includes('${'))
  })

  it('strips Astro frontmatter', async () => {
    const astro = await fsp.readFile(path.join(fixturesDir, 'astro/sample-box.astro'), 'utf8')
    const sanitized = sanitizeHtml(astro)
    assert.ok(!sanitized.startsWith('---'))
    assert.ok(sanitized.includes('sample-box'))
  })

  it('sanitizes script/style blocks', () => {
    const html =
      '<script>const tpl = "<body>";</script><style>/* <html> */</style><div class="hero-section"></div>'
    const sanitized = sanitizeHtml(html)
    assert.ok(!sanitized.includes('<script'))
    assert.ok(!sanitized.includes('<style'))
    assert.ok(sanitized.includes('hero-section'))
  })

  it('sanitizes CDATA sections', () => {
    const html = '<div class="hero-section"><![CDATA[<body>]]></div>'
    const sanitized = sanitizeHtml(html)
    assert.ok(!sanitized.includes('CDATA'))
    assert.ok(sanitized.includes('hero-section'))
  })

  it('generates expected SCSS for sample-box root and hero-header', async () => {
    const html = await fsp.readFile(path.join(fixturesDir, 'html/sample-box.html'), 'utf8')
    const expectedRoot = await fsp.readFile(
      path.join(fixturesDir, 'html/sample-box.scss'),
      'utf8'
    )
    const expectedHero = await fsp.readFile(
      path.join(fixturesDir, 'html/scss/hero-header.scss'),
      'utf8'
    )

    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    const root = generated.find((f) => f.path === 'sample-box.scss')?.content
    const hero = generated.find((f) => f.path.endsWith('hero-header.scss'))?.content

    assert.ok(root, 'root SCSS not generated')
    assert.ok(hero, 'hero-header SCSS not generated')
    assert.strictEqual(normalize(root), normalize(expectedRoot))
    assert.strictEqual(normalize(hero), normalize(expectedHero))
  })

  it('does not include root block in scss/index.scss for root mode', async () => {
    const html = await fsp.readFile(path.join(fixturesDir, 'html/sample-box.html'), 'utf8')
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    const index = generated.find((f) => f.path === 'scss/index.scss')?.content

    assert.ok(index, 'index.scss not generated')
    assert.ok(!index.includes('@use "sample-box";'), 'root block should not be in scss/index.scss')
    assert.ok(index.includes('@use "hero-header";'), 'child block should be in scss/index.scss')
  })

  it('applies rootFileCase to root SCSS file name', () => {
    const html = '<div class="hero-section"><h1 class="title">Test</h1></div>'
    const cases = [
      ['preserve', 'hero-section.scss'],
      ['kebab', 'hero-section.scss'],
      ['snake', 'hero_section.scss'],
      ['camel', 'heroSection.scss'],
      ['pascal', 'HeroSection.scss']
    ] as const

    cases.forEach(([rootFileCase, expected]) => {
      const generated = generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        rootFileCase
      })
      const root = generated.find((f) => f.path === expected)
      assert.ok(root, `rootFileCase "${rootFileCase}" should generate ${expected}`)
    })
  })

  it('HTML lint passes for valid structure', async () => {
    const html = await fsp.readFile(path.join(fixturesDir, 'html/sample-box.html'), 'utf8')
    // Use class mode because fixtures include modifier classes
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' }, { variant: { mode: 'class' }, state: { mode: 'class' } })
    assert.strictEqual(issues.length, 0, `Expected no issues, got: ${JSON.stringify(issues)}`)
  })

  it('HTML lint detects orphan element', () => {
    const html = '<div class="title">Orphan element</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(issues.some((i) => i.code === 'ELEMENT_WITHOUT_BLOCK_ANCESTOR'))
  })

  // Additional test: EJS sanitize
  it('sanitizes EJS syntax', async () => {
    const ejs = await fsp.readFile(path.join(fixturesDir, 'ejs/sample-box.ejs'), 'utf8')
    const sanitized = sanitizeHtml(ejs)
    assert.ok(!sanitized.includes('<%'), 'EJS tags should be removed')
    assert.ok(!sanitized.includes('%>'), 'EJS tags should be removed')
    assert.ok(sanitized.includes('sample-box'), 'Static classes should remain')
  })

  // Additional test: Nunjucks sanitize
  it('sanitizes Nunjucks syntax', async () => {
    const njk = await fsp.readFile(path.join(fixturesDir, 'nunjucks/sample-box.njk'), 'utf8')
    const sanitized = sanitizeHtml(njk)
    assert.ok(!sanitized.includes('{{'), 'Nunjucks variables should be removed')
    assert.ok(!sanitized.includes('{%'), 'Nunjucks tags should be removed')
    assert.ok(!sanitized.includes('{#'), 'Nunjucks comments should be removed')
    assert.ok(sanitized.includes('sample-box'), 'Static classes should remain')
  })

  // Additional test: modifier handling
  it('generates SCSS with modifiers', async () => {
    const html = `
      <div class="feature-card -primary -wide">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&.-primary'), 'Modifier -primary should be present')
    assert.ok(root.includes('&.-wide'), 'Modifier -wide should be present')
  })

  it('generates SCSS with data-variant/data-state when selectorPolicy is data', async () => {
    const html = `
      <div class="feature-card" data-variant="primary" data-state="loading">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="primary"]'), 'data-variant selector should be present')
    assert.ok(root.includes('@at-root & {'), 'interaction block should be present')
    assert.ok(root.includes('&[data-state="loading"]'), 'data-state selector should be present')
  })

  it('generates SCSS with data-variant only', async () => {
    const html = `
      <div class="feature-card" data-variant="primary">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="primary"]'), 'data-variant selector should be present')
    assert.ok(!root.includes('data-state'), 'data-state selector should not be present')
  })

  it('merges data-variant selectors for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-variant="en">EN</p>
        <p class="desc" data-variant="ja">JA</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="en"]'), 'data-variant "en" should be present')
    assert.ok(root.includes('&[data-variant="ja"]'), 'data-variant "ja" should be present')
  })

  it('deduplicates identical data-variant values', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-variant="en">EN 1</p>
        <p class="desc" data-variant="en">EN 2</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.strictEqual(
      countOccurrences(root, '&[data-variant="en"]'),
      1,
      'duplicate data-variant selectors should be deduped'
    )
  })

  it('merges custom variant keys for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-theme="dark">Dark</p>
        <p class="desc" data-color="red">Red</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-theme', 'data-color'] },
        state: { mode: 'data', dataKey: 'data-status', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-theme="dark"]'), 'data-theme selector should be present')
    assert.ok(root.includes('&[data-color="red"]'), 'data-color selector should be present')
  })

  it('deduplicates identical custom state values', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-status="loading">Loading 1</p>
        <p class="desc" data-status="loading">Loading 2</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-status', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.strictEqual(
      countOccurrences(root, '&[data-status="loading"]'),
      1,
      'duplicate data-status selectors should be deduped'
    )
    const interactionIndex = root.indexOf('// --interaction')
    assert.ok(interactionIndex >= 0, 'interaction section should be present')
    assert.ok(
      root.indexOf('&[data-status="loading"]') > interactionIndex,
      'data-status selector should be in interaction section'
    )
  })

  it('merges custom aria keys for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" aria-hidden="true">Hidden</p>
        <p class="desc" aria-hidden="false">Visible</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-status', ariaKeys: ['aria-hidden'] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[aria-hidden="true"]'), 'aria-hidden "true" should be present')
    assert.ok(root.includes('&[aria-hidden="false"]'), 'aria-hidden "false" should be present')
    const interactionIndex = root.indexOf('// --interaction')
    assert.ok(interactionIndex >= 0, 'interaction section should be present')
    assert.ok(
      root.indexOf('&[aria-hidden="true"]') > interactionIndex,
      'aria-hidden selector should be in interaction section'
    )
  })

  it('generates selectors when variant/state/aria are combined', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-variant="primary" data-state="loading" aria-expanded="true">Desc</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded'] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="primary"]'), 'data-variant selector should be present')
    assert.ok(root.includes('&[data-state="loading"]'), 'data-state selector should be present')
    assert.ok(root.includes('&[aria-expanded="true"]'), 'aria-expanded selector should be present')
    const interactionIndex = root.indexOf('// --interaction')
    assert.ok(interactionIndex >= 0, 'interaction section should be present')
    assert.ok(
      root.indexOf('&[data-state="loading"]') > interactionIndex,
      'data-state selector should be in interaction section'
    )
    assert.ok(
      root.indexOf('&[aria-expanded="true"]') > interactionIndex,
      'aria-expanded selector should be in interaction section'
    )
  })

  it('merges modifiers and data-variant selectors for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc -active" data-variant="en">EN</p>
        <p class="desc -loading" data-variant="ja">JA</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'class' }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="en"]'), 'data-variant "en" should be present')
    assert.ok(root.includes('&[data-variant="ja"]'), 'data-variant "ja" should be present')
    assert.ok(root.includes('&.-active'), 'modifier "-active" should be present')
    assert.ok(root.includes('&.-loading'), 'modifier "-loading" should be present')
  })

  it('merges nested children for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc"><span class="icon"></span></p>
        <p class="desc"><span class="label"></span></p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.strictEqual(
      countOccurrences(root, '> .desc {'),
      1,
      'duplicate elements should be merged into a single selector'
    )
    assert.ok(root.includes('> .icon {'), 'nested child ".icon" should be present')
    assert.ok(root.includes('> .label {'), 'nested child ".label" should be present')
  })

  it('merges data-state selectors for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-state="loading">Loading</p>
        <p class="desc" data-state="ready">Ready</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-state="loading"]'), 'data-state "loading" should be present')
    assert.ok(root.includes('&[data-state="ready"]'), 'data-state "ready" should be present')
  })

  it('merges aria selectors for duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" aria-expanded="true">Open</p>
        <p class="desc" aria-expanded="false">Closed</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: {
          mode: 'data',
          dataKey: 'data-state',
          ariaKeys: ['aria-expanded']
        }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(
      root.includes('&[aria-expanded="true"]'),
      'aria-expanded "true" should be present'
    )
    assert.ok(
      root.includes('&[aria-expanded="false"]'),
      'aria-expanded "false" should be present'
    )
  })

  it('merges multiple data-variant axes across duplicate elements', async () => {
    const html = `
      <div class="feature-card">
        <p class="desc" data-variant="en">EN</p>
        <p class="desc" data-size="lg">Large</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant', 'data-size'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="en"]'), 'data-variant "en" should be present')
    assert.ok(root.includes('&[data-size="lg"]'), 'data-size "lg" should be present')
  })

  it('generates SCSS with data-state only', async () => {
    const html = `
      <div class="feature-card" data-state="loading">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-state="loading"]'), 'data-state selector should be present')
    assert.ok(!root.includes('data-variant'), 'data-variant selector should not be present')
  })

  it('generates SCSS with class variant + data state', async () => {
    const html = `
      <div class="feature-card -primary" data-state="loading">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'class' },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&.-primary'), 'class variant selector should be present')
    assert.ok(root.includes('&[data-state="loading"]'), 'data-state selector should be present')

    const interactionIndex = root.indexOf('// --interaction')
    const stateIndex = root.indexOf('&[data-state="loading"]')
    assert.ok(interactionIndex >= 0 && stateIndex > interactionIndex, 'state selector should be in interaction section')
  })

  it('generates SCSS with multiple data-variant axes', async () => {
    const html = `
      <div class="feature-card" data-variant="primary" data-size="lg">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant', 'data-size'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="primary"]'), 'data-variant selector should be present')
    assert.ok(root.includes('&[data-size="lg"]'), 'data-size selector should be present')
  })

  it('puts class state modifiers into interaction when state.mode is class', async () => {
    const html = `
      <div class="feature-card -loading" data-variant="primary">
        <h2 class="title">Feature</h2>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'class' }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    assert.ok(root.includes('&[data-variant="primary"]'), 'data-variant selector should be present')
    assert.ok(root.includes('&.-loading'), 'class state selector should be present')

    const interactionIndex = root.indexOf('// --interaction')
    const stateIndex = root.indexOf('&.-loading')
    assert.ok(interactionIndex >= 0 && stateIndex > interactionIndex, 'state selector should be in interaction section')
  })

  it('puts element class state modifiers into interaction when state.mode is class', async () => {
    const html = `
      <div class="feature-card">
        <span class="icon -loading"></span>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'class' }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    const interactionIndex = root.indexOf('// --interaction')
    const interaction = interactionIndex >= 0 ? root.slice(interactionIndex) : ''
    assert.ok(interaction.includes('> .icon {'), 'Element path should be in interaction section')
    assert.ok(interaction.includes('&.-loading'), 'Element state selector should be in interaction section')
  })

  it('puts nested element state paths into interaction', async () => {
    const html = `
      <div class="feature-card">
        <div class="list">
          <span class="item -selected"></span>
        </div>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'class' }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')
    const interactionIndex = root.indexOf('// --interaction')
    const interaction = interactionIndex >= 0 ? root.slice(interactionIndex) : ''
    assert.ok(interaction.includes('> .list > .item {'), 'Nested element path should be in interaction section')
    assert.ok(interaction.includes('&.-selected'), 'Nested element state selector should be in interaction section')
  })

  it('does not emit state selectors when variant/state are class', async () => {
    const html = `
      <div class="feature-card -loading">
        <span class="icon -spinning"></span>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      selectorPolicy: {
        variant: { mode: 'class' },
        state: { mode: 'class' }
      }
    })
    const root = generated.find((f) => f.path === 'feature-card.scss')?.content

    assert.ok(root, 'feature-card SCSS should be generated')

    const interactionIndex = root.indexOf('// --interaction')
    const loadingIndex = root.indexOf('&.-loading')
    const spinningIndex = root.indexOf('&.-spinning')
    assert.ok(loadingIndex >= 0, 'modifier should remain in base section')
    assert.ok(spinningIndex >= 0, 'element modifier should remain in base section')
    const interaction = interactionIndex >= 0 ? root.slice(interactionIndex) : ''
    if (interactionIndex >= 0) {
      assert.ok(loadingIndex < interactionIndex, 'modifier should be before interaction section')
      assert.ok(spinningIndex < interactionIndex, 'element modifier should be before interaction section')
    }
    assert.ok(!interaction.includes('&.-loading'), 'state selectors should not be in interaction section')
    assert.ok(!interaction.includes('> .icon {'), 'Element state paths should not be generated')
  })

  it('throws on invalid selectorPolicy modes', () => {
    const html = '<div class="feature-card"></div>'
    assert.throws(() => {
      generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        selectorPolicy: {
          variant: { mode: '' as unknown as 'data' },
          state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
        }
      })
    }, /selectorPolicy\.variant\.mode/)

    assert.throws(() => {
      generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        selectorPolicy: {
          variant: { mode: 'data', dataKeys: ['data-variant'] },
          state: { mode: '' as unknown as 'data', dataKey: 'data-state', ariaKeys: [] }
        }
      })
    }, /selectorPolicy\.state\.mode/)
  })

  it('throws on invalid selectorPolicy key lists', () => {
    const html = '<div class="feature-card"></div>'
    assert.throws(() => {
      generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        selectorPolicy: {
          variant: { mode: 'data', dataKeys: ['data-variant', 1 as unknown as string] },
          state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
        }
      })
    }, /selectorPolicy\.variant\.dataKeys/)

    assert.throws(() => {
      generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        selectorPolicy: {
          variant: { mode: 'data', dataKeys: ['data-variant'] },
          state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded', 1 as unknown as string] }
        }
      })
    }, /selectorPolicy\.state\.ariaKeys/)
  })

  it('throws on non-string selectorPolicy keys', () => {
    const html = '<div class="feature-card"></div>'
    assert.throws(() => {
      generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        selectorPolicy: {
          variant: { mode: 'data', dataKeys: ['data-variant', 1 as unknown as string] },
          state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
        }
      })
    }, /selectorPolicy\.variant\.dataKeys/)

    assert.throws(() => {
      generateFromHtml(html, fixturesDir, true, {
        ...baseOptions,
        selectorPolicy: {
          variant: { mode: 'data', dataKeys: ['data-variant'] },
          state: { mode: 'data', dataKey: 'data-state', ariaKeys: ['aria-expanded', 1 as unknown as string] }
        }
      })
    }, /selectorPolicy\.state\.ariaKeys/)
  })

  // Additional test: element nesting
  it('nests elements inside blocks', async () => {
    const html = `
      <section class="hero-section">
        <h1 class="title">Title</h1>
        <p class="lede">Description</p>
      </section>
    `
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    const root = generated.find((f) => f.path === 'hero-section.scss')?.content

    assert.ok(root, 'hero-section SCSS should be generated')
    assert.ok(root.includes('> .title'), 'Element .title should be nested')
    assert.ok(root.includes('> .lede'), 'Element .lede should be nested')
  })

  it('skips generation when external class precedes block', () => {
    const html = '<div class="swiper-slide hero-section"><div class="title"></div></div>'
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      allowExternalPrefixes: ['swiper-']
    })
    const root = generated.find((f) => f.path === 'hero-section.scss')
    assert.ok(!root, 'hero-section SCSS should not be generated when external class is first')
  })

  // Additional test: Block detection (camelCase)
  it('recognizes camelCase blocks', () => {
    const html = '<div class="heroSection"><h1 class="title">Test</h1></div>'
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      naming: { blockCase: 'camel' }
    })
    const root = generated.find((f) => f.path === 'heroSection.scss')
    assert.ok(root, 'camelCase block should be recognized')
  })

  // Additional test: Block detection (PascalCase)
  it('recognizes PascalCase blocks', () => {
    const html = '<div class="HeroSection"><h1 class="title">Test</h1></div>'
    const generated = generateFromHtml(html, fixturesDir, true, {
      ...baseOptions,
      naming: { blockCase: 'pascal' }
    })
    const root = generated.find((f) => f.path === 'HeroSection.scss')
    assert.ok(root, 'PascalCase block should be recognized')
  })

  // Additional test: depth guard
  it('handles deeply nested DOM without stack overflow', () => {
    let html = '<div class="sample-box">'
    for (let i = 0; i < 300; i++) {
      html += `<div class="level-${i}">`
    }
    html += '<div class="deep-element">Deep</div>'
    for (let i = 0; i < 300; i++) {
      html += '</div>'
    }
    html += '</div>'

    // Ensure no exception even with MAX_DEPTH=256
    assert.doesNotThrow(() => {
      generateFromHtml(html, fixturesDir, true, baseOptions)
    }, 'Should not throw on deeply nested DOM')
  })

  // Additional test: empty class
  it('handles elements without class attribute', () => {
    const html = '<div class="sample-box"><div><p>No class</p></div></div>'
    assert.doesNotThrow(() => {
      generateFromHtml(html, fixturesDir, true, baseOptions)
    }, 'Should handle elements without class')
  })

  // Additional test: HTML lint - multiple base classes
  it('HTML lint detects multiple base classes', () => {
    const html = '<div class="hero-section feature-card">Invalid</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'MULTIPLE_BASE_CLASSES'),
      'Should detect multiple base classes'
    )
  })

  it('HTML lint rejects multi-word camelCase elements', () => {
    const html = '<div class="hero-section"><span class="bodyText"></span></div>'
    const issues = lintHtmlStructure(html, true, {
      blockCase: 'kebab',
      elementCase: 'camel'
    })
    assert.ok(
      issues.some((i) => i.code === 'INVALID_BASE_CLASS' && i.baseClass === 'bodyText'),
      'Should reject multi-word camelCase element'
    )
  })

  it('HTML lint rejects multi-word PascalCase elements', () => {
    const html = '<div class="hero-section"><span class="BodyText"></span></div>'
    const issues = lintHtmlStructure(html, true, {
      blockCase: 'kebab',
      elementCase: 'pascal'
    })
    assert.ok(
      issues.some((i) => i.code === 'INVALID_BASE_CLASS' && i.baseClass === 'BodyText'),
      'Should reject multi-word PascalCase element'
    )
  })

  it('HTML lint ignores allowExternal classes in multiple base check', () => {
    const html = '<div class="hero-section swiper-slide">External</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' }, undefined, {
      allowExternalClasses: ['swiper-slide']
    })
    assert.ok(
      issues.every((i) => i.code !== 'MULTIPLE_BASE_CLASSES'),
      'Should ignore external classes'
    )
  })

  it('HTML lint reports invalid base when external class comes first', () => {
    const html = '<div class="swiper-slide hero-section"><div class="title"></div></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' }, undefined, {
      allowExternalPrefixes: ['swiper-']
    })
    assert.ok(
      issues.some((i) => i.code === 'INVALID_BASE_CLASS'),
      'Should report invalid base when external class is first'
    )
    assert.ok(
      issues.every((i) => i.code !== 'ELEMENT_WITHOUT_BLOCK_ANCESTOR'),
      'Should not cascade element-without-block errors'
    )
  })

  it('HTML lint reports missing base when only external + modifiers/utilities exist', () => {
    const html = '<div class="swiper-slide -wide u-hidden"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' }, undefined, {
      allowExternalPrefixes: ['swiper-']
    })
    assert.ok(
      issues.some(
        (i) =>
          i.code === 'INVALID_BASE_CLASS' && i.message.includes('No Block/Element class found')
      ),
      'Should report missing Block/Element when only modifiers/utilities exist'
    )
  })

  it('HTML lint uses the first element in root mode', () => {
    const html = '<div><span class="hero-section"></span></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some(
        (i) => i.code === 'INVALID_BASE_CLASS' && i.message.includes('Root element')
      ),
      'Should report missing class on the first element'
    )
  })

  it('HTML lint reports when no elements are found', () => {
    const html = '<!-- comment only -->'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'INVALID_BASE_CLASS' && i.message.includes('No element')),
      'Should report missing elements'
    )
  })

  it('HTML lint uses html tag when input contains <html>', () => {
    const html = '<html class="page"><body><div class="hero-section"></div></body></html>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'ROOT_NOT_BLOCK' && i.baseClass === 'page'),
      'Should use html element as root'
    )
  })

  it('HTML lint uses body tag when input contains <body> only', () => {
    const html = '<body class="page"><div class="hero-section"></div></body>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'ROOT_NOT_BLOCK' && i.baseClass === 'page'),
      'Should use body element as root'
    )
  })

  it('HTML lint ignores html/body inside comments', () => {
    const html = '<!-- <html> --><div class="hero-section"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should use the first element, not comment')
  })

  it('HTML lint ignores html/body inside attributes', () => {
    const html = '<div class="hero-section" data-template="<body>"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should use the first element, not attribute value')
  })

  it('HTML lint ignores html/body inside iframe srcdoc attributes', () => {
    const html = '<div class="hero-section"><iframe srcdoc="<html>"></iframe></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore srcdoc attributes')
  })

  it('HTML lint ignores html/body inside svg foreignObject', () => {
    const html =
      '<div class="hero-section"><svg><foreignObject><body></body></foreignObject></svg></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore foreignObject content')
  })

  it('HTML lint ignores html/body inside MathML annotation-xml', () => {
    const html =
      '<div class="hero-section"><math><annotation-xml encoding="text/html"><body></body></annotation-xml></math></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore MathML annotation content')
  })

  it('HTML lint ignores html/body inside noscript content', () => {
    const html = '<div class="hero-section"><noscript><body></body></noscript></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore noscript content')
  })

  it('HTML lint ignores html/body inside xmp content', () => {
    const html = '<div class="hero-section"><xmp><body></body></xmp></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore xmp content')
  })

  it('HTML lint ignores html/body inside listing content', () => {
    const html = '<div class="hero-section"><listing><body></body></listing></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore listing content')
  })

  it('HTML lint ignores html/body inside Handlebars blocks', () => {
    const html = '<div class="hero-section">{{#if show}}<html></html>{{/if}}</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore Handlebars content')
  })

  it('HTML lint ignores html/body inside HTML entities', () => {
    const html = '<div class="hero-section">&lt;html&gt;</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore HTML entities')
  })

  it('HTML lint ignores html/body inside unicode escapes', () => {
    const html = '<div class="hero-section">\\u003Chtml\\u003E</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore unicode escapes')
  })

  it('HTML lint ignores html/body inside script content', () => {
    const html =
      '<script>const tpl = "<body>";</script><div class="hero-section"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore script content')
  })

  it('HTML lint ignores html/body inside style content', () => {
    const html = '<style>/* <html> */</style><div class="hero-section"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore style content')
  })

  it('HTML lint ignores closing body tags', () => {
    const html = '</body><div class="hero-section"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should use the first element, not closing tags')
  })

  it('HTML lint ignores closing head tags', () => {
    const html = '</head><div class="hero-section"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore closing head tags')
  })

  it('HTML lint ignores void tags like <br/>', () => {
    const html = '<div class="hero-section"><br/></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore void tags')
  })

  it('HTML lint ignores html/body inside textarea content', () => {
    const html = '<textarea class="text-area"><html></textarea><div class="hero-section"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should use the first element, not textarea content')
  })

  it('HTML lint ignores html/body inside template content', () => {
    const html = '<template class="template-box"><body></template>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should use the first element, not template content')
  })

  it('HTML lint ignores template tag names inside attributes', () => {
    const html =
      '<div class="hero-section" data-content="<template>"></div><template class="template-box"></template>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore template tag names in attributes')
  })

  it('HTML lint ignores html/body inside CDATA sections', () => {
    const html = '<div class="hero-section"><![CDATA[<body>]]></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.strictEqual(issues.length, 0, 'Should ignore CDATA content')
  })

  it('generateFromHtml fails when the html element has no class', () => {
    const html = '<html><body><div class="hero-section"></div></body></html>'
    assert.throws(() => generateFromHtml(html, fixturesDir, true, baseOptions), /class attribute/)
  })

  it('generateFromHtml ignores html/body inside template content', () => {
    const html = '<template class="template-box"><html></template>'
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    assert.ok(
      generated.some((f) => f.path === 'template-box.scss'),
      'Should use the first element when template content includes html/body'
    )
  })

  it('generateFromHtml ignores template tag names inside attributes', () => {
    const html =
      '<div class="hero-section" data-content="<template>"></div><template class="template-box"></template>'
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    assert.ok(
      generated.some((f) => f.path === 'hero-section.scss'),
      'Should use the first element when template tag names appear in attributes'
    )
  })

  it('generateFromHtml ignores html/body inside CDATA sections', () => {
    const html = '<div class="hero-section"><![CDATA[<body>]]></div>'
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    assert.ok(
      generated.some((f) => f.path === 'hero-section.scss'),
      'Should ignore CDATA content when selecting the root element'
    )
  })

  it('generateFromHtml ignores html/body inside svg foreignObject', () => {
    const html =
      '<div class="hero-section"><svg><foreignObject><body></body></foreignObject></svg></div>'
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    assert.ok(
      generated.some((f) => f.path === 'hero-section.scss'),
      'Should ignore foreignObject content when selecting the root element'
    )
  })

  it('generateFromHtml ignores html/body inside Handlebars blocks', () => {
    const html = '<div class="hero-section">{{#if show}}<html></html>{{/if}}</div>'
    const generated = generateFromHtml(html, fixturesDir, true, baseOptions)
    assert.ok(
      generated.some((f) => f.path === 'hero-section.scss'),
      'Should ignore Handlebars content when selecting the root element'
    )
  })

  it('generateFromHtml fails when the first element has no class', () => {
    const html = '<div><span class="hero-section"></span></div>'
    assert.throws(
      () => generateFromHtml(html, fixturesDir, true, baseOptions),
      /does not have a class attribute/
    )
  })

  it('HTML lint treats custom modifierPrefix as modifier (not base)', () => {
    const html = '<div class="feature-card is-active">OK</div>'
    const issues = lintHtmlStructure(html, true, {
      blockCase: 'kebab',
      modifierPrefix: 'is-'
    })
    assert.ok(
      issues.every((i) => i.code !== 'MULTIPLE_BASE_CLASSES'),
      'Should not treat modifier as another base class'
    )
  })

  // Additional test: HTML lint - modifier without base
  it('HTML lint detects modifier without base', () => {
    const html = '<div class="-primary">Invalid</div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'MODIFIER_WITHOUT_BASE'),
      'Should detect modifier without base class'
    )
  })

  it('HTML lint detects modifiers in data/data mode', () => {
    const html = '<div class="feature-card -loading">Invalid</div>'
    const issues = lintHtmlStructure(
      html,
      true,
      { blockCase: 'kebab' },
      {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      }
    )
    assert.ok(
      issues.some((i) => i.code === 'DISALLOWED_MODIFIER'),
      'Should detect disallowed modifiers in data/data mode'
    )
  })

  it('HTML lint ignores external classes in modifier checks', () => {
    const html = '<div class="feature-card -wide">External</div>'
    const issues = lintHtmlStructure(
      html,
      true,
      { blockCase: 'kebab' },
      {
        variant: { mode: 'data', dataKeys: ['data-variant'] },
        state: { mode: 'data', dataKey: 'data-state', ariaKeys: [] }
      },
      { allowExternalClasses: ['-wide'] }
    )
    assert.ok(
      issues.every((i) => i.code !== 'DISALLOWED_MODIFIER'),
      'Should ignore external modifiers in data/data mode'
    )
  })

  it('HTML lint detects disallowed variant attributes in class mode', () => {
    const html = '<div class="feature-card" data-variant="primary">Invalid</div>'
    const issues = lintHtmlStructure(
      html,
      true,
      { blockCase: 'kebab' },
      { variant: { mode: 'class' }, state: { mode: 'class' } }
    )
    assert.ok(
      issues.some((i) => i.code === 'DISALLOWED_VARIANT_ATTRIBUTE'),
      'Should detect disallowed variant attribute'
    )
  })

  it('HTML lint detects disallowed state attributes in class mode', () => {
    const html = '<div class="feature-card" data-state="loading" aria-expanded="true">Invalid</div>'
    const issues = lintHtmlStructure(
      html,
      true,
      { blockCase: 'kebab' },
      { variant: { mode: 'class' }, state: { mode: 'class' } }
    )
    assert.ok(
      issues.some((i) => i.code === 'DISALLOWED_STATE_ATTRIBUTE'),
      'Should detect disallowed state attribute'
    )
  })

  it('HTML lint ignores non-reserved data attributes', () => {
    const html = '<div class="feature-card" data-testid="card">OK</div>'
    const issues = lintHtmlStructure(
      html,
      true,
      { blockCase: 'kebab' },
      { variant: { mode: 'class' }, state: { mode: 'class' } }
    )
    assert.strictEqual(issues.length, 0, `Expected no issues, got: ${JSON.stringify(issues)}`)
  })

  it('HTML lint detects unbalanced HTML fragments', () => {
    const html = '<div class="card-item"><h3 class="title">Title</h3>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'UNBALANCED_HTML'),
      'Should detect unbalanced HTML'
    )
  })

  it('HTML lint detects multiple root elements in root mode', () => {
    const html = '<div class="alpha-box"></div><div class="beta-box"></div>'
    const issues = lintHtmlStructure(html, true, { blockCase: 'kebab' })
    assert.ok(
      issues.some((i) => i.code === 'MULTIPLE_ROOT_ELEMENTS'),
      'Should detect multiple root elements'
    )
  })

  // Additional test: selection mode
  it('generates SCSS in selection mode', () => {
    const html = `
      <div class="hero-header">
        <h1 class="title">Hero</h1>
      </div>
      <div class="feature-list">
        <div class="item">Item</div>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, false, baseOptions)

    // Selection mode generates under scss/
    assert.ok(
      generated.some((f) => f.path.includes('hero-header.scss')),
      'hero-header should be generated in selection mode'
    )
    assert.ok(
      generated.some((f) => f.path.includes('feature-list.scss')),
      'feature-list should be generated in selection mode'
    )
  })

  it('selection mode merges duplicate root blocks', () => {
    const html = `
      <div class="card-item -featured">
        <h3 class="title">Card Title</h3>
      </div>
      <div class="card-item -compact">
        <p class="description">Card description text goes here.</p>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, false, baseOptions)
    const rootFile = generated.find((f) => f.path.includes('scss/card-item.scss'))
    assert.ok(rootFile, 'card-item should be generated once in selection mode')
    assert.ok(rootFile?.content.includes('&.-featured'), 'Merged output should include -featured')
    assert.ok(rootFile?.content.includes('&.-compact'), 'Merged output should include -compact')
    assert.ok(rootFile?.content.includes('> .title'), 'Merged output should include .title')
    assert.ok(
      rootFile?.content.includes('> .description'),
      'Merged output should include .description'
    )
  })

  it('selection mode merges 3+ duplicate root blocks', () => {
    const html = `
      <div class="card-item -featured">
        <h3 class="title">Card Title</h3>
      </div>
      <div class="card-item -compact">
        <p class="description">Card description text goes here.</p>
      </div>
      <div class="card-item -wide">
        <span class="meta">Meta</span>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, false, baseOptions)
    const rootFile = generated.find((f) => f.path.includes('scss/card-item.scss'))
    assert.ok(rootFile, 'card-item should be generated once in selection mode')
    assert.ok(rootFile?.content.includes('&.-featured'), 'Merged output should include -featured')
    assert.ok(rootFile?.content.includes('&.-compact'), 'Merged output should include -compact')
    assert.ok(rootFile?.content.includes('&.-wide'), 'Merged output should include -wide')
    assert.ok(rootFile?.content.includes('> .title'), 'Merged output should include .title')
    assert.ok(
      rootFile?.content.includes('> .description'),
      'Merged output should include .description'
    )
    assert.ok(rootFile?.content.includes('> .meta'), 'Merged output should include .meta')
  })

  it('selection mode merges deeply nested children', () => {
    const html = `
      <div class="profile-card">
        <div class="content">
          <h3 class="title">Profile</h3>
        </div>
      </div>
      <div class="profile-card">
        <div class="content">
          <p class="description">Details</p>
          <div class="meta">
            <span class="tag">New</span>
          </div>
        </div>
      </div>
    `
    const generated = generateFromHtml(html, fixturesDir, false, baseOptions)
    const rootFile = generated.find((f) => f.path.includes('scss/profile-card.scss'))
    assert.ok(rootFile, 'profile-card should be generated once in selection mode')
    assert.ok(rootFile?.content.includes('> .content'), 'Merged output should include .content')
    assert.ok(rootFile?.content.includes('> .title'), 'Merged output should include .title')
    assert.ok(
      rootFile?.content.includes('> .description'),
      'Merged output should include .description'
    )
    assert.ok(rootFile?.content.includes('> .meta'), 'Merged output should include .meta')
    assert.ok(rootFile?.content.includes('> .tag'), 'Merged output should include .tag')
  })
})
