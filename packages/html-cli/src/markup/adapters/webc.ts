import { parseExpression } from '@babel/parser'
import { createMarkupRuleContext } from '../../generator-core'
import {
  combineClasses,
  combineGuards,
  conditionBranches,
  evaluateAttributeExpression,
  evaluateClassExpression,
  type ExpressionNode
} from '../expressions'
import type { Guard, MarkupAttribute, MarkupConfig, MarkupDocument, MarkupElement } from '../types'

export type WebcExpression = { node?: ExpressionNode; reason?: string; syntaxOffset?: number }
export type WebcExpressions = Map<number, WebcExpression>

function relevantAttributes(config: MarkupConfig): (node: MarkupElement, name: string) => boolean {
  const { policy, htmlLint } = createMarkupRuleContext(config)
  const names = new Set(['class', ...policy.variant.dataKeys, policy.state.dataKey, ...policy.state.ariaKeys])
  // Keep this predicate a superset of the validator's needsInputType check.
  return (node, name) =>
    names.has(name) ||
    (name === 'type' &&
      node.tag === 'input' &&
      !node.component &&
      (!node.namespace || node.namespace === 'http://www.w3.org/1999/xhtml') &&
      htmlLint.classlessTagCheck &&
      !htmlLint.classlessTagAllowlist.has('input') &&
      (node.attributes.some((attribute) => attribute.name === '@attributes') ||
        node.classes.every((alternative) => alternative.tokens.length === 0)))
}

/** First parse of WebC expressions: invoked by the CLI parser or host parser wrapper. */
export function parseWebcAttributeExpressions(document: MarkupDocument, config: MarkupConfig): WebcExpressions {
  const relevant = relevantAttributes(config)
  const { index } = document
  const expressions: WebcExpressions = new Map()
  const stack = [...document.roots]
  while (stack.length) {
    const node = stack.pop()!
    stack.push(...node.children)
    for (const attribute of node.attributes) {
      if (
        !(attribute.name.startsWith(':') && relevant(node, attribute.name.slice(1))) &&
        !['@attributes', 'webc:if', 'webc:elseif'].includes(attribute.name)
      )
        continue
      if (!attribute.value && attribute.name === '@attributes') continue
      const raw = index.source.slice(...attribute.valueRange)
      if (raw !== attribute.value) {
        expressions.set(attribute.range[0], {
          reason: 'Entity-encoded WebC expression needs an exact decoded-to-source expression map.'
        })
        continue
      }
      index.metrics.expressionParses += 1
      try {
        expressions.set(attribute.range[0], {
          node: parseExpression(attribute.value, { allowAwaitOutsideFunction: true }) as unknown as ExpressionNode
        })
      } catch (error) {
        expressions.set(attribute.range[0], {
          reason: error instanceof Error ? error.message : String(error),
          syntaxOffset:
            error && typeof error === 'object' && 'pos' in error && typeof error.pos === 'number' ? error.pos : 0
        })
      }
    }
  }
  return expressions
}

/** WebC merges class/style in source order and deduplicates class values.
 * Other normalized attributes are last-write-wins. No component/prop expansion.
 */
