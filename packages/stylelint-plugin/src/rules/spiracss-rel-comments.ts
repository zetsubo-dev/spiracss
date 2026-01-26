import fs from 'fs'
import path from 'path'
import type { Comment, Node, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import type { FileNameCase } from '../types'
import { createLruCache } from '../utils/cache'
import { NON_SELECTOR_AT_RULE_NAMES, ROOT_WRAPPER_NAMES } from '../utils/constants'
import { formatFileBase } from '../utils/formatting'
import { selectorParseFailedArgs } from '../utils/messages'
import { normalizeCustomPattern } from '../utils/naming'
import {
  CACHE_SCHEMA,
  COMMENTS_SCHEMA,
  EXTERNAL_SCHEMA,
  NAMING_SCHEMA
} from '../utils/option-schema'
import { getRuleDocsUrl } from '../utils/rule-docs'
import {
  getCommentText,
  isRuleInRootScope,
  isRuleInsideAtRule,
  markInteractionRules,
  markSharedRules
} from '../utils/section'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { isBoolean, isPlainObject, isString, isStringArray } from '../utils/validate'
import {
  splitSelectors,
  stripGlobalSelector,
  stripGlobalSelectorForRoot
} from './spiracss-property-placement.selectors'
import {
  extractLinkTargets,
  normalizeRelPath,
  resolveAliasCandidates,
  resolvePathCandidates
} from './spiracss-rel-comments.alias'
import { ruleName } from './spiracss-rel-comments.constants'
import { messages } from './spiracss-rel-comments.messages'
import { normalizeOptions } from './spiracss-rel-comments.options'
import {
  findFirstBodyNode,
  findTopRelComment,
  getFirstRuleNode,
  getFirstRuleNodeInScope,
  getRootScopeContainer,
  hasMetaLoadCss,
  hasRuleNodes
} from './spiracss-rel-comments.root'
import {
  collectDirectChildBlocks,
  collectRootBlockNames
} from './spiracss-rel-comments.selectors'
import type { AliasRoots, RelComment } from './spiracss-rel-comments.types'

// SpiraCSS: @rel and alias link comment rule.
// - Child SCSS under /scss/ must link to its parent via @rel.
// - Parent SCSS with @include meta.load-css("scss") must also include @rel.
// - Direct child blocks require a link comment (shared required, interaction optional).
// - Comment paths (@rel / @assets / @components) must resolve to existing files.

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Validate @rel and alias link comments in SpiraCSS files.',
  category: 'stylistic'
}

const ALIAS_KEY_PATTERN = /^[a-z][a-z0-9-]*$/

const stripAliasPrefix = (target: string): string => {
  if (!target.startsWith('@')) return target
  const withoutAt = target.slice(1)
  const slashIndex = withoutAt.indexOf('/')
  if (slashIndex === -1) return ''
  return withoutAt.slice(slashIndex + 1)
}

const targetUsesChildDir = (
  target: string,
  childDir: string,
  baseDir: string,
  projectRoot: string,
  aliasRoots: AliasRoots
): boolean => {
  if (!childDir) return false
  const candidates = resolvePathCandidates(target, baseDir, projectRoot, aliasRoots)
  if (candidates.some((candidate) => candidate.split(path.sep).includes(childDir))) {
    return true
  }
  if (candidates.length > 0) return false
  const normalized = target.replace(/\\/g, '/')
  const stripped = stripAliasPrefix(normalized)
  const segments = stripped.split('/').filter(Boolean)
  return segments.includes(childDir)
}

const buildExpectedFiles = (child: string, fileCase: FileNameCase): string[] => {
  const expectedBase = formatFileBase(child, fileCase)
  return [`${expectedBase}.scss`, `${expectedBase}.module.scss`]
}

