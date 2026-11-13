import type { SourceRange } from '../source'
import type { Ast } from './jsx'
import {
  combineGuards,
  conditionBranches,
  evaluateAttributeExpression,
  effectiveListProperties,
  expressionRange,
  type ExpressionContext,
  type ExpressionNode
} from '../expressions'
import type { AttributeAlternative } from '../types'

const child = (node: Ast, key: string): Ast | undefined =>
  node[key] && typeof node[key] === 'object' ? (node[key] as Ast) : undefined
const range = (node: Ast): SourceRange => [node.start ?? node.range?.[0] ?? 0, node.end ?? node.range?.[1] ?? 0]
export function astroAttributeName(node?: Ast): string {
  if (!node) return ''
  if (node.type === 'JSXNamespacedName')
    return `${astroAttributeName(child(node, 'namespace'))}:${astroAttributeName(child(node, 'name'))}`
  return typeof node.name === 'string' ? node.name : typeof node.value === 'string' ? node.value : ''
}

/** Native Astro emits an HTML attribute stream (first occurrence wins).
 * Component props use object assignment instead. The compiler combines an
 * ordinary class with class:list at the latter's position, ordinary class first.
 * Keep the supplied AST untouched; only the small attribute list is normalized.
 */
export function astroAttributes(input: Ast[], component: boolean, nativeHtml = true) {
  const expanded: Ast[] = []
  const transfers: SourceRange[] = []
  const directClass = input.filter(
    (attribute) => attribute.type !== 'JSXSpreadAttribute' && astroAttributeName(child(attribute, 'name')) === 'class'
  )
  const directOrdinary = component ? directClass[directClass.length - 1] : directClass[0]
  const hasDirectList = input.some(
    (attribute) =>
      attribute.type !== 'JSXSpreadAttribute' && astroAttributeName(child(attribute, 'name')) === 'class:list'
  )
  for (const attribute of input) {
    if (attribute.type !== 'JSXSpreadAttribute') {
      const name = astroAttributeName(child(attribute, 'name'))
      if ((component && name === 'className') || (name === 'class' && hasDirectList)) continue
      const value = child(attribute, 'value')
      const dynamicAlias =
        name === 'className' &&
        value &&
        !(['StringLiteral', 'Literal'].includes(value.type) && typeof value.value === 'string')
      const emitted = dynamicAlias ? 'class' : name
      const canonical = !component && nativeHtml ? emitted.replace(/[A-Z]/g, (letter) => letter.toLowerCase()) : emitted
      expanded.push({
        ...attribute,
        astroClassList: name === 'class:list',
        name: !component ? { ...child(attribute, 'name'), type: 'JSXIdentifier', name: canonical } : attribute.name,
        ...(name === 'class:list' && directOrdinary ? { astroDirectOrdinary: directOrdinary } : {})
      } as unknown as Ast)
      continue
    }
    const argument = child(attribute, 'argument')
    const properties = Array.isArray(argument?.properties) ? (argument.properties as Ast[]) : undefined
    if (
      argument?.type !== 'ObjectExpression' ||
      !properties?.every(
        (property) =>
          ['ObjectProperty', 'Property'].includes(property.type) &&
          !property.computed &&
          !property.method &&
          (!property.kind || property.kind === 'init')
      )
    ) {
      transfers.push(range(attribute))
      continue
    }
    const effective = new Map<string, Ast>()
    for (const property of properties) effective.set(astroAttributeName(child(property, 'key')), property)
    for (const property of effective.values()) {
      const name = astroAttributeName(child(property, 'key'))
      const value = child(property, 'value')
      if (!name || !value || (component && name === 'className')) continue
      const emitted = !component && name === 'className' ? 'class' : name
      const canonical = !component && nativeHtml ? emitted.replace(/[A-Z]/g, (letter) => letter.toLowerCase()) : emitted
      expanded.push({
        type: 'JSXAttribute',
        astroEmissionStart: range(attribute)[0],
        astroClassList: name === 'class:list',
        start: range(property)[0],
        end: range(property)[1],
        name: { type: 'JSXIdentifier', name: canonical },
        value: { type: 'JSXExpressionContainer', start: range(value)[0], end: range(value)[1], expression: value }
      } as unknown as Ast)
    }
  }
  const names = new Set<string>()
  const selected = (component ? [...expanded].reverse() : expanded).filter((attribute) => {
    if (!component) return true
    const name = astroAttributeName(child(attribute, 'name'))
    if (names.has(name)) return false
    names.add(name)
    return true
  })
  const attributes = component ? selected.reverse() : selected
  const list = attributes.find((attribute) =>
    component ? astroAttributeName(child(attribute, 'name')) === 'class:list' : attribute.astroClassList === true
  )
  const selectedOrdinary = attributes.find((attribute) => astroAttributeName(child(attribute, 'name')) === 'class')
  const ordinary = selectedOrdinary ?? (!component && list ? child(list, 'astroDirectOrdinary') : undefined)
  const listPrefix = component && list ? child(list, 'astroDirectOrdinary') : undefined
  return {
    attributes,
    transfers,
    ordinary,
    listPrefix,
    list
  }
}

