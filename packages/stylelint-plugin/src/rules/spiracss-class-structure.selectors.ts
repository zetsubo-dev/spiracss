import type { Node as PostcssNode, Rule } from 'postcss'
import type { ClassName, Node as SelectorNode, Selector } from 'postcss-selector-parser'

import {
  collectCompoundNodes,
  collectNestingSiblingClasses,
  collectSelectorSummary,
  type CompoundNodes
} from '../utils/selector'
import { messages } from './spiracss-class-structure.messages'
import { classify } from './spiracss-class-structure.patterns'
import type { Kind, Options, Patterns, SelectorPolicyData } from './spiracss-class-structure.types'

export const collectRootBlockNames = (
  selectors: Selector[],
  options: Options,
  patterns: Patterns
): string[] => {
  const names = new Set<string>()
  const rootPseudos = new Set([':is', ':where'])
  selectors.forEach((sel) => {
    const [head] = collectCompoundNodes(sel, { sameElementPseudos: rootPseudos })
    if (!head) return
    head.classes.forEach((node) => {
      const name = (node as ClassName).value
      if (classify(name, options, patterns) === 'block') {
        names.add(name)
      }
    })
  })
  return [...names]
}

export const hasValidSpiraClass = (
  selectors: Selector[],
  options: Options,
  patterns: Patterns
): boolean => {
  return selectors.some((sel) => {
    let found = false
    sel.walkClasses((node) => {
      if (found) return
      const kind = classify(node.value, options, patterns)
      if (kind !== 'external' && kind !== 'invalid') found = true
    })
    return found
  })
}

export const analyzeRootSelector = (
  sel: Selector,
  rootBlockName: string,
  options: Options,
  patterns: Patterns
): { hasSpiraClass: boolean; hasRootBlock: boolean; hasOtherBlock: boolean } => {
  let hasSpiraClass = false
  let hasRootBlock = false
  let hasOtherBlock = false

  const sameElementPseudos = new Set([':is', ':where'])

  type SelectorContainer = SelectorNode & { nodes?: SelectorNode[] }

  const isContainer = (node: SelectorNode | undefined): node is SelectorContainer =>
    Boolean(node && 'nodes' in node && Array.isArray((node as SelectorContainer).nodes))

  const hasCombinator = (container: SelectorContainer | undefined): boolean => {
    const nodes = container?.nodes
    if (!nodes || nodes.length === 0) return false
    return nodes.some((node) => {
      if (node.type === 'combinator') return true
      if (isContainer(node)) return hasCombinator(node)
      return false
    })
  }

  const isInsideNonSameElementPseudo = (node: SelectorNode): boolean => {
    let current = node.parent as SelectorNode | undefined
    let selectorInPseudo: Selector | null = null
    while (current) {
      if (current.type === 'selector') selectorInPseudo = current as Selector
      if (current.type === 'pseudo') {
        const pseudo = typeof current.value === 'string' ? current.value.toLowerCase() : ''
        if (!sameElementPseudos.has(pseudo)) return true
        if (selectorInPseudo && hasCombinator(selectorInPseudo)) return true
      }
      current = current.parent as SelectorNode | undefined
    }
    return false
  }

  sel.walk((node) => {
    if (node.type !== 'class') return
    const name = (node as ClassName).value
    const kind = classify(name, options, patterns)
    if (kind !== 'external') hasSpiraClass = true
    if (isInsideNonSameElementPseudo(node)) return
    if (name === rootBlockName) hasRootBlock = true
    if (kind === 'block' && name !== rootBlockName) hasOtherBlock = true
  })

  return { hasSpiraClass, hasRootBlock, hasOtherBlock }
}

type ProcessContext = {
  parentKind?: Kind
  parentSelector?: string
  parentDepth: number
  parentBlockDepth: number
  report: (message: string) => void
  options: Options
  patterns: Patterns
  policyData: SelectorPolicyData
  namingHint: string
  isShared: boolean
  isInteraction: boolean
}

