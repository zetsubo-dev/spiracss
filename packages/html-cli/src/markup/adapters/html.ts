import { Parser, type DefaultTreeAdapterMap, type Token } from 'parse5'
import type { HtmlLintMode, HtmlTargetPath } from '../../generator-core'
import { htmlClassTokens } from '../class-values'
import { SourceIndex, type SourceRange } from '../source'
import type { ClassToken, MarkupAttribute, MarkupConfig, MarkupDocument, MarkupElement } from '../types'
import { createMarkupRuleContext } from '../../generator-core'
import { applyHtmlRecovery, type HtmlStartTag } from './html-recovery'

type HtmlNode = DefaultTreeAdapterMap['node']

export function parseHtmlSource(source: string, _mode: HtmlLintMode, config: MarkupConfig): MarkupDocument {
  const index = new SourceIndex(source)
  index.metrics.markupParses = 1
  const issues: MarkupDocument['issues'] = []
  const policy = createMarkupRuleContext(config).policy
  const relevant = new Set(['class', ...policy.variant.dataKeys, policy.state.dataKey, ...policy.state.ariaKeys])
  const observed = new Map<number, HtmlStartTag>()
  // This thin hook intentionally targets parse5 7.3.0's @internal Parser.
  // Contract tests cover dropped select tokens, foster parenting and raw text.
  class ObservedParser extends Parser<DefaultTreeAdapterMap> {
    override onStartTag(token: Token.TagToken): void {
      if (token.location)
        observed.set(token.location.startOffset, {
          tag: token.tagName,
          range: [token.location.startOffset, token.location.endOffset]
        })
      super.onStartTag(token)
    }
  }
  const options = {
    sourceCodeLocationInfo: true,
    scriptingEnabled: false,
    onParseError: (error: { code: string; startOffset: number; endOffset: number }) => {
      if (error.code === 'missing-doctype') return
      if (
        /character-reference|comment|input-stream/.test(error.code) ||
        error.code === 'invalid-first-character-of-tag-name' ||
        error.code === 'eof-in-element-that-can-contain-only-text' ||
        error.code === 'non-void-html-element-start-tag-with-trailing-solidus'
      )
        return
      if (error.code === 'duplicate-attribute') {
        let start = error.startOffset
        while (start > 0 && !/[\t\n\f\r /=><]/.test(source[start - 1])) start -= 1
        if (!relevant.has(source.slice(start, error.startOffset).toLowerCase())) return
      }
      issues.push({
        code: 'SOURCE_RELATION_UNRESOLVED',
        kind: 'unresolved',
        message: `HTML recovery may affect local source relations: ${error.code}.`,
        baseClass: '',
        path: [],
        range: [error.startOffset, error.endOffset]
      })
    }
  }
  const fullDocument = /^\s*(?:<!doctype\b|<html\b)/i.test(source)
  const parser = fullDocument
    ? new ObservedParser(options)
    : ObservedParser.getFragmentParser<DefaultTreeAdapterMap>(null, options)
  parser.tokenizer.write(source, true)
  const document = fullDocument ? parser.document : parser.getFragment()
  const convert = (
    node: HtmlNode,
    depth = 0,
    parentPath: HtmlTargetPath | undefined = [],
    siblingIndex = 1
  ): MarkupElement[] => {
    if (!('tagName' in node)) return []
    const loc = node.sourceCodeLocation
    if (depth > 256) {
      issues.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Source traversal exceeded the implementation safety limit of 256 nested elements.',
        baseClass: '',
        path: [],
        range: loc ? [loc.startOffset, loc.startOffset] : [0, 0]
      })
      return []
    }
    const openRange: SourceRange = loc?.startTag ? [loc.startTag.startOffset, loc.startTag.endOffset] : [0, 0]
    const attributes: MarkupAttribute[] = []
    let tokens: ClassToken[] = []
    for (const attribute of node.attrs) {
      const attrLoc = loc?.attrs?.[attribute.name]
      if (!attrLoc) continue
      const raw = source.slice(attrLoc.startOffset, attrLoc.endOffset)
      const valueMatch = /^[^=\s]+\s*=\s*(?:"([\s\S]*)"|'([\s\S]*)'|([^\s>]*))$/.exec(raw)
      const value = valueMatch ? (valueMatch[1] ?? valueMatch[2] ?? valueMatch[3] ?? '') : ''
      const equals = raw.indexOf('=')
      let start = equals < 0 ? attrLoc.endOffset : attrLoc.startOffset + equals + 1
      while (start < attrLoc.endOffset && /[\t\n\f\r ]/.test(source[start])) start += 1
      if (source[start] === '"' || source[start] === "'") start += 1
      const range: SourceRange = [attrLoc.startOffset, attrLoc.endOffset]
      const unmappedValue = !valueMatch && attribute.value.length > 0
      const valueRange: SourceRange = unmappedValue ? range : [start, start + value.length]
      attributes.push({
        name: attribute.name,
        value: attribute.value,
        range,
        valueRange
      })
      if (attribute.name === 'class')
        tokens = unmappedValue
          ? attribute.value.split(/[\t\n\f\r ]+/).filter(Boolean).map((value) => ({ value, range }))
          : htmlClassTokens(source.slice(...valueRange), valueRange[0])
    }
    const childNodes = node.tagName === 'template' && 'content' in node ? node.content.childNodes : node.childNodes
    const targetPath =
      loc && parentPath
        ? [
            ...parentPath,
            { tagName: node.tagName, siblingIndex, ...(tokens[0] ? { className: tokens[0].value } : {}) }
          ].slice(-32)
        : undefined
    return [
      {
        tag: node.tagName,
        range: loc ? [loc.startOffset, loc.endOffset] : [0, 0],
        openRange,
        namespace: node.namespaceURI,
        implicit: !loc,
        targetPath,
        attributes,
        classes: [{ tokens, guard: {} }],
        children: childNodes
          .filter((child) => 'tagName' in child)
          .flatMap((child, childIndex) => convert(child, depth + (loc ? 1 : 0), targetPath, childIndex + 1))
      }
    ]
  }
  return applyHtmlRecovery(
    {
      roots: document.childNodes
        .filter((node) => 'tagName' in node)
        .flatMap((node, index) => convert(node, 0, [], index + 1)),
      issues,
      index,
      outOfScope: 0
    },
    [...observed.values()]
  )
}
