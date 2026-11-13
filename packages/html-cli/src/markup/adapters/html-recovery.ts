import type { MarkupDocument, MarkupElement } from '../types'
import type { SourceRange } from '../source'

export type HtmlStartTag = { tag: string; range: SourceRange }
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])
const SELECT = new Set(['select', 'option', 'optgroup', 'hr', 'script', 'template'])
const TABLE = new Set([
  'table',
  'caption',
  'colgroup',
  'col',
  'tbody',
  'thead',
  'tfoot',
  'tr',
  'td',
  'th',
  'style',
  'script',
  'template'
])

/** Three bounded source/DOM recovery cases, shared by both existing HTML ASTs.
 * The native entry observes tokens during its one parse; the supplied entry
 * observes its existing source elements. Neither entry reparses supplied HTML.
 */
export function applyHtmlRecovery(document: MarkupDocument, observed?: HtmlStartTag[]): MarkupDocument {
  const elements: MarkupElement[] = []
  const parents = new Map<MarkupElement, MarkupElement>()
  const pending = document.roots.map((element) => ({ element, parent: undefined as MarkupElement | undefined }))
  while (pending.length) {
    const { element, parent } = pending.pop()!
    if (!element.implicit) elements.push(element)
    if (parent) parents.set(element, parent)
    pending.push(...element.children.map((child) => ({ element: child, parent: element })))
  }
  const nodes = new Map(elements.map((element) => [element.openRange[0], element]))
  const tags = (observed ?? elements.map((element) => ({ tag: element.tag, range: element.openRange }))).sort(
    (a, b) => a.range[0] - b.range[0]
  )
  const active: MarkupElement[] = []
  const affected: SourceRange[] = []
  const dropped = new Set<number>()
  const add = (tag: HtmlStartTag, kind: string, region: SourceRange) => {
    document.issues.push({
      code: 'SOURCE_RELATION_UNRESOLVED',
      kind: 'unresolved',
      message: `HTML source relation is unresolved: ${kind}.`,
      reason: `HTML source relation is unresolved: ${kind}.`,
      baseClass: '',
      path: [],
      range: tag.range
    })
    affected.push(region)
  }
  for (const tag of tags) {
    while (active.length && active[active.length - 1].range[1] <= tag.range[0]) active.pop()
    const node = nodes.get(tag.range[0])
    const select = [...active].reverse().find((element) => element.tag === 'select')
    let tableIndex = active.length - 1
    while (tableIndex >= 0 && active[tableIndex].tag !== 'table') tableIndex--
    const table = active[tableIndex]
    const cell = active
      .slice(tableIndex + 1)
      .some((element) => ['td', 'th', 'caption', 'template'].includes(element.tag))
    const hiddenInput =
      tag.tag === 'input' &&
      node?.attributes.find((attribute) => attribute.name === 'type')?.value.toLowerCase() === 'hidden'
    if (select && !SELECT.has(tag.tag)) {
      dropped.add(tag.range[0])
      add(tag, 'select-dropped-start-tag', [select.openRange[1], select.range[1]])
    } else if (table && !cell && !hiddenInput && !TABLE.has(tag.tag)) {
      add(tag, 'table-foster-parenting', node?.range ?? tag.range)
    }
    if (
      node &&
      (!node.namespace || node.namespace === 'http://www.w3.org/1999/xhtml') &&
      !VOID.has(tag.tag) &&
      /\/\s*>$/.test(document.index.source.slice(...tag.range))
    ) {
      add(tag, 'non-void-self-closing', [tag.range[0], parents.get(node)?.range[1] ?? document.index.source.length])
    }
    if (node && ['select', 'table', 'td', 'th', 'caption', 'template'].includes(node.tag)) active.push(node)
  }
  const regions: SourceRange[] = []
  for (const region of affected.sort((a, b) => a[0] - b[0])) {
    const previous = regions[regions.length - 1]
    if (previous && region[0] <= previous[1]) previous[1] = Math.max(previous[1], region[1])
    else regions.push([...region])
  }
  const filter = (input: MarkupElement[]): MarkupElement[] =>
    input.flatMap((element) => {
      element.children = filter(element.children)
      if (dropped.has(element.openRange[0])) return element.children
      let low = 0,
        high = regions.length
      while (low < high) {
        const middle = (low + high) >>> 1
        if (regions[middle][0] <= element.openRange[0]) low = middle + 1
        else high = middle
      }
      const region = regions[low - 1]
      if (region && element.openRange[0] < region[1]) {
        element.htmlRecovery = true
        element.rootRule = false
      }
      return [element]
    })
  document.roots = filter(document.roots)
  const roots = [...document.roots]
  while (roots.length) {
    const node = roots.pop()!
    if (node.implicit || ['html', 'head', 'body'].includes(node.tag)) roots.push(...node.children)
    else if (node.htmlRecovery) document.checkRootCount = false
  }
  return document
}
