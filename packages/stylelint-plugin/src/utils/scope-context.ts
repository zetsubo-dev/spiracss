import postcss, { type AtRule, type Container, type Node, type Root, type Rule } from 'postcss'
import path from 'node:path'
import selectorParser from 'postcss-selector-parser'

import type { FileNameCase, NamingOptions } from '../types'
import { formatFileBase } from './formatting'
import { buildBlockPattern } from './naming'
import { isAtRule, isRule } from './postcss-helpers'
import { isInsideNonSameElementPseudo } from './selector'

type ScopeOptions = {
  naming?: NamingOptions
  external?: { classes?: string[]; prefixes?: string[] }
  rootCase?: FileNameCase
  childFileCase?: FileNameCase
  rootFile?: boolean
}
const views = new WeakMap<Root, Map<string, { input: string; root: Root }>>()
const scopeOwners = new WeakSet<Rule>()
const ambiguousScopes = new WeakSet<AtRule>()
const ROOT_REFERENCE_PSEUDOS = new Set([':is', ':where'])

export const isScopeOwnerRule = (rule: Rule): boolean => scopeOwners.has(rule)
export const isAmbiguousScope = (scope: AtRule): boolean => ambiguousScopes.has(scope)

// Read only the scope start; the lower boundary remains on the original @scope.
export const scopeStart = (params: string): string | null => {
  const input = params.trim()
  if (!input.startsWith('(')) return null
  let depth = 0
  let quote = ''
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (!quote && char === '/' && input[index + 1] === '*') {
      const end = input.indexOf('*/', index + 2)
      if (end < 0) return null
      index = end + 1
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(') depth += 1
    if (char === ')' && --depth === 0) return input.slice(1, index).trim() || null
  }
  return null
}

export const hasScopeAncestor = (node: Node): boolean => {
  let parent: Node | undefined = node.parent
  while (parent) {
    if (isAtRule(parent) && parent.name.toLowerCase() === 'scope') return true
    parent = parent.parent
  }
  return false
}

const optionsObject = (value: unknown): ScopeOptions =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ScopeOptions) : {}

export const scopeOptions = (configuredRule: unknown, fallback: unknown): ScopeOptions => {
  const entry = Array.isArray(configuredRule) ? configuredRule : [configuredRule]
  return optionsObject(typeof entry[0] === 'object' ? entry[0] : (entry[1] ?? fallback))
}

const preserveLocations = (original: Container, cloned: Container): void => {
  const stack: Array<[Container, Container]> = [[original, cloned]]
  while (stack.length > 0) {
    const [source, target] = stack.pop()!
    target.nodes?.forEach((node, index) => {
      const originalNode = source.nodes![index]
      node.rangeBy = originalNode.rangeBy.bind(originalNode)
      if ('nodes' in node && 'nodes' in originalNode) {
        stack.push([originalNode as Container, node as Container])
      }
    })
  }
}

const nearestRule = (node: Node): Rule | undefined => {
  let parent: Node | undefined = node.parent
  while (parent) {
    if (isRule(parent)) return parent
    parent = parent.parent
  }
  return undefined
}

const isRootReference = (selector: string): boolean =>
  selector.split(',').every((item) => item.trim().toLowerCase() === ':scope' || item.trim() === '&')

const hasRootReference = (text: string): boolean => {
  if (/^\s*[>+~]/.test(text)) return true
  let found = false
  try {
    selectorParser((selectors) => {
      selectors.walk((node) => {
        if (isInsideNonSameElementPseudo(node, ROOT_REFERENCE_PSEUDOS)) return
        if (node.type === 'nesting' || (node.type === 'pseudo' && node.value.toLowerCase() === ':scope')) found = true
      })
    }).processSync(text)
  } catch {
    // Leave invalid selectors to the rule's existing diagnostics.
  }
  return found
}

const rewriteScopeReference = (text: string, relative: boolean): string => {
  try {
    return selectorParser((selectors) => {
      selectors.each((item) => {
        const first = item.nodes[0]
        const next = item.nodes[1]
        if (
          relative &&
          first?.type === 'pseudo' &&
          first.value.toLowerCase() === ':scope' &&
          next?.type === 'combinator'
        ) {
          first.remove()
          return
        }
        item.walkPseudos((node) => {
          if (node.value.toLowerCase() === ':scope') node.replaceWith(selectorParser.nesting())
        })
      })
    }).processSync(text)
  } catch {
    return text
  }
}

const scopeSubject = (text: string): string => {
  try {
    const selectors = selectorParser().astSync(text)
    const retainSubject = (selector: selectorParser.Selector): void => {
      let lastCombinator = -1
      selector.nodes.forEach((node, index) => {
        if (node.type === 'combinator') lastCombinator = index
      })
      selector.nodes.slice(0, lastCombinator + 1).forEach((node) => node.remove())
    }
    const pending = [...selectors.nodes]
    while (pending.length > 0) {
      const selector = pending.pop()!
      retainSubject(selector)
      selector.nodes.forEach((node) => {
        if (node.type === 'pseudo' && ROOT_REFERENCE_PSEUDOS.has(node.value.toLowerCase())) {
          pending.push(...(node.nodes ?? []))
        }
      })
    }
    const subjects = selectors.nodes.map((selector) => selector.toString().trim())
    return [...new Set(subjects)].join(', ')
  } catch {
    return text
  }
}

