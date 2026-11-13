import type { SourceIndex, SourceRange } from './source'
import { isStaticClassMemberBase } from '../jsx-class-bindings'
import type { AttributeAlternative, ClassAlternative, ClassToken, Guard } from './types'

/** The small syntax surface shared by Babel and supplied ESTree expression nodes. */
export type ExpressionNode = {
  type: string
  start?: number
  end?: number
  range?: SourceRange
  name?: string
  value?: unknown
  operator?: string
  computed?: boolean
  method?: boolean
  kind?: string
  key?: ExpressionNode
  object?: ExpressionNode
  property?: ExpressionNode
  argument?: ExpressionNode
  callee?: ExpressionNode
  arguments?: Array<ExpressionNode | null>
  elements?: Array<ExpressionNode | null>
  properties?: ExpressionNode[]
  expressions?: ExpressionNode[]
  quasis?: Array<{ value: { cooked?: string | null; raw: string }; start?: number; end?: number }>
  test?: ExpressionNode
  consequent?: ExpressionNode
  alternate?: ExpressionNode
  left?: ExpressionNode
  right?: ExpressionNode
  expression?: ExpressionNode
  params?: ExpressionNode[]
}

export function patternBindingNames(node: ExpressionNode | undefined): string[] {
  if (!node) return []
  if (node.type === 'Identifier') return node.name ? [node.name] : []
  if (node.type === 'AssignmentPattern') return patternBindingNames(node.left)
  if (node.type === 'RestElement') return patternBindingNames(node.argument)
  if (node.type === 'ArrayPattern')
    return (node.elements ?? []).flatMap((value) => patternBindingNames(value ?? undefined))
  if (node.type === 'ObjectPattern')
    return (node.properties ?? []).flatMap((property) =>
      patternBindingNames(
        property.type === 'RestElement' ? property.argument : (property.value as ExpressionNode | undefined)
      )
    )
  if (node.type === 'ArrowFunctionExpression') return (node.params ?? []).flatMap(patternBindingNames)
  return []
}

/** The already-supported class-list object subset, with JavaScript key order. */
export function effectiveListProperties(node: ExpressionNode): ExpressionNode[] | undefined {
  if (node.type !== 'ObjectExpression') return undefined
  const selected = new Map<string, ExpressionNode>()
  for (const property of node.properties ?? []) {
    const key = property.key?.type === 'Identifier' ? property.key.name : property.key?.value
    if (
      !['ObjectProperty', 'Property'].includes(property.type) ||
      property.computed ||
      property.method ||
      (property.kind && property.kind !== 'init') ||
      typeof key !== 'string'
    )
      return undefined
    selected.set(key, property)
  }
  return [...selected.values()]
}

export type ExpressionContext = {
  index: SourceIndex
  offset: number
  scope: string
  helpers: ReadonlySet<string>
  members: readonly string[] | undefined
  unstableNames?: ReadonlySet<string>
  bindingKey?: (name: string) => string
  isUnstableBinding?: (name: string) => boolean
  isUnbound?: (name: string) => boolean
  classifyBase?: (value: string) => string
  inertClassExtra?: (value: string) => boolean
}

export const expressionRange = (node: ExpressionNode, context: ExpressionContext): SourceRange => [
  context.offset + (node.start ?? node.range?.[0] ?? 0),
  context.offset + (node.end ?? node.range?.[1] ?? 0)
]

export function combineGuards(left: Guard, right: Guard): Guard | undefined {
  for (const key of Object.keys(left)) if (key in right && right[key] !== left[key]) return undefined
  return { ...left, ...right }
}

export function combineClasses(
  left: ClassAlternative[],
  right: ClassAlternative[],
  index?: SourceIndex
): ClassAlternative[] {
  const result: ClassAlternative[] = []
  for (const a of left)
    for (const b of right) {
      if (index) index.metrics.classExpressionProducts++
      const guard = combineGuards(a.guard, b.guard)
      if (!guard) continue
      result.push({
        tokens: [...a.tokens, ...b.tokens],
        guard,
        unresolved: a.unresolved ?? b.unresolved,
        correlationUnknown: a.correlationUnknown || b.correlationUnknown,
        ownerUnknown: a.ownerUnknown || b.ownerUnknown
      })
      if (result.length > 256)
        return [{ tokens: [], guard: {}, unresolved: b.tokens[0]?.range ?? a.tokens[0]?.range ?? [0, 0] }]
    }
  return result
}

