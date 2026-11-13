import { parse as parseVue, parserOptions } from '@vue/compiler-dom'
import { parse as parseScript, parseExpression } from '@babel/parser'
import { createMarkupRuleContext, type HtmlLintMode } from '../../generator-core'
import { htmlClassTokens } from '../class-values'
import {
  composeClassAlternatives,
  combineGuards,
  conditionBranches,
  evaluateAttributeExpression,
  evaluateClassExpression,
  effectiveListProperties,
  patternBindingNames,
  type ExpressionContext,
  type ExpressionNode
} from '../expressions'
import { SourceIndex, type SourceRange } from '../source'
import type { Guard, MarkupAttribute, MarkupConfig, MarkupDocument, MarkupElement } from '../types'

type Location = { start: { offset: number }; end: { offset: number }; source: string }
type VueExpression = { content: string; loc: Location; ast?: ExpressionNode | null | false; astOffset?: number }
type VueProperty = {
  type: number
  name: string
  loc: Location
  value?: { content: string; loc: Location }
  exp?: VueExpression
  arg?: { content: string; isStatic?: boolean; loc?: Location }
  modifiers?: Array<{ content: string }>
  forParseResult?: { value?: VueExpression; key?: VueExpression; index?: VueExpression }
}
type VueNode = {
  type: number
  tag?: string
  tagType?: number
  ns?: number
  content?: string
  props?: VueProperty[]
  children?: VueNode[]
  loc: Location
  innerLoc?: Location
  bindings?: string[]
}
type ScriptStatement = {
  type: string
  range?: SourceRange
  importKind?: string
  id?: ExpressionNode
  declarations?: Array<{ id: ExpressionNode }>
  declaration?: ScriptStatement
  source?: { value: string }
  specifiers?: Array<{ type: string; importKind?: string; local: { name: string }; imported?: { name?: string } }>
}
const classHelperNames = (statement: ScriptStatement): string[] =>
  statement.type === 'ImportDeclaration' &&
  statement.importKind !== 'type' &&
  ['clsx', 'classnames'].includes(statement.source?.value ?? '')
    ? (statement.specifiers ?? [])
        .filter(
          (specifier) =>
            specifier.importKind !== 'type' &&
            (specifier.type === 'ImportDefaultSpecifier' ||
              (specifier.type === 'ImportSpecifier' && ['default', 'clsx'].includes(specifier.imported?.name ?? '')))
        )
        .map((specifier) => specifier.local.name)
    : []
const scriptBindings = (statement: ScriptStatement): string[] =>
  statement.declaration
    ? scriptBindings(statement.declaration)
    : statement.type === 'ImportDeclaration' && statement.importKind !== 'type' && statement.importKind !== 'typeof'
      ? (statement.specifiers ?? [])
          .filter((specifier) => specifier.importKind !== 'type' && specifier.importKind !== 'typeof')
          .map((specifier) => specifier.local.name)
      : statement.type === 'VariableDeclaration'
        ? (statement.declarations ?? []).flatMap((item) => patternBindingNames(item.id))
        : ['FunctionDeclaration', 'ClassDeclaration', 'TSEnumDeclaration', 'TSModuleDeclaration'].includes(
              statement.type
            ) && statement.id?.name
          ? [statement.id.name]
          : []
const sourceRange = (location: Location): SourceRange => [location.start.offset, location.end.offset]
const sfcBlock = (tag: string): boolean => ['template', 'script', 'style'].includes(tag)
/** A custom-block-first source is an SFC when it has an SFC block and no native top-level element. */
const customFirstSfc = (tags: string[]): boolean =>
  tags.some(sfcBlock) && tags.every((tag) => sfcBlock(tag) || !parserOptions.isNativeTag?.(tag))

