import path from 'path'
import type { AtRule, Root, Rule } from 'postcss'
import type { RuleContext } from 'stylelint'
import stylelint from 'stylelint'

import type { NamingOptions, WordCase } from '../types'
import { ROOT_WRAPPER_NAMES } from '../utils/constants'
import { selectorParseFailedArgs } from '../utils/messages'
import { CACHE_SCHEMA, EXTERNAL_SCHEMA, NAMING_SCHEMA } from '../utils/option-schema'
import {
  isAtRule,
  isComment,
  isInsideKeyframes,
  isKeyframesAtRule
} from '../utils/postcss-helpers'
import { isRuleInRootScope } from '../utils/section'
import { createSelectorCacheWithErrorFlag } from '../utils/selector'
import {
  createPlugin,
  createRule,
  reportInvalidOption,
  validateOptionsArrayFields
} from '../utils/stylelint'
import { getRuleDocsUrl } from '../utils/rule-docs'
import {
  isBoolean,
  isNumber,
  isPlainObject,
  isRegExp,
  isString,
  isStringArray
} from '../utils/validate'
import { buildPatterns, classify } from './spiracss-class-structure.patterns'
import { collectRootBlockNames } from './spiracss-class-structure.selectors'
import type { Options as ClassStructureOptions } from './spiracss-class-structure.types'
import { ruleName } from './spiracss-keyframes-naming.constants'
import { messages } from './spiracss-keyframes-naming.messages'
import { normalizeOptions } from './spiracss-keyframes-naming.options'
import type { Options } from './spiracss-keyframes-naming.types'

export { ruleName }

const meta = {
  url: getRuleDocsUrl(ruleName),
  fixable: false,
  description: 'Enforce SpiraCSS keyframes naming and placement.',
  category: 'stylistic'
}

const isStringOrRegExpArray = (value: unknown): value is Array<string | RegExp> =>
  Array.isArray(value) && value.every((entry) => isString(entry) || isRegExp(entry))

const optionSchema = {
  actionMaxWords: [isNumber],
  blockSource: [isString],
  blockWarnMissing: [isBoolean],
  sharedPrefixes: [isString],
  sharedFiles: [isString, isRegExp],
  ignoreFiles: [isString, isRegExp],
  ignorePatterns: [isString, isRegExp],
  ignoreSkipPlacement: [isBoolean],
  ...NAMING_SCHEMA,
  ...EXTERNAL_SCHEMA,
  ...CACHE_SCHEMA
}

const resolveActionCase = (naming?: NamingOptions): WordCase =>
  naming?.blockCase ?? 'kebab'

const actionPattern = (actionCase: WordCase, maxWords: number): RegExp => {
  const count = Math.max(1, Math.min(maxWords, 3))
  switch (actionCase) {
    case 'snake': {
      const word = '[a-z0-9]+'
      const rest = count > 1 ? `(?:_${word}){0,${count - 1}}` : ''
      return new RegExp(`^[a-z][a-z0-9]*${rest}$`)
    }
    case 'camel': {
      const head = '[a-z][a-z0-9]*'
      const rest =
        count > 1 ? `(?:[A-Z][a-zA-Z0-9]*){0,${count - 1}}` : ''
      return new RegExp(`^${head}${rest}$`)
    }
    case 'pascal': {
      const head = '[A-Z][a-z0-9]*'
      const rest =
        count > 1 ? `(?:[A-Z][a-zA-Z0-9]*){0,${count - 1}}` : ''
      return new RegExp(`^${head}${rest}$`)
    }
    case 'kebab':
    default: {
      const word = '[a-z0-9]+'
      const rest = count > 1 ? `(?:-${word}){0,${count - 1}}` : ''
      return new RegExp(`^[a-z][a-z0-9]*${rest}$`)
    }
  }
}

const getKeyframesName = (node: AtRule): string => {
  const params = typeof node.params === 'string' ? node.params.trim() : ''
  if (!params) return ''
  return params.split(/\s+/)[0]
}

const normalizePath = (value: string): string => value.replace(/\\/g, '/')
const isPlaceholderPath = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'stdin') return true
  return normalized.startsWith('<') && normalized.endsWith('>')
}

