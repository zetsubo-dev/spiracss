const DOCS_BASE_URL =
  'https://spiracss.jp/stylelint-rules'

const RULE_DOCS_PATHS: Record<string, string> = {
  'spiracss/class-structure': 'class-structure',
  'spiracss/property-placement': 'property-placement',
  'spiracss/interaction-scope': 'interaction-scope',
  'spiracss/interaction-properties': 'interaction-properties',
  'spiracss/keyframes-naming': 'keyframes-naming',
  'spiracss/pseudo-nesting': 'pseudo-nesting',
  'spiracss/rel-comments': 'rel-comments'
}

export const getRuleDocsUrl = (ruleName: string): string => {
  const path = RULE_DOCS_PATHS[ruleName]
  if (!path) return `${DOCS_BASE_URL}/`
  return `${DOCS_BASE_URL}/${path}/`
}
