import path from 'path'
import type { Comment, Root, Rule } from 'postcss'
import type { Selector } from 'postcss-selector-parser'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { NON_SELECTOR_AT_RULE_NAMES } from '../utils/constants'
import { selectorParseFailedArgs } from '../utils/messages'
import {
  CACHE_SCHEMA,
  EXTERNAL_SCHEMA,
  NAMING_SCHEMA
} from '../utils/option-schema'
import { getRuleDocsUrl } from '../utils/rule-docs'
import { getCommentText, isRuleInsideAtRule } from '../utils/section'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { isPlainObject, isString, isStringArray } from '../utils/validate'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import { ruleName } from './spiracss-page-layer.constants'
import { messages } from './spiracss-page-layer.messages'
import { normalizeOptions } from './spiracss-page-layer.options'
import type { Options } from './spiracss-page-layer.types'
import {
  splitSelectors,
  stripGlobalSelectorForRoot
} from './spiracss-property-placement.selectors'
import {
  extractLinkTargets,
  normalizeRelPath,
  resolvePathCandidates
} from './spiracss-rel-comments.alias'
import { findFirstBodyNode } from './spiracss-rel-comments.root'

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Enforce page-layer boundaries for SpiraCSS page entry SCSS.',
  category: 'stylistic'
}

const optionSchema = {
  pageEntryAlias: [isString],
  pageEntrySubdir: [isString],
  componentsDirs: [isString],
  aliasRoots: [isPlainObject],
  ...NAMING_SCHEMA,
  ...EXTERNAL_SCHEMA,
  ...CACHE_SCHEMA
}

const resolvePageEntryDirs = (
  projectRoot: string,
  options: Options
): string[] => {
  const aliasRoots = options.paths.aliases
  if (!aliasRoots) return []
  const bases = aliasRoots[options.pageEntry.alias]
  if (!Array.isArray(bases) || bases.length === 0) return []
  const subdir = options.pageEntry.subdir.trim()
  const entries = bases.map((base) => {
    const resolvedBase = path.isAbsolute(base)
      ? base
      : path.resolve(projectRoot, base)
    return subdir ? path.resolve(resolvedBase, subdir) : resolvedBase
  })
  return [...new Set(entries)]
}

const isWithinDir = (target: string, rootDir: string): boolean => {
  const relative = path.relative(rootDir, target)
  if (!relative) return true
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) return false
  return !path.isAbsolute(relative)
}

const resolveComponentRoots = (projectRoot: string, options: Options): string[] =>
  options.paths.components.map((dir) =>
    path.isAbsolute(dir) ? dir : path.resolve(projectRoot, dir)
  )

const getSelectorTexts = (
  selector: string,
  selectorCache: ReturnType<typeof createSelectorCacheWithErrorFlag>['cache'],
  cacheSize: number
): string[] =>
  splitSelectors(selector, selectorCache)
    .map((selectorText) =>
      stripGlobalSelectorForRoot(selectorText, selectorCache, cacheSize, {
        preserveCombinator: true
      })
    )
    .filter((selectorText): selectorText is string => Boolean(selectorText))

