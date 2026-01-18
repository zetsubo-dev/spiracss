const DOCS_BASE_URL =
  'https://github.com/zetsubo-dev/spiracss/blob/master/docs_spira/ja/tooling/stylelint-rules'

const RULE_DOCS_PATHS: Record<string, string> = {
  'spiracss/class-structure': 'class-structure.md',
  'spiracss/property-placement': 'property-placement.md',
  'spiracss/interaction-scope': 'interaction-scope.md',
  'spiracss/interaction-properties': 'interaction-properties.md',
  'spiracss/keyframes-naming': 'keyframes-naming.md',
  'spiracss/pseudo-nesting': 'pseudo-nesting.md',
  'spiracss/rel-comments': 'rel-comments.md'
}

export const getRuleDocsUrl = (ruleName: string): string => {
  const path = RULE_DOCS_PATHS[ruleName]
  if (!path) return DOCS_BASE_URL
  return `${DOCS_BASE_URL}/${path}`
}
