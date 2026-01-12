import * as assert from 'assert'

import { warnInvalidCustomPatterns } from '../src/config-warnings'
import type { NamingOptions } from '../src/generator-core'

describe('config-warnings', () => {
  it('warns when customPatterns is not a plain object', () => {
    const messages: string[] = []
    warnInvalidCustomPatterns({ customPatterns: /foo/ } as unknown as NamingOptions, (msg) => {
      messages.push(msg)
    })
    warnInvalidCustomPatterns({ customPatterns: [] } as unknown as NamingOptions, (msg) => {
      messages.push(msg)
    })
    assert.ok(
      messages.some((msg) => msg.includes('customPatterns must be a plain object')),
      'Should warn on non-plain customPatterns values'
    )
  })

  it('warns for invalid custom pattern entries', () => {
    const messages: string[] = []
    warnInvalidCustomPatterns(
      {
        customPatterns: {
          block: /block/g,
          element: 'bad',
          modifier: /modifier/y
        }
      } as unknown as NamingOptions,
      (msg) => {
        messages.push(msg)
      }
    )
    assert.ok(
      messages.some((msg) => msg.includes('customPatterns.block') && msg.includes('"g"')),
      'Should warn on g flag'
    )
    assert.ok(
      messages.some((msg) => msg.includes('customPatterns.element') && msg.includes('RegExp')),
      'Should warn on non-RegExp entry'
    )
    assert.ok(
      messages.some((msg) => msg.includes('customPatterns.modifier') && msg.includes('"y"')),
      'Should warn on y flag'
    )
  })
})
