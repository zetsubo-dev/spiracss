import selectorParser, {
  type Attribute,
  type ClassName,
  type Node,
  type Pseudo,
  type Selector
} from 'postcss-selector-parser'

import { createSharedCacheAccessor,DEFAULT_CACHE_SIZE } from './cache'

export type SelectorSummary = {
  classes: ClassName[]
  hasNesting: boolean
  firstCombinator: string | null
  combinatorCount: number
}

export type CompoundNodes = {
  classes: ClassName[]
  attributes: Attribute[]
  hasNesting: boolean
}

export type CompoundNodesOptions = {
  sameElementPseudos?: Set<string>
}

export type CompoundSegment = {
  pseudos: Pseudo[]
  hasNesting: boolean
}

export type SelectorParserCache = {
  parse: (selector: string) => Selector[]
}

export type SelectorParseTracker = {
  cache: SelectorParserCache
  hasError: () => boolean
  getErrorSelector: () => string | null
}

const DEFAULT_SAME_ELEMENT_PSEUDOS = new Set([':not', ':is', ':where'])

type SelectorContainer = Node & { nodes?: Node[] }

const isContainer = (node: Node | undefined): node is SelectorContainer =>
  Boolean(node && 'nodes' in node && Array.isArray((node as SelectorContainer).nodes))

const combinatorCache = new WeakMap<SelectorContainer, boolean>()

const hasCombinator = (container: SelectorContainer | undefined): boolean => {
  if (!container) return false
  const cached = combinatorCache.get(container)
  if (cached !== undefined) return cached
  const nodes = container.nodes
  if (!nodes || nodes.length === 0) {
    combinatorCache.set(container, false)
    return false
  }
  const result = nodes.some((node) => {
    if (node.type === 'combinator') return true
    if (isContainer(node)) return hasCombinator(node)
    return false
  })
  combinatorCache.set(container, result)
  return result
}

export const isInsideSameElementPseudo = (
  node: Node,
  sameElementPseudos: Set<string> = DEFAULT_SAME_ELEMENT_PSEUDOS
): boolean => {
  let current = node.parent as Node | undefined
  while (current) {
    if (current.type === 'pseudo') {
      const pseudo = typeof current.value === 'string' ? current.value.toLowerCase() : ''
      if (sameElementPseudos.has(pseudo)) return true
    }
    current = current.parent as Node | undefined
  }
  return false
}

export const isInsideNonSameElementPseudo = (
  node: Node,
  sameElementPseudos: Set<string> = DEFAULT_SAME_ELEMENT_PSEUDOS
): boolean => {
  let current = node.parent as Node | undefined
  let selectorInPseudo: Selector | null = null
  while (current) {
    if (current.type === 'selector') selectorInPseudo = current as Selector
    if (current.type === 'pseudo') {
      const pseudo = typeof current.value === 'string' ? current.value.toLowerCase() : ''
      if (!sameElementPseudos.has(pseudo)) return true
      if (selectorInPseudo && hasCombinator(selectorInPseudo)) return true
      selectorInPseudo = null
    }
    current = current.parent as Node | undefined
  }
  return false
}
type SelectorCacheEntry = { selectors: Selector[]; hasError: boolean }
const getSelectorCache = createSharedCacheAccessor<string, SelectorCacheEntry>()

export const createSelectorParserCache = (
  onError?: (selector: string, error: unknown) => void,
  maxSize = DEFAULT_CACHE_SIZE
): SelectorParserCache => {
  const sharedSelectorCache = getSelectorCache(maxSize)
  const parse = (selector: string): Selector[] => {
    const cached = sharedSelectorCache.get(selector)
    if (cached) {
      if (cached.hasError) onError?.(selector, undefined)
      return cached.selectors
    }

    const selectors: Selector[] = []
    try {
      selectorParser((root) => {
        root.each((sel) => {
          selectors.push(sel)
        })
      }).processSync(selector)
    } catch (error) {
      onError?.(selector, error)
      sharedSelectorCache.set(selector, { selectors: [], hasError: true })
      return []
    }

    sharedSelectorCache.set(selector, { selectors, hasError: false })
    return selectors
  }

  return { parse }
}

export const createSelectorCacheWithErrorFlag = (
  maxSize = DEFAULT_CACHE_SIZE
): SelectorParseTracker => {
  let hasError = false
  let errorSelector: string | null = null
  const cache = createSelectorParserCache((selector) => {
    hasError = true
    if (!errorSelector) errorSelector = selector
  }, maxSize)
  return {
    cache,
    hasError: () => hasError,
    getErrorSelector: () => errorSelector
  }
}

