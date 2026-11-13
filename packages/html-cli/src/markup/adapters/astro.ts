import { adaptJsxAst } from './jsx'
import { SourceIndex } from '../source'
import { readJsxBracedExpressionEnd } from '../../jsx-class-bindings'
import type { MarkupConfig, MarkupDocument } from '../types'
import { markupNamespace, markupChildNamespace } from '../namespaces'

import { parse } from '@babel/parser'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import type { convertToTSX } from '@astrojs/compiler' with { 'resolution-mode': 'import' }
type TSXResult = Awaited<ReturnType<typeof convertToTSX>>

export type AstroCompiler = {
  convertToTSX(
    source: string,
    options: { filename: string; sourcemap: 'external'; includeScripts: boolean; includeStyles: boolean }
  ): TSXResult
}
type RawAttribute = { name: string; start: number; end: number; valueStart: number; valueEnd: number; kind: string }
type TagInfo = { start: number; end: number; attributes: RawAttribute[]; selfClosing: boolean }
type AstNode = { type: string; start: number; end: number; range?: [number, number]; [key: string]: unknown }
const isAstNode = (value: unknown): value is AstNode =>
  Boolean(value && typeof value === 'object' && 'type' in value && typeof value.type === 'string')
const child = (node: AstNode, key: string): AstNode | undefined =>
  isAstNode(node[key]) ? (node[key] as AstNode) : undefined
const list = (node: AstNode, key: string): AstNode[] =>
  Array.isArray(node[key]) ? (node[key] as unknown[]).filter(isAstNode) : []
const nameOf = (value: unknown): string => {
  if (!isAstNode(value)) return ''
  if (value.type === 'JSXNamespacedName') return `${nameOf(value.namespace)}:${nameOf(value.name)}`
  if (value.type === 'JSXMemberExpression') return `${nameOf(value.object)}.${nameOf(value.property)}`
  return typeof value.name === 'string' ? value.name : typeof value.value === 'string' ? value.value : ''
}

function relationFailure(info?: TagInfo): Error {
  return Object.assign(
    new Error(
      'The original Astro closing boundary or source relation cannot be verified. Check expressions, comments and opening/closing correspondence' +
        (info ? ' in this range.' : ' in the original source.')
    ),
    {
      code: 'ASTRO_SOURCE_RELATION',
      ...(info ? { sourceRange: [info.start, info.end] } : {})
    }
  )
}

function templateEnd(source: string, start: number): number {
  let cursor = start + 1
  while (cursor < source.length) {
    if (source[cursor] === '\\') cursor += 2
    else if (source[cursor] === '`') return cursor + 1
    else if (source[cursor] === '$' && source[cursor + 1] === '{') {
      const end = readJsxBracedExpressionEnd(source, cursor + 1)
      if (!end) throw Object.assign(new SyntaxError('Unclosed Astro template literal.'), { pos: cursor })
      cursor = end
    } else cursor++
  }
  throw Object.assign(new SyntaxError('Unclosed Astro template literal.'), { pos: start })
}

function opening(source: string, start: number): TagInfo {
  if (source[start] !== '<') throw relationFailure()
  let cursor = start + 1
  while (cursor < source.length && !/[\t\n\f\r />]/.test(source[cursor])) cursor++
  const attributes: RawAttribute[] = []
  while (cursor < source.length) {
    while (/[\t\n\f\r ]/.test(source[cursor] ?? '') && cursor < source.length) cursor++
    if (source[cursor] === '>' || (source[cursor] === '/' && source[cursor + 1] === '>')) {
      return { start, end: cursor + (source[cursor] === '/' ? 2 : 1), attributes, selfClosing: source[cursor] === '/' }
    }
    const attributeStart = cursor
    if (source[cursor] === '{') {
      const end = readJsxBracedExpressionEnd(source, cursor)
      if (!end) throw Object.assign(new SyntaxError('Unclosed Astro shorthand or spread.'), { pos: cursor })
      attributes.push({
        name: source.slice(cursor + 1, end - 1).trim(),
        start: cursor,
        end,
        valueStart: cursor + 1,
        valueEnd: end - 1,
        kind: /^\s*\.\.\./.test(source.slice(cursor + 1, end - 1)) ? 'spread' : 'shorthand'
      })
      cursor = end
      continue
    }
    while (cursor < source.length && !/[\t\n\f\r =/>]/.test(source[cursor])) cursor++
    const name = source.slice(attributeStart, cursor)
    while (/[\t\n\f\r ]/.test(source[cursor] ?? '') && cursor < source.length) cursor++
    let valueStart = cursor,
      valueEnd = cursor,
      kind = 'empty'
    if (source[cursor] === '=') {
      cursor++
      while (/[\t\n\f\r ]/.test(source[cursor] ?? '') && cursor < source.length) cursor++
      valueStart = cursor
      if (source[cursor] === '"' || source[cursor] === "'") {
        kind = 'quoted'
        const quote = source[cursor++]
        while (cursor < source.length && source[cursor] !== quote) cursor++
        if (cursor === source.length)
          throw Object.assign(new SyntaxError('Unclosed Astro attribute.'), { pos: valueStart })
        cursor++
      } else if (source[cursor] === '{') {
        kind = 'expression'
        const end = readJsxBracedExpressionEnd(source, cursor)
        if (!end) throw Object.assign(new SyntaxError('Unclosed Astro attribute expression.'), { pos: cursor })
        cursor = end
      } else if (source[cursor] === '`') {
        kind = 'template'
        cursor = templateEnd(source, cursor)
      } else {
        kind = 'unquoted'
        while (cursor < source.length && !/[\t\n\f\r >]/.test(source[cursor])) cursor++
      }
      valueEnd = cursor
    }
    if (!name || cursor <= attributeStart) throw relationFailure()
    attributes.push({ name, start: attributeStart, end: cursor, valueStart, valueEnd, kind })
  }
  throw Object.assign(new SyntaxError('Unclosed Astro start tag.'), { pos: start })
}

