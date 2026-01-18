import { testRule as rawTestRule } from 'stylelint-test-rule-node'

import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { formatNamingHint } from '../dist/esm/rules/spiracss-class-structure.patterns.js'
import { appendDocsLink } from '../dist/esm/utils/messages.js'
import type { NamingOptions } from '../dist/esm/types.js'

const normalizeRootBlock = (code: string): string =>
  code.replace(/\.block(?![\w-])/g, '.block-name')


type TestCase =
  | string
  | {
      code: string
      description?: string
      message?: string
      warnings?: Array<{ message: string }>
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

const appendDocsToMessage = (message: string | undefined, ruleName: string): string | undefined =>
  message ? appendDocsLink(message, ruleName) : message

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
      message: appendDocsLink(warning.message, ruleName)
    }))
    return {
      ...item,
      message: appendDocsToMessage(item.message, ruleName),
      warnings
    }
  })
}

type RawRuleConfig = Parameters<typeof rawTestRule>[0]
type RuleConfig = Omit<RawRuleConfig, 'accept' | 'reject'> & {
  accept?: TestCase[]
  reject?: TestCase[]
}

export const testRule = (config: RuleConfig): void => {
  const normalizedReject = normalizeRejectMessages(config.reject, config.ruleName)
  if (config.ruleName !== classStructure.ruleName) {
    rawTestRule({
      ...config,
      reject: normalizedReject
    } as RawRuleConfig)
    return
  }
  rawTestRule({
    ...config,
    accept: normalizeCases(config.accept),
    reject: normalizeRejectMessages(normalizeCases(config.reject), config.ruleName)
  } as RawRuleConfig)
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