/**
 * Collects basic selector stats while ignoring combinators inside same-element pseudos
 * (e.g. :not/:is/:where), so root-level combinator checks stay accurate.
 * @param sel - Selector node to analyze.
 * @returns Summary with classes, nesting flag, and combinator stats.
 */
export const collectSelectorSummary = (sel: Selector): SelectorSummary => {
  const classes: ClassName[] = []
  let hasNesting = false
  let firstCombinator: string | null = null
  let combinatorCount = 0

  sel.walk((node) => {
    if (node.type === 'nesting') hasNesting = true
    if (node.type === 'class') classes.push(node as ClassName)
    if (node.type === 'combinator') {
      if (isInsideSameElementPseudo(node)) return
      const raw = node.value
      const normalized = raw.trim() || ' '
      if (!firstCombinator) firstCombinator = normalized
      combinatorCount += 1
    }
  })

  return { classes, hasNesting, firstCombinator, combinatorCount }
}

export const collectNestingSiblingClasses = (sel: Selector): Set<string> => {
  const names = new Set<string>()

  sel.walk((node) => {
    if (node.type !== 'nesting') return
    let current = node.next()
    while (current && current.type !== 'combinator') {
      if (current.type === 'class') {
        names.add((current as ClassName).value)
      }
      current = current.next()
    }
  })

  return names
}

export const collectCompoundSegments = (sel: Selector): CompoundSegment[] => {
  const compounds: CompoundSegment[] = []
  let current: CompoundSegment = { pseudos: [], hasNesting: false }

  sel.nodes.forEach((node) => {
    if (node.type === 'combinator') {
      compounds.push(current)
      current = { pseudos: [], hasNesting: false }
      return
    }
    if (node.type === 'nesting') current.hasNesting = true
    if (node.type === 'pseudo') current.pseudos.push(node as Pseudo)
  })

  compounds.push(current)
  return compounds
}

export const collectCompoundNodes = (
  sel: Selector,
  options?: CompoundNodesOptions
): CompoundNodes[] => {
  const sameElementPseudos = options?.sameElementPseudos ?? DEFAULT_SAME_ELEMENT_PSEUDOS
  const compounds: CompoundNodes[] = []
  let current: CompoundNodes = { classes: [], attributes: [], hasNesting: false }

  const collectFromSameElementPseudo = (pseudo: Pseudo | undefined): void => {
    if (!pseudo || !Array.isArray(pseudo.nodes)) return
    const selectorNodes = pseudo.nodes.filter((node): node is Selector => node.type === 'selector')
    if (selectorNodes.length > 0) {
      selectorNodes.forEach((node) => {
        if (hasCombinator(node)) return
        collectSameElementNodes(node)
      })
      return
    }
    if (hasCombinator(pseudo)) return
    collectSameElementNodes(pseudo)
  }

  function collectSameElementNodes(container: SelectorContainer | undefined): void {
    if (!container || !Array.isArray(container.nodes)) return

    container.nodes.forEach((node) => {
      if (node.type === 'combinator') return
      if (node.type === 'class') current.classes.push(node as ClassName)
      if (node.type === 'attribute') current.attributes.push(node as Attribute)
      if (node.type === 'nesting') current.hasNesting = true
      if (node.type === 'pseudo') {
        const pseudo = typeof node.value === 'string' ? node.value.toLowerCase() : ''
        if (!sameElementPseudos.has(pseudo)) return
        collectFromSameElementPseudo(node)
        return
      }
      if (isContainer(node)) collectSameElementNodes(node)
    })
  }

  sel.nodes.forEach((node) => {
    if (node.type === 'combinator') {
      compounds.push(current)
      current = { classes: [], attributes: [], hasNesting: false }
      return
    }
    if (node.type === 'class') current.classes.push(node as ClassName)
    if (node.type === 'attribute') current.attributes.push(node as Attribute)
    if (node.type === 'nesting') current.hasNesting = true
    if (node.type === 'pseudo') {
      const pseudo = typeof node.value === 'string' ? node.value.toLowerCase() : ''
      if (sameElementPseudos.has(pseudo)) {
        collectFromSameElementPseudo(node)
      }
    }
  })

  compounds.push(current)
  return compounds
}
