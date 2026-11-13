import type { HtmlLintIssue } from '../generator-core'

export type SourceRange = [number, number]

/** One source revision shares a line index for diagnostic locations. */
export class SourceIndex {
  readonly lineStarts = [0]
  readonly metrics = {
    markupParses: 0,
    expressionParses: 0,
    scriptParses: 0,
    validationFrames: 0,
    childPropagations: 0,
    generationVisits: 0,
    astroConversions: 0,
    generatedParses: 0,
    classExpressionProducts: 0,
    inertOptionalTokens: 0
  }

  constructor(readonly source: string) {
    for (let offset = 0; offset < source.length; offset += 1) {
      const character = source.charCodeAt(offset)
      if (character === 13) {
        if (source.charCodeAt(offset + 1) === 10) offset += 1
        this.lineStarts.push(offset + 1)
      } else if (character === 10 || character === 0x2028 || character === 0x2029) {
        this.lineStarts.push(offset + 1)
      }
    }
  }

  location(offset: number): { line: number; column: number } {
    let low = 0
    let high = this.lineStarts.length
    while (low + 1 < high) {
      const middle = (low + high) >>> 1
      if (this.lineStarts[middle] <= offset) low = middle
      else high = middle
    }
    return { line: low + 1, column: offset - this.lineStarts[low] + 1 }
  }

  position(range: SourceRange): NonNullable<HtmlLintIssue['position']> {
    const start = this.location(range[0])
    const end = this.location(range[1])
    return { offset: range[0], ...start, endOffset: range[1], endLine: end.line, endColumn: end.column }
  }
}
