import type { AtRule, Comment, Node, Root, Rule } from 'postcss'

import { NON_SELECTOR_AT_RULE_NAMES, ROOT_WRAPPER_NAMES } from '../utils/constants'
import { isRuleInsideAtRule } from '../utils/section'
import { extractLinkTargets } from './spiracss-rel-comments.alias'

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const hasMetaLoadCss = (root: Root, childScssDir: string): boolean => {
  let hit = false
  const escapedDir = escapeRegExp(childScssDir)
  const loadCssRe = new RegExp(`meta\\.load-css\\(\\s*['"]${escapedDir}(?:\\/[^'"]+)?['"]`)
  root.walkAtRules((atrule: AtRule) => {
    if (atrule.name !== 'include') return
    if (typeof atrule.params !== 'string') return
    const params: string = atrule.params
    if (loadCssRe.test(params)) {
      hit = true
      return false
    }
  })
  return hit
}

export const findFirstBodyNode = (rule: Rule): Node | null => {
  if (!rule.nodes) return null
  return rule.nodes.find((n) => n) ?? null
}

export const hasRuleNodes = (root: Root): boolean => {
  let found = false
  root.walkRules((rule: Rule) => {
    if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
    found = true
    return false
  })
  return found
}

export const findTopRelComment = (root: Root): Comment | null => {
  const findInNodes = (nodes: Node[]): Comment | null => {
    for (const node of nodes) {
      if (node.type === 'comment') {
        const comment = node as Comment
        const text: string = comment.text || ''
        if (extractLinkTargets(text).length > 0) return comment
        continue
      }
      if (node.type === 'atrule') {
        const atrule = node as AtRule
        const name = atrule.name ? atrule.name.toLowerCase() : ''
        // Allow leading @use/@forward/@import directives.
        if (name === 'use' || name === 'forward' || name === 'import') {
          continue
        }
        if (ROOT_WRAPPER_NAMES.has(name)) {
          const nested = atrule.nodes ? findInNodes(atrule.nodes) : null
          return nested
        }
      }
      break
    }
    return null
  }

  if (!root.nodes) return null
  return findInNodes(root.nodes)
}

const findFirstRuleNode = (nodes: Node[]): Rule | null => {
  for (const node of nodes) {
    if (node.type === 'rule') return node as Rule
    if (node.type !== 'atrule') continue
    const atrule = node as AtRule
    const name = atrule.name ? atrule.name.toLowerCase() : ''
    if (!ROOT_WRAPPER_NAMES.has(name)) continue
    const children = atrule.nodes ?? []
    const nested = findFirstRuleNode(children)
    if (nested) return nested
  }
  return null
}

export const getFirstRuleNode = (root: Root): Rule | null => {
  if (!root.nodes) return null
  return findFirstRuleNode(root.nodes)
}

export const getRootScopeContainer = (rule: Rule): Root | AtRule => {
  let scope: AtRule | null = null
  let current: Node | undefined = rule.parent
  while (current) {
    if (current.type === 'root') return scope ?? (current as Root)
    if (current.type === 'atrule') {
      const atrule = current as AtRule
      const name = atrule.name ? atrule.name.toLowerCase() : ''
      if (ROOT_WRAPPER_NAMES.has(name)) scope = atrule
    }
    current = current.parent
  }
  return scope ?? rule.root()
}

export const getFirstRuleNodeInScope = (scope: Root | AtRule): Rule | null => {
  const nodes = scope.nodes ?? []
  if (nodes.length === 0) return null
  return findFirstRuleNode(nodes)
}
