import {
  createRuleMessages,
  formatCode,
  formatList,
  formatSelectorParseFailed,
  type RuleMessageArgs
} from '../utils/messages'
import { ruleName } from './spiracss-page-layer.constants'

export const messages = createRuleMessages(ruleName, {
  missingComponentLink: (selector: string) =>
    'Direct child Blocks in page entry SCSS require a link comment to a component file. ' +
    `Selector: ${formatCode(selector)}. ` +
    `Add a link comment as the first node in the rule (e.g., ${formatCode(
      '// @components/...'
    )}).`,
  nonComponentLink: (selector: string, components: string[]) =>
    'Link comments for page-layer child Blocks must resolve to the component layer. ' +
    `Selector: ${formatCode(selector)}. ` +
    `Components: ${formatList(components)}.`,
  selectorParseFailed: (...args: RuleMessageArgs) =>
    formatSelectorParseFailed(args[0] as string | undefined)
})