const MAX_BLOCK_NESTING_DEPTH = 1

const getModifierExample = (options: Options): string => {
  const naming = options.naming ?? {}
  const prefix = naming.modifierPrefix ?? '-'
  const modifierCase = naming.modifierCase ?? 'kebab'
  const token = modifierCase === 'pascal' ? 'Primary' : 'primary'
  return `${prefix || ''}${token}`
}

const reportAttributeViolations = (
  compounds: CompoundNodes[],
  ctx: ProcessContext
): void => {
  const { parentKind, report, options, patterns, policyData } = ctx
  const policy = options.selectorPolicy
  const {
    reservedVariantKeys,
    reservedStateKey,
    reservedAriaKeys,
    variantValuePattern,
    stateValuePattern
  } = policyData
  const modifierExample = getModifierExample(options)

  compounds.forEach((compound) => {
    if (compound.attributes.length === 0) return
    const hasSpiraClass =
      compound.classes.some((c) => classify(c.value, options, patterns) !== 'external') ||
      (compound.hasNesting && parentKind && parentKind !== 'external')
    if (!hasSpiraClass) return

    compound.attributes.forEach((attr) => {
      const raw = attr.attribute || ''
      const name = raw.toLowerCase()
      const attrValue = typeof attr.value === 'string' ? attr.value.trim() : ''
      if (!name) return
      if (name.startsWith('data-')) {
        if (reservedVariantKeys.has(name)) {
          if (policy.variant.mode === 'class') {
            report(messages.invalidVariantAttribute(name, modifierExample))
            return
          }
          if (attrValue && !variantValuePattern.test(attrValue)) {
            report(messages.invalidDataValue(name, attrValue))
          }
        } else if (name === reservedStateKey) {
          if (policy.state.mode !== 'data') {
            report(messages.invalidStateAttribute(name, modifierExample))
            return
          }
          if (attrValue && !stateValuePattern.test(attrValue)) {
            report(messages.invalidDataValue(name, attrValue))
          }
        }
      } else if (name.startsWith('aria-')) {
        if (reservedAriaKeys.has(name) && policy.state.mode !== 'data') {
          report(messages.invalidStateAttribute(name, modifierExample))
        }
      }
    })
  })
}

const collectInvalidNestingClasses = (
  sel: Selector,
  options: Options,
  patterns: Patterns
): Set<string> => {
  const invalidClasses = new Set<string>()
  collectNestingSiblingClasses(sel).forEach((name) => {
    const kind = classify(name, options, patterns)
    if (kind !== 'modifier' && kind !== 'external') {
      invalidClasses.add(name)
    }
  })
  return invalidClasses
}

const reportInvalidNestingClasses = (
  invalidClasses: Set<string>,
  report: (message: string) => void,
  modifierExample: string
): void => {
  invalidClasses.forEach((name) => {
    report(messages.needModifierPrefix(name, modifierExample))
  })
}

const reportInvalidClassNames = (
  classes: ClassName[],
  invalidNestingClasses: Set<string>,
  options: Options,
  patterns: Patterns,
  namingHint: string,
  report: (message: string) => void
): void => {
  classes.forEach((c) => {
    if (invalidNestingClasses.has(c.value)) return
    if (classify(c.value, options, patterns) === 'invalid') {
      report(messages.invalidName(c.value, namingHint))
    }
  })
}

const resolveBaseClass = (
  classes: ClassName[],
  modifierClass: ClassName | undefined,
  options: Options,
  patterns: Patterns
): ClassName =>
  modifierClass ??
  [...classes].reverse().find((c) => classify(c.value, options, patterns) !== 'external') ??
  classes[classes.length - 1]

const resolveKind = (
  modifierClass: ClassName | undefined,
  hasNesting: boolean,
  parentKind: Kind | undefined,
  base: ClassName,
  options: Options,
  patterns: Patterns
): Kind => {
  if (modifierClass) return 'modifier'
  if (hasNesting && (parentKind === 'block' || parentKind === 'element')) {
    const classified = classify(base.value, options, patterns)
    return classified === 'invalid' ? 'invalid' : parentKind
  }
  if (hasNesting && parentKind) return parentKind
  return classify(base.value, options, patterns)
}

