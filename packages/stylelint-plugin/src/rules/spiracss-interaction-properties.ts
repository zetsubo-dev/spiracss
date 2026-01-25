import type { Container, Declaration, Node as PostcssNode, Root, Rule } from 'postcss'
import type { Node as SelectorNode } from 'postcss-selector-parser'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { PSEUDO_ELEMENTS } from '../utils/constants'
import { ROOT_WRAPPER_NAMES } from '../utils/constants'
import { selectorParseFailedArgs } from '../utils/messages'
import { isInsideNonSameElementPseudo } from '../utils/selector'
import {
  CACHE_SCHEMA,
  COMMENTS_SCHEMA,
  EXTERNAL_SCHEMA,
  NAMING_SCHEMA
} from '../utils/option-schema'
import {
  findParentRule,
  isContainer,
  isInsideKeyframes,
  isRule
} from '../utils/postcss-helpers'
import {
  getCommentText,
  isRuleInRootScope,
  markInteractionContainers,
  safeTestPattern
} from '../utils/section'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { getRuleDocsUrl } from '../utils/rule-docs'
import { isPlainObject, isString, isStringArray } from '../utils/validate'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import { collectRootBlockNames } from './spiracss-class-structure.selectors'
import type { ClassifyOptions } from './spiracss-class-structure.types'
import {
  splitSelectors,
  stripGlobalSelectorForRoot
} from './spiracss-property-placement.selectors'
import { ruleName } from './spiracss-interaction-properties.constants'
import { messages } from './spiracss-interaction-properties.messages'
import { normalizeOptions } from './spiracss-interaction-properties.options'

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Require transition/animation declarations to live in SpiraCSS interaction sections.',
  category: 'stylistic'
}

const optionSchema = {
  ...NAMING_SCHEMA,
  ...COMMENTS_SCHEMA,
  ...EXTERNAL_SCHEMA,
  ...CACHE_SCHEMA
}

const TRANSITION_PROPERTIES = new Set([
  'transition',
  'transition-property',
  'transition-duration',
  'transition-delay',
  'transition-timing-function',
  'transition-behavior'
])

const ANIMATION_PROPERTIES = new Set([
  'animation',
  'animation-name',
  'animation-duration',
  'animation-delay',
  'animation-timing-function',
  'animation-direction',
  'animation-fill-mode',
  'animation-iteration-count',
  'animation-play-state',
  'animation-composition',
  'animation-timeline',
  'animation-range',
  'animation-range-start',
  'animation-range-end'
])

const TRANSITION_LIST_PROPERTIES = new Set(['transition', 'transition-property'])
const TIMING_KEYWORDS = new Set([
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'step-start',
  'step-end'
])

const PROPERTY_NAME_RE = /^-?[a-z][a-z0-9-]*$/i
const FORBIDDEN_TRANSITION_KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer'
])
type TransitionParseError = 'missing' | 'all' | 'none' | 'invalid'

const splitTopLevel = (value: string, separator: string): string[] => {
  const segments: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (char === '(') depth += 1
    if (char === ')' && depth > 0) depth -= 1
    if (depth === 0 && char === separator) {
      segments.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) segments.push(current.trim())
  return segments.length > 0 ? segments : ['']
}

