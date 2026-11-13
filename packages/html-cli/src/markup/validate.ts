import {
  createMarkupRuleContext,
  type ComponentStructure,
  type HtmlLintIssue,
  type HtmlLintMode
} from '../generator-core'
import { completeDiagnostic } from './repair'
import type {
  ClassAlternative,
  MarkupAttribute,
  MarkupConfig,
  MarkupDocument,
  MarkupElement,
  MarkupLintResult
} from './types'
import { combineGuards } from './expressions'
import type { Guard } from './types'
import { isBlockingMarkupIssue } from './failures'

const SHELL = new Set(['html', 'head', 'body'])
const METADATA = new Set(['title', 'base', 'link', 'meta', 'script', 'style', 'xmp', 'listing'])
const STRUCTURAL = new Set([
  'template',
  'slot',
  'noscript',
  'tbody',
  'thead',
  'tfoot',
  'colgroup',
  'datalist',
  'optgroup',
  'option',
  'selectedcontent'
])
const RELATIONS = new Set(['ELEMENT_WITHOUT_BLOCK_ANCESTOR', 'ELEMENT_PARENT_OF_BLOCK', 'ROOT_NOT_BLOCK'])
const INTERNAL = new Set(['datalist', 'optgroup', 'option', 'selectedcontent'])

