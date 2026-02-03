import assert from 'node:assert/strict'

import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { formatNamingHint } from '../dist/esm/rules/spiracss-class-structure.patterns.js'
import type { NamingOptions } from '../dist/esm/types.js'
import { appendDocsLink } from '../dist/esm/utils/messages.js'
import type { LintOptions, LintResult } from './stylelint-helpers.js'
import { lint } from './stylelint-helpers.js'

const normalizeRootBlock = (code: string): string =>
  code.replace(/\.block(?![\w-])/g, '.block-name')


type TestCase =
  | string
  | {
      code: string
      description?: string
      message?: string
      warnings?: Array<{ message: string }>
      codeFilename?: string
      noNormalizeRootBlock?: boolean
    }

const normalizeCases = (cases: TestCase[] | undefined): TestCase[] | undefined => {
  if (!cases) return cases
  return cases.map((item) => {
    if (typeof item === 'string') return normalizeRootBlock(item)
    if (!item || typeof item !== 'object') return item
    if (item.noNormalizeRootBlock) return item
    if (typeof item.code !== 'string') return item
    return { ...item, code: normalizeRootBlock(item.code) }
  })
}

type MessageKeyMatcher = {
  key: string
  test: (message: string) => boolean
}

const messageKeyMatchers: Record<string, MessageKeyMatcher[]> = {
  'spiracss/class-structure': [
    {
      key: 'invalidName',
      test: (message) =>
        message.startsWith('Class `') &&
        message.includes('is not a valid SpiraCSS Block/Element/Modifier')
    },
    { key: 'elementChainTooDeep', test: (message) => message.startsWith('Element chain is too deep:') },
    { key: 'elementCannotOwnBlock', test: (message) => message.includes('cannot contain a Block') },
    { key: 'blockDescendantSelector', test: (message) => message.startsWith('Avoid chained selectors under') },
    {
      key: 'blockTargetsGrandchildElement',
      test: (message) => message.startsWith('Do not style grandchild Elements from')
    },
    { key: 'tooDeepBlockNesting', test: (message) => message.includes('is nested too deeply') },
    { key: 'multipleRootBlocks', test: (message) => message.startsWith('Only one root Block is allowed per file.') },
    { key: 'needChild', test: (message) => message.startsWith('Use a direct-child combinator under the Block:') },
    { key: 'needChildNesting', test: (message) => message.startsWith('Do not write child selectors at the top level.') },
    { key: 'sharedNeedRootBlock', test: (message) => message.startsWith('Place the shared section comment matching') },
    { key: 'needAmpForMod', test: (message) => message.startsWith('Write modifier classes inside the Block using') },
    { key: 'needModifierPrefix', test: (message) => message.startsWith('Only modifier classes may be appended to') },
    { key: 'disallowedModifier', test: (message) => message.startsWith('Modifier classes are disabled because') },
    {
      key: 'invalidVariantAttribute',
      test: (message) =>
        message.startsWith('Attribute `data-variant`') &&
        message.includes('selectorPolicy.variant.mode')
    },
    {
      key: 'invalidStateAttribute',
      test: (message) =>
        message.startsWith('Attribute `') &&
        message.includes('selectorPolicy.state.mode')
    },
    { key: 'invalidDataValue', test: (message) => message.includes('does not match `selectorPolicy` valueNaming') },
    {
      key: 'rootSelectorMissingBlock',
      test: (message) =>
        message.startsWith('Root selector') && message.includes('must include the root Block')
    },
    { key: 'missingRootBlock', test: (message) => message.startsWith('No root Block found.') },
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') },
    { key: 'fileNameMismatch', test: (message) => message.startsWith('Root Block `.') }
  ],
  'spiracss/interaction-properties': [
    {
      key: 'needInteraction',
      test: (message) =>
        message.includes('must be declared inside the SpiraCSS interaction section')
    },
    {
      key: 'missingTransitionProperty',
      test: (message) => message.startsWith('Transition must include explicit property names')
    },
    { key: 'transitionAll', test: (message) => message.startsWith('Avoid `transition') && message.includes('all`') },
    { key: 'transitionNone', test: (message) => message.startsWith('`transition: none`') },
    {
      key: 'invalidTransitionProperty',
      test: (message) =>
        message.startsWith('Transition property') && message.includes('is not allowed')
    },
    { key: 'initialOutsideInteraction', test: (message) => message.includes('is transitioned for') },
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') }
  ],
  'spiracss/interaction-scope': [
    { key: 'needAtRoot', test: (message) => message.startsWith('When `requireAtRoot` is enabled') },
    { key: 'needComment', test: (message) => message.startsWith('Add the interaction comment matching') },
    {
      key: 'needTail',
      test: (message) =>
        message.startsWith('Place the `@at-root` interaction block at the end of the root Block')
    },
    {
      key: 'needRootBlock',
      test: (message) =>
        message.startsWith('The interaction block must be directly under the root Block.')
    },
    { key: 'mixedStateVariant', test: (message) => message.startsWith('Do not mix state selectors') },
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') }
  ],
  'spiracss/keyframes-naming': [
    { key: 'needRoot', test: (message) => message.startsWith('Place `@keyframes` at the root level') },
    { key: 'needTail', test: (message) => message.startsWith('Place `@keyframes` at the end of the file') },
    {
      key: 'sharedFileOnly',
      test: (message) =>
        message.startsWith('Shared keyframes `') &&
        message.includes('must be defined in a shared keyframes file')
    },
    {
      key: 'invalidSharedName',
      test: (message) =>
        message.startsWith('Shared keyframes `') && message.includes('must follow')
    },
    { key: 'invalidName', test: (message) => message.startsWith('Keyframes `') },
    {
      key: 'missingBlock',
      test: (message) =>
        message.startsWith('Cannot determine the root Block for `@keyframes` naming.')
    },
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') }
  ],
  'spiracss/property-placement': [
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') },
    { key: 'selectorResolutionSkipped', test: (message) => message.startsWith('Selector resolution exceeded') },
    {
      key: 'selectorKindMismatch',
      test: (message) => message.startsWith('Selector list mixes incompatible kinds')
    },
    {
      key: 'pageRootNoChildren',
      test: (message) => message.includes('Page-layer roots must be used alone')
    },
    {
      key: 'pageRootContainer',
      test: (message) =>
        message.includes('Page roots are decoration-only') &&
        message.includes('container property')
    },
    {
      key: 'pageRootItem',
      test: (message) =>
        message.includes('Page roots are decoration-only') && message.includes('item property')
    },
    {
      key: 'pageRootInternal',
      test: (message) =>
        message.includes('Page roots are decoration-only') &&
        message.includes('an internal property')
    },
    { key: 'forbiddenAtRoot', test: (message) => message.startsWith('`@at-root` is not allowed in basic/shared sections.') },
    { key: 'forbiddenExtend', test: (message) => message.startsWith('`@extend` is not allowed in SpiraCSS.') },
    { key: 'marginSideViolation', test: (message) => message.includes('violates the margin-side rule') },
    {
      key: 'containerInChildBlock',
      test: (message) =>
        message.includes('container property') &&
        message.includes('child Block selector')
    },
    {
      key: 'internalInChildBlock',
      test: (message) =>
        message.includes("internal property (affects the Block's own content/layout)") &&
        message.includes('child Block selector')
    },
    {
      key: 'itemInRoot',
      test: (message) =>
        message.includes('item property and cannot be placed on a root Block selector')
    },
    {
      key: 'positionInChildBlock',
      test: (message) => message.startsWith('`position:') && message.includes('child Block selector')
    }
  ],
  'spiracss/page-layer': [
    {
      key: 'missingComponentLink',
      test: (message) =>
        message.startsWith('Direct child Blocks in page entry SCSS require a link comment')
    },
    {
      key: 'nonComponentLink',
      test: (message) =>
        message.startsWith('Link comments for page-layer child Blocks must resolve to the component layer')
    },
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') }
  ],
  'spiracss/pseudo-nesting': [
    { key: 'needNesting', test: (message) => message.startsWith('Pseudo selectors must be nested with') },
    { key: 'selectorParseFailed', test: (message) => message.startsWith('Failed to parse one or more selectors') }
  ]
}

