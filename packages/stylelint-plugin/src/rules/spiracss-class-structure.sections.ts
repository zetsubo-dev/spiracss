import type { Root, Rule } from 'postcss'

import { ROOT_WRAPPER_NAMES } from '../utils/constants'
import { isRule } from '../utils/postcss-helpers'
import type { CommentPatterns } from '../utils/section'
import {
  isRuleInRootScope,
  markInteractionRules as markInteractionSection,
  markSharedRules as markSharedSection
} from '../utils/section'

export const markSharedRules = (
  root: Root,
  patterns: CommentPatterns,
  rootBlockRules: WeakSet<Rule>
): WeakSet<Rule> =>
  markSharedSection(root, patterns, (_comment, parent) =>
    isRule(parent) && rootBlockRules.has(parent as Rule)
  )

export const markInteractionRules = (
  root: Root,
  patterns: CommentPatterns,
  rootBlockRules: WeakSet<Rule>
): WeakSet<Rule> =>
  markInteractionSection(root, patterns, (_comment, parent) =>
    isRule(parent) && rootBlockRules.has(parent as Rule)
  )

export const isRootBlockRule = (rule: Rule): boolean =>
  isRuleInRootScope(rule, ROOT_WRAPPER_NAMES)