const resolveInputPath = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  return isPlaceholderPath(value) ? undefined : value
}

const isKeyframesAtEnd = (node: AtRule, root: Root): boolean => {
  const nodes = root.nodes ?? []
  let found = false
  for (const child of nodes) {
    if (child === node) {
      found = true
      continue
    }
    if (!found) continue
    if (isComment(child)) continue
    if (isAtRule(child) && isKeyframesAtRule(child)) continue
    return false
  }
  return true
}

const resolveRootBlockName = (
  root: Root,
  selectorCache: ReturnType<typeof createSelectorCacheWithErrorFlag>['cache'],
  options: Options,
  patterns: ReturnType<typeof buildPatterns>
): string | null => {
  let rootBlock: string | null = null
  root.walkRules((rule: Rule) => {
    if (rootBlock) return
    if (!isRuleInRootScope(rule, ROOT_WRAPPER_NAMES)) return
    if (typeof rule.selector !== 'string') return
    if (rule.selector.includes(':global')) return
    const selectors = selectorCache.parse(rule.selector)
    const rootBlocks = collectRootBlockNames(
      selectors,
      options as unknown as ClassStructureOptions,
      patterns
    )
    if (rootBlocks.length === 0) return
    rootBlock = rootBlocks[0]
  })
  return rootBlock
}

const resolveFileBlockName = (
  filePath: string,
  patterns: ReturnType<typeof buildPatterns>
): string | null => {
  if (!filePath) return null
  const parsed = path.parse(filePath)
  const base = parsed.name
  if (!base || base === 'index' || base.startsWith('_')) return null
  return patterns.blockRe.test(base) ? base : null
}

const matchAny = (text: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => {
    if (pattern.global || pattern.sticky) {
      pattern.lastIndex = 0
    }
    return pattern.test(text)
  })

const collectElementNames = (
  root: Root,
  selectorCache: ReturnType<typeof createSelectorCacheWithErrorFlag>['cache'],
  options: Options,
  patterns: ReturnType<typeof buildPatterns>
): Set<string> => {
  const names = new Set<string>()
  root.walkRules((rule: Rule) => {
    if (isInsideKeyframes(rule)) return
    const selector = typeof rule.selector === 'string' ? rule.selector : ''
    if (!selector || selector.includes(':global')) return
    const selectors = selectorCache.parse(selector)
    selectors.forEach((sel) => {
      sel.walkClasses((node) => {
        const name = node.value
        if (classify(name, options as unknown as ClassStructureOptions, patterns) === 'element') {
          names.add(name)
        }
      })
    })
  })
  return names
}

const getSharedPrefix = (name: string, prefixes: string[]): string | null => {
  const found = prefixes.find((prefix) => name.startsWith(prefix))
  return found ?? null
}

const validateSharedName = (
  name: string,
  prefix: string,
  actionRe: RegExp
): boolean => {
  const rest = name.slice(prefix.length)
  return actionRe.test(rest)
}