const findDirectChildBlock = (
  selector: Selector,
  options: Options,
  patterns: ReturnType<typeof buildPatterns>
): string | null => {
  const nodes = selector.nodes || []
  const findChildAfter = (startIndex: number): string | null => {
    for (let i = startIndex; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (node.type === 'class') {
        const name = node.value
        return classify(name, options, patterns) === 'block' ? name : null
      }
      if (node.type === 'combinator') break
    }
    return null
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.type !== 'combinator') continue
    if (node.value.trim() !== '>') continue
    return findChildAfter(i + 1)
  }

  return null
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
      typeof primaryOption === 'object' && primaryOption !== null
        ? primaryOption
        : secondaryOption
    type RuleCache = {
      options: ReturnType<typeof normalizeOptions>
      patterns: ReturnType<typeof buildPatterns>
      hasInvalidOptions: boolean
    }
    let cache: RuleCache | null = null
    const getCache = (
      reportInvalid?: (optionName: string, value: unknown, detail?: string) => void
    ): RuleCache => {
      if (cache) return cache
      let hasInvalidOptions = false
      const handleInvalid = reportInvalid
        ? (optionName: string, value: unknown, detail?: string) => {
            hasInvalidOptions = true
            reportInvalid(optionName, value, detail)
          }
        : undefined
      const options = normalizeOptions(rawOptions, handleInvalid)
      const patterns = buildPatterns(
        { naming: options.naming, external: options.external },
        options.cache,
        handleInvalid
      )
      cache = { options, patterns, hasInvalidOptions }
      return cache
    }

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
        ['external.classes', 'external.prefixes', 'componentsDirs'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const { options, patterns, hasInvalidOptions } = getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return

      const filePath: string = (result?.opts?.from as string) || ''
      if (!filePath) return
      const projectRoot =
        (result.opts as { cwd?: string } | undefined)?.cwd ?? process.cwd()
      const pageEntryDirs = resolvePageEntryDirs(projectRoot, options)
      if (pageEntryDirs.length === 0) return
      const absoluteFilePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(projectRoot, filePath)
      const isPageEntry = pageEntryDirs.some((dir) =>
        isWithinDir(absoluteFilePath, dir)
      )
      if (!isPageEntry) return

      const cacheSizes = options.cache
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const componentRoots = resolveComponentRoots(projectRoot, options)
      const baseDir = path.dirname(absoluteFilePath)

      const hasComponentLink = (targets: string[]): boolean => {
        if (componentRoots.length === 0) return false
        const aliasRoots = options.paths.aliases ?? {}
        for (const target of targets) {
          const normalized = normalizeRelPath(target)
          const candidates = resolvePathCandidates(
            normalized,
            baseDir,
            projectRoot,
            aliasRoots
          )
          for (const candidate of candidates) {
            const resolved = path.resolve(candidate)
            if (componentRoots.some((rootDir) => isWithinDir(resolved, rootDir))) {
              return true
            }
          }
        }
        return false
      }

      root.walkRules((ruleNode: Rule) => {
        if (isRuleInsideAtRule(ruleNode, NON_SELECTOR_AT_RULE_NAMES)) return
        if (typeof ruleNode.selector !== 'string') return

        const selectorTexts = getSelectorTexts(
          ruleNode.selector,
          selectorCache,
          cacheSizes.selector
        )
        if (selectorTexts.length === 0) return

        const selectors = selectorTexts.flatMap((selectorText) =>
          selectorCache.parse(selectorText)
        )

        const childBlocks = new Set<string>()
        selectors.forEach((sel) => {
          const name = findDirectChildBlock(sel, options, patterns)
          if (name) childBlocks.add(name)
        })
        if (childBlocks.size === 0) return

        const firstNode = findFirstBodyNode(ruleNode)
        if (!firstNode || firstNode.type !== 'comment') {
          stylelint.utils.report({
            ruleName,
            result,
            node: ruleNode,
            message: messages.missingComponentLink(ruleNode.selector)
          })
          return
        }

        const commentNode = firstNode as Comment
        const commentText = getCommentText(commentNode)
        const targets = extractLinkTargets(commentText)
        if (targets.length === 0) {
          stylelint.utils.report({
            ruleName,
            result,
            node: ruleNode,
            message: messages.missingComponentLink(ruleNode.selector)
          })
          return
        }

        if (!hasComponentLink(targets)) {
          stylelint.utils.report({
            ruleName,
            result,
            node: ruleNode,
            message: messages.nonComponentLink(
              ruleNode.selector,
              options.paths.components
            )
          })
        }
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

const spiracssPageLayer = createPlugin(ruleName, rule)

export default spiracssPageLayer