// This is a lint-only view. It never changes the stylesheet or its CSS specificity.
export const scopedLintRoot = (root: Root, options: ScopeOptions): Root => {
  const blockPattern = buildBlockPattern(options.naming)
  const externalClasses = Array.isArray(options.external?.classes)
    ? options.external.classes.filter((value) => typeof value === 'string')
    : []
  const externalPrefixes = Array.isArray(options.external?.prefixes)
    ? options.external.prefixes.filter((value) => typeof value === 'string')
    : []
  const key = `${blockPattern.source}/${blockPattern.flags}|${JSON.stringify([externalClasses, externalPrefixes, options.rootCase, options.childFileCase, options.rootFile])}`
  const cached = views.get(root)?.get(key)
  const input = root.toString()
  if (cached?.input === input) return cached.root
  const scopes: AtRule[] = []
  root.walkAtRules((node) => {
    if (node.name.toLowerCase() === 'scope' && node.nodes) scopes.push(node)
  })
  if (scopes.length === 0) {
    views.set(root, new Map([[key, { input, root }]]))
    return root
  }

  const view = root.clone()
  preserveLocations(root, view)
  const blockNames = (text: string, renderSelector = false): string[] => {
    const names: string[] = []
    try {
      selectorParser((selectors) => {
        selectors.walkClasses((node) => {
          let parent = node.parent
          while (parent) {
            if (parent.type === 'pseudo' && [':has', ':not'].includes(parent.value.toLowerCase())) return
            parent = parent.parent
          }
          if (
            externalClasses.includes(node.value) ||
            externalPrefixes.some((prefix) => node.value.startsWith(prefix))
          ) {
            return
          }
          if (blockPattern.test(node.value)) names.push(renderSelector ? node.toString() : node.value)
        })
      }).processSync(text)
    } catch {
      // Existing selector validation reports malformed selectors.
    }
    return names
  }
  const filePath = root.source?.input.file ?? ''
  const fileBase = path.basename(filePath).replace(/(?:\.module)?\.scss$/, '')
  const directoryBase = options.rootFile === false && filePath ? path.basename(path.dirname(filePath)) : ''
  const matchesFile = (name: string): boolean =>
    Boolean(fileBase) &&
    [options.rootCase ?? 'preserve', options.childFileCase ?? 'preserve'].some((fileCase) =>
      [fileBase, directoryBase].includes(formatFileBase(name, fileCase))
    )

  view.walkAtRules((scope) => {
    if (scope.name.toLowerCase() !== 'scope' || !scope.nodes) return
    let start = scopeStart(scope.params)
    if (!start) return
    if (!nearestRule(scope)) {
      start = scopeSubject(start)
      // Prelude conditions select scope roots, not style-rule states or ancestors.
      const names = blockNames(start, true)
      if (names.length > 0) start = [...new Set(names)].join(', ')
    }
    const bodyRules: Rule[] = []
    const bodyScopes: AtRule[] = []
    let hasRootContent = false
    let hasRelativeRule = false
    scope.walk((node) => {
      let parent: Node | undefined = node.parent
      while (parent && parent !== scope) {
        if (isRule(parent) || (isAtRule(parent) && parent.name.toLowerCase() === 'scope')) return
        parent = parent.parent
      }
      if (isRule(node)) {
        bodyRules.push(node)
        if (hasRootReference(node.selector)) {
          hasRootContent = true
          if (!isRootReference(node.selector)) hasRelativeRule = true
        }
      } else if (isAtRule(node) && node.name.toLowerCase() === 'scope') {
        bodyScopes.push(node)
      } else if (node.type === 'decl') {
        hasRootContent = true
      }
    })
    // Preserve existing thematic scopes wrapping an explicit component selector.
    const ownsFile = blockNames(scopeSubject(start)).some(matchesFile)
    if (!ownsFile && bodyRules.some((node) => blockNames(node.selector).some(matchesFile))) return
    if (
      !ownsFile &&
      bodyScopes.some((node) => {
        const names = blockNames(scopeSubject(scopeStart(node.params) ?? ''))
        return names.some(matchesFile)
      })
    )
      return
    if (
      !ownsFile &&
      !hasRelativeRule &&
      bodyScopes.some((node) => blockNames(scopeStart(node.params) ?? '').length > 0)
    ) {
      if (blockNames(start).length > 0) ambiguousScopes.add(scope)
      return
    }
    if (!hasRelativeRule && !ownsFile && bodyRules.some((node) => blockNames(node.selector).length > 0)) return
    if (!hasRootContent && blockNames(start).length === 0) return

    // A nested scope start refers to the outer scope, while its body refers to the new root.
    if (hasScopeAncestor(scope) && nearestRule(scope)) {
      start = rewriteScopeReference(start, true)
    }
    const owner = postcss.rule({ selector: start, source: scope.source })
    scopeOwners.add(owner)
    owner.rangeBy = () => scope.rangeBy({})
    const nodes = [...scope.nodes]
    scope.removeAll()
    scope.append(owner)
    owner.append(nodes)

    // Flatten repeated root references without inventing duplicate Block definitions.
    owner.walkRules((rule) => {
      if (nearestRule(rule) !== owner) return
      let enclosing: Node | undefined = rule.parent
      while (enclosing && enclosing !== owner) {
        if (isAtRule(enclosing) && enclosing.name.toLowerCase() === 'scope') return
        enclosing = enclosing.parent
      }
      if (isRootReference(rule.selector)) {
        rule.replaceWith(...(rule.nodes ?? []))
        return
      }
      const originalRange = rule.rangeBy.bind(rule)
      const selector = rewriteScopeReference(rule.selector, true)
      if (selector !== rule.selector) {
        rule.selector = selector.trim()
        rule.rangeBy = () => originalRange({})
      }
    })
    owner.walkAtRules('at-root', (node) => {
      if (nearestRule(node) === owner && node.params.trim() === ':scope') node.params = '&'
    })
  })

  const cache = views.get(root) ?? new Map<string, { input: string; root: Root }>()
  cache.set(key, { input, root: view })
  views.set(root, cache)
  return view
}
