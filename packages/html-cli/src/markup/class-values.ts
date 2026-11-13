import { decodeHTMLAttribute } from 'entities'
import type { ClassToken } from './types'

/** Map decoded HTML code units to their original source spans, including entities. */
export function htmlClassTokens(raw: string, offset: number): ClassToken[] {
  const units: Array<{ character: string; start: number; end: number }> = []
  const entityPattern = /&(?:#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);?/y
  for (let cursor = 0; cursor < raw.length;) {
    entityPattern.lastIndex = cursor
    const entity = raw[cursor] === '&' ? entityPattern.exec(raw) : null
    const encoded = entity?.[0] ?? raw[cursor]
    const decoded = entity ? decodeHTMLAttribute(encoded) : encoded
    for (const character of decoded)
      units.push({ character, start: offset + cursor, end: offset + cursor + encoded.length })
    cursor += encoded.length
  }
  const tokens: ClassToken[] = []
  let value = ''
  let start = 0
  let end = 0
  const finish = () => {
    if (value) tokens.push({ value, range: [start, end] })
    value = ''
  }
  for (const unit of units) {
    if (/[\t\n\f\r ]/.test(unit.character)) finish()
    else {
      if (!value) start = unit.start
      value += unit.character
      end = unit.end
    }
  }
  finish()
  return tokens
}
