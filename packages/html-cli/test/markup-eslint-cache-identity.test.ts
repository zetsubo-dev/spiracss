import assert from 'assert'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it } from 'mocha'
import { ESLint } from 'eslint'
import * as htmlParser from '@html-eslint/parser'
import { createMarkupEslintConfig } from '../src/eslint'

describe('explicit custom-pattern cache identity', () => {
  it('keeps warm and uncached results equal through A to B to A', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'spiracss-pattern-cache-'))
    try {
      const file = path.join(directory, 'fixture.html')
      await fs.writeFile(file, '<div class="sample-box"><p class="body"></p></div>')
      const counts: number[] = []
      for (const pattern of [/^sample-box$/, /^other-box$/, /^sample-box$/]) {
        const config = { naming: { customPatterns: { block: pattern } } }
        const create = (cache: boolean) =>
          new ESLint({
            cwd: directory,
            cache,
            cacheLocation: path.join(directory, '.eslintcache'),
            overrideConfigFile: true,
            overrideConfig: [createMarkupEslintConfig(config, htmlParser)] as never
          })
        const warm = (await create(true).lintFiles([file]))[0]
        const fresh = (await create(false).lintFiles([file]))[0]
        assert.deepStrictEqual(warm.messages, fresh.messages)
        counts.push(warm.errorCount)
      }
      assert.strictEqual(counts[0], 0)
      assert.ok(counts[1] > 0)
      assert.strictEqual(counts[2], 0)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