const splitWhitespace = (value: string): string[] => {
  const tokens: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (char === '(') depth += 1
    if (char === ')' && depth > 0) depth -= 1
    if (depth === 0 && /\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (current) tokens.push(current)
  return tokens
}

const isTimingFunctionToken = (token: string): boolean => {
  const normalized = token.toLowerCase()
  if (TIMING_KEYWORDS.has(normalized)) return true
  return normalized.startsWith('cubic-bezier(') || normalized.startsWith('steps(')
}

const isTimeToken = (token: string): boolean => /^-?\d*\.?\d+(ms|s)$/i.test(token)

const findPropertyToken = (tokens: string[]): string | null => {
  const candidates = tokens.filter((token) => {
    const normalized = token.toLowerCase()
    if (isTimeToken(normalized)) return false
    if (isTimingFunctionToken(normalized)) return false
    return PROPERTY_NAME_RE.test(normalized)
  })
  if (candidates.length !== 1) return null
  return candidates[0]
}

const parseTransitionList = (
  value: string
): { properties: string[]; error?: TransitionParseError } => {
  const trimmed = value.trim()
  if (!trimmed) return { properties: [], error: 'missing' }
  if (trimmed.toLowerCase() === 'none') return { properties: [], error: 'none' }
  const segments = splitTopLevel(trimmed, ',')
  const properties: string[] = []
  for (const segment of segments) {
    const tokens = splitWhitespace(segment)
    const token = findPropertyToken(tokens)
    if (!token) return { properties: [], error: 'missing' }
    const normalized = token.toLowerCase()
    if (normalized === 'all') return { properties: [], error: 'all' }
    if (normalized === 'none') return { properties: [], error: 'none' }
    if (FORBIDDEN_TRANSITION_KEYWORDS.has(normalized)) {
      return { properties: [], error: 'invalid' }
    }
    if (!PROPERTY_NAME_RE.test(normalized)) return { properties: [], error: 'invalid' }
    properties.push(normalized)
  }
  return { properties }
}

const parseTransitionProperty = (
  value: string
): { properties: string[]; error?: TransitionParseError } => {
  const trimmed = value.trim()
  if (!trimmed) return { properties: [], error: 'missing' }
  if (trimmed.toLowerCase() === 'none') return { properties: [], error: 'none' }
  const segments = splitTopLevel(trimmed, ',')
  const properties: string[] = []
  for (const segment of segments) {
    const token = segment.trim()
    if (!token) return { properties: [], error: 'missing' }
    const normalized = token.toLowerCase()
    if (normalized === 'all') return { properties: [], error: 'all' }
    if (normalized === 'none') return { properties: [], error: 'none' }
    if (FORBIDDEN_TRANSITION_KEYWORDS.has(normalized)) {
      return { properties: [], error: 'invalid' }
    }
    if (!PROPERTY_NAME_RE.test(normalized)) return { properties: [], error: 'invalid' }
    properties.push(normalized)
  }
  return { properties }
}

const isPseudoElement = (value: string): string | null => {
  const raw = value.replace(/^:+/, '').toLowerCase()
  if (value.startsWith('::') || PSEUDO_ELEMENTS.has(raw)) return raw
  return null
}

const isInsidePseudo = (node: SelectorNode): boolean => {
  let current = node.parent as SelectorNode | undefined
  while (current) {
    if (current.type === 'pseudo') return true
    current = current.parent as SelectorNode | undefined
  }
  return false
}

const isInsideGlobalPseudo = (node: SelectorNode): boolean => {
  let current = node as SelectorNode | undefined
  while (current) {
    if (current.type === 'pseudo') {
      const value = typeof current.value === 'string' ? current.value.toLowerCase() : ''
      if (value === ':global') return true
    }
    current = current.parent as SelectorNode | undefined
  }
  return false
}

const formatTargetLabel = (key: string): string => {
  const [basePart, pseudo] = key.split('::')
  const [block, element] = basePart.split('>')
  const base = element ? `.${block} > .${element}` : `.${block}`
  return pseudo ? `${base}::${pseudo}` : base
}

const rule = createRule(
  ruleName,
  messages,
  (primaryOption: unknown, secondaryOption: unknown, _context: RuleContext) => {
    if (primaryOption === false) {
      return () => {
        /* rule disabled */
      }
    }

    const rawOptions =
      typeof primaryOption === 'object' && primaryOption !== null ? primaryOption : secondaryOption

    return (root: Root, result: stylelint.PostcssResult) => {
      const shouldValidate = result.stylelint?.config?.validate !== false
      if (shouldValidate) {
        const validOptions = stylelint.utils.validateOptions(
          result,
          ruleName,
          {
            actual: primaryOption,
            possible: [true, isPlainObject]
          },
          {
            actual: secondaryOption,
            possible: isPlainObject,
            optional: true
          },
          {
            actual: rawOptions,
            possible: optionSchema,
            optional: true
          }
        )
        if (!validOptions) return
      }

      const reportInvalid = shouldValidate
        ? (optionName: string, value: unknown, detail?: string) => {
            reportInvalidOption(result, ruleName, optionName, value, detail)
          }
        : undefined

      const hasInvalid = validateOptionsArrayFields(
        rawOptions,
        ['external.classes', 'external.prefixes'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const options = normalizeOptions(rawOptions, reportInvalid)
      const cacheSizes = options.cache
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const classifyOptions: ClassifyOptions = {
        external: options.external,
        naming: options.naming
      }
      const patterns = buildPatterns(classifyOptions, options.cache, reportInvalid)
      const commentPatterns = {
        sharedCommentPattern: options.comments.shared,
        interactionCommentPattern: options.comments.interaction
      }
      const interactionContainers = markInteractionContainers(
        root,
        commentPatterns,
        (_comment, parent) => isRule(parent) && isRuleInRootScope(parent, ROOT_WRAPPER_NAMES)
      )
      const isInInteractionSection = (node: PostcssNode): boolean => {
        let current: PostcssNode | undefined = node.parent ?? undefined
        while (current) {
          if (interactionContainers.has(current as Container)) return true
          current = current.parent ?? undefined
        }
        return false
      }

      // Cache node index lookups within containers to avoid repeated O(n) findIndex calls.
      const nodeIndexCache = new WeakMap<Container, Map<PostcssNode, number>>()
      const getNodeIndex = (container: Container, node: PostcssNode): number => {
        let indexMap = nodeIndexCache.get(container)
        if (!indexMap) {
          indexMap = new Map<PostcssNode, number>()
          const nodes = container.nodes ?? []
          nodes.forEach((item, index) => indexMap?.set(item, index))
          nodeIndexCache.set(container, indexMap)
        }
        return indexMap.get(node) ?? -1
      }

      // Cache section boundaries per container to determine if a node is in interaction section.
      // Each node is assigned to a section based on the most recent section comment before it.
      // Possible section values: 'interaction', 'shared', or null (no section comment before).
      type SectionType = 'interaction' | 'shared' | null
      const sectionBoundaryCache = new WeakMap<Container, Map<number, SectionType>>()
      const getNodeSection = (container: Container, nodeIndex: number): SectionType => {
        let sectionMap = sectionBoundaryCache.get(container)
        if (!sectionMap) {
          sectionMap = new Map<number, SectionType>()
          const nodes = container.nodes ?? []
          let currentSection: SectionType = null
          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i]
            if (node.type === 'comment') {
              const text = getCommentText(node)
              if (safeTestPattern(commentPatterns.interactionCommentPattern, text)) {
                currentSection = 'interaction'
              } else if (safeTestPattern(commentPatterns.sharedCommentPattern, text)) {
                currentSection = 'shared'
              }
            }
            sectionMap.set(i, currentSection)
          }
          sectionBoundaryCache.set(container, sectionMap)
        }
        return sectionMap.get(nodeIndex) ?? null
      }

      const isInInteractionByComment = (node: PostcssNode): boolean => {
        const parent = node.parent
        if (!isContainer(parent) || !isRule(parent)) return false
        if (!isRuleInRootScope(parent, ROOT_WRAPPER_NAMES)) return false
        const nodeIndex = getNodeIndex(parent, node)
        if (nodeIndex === -1) return false
        return getNodeSection(parent, nodeIndex) === 'interaction'
      }

      let rootBlockName: string | null = null
      root.walkRules((rule: Rule) => {
        if (rootBlockName) return
        if (!isRuleInRootScope(rule, ROOT_WRAPPER_NAMES)) return
        if (typeof rule.selector !== 'string') return
        const selectorTexts = splitSelectors(rule.selector, selectorCache)
        const localSelectors = selectorTexts
          .map((selectorText) =>
            stripGlobalSelectorForRoot(
              selectorText,
              selectorCache,
              cacheSizes.selector,
              { preserveCombinator: true }
            )
          )
          .filter((selector): selector is string => Boolean(selector))
        if (localSelectors.length === 0) return
        const selectors = localSelectors.flatMap((selector) =>
          selectorCache.parse(selector)
        )
        const rootBlocks = collectRootBlockNames(
          selectors,
          classifyOptions,
          patterns
        )
        if (rootBlocks.length === 0) return
        rootBlockName = rootBlocks[0]
      })

      const keySameElementPseudos = new Set([':is', ':where', ':not'])
      const ruleKeys = new WeakMap<Rule, string[]>()
      const resolveKeys = (rule: Rule): string[] => {
        const cached = ruleKeys.get(rule)
        if (cached) return cached
        const selector = typeof rule.selector === 'string' ? rule.selector : ''
        const stripped = stripGlobalSelectorForRoot(
          selector,
          selectorCache,
          cacheSizes.selector,
          { preserveCombinator: true }
        )
        if (!stripped) {
          ruleKeys.set(rule, [])
          return []
        }
        const selectorTexts = splitSelectors(stripped, selectorCache)
        const keys = new Set<string>()
        selectorTexts.forEach((selectorText) => {
          const selectors = selectorCache.parse(selectorText)
          selectors.forEach((sel) => {
            const directClasses: string[] = []
            const pseudoClasses: string[] = []
            let hasNesting = false
            let hasNonSameElementClass = false
            let pseudoElement: string | null = null
            sel.walk((node) => {
              if (
                node.type === 'class' &&
                !isInsideNonSameElementPseudo(node, keySameElementPseudos)
              ) {
                if (isInsidePseudo(node)) {
                  pseudoClasses.push(node.value)
                } else {
                  directClasses.push(node.value)
                }
              }
              if (
                node.type === 'class' &&
                isInsideNonSameElementPseudo(node, keySameElementPseudos)
              ) {
                hasNonSameElementClass = true
              }
              if (node.type === 'nesting') hasNesting = true
              if (node.type === 'pseudo') {
                if (isInsideNonSameElementPseudo(node, keySameElementPseudos)) return
                const name = isPseudoElement(node.value)
                if (name) pseudoElement = name
              }
            })
            const pickBaseClass = (
              classList: string[]
            ): { name: string; kind: string } | null => {
              for (let i = classList.length - 1; i >= 0; i -= 1) {
                const name = classList[i]
                const kind = classify(name, classifyOptions, patterns)
                if (kind === 'block' || kind === 'element') return { name, kind }
              }
              return null
            }
            const base = pickBaseClass(directClasses) ?? pickBaseClass(pseudoClasses)
            if (!base) {
              if (hasNesting) {
                const parentRule = findParentRule(rule)
                if (parentRule) {
                  const parentKeys = resolveKeys(parentRule)
                  parentKeys.forEach((parentKey) => {
                    const key = pseudoElement
                      ? `${parentKey}::${pseudoElement}`
                      : parentKey
                    keys.add(key)
                  })
                }
              }
              if (hasNonSameElementClass) {
                // Selectors that only target non-same-element pseudos are out-of-scope.
                return
              }
              return
            }
            if (base.kind === 'element') {
              if (!rootBlockName) return
              const keyBase = `${rootBlockName}>${base.name}`
              const key = pseudoElement ? `${keyBase}::${pseudoElement}` : keyBase
              keys.add(key)
              return
            }
            const keyBase = base.name
            const key = pseudoElement ? `${keyBase}::${pseudoElement}` : keyBase
            keys.add(key)
          })
        })
        const list = [...keys]
        ruleKeys.set(rule, list)
        return list
      }

      const transitionedProps = new Map<string, Set<string>>()
      const addTransitionTargets = (keys: string[], props: string[]): void => {
        keys.forEach((key) => {
          const set = transitionedProps.get(key) ?? new Set<string>()
          props.forEach((prop) => set.add(prop))
          transitionedProps.set(key, set)
        })
      }

      const reportTransitionError = (
        decl: Declaration,
        prop: string,
        error: TransitionParseError
      ): void => {
        const message =
          error === 'all'
            ? messages.transitionAll(prop)
            : error === 'none'
              ? messages.transitionNone()
              : error === 'invalid'
                ? messages.invalidTransitionProperty(decl.value)
                : messages.missingTransitionProperty()
        stylelint.utils.report({ ruleName, result, node: decl, message })
      }

      const outsideDeclsByKey = new Map<string, Map<string, Declaration[]>>()
      const addOutsideDecls = (
        keys: string[],
        prop: string,
        decl: Declaration
      ): void => {
        keys.forEach((key) => {
          let propMap = outsideDeclsByKey.get(key)
          if (!propMap) {
            propMap = new Map<string, Declaration[]>()
            outsideDeclsByKey.set(key, propMap)
          }
          const list = propMap.get(prop)
          if (list) {
            list.push(decl)
          } else {
            propMap.set(prop, [decl])
          }
        })
      }
      root.walkDecls((decl: Declaration) => {
        if (isInsideKeyframes(decl)) return
        const prop = decl.prop.toLowerCase()
        const parentRule = findParentRule(decl)
        if (!parentRule) return
        const inInteraction = isInInteractionSection(decl) || isInInteractionByComment(decl)
        if (!inInteraction) {
          const keys = resolveKeys(parentRule)
          if (keys.length > 0) addOutsideDecls(keys, prop, decl)
        }
        if (!TRANSITION_PROPERTIES.has(prop) && !ANIMATION_PROPERTIES.has(prop)) return
        if (!inInteraction) {
          stylelint.utils.report({
            ruleName,
            result,
            node: decl,
            message: messages.needInteraction(
              prop,
              options.comments.interaction
            )
          })
        }

        if (TRANSITION_LIST_PROPERTIES.has(prop)) {
          const parsed =
            prop === 'transition'
              ? parseTransitionList(decl.value)
              : parseTransitionProperty(decl.value)
          if (parsed.error) {
            reportTransitionError(decl, prop, parsed.error)
            return
          }
          if (inInteraction) {
            const keys = resolveKeys(parentRule)
            if (keys.length > 0) addTransitionTargets(keys, parsed.properties)
          }
        }

      })
      outsideDeclsByKey.forEach((propMap, key) => {
        const targets = transitionedProps.get(key)
        if (!targets) return
        const label = formatTargetLabel(key)
        propMap.forEach((decls, prop) => {
          if (!targets.has(prop)) return
          decls.forEach((decl) => {
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: messages.initialOutsideInteraction(
                prop,
                label,
                options.comments.interaction
              )
            })
          })
        })
      })

      if (selectorState.hasError()) {
        stylelint.utils.report({
          ruleName,
          result,
          node: root,
          message: messages.selectorParseFailed(
            ...selectorParseFailedArgs(selectorState.getErrorSelector())
          ),
          severity: 'warning'
        })
      }
    }
  },
  meta
)

const spiracssInteractionProperties = createPlugin(ruleName, rule)

export default spiracssInteractionProperties