const empty = (): ClassAlternative[] => [{ tokens: [], guard: {} }]
const truth = (node: ExpressionNode | undefined, context: ExpressionContext): boolean | undefined => {
  if (!node) return undefined
  if (node.type === 'Identifier' && node.name === 'undefined' && context.isUnbound?.('undefined')) return false
  if (['BooleanLiteral', 'StringLiteral', 'NumericLiteral', 'NullLiteral', 'Literal'].includes(node.type))
    return Boolean(node.value)
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const value = truth(node.argument, context)
    return value === undefined ? undefined : !value
  }
  return undefined
}

function jsStringTokens(value: string, node: ExpressionNode, context: ExpressionContext): ClassToken[] {
  const range = expressionRange(node, context)
  const source = context.index.source
  const raw = source.slice(range[0] + 1, range[1] - 1)
  const escape = /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|\r\n|[\s\S])/y
  const decoded: Array<{ value: string; start: number; end: number }> = []
  let actual = ''
  for (let cursor = 0; cursor < raw.length;) {
    escape.lastIndex = cursor
    const encoded = raw[cursor] === '\\' ? escape.exec(raw)?.[0] : undefined
    const text = encoded ?? raw[cursor]
    let character = text
    if (encoded) {
      const body = encoded.slice(1)
      if (/^u\{/.test(body)) character = String.fromCodePoint(parseInt(body.slice(2, -1), 16))
      else if (/^[ux]/.test(body)) character = String.fromCharCode(parseInt(body.slice(1), 16))
      else
        character =
          (
            {
              n: '\n',
              r: '\r',
              t: '\t',
              b: '\b',
              f: '\f',
              v: '\v',
              '0': '\0',
              '\n': '',
              '\r': '',
              '\r\n': ''
            } as Record<string, string>
          )[body] ?? body
    }
    for (const unit of character)
      decoded.push({ value: unit, start: range[0] + 1 + cursor, end: range[0] + 1 + cursor + text.length })
    actual += character
    cursor += text.length
  }
  if (actual !== value) return (value.match(/[^\t\n\f\r ]+/g) ?? []).map((value) => ({ value, range }))
  const tokens: ClassToken[] = []
  let token: ClassToken | undefined
  for (const unit of decoded) {
    if (/[\t\n\f\r ]/.test(unit.value)) token = undefined
    else if (token) {
      token.value += unit.value
      token.range[1] = unit.end
    } else {
      token = { value: unit.value, range: [unit.start, unit.end] }
      tokens.push(token)
    }
  }
  return tokens
}

function guardFor(
  node: ExpressionNode,
  context: ExpressionContext
): { key: string; inverted: boolean; unknown: boolean } {
  if (node.type === 'UnaryExpression' && node.operator === '!' && node.argument) {
    const inner = guardFor(node.argument, context)
    return { ...inner, inverted: !inner.inverted }
  }
  const range = expressionRange(node, context)
  const text = context.index.source.slice(...range)
  const stable =
    node.type === 'Identifier' &&
    !context.unstableNames?.has(node.name ?? '') &&
    !context.isUnstableBinding?.(node.name ?? '')
  return {
    key: stable
      ? (context.bindingKey?.(node.name ?? '') ?? `${context.scope}:${node.name}`)
      : `${context.scope}:@${range[0]}:${text}`,
    inverted: false,
    unknown: !stable
  }
}

function underGuard(
  values: ClassAlternative[],
  test: ExpressionNode,
  when: boolean,
  context: ExpressionContext
): ClassAlternative[] {
  return conditionBranches(test, context)
    .filter((branch) => branch.when === when)
    .flatMap((branch) =>
      values.flatMap((value) => {
        const combined = combineGuards(value.guard, branch.guard)
        return combined
          ? [{ ...value, guard: combined, correlationUnknown: value.correlationUnknown || branch.unknown }]
          : []
      })
    )
}