export function applyWebcBindings(
  document: MarkupDocument,
  config: MarkupConfig,
  expressions: WebcExpressions
): MarkupDocument {
  const relevant = relevantAttributes(config)
  const contextFor = (attribute: MarkupAttribute) => ({
    index: document.index,
    offset: attribute.valueRange[0],
    scope: 'webc',
    helpers: new Set<string>(),
    members: config.jsxClassBindings?.memberAccessAllowlist
  })
  const entryFor = (attribute: MarkupAttribute) => {
    const entry = expressions.get(attribute.range[0])
    // Keep malformed :type unresolved so irrelevant type expressions do not block the whole document.
    if (attribute.name !== ':type' && entry?.syntaxOffset !== undefined)
      throw Object.assign(new SyntaxError(entry.reason), { pos: attribute.valueRange[0] + entry.syntaxOffset })
    return entry
  }
  const branches = (nodes: MarkupElement[]): MarkupElement[] => {
    const result: MarkupElement[] = []
    let remaining: Guard[] | undefined
    let previousEnd = 0
    for (const node of nodes) {
      const directive = node.attributes.find((attribute) =>
        ['webc:if', 'webc:elseif', 'webc:else'].includes(attribute.name)
      )
      if (
        document.index.source
          .slice(previousEnd, node.openRange[0])
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim()
      )
        remaining = undefined
      previousEnd = node.range[1]
      if (!directive) {
        remaining = undefined
        result.push(node)
        continue
      }
      if (directive.name === 'webc:if') remaining = [{}]
      if (!remaining) {
        document.issues.push({
          code: 'SOURCE_RELATION_UNRESOLVED',
          kind: 'unresolved',
          message: 'WebC conditional branch has no matching adjacent webc:if.',
          baseClass: '',
          path: [],
          range: directive.range
        })
        result.push(node)
        continue
      }
      if (directive.name === 'webc:else') {
        result.push(...remaining.map((guard) => ({ ...node, guard })))
        remaining = undefined
        continue
      }
      const entry = entryFor(directive)
      if (!entry?.node) {
        document.issues.push({
          code: 'SOURCE_RELATION_UNRESOLVED',
          kind: 'unresolved',
          message: 'The WebC source condition cannot be established statically.',
          baseClass: '',
          path: [],
          range: directive.valueRange
        })
        result.push(node)
        remaining = undefined
        continue
      }
      const next: Guard[] = []
      for (const previous of remaining)
        for (const branch of conditionBranches(entry.node, contextFor(directive))) {
          const guard = combineGuards(previous, branch.guard)
          if (!guard) continue
          if (branch.when) result.push({ ...node, guard })
          else next.push(guard)
        }
      remaining = next
    }
    return result
  }
  document.roots = branches(document.roots)
  const stack = [...document.roots]
  while (stack.length) {
    const node = stack.pop()!
    let classes = [{ tokens: [], guard: {} }] as typeof node.classes
    for (const attribute of node.attributes) {
      if (attribute.name === 'class') {
        // The HTML adapter owns static class tokens, including values without a mapped source span.
        classes = combineClasses(classes, node.classes)
        continue
      }
      if (!attribute.name.startsWith(':') || !relevant(node, attribute.name.slice(1))) continue
      const name = attribute.name.slice(1)
      const entry = entryFor(attribute)
      const context = contextFor(attribute)
      if (name === 'class') {
        const values = entry?.node
          ? evaluateClassExpression(entry.node, context, 'scalar')
          : [{ tokens: [], guard: {}, unresolved: attribute.valueRange }]
        classes = combineClasses(classes, values)
      } else {
        attribute.name = name
        attribute.alternatives = entry?.node
          ? evaluateAttributeExpression(entry.node, context)
          : [{ range: attribute.valueRange, guard: {}, unresolved: true }]
      }
    }
    // WebC 0.11.4 applies @attributes after all ordinary attributes,
    // regardless of where the directive is written in the start tag.
    for (const attribute of node.attributes.filter((value) => value.name === '@attributes')) {
      const entry = entryFor(attribute)
      const properties = entry?.node?.type === 'ObjectExpression' ? entry.node.properties : undefined
      if (
        properties &&
        properties.every(
          (property) =>
            ['ObjectProperty', 'Property'].includes(property.type) &&
            !property.computed &&
            !property.method &&
            (!property.kind || property.kind === 'init')
        )
      ) {
        for (const property of properties) {
          const name = property.key?.name ?? property.key?.value
          if (name === 'class')
            classes = evaluateClassExpression(property.value as ExpressionNode, contextFor(attribute), 'scalar')
          else if (typeof name === 'string' && relevant(node, name))
            node.attributes.push({
              name,
              value: '',
              range: [attribute.valueRange[0] + (property.start ?? 0), attribute.valueRange[0] + (property.end ?? 0)],
              valueRange: attribute.valueRange,
              alternatives: evaluateAttributeExpression(property.value as ExpressionNode, contextFor(attribute))
            })
        }
      } else {
        document.outOfScope += 1
        classes = classes.map((alternative) => ({ ...alternative, ownerUnknown: true }))
        for (const value of node.attributes) if (relevant(node, value.name)) value.overwrittenBy = attribute.range
      }
    }
    node.classes = classes.map((alternative) => {
      const seen = new Set<string>()
      return {
        ...alternative,
        tokens: alternative.tokens.filter((token) => {
          if (seen.has(token.value)) return false
          seen.add(token.value)
          return true
        })
      }
    })
    node.children = branches(node.children)
    stack.push(...node.children)
  }
  return document
}