const resolveMessageKey = (message: string, ruleName: string): string | undefined => {
  const matchers = messageKeyMatchers[ruleName]
  if (!matchers) return undefined
  const normalized = message.trim()
  for (const matcher of matchers) {
    if (matcher.test(normalized)) return matcher.key
  }
  return undefined
}

const appendDocsToMessage = (message: string | undefined, ruleName: string): string | undefined => {
  if (!message) return message
  return appendDocsLink(message, ruleName, resolveMessageKey(message, ruleName))
}

const normalizeRejectMessages = (
  cases: TestCase[] | undefined,
  ruleName: string
): TestCase[] | undefined => {
  if (!cases) return cases
  return cases.map((item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return item
    const warnings = item.warnings?.map((warning) => ({
      ...warning,
      message: appendDocsToMessage(warning.message, ruleName) ?? warning.message
    }))
    return {
      ...item,
      message: appendDocsToMessage(item.message, ruleName),
      warnings
    }
  })
}

type RuleConfig = {
  ruleName: string
  plugins: Array<unknown>
  config: unknown
  accept?: TestCase[]
  reject?: TestCase[]
  customSyntax?: string
  syntax?: string
}

const normalizeCaseItem = (item: TestCase): Exclude<TestCase, string> =>
  typeof item === 'string' ? { code: item } : item

