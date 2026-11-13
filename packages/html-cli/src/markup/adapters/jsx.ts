import { parse, type ParserOptions } from '@babel/parser'
import { createMarkupRuleContext, type HtmlLintMode } from '../../generator-core'
import { htmlClassTokens } from '../class-values'
import {
  composeClassAlternatives,
  combineGuards,
  conditionBranches,
  evaluateAttributeExpression,
  evaluateClassExpression,
  type ExpressionContext,
  type ExpressionNode
} from '../expressions'
import { SourceIndex, type SourceRange } from '../source'
import { applyMarkupNamespaces, markupNamespace, markupChildNamespace } from '../namespaces'
import { astroAttributes, astroAttributeName, astroListEmission, firstAstroEmission } from './astro-attributes'
import type {
  AttributeAlternative,
  ClassAlternative,
  Guard,
  MarkupAttribute,
  MarkupConfig,
  MarkupDocument,
  MarkupElement
} from '../types'

export type Ast = ExpressionNode & { [key: string]: unknown }
type Scope = { id: string; parent?: Scope; bindings: Map<string, Ast>; helpers: Set<Ast>; varBoundary?: boolean }
const child = (node: Ast, key: string): Ast | undefined =>
  node[key] && typeof node[key] === 'object' && !Array.isArray(node[key]) ? (node[key] as Ast) : undefined
const list = (node: Ast, key: string): Ast[] => (Array.isArray(node[key]) ? (node[key] as Ast[]) : [])
const range = (node: Ast): SourceRange => [node.start ?? node.range?.[0] ?? 0, node.end ?? node.range?.[1] ?? 0]
const isJsx = (node?: Ast) =>
  node?.type === 'JSXElement' || node?.type === 'JSXFragment' || node?.type === 'AstroFragment'
const isFunction = (node: Ast) =>
  /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ObjectMethod|ClassMethod|ClassPrivateMethod)$/.test(
    node.type
  )

export function parseJsxSource(
  source: string,
  mode: HtmlLintMode,
  config: MarkupConfig,
  typescript = false
): MarkupDocument {
  const options: ParserOptions = {
    sourceType: 'unambiguous',
    plugins: typescript ? ['jsx', 'typescript'] : ['jsx'],
    ranges: true
  }
  let ast
  let parses = 1
  try {
    ast = parse(source, options)
  } catch (error) {
    if (
      mode !== 'selection' ||
      !error ||
      typeof error !== 'object' ||
      !('reasonCode' in error) ||
      error.reasonCode !== 'UnwrappedAdjacentJSXElements'
    )
      throw error
    parses += 1
    Object.assign(error, { markupMetrics: { markupParses: parses } })
    let wrapped
    try {
      wrapped = parse(`<>${source}</>`, options)
    } catch {
      throw error
    }
    const expression = wrapped.program.body[0]
    if (
      wrapped.program.body.length !== 1 ||
      expression?.type !== 'ExpressionStatement' ||
      expression.expression.type !== 'JSXFragment' ||
      expression.expression.children.some(
        (node) =>
          node.type !== 'JSXElement' &&
          node.type !== 'JSXFragment' &&
          !(node.type === 'JSXText' && !node.value.trim()) &&
          !(node.type === 'JSXExpressionContainer' && node.expression.type === 'JSXEmptyExpression')
      )
    )
      throw error
    const pending: unknown[] = [wrapped]
    while (pending.length) {
      const node = pending.pop() as Record<string, unknown>
      if (typeof node.start === 'number') node.start = Math.max(0, node.start - 2)
      if (typeof node.end === 'number') node.end = Math.min(source.length, Math.max(0, node.end - 2))
      if (Array.isArray(node.range)) node.range = [node.start, node.end]
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'range', 'comments', 'tokens', 'extra'].includes(key)) continue
        if (Array.isArray(value)) pending.push(...value.filter((item) => item && typeof item.type === 'string'))
        else if (value && typeof value === 'object' && 'type' in value) pending.push(value)
      }
    }
    ast = wrapped
  }
  const document = adaptJsxAst(source, ast, mode, config)
  document.index.metrics.markupParses = parses
  return document
}

