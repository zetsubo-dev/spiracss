import type { ComponentStructure } from '../generator-core'

/** Generation-only aggregation; source lint never calls this function. */
export function aggregateComponents(input: ComponentStructure[]): ComponentStructure[] {
  const groups = new Map<string, { node: ComponentStructure; ordered: Set<string>; merged: boolean }>()
  for (const item of input) {
    const existing = groups.get(item.baseClass)
    if (!existing) {
      groups.set(item.baseClass, {
        node: {
          ...item,
          modifiers: [...item.modifiers],
          variantAttributes: [...item.variantAttributes],
          stateAttributes: [...item.stateAttributes],
          nestedChildren: [...item.nestedChildren],
          independentChildren: [...item.independentChildren],
          orderedChildren: [...item.orderedChildren]
        },
        ordered: new Set(item.orderedChildren.map((child) => child.baseClass)),
        merged: false
      })
      continue
    }
    const { node, ordered } = existing
    existing.merged = true
    node.modifiers.push(...item.modifiers)
    node.variantAttributes.push(...item.variantAttributes)
    node.stateAttributes.push(...item.stateAttributes)
    node.nestedChildren.push(...item.nestedChildren)
    node.independentChildren.push(...item.independentChildren)
    node.viaDeep = node.viaDeep && item.viaDeep
    for (const child of item.orderedChildren)
      if (!ordered.has(child.baseClass)) {
        ordered.add(child.baseClass)
        node.orderedChildren.push(child)
      }
  }
  const selectors = (values: ComponentStructure['variantAttributes']) => [
    ...new Map(values.map((value) => [`${value.key}=${value.value}`, value])).values()
  ]
  return [...groups.values()].map(({ node, merged }) => {
    const nestedChildren = aggregateComponents(node.nestedChildren)
    const independentChildren = aggregateComponents(node.independentChildren)
    const children = new Map(independentChildren.map((child) => [child.baseClass, child]))
    for (const child of nestedChildren) children.set(child.baseClass, child)
    return {
      ...node,
      modifiers: merged ? [...new Set(node.modifiers)] : node.modifiers,
      variantAttributes: selectors(node.variantAttributes),
      stateAttributes: selectors(node.stateAttributes),
      nestedChildren,
      independentChildren,
      orderedChildren: node.orderedChildren.map((child) => children.get(child.baseClass) ?? child)
    }
  })
}