export function parseVueSource(source: string, mode: HtmlLintMode, config: MarkupConfig): MarkupDocument {
  let sfc = /^\s*(?:<!--[\s\S]*?-->\s*)*<(?:template|script|style)(?:[\t\n\f\r >])/i.test(source)
  const firstTag = !sfc ? /^\s*(?:<!--[\s\S]*?-->\s*)*<([A-Za-z][^\t\n\f\r />]*)/.exec(source)?.[1] : undefined
  let parses = 0
  let errors: Array<{ message: string; loc?: Location }> = []
  const parse = (parseMode: 'sfc' | 'html') => {
    parses += 1
    errors = []
    return parseVue(source, {
      parseMode,
      prefixIdentifiers: true,
      onError: (error) => errors.push(error)
    })
  }
  let ast = parse(sfc || (firstTag && !parserOptions.isNativeTag?.(firstTag)) ? 'sfc' : 'html')
  if (!sfc && firstTag && !parserOptions.isNativeTag?.(firstTag)) {
    const elements = ast.children.filter((node) => node.type === 1)
    sfc = customFirstSfc(elements.map((node) => node.tag))
    if (!sfc) ast = parse('html')
  }
  if (errors.length) {
    const { message, loc } = errors[0]
    throw Object.assign(new SyntaxError(message), {
      ...(loc ? { sourceRange: sourceRange(loc) } : {}),
      markupMetrics: { markupParses: parses }
    })
  }
  const document = adaptVueDomAst(source, ast as unknown as VueNode, mode, config, sfc, false)
  document.index.metrics.markupParses = parses
  return document
}

