import { createMarkupRuleContext, type HtmlLintIssue } from '../generator-core'
import type { SourceIndex } from './source'
import type { MarkupConfig } from './types'

function namingConditions(naming: ReturnType<typeof createMarkupRuleContext>['naming']): {
  conditions: string[]
  effective: Record<string, unknown>
} {
  const patterns = Object.fromEntries(
    Object.entries(naming.customPatterns ?? {}).map(([key, pattern]) => [key, String(pattern)])
  )
  const effective = {
    blockCase: naming.blockCase,
    blockMaxWords: naming.blockMaxWords,
    elementCase: naming.elementCase,
    modifierCase: naming.modifierCase,
    modifierPrefix: naming.modifierPrefix,
    customPatterns: patterns
  }
  return {
    effective,
    conditions: [
      `Place exactly one Block/Element base first; Block uses ${patterns.block ?? `${effective.blockCase}, 2..${effective.blockMaxWords} words`}; Element uses ${patterns.element ?? `${effective.elementCase}, one word`}.`,
      `Additional classes must be configured Modifiers (${patterns.modifier ?? `${effective.modifierPrefix} prefix, ${effective.modifierCase}`}), u- utilities or declared external classes. Utility/modifier/special prefixes cannot become bases; Block classification takes precedence over Element.`
    ]
  }
}

