import type { Selector } from 'postcss-selector-parser'

import { buildBlockPattern } from '../utils/naming'
import { collectCompoundNodes, type SelectorParserCache } from '../utils/selector'
import type { Options } from './spiracss-rel-comments.types'

const isExternalClass = (name: string, options: Options): boolean =>
  options.allowExternalClasses.includes(name) ||
  options.allowExternalPrefixes.some((prefix) => name.startsWith(prefix))

export const collectRootBlockNames = (
  selectors: Selector[],
  options: Options
): string[] => {
  const names = new Set<string>()
  const cacheSize = options.cacheSizes.naming
  const blockRe = buildBlockPattern(options.naming, cacheSize)
  const rootPseudos = new Set([':is', ':where'])

  selectors.forEach((sel) => {
    const [head] = collectCompoundNodes(sel, { sameElementPseudos: rootPseudos })
    if (!head) return
    head.classes.forEach((node) => {
      const name = node.value
      if (isExternalClass(name, options)) return
      if (blockRe.test(name)) names.add(name)
    })
  })

  return [...names]
}

const findDirectChildClass = (sel: Selector): string | null => {
  const nodes = sel.nodes || []
  const firstNode = nodes.find((node) => node.type !== 'comment')
  if (!firstNode) return null

  const firstIndex = nodes.indexOf(firstNode)
  const findChildAfter = (startIndex: number): string | null => {
    for (let i = startIndex; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (node.type === 'class') return node.value
      if (node.type === 'combinator') break
    }
    return null
  }

  if (firstNode.type === 'combinator') {
    if (firstNode.value.trim() !== '>') return null
    return findChildAfter(firstIndex + 1)
  }

  if (firstNode.type !== 'nesting') return null

  for (let i = firstIndex + 1; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.type === 'combinator') {
      if (node.value.trim() !== '>') return null
      return findChildAfter(i + 1)
    }
  }

  return null
}

export const collectDirectChildBlocks = (
  selector: string,
  options: Options,
  selectorCache: SelectorParserCache
): string[] => {
  const names = new Set<string>()
  const cacheSize = options.cacheSizes.naming
  const blockRe = buildBlockPattern(options.naming, cacheSize)

  const selectors = selectorCache.parse(selector)
  selectors.forEach((sel) => {
    const name = findDirectChildClass(sel)
    if (!name) return
    if (isExternalClass(name, options)) return
    if (blockRe.test(name)) names.add(name)
  })

  return [...names]
}
