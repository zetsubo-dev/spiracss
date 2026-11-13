import { decodeHTMLAttribute } from 'entities'
import type { HtmlTargetPath } from '../../generator-core'
import { htmlClassTokens } from '../class-values'
import { markupChildNamespace, markupNamespace } from '../namespaces'
import { SourceIndex, type SourceRange } from '../source'
import type { MarkupAttribute, MarkupConfig, MarkupDocument, MarkupElement } from '../types'
import { createMarkupRuleContext } from '../../generator-core'
import { applyHtmlRecovery } from './html-recovery'

type HtmlAst = {
  type: string
  name?: string
  range: SourceRange
  body?: HtmlAst[]
  children?: HtmlAst[]
  attributes?: Array<{
    range: SourceRange
    key: { value: string; range: SourceRange }
    value?: { value: string; range: SourceRange }
  }>
  openStart?: { range: SourceRange }
  openEnd?: { range: SourceRange }
}

/** Consume html-eslint's supplied tree directly; no HTML serialization or parsing. */
export function adaptHtmlAst(source: string, supplied: unknown, config: MarkupConfig = {}): MarkupDocument {
  const ast = supplied as HtmlAst
  if (ast?.type !== 'Program' || !ast.body?.some((node) => node.type === 'Document'))
    throw Object.assign(new Error('Unsupported supplied HTML AST family; configure @html-eslint/parser.'), {
      code: 'PARSER_UNAVAILABLE'
    })
  const index = new SourceIndex(source)
  const issues: MarkupDocument['issues'] = []
  const rules = createMarkupRuleContext(config)
  const policy = rules.policy
  const relevant = new Set(['class', ...policy.variant.dataKeys, policy.state.dataKey, ...policy.state.ariaKeys])
  const convert = (
    node: HtmlAst,
    depth = 0,
    parentPath: HtmlTargetPath = [],
    siblingIndex = 1,
    namespace = 'http://www.w3.org/1999/xhtml'
  ): MarkupElement[] => {
    if (node.type === 'Document') return convertChildren(node.children ?? [], depth, parentPath, namespace)
    if (!node.name) return []
    if (depth > 256) {
      issues.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Source traversal exceeded the implementation safety limit of 256 nested elements.',
        baseClass: '',
        path: [],
        range: node.range
      })
      return []
    }
    const tag = node.name.toLowerCase()
    namespace = markupNamespace(tag, namespace)
    const attributeNames = new Set<string>()
    const attributes: MarkupAttribute[] = []
    for (const attribute of node.attributes ?? []) {
      const name = attribute.key.value.toLowerCase()
      if (attributeNames.has(name)) {
        if (relevant.has(name))
          issues.push({
            code: 'SOURCE_RELATION_UNRESOLVED',
            kind: 'unresolved',
            message: 'HTML recovery may affect local source relations: duplicate-attribute.',
            baseClass: '',
            path: [],
            range: [attribute.key.range[1], attribute.key.range[1]]
          })
        continue
      }
      attributeNames.add(name)
      attributes.push({
        name,
        value: decodeHTMLAttribute(attribute.value?.value ?? ''),
        range: attribute.range,
        valueRange: attribute.value?.range ?? [attribute.range[1], attribute.range[1]]
      })
    }
    const classAttribute = attributes.find((attribute) => attribute.name === 'class')
    const tokens = classAttribute
      ? htmlClassTokens(source.slice(...classAttribute.valueRange), classAttribute.valueRange[0])
      : []
    const targetPath = [
      ...parentPath,
      { tagName: tag, siblingIndex, ...(tokens[0] ? { className: tokens[0].value } : {}) }
    ].slice(-32)
    const childNamespace = markupChildNamespace(namespace, tag, attributes)
    const rawText =
      namespace === 'http://www.w3.org/1999/xhtml' &&
      ['textarea', 'title', 'iframe', 'noembed', 'noframes', 'plaintext', 'xmp', 'script', 'style'].includes(tag)
    if (rawText && tag !== 'plaintext') {
      const closing = new RegExp(`</${tag}(?=[\\t\\n\\f\\r />])`, 'ig')
      closing.lastIndex = node.openEnd?.range[1] ?? node.range[0]
      const anchor = closing.exec(source)
      const end = anchor ? source.indexOf('>', anchor.index + tag.length + 2) : -1
      if (end >= 0) {
        const descendants = [...(node.children ?? [])]
        let escaped = false
        while (descendants.length) {
          const descendant = descendants.pop()!
          if (descendant.name && descendant.range[0] > end) {
            escaped = true
            break
          }
          descendants.push(...(descendant.children ?? []))
        }
        if (escaped)
          issues.push({
            code: 'SOURCE_RELATION_UNRESOLVED',
            kind: 'unresolved',
            message:
              'Supplied HTML AST text boundary disagrees with the original source; later elements cannot be inspected.',
            reason:
              'Supplied HTML AST text boundary disagrees with the original source; later elements cannot be inspected.',
            baseClass: '',
            path: [],
            range: [node.openStart?.range[0] ?? node.range[0], node.openEnd?.range[1] ?? node.range[0]]
          })
      }
    }
    return [
      {
        tag,
        range: node.range,
        openRange: [node.openStart?.range[0] ?? node.range[0], node.openEnd?.range[1] ?? node.range[0]],
        namespace,
        attributes,
        classes: [{ tokens, guard: {} }],
        children: rawText ? [] : convertChildren(node.children ?? [], depth + 1, targetPath, childNamespace),
        targetPath
      }
    ]
  }
  const convertChildren = (
    nodes: HtmlAst[],
    depth: number,
    parentPath: HtmlTargetPath,
    namespace: string
  ): MarkupElement[] => {
    // Some source-oriented HTML ASTs retain a block under an implicitly ended p.
    // Normalize that established HTML relation without reparsing or mutating the supplied tree.
    const normalized =
      markupNamespace('p', namespace) === 'http://www.w3.org/1999/xhtml'
        ? nodes.flatMap((node) => {
            if (node.name?.toLowerCase() !== 'p') return [node]
            const boundary =
              node.children?.findIndex(
                (candidate) => candidate.name && rules.htmlClosesParagraph(candidate.name.toLowerCase())
              ) ?? -1
            return boundary < 0
              ? [node]
              : [{ ...node, children: node.children!.slice(0, boundary) }, ...node.children!.slice(boundary)]
          })
        : nodes
    return normalized
      .filter((node) => node.name)
      .flatMap((node, i) => convert(node, depth, parentPath, i + 1, namespace))
  }
  return applyHtmlRecovery({ roots: ast.body.flatMap((node) => convert(node)), issues, index, outOfScope: 0 })
}