export function validateMarkup(
  document: MarkupDocument,
  config: MarkupConfig,
  mode: HtmlLintMode
): Omit<MarkupLintResult, 'format'> {
  const rules = createMarkupRuleContext(config)
  const { index } = document
  const errors = [...document.issues]
  const policyDependent = new Set<HtmlLintIssue>()
  let elements = 0
  const rootsForCount = (nodes: MarkupElement[]): MarkupElement[] =>
    nodes.flatMap((node) => {
      if (node.detached) return []
      if (METADATA.has(node.tag)) return []
      return node.implicit || SHELL.has(node.tag) ? rootsForCount(node.children) : [node]
    })
  const countRoots = rootsForCount(document.roots)
  const rootUnits = new Set(countRoots)
  if (document.checkRootCount !== false && mode === 'root' && countRoots.length > 1) {
    let coexisting: MarkupElement | undefined
    for (let left = 0; left < countRoots.length && !coexisting; left += 1)
      for (let right = left + 1; right < countRoots.length; right += 1) {
        if (combineGuards(countRoots[left].guard ?? {}, countRoots[right].guard ?? {})) {
          coexisting = countRoots[right]
          break
        }
      }
    if (coexisting)
      errors.push({
        code: 'MULTIPLE_ROOT_ELEMENTS',
        message: 'Root mode expects a single source root.',
        baseClass: '',
        path: [],
        range: coexisting.openRange
      })
  }
  if (document.checkRootCount !== false && !countRoots.length)
    errors.push({
      code: 'INVALID_BASE_CLASS',
      message: 'No source element found.',
      baseClass: '',
      path: [],
      range: [0, 0]
    })
  type Frame = {
    element: MarkupElement
    parent: ComponentStructure | null
    ancestor: ComponentStructure | null
    depth: number
    path: string[]
    classlessSuppressed: boolean
    guard: Guard
    ancestorUnknown: boolean
    parentUnknown: boolean
  }
  const counted = new Set<string>()
  const slots = new Set<number>()
  const generationUnenumeratedSites = new Set<string>()
  const stateCounts = new Map<MarkupElement, number>()
  const stack: Frame[] = document.roots
    .map((element) => ({
      element,
      parent: null,
      ancestor: null,
      depth: 0,
      path: [],
      classlessSuppressed: false,
      guard: {},
      ancestorUnknown: false,
      parentUnknown: false
    }))
    .reverse()
  while (stack.length) {
    const frame = stack.pop()!
    index.metrics.validationFrames += 1
    const { element, parent, ancestor, depth } = frame
    if (METADATA.has(element.tag)) continue
    const states = (stateCounts.get(element) ?? 0) + 1
    stateCounts.set(element, states)
    if (states > 256) {
      if (states === 257)
        errors.push({
          code: 'SOURCE_RELATION_UNRESOLVED',
          kind: 'unresolved',
          message: 'Conditional relation analysis reached its implementation safety budget.',
          baseClass: '',
          path: frame.path,
          range: element.openRange
        })
      continue
    }
    if (depth > 256) {
      errors.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message:
          'Source traversal exceeded the implementation safety limit of 256 nested elements; this is not an HTML design-depth rule.',
        baseClass: '',
        path: frame.path,
        range: element.openRange
      })
      continue
    }
    const occurrence = `${element.openRange[0]}:${element.openRange[1]}`
    if (!element.implicit && !counted.has(occurrence)) {
      elements += 1
      counted.add(occurrence)
    }
    if (element.tag === 'slot') slots.add(element.openRange[0])
    type State = { alternative: ClassAlternative; attributes: MarkupAttribute[]; unknown: MarkupAttribute[] }
    let alternatives: State[] = element.classes.map((alternative) => ({ alternative, attributes: [], unknown: [] }))
    const needsInputType =
      element.tag === 'input' &&
      !element.component &&
      !frame.classlessSuppressed &&
      rules.htmlLint.classlessTagCheck &&
      !rules.htmlLint.classlessTagAllowlist.has(element.tag) &&
      (!element.namespace || element.namespace === 'http://www.w3.org/1999/xhtml') &&
      element.classes.some((value) => !value.tokens.length && !value.unresolved && !value.ownerUnknown)
    for (const attribute of element.attributes) {
      if (!attribute.alternatives) {
        for (const state of alternatives) {
          state.attributes = [...state.attributes.filter((existing) => existing.name !== attribute.name), attribute]
          state.unknown = state.unknown.filter((existing) => existing.name !== attribute.name)
        }
        continue
      }
      const reserved =
        rules.policy.variant.dataKeys.includes(attribute.name) ||
        attribute.name === rules.policy.state.dataKey ||
        rules.policy.state.ariaKeys.includes(attribute.name) ||
        (needsInputType && attribute.name === 'type')
      if (!reserved) continue
      const next: State[] = []
      for (const state of alternatives)
        for (const value of attribute.alternatives) {
          const guard = combineGuards(state.alternative.guard, value.guard)
          if (!guard) continue
          const resolved = {
            ...attribute,
            value: value.value ?? '',
            valueRange: value.range,
            range: value.attributeRange ?? attribute.range,
            present: value.present,
            winnerUnknown: value.winnerUnknown,
            overwrittenBy: value.overwrittenBy ?? attribute.overwrittenBy
          }
          const previous = state.attributes.filter((existing) => existing.name !== attribute.name)
          const unknown = state.unknown.filter((existing) => existing.name !== attribute.name)
          next.push({
            alternative: { ...state.alternative, guard },
            attributes: value.value !== undefined || value.unresolved ? [...previous, resolved] : previous,
            unknown: value.unresolved ? [...unknown, resolved] : unknown
          })
          if (next.length > 256) break
        }
      alternatives = next.slice(0, 256)
      if (next.length > 256)
        errors.push({
          code: 'SOURCE_RELATION_UNRESOLVED',
          kind: 'unresolved',
          message: 'Attribute alternative analysis reached its implementation safety budget.',
          baseClass: '',
          path: frame.path,
          range: attribute.range
        })
    }
    const inherited = combineGuards(frame.guard, element.guard ?? {})
    if (!inherited) continue
    const descendants: Array<Omit<Frame, 'element'>> = []
    for (const state of alternatives) {
      const alternative = state.alternative
      const guard = combineGuards(inherited, alternative.guard)
      if (!guard) continue
      const tokens = alternative.tokens
      const values = Object.fromEntries(
        state.attributes
          .filter(
            (attribute) => attribute.present === true || attribute.overwrittenBy || !state.unknown.includes(attribute)
          )
          .map((attribute) => [attribute.name, attribute.value])
      )
      const base = tokens[0]?.value ?? ''
      const targetPath = element.targetPath
      const issueStart = errors.length
      const node: ComponentStructure = {
        baseClass: base,
        isIndependent: rules.classify(base) === 'block',
        modifiers: tokens.slice(1).map((token) => token.value),
        ...rules.attributes(values),
        nestedChildren: [],
        independentChildren: [],
        orderedChildren: [],
        elementTag: element.tag,
        targetPath
      }
      const root = mode === 'root' && rootUnits.has(element) && element.rootRule !== false
      const unresolved = alternative.unresolved
      const ownerUnknown = Boolean(alternative.ownerUnknown || (unresolved && !base))
      if (unresolved && !element.component)
        errors.push({
          code: 'DYNAMIC_CLASS_UNRESOLVED',
          kind: 'unresolved',
          message: 'The effective class value cannot be established statically.',
          baseClass: base || element.tag,
          path: frame.path,
          range: unresolved
        })
      for (const attribute of state.unknown) {
        const applicable = ['block', 'element'].includes(rules.classify(base))
        if (
          applicable &&
          rules.policy.state.mode === 'data' &&
          rules.policy.state.ariaKeys.includes(attribute.name)
        )
          generationUnenumeratedSites.add(`${occurrence}:${attribute.name}`)
        const needsValue =
          (rules.policy.variant.mode === 'data' && rules.policy.variant.dataKeys.includes(attribute.name)) ||
          (rules.policy.state.mode === 'data' && attribute.name === rules.policy.state.dataKey) ||
          (!attribute.overwrittenBy &&
            ((rules.policy.variant.mode === 'class' && rules.policy.variant.dataKeys.includes(attribute.name)) ||
              (rules.policy.state.mode === 'class' &&
                (attribute.name === rules.policy.state.dataKey ||
                  rules.policy.state.ariaKeys.includes(attribute.name)))))
        if (['block', 'element'].includes(rules.classify(base)) && needsValue) {
          const issue: HtmlLintIssue = {
            code: 'SOURCE_RELATION_UNRESOLVED',
            kind: 'unresolved',
            message: `The configured selectorPolicy value of attribute "${attribute.name}" cannot be established statically.`,
            reason: 'The effective selectorPolicy attribute needs static presence, value or provenance evidence.',
            baseClass: base,
            path: frame.path,
            range: attribute.valueRange,
            repair: {
              conditions: [
                'Establish the effective presence, value and producing attribute for this existing selectorPolicy key on the reported branch before generating SCSS.'
              ],
              effective: { selectorPolicy: rules.policy }
            }
          }
          policyDependent.add(issue)
          errors.push(issue)
        }
      }
      if (base) {
        for (const issue of rules.validate(node, parent, ancestor, element.rootRule ?? root)) {
          if (alternative.ownerUnknown && !issue.attributeName) continue
          if (element.htmlRecovery && RELATIONS.has(issue.code)) continue
          if (issue.code === 'ELEMENT_PARENT_OF_BLOCK' && frame.parentUnknown) continue
          if (element.component && RELATIONS.has(issue.code)) continue
          if (issue.code === 'ELEMENT_WITHOUT_BLOCK_ANCESTOR' && (element.ancestryUnknown || frame.ancestorUnknown))
            continue
          if (
            RELATIONS.has(issue.code) &&
            alternative.correlationUnknown &&
            Object.keys(frame.guard).length &&
            Object.keys(alternative.guard).some((key) => !(key in frame.guard))
          ) {
            issue.code = 'SOURCE_RELATION_UNRESOLVED'
            issue.kind = 'unresolved'
            issue.message = `Coexistence of conditional parent/child alternatives is unknown: ${issue.message}`
          }
          let token = tokens[0]
          if (issue.code === 'UNCLASSIFIED_CLASS_TOKEN')
            token = tokens.find((candidate) => issue.reason === `Unclassified token: ${candidate.value}`) ?? token
          else if (issue.code === 'MULTIPLE_BASE_CLASSES')
            token =
              tokens.slice(1).find((candidate) => ['block', 'element'].includes(rules.classify(candidate.value))) ??
              token
          else if (/MODIFIER/.test(issue.code))
            token = tokens.find((candidate) => issue.message.includes(`"${candidate.value}"`)) ?? token
          const attribute = issue.attributeName
            ? state.attributes.find((candidate) => candidate.name === issue.attributeName)
            : undefined
          const attributeValueIssue = /INVALID_.*_VALUE/.test(issue.code)
          if (attribute?.overwrittenBy) {
            issue.code = 'SOURCE_RELATION_UNRESOLVED'
            issue.kind = 'unresolved'
            issue.message = `The explicit value of "${attribute.name}" may be superseded by an unknown spread.`
            policyDependent.add(issue)
          }
          if (attribute?.winnerUnknown && !attributeValueIssue && issue.code.startsWith('DISALLOWED_')) {
            delete issue.range
            issue.reason =
              'The reserved selectorPolicy attribute is certainly present, but its producing attribute is not unique under the current static evidence.'
          } else issue.range = attribute ? (attributeValueIssue ? attribute.valueRange : attribute.range) : token.range
          issue.path = [...frame.path, base]
          errors.push(issue)
        }
        if (
          !element.component &&
          frame.parentUnknown &&
          (rules.classify(base) === 'block' || (rules.classify(base) === 'element' && !ancestor))
        )
          errors.push({
            code: 'SOURCE_RELATION_UNRESOLVED',
            kind: 'unresolved',
            message:
              'The nearest style-owning parent or Block ancestor may be supplied by an unknown attribute transfer.',
            baseClass: base,
            path: [...frame.path, base],
            range: tokens[0].range
          })
      } else if (
        !element.implicit &&
        !unresolved &&
        !alternative.ownerUnknown &&
        !element.component &&
        !SHELL.has(element.tag)
      ) {
        if (root)
          errors.push({
            code: 'INVALID_BASE_CLASS',
            message: 'Root element does not have a class base.',
            baseClass: '',
            path: frame.path,
            range: element.openRange
          })
        const checkNamespace =
          !element.namespace ||
          element.namespace === 'http://www.w3.org/1999/xhtml' ||
          element.tag === 'svg' ||
          element.tag === 'math'
        if (
          checkNamespace &&
          !STRUCTURAL.has(element.tag) &&
          !frame.classlessSuppressed &&
          rules.htmlLint.classlessTagCheck &&
          !rules.htmlLint.classlessTagAllowlist.has(element.tag) &&
          !(element.tag === 'input' && values.type?.toLowerCase() === 'hidden')
        ) {
          const unknownType =
            element.tag === 'input' ? state.unknown.find((attribute) => attribute.name === 'type') : undefined
          errors.push(
            unknownType
              ? {
                  code: 'SOURCE_RELATION_UNRESOLVED',
                  kind: 'unresolved',
                  message: 'The source input type cannot be established for the classless hidden-input exception.',
                  reason:
                    'Static evidence or the intended hidden/non-hidden input type is needed before deciding this exception.',
                  baseClass: element.tag,
                  path: frame.path,
                  range: unknownType.valueRange,
                  repair: {
                    conditions: [
                      'Establish whether this source input type is hidden on the reported branch, then rerun lint.'
                    ],
                    effective: { htmlLint: { classlessTagCheck: true } },
                    missingInformation: ['Static evidence or the intended hidden/non-hidden input type.']
                  }
                }
              : {
                  code: 'CLASSLESS_TAG_NOT_ALLOWED',
                  message: `Source tag <${element.tag}> has no style-owning class.`,
                  baseClass: element.tag,
                  path: frame.path,
                  range: element.openRange
                }
          )
        }
      }
      const nextParent = base && !element.component && !ownerUnknown ? node : parent
      const nextAncestor =
        base && !element.component && !ownerUnknown && rules.classify(base) === 'block' ? node : ancestor
      if (element.relationUnknown && rules.classify(base) === 'element' && !ancestor)
        errors.push({
          code: 'SOURCE_RELATION_UNRESOLVED',
          kind: 'unresolved',
          message:
            'This local JSX value has source insertion sites whose owning Block cannot be established by the supported single-const relation.',
          baseClass: base,
          path: frame.path,
          range: element.relationUnknown
        })
      for (let issueIndex = issueStart; issueIndex < errors.length; issueIndex += 1) {
        errors[issueIndex].targetPath ??= targetPath
        if (Object.keys(guard).length)
          errors[issueIndex].condition = Object.entries(guard)
            .map(([key, value]) => `${value ? '' : '!'}(${key.slice(key.indexOf(':') + 1)})`)
            .join(' && ')
      }
      descendants.push({
        parent: nextParent,
        ancestor: nextAncestor,
        depth: depth + (element.implicit ? 0 : 1),
        path: base ? [...frame.path, base] : frame.path,
        classlessSuppressed: frame.classlessSuppressed || INTERNAL.has(element.tag),
        guard,
        ancestorUnknown: nextAncestor
          ? false
          : frame.ancestorUnknown || ownerUnknown || Boolean(element.ancestryUnknown),
        parentUnknown:
          !element.component && ownerUnknown ? true : base && !element.component ? false : frame.parentUnknown
      })
    }
    // Only an exhaustive invariant context may forget local modifier guards.
    // Never broaden a non-exhaustive group of owner-changing alternatives.
    const first = descendants[0]
    const invariant =
      first &&
      descendants.every(
        (next) =>
          next.parent?.baseClass === first.parent?.baseClass &&
          next.ancestor?.baseClass === first.ancestor?.baseClass &&
          next.ancestorUnknown === first.ancestorUnknown &&
          next.parentUnknown === first.parentUnknown &&
          next.classlessSuppressed === first.classlessSuppressed &&
          next.path.length === first.path.length &&
          next.path.every((part, i) => part === first.path[i])
      )
    const contexts = invariant ? [{ ...first, guard: inherited }] : descendants
    for (const context of contexts) {
      for (let cursor = element.children.length - 1; cursor >= 0; cursor -= 1) {
        index.metrics.childPropagations += 1
        stack.push({ ...context, element: element.children[cursor] })
      }
    }
  }
  for (const issue of errors) completeDiagnostic(issue, config, index, { selectorPolicy: policyDependent.has(issue) })
  const unique = new Map<string, HtmlLintIssue>()
  for (const issue of errors) {
    const key = JSON.stringify([issue.code, issue.range, issue.reason])
    const previous = unique.get(key)
    if (!previous) unique.set(key, issue)
    else if (previous.condition && issue.condition && previous.condition !== issue.condition)
      previous.condition = `(${previous.condition}) || (${issue.condition})`
  }
  const diagnostics = [...unique.values()]
  const blocked = diagnostics.some(isBlockingMarkupIssue)
  return {
    ok: diagnostics.length === 0,
    status: blocked ? 'blocked' : diagnostics.length ? 'failed' : 'pass',
    errors: diagnostics,
    coverage: {
      scope: 'source',
      path: 'parser',
      elements,
      unresolved: diagnostics.filter((issue) => issue.kind === 'unresolved').length,
      outOfScope: document.outOfScope + slots.size,
      generationUnenumeratedSites: generationUnenumeratedSites.size
    },
    metrics: index.metrics
  }
}
