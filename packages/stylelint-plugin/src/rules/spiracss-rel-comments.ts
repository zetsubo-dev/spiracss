import fs from 'fs'
import path from 'path'
import type { Comment, Node, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import { createLruCache, DEFAULT_CACHE_SIZES } from '../utils/cache'
import { NON_SELECTOR_AT_RULE_NAMES, ROOT_WRAPPER_NAMES } from '../utils/constants'
import { normalizeCustomPattern } from '../utils/naming'
import {
  CACHE_SIZES_SCHEMA,
  INTERACTION_COMMENT_PATTERN_SCHEMA,
  NAMING_SCHEMA,
  SHARED_COMMENT_PATTERN_SCHEMA
} from '../utils/option-schema'
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
import {
  isAliasRoots,
  isBoolean,
  isPlainObject,
  isString,
  isStringArray
} from '../utils/validate'
import {
  extractLinkTargets,
  normalizeRelPath,
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
  url: 'https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint.md#spiracssrel-comments',
  fixable: false,
  description: 'Validate @rel and alias link comments in SpiraCSS files.',
  category: 'stylistic'
}

const optionSchema = {
  requireInScssDirectories: [isBoolean],
  requireWhenMetaLoadCss: [isBoolean],
  validatePath: [isBoolean],
  skipFilesWithoutRules: [isBoolean],
  requireChildRelComments: [isBoolean],
  requireChildRelCommentsInShared: [isBoolean],
  requireChildRelCommentsInInteraction: [isBoolean],
  requireParentRelComment: [isBoolean],
  childScssDir: [isString],
  aliasRoots: [isAliasRoots],
  ...SHARED_COMMENT_PATTERN_SCHEMA,
  ...INTERACTION_COMMENT_PATTERN_SCHEMA,
  ...NAMING_SCHEMA,
  ...CACHE_SIZES_SCHEMA,
  allowExternalClasses: [isString],
  allowExternalPrefixes: [isString]
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
        aliasRoots: options.aliasRoots || {},
        childScssDir: options.childScssDir || 'scss',
        commentPatterns: {
          sharedCommentPattern: options.sharedCommentPattern,
          interactionCommentPattern: options.interactionCommentPattern
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
        ['allowExternalClasses', 'allowExternalPrefixes'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalid) return

      const { options, aliasRoots, childScssDir, commentPatterns, hasInvalidOptions } =
        getCache(reportInvalid)
      if (shouldValidate && hasInvalidOptions) return

      const cacheSizes = options.cacheSizes ?? DEFAULT_CACHE_SIZES
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const pathExistsCache = createLruCache<string, boolean>(cacheSizes.path)
      const targetExistsCache = createLruCache<string, boolean>(cacheSizes.path)
      const filePath: string = (result?.opts?.from as string) || ''
      const inScssDir = filePath.split(path.sep).includes(childScssDir)
      const containsRules = hasRuleNodes(root)
      const needsRulesCheck = !options.skipFilesWithoutRules || containsRules
      const firstRule = getFirstRuleNode(root)
      const projectRoot =
        (result.opts as { cwd?: string } | undefined)?.cwd ?? process.cwd()
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
        if (rule.selector.includes(':global')) return

        const selectors = selectorCache.parse(rule.selector)
        const rootBlocks = collectRootBlockNames(selectors, options)
        if (rootBlocks.length === 0) return

        rootBlockRules.add(rule)
        if (!firstRootBlockRule) firstRootBlockRule = rule
      })

      const requiresMetaRel = options.requireWhenMetaLoadCss && hasMetaLoad
      const requiresScssRel = options.requireInScssDirectories && inScssDir

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
                message: messages.misplacedParentRel()
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
                message: messages.misplacedParentRel()
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
                message: messages.misplacedParentRel()
              })
            }
          }
        }
      })

      const requiresParentRel =
        needsRulesCheck &&
        options.requireParentRelComment &&
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
            message: messages.missingParentRel()
          })
        }
      }

      if (options.requireChildRelComments && needsRulesCheck) {
        allRules.forEach((rule: Rule) => {
          if (isRuleInsideAtRule(rule, NON_SELECTOR_AT_RULE_NAMES)) return
          const isShared = sharedRules.has(rule)
          const isInteraction = interactionRules.has(rule)
          if (isShared && !options.requireChildRelCommentsInShared) return
          if (isInteraction && !options.requireChildRelCommentsInInteraction) return
          const childBlocks = collectDirectChildBlocks(
            rule.selector || '',
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
              message: messages.missingChildRel()
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
              message: messages.missingChildRel()
            })
            return
          }

          const targetNames = new Set(
            targets
              .map((target) => path.basename(normalizeRelPath(target)))
              .filter((name) => Boolean(name))
          )

          childBlocks.forEach((child) => {
            if (!targetNames.has(`${child}.scss`)) {
              stylelint.utils.report({
                ruleName,
                result,
                node: rule,
                message: messages.childMismatch(child)
              })
            }
          })
        })
      }

      if (options.validatePath) {
        const baseDir = filePath ? path.dirname(filePath) : process.cwd()
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
          message: messages.selectorParseFailed(),
          severity: 'warning'
        })
      }
    }
  },
  meta
)

const spiracssRelComments = createPlugin(ruleName, rule)

export default spiracssRelComments
