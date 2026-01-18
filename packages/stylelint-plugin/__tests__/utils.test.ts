import assert from 'assert'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Rule } from 'postcss'
import scss from 'postcss-scss'
import type { PostcssResult } from 'stylelint'

import {
  resolveAliasCandidates,
  resolvePathCandidates
} from '../dist/esm/rules/spiracss-rel-comments.alias.js'
import { createLruCache } from '../dist/esm/utils/cache.js'
import { buildBlockPattern, normalizeCustomPattern } from '../dist/esm/utils/naming.js'
import {
  normalizeBoolean,
  normalizeCommentPattern,
  normalizeKeyList
} from '../dist/esm/utils/normalize.js'
import {
  formatCode,
  formatList,
  formatPattern
} from '../dist/esm/utils/messages.js'
import { isRuleInRootScope, markSectionRules } from '../dist/esm/utils/section.js'
import {
  collectCompoundNodes,
  collectCompoundSegments,
  collectNestingSiblingClasses,
  collectSelectorSummary,
  createSelectorParserCache
} from '../dist/esm/utils/selector.js'
import { reportInvalidOption } from '../dist/esm/utils/stylelint.js'

describe('utils/alias', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-alias-'))
  const projectRoot = path.join(tempRoot, 'project')
  const baseDir = path.join(projectRoot, 'components')
  fs.mkdirSync(baseDir, { recursive: true })

  after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('rejects relative paths that escape project root', () => {
    const targets = resolvePathCandidates('../../outside.scss', baseDir, projectRoot, {})
    assert.deepStrictEqual(targets, [])
  })

  it('accepts relative paths within project root', () => {
    const insidePath = path.resolve(projectRoot, 'inside.scss')
    fs.writeFileSync(insidePath, '', 'utf8')
    const targets = resolvePathCandidates('../inside.scss', baseDir, projectRoot, {})
    assert.deepStrictEqual(targets, [insidePath])
  })

  it('rejects alias bases outside project root', () => {
    const aliasRoots = { assets: ['../outside'] }
    const targets = resolveAliasCandidates('@assets/file.scss', projectRoot, aliasRoots)
    assert.deepStrictEqual(targets, [])
  })

  it('rejects alias targets that escape project root', () => {
    const aliasRoots = { assets: ['assets'] }
    const targets = resolveAliasCandidates('@assets/../../secret.scss', projectRoot, aliasRoots)
    assert.deepStrictEqual(targets, [])
  })

  it('accepts alias targets within project root', () => {
    const aliasRoots = { assets: ['assets'] }
    const iconPath = path.resolve(projectRoot, 'assets/icons/icon.svg')
    fs.mkdirSync(path.dirname(iconPath), { recursive: true })
    fs.writeFileSync(iconPath, '', 'utf8')
    const targets = resolveAliasCandidates('@assets/icons/icon.svg', projectRoot, aliasRoots)
    assert.deepStrictEqual(targets, [iconPath])
  })

  it('accepts alias targets within project root even if the file is missing', () => {
    const aliasRoots = { assets: ['assets'] }
    const missingPath = path.resolve(projectRoot, 'assets/icons/missing.svg')
    fs.mkdirSync(path.dirname(missingPath), { recursive: true })
    const targets = resolveAliasCandidates('@assets/icons/missing.svg', projectRoot, aliasRoots)
    assert.deepStrictEqual(targets, [missingPath])
  })

  it('rejects symlink targets that escape project root', function () {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spiracss-'))
    const projectRoot = path.join(tempRoot, 'project')
    const outside = path.join(tempRoot, 'outside')
    try {
      fs.mkdirSync(projectRoot, { recursive: true })
      fs.mkdirSync(outside, { recursive: true })
      const linkDir = path.join(projectRoot, 'linked')
      fs.symlinkSync(outside, linkDir, 'dir')
    } catch {
      this.skip()
      return
    }
    try {
      fs.writeFileSync(path.join(outside, 'secret.scss'), '', 'utf8')
      const targets = resolvePathCandidates('linked/secret.scss', projectRoot, projectRoot, {})
      assert.deepStrictEqual(targets, [])
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

describe('utils/naming', () => {
  it('returns custom block pattern when provided', () => {
    const custom = /^custom-block$/
    const result = buildBlockPattern({ customPatterns: { block: custom } })
    assert.strictEqual(result, custom)
  })

  it('builds kebab-case block patterns with min segments', () => {
    const pattern = buildBlockPattern({ blockCase: 'kebab', blockMaxWords: 3 })
    assert.ok(pattern.test('block-name-foo'))
    assert.ok(!pattern.test('block'))
  })

  it('reports invalid customPatterns when not RegExp', () => {
    let called = false
    const result = normalizeCustomPattern('invalid', 'naming.customPatterns.block', (_name, value, detail) => {
      called = true
      assert.strictEqual(value, 'invalid')
      assert.strictEqual(detail, '[spiracss] naming.customPatterns.block must be a RegExp.')
    })
    assert.strictEqual(result, undefined)
    assert.strictEqual(called, true)
  })

  it('falls back silently without a reporter', () => {
    const result = normalizeCustomPattern('invalid', 'naming.customPatterns.block')
    assert.strictEqual(result, undefined)
  })

  it('rejects customPatterns with g/y flags', () => {
    const custom = /^custom-block$/g
    let called = false
    const result = normalizeCustomPattern(custom, 'naming.customPatterns.block', (_name, value, detail) => {
      called = true
      assert.strictEqual(value, custom)
      assert.strictEqual(
        detail,
        'RegExp flags "g" and "y" are not allowed for customPatterns.'
      )
    })
    assert.strictEqual(result, undefined)
    assert.strictEqual(called, true)
  })
})

describe('utils/cache', () => {
  it('evicts oldest key when max size exceeded', () => {
    const cache = createLruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4)
    assert.strictEqual(cache.has('a'), false)
    assert.strictEqual(cache.has('d'), true)
  })
})

describe('utils/stylelint', () => {
  it('skips invalid option warnings when validate is false', () => {
    const warnings: string[] = []
    const result = {
      warn: (text: string) => {
        warnings.push(text)
      },
      stylelint: {
        config: { validate: false },
        stylelintError: false
      }
    } as unknown as PostcssResult
    reportInvalidOption(result, 'spiracss/test', 'option', 'invalid')
    assert.strictEqual(warnings.length, 0)
  })
})

describe('utils/normalize', () => {
  it('normalizes comment patterns', () => {
    const fallback = /--shared/i
    const regex = /--interaction/
    assert.strictEqual(normalizeCommentPattern(regex, fallback), regex)

    const fromString = normalizeCommentPattern('--custom', fallback)
    assert.ok(fromString.test('--CUSTOM'))
    assert.strictEqual(normalizeCommentPattern('   ', fallback), fallback)
    assert.strictEqual(normalizeCommentPattern(123, fallback), fallback)
  })

  it('falls back on invalid comment pattern strings', () => {
    let called = false
    const fallback = /--shared/i
    const result = normalizeCommentPattern('(', fallback, 'comments.shared', (name, value) => {
      called = true
      assert.strictEqual(name, 'comments.shared')
      assert.strictEqual(value, '(')
    })
    assert.strictEqual(result, fallback)
    assert.strictEqual(called, true)
  })

  it('coerces boolean strings when enabled', () => {
    assert.strictEqual(normalizeBoolean('true', false, { coerce: true }), true)
    assert.strictEqual(normalizeBoolean('false', true, { coerce: true }), false)
  })

  it('rejects dangerous regex patterns (ReDoS)', () => {
    const fallback = /--shared/i
    const dangerous = [/^(a+)+$/, /^(a|a?)+$/, /^(a*)*$/]
    dangerous.forEach((pattern) => {
      let called = false
      const result = normalizeCommentPattern(
        pattern,
        fallback,
        'comments.shared',
        (name, value) => {
          called = true
          assert.strictEqual(name, 'comments.shared')
          assert.strictEqual(value, pattern)
        }
      )
      assert.strictEqual(result, fallback)
      assert.strictEqual(called, true)
    })
  })

  it('normalizes key lists and rejects invalid items', () => {
    const fallback = ['data-variant']
    assert.deepStrictEqual(normalizeKeyList([' data-foo ', 'data-bar'], fallback, 'keys'), [
      'data-foo',
      'data-bar'
    ])
    let called = false
    const emptyArrayResult = normalizeKeyList([], fallback, 'keys', (name, value, detail) => {
      called = true
      assert.strictEqual(name, 'keys')
      assert.deepStrictEqual(value, [])
      assert.strictEqual(detail, '[spiracss] keys must be an array of non-empty strings.')
    })
    assert.deepStrictEqual(emptyArrayResult, fallback)
    assert.strictEqual(called, true)

    called = false
    const nonArrayResult = normalizeKeyList('data-variant', fallback, 'keys', (name, value, detail) => {
      called = true
      assert.strictEqual(name, 'keys')
      assert.strictEqual(value, 'data-variant')
      assert.strictEqual(detail, '[spiracss] keys must be an array of non-empty strings.')
    })
    assert.deepStrictEqual(nonArrayResult, fallback)
    assert.strictEqual(called, true)

    called = false
    const emptyResult = normalizeKeyList([''], fallback, 'keys', (name, value, detail) => {
      called = true
      assert.strictEqual(name, 'keys')
      assert.strictEqual(value[0], '')
      assert.strictEqual(detail, '[spiracss] keys must be an array of non-empty strings.')
    })
    assert.deepStrictEqual(emptyResult, fallback)
    assert.strictEqual(called, true)

    called = false
    const nonStringResult = normalizeKeyList([1], fallback, 'keys', (name, value, detail) => {
      called = true
      assert.strictEqual(name, 'keys')
      assert.strictEqual(value[0], 1)
      assert.strictEqual(detail, '[spiracss] keys must be an array of non-empty strings.')
    })
    assert.deepStrictEqual(nonStringResult, fallback)
    assert.strictEqual(called, true)
  })
})

describe('utils/messages', () => {
  it('formats empty lists as `none`', () => {
    assert.strictEqual(formatList([]), '`none`')
  })

  it('trims long lists with an ellipsis', () => {
    assert.strictEqual(
      formatList(['a', 'b', 'c', 'd'], { maxItems: 2 }),
      '`a`, `b`, `... (+2 more)`'
    )
  })

  it('keeps the remaining count when maxChars is small', () => {
    assert.strictEqual(
      formatList(['alpha', 'beta', 'gamma'], {
        maxItems: 2,
        maxChars: 20,
        maxItemChars: 10
      }),
      '`alpha`, `beta`, `+1`'
    )
  })

  it('keeps the remaining count when maxChars is tiny', () => {
    assert.strictEqual(
      formatList(['alpha', 'beta'], {
        maxItems: 1,
        maxChars: 4,
        maxItemChars: 10
      }),
      '`+2`'
    )
  })

  it('trims long items before adding the remaining count', () => {
    assert.strictEqual(
      formatList(['alphabet', 'betatron', 'gamma'], {
        maxItems: 2,
        maxChars: 50,
        maxItemChars: 6
      }),
      '`alp...`, `bet...`, `... (+1 more)`'
    )
  })

  it('trims inline code content by maxChars', () => {
    assert.strictEqual(formatCode('alpha', { maxChars: 1 }), '`a`')
    assert.strictEqual(formatCode('alpha', { maxChars: 2 }), '`al`')
  })

  it('escapes inline code values', () => {
    assert.strictEqual(formatCode('a`b\nc'), '`a\\`b\\nc`')
  })

  it('formats patterns as inline code', () => {
    assert.strictEqual(formatPattern(/--interaction/i), '`/--interaction/i`')
  })

  it('trims long patterns', () => {
    const longPattern = new RegExp('a'.repeat(200))
    const formatted = formatPattern(longPattern, { maxChars: 20 })
    assert.ok(formatted.startsWith('`/'))
    assert.ok(formatted.endsWith('...`'))
    assert.ok(formatted.length <= 22)
  })
})

describe('utils/selector', () => {
  it('reports parse errors via onError callback', () => {
    let called = false
    const cache = createSelectorParserCache(() => {
      called = true
    })
    const selectors = cache.parse('.block:has(')
    assert.strictEqual(called, true)
    assert.deepStrictEqual(selectors, [])
  })

  it('summarizes selectors and combinators', () => {
    const cache = createSelectorParserCache()
    const [sel] = cache.parse('.block:is(.foo) > .child')
    const summary = collectSelectorSummary(sel)
    assert.strictEqual(summary.firstCombinator, '>')
    assert.strictEqual(summary.combinatorCount, 1)
    assert.deepStrictEqual(
      summary.classes.map((c) => c.value),
      ['block', 'foo', 'child']
    )
  })

  it('collects sibling classes after nesting', () => {
    const cache = createSelectorParserCache()
    const [sel] = cache.parse('&.is-active > .child')
    const names = collectNestingSiblingClasses(sel)
    assert.deepStrictEqual([...names], ['is-active'])
  })

  it('collects compound segments with nesting and pseudos', () => {
    const cache = createSelectorParserCache()
    const [sel] = cache.parse('&::before > .child:hover')
    const segments = collectCompoundSegments(sel)
    assert.strictEqual(segments.length, 2)
    assert.strictEqual(segments[0].hasNesting, true)
    assert.strictEqual(segments[0].pseudos.length, 1)
  })

  it('skips combinators inside :is() when collecting compound nodes', () => {
    const cache = createSelectorParserCache()
    const [sel] = cache.parse('.block:is(.foo .bar) > .child')
    const compounds = collectCompoundNodes(sel, { sameElementPseudos: new Set([':is']) })
    assert.deepStrictEqual(
      compounds[0].classes.map((c) => c.value),
      ['block']
    )
  })

  it('parses long selectors without crashing', () => {
    const cache = createSelectorParserCache()
    const longSelector = `.block${'.a'.repeat(300)}`
    const selectors = cache.parse(longSelector)
    assert.ok(selectors.length > 0)
  })
})

describe('utils/section', () => {
  it('marks rules after section comment until stop comment', () => {
    const root = scss.parse(
      `
.block {
  // --shared
  > .child {}
  // --interaction
  > .skip {}
}
`,
      { syntax: scss }
    )
    const sharedRules = markSectionRules(root, /--shared/i, [/--shared/i, /--interaction/i])
    let childRule: Rule | null = null
    let skipRule: Rule | null = null
    root.walkRules((rule) => {
      if (rule.selector === '> .child') childRule = rule
      if (rule.selector === '> .skip') skipRule = rule
    })
    assert.ok(childRule && sharedRules.has(childRule))
    assert.ok(skipRule && !sharedRules.has(skipRule))
  })

  it('checks root scope against allowed wrappers', () => {
    const root = scss.parse(
      `
@layer base {
  .block {}
}
@media (min-width: 768px) {
  .media-block {}
}
@supports (display: grid) {
  .supported {}
}
`,
      { syntax: scss }
    )
    const allowed = new Set(['layer', 'supports'])
    let blockRule: Rule | null = null
    let mediaRule: Rule | null = null
    let supportedRule: Rule | null = null
    root.walkRules((rule) => {
      if (rule.selector === '.block') blockRule = rule
      if (rule.selector === '.media-block') mediaRule = rule
      if (rule.selector === '.supported') supportedRule = rule
    })
    assert.ok(blockRule && isRuleInRootScope(blockRule, allowed))
    assert.ok(supportedRule && isRuleInRootScope(supportedRule, allowed))
    assert.ok(mediaRule && !isRuleInRootScope(mediaRule, allowed))
  })
})
