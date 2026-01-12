import type { AtRule, Comment, Container, Node, Rule } from 'postcss'

export const isContainer = (node: Node | null | undefined): node is Container =>
  Boolean(node && 'nodes' in node && Array.isArray((node as Container).nodes))

export const isRule = (node: Node | null | undefined): node is Rule =>
  Boolean(node && node.type === 'rule')
export const isAtRule = (node: Node | null | undefined): node is AtRule =>
  Boolean(node && node.type === 'atrule')
export const isComment = (node: Node | null | undefined): node is Comment =>
  Boolean(node && node.type === 'comment')

export const findParentRule = (node: Node): Rule | null => {
  let current: Node | undefined = node.parent
  while (current) {
    if (isRule(current)) return current
    current = current.parent ?? undefined
  }
  return null
}

export const isKeyframesAtRule = (node: AtRule): boolean => {
  const name = node.name ? node.name.toLowerCase() : ''
  return name.endsWith('keyframes')
}

export const isInsideKeyframes = (node: Node): boolean => {
  let current: Node | undefined = node.parent ?? undefined
  while (current) {
    if (isAtRule(current) && isKeyframesAtRule(current)) return true
    current = current.parent ?? undefined
  }
  return false
}