/** Babel CLI and ESTree host entry points share this syntax adapter, not a reparse. */
export function adaptJsxAst(
  source: string,
  supplied: unknown,
  mode: HtmlLintMode,
  config: MarkupConfig,
  semantics: 'jsx' | 'astro' = 'jsx'
): MarkupDocument {
  const root = supplied as Ast
  if (!root || !['File', 'Program'].includes(root.type))
    throw Object.assign(new Error('Unsupported supplied JSX AST family.'), { code: 'PARSER_UNAVAILABLE' })
  const index = new SourceIndex(source)
  const classRules = createMarkupRuleContext(config)
  const document: MarkupDocument = { roots: [], issues: [], index, outOfScope: 0, checkRootCount: false }
  const scopes = new Map<Ast, Scope>()
  const parents = new Map<Ast, Ast>()
  const all: Ast[] = []
  const top: Scope = { id: 'module', bindings: new Map(), helpers: new Set() }
  const mutations: Array<{ name: string; scope: Scope }> = []
  const mutatedBindings = new Set<Ast>()
  const patternNames = (pattern: Ast | undefined): Ast[] => {
    if (!pattern) return []
    if (pattern.type === 'Identifier') return [pattern]
    if (pattern.type === 'TSParameterProperty') return patternNames(child(pattern, 'parameter'))
    if (pattern.type === 'AssignmentPattern') return patternNames(child(pattern, 'left'))
    if (pattern.type === 'RestElement') return patternNames(child(pattern, 'argument'))
    if (pattern.type === 'ArrayPattern') return list(pattern, 'elements').flatMap((item) => patternNames(item))
    if (pattern.type === 'ObjectPattern')
      return list(pattern, 'properties').flatMap((item) =>
        patternNames(child(item, item.type === 'RestElement' ? 'argument' : 'value'))
      )
    return []
  }
  const seen = new Set<object>()
  const visit = (node: Ast, scope: Scope, parent?: Ast) => {
    if (seen.has(node)) return
    seen.add(node)
    if (parent) parents.set(node, parent)
    const outerScope = scope
    if (['FunctionDeclaration', 'ClassDeclaration', 'TSEnumDeclaration', 'TSModuleDeclaration'].includes(node.type)) {
      const id = child(node, 'id')
      if (id?.name) scope.bindings.set(id.name, node)
    }
    if (
      isFunction(node) ||
      node.type === 'BlockStatement' ||
      node.type === 'CatchClause' ||
      node.type === 'ClassExpression' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'SwitchStatement' ||
      node.type === 'StaticBlock' ||
      node.type === 'TSModuleDeclaration' ||
      node.type === 'TSModuleBlock' ||
      /^For(?:In|Of)?Statement$/.test(node.type)
    )
      scope = {
        id: `scope@${range(node)[0]}`,
        parent: scope,
        bindings: new Map(),
        helpers: new Set(),
        varBoundary:
          isFunction(node) ||
          node.type === 'StaticBlock' ||
          node.type === 'TSModuleBlock' ||
          (node.type === 'BlockStatement' && Boolean(parent && isFunction(parent) && parent.body === node))
      }
    scopes.set(node, scope)
    all.push(node)
    if (['FunctionExpression', 'ClassExpression', 'ClassDeclaration'].includes(node.type)) {
      const id = child(node, 'id')
      if (id?.name) scope.bindings.set(id.name, node)
    }
    if (isFunction(node))
      for (const pattern of list(node, 'params'))
        for (const parameter of patternNames(pattern)) if (parameter.name) scope.bindings.set(parameter.name, parameter)
    if (node.type === 'CatchClause')
      for (const parameter of patternNames(child(node, 'param')))
        if (parameter.name) scope.bindings.set(parameter.name, parameter)
    if (node.type === 'VariableDeclarator') {
      const id = child(node, 'id')
      let declarationScope = scope
      if (parent?.kind === 'var')
        while (declarationScope.parent && !declarationScope.varBoundary) declarationScope = declarationScope.parent
      for (const identifier of patternNames(id))
        if (identifier.name)
          declarationScope.bindings.set(identifier.name, id?.type === 'Identifier' ? node : identifier)
    }
    if (node.type === 'ImportDeclaration') {
      const packageName = child(node, 'source')?.value
      for (const specifier of list(node, 'specifiers')) {
        const local = child(specifier, 'local')
        if (!local?.name) continue
        scope.bindings.set(local.name, specifier)
        const imported = child(specifier, 'imported')?.name
        if (
          (packageName === 'clsx' || packageName === 'classnames') &&
          node.importKind !== 'type' &&
          node.importKind !== 'typeof' &&
          specifier.importKind !== 'type' &&
          specifier.importKind !== 'typeof' &&
          (specifier.type === 'ImportDefaultSpecifier' ||
            imported === 'default' ||
            (packageName === 'clsx' && imported === 'clsx'))
        )
          scope.helpers.add(specifier)
      }
    }
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      const target = child(node, 'left') ?? child(node, 'argument')
      for (const identifier of patternNames(target))
        if (identifier.name) mutations.push({ name: identifier.name, scope })
    }
    for (const [key, value] of Object.entries(node)) {
      if (['parent', 'loc', 'range', 'tokens', 'comments', 'extra'].includes(key)) continue
      const referenceScope =
        (isFunction(node) && key === 'key') || (node.type === 'SwitchStatement' && key === 'discriminant')
          ? outerScope
          : scope
      if (Array.isArray(value)) {
        for (const item of value)
          if (item && typeof item === 'object' && typeof item.type === 'string')
            visit(item as Ast, referenceScope, node)
      } else if (value && typeof value === 'object' && typeof (value as Ast).type === 'string')
        visit(value as Ast, referenceScope, node)
    }
  }
  visit(root, top)
  const lookup = (name: string, scope: Scope | undefined): { scope: Scope; binding: Ast } | undefined => {
    while (scope) {
      const binding = scope.bindings.get(name)
      if (binding) return { scope, binding }
      scope = scope.parent
    }
    return undefined
  }
  for (const mutation of mutations) {
    const target = lookup(mutation.name, mutation.scope)?.binding
    if (target) mutatedBindings.add(target)
  }
  const importedHelpers = [...top.bindings.entries()].filter(([, binding]) => top.helpers.has(binding))
  const contextCache = new Map<Scope, ExpressionContext>()
  const builtNodes = new Set<Ast>()
  let uncertainAstroTree = false
  const expressionContext = (node: Ast): ExpressionContext => {
    const scope = scopes.get(node) ?? top
    const cached = contextCache.get(scope)
    if (cached) return cached
    const helpers = new Set<string>()
    for (const [name, binding] of importedHelpers)
      if (lookup(name, scope)?.binding === binding && !mutatedBindings.has(binding)) helpers.add(name)
    const context: ExpressionContext = {
      index,
      offset: 0,
      scope: scope.id,
      helpers,
      members: config.jsxClassBindings?.memberAccessAllowlist,
      isUnstableBinding: (name) => {
        const binding = lookup(name, scope)?.binding
        return binding ? mutatedBindings.has(binding) : false
      },
      bindingKey: (name) => `${lookup(name, scope)?.scope.id ?? scope.id}:${name}`,
      isUnbound: (name) => !lookup(name, scope),
      classifyBase: classRules.classify,
      inertClassExtra: classRules.inertClassExtra
    }
    contextCache.set(scope, context)
    return context
  }
  const childReferences = new Map<Ast, Ast[]>()
  for (const node of all)
    if (node.type === 'JSXExpressionContainer') {
      const expression = child(node, 'expression')
      const parent = parents.get(node)
      if (expression?.type !== 'Identifier' || !expression.name || !isJsx(parent)) continue
      const binding = lookup(expression.name, scopes.get(node))?.binding
      if (binding) {
        const references = childReferences.get(binding) ?? []
        references.push(node)
        childReferences.set(binding, references)
      }
    }
  const linked = new Map<Ast, Ast>()
  const linkedInitializers = new Set<Ast>()
  const inAstroTemplate = (node: Ast): boolean => {
    let current: Ast | undefined = node
    while (current && current.type !== 'AstroFragment') {
      if (current.astroPartialContext || current.astroUnverified) return false
      current = parents.get(current)
    }
    return Boolean(current)
  }
  for (const [binding, references] of childReferences) {
    const declaration = parents.get(binding)
    const initializer = child(binding, 'init')
    if (
      declaration?.kind !== 'const' ||
      list(declaration, 'declarations').length !== 1 ||
      references.length !== 1 ||
      !isJsx(initializer) ||
      !initializer ||
      (semantics === 'astro' && !inAstroTemplate(initializer)) ||
      scopes.get(binding) !== scopes.get(references[0])
    )
      continue
    const name = child(binding, 'id')?.name
    if (!name || mutatedBindings.has(binding)) continue
    linked.set(references[0], initializer)
    linkedInitializers.add(initializer)
  }
  const withGuard = (nodes: MarkupElement[], guard: Guard): MarkupElement[] =>
    nodes.flatMap((node) => {
      const combined = combineGuards(node.guard ?? {}, guard)
      return combined ? [{ ...node, guard: combined }] : []
    })
  const coexist = (roots: MarkupElement[]): boolean =>
    roots.some((left, a) =>
      roots.slice(a + 1).some((right) => combineGuards(left.guard ?? {}, right.guard ?? {}))
    )
  const buildExpression = (
    expression: Ast | undefined,
    rootRule: boolean,
    depth: number,
    namespace = 'http://www.w3.org/1999/xhtml'
  ): MarkupElement[] => {
    if (!expression) return []
    if (expression.astroUnverified) return []
    if (depth > 256) {
      document.issues.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Source expression traversal exceeded the implementation safety limit of 256.',
        baseClass: '',
        path: [],
        range: range(expression)
      })
      return []
    }
    if (expression.type === 'JSXEmptyExpression') return []
    if (isJsx(expression)) return build(expression, rootRule, depth, namespace)
    if (expression.type === 'ConditionalExpression' && expression.test) {
      return conditionBranches(expression.test, expressionContext(expression)).flatMap((branch) =>
        withGuard(
          buildExpression(
            (branch.when ? expression.consequent : expression.alternate) as Ast,
            rootRule,
            depth + 1,
            namespace
          ),
          branch.guard
        )
      )
    }
    if (
      expression.type === 'LogicalExpression' &&
      ['&&', '||'].includes(expression.operator ?? '') &&
      expression.left
    ) {
      return conditionBranches(expression.left, expressionContext(expression)).flatMap((branch) => {
        if (expression.operator === '&&' && !branch.when) return []
        const selected = expression.operator === '||' && branch.when ? expression.left : expression.right
        return withGuard(buildExpression(selected as Ast, rootRule, depth + 1, namespace), branch.guard)
      })
    }
    if (expression.type === 'ArrayExpression') {
      const values = list(expression, 'elements')
        .filter(Boolean)
        .flatMap((element) => buildExpression(element, rootRule, depth + 1, namespace))
      if (rootRule && semantics !== 'astro' && coexist(values))
        document.issues.push({
          code: 'MULTIPLE_ROOT_ELEMENTS',
          message: 'Root array contains multiple source elements.',
          baseClass: '',
          path: [],
          range: range(expression)
        })
      return values
    }
    if (['TSAsExpression', 'ParenthesizedExpression', 'TSNonNullExpression'].includes(expression.type))
      return buildExpression(child(expression, 'expression'), rootRule, depth + 1, namespace)
    if (expression.type === 'CallExpression') {
      const descendants: Ast[] = []
      const pending = [expression]
      while (pending.length) {
        const item = pending.pop()!
        if (isJsx(item)) {
          descendants.push(item)
          continue
        }
        for (const [key, value] of Object.entries(item)) {
          if (['parent', 'loc', 'tokens', 'comments', 'extra'].includes(key)) continue
          if (Array.isArray(value))
            for (const entry of value) {
              if (entry && typeof entry === 'object' && typeof entry.type === 'string') pending.push(entry as Ast)
            }
          else if (value && typeof value === 'object' && typeof (value as Ast).type === 'string')
            pending.push(value as Ast)
        }
      }
      if (!descendants.length) document.outOfScope += 1
      return descendants.flatMap((node) => build(node, false, depth + 1, namespace))
    }
    document.outOfScope += 1
    return []
  }
  const build = (
    node: Ast,
    rootRule: boolean,
    depth: number,
    inheritedNamespace = 'http://www.w3.org/1999/xhtml'
  ): MarkupElement[] => {
    builtNodes.add(node)
    if (node.astroUnverified) return []
    if (depth > 256) {
      document.issues.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Source traversal exceeded the implementation safety limit of 256 nested elements.',
        baseClass: '',
        path: [],
        range: range(node)
      })
      return []
    }
    if (node.astroPartialContext) {
      uncertainAstroTree = true
      const opening = child(node, 'openingElement'),
        name = opening && child(opening, 'name')
      const namespace = markupNamespace(String(name?.name ?? ''), inheritedNamespace)
      const childNamespace =
        String(name?.name ?? '').toLowerCase() === 'annotation-xml'
          ? 'unknown'
          : markupChildNamespace(namespace, String(name?.name ?? ''), [])
      const verified = list(node, 'children').flatMap((item) =>
        isJsx(item)
          ? build(item, false, depth + 1, childNamespace)
          : item.type === 'JSXExpressionContainer'
            ? buildExpression(child(item, 'expression'), false, depth + 1, childNamespace)
            : []
      )
      for (const element of verified) {
        element.detached = true
        element.rootRule = false
        element.ancestryUnknown = true
      }
      return verified
    }
    const opening = child(node, 'openingElement')!
    const name = opening && child(opening, 'name')
    const fragmentAttributes = opening ? list(opening, 'attributes') : []
    const astroFragment =
      semantics === 'astro' &&
      name?.type === 'JSXIdentifier' &&
      name.name === 'Fragment' &&
      !lookup('Fragment', scopes.get(name)) &&
      fragmentAttributes.length <= 1 &&
      fragmentAttributes.every((attribute) => {
        const name = child(attribute, 'name'),
          value = child(attribute, 'value')
        return (
          attribute.type === 'JSXAttribute' &&
          name?.type === 'JSXIdentifier' &&
          name.name === 'slot' &&
          value &&
          ['StringLiteral', 'Literal'].includes(value.type) &&
          typeof value.value === 'string'
        )
      })
    if (node.type === 'JSXFragment' || node.type === 'AstroFragment' || astroFragment) {
      const roots = list(node, 'children').flatMap((item) =>
        item.type === 'JSXExpressionContainer'
          ? buildExpression(child(item, 'expression'), rootRule, depth + 1, inheritedNamespace)
          : isJsx(item)
            ? build(item, rootRule, depth + 1, inheritedNamespace)
            : []
      )
      if (rootRule && mode === 'root' && semantics !== 'astro' && coexist(roots))
        document.issues.push({
          code: 'MULTIPLE_ROOT_ELEMENTS',
          message: 'Root Fragment contains multiple coexisting source elements.',
          baseClass: '',
          path: [],
          range: range(node)
        })
      return roots
    }
    const tag = name?.name ?? source.slice(...range(name ?? opening))
    const component = /^[A-Z]/.test(tag) || name?.type === 'JSXMemberExpression'
    // A spread that provably contributes no props equals an omitted spread.
    // Astro native spreadAttributes selects its default object only for undefined.
    const attributeNodes = list(opening, 'attributes').filter((attribute) => {
      if (attribute.type !== 'JSXSpreadAttribute') return true
      const argument = child(attribute, 'argument')
      if (argument?.type === 'Identifier' && argument.name === 'undefined')
        return !expressionContext(attribute).isUnbound?.('undefined')
      const isNull = argument?.type === 'NullLiteral' || (argument?.type === 'Literal' && argument.value === null)
      return !(isNull && (semantics !== 'astro' || component))
    })
    const namespace = markupNamespace(String(tag), inheritedNamespace)
    const attributes: MarkupAttribute[] = []
    const nativeAttributeStarts = new Map<MarkupAttribute, number>()
    let classes: ClassAlternative[] = [{ tokens: [], guard: {} }]
    let explicitChildren: Ast | undefined
    let unknownSpreads = 0
    let unknownInputType: SourceRange | undefined
    const write = (attribute: Ast, folded = false) => {
      const nameNode = child(attribute, 'name')
      const attrName =
        nameNode?.type === 'JSXNamespacedName'
          ? `${child(nameNode, 'namespace')?.name}:${child(nameNode, 'name')?.name}`
          : nameNode?.name
      const value = child(attribute, 'value')
      const literalRange = (literal: Ast): SourceRange => {
        const [start, end] = range(literal)
        return semantics === 'astro' && !['"', "'"].includes(source[start]) ? [start, end] : [start + 1, end - 1]
      }
      if (!attrName) return
      if (attrName === 'type') unknownInputType = undefined
      if (attrName === 'children') explicitChildren = child(value ?? attribute, 'expression') ?? value
      const isList =
        semantics === 'astro' && (component ? attrName === 'class:list' : attribute.astroClassList === true)
      if (attrName === 'className' || attrName === 'class' || isList) {
        const expression = value && (child(value, 'expression') ?? value)
        const originalContext = expressionContext(expression ?? attribute)
        const hasSpread =
          semantics === 'astro'
            ? Boolean(astro?.transfers.length)
            : attributeNodes.some((item) => item.type === 'JSXSpreadAttribute')
        const context = hasSpread ? { ...originalContext, inertClassExtra: undefined } : originalContext
        let literal: ClassAlternative[] | undefined
        if (!value) literal = [{ tokens: [], guard: {}, unresolved: range(attribute) }]
        else if (['StringLiteral', 'Literal'].includes(value.type) && typeof value.value === 'string')
          literal = [
            {
              tokens: htmlClassTokens(source.slice(...literalRange(value)), literalRange(value)[0]),
              guard: {}
            }
          ]
        classes = composeClassAlternatives(
          classes,
          context,
          (prefix) => {
            const evaluated =
              literal ?? evaluateClassExpression(expression, context, isList ? 'list' : 'scalar', 0, prefix)
            if (semantics !== 'astro' || component || isList || folded || literal) return evaluated
            const scalar = evaluateAttributeExpression(expression, context)
            return evaluated.flatMap((value) =>
              scalar.flatMap((output) => {
                const guard = combineGuards(value.guard, output.guard)
                return guard
                  ? [
                      {
                        ...value,
                        guard,
                        ...(!value.tokens.length && !value.unresolved && output.value !== undefined
                          ? { tokens: htmlClassTokens(output.value, output.range[0]) }
                          : {})
                      }
                    ]
                  : []
              })
            )
          },
          semantics === 'astro',
          !hasSpread
        )
      } else if (value && typeof value.value === 'string')
        attributes.push({
          name: attrName,
          value: value.value,
          range: range(attribute),
          valueRange: literalRange(value)
        })
      else if (value)
        attributes.push({
          name: attrName,
          value: '',
          range: range(attribute),
          valueRange: range(value),
          alternatives: evaluateAttributeExpression(
            child(value, 'expression') ?? value,
            expressionContext(child(value, 'expression') ?? value)
          )
        })
      else attributes.push({ name: attrName, value: '', range: range(attribute), valueRange: range(attribute) })
    }
    const astro =
      semantics === 'astro'
        ? astroAttributes(attributeNodes, component, namespace === 'http://www.w3.org/1999/xhtml')
        : undefined
    for (const attribute of astro?.attributes ?? attributeNodes) {
      if (attribute.type !== 'JSXSpreadAttribute') {
        if (
          astro &&
          (astroAttributeName(child(attribute, 'name')) === 'class' ||
            (component
              ? astroAttributeName(child(attribute, 'name')) === 'class:list'
              : attribute.astroClassList === true))
        )
          continue
        const before = attributes.length
        write(attribute)
        if (astro && !component)
          for (const value of attributes.slice(before))
            nativeAttributeStarts.set(
              value,
              typeof attribute.astroEmissionStart === 'number' ? attribute.astroEmissionStart : range(attribute)[0]
            )
        continue
      }
      const argument = child(attribute, 'argument')
      if (
        argument?.type === 'ObjectExpression' &&
        list(argument, 'properties').every(
          (property) =>
            ['ObjectProperty', 'Property'].includes(property.type) &&
            !property.computed &&
            !property.method &&
            (!property.kind || property.kind === 'init')
        )
      ) {
        for (const property of list(argument, 'properties')) {
          const key = child(property, 'key')
          const name = key?.name ?? key?.value
          const value = child(property, 'value')
          if (name === 'className' || name === 'class')
            classes = composeClassAlternatives(
              classes,
              expressionContext(value ?? attribute),
              () => evaluateClassExpression(value, expressionContext(value ?? attribute)),
              false
            )
          else if (typeof name === 'string' && value) {
            if (name === 'type') unknownInputType = undefined
            if (name === 'children') explicitChildren = value
            attributes.push({
              name,
              value: '',
              range: range(property),
              valueRange: range(value),
              alternatives: evaluateAttributeExpression(value, expressionContext(attribute))
            })
          }
        }
      } else {
        unknownSpreads += 1
        const transfer = range(attribute)
        unknownInputType = unknownInputType ? [unknownInputType[0], transfer[1]] : transfer
        document.outOfScope += 1
        for (const value of attributes) value.overwrittenBy = range(attribute)
        classes = classes.map((value) => ({ ...value, ownerUnknown: true, unresolved: range(attribute) }))
        explicitChildren = undefined
      }
    }
    if (astro) {
      if (component) {
        if (astro.ordinary) write(astro.ordinary)
        if (astro.listPrefix) write(astro.listPrefix)
        if (astro.list) write(astro.list)
      } else {
        const classAttributes = astro.attributes.filter(
          (attribute) => astroAttributeName(child(attribute, 'name')) === 'class' || attribute.astroClassList === true
        )
        const events = [
          ...classAttributes.map((attribute) => ({
            start:
              typeof attribute.astroEmissionStart === 'number' ? attribute.astroEmissionStart : range(attribute)[0],
            attribute
          })),
          ...astro.transfers.map((transfer) => ({ start: transfer[0], transfer }))
        ].sort((a, b) => a.start - b.start)
        let pending: Guard[] = [{}]
        const selected: ClassAlternative[] = []
        for (const event of events) {
          if (!pending.length) break
          if ('transfer' in event) {
            selected.push(
              ...pending.map((guard) => ({ tokens: [], guard, ownerUnknown: true, unresolved: event.transfer }))
            )
            pending = []
            break
          }
          const attribute = event.attribute
          const isList = attribute.astroClassList === true
          const ordinary = isList ? child(attribute, 'astroDirectOrdinary') : undefined
          classes = [{ tokens: [], guard: {} }]
          if (ordinary) write(ordinary, true)
          write(attribute, isList)
          const candidates = classes
          const expressionOf = (item: Ast) => {
            const value = child(item, 'value')
            return value && (child(value, 'expression') ?? value)
          }
          let emission: AttributeAlternative[] | undefined
          const next: Guard[] = []
          for (const candidate of candidates) {
            const values: AttributeAlternative[] = candidate.tokens.length
              ? [{ value: ' ', range: range(attribute), guard: {} }]
              : (emission ??= (() => {
                  const expression = expressionOf(attribute),
                    context = expressionContext(expression ?? attribute)
                  const values = isList
                    ? astroListEmission(expression, context)
                    : evaluateAttributeExpression(expression, context)
                  if (!ordinary) return values
                  const prefix = expressionOf(ordinary),
                    prefixContext = expressionContext(prefix ?? ordinary)
                  const combined: AttributeAlternative[] = []
                  for (const left of astroListEmission(prefix, prefixContext))
                    for (const right of values) {
                      const guard = combineGuards(left.guard, right.guard)
                      if (!guard) continue
                      const value = left.value ?? right.value
                      combined.push({
                        range: range(attribute),
                        guard,
                        ...(value === undefined ? { unresolved: left.unresolved || right.unresolved } : { value })
                      })
                      if (combined.length > 256) return [{ range: range(attribute), guard: {}, unresolved: true }]
                    }
                  return combined
                })())
            for (const parent of pending)
              for (const value of values) {
                const own = combineGuards(candidate.guard, value.guard),
                  guard = own && combineGuards(parent, own)
                if (!guard) continue
                if (value.unresolved)
                  selected.push({
                    ...candidate,
                    guard,
                    ownerUnknown: true,
                    unresolved: candidate.unresolved ?? value.range
                  })
                else if (value.value !== undefined) selected.push({ ...candidate, guard })
                else if (candidate.unresolved) selected.push({ ...candidate, guard })
                else next.push(guard)
              }
          }
          if (next.length + selected.length > 256) {
            selected.splice(0, selected.length, {
              tokens: [],
              guard: {},
              ownerUnknown: true,
              unresolved: range(attribute)
            })
            pending = []
            break
          }
          pending = next
        }
        classes = [...selected, ...pending.map((guard) => ({ tokens: [], guard }))]
        const inspected = new Set([
          ...classRules.policy.variant.dataKeys,
          classRules.policy.state.dataKey,
          ...classRules.policy.state.ariaKeys,
          ...(tag === 'input' &&
          namespace === 'http://www.w3.org/1999/xhtml' &&
          classRules.htmlLint.classlessTagCheck &&
          !classRules.htmlLint.classlessTagAllowlist.has('input') &&
          classes.some((value) => !value.tokens.length && !value.unresolved && !value.ownerUnknown)
            ? ['type']
            : [])
        ])
        const first = new Map<string, MarkupAttribute[]>()
        for (const attribute of attributes) {
          const group = first.get(attribute.name)
          if (!group) first.set(attribute.name, [attribute])
          else if (inspected.has(attribute.name)) group.push(attribute)
        }
        attributes.splice(
          0,
          attributes.length,
          ...[...first.values()].map((group) => {
            if (!inspected.has(group[0].name)) return group[0]
            const events = [
              ...group.map((attribute) => ({
                start: nativeAttributeStarts.get(attribute) ?? attribute.range[0],
                values: (
                  attribute.alternatives ?? [{ value: attribute.value, range: attribute.valueRange, guard: {} }]
                ).map((value) => ({ ...value, attributeRange: attribute.range }))
              })),
              ...astro.transfers.map((transfer) => ({
                start: transfer[0],
                values: [{ range: transfer, guard: {}, unresolved: true, overwrittenBy: transfer }]
              }))
            ].sort((a, b) => a.start - b.start)
            return { ...group[0], alternatives: firstAstroEmission(events.map((event) => event.values)) }
          })
        )
      }
      document.outOfScope += astro.transfers.length
      unknownSpreads = astro.transfers.length
      if (component) {
        if (astro.transfers.length) classes = classes.map((alternative) => ({ ...alternative, ownerUnknown: true }))
        for (const attribute of attributes) {
          const transfer = astro.transfers.find((transfer) => transfer[0] > attribute.range[0])
          if (transfer) attribute.overwrittenBy = transfer
        }
      }
    }
    if (
      !astro &&
      !component &&
      tag === 'input' &&
      unknownInputType &&
      namespace === 'http://www.w3.org/1999/xhtml' &&
      classRules.htmlLint.classlessTagCheck &&
      !classRules.htmlLint.classlessTagAllowlist.has('input') &&
      classes.some((value) => !value.tokens.length && !value.unresolved && !value.ownerUnknown)
    )
      attributes.push({
        name: 'type',
        value: '',
        range: unknownInputType,
        valueRange: unknownInputType,
        alternatives: [
          { range: unknownInputType, guard: {}, unresolved: true, winnerUnknown: true, overwrittenBy: unknownInputType }
        ]
      })
    if (component && unknownSpreads === 0 && classes.some((value) => value.unresolved)) document.outOfScope += 1
    const sourceChildren = list(node, 'children')
    const childNamespace = markupChildNamespace(namespace, String(tag), attributes)
    const hasNestedChildren = sourceChildren.some(
      (item) => item.type !== 'JSXText' || Boolean(item.value?.toString().trim())
    )
    const children =
      !component && explicitChildren && !hasNestedChildren
        ? buildExpression(explicitChildren, false, depth + 1, childNamespace)
        : sourceChildren.flatMap((item) => {
            if (isJsx(item)) return build(item, false, depth + 1, childNamespace)
            if (item.type !== 'JSXExpressionContainer') return []
            const initializer = linked.get(item)
            return initializer
              ? build(initializer, false, depth + 1, childNamespace)
              : buildExpression(child(item, 'expression'), false, depth + 1, childNamespace)
          })
    return [
      {
        tag,
        range: range(node),
        openRange: range(opening),
        classes,
        attributes,
        children,
        component,
        rootRule,
        ...(semantics === 'astro' ? { namespace } : {})
      }
    ]
  }
  const handledExpressions = new Set<Ast>()
  for (const node of all) {
    if (!isJsx(node) || linkedInitializers.has(node) || builtNodes.has(node)) continue
    if (semantics === 'astro' && node.type !== 'AstroFragment') {
      let template = parents.get(node)
      while (template && template.type !== 'AstroFragment' && !template.astroUnverified)
        template = parents.get(template)
      if (template?.astroUnverified) continue
      if (!template) continue
    }
    let parent = parents.get(node)
    let insideJsx = false
    let detached = false
    while (parent) {
      if (parent.type === 'JSXAttribute' || parent.type === 'JSXSpreadAttribute') detached = true
      if (isJsx(parent)) {
        insideJsx = true
        break
      }
      parent = parents.get(parent)
    }
    if (insideJsx && !detached) continue
    let candidate = node
    parent = parents.get(candidate)
    while (
      parent &&
      [
        'ConditionalExpression',
        'LogicalExpression',
        'ArrayExpression',
        'TSAsExpression',
        'TSNonNullExpression',
        'ParenthesizedExpression'
      ].includes(parent.type)
    ) {
      candidate = parent
      parent = parents.get(parent)
    }
    if (handledExpressions.has(candidate)) continue
    handledExpressions.add(candidate)
    let fn = parent
    while (fn && !isFunction(fn)) fn = parents.get(fn)
    const callback = fn && parents.get(fn)?.type === 'CallExpression'
    const returned = Boolean(
      !detached &&
      !callback &&
      (parent?.type === 'ReturnStatement' ||
        (parent?.type === 'ArrowFunctionExpression' && child(parent, 'body') === candidate))
    )
    const roots = buildExpression(
      candidate,
      mode === 'root' && (returned || (!fn && parent?.type === 'ExpressionStatement')),
      0
    )
    if (!returned)
      for (const element of roots) {
        element.ancestryUnknown = true
        const declaration = parents.get(node)
        if (declaration && childReferences.has(declaration)) element.relationUnknown = range(node)
      }
    if (detached) {
      document.outOfScope += roots.length
      for (const element of roots) element.detached = true
    }
    document.roots.push(...roots)
  }
  if (semantics === 'astro') {
    document.checkRootCount = !uncertainAstroTree
    for (const element of document.roots) {
      if (element.detached) continue
      element.rootRule = mode === 'root'
      element.ancestryUnknown = false
      element.relationUnknown = undefined
    }
  }
  applyMarkupNamespaces(document.roots)
  return document
}