/** Only class:list's existing supported syntax needs an empty-output proof.
 * Ordinary class/selector/type scalar emission uses evaluateAttributeExpression.
 */
export function astroListEmission(
  node: ExpressionNode | undefined,
  context: ExpressionContext,
  depth = 0
): AttributeAlternative[] {
  const location = node ? expressionRange(node, context) : ([context.offset, context.offset] as SourceRange)
  const absent = (): AttributeAlternative[] => [{ range: location, guard: {} }]
  const unknown = (): AttributeAlternative[] => [{ range: location, guard: {}, unresolved: true }]
  if (!node || depth > 64) return unknown()
  const evaluate = (value: ExpressionNode | undefined) => astroListEmission(value, context, depth + 1)
  if (['TSAsExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(node.type))
    return evaluate(node.expression)
  if (node.type === 'ConditionalExpression' && node.test)
    return conditionBranches(node.test, context).flatMap((branch) =>
      evaluate(branch.when ? node.consequent : node.alternate).flatMap((value) => {
        const guard = combineGuards(branch.guard, value.guard)
        return guard ? [{ ...value, guard }] : []
      })
    )
  if (node.type === 'LogicalExpression' && node.left && ['&&', '||'].includes(node.operator ?? ''))
    return conditionBranches(node.left, context).flatMap((branch) => {
      if (node.operator === '&&' && !branch.when) return [{ range: location, guard: branch.guard }]
      const selected =
        node.operator === '&&' ? (branch.when ? node.right : node.left) : branch.when ? node.left : node.right
      return evaluate(selected).flatMap((value) => {
        const guard = combineGuards(branch.guard, value.guard)
        return guard ? [{ ...value, guard }] : []
      })
    })
  const fold = (parts: AttributeAlternative[][]) => {
    let result = absent()
    for (const part of parts) {
      const next: AttributeAlternative[] = []
      for (const left of result)
        for (const right of part) {
          const guard = combineGuards(left.guard, right.guard)
          if (!guard) continue
          const value = left.value ?? right.value
          next.push({
            range: location,
            guard,
            ...(value === undefined ? { unresolved: left.unresolved || right.unresolved } : { value })
          })
          if (next.length > 256) return unknown()
        }
      result = next
    }
    return result
  }
  if (node.type === 'ArrayExpression')
    return fold((node.elements ?? []).map((value) => (value ? evaluate(value) : absent())))
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    context.helpers.has(node.callee.name ?? '')
  )
    return fold((node.arguments ?? []).map((value) => (value ? evaluate(value) : unknown())))
  if (node.type === 'ObjectExpression') {
    const properties = effectiveListProperties(node)
    if (!properties) return unknown()
    const parts: AttributeAlternative[][] = []
    for (const property of properties) {
      const key = property.key?.type === 'Identifier' ? property.key.name : property.key?.value
      if (
        !['Property', 'ObjectProperty'].includes(property.type) ||
        property.computed ||
        property.method ||
        (property.kind && property.kind !== 'init') ||
        typeof key !== 'string' ||
        !property.value ||
        typeof property.value !== 'object'
      )
        return unknown()
      parts.push(
        conditionBranches(property.value as ExpressionNode, context).map((branch) => ({
          range: location,
          guard: branch.guard,
          ...(branch.when && key.length ? { value: ' ' } : {})
        }))
      )
    }
    return fold(parts)
  }
  if (
    ['BooleanLiteral', 'NullLiteral'].includes(node.type) ||
    (node.type === 'Literal' && (typeof node.value === 'boolean' || node.value === null))
  )
    return absent()
  return evaluateAttributeExpression(node, context).map((value) => ({
    ...value,
    ...(value.value === '' || (typeof node.value === 'number' && node.value === 0) ? { value: undefined } : {})
  }))
}

/** First emitted native attribute, restricted by callers to inspected keys. */
export function firstAstroEmission(candidates: AttributeAlternative[][]): AttributeAlternative[] {
  let result: AttributeAlternative[] = []
  for (const candidate of candidates) {
    if (!result.length) {
      result = candidate
      continue
    }
    const next: AttributeAlternative[] = []
    for (const previous of result) {
      if (previous.value !== undefined || previous.present === true) {
        next.push(previous)
        continue
      }
      for (const value of candidate) {
        const guard = combineGuards(previous.guard, value.guard)
        if (guard) {
          if (previous.unresolved) {
            const canEmit = value.value !== undefined || value.present === true || value.unresolved
            next.push({
              ...previous,
              guard,
              present: value.value !== undefined || value.present === true ? true : undefined,
              generationValues: [
                ...new Set([
                  ...(previous.generationValues ?? []),
                  ...(value.value !== undefined ? [value.value] : (value.generationValues ?? []))
                ])
              ],
              ...(canEmit ? { winnerUnknown: true, attributeRange: undefined } : {})
            })
          } else next.push({ ...value, guard })
        }
        if (next.length > 256) return [{ range: value.range, guard: {}, unresolved: true }]
      }
    }
    result = next
  }
  return result
}
