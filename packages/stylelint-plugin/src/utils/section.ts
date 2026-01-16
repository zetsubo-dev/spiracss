import type { AtRule, Comment, Container, Node, Root, Rule } from 'postcss'

import { isAtRule, isContainer, isRule } from './postcss-helpers'

export type CommentPatterns = {
  sharedCommentPattern: RegExp
  interactionCommentPattern: RegExp
}

type SectionAnchorPredicate = (comment: Comment, parent: Container) => boolean
type SectionNode = Rule | AtRule
type SectionNodeVisitor = (node: SectionNode) => void
type NodeIndexMap = Map<Node, number>

export const getCommentText = (comment: Comment): string => {
  const rawText = (comment.raws as { text?: unknown } | undefined)?.text
  return typeof rawText === 'string' && rawText.trim() ? rawText : comment.text || ''
}

export const safeTestPattern = (pattern: RegExp, text: string): boolean => {
  if (pattern.global || pattern.sticky) {
    pattern.lastIndex = 0
  }
  return pattern.test(text)
}

export const markSectionRules = (
  root: Root,
  targetPattern: RegExp,
  stopPatterns: RegExp[],
  isValidAnchor?: SectionAnchorPredicate
): WeakSet<Rule> => {
  const sectionRules = new WeakSet<Rule>()

  walkSectionNodes(
    root,
    targetPattern,
    stopPatterns,
    isValidAnchor,
    (node) => {
      if (isRule(node)) {
        sectionRules.add(node)
        node.walkRules((child: Rule) => {
          if (child !== node) sectionRules.add(child)
        })
        return
      }
      node.walkRules((child: Rule) => {
        sectionRules.add(child)
      })
    }
  )

  return sectionRules
}

export const markSectionContainers = (
  root: Root,
  targetPattern: RegExp,
  stopPatterns: RegExp[],
  isValidAnchor?: SectionAnchorPredicate
): WeakSet<Container> => {
  const sectionContainers = new WeakSet<Container>()

  const addContainer = (container: Container): void => {
    sectionContainers.add(container)
    container.walk((node) => {
      if (isRule(node) || isAtRule(node)) {
        sectionContainers.add(node as Container)
      }
    })
  }

  walkSectionNodes(
    root,
    targetPattern,
    stopPatterns,
    isValidAnchor,
    (node) => {
      addContainer(node as Container)
    }
  )

  return sectionContainers
}

const walkSectionNodes = (
  root: Root,
  targetPattern: RegExp,
  stopPatterns: RegExp[],
  isValidAnchor: SectionAnchorPredicate | undefined,
  visit: SectionNodeVisitor
): void => {
  const indexCache = new WeakMap<Container, NodeIndexMap>()

  const getNodeIndex = (container: Container, node: Node): number => {
    let indexMap = indexCache.get(container)
    if (!indexMap) {
      indexMap = new Map<Node, number>()
      const nodes = container.nodes ?? []
      nodes.forEach((item, index) => {
        indexMap?.set(item, index)
      })
      indexCache.set(container, indexMap)
    }
    return indexMap.get(node) ?? -1
  }

  root.walkComments((comment: Comment) => {
    const text = getCommentText(comment)
    if (!safeTestPattern(targetPattern, text)) return

    const parent = comment.parent
    if (!isContainer(parent)) return
    if (isValidAnchor && !isValidAnchor(comment, parent)) return

    const nodes = parent.nodes ?? []
    if (nodes.length === 0) return
    const idx = getNodeIndex(parent, comment)
    if (idx === -1) return

    for (let i = idx + 1; i < nodes.length; i += 1) {
      const node = nodes[i]

      if (node.type === 'comment') {
        const t = getCommentText(node)
        if (stopPatterns.some((pattern) => safeTestPattern(pattern, t))) break
        continue
      }

      if (isRule(node) || isAtRule(node)) {
        visit(node as SectionNode)
      }
    }
  })
}

export const markSharedRules = (
  root: Root,
  patterns: CommentPatterns,
  isValidAnchor?: SectionAnchorPredicate
): WeakSet<Rule> =>
  markSectionRules(
    root,
    patterns.sharedCommentPattern,
    [patterns.sharedCommentPattern, patterns.interactionCommentPattern],
    isValidAnchor
  )

export const markInteractionRules = (
  root: Root,
  patterns: CommentPatterns,
  isValidAnchor?: SectionAnchorPredicate
): WeakSet<Rule> =>
  markSectionRules(
    root,
    patterns.interactionCommentPattern,
    [patterns.sharedCommentPattern, patterns.interactionCommentPattern],
    isValidAnchor
  )

export const markInteractionContainers = (
  root: Root,
  patterns: CommentPatterns,
  isValidAnchor?: SectionAnchorPredicate
): WeakSet<Container> =>
  markSectionContainers(
    root,
    patterns.interactionCommentPattern,
    [patterns.sharedCommentPattern, patterns.interactionCommentPattern],
    isValidAnchor
  )

export const isRuleInRootScope = (
  rule: Rule,
  allowedAtRules: Set<string>
): boolean => {
  let current: Node | undefined = rule.parent
  while (current) {
    if (current.type === 'root') return true
    if (isAtRule(current)) {
      const name = current.name ? current.name.toLowerCase() : ''
      if (!allowedAtRules.has(name)) return false
      current = current.parent
      continue
    }
    return false
  }
  return false
}

export const isRuleInsideAtRule = (rule: Rule, names: Set<string>): boolean => {
  let current: Node | undefined = rule.parent
  while (current) {
    if (isAtRule(current)) {
      const name = current.name ? current.name.toLowerCase() : ''
      if (names.has(name)) return true
    }
    current = current.parent
  }
  return false
}
