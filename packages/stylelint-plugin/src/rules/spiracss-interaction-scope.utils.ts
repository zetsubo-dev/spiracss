import type { AtRule, Node, Rule } from 'postcss'

import { ROOT_WRAPPER_NAMES } from '../utils/constants'
import { isAtRule, isComment, isContainer } from '../utils/postcss-helpers'
import { getCommentText, isRuleInRootScope } from '../utils/section'
import type { SelectorParserCache } from '../utils/selector'
import { buildSelectorPolicySetsBase } from '../utils/selector-policy'
import type {
  NormalizedSelectorPolicy,
  SelectorAnalysis,
  SelectorPolicySets
} from './spiracss-interaction-scope.types'

export const normalizePseudo = (value: string): string => `:${value.replace(/^:+/, '')}`

type NodeContainer = Node & { nodes?: Node[] }
const nodeIndexCache = new WeakMap<NodeContainer, Map<Node, number>>()

const getNodeIndex = (container: NodeContainer, node: Node): number => {
  let indexMap = nodeIndexCache.get(container)
  if (!indexMap) {
    indexMap = new Map<Node, number>()
    const nodes = container.nodes ?? []
    nodes.forEach((item, index) => {
      indexMap?.set(item, index)
    })
    nodeIndexCache.set(container, indexMap)
  }
  return indexMap.get(node) ?? -1
}

export const buildSelectorPolicySets = (
  policy: NormalizedSelectorPolicy
): SelectorPolicySets => buildSelectorPolicySetsBase(policy)

export const analyzeSelector = (
  selector: string,
  selectorCache: SelectorParserCache,
  allowedPseudoSet: Set<string>,
  policySets: SelectorPolicySets
): SelectorAnalysis => {
  const hasColon = selector.includes(':')
  const hasBracket = selector.includes('[')

  if (!hasColon && !hasBracket) {
    return { hasAllowedPseudo: false, hasVariant: false, hasState: false, hasMixed: false }
  }

  let hasAllowedPseudo = false
  let hasVariant = false
  let hasState = false
  let hasMixed = false

  const selectors = selectorCache.parse(selector)
  selectors.forEach((sel) => {
    let selectorHasVariant = false
    let selectorHasState = false

    if (hasColon) {
      sel.walkPseudos((p) => {
        if (hasAllowedPseudo) return
        if (allowedPseudoSet.has(normalizePseudo(p.value))) hasAllowedPseudo = true
      })
    }

    if (hasBracket && (policySets.dataVariantEnabled || policySets.dataStateEnabled)) {
      sel.walkAttributes((attr) => {
        const name = attr.attribute || ''
        if (!name) return
        const normalizedName = name.toLowerCase()
        if (
          policySets.dataVariantEnabled &&
          policySets.variantKeys.has(normalizedName)
        ) {
          selectorHasVariant = true
        }
        if (policySets.dataStateEnabled && normalizedName === policySets.stateKey) {
          selectorHasState = true
        }
        if (policySets.dataStateEnabled && policySets.ariaKeys.has(normalizedName)) {
          selectorHasState = true
        }
      })
    }

    if (selectorHasVariant) hasVariant = true
    if (selectorHasState) hasState = true
    if (selectorHasVariant && selectorHasState) hasMixed = true
  })

  return { hasAllowedPseudo, hasVariant, hasState, hasMixed }
}

export const findAtRootAncestor = (rule: Rule): AtRule | null => {
  let current: Node | undefined = rule.parent
  while (current) {
    if (isAtRule(current) && current.name === 'at-root') return current
    current = current.parent
  }
  return null
}

export const hasAtRootNestingParam = (atRoot: AtRule | null): boolean => {
  if (!atRoot) return false
  const params = typeof atRoot.params === 'string' ? atRoot.params : ''
  return params.includes('&')
}

export const startsWithNestingToken = (
  selector: string,
  selectorCache: SelectorParserCache
): boolean => {
  if (!selector) return false
  const selectors = selectorCache.parse(selector)
  if (selectors.length === 0) return false
  return selectors.every((sel) => {
    const nodes = sel.nodes ?? []
    for (const node of nodes) {
      if (node.type === 'comment') continue
      if (node.type === 'combinator') return false
      return node.type === 'nesting'
    }
    return false
  })
}

export const isRootLevelRule = (rule: Rule): boolean =>
  isRuleInRootScope(rule, ROOT_WRAPPER_NAMES)

export const findCommentBefore = (node: Node): string | null => {
  let current: Node | undefined = node
  while (current) {
    const parent: Node | undefined = current.parent
    if (!isContainer(parent) || !parent.nodes) return null

    const idx = getNodeIndex(parent, current)
    if (idx === -1) {
      // Node not found in the cached index; walk up to keep the search resilient.
      current = parent
      continue
    }
    if (idx === 0) {
      // No preceding siblings in this container; keep walking up.
      current = parent
      continue
    }
    for (let i = idx - 1; i >= 0; i -= 1) {
      const sibling = parent.nodes[i]
      if (isComment(sibling)) {
        return getCommentText(sibling)
      }
      break
    }

    current = parent
  }

  return null
}

export const isLastNonCommentNode = (node: Node): boolean => {
  const pickContainer = (currentNode: Node): NodeContainer => {
    let current: Node | undefined = currentNode.parent
    while (current && current.type !== 'rule' && current.type !== 'root') {
      current = current.parent
    }
    return (current as NodeContainer) || currentNode.root()
  }

  const container = pickContainer(node)
  const nodes = (container.nodes ?? []).filter((n) => !isComment(n))
  if (nodes.length === 0) return true

  const target: Node = node.parent && isAtRule(node.parent) ? node.parent : node
  const last = nodes[nodes.length - 1]
  return last === target
}