const resolveStructuralKind = (
  classes: ClassName[],
  kind: Kind,
  options: Options,
  patterns: Patterns
): Kind => {
  const structuralBase = [...classes].reverse().find((c) => {
    const currentKind = classify(c.value, options, patterns)
    return currentKind !== 'modifier' && currentKind !== 'external'
  })
  return structuralBase ? classify(structuralBase.value, options, patterns) : kind
}

const resolveElementDepth = (
  kind: Kind,
  parentKind: Kind | undefined,
  parentDepth: number
): number =>
  kind === 'element' ? (parentKind === 'element' ? parentDepth + 1 : 1) : 0

const reportElementHierarchyViolations = (
  ctx: ProcessContext,
  kind: Kind,
  baseKind: Kind,
  baseValue: string,
  depth: number
): boolean => {
  const { parentKind, parentSelector, options, report, isInteraction } = ctx
  if (isInteraction || parentKind !== 'element' || kind === 'modifier') return false
  const parentLabel = parentSelector || '(unknown)'

  if (baseKind === 'block') {
    report(messages.elementCannotOwnBlock(parentLabel, baseValue))
    return true
  }

  if (baseKind === 'element') {
    if (depth > options.allowElementChainDepth) {
      report(
        messages.elementChainTooDeep(
          parentLabel,
          baseValue,
          depth,
          options.allowElementChainDepth
        )
      )
    }
    return true
  }

  return false
}

const reportModifierPlacementViolation = (
  kind: Kind,
  hasNesting: boolean,
  parentKind: Kind | undefined,
  report: (message: string) => void,
  modifierExample: string
): void => {
  if (kind !== 'modifier') return
  if (hasNesting) return
  if (parentKind && parentKind !== 'block' && parentKind !== 'element') return
  report(messages.needAmpForMod(modifierExample))
}

const reportBlockCombinatorViolations = (
  ctx: ProcessContext,
  kind: Kind,
  baseValue: string,
  hasNesting: boolean,
  firstCombinator: string | null,
  combinatorCount: number
): void => {
  const { parentKind, parentSelector, options, report, isShared, isInteraction } = ctx
  if (parentKind !== 'block' || kind === 'modifier') return
  if (!options.enforceChildCombinator || isShared || isInteraction) return

  const missingChild = !hasNesting && !firstCombinator
  const wrongCombinator = firstCombinator && firstCombinator !== '>'
  if (missingChild || wrongCombinator) {
    report(messages.needChild(baseValue))
    return
  }

  if (combinatorCount > 1 && parentSelector) {
    // Avoid grandchild selectors or chained combinators in Block files.
    report(messages.blockDescendantSelector(parentSelector, baseValue))
  }
}

const reportBlockDepthViolation = (
  ctx: ProcessContext,
  kind: Kind,
  baseValue: string
): void => {
  const { parentKind, parentBlockDepth, report, isInteraction } = ctx
  if (kind !== 'block' || isInteraction) return
  const blockDepth = parentKind === 'block' ? parentBlockDepth + 1 : 0
  if (blockDepth > MAX_BLOCK_NESTING_DEPTH) {
    report(messages.tooDeepBlockNesting(baseValue))
  }
}

const reportBlockGrandchildElementViolation = (
  ctx: ProcessContext,
  kind: Kind,
  baseValue: string
): void => {
  const { parentKind, parentBlockDepth, parentSelector, report, isInteraction } = ctx
  if (parentKind !== 'block' || kind !== 'element' || isInteraction) return
  if (parentBlockDepth < 1 || !parentSelector) return
  // If a Block is already nested under another Block, do not target its Element
  // in a single selector (Block > Block > Element).
  report(messages.blockTargetsGrandchildElement(parentSelector, baseValue))
}