const createLintOptions = (
  config: RuleConfig,
  code: string,
  codeFilename?: string
): LintOptions => {
  const lintOptions: LintOptions = {
    code,
    config: {
      plugins: config.plugins,
      rules: {
        [config.ruleName]: config.config
      }
    }
  }
  if (codeFilename) lintOptions.codeFilename = codeFilename
  if (config.customSyntax) lintOptions.customSyntax = config.customSyntax
  if (config.syntax) lintOptions.syntax = config.syntax
  return lintOptions
}

const lintCode = async (
  config: RuleConfig,
  item: TestCase
): Promise<LintResult> => {
  const caseItem = normalizeCaseItem(item)
  const lintOptions = createLintOptions(config, caseItem.code, caseItem.codeFilename)
  return lint(lintOptions)
}

export const testRule = (config: RuleConfig): void => {
  const normalizedReject = normalizeRejectMessages(config.reject, config.ruleName)
  const acceptCases =
    config.ruleName === classStructure.ruleName ? normalizeCases(config.accept) : config.accept
  const rejectCases =
    config.ruleName === classStructure.ruleName
      ? normalizeRejectMessages(normalizeCases(config.reject), config.ruleName)
      : normalizedReject

  const runAccept = (item: TestCase, index: number) => {
    const caseItem = normalizeCaseItem(item)
    const title = caseItem.description ? `accepts ${caseItem.description}` : `accepts case ${index + 1}`
    it(title, async () => {
      const result = await lintCode(config, caseItem)
      const warnings = result.results[0]?.warnings ?? []
      const messages = warnings.map((warning) => warning.text)
      assert.strictEqual(
        warnings.length,
        0,
        messages.length ? `Expected no warnings, but got:\n${messages.join('\n')}` : undefined
      )
    })
  }

  const runReject = (item: TestCase, index: number) => {
    const caseItem = normalizeCaseItem(item)
    const title = caseItem.description ? `rejects ${caseItem.description}` : `rejects case ${index + 1}`
    it(title, async () => {
      const result = await lintCode(config, caseItem)
      const warnings = result.results[0]?.warnings ?? []
      const messages = warnings.map((warning) => warning.text)
      if (caseItem.warnings?.length) {
        const expected = caseItem.warnings.map((warning) => warning.message)
        assert.deepStrictEqual(messages, expected)
        return
      }
      if (caseItem.message) {
        assert.strictEqual(
          warnings.length,
          1,
          messages.length ? `Expected 1 warning, but got:\n${messages.join('\n')}` : undefined
        )
        assert.strictEqual(messages[0], caseItem.message)
        return
      }
      assert.ok(messages.length > 0, 'Expected warnings, but got none.')
    })
  }

  acceptCases?.forEach((item, index) => runAccept(item, index))
  rejectCases?.forEach((item, index) => runReject(item, index))
}

const classModeSelectorPolicy = {
  variant: { mode: 'class' as const },
  state: { mode: 'class' as const }
}

const dataModeSelectorPolicy = {
  variant: { mode: 'data' as const, dataKeys: ['data-variant'] },
  state: {
    mode: 'data' as const,
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
  }
}

export const withClassMode = (config: Record<string, unknown>) => {
  const { selectorPolicy, ...rest } = config
  return {
    ...rest,
    selectorPolicy: selectorPolicy ?? classModeSelectorPolicy
  }
}

export const withDataMode = (config: Record<string, unknown>) => {
  const { selectorPolicy, ...rest } = config
  return {
    ...rest,
    selectorPolicy: selectorPolicy ?? dataModeSelectorPolicy
  }
}

const buildNamingHint = (naming: NamingOptions = {}): string =>
  formatNamingHint({ naming })

export const invalidNameMessage = (cls: string, naming?: NamingOptions) =>
  `Class \`${cls}\` is not a valid SpiraCSS Block/Element/Modifier. Rename it to match the configured naming rules. ${buildNamingHint(naming)} (spiracss/class-structure)`