export function adaptVueDomAst(
  source: string,
  root: VueNode,
  _mode: HtmlLintMode,
  config: MarkupConfig,
  sfc: boolean,
  supplied: boolean,
  suppliedHelpers: readonly string[] = [],
  suppliedBindings: readonly string[] = []
): MarkupDocument {
  const index = new SourceIndex(source)
  const classRules = createMarkupRuleContext(config)
  const document: MarkupDocument = { roots: [], issues: [], index, outOfScope: 0 }
  const forwarded = new Set<number>()
  const helpers = new Set<string>(suppliedHelpers)
  const bindings = new Set<string>(suppliedBindings)
  if (sfc && !supplied)
    for (const script of root.children ?? [])
      if (script.tag === 'script' && script.props?.some((attribute) => attribute.name === 'setup')) {
        index.metrics.scriptParses += 1
        const lang = script.props?.find((attribute) => attribute.name === 'lang')?.value?.content
        let program
        try {
          program = parseScript(script.innerLoc?.source ?? '', {
            sourceType: 'module',
            plugins: lang === 'tsx' || lang === 'jsx' ? ['typescript', 'jsx'] : ['typescript']
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            error.message = error.message.replace(/\s*\(\d+:\d+\)$/, '')
            if ('pos' in error && typeof error.pos === 'number') {
              const offset = (script.innerLoc?.start.offset ?? 0) + error.pos
              Object.assign(error, { sourceRange: [offset, offset] })
            }
          }
          throw error
        }
        for (const statement of program.program.body) {
          for (const name of scriptBindings(statement as unknown as ScriptStatement)) bindings.add(name)
          for (const name of classHelperNames(statement as unknown as ScriptStatement)) helpers.add(name)
        }
      }
  const expression = (
    value: VueExpression,
    shadowed: ReadonlyMap<string, string> = new Map()
  ): { node: ExpressionNode; context: ExpressionContext } => {
    const offset = value.astOffset ?? (value.ast ? value.loc.start.offset - 1 : value.loc.start.offset)
    const context: ExpressionContext = {
      index,
      offset,
      scope: 'vue',
      bindingKey: (name) => shadowed.get(name) ?? `vue:${name}`,
      isUnbound: (name) => !shadowed.has(name) && !bindings.has(name),
      classifyBase: classRules.classify,
      inertClassExtra: classRules.inertClassExtra,
      helpers: new Set([...helpers].filter((name) => !shadowed.has(name))),
      members: config.jsxClassBindings?.memberAccessAllowlist
    }
    if (!supplied && value.ast && typeof value.ast === 'object') index.metrics.expressionParses += 1
    if (!supplied && value.content !== source.slice(...sourceRange(value.loc)))
      return {
        node: { type: 'UnknownExpression', start: 0, end: value.loc.end.offset - value.loc.start.offset },
        context: { ...context, offset: value.loc.start.offset }
      }
    if (value.ast && typeof value.ast === 'object') return { node: value.ast, context }
    const text = value.content
    const end = value.loc.end.offset - value.loc.start.offset
    let node: ExpressionNode = { type: 'UnknownExpression', start: 0, end }
    if (/^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(text))
      node = { type: 'Identifier', name: text, start: 0, end }
    if (text === 'true' || text === 'false') node = { type: 'BooleanLiteral', value: text === 'true', start: 0, end }
    if (text === 'null') node = { type: 'NullLiteral', value: null, start: 0, end }
    return { node, context }
  }
  const children = (
    nodes: VueNode[],
    inherited: Guard,
    depth: number,
    shadowed: ReadonlyMap<string, string> = new Map()
  ): MarkupElement[] => {
    const result: MarkupElement[] = []
    let remaining: Guard[] | undefined
    for (const node of nodes) {
      if (node.type !== 1) {
        if (node.type === 2 && node.content?.trim()) remaining = undefined
        continue
      }
      const directive = node.props?.find(
        (property) => ['if', 'else-if', 'else'].includes(property.name) && property.type === 7
      )
      if (!directive) {
        remaining = undefined
        result.push(...convert(node, inherited, depth, shadowed))
        continue
      }
      if (directive.name === 'if') remaining = [inherited]
      if (!remaining) {
        document.issues.push({
          code: 'SOURCE_RELATION_UNRESOLVED',
          kind: 'unresolved',
          message: 'Vue conditional branch has no matching preceding v-if.',
          baseClass: '',
          path: [],
          range: sourceRange(directive.loc)
        })
        continue
      }
      if (directive.name === 'else') {
        for (const guard of remaining) result.push(...convert(node, guard, depth, shadowed))
        remaining = undefined
        continue
      }
      if (!directive.exp) continue
      const condition = expression(directive.exp, shadowed)
      const next: Guard[] = []
      for (const guard of remaining)
        for (const branch of conditionBranches(condition.node, condition.context)) {
          const combined = combineGuards(guard, branch.guard)
          if (!combined) continue
          if (branch.when) result.push(...convert(node, combined, depth, shadowed))
          else next.push(combined)
        }
      remaining = next
    }
    return result
  }
  const convert = (
    node: VueNode,
    guard: Guard,
    depth: number,
    inheritedShadow: ReadonlyMap<string, string>
  ): MarkupElement[] => {
    if (depth > 256) {
      document.issues.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Source traversal exceeded the implementation safety limit of 256 nested elements.',
        baseClass: '',
        path: [],
        range: sourceRange(node.loc)
      })
      return []
    }
    const shadowed = new Map(inheritedShadow)
    for (const name of node.bindings ?? []) shadowed.set(name, `vue@${node.loc.start.offset}:${name}`)
    if (!supplied)
      for (const property of node.props ?? []) {
        const parameters =
          property.name === 'for'
            ? [property.forParseResult?.value, property.forParseResult?.key, property.forParseResult?.index].filter(
                (value): value is VueExpression => Boolean(value?.content)
              )
            : property.name === 'slot' && property.exp
              ? [property.exp]
              : []
        for (const parameter of parameters) {
          let bindings = parameter.ast ? patternBindingNames(parameter.ast) : []
          if (!bindings.length) {
            index.metrics.expressionParses += 1
            bindings = patternBindingNames(
              parseExpression(`(${parameter.content})=>0`, { plugins: ['typescript'] }) as unknown as ExpressionNode
            )
          }
          for (const name of bindings) shadowed.set(name, `vue@${node.loc.start.offset}:${name}`)
        }
      }
    if (node.tag === 'template') return children(node.children ?? [], guard, depth + 1, shadowed)
    const htmlNative = node.tagType !== 1 && !node.ns
    // HTML attribute names are ASCII-case-insensitive; components and foreign elements keep written keys.
    const keyOf = (raw: string) => (htmlNative ? raw.replace(/[A-Z]/g, (letter) => letter.toLowerCase()) : raw)
    const attributes: MarkupAttribute[] = []
    let classes = [{ tokens: [], guard: {} }] as MarkupElement['classes']
    const scalarKeys = new Set([
      ...classRules.policy.variant.dataKeys,
      classRules.policy.state.dataKey,
      ...classRules.policy.state.ariaKeys,
      ...(node.tag === 'input' ? ['type'] : [])
    ])
    const groupKeys = new Set<string>()
    const writtenKeys = new Map<string, string>()
    const addAttribute = (raw: string, attribute: Omit<MarkupAttribute, 'name'>) => {
      const name = keyOf(raw)
      const previous = writtenKeys.get(name)
      writtenKeys.set(name, raw)
      attributes.push({
        ...attribute,
        name,
        ...(scalarKeys.has(name) && previous !== undefined && previous !== raw
          ? { valueRange: attribute.range, alternatives: [{ range: attribute.range, guard: {}, unresolved: true }] }
          : {})
      })
    }
    // Vue normalizes a class list only for the exact compiled key `class`.
    const plainClassKey = (property: VueProperty) => {
      const raw =
        property.type === 6
          ? property.name
          : property.name === 'bind' && property.arg?.isStatic
            ? property.arg.content
            : undefined
      return (
        raw !== undefined &&
        keyOf(raw) === 'class' &&
        (raw !== 'class' ||
          (property.type === 7 &&
            Boolean(property.modifiers?.some((modifier) => ['prop', 'attr'].includes(modifier.content)))))
      )
    }
    const wholeBindings = new Map(
      (node.props ?? [])
        .filter((property) => property.name === 'bind' && !property.arg)
        .map((property) => [property, property.exp && expression(property.exp, shadowed)] as const)
    )
    for (const [property, value] of wholeBindings)
      if (
        value &&
        (value.node.type === 'NullLiteral' ||
          (value.node.type === 'Literal' && value.node.value === null) ||
          (value.node.type === 'Identifier' &&
            value.node.name === 'undefined' &&
            value.context.isUnbound?.('undefined')))
      )
        wholeBindings.delete(property)
    const mayContributeClass = (property: VueProperty) => {
      const value = wholeBindings.get(property)
      const properties = value?.node ? effectiveListProperties(value.node) : undefined
      return (
        !properties ||
        properties.some((prop) => {
          const raw = prop.key?.name ?? prop.key?.value
          return typeof raw === 'string' && keyOf(raw) === 'class'
        })
      )
    }
    const unknownBinding = node.props?.some(
      (property) =>
        plainClassKey(property) ||
        (property.name === 'bind' &&
          (property.arg?.isStatic === false || (wholeBindings.has(property) && mayContributeClass(property))))
    )
    for (const property of node.props ?? []) {
      if (plainClassKey(property)) {
        classes = classes.map((value) => ({ ...value, ownerUnknown: true, unresolved: sourceRange(property.loc) }))
        continue
      }
      // Same-name shorthand is an unknown identifier, not an absent binding.
      const boundExpression =
        property.exp ??
        (property.name === 'bind' && property.arg?.isStatic && property.arg.loc
          ? {
              content: property.arg.content.replace(/-(\w)/g, (_match, letter: string) => letter.toUpperCase()),
              loc: property.arg.loc
            }
          : undefined)
      if (property.type === 6) {
        if (scalarKeys.has(keyOf(property.name))) {
          if (groupKeys.has(property.name)) continue
          groupKeys.add(property.name)
        }
        const rawRange = property.value
          ? sourceRange(property.value.loc)
          : ([property.loc.end.offset, property.loc.end.offset] as SourceRange)
        const quote = source[rawRange[0]]
        const valueRange: SourceRange = quote === '"' || quote === "'" ? [rawRange[0] + 1, rawRange[1] - 1] : rawRange
        addAttribute(property.name, {
          value: property.value?.content ?? '',
          range: sourceRange(property.loc),
          valueRange
        })
        if (property.name === 'class')
          classes = composeClassAlternatives(
            classes,
            { index, offset: 0, scope: 'vue', helpers, members: undefined, classifyBase: classRules.classify },
            () => [{ tokens: htmlClassTokens(source.slice(...valueRange), valueRange[0]), guard: {} }],
            true
          )
      } else if (property.name === 'bind' && property.arg?.isStatic === false) {
        classes = classes.map((value) => ({ ...value, unresolved: sourceRange(property.loc) }))
      } else if (property.name === 'bind' && property.arg?.content === 'class' && boundExpression) {
        const value = expression(boundExpression, shadowed)
        const context = unknownBinding ? { ...value.context, inertClassExtra: undefined } : value.context
        classes = composeClassAlternatives(
          classes,
          context,
          (prefix) => evaluateClassExpression(value.node, context, 'list', 0, prefix),
          true,
          !unknownBinding
        )
      } else if (property.name === 'bind' && !property.arg) {
        // A mergeProps boundary is distinct from duplicates in one props object.
        groupKeys.clear()
        if (!wholeBindings.has(property)) continue
        const value = wholeBindings.get(property)
        const properties = value?.node ? effectiveListProperties(value.node) : undefined
        if (properties && value) {
          for (const prop of properties) {
            const raw = prop.key?.name ?? prop.key?.value
            if (typeof raw !== 'string' || !scalarKeys.has(keyOf(raw))) continue
            addAttribute(raw, {
              value: '',
              range: sourceRange(property.loc),
              valueRange: sourceRange(property.exp!.loc),
              alternatives: evaluateAttributeExpression(prop.value as ExpressionNode, value.context)
            })
          }
        }
        if (mayContributeClass(property))
          classes = classes.map((value) => ({ ...value, unresolved: sourceRange(property.loc) }))
      } else if (property.name === 'bind' && property.arg && boundExpression) {
        if (scalarKeys.has(keyOf(property.arg.content))) {
          if (groupKeys.has(property.arg.content)) continue
          groupKeys.add(property.arg.content)
        }
        const value = expression(boundExpression, shadowed)
        addAttribute(property.arg.content, {
          value: '',
          range: sourceRange(property.loc),
          valueRange: sourceRange(boundExpression.loc),
          alternatives: evaluateAttributeExpression(value.node, value.context)
        })
      }
    }
    const start = node.loc.start.offset
    // The compiler's element range is original UTF-16; the opening boundary is
    // used only as an element-level fallback, never as a token source lookup.
    let openingEnd = start
    let quote = ''
    while (openingEnd < node.loc.end.offset) {
      const character = source[openingEnd++]
      if (quote) {
        if (character === quote) quote = ''
      } else if (character === '"' || character === "'") quote = character
      else if (character === '>') break
    }
    if (node.tagType === 1 && classes.some((value) => value.unresolved)) forwarded.add(start)
    return [
      {
        tag: node.tag ?? '',
        range: sourceRange(node.loc),
        openRange: [start, openingEnd],
        classes,
        attributes,
        children: children(node.children ?? [], guard, depth + 1, shadowed),
        guard,
        namespace:
          node.ns === 1
            ? 'http://www.w3.org/2000/svg'
            : node.ns === 2
              ? 'http://www.w3.org/1998/Math/MathML'
              : 'http://www.w3.org/1999/xhtml',
        component: node.tagType === 1
      }
    ]
  }
  const templates = sfc ? (root.children?.filter((node) => node.tag === 'template') ?? []) : [root]
  if (sfc && !templates.length) document.checkRootCount = false
  for (const template of templates) {
    if (
      template.props?.some(
        (property) => property.name === 'src' || (property.name === 'lang' && property.value?.content !== 'html')
      )
    ) {
      document.checkRootCount = false
      document.issues.push({
        code: 'FORMAT_UNSUPPORTED',
        kind: 'unsupported',
        message: 'External or preprocessed Vue templates require an explicit supported source adapter.',
        baseClass: '',
        path: [],
        range: sourceRange(template.loc)
      })
    } else document.roots.push(...children(template.children ?? [], {}, 0))
  }
  document.outOfScope = forwarded.size
  return document
}