/**
 * Analyze a selector in context and emit structure/naming violations.
 * @param sel - Selector node to analyze.
 * @param ctx - Validation context (options, patterns, reporter, and parent state).
 * @returns Structural kind used for parent/child depth tracking, or null when ignored.
 */
export const processSelector = (sel: Selector, ctx: ProcessContext): Kind | null => {
  const {
    parentKind,
    parentDepth,
    report,
    options,
    patterns,
    policyData,
    namingHint
  } = ctx
  const { classes, hasNesting, firstCombinator, combinatorCount } =
    collectSelectorSummary(sel)

  const compounds = collectCompoundNodes(sel)
  reportAttributeViolations(compounds, ctx)

  if (classes.length === 0) return null
  // Check non-modifier classes in the &.foo pattern first.
  const invalidNestingClasses = hasNesting
    ? collectInvalidNestingClasses(sel, options, patterns)
    : new Set<string>()
  const modifierExample = getModifierExample(options)
  reportInvalidNestingClasses(invalidNestingClasses, report, modifierExample)

  // Validate naming for every class in the selector (avoid missing non-base classes).
  // Exclude classes already reported via &.foo handling.
  reportInvalidClassNames(classes, invalidNestingClasses, options, patterns, namingHint, report)

  const modifierClasses = classes.filter((c) => patterns.modifierRe.test(c.value))
  const modifierClass = modifierClasses[0]

  const modifiersAllowed =
    !(options.selectorPolicy.variant.mode === 'data' && options.selectorPolicy.state.mode === 'data')
  if (!modifiersAllowed && modifierClasses.length > 0) {
    modifierClasses.forEach(() => {
      report(messages.disallowedModifier())
    })
  }

  // Ignore selectors that are purely external, but still catch SpiraCSS classes
  // even if the last segment is external.
  const base = resolveBaseClass(classes, modifierClass, options, patterns)
  const baseKind = classify(base.value, options, patterns)

  // Kind resolution:
  // 1. If a Modifier exists -> 'modifier'
  // 2. If hasNesting:
  //    - With Block/Element parent, classify base and check invalid
  //    - Otherwise, use classify result
  // 3. Otherwise -> classify
  const kind = resolveKind(modifierClass, hasNesting, parentKind, base, options, patterns)

  if (kind === 'external') return null

  const structuralKind = resolveStructuralKind(classes, kind, options, patterns)
  const depth = resolveElementDepth(kind, parentKind, parentDepth)

  reportBlockDepthViolation(ctx, kind, base.value)

  if (kind === 'invalid') return structuralKind

  if (reportElementHierarchyViolations(ctx, kind, baseKind, base.value, depth)) {
    // Depth is within the allowed range; stop further checks.
    return structuralKind
  }

  reportModifierPlacementViolation(kind, hasNesting, parentKind, report, modifierExample)

  reportBlockCombinatorViolations(
    ctx,
    kind,
    base.value,
    hasNesting,
    firstCombinator,
    combinatorCount
  )
  reportBlockGrandchildElementViolation(ctx, kind, base.value)

  return structuralKind
}

export const mergeRuleKinds = (kinds: Kind[]): Kind | null => {
  if (kinds.length === 0) return null
  if (kinds.includes('block')) return 'block'
  if (kinds.includes('element')) return 'element'
  if (kinds.includes('modifier')) return 'modifier'
  if (kinds.includes('invalid')) return 'invalid'
  return null
}

export const findNearestParentRule = (node: PostcssNode): Rule | null => {
  let current: PostcssNode | undefined = node.parent
  while (current) {
    if (current.type === 'rule') return current as Rule
    current = current.parent
  }
  return null
}

export const hasSegmentSequence = (segments: string[], sequence: string[]): boolean => {
  if (sequence.length === 0 || segments.length < sequence.length) return false
  for (let i = 0; i <= segments.length - sequence.length; i += 1) {
    let matched = true
    for (let j = 0; j < sequence.length; j += 1) {
      if (segments[i + j] !== sequence[j]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}
