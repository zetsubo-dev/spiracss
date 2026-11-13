import assert from 'assert'
import { describe, it } from 'mocha'
import { SourceIndex } from '../src/markup/source'
import { htmlClassTokens } from '../src/markup/class-values'

describe('source revision indices', () => {
  it('uses one line break for CRLF and recognizes CR and JavaScript line separators', () => {
    const source = 'a\r\nb\rc\u2028d\u2029e\nf'
    const index = new SourceIndex(source)
    assert.deepStrictEqual(index.lineStarts, [0, 3, 5, 7, 9, 11])
    for (const [offset, line] of [
      [3, 2],
      [5, 3],
      [7, 4],
      [9, 5],
      [11, 6]
    ]) {
      assert.deepStrictEqual(index.location(offset), { line, column: 1 })
    }
  })

  it('uses attribute-context entities and ASCII class whitespace with original spans', () => {
    const raw = 'card-list&notit; body&nbsp;title&#32;Bad_Name'
    const tokens = htmlClassTokens(raw, 10)
    assert.deepStrictEqual(
      tokens.map((token) => token.value),
      ['card-list&notit;', 'body\u00a0title', 'Bad_Name']
    )
    assert.deepStrictEqual(
      tokens.map((token) => raw.slice(token.range[0] - 10, token.range[1] - 10)),
      ['card-list&notit;', 'body&nbsp;title', 'Bad_Name']
    )
  })
})