/** One portable compiler conversion, one Babel parse, then the shared source rules. */
export function parseAstroSource(
  source: string,
  compiler: AstroCompiler,
  config: MarkupConfig,
  mode: 'root' | 'selection' = 'root'
): MarkupDocument {
  const metrics = { markupParses: 1, astroConversions: 1, generatedParses: 0, scriptParses: 0 }
  try {
    return parseConvertedAstroSource(source, compiler, config, mode, metrics)
  } catch (error) {
    if (error && typeof error === 'object') Object.assign(error, { markupMetrics: metrics })
    throw error
  }
}

function parseConvertedAstroSource(
  source: string,
  compiler: AstroCompiler,
  config: MarkupConfig,
  mode: 'root' | 'selection',
  metrics: { generatedParses: number; scriptParses: number }
): MarkupDocument {
  const converted = compiler.convertToTSX(source, {
    filename: 'spiracss-source.astro',
    sourcemap: 'external',
    includeScripts: false,
    includeStyles: false
  })
  const sourceIndex = new SourceIndex(source)
  const generatedIndex = new SourceIndex(converted.code)
  const map = new TraceMap({ ...converted.map, version: 3 })
  const optionalMapped = (offset: number) => {
    const loc = generatedIndex.location(offset)
    const position = originalPositionFor(map, { line: loc.line, column: loc.column - 1 })
    if (position.line === null || position.column === null) return undefined
    return (sourceIndex.lineStarts[position.line - 1] ?? 0) + position.column
  }
  const mapped = (offset: number) => {
    const position = optionalMapped(offset)
    if (position === undefined) throw new Error('Missing original Astro source mapping.')
    return position
  }
  const fatal = converted.diagnostics.find((item) => item.severity === 1)
  if (fatal)
    throw Object.assign(new SyntaxError(fatal.text), {
      pos:
        (sourceIndex.lineStarts[(fatal.location?.line ?? 1) - 1] ?? 0) + Math.max(0, (fatal.location?.column ?? 1) - 1)
    })
  let ast: AstNode
  const originalFrontmatter =
    source.split(/\r\n|\r|\n/, 1)[0].trim() === '---'
      ? sourceIndex.lineStarts.slice(1).find((start) => /^---[\t ]*(?:\r?\n|\r|$)/.test(source.slice(start)))
      : undefined
  metrics.generatedParses = 1
  try {
    ast = parse(converted.code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      ranges: true
    }) as unknown as AstNode
  } catch (error) {
    const offset =
      error && typeof error === 'object' && 'pos' in error && typeof error.pos === 'number'
        ? error.pos
        : converted.metaRanges.body.start
    const clean = (message: string) => message.replace(/ \(\d+:\d+\)$/, '')
    const frontStart = sourceIndex.lineStarts[1] ?? 3
    if (originalFrontmatter !== undefined) {
      const text = source.slice(frontStart, originalFrontmatter)
      const generatedFront = converted.code.slice(
        converted.metaRanges.frontmatter.start,
        converted.metaRanges.frontmatter.end
      )
      if (text.trim() && text.trim() === generatedFront.trim()) {
        const failures: Array<{ pos?: number; reasonCode?: string; message: string }> = []
        for (const plugins of [['typescript'], ['typescript', 'jsx']] as Array<
          ['typescript'] | ['typescript', 'jsx']
        >) {
          metrics.scriptParses++
          try {
            parse(text, {
              sourceType: 'module',
              plugins,
              allowReturnOutsideFunction: true,
              allowAwaitOutsideFunction: true
            })
            break
          } catch (failure) {
            failures.push(failure as { pos?: number; reasonCode?: string; message: string })
          }
        }
        const first = failures[0]
        if (
          failures.length === 2 &&
          first.reasonCode &&
          !/Missing.*Plugin|Requires.*Plugin/.test(first.reasonCode) &&
          failures.every((failure) => failure.pos === first.pos && failure.reasonCode === first.reasonCode)
        ) {
          const eof = first.pos === undefined || first.pos >= text.length
          throw Object.assign(
            new SyntaxError(clean(first.message)),
            eof ? { sourceRange: [frontStart, originalFrontmatter] } : { pos: frontStart + first.pos! }
          )
        }
      }
    }
    const originalOffset = mapped(offset)
    const reason = error && typeof error === 'object' && 'reasonCode' in error ? String(error.reasonCode) : ''
    if (
      offset >= converted.metaRanges.body.start &&
      offset < converted.metaRanges.body.end &&
      originalOffset >= 0 &&
      originalOffset < source.length &&
      source[originalOffset] === converted.code[offset] &&
      ['UnexpectedToken', 'UnterminatedString', 'UnterminatedTemplate', 'InvalidEscapeSequence'].includes(reason)
    )
      throw Object.assign(new SyntaxError(clean(error instanceof Error ? error.message : String(error))), {
        pos: originalOffset
      })
    throw Object.assign(
      new Error(
        'The generated Astro TSX cannot be parsed; the original expression syntax and a compiler conversion constraint cannot be distinguished.'
      ),
      { code: 'ASTRO_GENERATED_SYNTAX' }
    )
  }
  const body = converted.metaRanges.body
  const frontmatter = converted.metaRanges.frontmatter
  const program = child(ast, 'program')!
  const statements = list(program, 'body')
  const wrapper = statements.find((statement) => {
    const expression = child(statement, 'expression')
    return (
      statement.type === 'ExpressionStatement' &&
      expression?.type === 'JSXElement' &&
      expression.start < body.start &&
      expression.end >= body.end
    )
  })
  program.body = statements.filter(
    (statement) => statement === wrapper || (statement.start >= frontmatter.start && statement.end <= frontmatter.end)
  )
  if (wrapper) {
    const expression = child(wrapper, 'expression')!
    expression.type = 'AstroFragment'
    delete expression.openingElement
    delete expression.closingElement
    expression.children = list(expression, 'children').filter((node) => node.end > body.start && node.start < body.end)
  }
  const tags = new Map<number, TagInfo>()
  const associateAttributes = (attributes: AstNode[], info: TagInfo, open: AstNode): AstNode[] => {
    const exact = source.slice(info.start, info.end) === converted.code.slice(open.start, open.end)
    const anchorOf = (offset: number) => (exact ? info.start + offset - open.start : mapped(offset))
    const used = new Set<RawAttribute>()
    const restored: AstNode[] = []
    const take = (name: string, anchor: number, spread = false) => {
      const candidates = info.attributes.filter(
        (raw) =>
          !used.has(raw) &&
          (spread ? raw.kind === 'spread' : raw.name === name && raw.kind !== 'spread') &&
          anchor >= raw.start &&
          anchor < raw.end
      )
      if (candidates.length !== 1) throw relationFailure(info)
      used.add(candidates[0])
      return candidates[0]
    }
    for (const attribute of attributes) {
      const anchor = anchorOf(attribute.start)
      const originalSpread =
        attribute.type === 'JSXSpreadAttribute' &&
        info.attributes.some((raw) => raw.kind === 'spread' && anchor >= raw.start && anchor < raw.end)
      if (attribute.type !== 'JSXSpreadAttribute' || originalSpread) {
        const name = child(attribute, 'name')
        const raw = take(nameOf(name), name ? anchorOf(name.start) : anchor, originalSpread)
        attribute.originalAttribute = raw
        restored.push(attribute)
        continue
      }
      const object = child(attribute, 'argument')
      const properties = object && list(object, 'properties')
      if (object?.type !== 'ObjectExpression' || !properties?.length) throw relationFailure(info)
      for (const property of properties) {
        const key = child(property, 'key')
        const value = child(property, 'value')
        if (property.type !== 'ObjectProperty' || property.computed || key?.type !== 'StringLiteral' || !value)
          throw relationFailure(info)
        const raw = take(nameOf(key), anchorOf(key.start))
        restored.push({
          type: 'JSXAttribute',
          start: property.start,
          end: property.end,
          name: { type: 'JSXIdentifier', name: raw.name, start: key.start, end: key.end },
          value:
            raw.kind === 'empty'
              ? null
              : ['quoted', 'unquoted'].includes(raw.kind)
                ? value
                : { type: 'JSXExpressionContainer', start: value.start, end: value.end, expression: value },
          originalAttribute: raw
        })
      }
    }
    if (used.size !== info.attributes.length) throw relationFailure(info)
    return restored.sort(
      (a, b) => (a.originalAttribute as RawAttribute).start - (b.originalAttribute as RawAttribute).start
    )
  }
  // Establish local source evidence before attribute association can throw.
  // This is range verification of the compiler AST, never source-tree recovery.
  const generated: AstNode[] = [],
    parents = new Map<AstNode, AstNode>()
  const events: Array<{ node: AstNode; exit: boolean }> = []
  const sequenceChildren = new Set<AstNode>()
  const gather = [{ node: ast, exit: false }]
  while (gather.length) {
    const event = gather.pop()!,
      { node } = event
    events.push(event)
    if (event.exit) continue
    generated.push(node)
    gather.push({ node, exit: true })
    const descendants: AstNode[] = []
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range', 'tokens', 'comments', 'extra'].includes(key) || /Comments$/.test(key)) continue
      const children = Array.isArray(value) ? value.filter(isAstNode) : isAstNode(value) ? [value] : []
      for (const item of children) {
        parents.set(item, node)
        descendants.push(item)
        if (key === 'children') sequenceChildren.add(item)
      }
    }
    descendants.sort((a, b) => a.start - b.start || b.end - a.end)
    for (let i = descendants.length - 1; i >= 0; i--) gather.push({ node: descendants[i], exit: false })
  }
  const original = new Map<AstNode, TagInfo>(),
    closes = new Map<AstNode, number>()
  const generatedStarts = new Map(generated.map((node) => [node, node.start]))
  const closeStarts = new Map<AstNode, number>(),
    mappedCloses = new Map<AstNode, number>()
  const syntheticFragments = new Set<AstNode>(),
    invalidOpenings = new Set<AstNode>()
  const fragments = new Set(
    generated.filter((node) => node.type === 'JSXFragment' && node.start >= body.start && node.end <= body.end)
  )
  const omissions = new Set<AstNode>(),
    uncertainRelations = new Set<AstNode>(),
    affected = new Set<AstNode>()
  const firstBoundary = new Map<AstNode, AstNode>()
  const unresolved = (node: AstNode) => omissions.has(node) || uncertainRelations.has(node)
  const boundaryAncestor = (node: AstNode): AstNode | undefined => {
    let parent = parents.get(node)
    while (parent) {
      if (unresolved(parent)) return parent
      parent = parents.get(parent)
    }
    return undefined
  }
  const markBoundary = (node: AstNode, omitted = false) => {
    if (omitted) omissions.add(node)
    else uncertainRelations.add(node)
    node.astroPartialContext = true
    let parent = parents.get(node)
    while (parent) {
      if (parent.type === 'JSXElement' || fragments.has(parent)) {
        affected.add(parent)
        parent.astroPartialContext = true
        if (!firstBoundary.has(parent) || generatedStarts.get(firstBoundary.get(parent)!)! > generatedStarts.get(node)!)
          firstBoundary.set(parent, node)
      }
      parent = parents.get(parent)
    }
  }
  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
  ])
  const localizeFragment = (node: AstNode) => {
    let owner = parents.get(node)
    while (owner && (owner.type !== 'JSXElement' || !original.has(owner))) owner = parents.get(owner)
    if (!owner) throw relationFailure()
    markBoundary(owner)
    node.astroUnverified = true
  }
  const openingOwners = new Map<number, AstNode>()
  const tagOf = (node: AstNode) => (fragments.has(node) ? '' : nameOf(child(child(node, 'openingElement')!, 'name')))
  const nativeHtml = new Set<AstNode>(),
    childNamespaces = new Map<AstNode, string>()
  const direct = new Map<AstNode, AstNode[]>(),
    structuralOwner = new Map<AstNode, AstNode>()
  const anchors = new Map<AstNode, number>(),
    sequenceEnds = new Map<AstNode, number | undefined>()
  const verifiedEnds = new Map<AstNode, number>()
  const openingOffsets = new Map<AstNode, number>()
  let bodyStart =
    originalFrontmatter === undefined
      ? 0
      : originalFrontmatter + source.slice(originalFrontmatter).match(/^---[\t ]*(?:\r?\n|\r|$)/)![0].length
  if (/^<!doctype(?:[\t\n\f\r ]|>)/i.test(source.slice(bodyStart))) {
    const end = source.indexOf('>', bodyStart)
    if (end !== -1) bodyStart = end + 1
  }
  const skipSpace = (offset: number) => {
    while (offset < source.length && /[\t\n\f\r ]/.test(source[offset])) offset++
    return offset
  }
  const closeOwners = new Map<number, AstNode>(),
    verifiedRelations = new Set<AstNode>()
  const expressionTags: AstNode[][] = []
  for (const { node, exit } of events) {
    const parent = parents.get(node)
    if (!exit) {
      if (node.type === 'JSXExpressionContainer') expressionTags.push([])
      const parentOffset = parent && openingOffsets.get(parent)
      if (parentOffset !== undefined) openingOffsets.set(node, parentOffset)
      if (node.type === 'JSXOpeningElement' && parent && original.has(parent)) {
        const info = original.get(parent)!
        if (source.slice(info.start, info.end) === converted.code.slice(node.start, node.end))
          openingOffsets.set(node, info.start - node.start)
      }
      const owner = parent && structuralOwner.get(parent)
      let adjacent = parent && sequenceChildren.has(node) ? sequenceEnds.get(parent) : undefined
      if (adjacent === undefined && parent && !sequenceChildren.has(node)) {
        const anchor = anchors.get(parent)
        const prefix = converted.code.slice(parent.start, node.start)
        if (anchor !== undefined && source.slice(anchor, anchor + prefix.length) === prefix)
          adjacent = anchor + prefix.length
      }
      const anchor =
        node.type === 'AstroFragment'
          ? bodyStart
          : (adjacent ?? (node.start >= body.start && node.end <= body.end ? optionalMapped(node.start) : undefined))
      if (anchor !== undefined) anchors.set(node, anchor)
      const inherited = parent ? (childNamespaces.get(parent) ?? 'unknown') : 'http://www.w3.org/1999/xhtml'
      childNamespaces.set(node, inherited)
      const open = child(node, 'openingElement')
      const name = open && child(open, 'name')
      const mappedName = name && nameOf(name) === 'Fragment' ? mapped(name.start) : undefined
      // Compiler-only names map to 0, where a real tag name cannot start before its '<'.
      const synthetic =
        open && mappedName !== undefined && (mappedName === mapped(open.start) || mappedName === 0)
      if (synthetic) syntheticFragments.add(node)
      if (synthetic && expressionTags.length) expressionTags.at(-1)!.push(open)
      const boundary =
        fragments.has(node) ||
        (node.type === 'JSXElement' && !synthetic && node.end > body.start && node.start < body.end)
      if (boundary) structuralOwner.set(node, node)
      else if (owner && node.type !== 'JSXOpeningElement') structuralOwner.set(node, owner)
      if (boundary && owner) {
        const siblings = direct.get(owner) ?? []
        siblings.push(node)
        direct.set(owner, siblings)
      }
      if (node.type === 'AstroFragment') sequenceEnds.set(node, bodyStart)
      else if (synthetic) sequenceEnds.set(node, adjacent)
      if (!boundary) continue
      const fragment = fragments.has(node),
        openingNode = fragment ? child(node, 'openingFragment')! : open!
      const tag = fragment ? '' : nameOf(child(openingNode, 'name'))
      const candidates = [
        adjacent === undefined ? undefined : skipSpace(adjacent),
        mapped(openingNode.start),
        ...(fragment ? [mapped(openingNode.end) - 2] : [])
      ]
      const start = candidates.find(
        (point) =>
          point !== undefined &&
          point >= 0 &&
          (!owner || !original.has(owner) || point >= original.get(owner)!.end) &&
          (adjacent === undefined || point >= adjacent) &&
          !openingOwners.has(point) &&
          (fragment
            ? source.slice(point, point + 2) === '<>'
            : source[point] === '<' &&
              source.slice(point + 1, point + 1 + tag.length) === tag &&
              /[\t\n\f\r />]/.test(source[point + 1 + tag.length] ?? ''))
      )
      if (start === undefined) {
        if (fragment) localizeFragment(node)
        else invalidOpenings.add(node)
        continue
      }
      const info = fragment ? { start, end: start + 2, attributes: [], selfClosing: false } : opening(source, start)
      original.set(node, info)
      openingOwners.set(start, node)
      anchors.set(node, start)
      sequenceEnds.set(node, info.end)
      const namespace = markupNamespace(tag, inherited)
      if (namespace === 'http://www.w3.org/1999/xhtml' && !/^[A-Z]/.test(tag)) nativeHtml.add(node)
      childNamespaces.set(
        node,
        tag.toLowerCase() === 'annotation-xml' ? 'unknown' : markupChildNamespace(namespace, tag, [])
      )
      const close = child(node, fragment ? 'closingFragment' : 'closingElement')
      if (info.selfClosing || (!close && voidTags.has(tag))) {
        closes.set(node, info.end)
        closeStarts.set(node, info.end)
      } else mappedCloses.set(node, close ? mapped(close.start) : -1)
      continue
    }
    if (syntheticFragments.has(node) && expressionTags.length) {
      const close = child(node, 'closingElement')
      if (close) expressionTags.at(-1)!.push(close)
    }
    if (['JSXText', 'JSXExpressionContainer'].includes(node.type)) {
      const anchor = anchors.get(node)
      const fragmentTags = node.type === 'JSXExpressionContainer' ? expressionTags.pop()! : []
      for (const tag of fragmentTags) expressionTags.at(-1)?.push(tag)
      let spelling = converted.code.slice(node.start, node.end)
      if (anchor !== undefined) {
        if (source.slice(anchor, anchor + spelling.length) !== spelling) {
          if (node.type === 'JSXExpressionContainer') {
            if (child(node, 'expression')?.type === 'JSXEmptyExpression') {
              if (spelling.startsWith('{/**') && spelling.endsWith('*/}'))
                spelling = '<!--' + spelling.slice(4, -3) + '-->'
            } else if (fragmentTags.length) {
              let cursor = node.start
              spelling = ''
              for (const tag of fragmentTags) {
                spelling += converted.code.slice(cursor, tag.start)
                cursor = tag.end
              }
              spelling += converted.code.slice(cursor, node.end)
            }
          } else if (node.start < body.start && node.end > body.start)
            spelling = converted.code.slice(body.start, node.end)
        }
        if (source.slice(anchor, anchor + spelling.length) === spelling)
          verifiedEnds.set(node, anchor + spelling.length)
        if (node.type === 'JSXExpressionContainer' && !verifiedEnds.has(node)) {
          const owner = structuralOwner.get(node)
          const children = (owner ? (direct.get(owner) ?? []) : []).filter(
            (item) => item.start >= node.start && item.end <= node.end
          )
          if (children.length && children.every((item) => verifiedRelations.has(item))) {
            const spans = [
              ...children,
              ...fragmentTags.filter((tag) => !children.some((item) => tag.start >= item.start && tag.end <= item.end))
            ].sort((a, b) => a.start - b.start)
            let cursor = node.start,
              sourceCursor = anchor,
              verified = true
            for (const item of spans) {
              const text = converted.code.slice(cursor, item.start)
              if (item.start < cursor || source.slice(sourceCursor, sourceCursor + text.length) !== text) {
                verified = false
                break
              }
              sourceCursor += text.length
              const info = original.get(item)
              if (info) {
                const end = closes.get(item)
                if (info.start !== sourceCursor || end === undefined) {
                  verified = false
                  break
                }
                sourceCursor = end
              }
              cursor = item.end
            }
            const tail = converted.code.slice(cursor, node.end)
            if (verified && source.slice(sourceCursor, sourceCursor + tail.length) === tail)
              verifiedEnds.set(node, sourceCursor + tail.length)
          }
        }
      }
    } else if (syntheticFragments.has(node) && sequenceEnds.get(node) !== undefined)
      verifiedEnds.set(node, sequenceEnds.get(node)!)
    if (parent && sequenceChildren.has(node)) sequenceEnds.set(parent, verifiedEnds.get(node))
    const info = original.get(node)
    if (!info) continue
    if (node.astroUnverified) continue
    const tag = tagOf(node)
    const fold = (name: string) =>
      nativeHtml.has(node) ? name.replace(/[A-Z]/g, (letter) => letter.toLowerCase()) : name
    const accept = (offset: number, whitespace = false) => {
      if (offset < info.end || offset > source.length) return false
      let start = offset
      if (whitespace) while (start < source.length && /[\t\n\f\r ]/.test(source[start])) start++
      const text = fragments.has(node)
        ? source.slice(start, start + 3) === '</>'
          ? ['</>', '']
          : undefined
        : source.slice(start).match(/^<\/([^\s>]+)[\t\n\f\r ]*>/)
      if (
        !text ||
        (!fragments.has(node) && fold(text[1]) !== fold(tag)) ||
        (closeOwners.has(start) && closeOwners.get(start) !== node)
      )
        return false
      closeStarts.set(node, start)
      closes.set(node, start + text[0].length)
      closeOwners.set(start, node)
      return true
    }
    if (!closes.has(node)) {
      // Only adjacent opening-end, mapped whitespace, or a verified final child.
      if (
        !accept(info.end) &&
        !accept(sequenceEnds.get(node) ?? -1, true) &&
        !accept(mappedCloses.get(node) ?? -1, true) &&
        !(fragments.has(node) && accept(mapped(child(node, 'closingFragment')!.end) - 3, true))
      ) {
        const children = [...list(node, 'children')]
        while (
          children.length &&
          children.at(-1)!.type === 'JSXText' &&
          /^[\t\n\f\r ]*$/.test(String(children.at(-1)!.value ?? ''))
        )
          children.pop()
        const last = children.at(-1)
        if (last && original.has(last) && verifiedRelations.has(last)) accept(closes.get(last)!, true)
      }
    }
    if (!closes.has(node)) {
      if (fragments.has(node)) {
        localizeFragment(node)
        continue
      }
      const escaped = tag.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
      const possible = new RegExp('</' + escaped + '(?=[\\t\\n\\f\\r />])', nativeHtml.has(node) ? 'i' : '').test(
        source.slice(info.end)
      )
      const mappedClose = mappedCloses.get(node) ?? -1
      const text = source.slice(Math.max(0, mappedClose)).match(/^<\/([^\s>]+)[\t\n\f\r ]*>/)
      // EOF or a mismapped existing close alone is not omission evidence.
      const omitted = !possible && mappedClose >= info.end && Boolean(text)
      if (omitted || !affected.has(node) || !possible) markBoundary(node, omitted)
      continue
    }
    let previous = info.end
    const contained = (direct.get(node) ?? []).every((item) => {
      const start = original.get(item)?.start,
        end = closes.get(item)
      if (
        start === undefined ||
        end === undefined ||
        start < previous ||
        end > (closeStarts.get(node) ?? info.end) ||
        !verifiedRelations.has(item)
      )
        return false
      previous = end
      return true
    })
    if (!contained) {
      if (fragments.has(node)) {
        localizeFragment(node)
        continue
      }
      if (!affected.has(node)) markBoundary(node)
      continue
    }
    if (!affected.has(node)) {
      verifiedRelations.add(node)
      verifiedEnds.set(node, closes.get(node)!)
      if (parent && sequenceChildren.has(node)) sequenceEnds.set(parent, closes.get(node)!)
    }
  }
  const explainedBoundary = (node: AstNode): boolean => {
    if (unresolved(node) || boundaryAncestor(node)) return true
    const open = child(node, 'openingElement')
    const sourceStart = original.get(node)?.start ?? (open ? mapped(open.start) : -1)
    let parent = parents.get(node)
    while (parent) {
      const boundary = firstBoundary.get(parent)
      if (
        boundary &&
        original.has(parent) &&
        generatedStarts.get(node)! >= generatedStarts.get(boundary)! &&
        sourceStart >= original.get(boundary)!.end
      )
        return true
      parent = parents.get(parent)
    }
    return false
  }
  for (const node of invalidOpenings) {
    if (!explainedBoundary(node)) throw relationFailure()
    node.astroUnverified = true
  }
  const nodes: AstNode[] = [ast]
  while (nodes.length) {
    const node = nodes.pop()!
    const generatedStart = node.start,
      generatedEnd = node.end
    if (node.astroUnverified) {
      node.type = 'AstroUnverifiedSourceExpression'
      continue
    }
    if (syntheticFragments.has(node)) {
      node.type = 'JSXFragment'
      delete node.openingElement
      delete node.closingElement
    }
    if (
      (node.type === 'JSXElement' || node.type === 'JSXFragment') &&
      (generatedEnd <= body.start || generatedStart >= body.end)
    ) {
      node.type = 'AstroExcludedScriptExpression'
      continue
    }
    const expression = child(node, 'expression')
    if (
      node.type === 'JSXExpressionContainer' &&
      expression?.type === 'JSXEmptyExpression' &&
      [node, expression].some((item) => optionalMapped(item.start) === undefined || optionalMapped(item.end) === undefined)
    )
      continue
    const fragmentOwner = parents.get(node)
    const fragmentInfo = fragmentOwner && fragments.has(fragmentOwner) ? original.get(fragmentOwner) : undefined
    if (fragmentInfo && node.type === 'JSXOpeningFragment') {
      node.start = fragmentInfo.start
      node.end = fragmentInfo.end
    } else if (fragmentInfo && node.type === 'JSXClosingFragment') {
      node.start = closeStarts.get(fragmentOwner!)!
      node.end = closes.get(fragmentOwner!)!
    } else {
      if (typeof generatedStart === 'number')
        node.start =
          node === wrapper || ['File', 'Program', 'AstroFragment'].includes(node.type)
            ? 0
            : openingOffsets.has(node)
              ? generatedStart + openingOffsets.get(node)!
              : mapped(generatedStart)
      if (typeof generatedEnd === 'number')
        node.end =
          node === wrapper || ['File', 'Program', 'AstroFragment'].includes(node.type)
            ? source.length
            : openingOffsets.has(node)
              ? generatedEnd + openingOffsets.get(node)!
              : mapped(generatedEnd)
    }
    if (node.type === 'TemplateLiteral' && source[node.start] === '`') node.end = templateEnd(source, node.start)
    if (Array.isArray(node.range)) node.range = [node.start, node.end]
    if (node.type === 'JSXOpeningElement') {
      const owner = parents.get(node)
      const info = owner && original.get(owner)
      if (!info) throw relationFailure()
      try {
        node.attributes = associateAttributes(list(node, 'attributes'), info, {
          ...node,
          start: generatedStart,
          end: generatedEnd
        })
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ASTRO_SOURCE_RELATION'))
          throw error
        markBoundary(owner!)
        node.attributes = []
      }
      node.end = info.end
      node.start = info.start
      node.range = [node.start, node.end]
      tags.set(node.start, info)
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range', 'tokens', 'comments', 'extra'].includes(key) || /Comments$/.test(key))
        continue
      if (Array.isArray(value)) nodes.push(...(value as unknown[]).filter(isAstNode))
      else if (isAstNode(value)) nodes.push(value)
    }
  }
  const pending = [ast]
  while (pending.length) {
    const node = pending.pop()!
    if (node.type === 'AstroExcludedScriptExpression') continue
    if (node.astroUnverified) {
      node.type = 'AstroUnverifiedSourceExpression'
      continue
    }
    if (node.type === 'JSXOpeningElement') {
      const attributes = list(node, 'attributes')
      for (const attribute of attributes) {
        const raw = attribute.originalAttribute as RawAttribute
        attribute.start = raw.start
        attribute.end = raw.end
        attribute.range = [raw.start, raw.end]
        const value = child(attribute, 'value')
        if (value && ['quoted', 'unquoted'].includes(raw.kind)) {
          value.start = raw.valueStart
          value.end = raw.valueEnd
          value.range = [raw.valueStart, raw.valueEnd]
        } else if (value && ['expression', 'template'].includes(raw.kind)) {
          value.start = raw.valueStart
          value.end = raw.valueEnd
          value.range = [raw.valueStart, raw.valueEnd]
          const expression = child(value, 'expression')
          if (expression && expression.end < expression.start) {
            expression.end = raw.valueEnd - (raw.kind === 'expression' ? 1 : 0)
            expression.range = [expression.start, expression.end]
          }
        }
      }
    }
    const openingNode = child(node, 'openingElement')
    if (fragments.has(node) && original.has(node)) {
      const info = original.get(node)!
      node.start = info.start
      node.end = closes.get(node) ?? info.end
      node.range = [node.start, node.end]
    }
    if (node.type === 'JSXElement' && openingNode && tags.has(openingNode.start)) {
      const info = tags.get(openingNode.start)!
      node.start = info.start
      node.end = closes.get(node) ?? info.end
      node.range = [node.start, node.end]
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range', 'tokens', 'comments', 'extra'].includes(key) || /Comments$/.test(key))
        continue
      if (Array.isArray(value)) pending.push(...(value as unknown[]).filter(isAstNode))
      else if (isAstNode(value)) pending.push(value)
    }
  }
  const document = adaptJsxAst(source, ast, mode, config, 'astro')
  const boundaries = [...omissions, ...uncertainRelations]
    .filter((node) => !boundaryAncestor(node))
    .map((node) => ({ info: original.get(node)!, omitted: omissions.has(node) }))
    .sort((a, b) => a.info.start - b.info.start)
  if (boundaries.length) {
    document.checkRootCount = false
    document.generationUnresolved = true
    for (const { info, omitted } of boundaries)
      document.issues.push({
        code: 'SOURCE_RELATION_UNRESOLVED',
        kind: 'unresolved',
        message: omitted
          ? 'The official Astro conversion does not preserve this omitted closing tag and its source tree. Write an explicit closing tag.'
          : 'The original Astro closing boundary or source relation cannot be verified. Check expressions, comments and opening/closing correspondence in this range.',
        reason: omitted
          ? 'Astro omitted closing tag cannot be mapped to a reliable source tree.'
          : 'Astro source relation cannot be verified after successful generated parsing.',
        baseClass: '',
        path: [],
        range: [info.start, info.end]
      })
  }
  document.index.metrics.markupParses = 1
  Object.assign(document.index.metrics, { astroConversions: 1, generatedParses: 1, scriptParses: metrics.scriptParses })
  return document
}