export function conditionBranches(
  test: ExpressionNode,
  context: ExpressionContext,
  depth = 0
): Array<{ when: boolean; guard: Guard; unknown: boolean }> {
  const known = truth(test, context)
  if (known !== undefined) return [{ when: known, guard: {}, unknown: false }]
  if (depth < 64 && test.type === 'UnaryExpression' && test.operator === '!' && test.argument)
    return conditionBranches(test.argument, context, depth + 1).map((branch) => ({ ...branch, when: !branch.when }))
  if (
    depth < 64 &&
    test.type === 'LogicalExpression' &&
    test.left &&
    test.right &&
    ['&&', '||'].includes(test.operator ?? '')
  ) {
    return conditionBranches(test.left, context, depth + 1).flatMap((left) => {
      if ((test.operator === '&&' && !left.when) || (test.operator === '||' && left.when)) return [left]
      return conditionBranches(test.right!, context, depth + 1).flatMap((right) => {
        const guard = combineGuards(left.guard, right.guard)
        return guard ? [{ when: right.when, guard, unknown: left.unknown || right.unknown }] : []
      })
    })
  }
  const guard = guardFor(test, context)
  return [true, false].map((when) => ({
    when,
    guard: { [guard.key]: guard.inverted ? !when : when },
    unknown: guard.unknown
  }))
}