const optionSchema = {
  requireScss: [isBoolean],
  requireMeta: [isBoolean],
  requireParent: [isBoolean],
  requireChild: [isBoolean],
  requireChildShared: [isBoolean],
  requireChildInteraction: [isBoolean],
  validatePath: [isBoolean],
  skipNoRules: [isBoolean],
  childDir: [isString],
  aliasRoots: [isPlainObject],
  fileCase: [isString],
  childFileCase: [isString],
  ...COMMENTS_SCHEMA,
  ...NAMING_SCHEMA,
  ...EXTERNAL_SCHEMA,
  ...CACHE_SCHEMA
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
    type RuleCache = {
      options: ReturnType<typeof normalizeOptions>
      aliasRoots: AliasRoots
      childScssDir: string
      commentPatterns: { sharedCommentPattern: RegExp; interactionCommentPattern: RegExp }
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
      const customPatterns = options.naming?.customPatterns
      if (customPatterns) {
        normalizeCustomPattern(
          customPatterns.block,
          'naming.customPatterns.block',
          handleInvalid
        )
        normalizeCustomPattern(
          customPatterns.element,
          'naming.customPatterns.element',
          handleInvalid
        )
        normalizeCustomPattern(
          customPatterns.modifier,
          'naming.customPatterns.modifier',
          handleInvalid
        )
      }
      cache = {
        options,
        aliasRoots: options.paths.aliases || {},
        childScssDir: options.paths.childDir || 'scss',
        commentPatterns: {
          sharedCommentPattern: options.comments.shared,
          interactionCommentPattern: options.comments.interaction
        },
        hasInvalidOptions
      }
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
        ['external.classes', 'external.prefixes'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const { options, aliasRoots, childScssDir, commentPatterns, hasInvalidOptions } =
        getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return
      const cacheSizes = options.cache
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const pathExistsCache = createLruCache<string, boolean>(cacheSizes.path)
      const targetExistsCache = createLruCache<string, boolean>(cacheSizes.path)
      const checkPathExists = (candidate: string): boolean => {
        const cached = pathExistsCache.get(candidate)
        if (cached !== undefined) return cached
        const exists = fs.existsSync(candidate)
        pathExistsCache.set(candidate, exists)
        return exists
      }
      const filePath: string = (result?.opts?.from as string) || ''
      const baseDir = filePath ? path.dirname(filePath) : process.cwd()
      const inScssDir = filePath.split(path.sep).includes(childScssDir)
      const containsRules = hasRuleNodes(root)
      const needsRulesCheck = !options.skip.noRules || containsRules
      const firstRule = getFirstRuleNode(root)
      const projectRoot =
        (result.opts as { cwd?: string } | undefined)?.cwd ?? process.cwd()
      const aliasKeys = Object.keys(aliasRoots).filter((key) => {
        if (!ALIAS_KEY_PATTERN.test(key) || key === 'rel') return false
        const bases = Array.isArray(aliasRoots[key]) ? aliasRoots[key] : []
        if (bases.length === 0) return false
        const hasExistingBase = bases.some((base) => {
          const resolvedBase = path.isAbsolute(base)
            ? base
            : path.resolve(projectRoot, base)
          return checkPathExists(resolvedBase)
        })
        if (!hasExistingBase) return false
        return resolveAliasCandidates(`@${key}`, projectRoot, aliasRoots).length > 0
      })
      const hasMetaLoad = hasMetaLoadCss(root, childScssDir)
      const sharedRules = markSharedRules(root, commentPatterns)
      const interactionRules = markInteractionRules(root, commentPatterns)
      const rootBlockRules = new WeakSet<Rule>()
      let firstRootBlockRule: Rule | null = null
      let hasMisplacedParentRel = false

      const allRules: Rule[] = []
      root.walkRules((rule: Rule) => {
        allRules.push(rule)
        if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
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
        const rootBlocks = collectRootBlockNames(selectors, options)
        if (rootBlocks.length === 0) return

        rootBlockRules.add(rule)
        if (!firstRootBlockRule) firstRootBlockRule = rule
      })

      const requiresMetaRel = options.require.meta && hasMetaLoad
      const requiresScssRel = options.require.scss && inScssDir

      const relComments: RelComment[] = []

      root.walkComments((comment: Comment) => {
        const text = getCommentText(comment)
        const targets = extractLinkTargets(text)
        targets.forEach((target) => {
          relComments.push({ target, node: comment })
        })

        const parentRule = comment.parent
        const isRel = targets.length > 0

        if (parentRule?.type === 'rule' && isRel) {
          const ruleNode = parentRule as Rule
          const isRootBlock = rootBlockRules.has(ruleNode)
          if (hasMetaLoad) {
            // Parent SCSS: forbid @rel inside the root Block (parent link must be at file top).
            if (isRootBlock) {
              stylelint.utils.report({
                ruleName,
                result,
                node: comment,
                message: messages.misplacedParentRel(aliasKeys)
              })
              hasMisplacedParentRel = true
            }
          } else {
            // Child SCSS: forbid @rel inside the root Block (parent link must be at file top).
            if (isRootBlock) {
              stylelint.utils.report({
                ruleName,
                result,
                node: comment,
                message: messages.misplacedParentRel(aliasKeys)
              })
              hasMisplacedParentRel = true
              return
            }
            // For other Blocks, only allow the leading comment.
            const nodes = ruleNode.nodes ?? []
            const idx = nodes.indexOf(comment)
            if (idx > 0) {
              stylelint.utils.report({
                ruleName,
                result,
                node: comment,
                message: messages.misplacedParentRel(aliasKeys)
              })
            }
          }
        }
      })

      const requiresParentRel =
        needsRulesCheck &&
        options.require.parent &&
        (requiresMetaRel || requiresScssRel)

      if (requiresParentRel) {
        if (firstRootBlockRule) {
          const scope = getRootScopeContainer(firstRootBlockRule)
          const firstRuleInScope = getFirstRuleNodeInScope(scope)
          if (firstRuleInScope && firstRuleInScope !== firstRootBlockRule) {
            stylelint.utils.report({
              ruleName,
              result,
              node: firstRootBlockRule,
              message: messages.rootBlockNotFirst()
            })
          }
        }

        const relLeading = findTopRelComment(root)
        if (!relLeading && !hasMisplacedParentRel) {
          const targetNode: Node = root.first ?? root
          stylelint.utils.report({
            ruleName,
            result,
            node: targetNode,
            message: messages.missingParentRel(aliasKeys)
          })
        }
      }

      if (options.require.child.enabled && needsRulesCheck) {
        allRules.forEach((rule: Rule) => {
          if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
          const isShared = sharedRules.has(rule)
          const isInteraction = interactionRules.has(rule)
          if (isShared && !options.require.child.shared) return
          if (isInteraction && !options.require.child.interaction) return
          const strippedSelector =
            stripGlobalSelector(rule.selector || '', selectorCache, cacheSizes.selector, {
              preserveCombinator: true
            }) ?? ''
          const childBlocks = collectDirectChildBlocks(
            strippedSelector,
            options,
            selectorCache
          )
          if (childBlocks.length === 0) return

          const firstNode = findFirstBodyNode(rule)
          if (!firstNode || firstNode.type !== 'comment') {
            stylelint.utils.report({
              ruleName,
              result,
              node: rule,
              message: messages.missingChildRel(aliasKeys)
            })
            return
          }

          const commentNode = firstNode as Comment
          const commentText: string = commentNode.text || ''
          const targets = extractLinkTargets(commentText)
          if (targets.length === 0) {
            stylelint.utils.report({
              ruleName,
              result,
              node: rule,
              message: messages.missingChildRel(aliasKeys)
            })
            return
          }

          const targetInfos = targets
            .map((target) => normalizeRelPath(target))
            .filter((target) => Boolean(target))
            .map((target) => ({
              baseName: path.basename(target),
              usesChildDir: targetUsesChildDir(
                target,
                childScssDir,
                baseDir,
                projectRoot,
                aliasRoots
              )
            }))
            .filter((info) => Boolean(info.baseName))

          const hasDefaultTargets = targetInfos.some((info) => !info.usesChildDir)
          const hasChildDirTargets = targetInfos.some((info) => info.usesChildDir)

          childBlocks.forEach((child) => {
            const expectedDefault = buildExpectedFiles(child, options.fileCase)
            const childFileCase = options.childFileCase ?? options.fileCase
            const expectedChildDir = buildExpectedFiles(child, childFileCase)
            const hasExpected = targetInfos.some((info) => {
              const expected = info.usesChildDir ? expectedChildDir : expectedDefault
              return expected.includes(info.baseName)
            })
            if (!hasExpected) {
              const expectedFiles = [
                ...(hasDefaultTargets ? expectedDefault : []),
                ...(hasChildDirTargets ? expectedChildDir : [])
              ]
              const uniqueExpected = Array.from(new Set(expectedFiles))
              stylelint.utils.report({
                ruleName,
                result,
                node: rule,
                message: messages.childMismatch(child, uniqueExpected)
              })
            }
          })
        })
      }

      if (options.validate.path) {
        const pathExists = (candidate: string): boolean => {
          if (pathExistsCache.has(candidate)) {
            return pathExistsCache.get(candidate) as boolean
          }
          let exists = false
          try {
            exists = fs.existsSync(candidate)
          } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code
            if (
              code === 'ENOENT' ||
              code === 'EACCES' ||
              code === 'EPERM' ||
              code === 'ELOOP' ||
              code === 'EISDIR' ||
              code === 'ENOTDIR'
            ) {
              exists = false
            } else {
              throw error
            }
          }
          pathExistsCache.set(candidate, exists)
          return exists
        }
        const targetExists = (normalized: string): boolean => {
          if (targetExistsCache.has(normalized)) {
            return targetExistsCache.get(normalized) as boolean
          }
          const candidates = resolvePathCandidates(normalized, baseDir, projectRoot, aliasRoots)
          const exists = candidates.some((p) => pathExists(p))
          targetExistsCache.set(normalized, exists)
          return exists
        }

        relComments.forEach(({ target, node }) => {
          const normalized = normalizeRelPath(target)
          if (!normalized) return

          const exists = targetExists(normalized)
          if (!exists) {
            stylelint.utils.report({
              ruleName,
              result,
              node,
              message: messages.notFound(normalized)
            })
          }
        })
      }

      if (selectorState.hasError()) {
        const targetNode: Node = firstRule ?? root.first ?? root
        stylelint.utils.report({
          ruleName,
          result,
          node: targetNode,
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

const spiracssRelComments = createPlugin(ruleName, rule)

export default spiracssRelComments