/** Explain the existing decision, without changing names, policy or user intent. */
export function completeDiagnostic(
  issue: HtmlLintIssue,
  config: MarkupConfig,
  index: SourceIndex,
  context: { selectorPolicy?: boolean } = {}
): HtmlLintIssue {
  issue.kind ??= issue.code.endsWith('UNRESOLVED')
    ? 'unresolved'
    : issue.code === 'PARSE_ERROR'
      ? 'syntax'
      : 'violation'
  if (!issue.range && issue.position) issue.range = [issue.position.offset, issue.position.endOffset]
  if (issue.range) issue.position = index.position(issue.range)
  issue.reason ??= issue.message
  if (issue.reason === 'The effective selectorPolicy attribute needs static presence, value or provenance evidence.') {
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  if (
    issue.reason ===
    'The reserved selectorPolicy attribute is certainly present, but its producing attribute is not unique under the current static evidence.'
  ) {
    issue.repair = {
      conditions: [
        'This configured key is forbidden in class mode. Establish which source attribute produces it on each branch; do not assume a single winning repair range.'
      ],
      effective: { selectorPolicy: createMarkupRuleContext(config).policy }
    }
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  if (
    issue.code === 'SOURCE_RELATION_UNRESOLVED' &&
    issue.reason ===
      'Static evidence or the intended hidden/non-hidden input type is needed before deciding this exception.'
  ) {
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  if (
    issue.reason === 'Astro omitted closing tag cannot be mapped to a reliable source tree.' ||
    issue.reason === 'Astro source relation cannot be verified after successful generated parsing.'
  ) {
    issue.kind = 'unresolved'
    issue.repair = {
      conditions: [
        issue.reason.startsWith('Astro omitted')
          ? 'Write the explicit closing tag at this local Astro source boundary, then rerun lint; do not infer ancestry from generated TSX.'
          : 'The original closing boundary or source relation cannot be verified. Check expressions, comments and opening/closing correspondence in this range, then rerun lint.'
      ],
      effective: {}
    }
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  const suppliedVueBoundary =
    issue.reason ===
      'Supplied Vue AST tag boundary is unresolved: the supplied tree ends this element without an explicit end tag (a missing end tag, or an HTML implied close such as a block element inside <p>).' ||
    issue.reason ===
      'Supplied Vue AST tag boundary is unresolved: this end tag matches no open element in the supplied tree (a stray end tag, or its element was implicitly closed earlier).'
  if (
    issue.code === 'SOURCE_RELATION_UNRESOLVED' &&
    (issue.reason === 'HTML source relation is unresolved: select-dropped-start-tag.' ||
      issue.reason === 'HTML source relation is unresolved: table-foster-parenting.' ||
      issue.reason === 'HTML source relation is unresolved: non-void-self-closing.' ||
      issue.reason.startsWith('HTML recovery may affect local source relations: ') ||
      suppliedVueBoundary)
  ) {
    issue.kind = 'unresolved'
    issue.repair = {
      conditions: [
        suppliedVueBoundary
          ? 'Parent-child relationships and class names in this template were not checked using the supplied Vue AST. Check the original template with the native SpiraCSS CLI before making any edits. Do not change tags or class names based on the supplied tree alone.'
          : issue.reason === 'HTML recovery may affect local source relations: duplicate-attribute.'
            ? 'This start tag repeats class or an attribute configured in selectorPolicy, so the value that takes effect is not established. Confirm the intended attribute in the original markup at the reported location, then rerun lint. Do not pick one occurrence or rename valid classes based on this diagnostic alone.'
            : issue.reason.startsWith('HTML recovery may affect local source relations: ')
              ? 'Check the original markup at the reported location, then rerun lint. Do not rename classes to match the parser-recovered tree.'
              : 'Check the intended parent-child relationship at the reported start tag in the original markup, then rerun lint. Do not rename classes to match the parser-recovered tree.'
      ],
      effective: {}
    }
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  const blockedRepair: Record<string, string> = {
    MAX_DEPTH_EXCEEDED:
      'Simplify this source input so analysis fits the implementation safety limit; this is not a design-depth or naming rule.',
    FORMAT_UNSUPPORTED: 'Select the supported source format or provide its explicit adapter before checking markup.',
    PARSER_UNAVAILABLE: 'Supply the required format parser and host configuration before checking markup.',
    PARSER_RUNTIME_ERROR:
      'Restore parser/runtime availability or resources; this is not evidence of a source-naming violation.',
    CONFIG_INVALID: 'Correct the reported project configuration before checking markup.',
    PARSE_ERROR: 'Correct the reported source syntax within its justified original range, then rerun the parser.'
  }
  const rawTextBoundary = issue.reason.startsWith('Supplied HTML AST text boundary')
  if (blockedRepair[issue.code] || rawTextBoundary) {
    issue.kind = rawTextBoundary ? 'unresolved' : issue.code === 'PARSE_ERROR' ? 'syntax' : 'unsupported'
    issue.repair = {
      conditions: [
        rawTextBoundary
          ? 'The supplied HTML AST boundary does not match the original source, so later elements cannot be inspected. Check this range using the native CLI; do not change valid raw text or class names to fit the supplied tree.'
          : blockedRepair[issue.code]
      ],
      effective: {}
    }
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  if (issue.code === 'MULTIPLE_ROOT_ELEMENTS') {
    issue.repair = {
      conditions: [
        'Root mode checks one component root, but this source has more than one root element that can render together. Either give the source one intended root, or check a source that intentionally holds several components in selection mode. The classes on these roots are not the cause: do not rename or remove valid classes to resolve this.'
      ],
      effective: { mode: 'root' },
      missingInformation: [
        'Decide which element is the intended root, or whether this source should be checked in selection mode.'
      ]
    }
    issue.docs = 'https://spiracss.jp/tooling/html-cli/'
    return issue
  }
  const rules = createMarkupRuleContext(config)
  const naming = namingConditions(rules.naming)
  const policy = rules.policy
  const conditions = [...naming.conditions]
  const effective: Record<string, unknown> = {
    naming: naming.effective,
    external: rules.external
  }
  const missingInformation: string[] = []
  if (/MODIFIER|VARIANT|STATE/.test(issue.code) || context.selectorPolicy) {
    effective.selectorPolicy = policy
    conditions.push(
      `Use only the displayed selectorPolicy mode, reserved keys and valueNaming. Do not create ARIA attributes for decorative variants.`
    )
    if (issue.code === 'DISALLOWED_MODIFIER')
      missingInformation.push(
        'Decide whether this modifier expresses a variant or a state before replacing it with an attribute.'
      )
  }
  if (issue.code === 'ELEMENT_WITHOUT_BLOCK_ANCESTOR' || issue.code === 'ELEMENT_PARENT_OF_BLOCK') {
    conditions.push(
      'An Element needs its nearest owning Block; an Element cannot directly own a nested Block. Preserve the existing leaf-Block allowance.'
    )
    missingInformation.push('Decide the intended owner or component role before moving or renaming markup.')
  }
  if (
    issue.code === 'UNCLASSIFIED_CLASS_TOKEN' ||
    issue.code === 'MULTIPLE_BASE_CLASSES' ||
    issue.code === 'INVALID_BASE_CLASS' ||
    issue.code === 'ROOT_NOT_BLOCK'
  ) {
    missingInformation.push(
      'Choose the intended Block/Element/Modifier/external role. Do not remove or rename a class merely to silence this diagnostic.'
    )
  }
  if (issue.kind === 'unresolved')
    conditions.push(
      'Provide static evidence for this exact unknown expression or relation; do not delete dynamic behavior to obtain a pass.'
    )
  if (issue.code === 'CLASSLESS_TAG_NOT_ALLOWED') {
    effective.htmlLint = { ...rules.htmlLint, classlessTagAllowlist: [...rules.htmlLint.classlessTagAllowlist] }
    missingInformation.push(
      'Choose a style-owning class or confirm that this tag is intentionally structural before changing the allowlist.'
    )
  }
  issue.repair = { conditions, effective, ...(missingInformation.length ? { missingInformation } : {}) }
  issue.docs = 'https://spiracss.jp/tooling/html-cli/'
  return issue
}