type SuppliedVue = {
  type: string
  range: SourceRange
  name?: string | { name: string }
  rawName?: string
  namespace?: string
  value?: string | SuppliedVue
  directive?: boolean
  key?: SuppliedVue & { argument?: SuppliedVue; modifiers?: Array<{ name: string }> }
  expression?: ExpressionNode
  startTag?: { range: SourceRange; attributes: SuppliedVue[]; selfClosing?: boolean }
  endTag?: { range: SourceRange } | null
  children?: SuppliedVue[]
  templateBody?: SuppliedVue
  variables?: Array<{ id: { name: string } }>
  body?: ScriptStatement[]
  errors?: Array<{ code?: string; index: number; message: string }>
}

/** Normalize vue-eslint-parser's existing template/expression AST without parsing it. */
export function adaptVueAst(
  source: string,
  supplied: unknown,
  mode: HtmlLintMode,
  config: MarkupConfig,
  suppliedFragment?: unknown
): MarkupDocument {
  const program = supplied as SuppliedVue
  const template =
    program?.templateBody ??
    (suppliedFragment as SuppliedVue | undefined)?.children?.find(
      (node) => node.type === 'VElement' && node.name === 'template'
    )
  if (!template) {
    const tags = ((suppliedFragment as SuppliedVue | undefined)?.children ?? [])
      .filter((node) => node.type === 'VElement')
      .flatMap((node) => typeof node.name === 'string' ? [node.rawName ?? node.name] : [])
    if (
      program?.type === 'Program' &&
      'templateBody' in program &&
      (/^\s*(?:<!--[\s\S]*?-->\s*)*<(?:script|style)(?:[\t\n\f\r >])/i.test(source) || customFirstSfc(tags))
    )
      return { roots: [], issues: [], index: new SourceIndex(source), outOfScope: 0, checkRootCount: false }
    throw Object.assign(new Error('Unsupported supplied Vue AST family; configure vue-eslint-parser.'), {
      code: 'PARSER_UNAVAILABLE'
    })
  }
  const elements: SuppliedVue[] = []
  const pending = [template]
  while (pending.length) {
    const node = pending.pop()!
    if (node.type === 'VElement') elements.push(node)
    pending.push(...(node.children ?? []))
  }
  const records = (template.errors ?? []).filter(
    (error) => error.index >= template.range[0] && error.index <= template.range[1]
  )
  const syntax = records
    .filter((error) => {
      if (error.code !== 'duplicate-attribute') return error.code === 'eof-in-tag'
      // The host folds names; Vue rejects only identical written keys.
      const written = (attribute: SuppliedVue) => (attribute.key ? source.slice(...attribute.key.range) : '')
      return !elements.some((element) => {
        const attributes = element.startTag?.attributes ?? []
        const position = attributes.findIndex((attribute) => attribute.range[0] === error.index)
        return (
          position >= 0 &&
          attributes.slice(0, position).every((prior) => written(prior) !== written(attributes[position]))
        )
      })
    })
    .sort((left, right) => left.index - right.index)[0]
  if (syntax) throw Object.assign(new SyntaxError(syntax.message), { sourceRange: [syntax.index, syntax.index] })
  const boundary: MarkupDocument = {
    roots: [],
    issues: [],
    index: new SourceIndex(source),
    outOfScope: 0,
    checkRootCount: false
  }
  for (const element of elements.sort((left, right) => left.range[0] - right.range[0])) {
    const name = element.rawName ?? (typeof element.name === 'string' ? element.name : '')
    if (!element.startTag || element.startTag.selfClosing || element.endTag || parserOptions.isVoidTag?.(name)) continue
    const reason =
      'Supplied Vue AST tag boundary is unresolved: the supplied tree ends this element without an explicit end tag (a missing end tag, or an HTML implied close such as a block element inside <p>).'
    boundary.issues.push({
      code: 'SOURCE_RELATION_UNRESOLVED',
      kind: 'unresolved',
      message: reason,
      reason,
      baseClass: '',
      path: [],
      range: element.startTag.range
    })
  }
  for (const error of records) {
    if (error.code !== 'x-invalid-end-tag') continue
    // Read only the tag name at the host's anchor; do not rediscover tags.
    const name = /^<\/([^\t\n\f\r />]+)/.exec(source.slice(error.index))?.[1]
    if (name && parserOptions.isVoidTag?.(name)) continue
    const reason =
      'Supplied Vue AST tag boundary is unresolved: this end tag matches no open element in the supplied tree (a stray end tag, or its element was implicitly closed earlier).'
    boundary.issues.push({
      code: 'SOURCE_RELATION_UNRESOLVED',
      kind: 'unresolved',
      message: reason,
      reason,
      baseClass: '',
      path: [],
      range: [error.index, error.index]
    })
  }
  if (boundary.issues.length) return boundary
  const location = (range: SourceRange): Location => ({
    start: { offset: range[0] },
    end: { offset: range[1] },
    source: source.slice(...range)
  })
  const convert = (node: SuppliedVue): VueNode => {
    const tag = typeof node.name === 'string' ? (node.rawName ?? node.name) : undefined
    const props: VueProperty[] = (node.startTag?.attributes ?? []).map((attribute) => {
      const value = attribute.value && typeof attribute.value === 'object' ? attribute.value : undefined
      if (!attribute.directive)
        return {
          type: 6,
          name: attribute.key?.rawName ?? (typeof attribute.key?.name === 'string' ? attribute.key.name : ''),
          loc: location(attribute.range),
          value: value ? { content: String(value.value ?? ''), loc: location(value.range) } : undefined
        }
      const name = typeof attribute.key?.name === 'object' ? attribute.key.name.name : ''
      const argument = attribute.key?.argument
      const rawRange = value?.range
      const quote = rawRange && source[rawRange[0]]
      const quoted = quote === '"' || quote === "'"
      const expressionRange: SourceRange = rawRange
        ? quoted
          ? [rawRange[0] + 1, source[rawRange[1] - 1] === quote ? rawRange[1] - 1 : rawRange[1]]
          : rawRange
        : attribute.range
      return {
        type: 7,
        name,
        loc: location(attribute.range),
        modifiers: attribute.key?.modifiers?.map((modifier) => ({ content: modifier.name })),
        arg:
          argument && typeof argument.name === 'string'
            ? {
                content: argument.rawName ?? argument.name,
                isStatic: argument.type === 'VIdentifier',
                loc: location(argument.range)
              }
            : argument
              ? { content: '', isStatic: false }
              : undefined,
        exp: value
          ? {
              content: source.slice(...expressionRange),
              loc: location(expressionRange),
              ast: value.expression,
              astOffset: value.expression ? 0 : undefined
            }
          : undefined
      }
    })
    return {
      type: node.type === 'VElement' ? 1 : node.type === 'VText' ? 2 : 3,
      tag,
      tagType: tag && !['template', 'slot'].includes(tag) && !parserOptions.isNativeTag?.(tag) ? 1 : 0,
      ns: node.namespace?.includes('svg') ? 1 : node.namespace?.includes('MathML') ? 2 : 0,
      loc: location(node.range),
      props,
      children: (node.children ?? []).map(convert),
      bindings: node.variables?.map((variable) => variable.id.name)
    }
  }
  const setupRanges = ((suppliedFragment as SuppliedVue | undefined)?.children ?? [])
    .filter(
      (node) => node.type === 'VElement' && node.name === 'script' &&
        node.startTag?.attributes.some((attribute) => !attribute.directive && attribute.key?.name === 'setup')
    )
    .map((node) => node.range)
  const statements = (program.body ?? []).filter((statement) => {
    const range = statement.range
    return range && setupRanges.some(([start, end]) => range[0] >= start && range[1] <= end)
  })
  const helpers = statements.flatMap(classHelperNames)
  const root = convert(template)
  return adaptVueDomAst(source, root, mode, config, false, true, helpers, statements.flatMap(scriptBindings))
}