/** Scalar attribute values are not class lists: preserve their complete values. */
export function evaluateAttributeExpression(
  node: ExpressionNode | undefined,
  context: ExpressionContext,
  depth = 0
): AttributeAlternative[] {
  const range: SourceRange = node ? expressionRange(node, context) : [context.offset, context.offset]
  const unknown = (): AttributeAlternative[] => [{ range, guard: {}, unresolved: true }]
  if (!node || depth > 64) return unknown()
  if (['StringLiteral', 'Literal', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(node.type)) {
    if (node.value === null || node.type === 'NullLiteral') return [{ range, guard: {} }]
    if (['string', 'number', 'boolean'].includes(typeof node.value))
      return [
        {
          value: String(node.value),
          range: typeof node.value === 'string' ? [range[0] + 1, range[1] - 1] : range,
          guard: {}
        }
      ]
  }
  if (node.type === 'TemplateLiteral' && !node.expressions?.length && node.quasis?.length === 1)
    return [
      { value: node.quasis[0].value.cooked ?? node.quasis[0].value.raw, range: [range[0] + 1, range[1] - 1], guard: {} }
    ]
  if (['TSAsExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(node.type))
    return evaluateAttributeExpression(node.expression, context, depth + 1)
  if (node.type === 'ConditionalExpression' && node.test)
    return conditionBranches(node.test, context).flatMap((branch) =>
      evaluateAttributeExpression(branch.when ? node.consequent : node.alternate, context, depth + 1).flatMap(
        (value) => {
          const guard = combineGuards(branch.guard, value.guard)
          return guard ? [{ ...value, guard }] : []
        }
      )
    )
  if (node.type === 'LogicalExpression' && node.left && ['&&', '||'].includes(node.operator ?? ''))
    return conditionBranches(node.left, context).flatMap((branch) => {
      const selected =
        node.operator === '&&' ? (branch.when ? node.right : node.left) : branch.when ? node.left : node.right
      return evaluateAttributeExpression(selected, context, depth + 1).flatMap((value) => {
        const guard = combineGuards(branch.guard, value.guard)
        return guard ? [{ ...value, guard }] : []
      })
    })
  if (node.type === 'Identifier' && node.name === 'undefined' && context.isUnbound?.('undefined'))
    return [{ range, guard: {} }]
  return unknown()
}

/** Compose only after the adapter has established effective order and overwrite semantics. */
export function composeClassAlternatives(
  current: ClassAlternative[],
  context: ExpressionContext,
  evaluate: (prefix?: string) => ClassAlternative[],
  append: boolean,
  permitPrefix = true
): ClassAlternative[] {
  const first = current.length === 1 ? current[0] : undefined
  const base = first?.tokens[0]?.value
  const prefix =
    append &&
    permitPrefix &&
    first &&
    !Object.keys(first.guard).length &&
    !first.unresolved &&
    !first.ownerUnknown &&
    !first.correlationUnknown &&
    base &&
    ['block', 'element'].includes(context.classifyBase?.(base) ?? '')
      ? base
      : undefined
  const next = evaluate(prefix)
  return append ? combineClasses(current, next, context.index) : next
}

export function evaluateClassExpression(
  node: ExpressionNode | undefined,
  context: ExpressionContext,
  semantics: 'scalar' | 'list' = 'scalar',
  depth = 0,
  prefix?: string
): ClassAlternative[] {
  if (!node) return empty()
  if (node.type === 'Identifier' && node.name === 'undefined' && context.isUnbound?.('undefined')) return empty()
  const range = expressionRange(node, context)
  const unknown = (): ClassAlternative[] => [{ tokens: [], guard: {}, unresolved: range }]
  if (depth > 64) return unknown()
  const evaluate = (value: ExpressionNode | undefined, mode = semantics, base: string | null | undefined = prefix) =>
    evaluateClassExpression(value, context, mode, depth + 1, base ?? undefined)
  const stableCondition = (value?: ExpressionNode, remaining = 64): boolean =>
    Boolean(
      remaining >= 0 &&
      value &&
      (value.type === 'Identifier'
        ? !context.isUnstableBinding?.(value.name ?? '') && !context.unstableNames?.has(value.name ?? '')
        : value.type === 'UnaryExpression' && value.operator === '!' && stableCondition(value.argument, remaining - 1))
    )
  const staticKey = (property: ExpressionNode) =>
    property.key?.type === 'Identifier' ? property.key.name : property.key?.value
  const plainProperty = (property: ExpressionNode) =>
    ['ObjectProperty', 'Property'].includes(property.type) &&
    !property.computed &&
    !property.method &&
    (!property.kind || property.kind === 'init') &&
    typeof staticKey(property) === 'string'
  const transparent = (value: ExpressionNode | null | undefined, remaining = 64): boolean => {
    if (remaining < 0) return false
    if (!value) return true
    if (['StringLiteral', 'BooleanLiteral', 'NullLiteral', 'Literal'].includes(value.type)) return true
    if (value.type === 'ObjectExpression') {
      const properties = value.properties ?? []
      return (
        new Set(properties.map(staticKey)).size === properties.length &&
        properties.every(
          (property) =>
            plainProperty(property) &&
            (truth(property.value as ExpressionNode, context) !== undefined ||
              stableCondition(property.value as ExpressionNode))
        )
      )
    }
    if (value.type === 'ArrayExpression')
      return (value.elements ?? []).every((item) => transparent(item, remaining - 1))
    return (
      value.type === 'LogicalExpression' &&
      value.operator === '&&' &&
      stableCondition(value.left) &&
      transparent(value.right, remaining - 1)
    )
  }
  const guaranteed = (values: ClassAlternative[]) => {
    if (!values.length || values.some((value) => value.unresolved || value.ownerUnknown || value.correlationUnknown))
      return undefined
    if (prefix) return prefix
    const base = values[0].tokens[0]?.value
    return base &&
      ['block', 'element'].includes(context.classifyBase?.(base) ?? '') &&
      values.every((value) => value.tokens[0]?.value === base)
      ? base
      : undefined
  }
  const inert = (values: ClassAlternative[]) =>
    values.every(
      (value) =>
        !value.unresolved &&
        !value.ownerUnknown &&
        !value.correlationUnknown &&
        value.tokens.every((token) => context.inertClassExtra?.(token.value))
    )
  if ((node.type === 'StringLiteral' || node.type === 'Literal') && typeof node.value === 'string')
    return [{ tokens: jsStringTokens(node.value, node, context), guard: {} }]
  if (node.type === 'TemplateLiteral' && !node.expressions?.length && node.quasis?.length === 1) {
    const value = node.quasis[0].value.cooked
    return typeof value === 'string' ? [{ tokens: jsStringTokens(value, node, context), guard: {} }] : unknown()
  }
  if (
    ['BooleanLiteral', 'NullLiteral'].includes(node.type) ||
    (node.type === 'Literal' && (node.value === null || typeof node.value === 'boolean'))
  )
    return empty()
  if (node.type === 'ParenthesizedExpression' || node.type === 'TSAsExpression' || node.type === 'TSNonNullExpression')
    return evaluate(node.expression)
  if (node.type === 'ConditionalExpression' && node.test) {
    const known = truth(node.test, context)
    if (known !== undefined) return evaluate(known ? node.consequent : node.alternate)
    return [
      ...underGuard(evaluate(node.consequent), node.test, true, context),
      ...underGuard(evaluate(node.alternate), node.test, false, context)
    ]
  }
  if (node.type === 'LogicalExpression' && node.left && (node.operator === '&&' || node.operator === '||')) {
    const known = truth(node.left, context)
    if (known !== undefined)
      return node.operator === '&&'
        ? known
          ? evaluate(node.right)
          : empty()
        : known
          ? evaluate(node.left)
          : evaluate(node.right)
    if (prefix && node.operator === '&&' && stableCondition(node.left)) {
      const values = evaluate(node.right)
      if (inert(values)) {
        context.index.metrics.inertOptionalTokens += values.reduce((sum, value) => sum + value.tokens.length, 0)
        return empty()
      }
    }
    return node.operator === '&&'
      ? [
          ...underGuard(evaluate(node.right), node.left, true, context),
          ...underGuard(empty(), node.left, false, context)
        ]
      : [
          ...underGuard(evaluate(node.left), node.left, true, context),
          ...underGuard(evaluate(node.right), node.left, false, context)
        ]
  }
  if (
    node.type === 'MemberExpression' &&
    node.object?.type === 'Identifier' &&
    isStaticClassMemberBase(node.object.name ?? '', context.members)
  ) {
    const property = node.property
    const name =
      !node.computed && property?.type === 'Identifier'
        ? property.name
        : typeof property?.value === 'string'
          ? property.value
          : undefined
    if (name && property) return [{ tokens: [{ value: name, range: expressionRange(property, context) }], guard: {} }]
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    context.helpers.has(node.callee.name ?? '')
  ) {
    const prune = (node.arguments ?? []).every((item) => transparent(item))
    return (node.arguments ?? []).reduce<ClassAlternative[]>(
      (values, argument) =>
        combineClasses(
          values,
          argument ? evaluate(argument, 'list', prune ? (guaranteed(values) ?? null) : null) : unknown(),
          context.index
        ),
      empty()
    )
  }
  if (semantics === 'list' && node.type === 'ArrayExpression') {
    const prune = (node.elements ?? []).every((item) => transparent(item))
    return (node.elements ?? []).reduce<ClassAlternative[]>(
      (values, element) =>
        combineClasses(
          values,
          element ? evaluate(element, 'list', prune ? (guaranteed(values) ?? null) : null) : empty(),
          context.index
        ),
      empty()
    )
  }
  if (semantics === 'list' && node.type === 'ObjectExpression') {
    const properties = effectiveListProperties(node)
    if (!properties) return unknown()
    let result = empty()
    const prune = Boolean(prefix && transparent(node))
    for (const property of properties) {
      if (
        !['ObjectProperty', 'Property'].includes(property.type) ||
        property.computed ||
        property.method ||
        !property.key ||
        (property.kind && property.kind !== 'init')
      )
        return unknown()
      const key = property.key
      const name = key.type === 'Identifier' ? key.name : key.value
      if (typeof name !== 'string') return unknown()
      const value =
        key.type === 'Identifier'
          ? [{ tokens: [{ value: name, range: expressionRange(key, context) }], guard: {} }]
          : evaluate(key, 'scalar')
      const condition = property.value as ExpressionNode | undefined
      if (!condition || typeof condition !== 'object') return unknown()
      const known = truth(condition, context)
      if (prune && known === undefined && stableCondition(condition) && inert(value)) {
        context.index.metrics.inertOptionalTokens += value.reduce(
          (sum, alternative) => sum + alternative.tokens.length,
          0
        )
        continue
      }
      const alternatives =
        known === true
          ? value
          : known === false
            ? empty()
            : [...underGuard(value, condition, true, context), ...underGuard(empty(), condition, false, context)]
      result = combineClasses(result, alternatives, context.index)
    }
    return result
  }
  return unknown()
}