const buildNameCheck = (
  blockName: string,
  elementNames: Set<string>,
  actionRe: RegExp
): ((name: string) => boolean) => {
  const blockPrefix = `${blockName}-`
  return (name: string): boolean => {
    if (!name.startsWith(blockPrefix)) return false
    const rest = name.slice(blockPrefix.length)
    if (!rest) return false
    const parts = rest.split('-')
    if (parts.length === 1) return actionRe.test(rest)
    const [maybeElement, ...actionParts] = parts
    if (elementNames.has(maybeElement)) {
      const action = actionParts.join('-')
      return actionRe.test(action)
    }
    return actionRe.test(rest)
  }
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

      const hasInvalidArray = validateOptionsArrayFields(
        rawOptions,
        ['sharedFiles', 'ignoreFiles', 'ignorePatterns'],
        isStringOrRegExpArray,
        reportInvalid,
        (optionName) =>
          `[spiracss] ${optionName} must be an array of strings or RegExp instances.`
      )
      if (shouldValidate && hasInvalidArray) return
      const hasInvalidPrefixes = validateOptionsArrayFields(
        rawOptions,
        ['sharedPrefixes'],
        isStringArray,
        reportInvalid,
        (optionName) => `[spiracss] ${optionName} must be an array of non-empty strings.`
      )
      if (shouldValidate && hasInvalidPrefixes) return

      const options = normalizeOptions(rawOptions, reportInvalid)
      const actionCase = resolveActionCase(options.naming)
      const actionRe = actionPattern(actionCase, options.action.maxWords)
      const resultOptions = result?.opts as { from?: string; codeFilename?: string } | undefined
      const fromPath = resolveInputPath(resultOptions?.from)
      const rootFromPath = resolveInputPath(root.source?.input?.from)
      const rootFilePath = resolveInputPath(root.source?.input?.file)
      const filePath: string =
        fromPath ||
        resultOptions?.codeFilename ||
        rootFilePath ||
        rootFromPath ||
        ''
      const normalizedPath = normalizePath(filePath)
      if (options.ignore.files.length > 0 && matchAny(normalizedPath, options.ignore.files)) {
        return
      }
      const cacheSizes = options.cache
      const selectorState = createSelectorCacheWithErrorFlag(cacheSizes.selector)
      const selectorCache = selectorState.cache
      const patterns = buildPatterns(
        options as unknown as ClassStructureOptions,
        options.cache,
        reportInvalid
      )
      const elementNames = collectElementNames(root, selectorCache, options, patterns)
      const sharedFiles = options.shared.files
      const ignorePatterns = options.ignore.patterns

      const rootBlockName =
        options.block.source === 'file'
          ? null
          : resolveRootBlockName(root, selectorCache, options, patterns)
      const fileBlockName =
        options.block.source === 'selector'
          ? null
          : resolveFileBlockName(filePath, patterns)
      const blockName =
        options.block.source === 'selector'
          ? rootBlockName
          : options.block.source === 'file'
            ? fileBlockName
            : rootBlockName || fileBlockName
      const nameCheck = blockName ? buildNameCheck(blockName, elementNames, actionRe) : null
      let reportedMissingBlock = false

      root.walkAtRules((node: AtRule) => {
        if (!isKeyframesAtRule(node)) return
        const name = getKeyframesName(node)
        if (!name) return

        const isIgnoredName = ignorePatterns.length > 0 && matchAny(name, ignorePatterns)
        if (isIgnoredName && options.ignore.skipPlacement) return

        if (node.parent?.type !== 'root') {
          stylelint.utils.report({
            ruleName,
            result,
            node,
            message: messages.needRoot()
          })
          return
        }

        if (!isKeyframesAtEnd(node, root)) {
          stylelint.utils.report({
            ruleName,
            result,
            node,
            message: messages.needTail()
          })
        }

        if (isIgnoredName) return

        const sharedPrefix = getSharedPrefix(name, options.shared.prefixes)
        if (sharedPrefix) {
          if (sharedFiles.length > 0 && !matchAny(normalizedPath, sharedFiles)) {
            stylelint.utils.report({
              ruleName,
              result,
              node,
              message: messages.sharedFileOnly(name, sharedPrefix, sharedFiles)
            })
            return
          }
          if (!validateSharedName(name, sharedPrefix, actionRe)) {
            stylelint.utils.report({
              ruleName,
              result,
              node,
              message: messages.invalidSharedName(
                name,
                sharedPrefix,
                actionCase,
                options.action.maxWords
              )
            })
          }
          return
        }

        if (!nameCheck) {
          if (options.block.warnMissing && !reportedMissingBlock) {
            reportedMissingBlock = true
            stylelint.utils.report({
              ruleName,
              result,
              node,
              message: messages.missingBlock(),
              severity: 'warning'
            })
          }
          return
        }

        if (!nameCheck(name)) {
          stylelint.utils.report({
            ruleName,
            result,
            node,
            message: messages.invalidName(
              name,
              blockName ?? '(unknown)',
              actionCase,
              options.action.maxWords
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

const spiracssKeyframesNaming = createPlugin(ruleName, rule)

export default spiracssKeyframesNaming
