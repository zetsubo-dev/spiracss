import type { HtmlLintIssue } from './generator-core'

export function formatIssueLocation(issue: Pick<HtmlLintIssue, 'path' | 'target' | 'targetPath' | 'position'>): string {
  const sibling = issue.target && issue.target.siblingIndex > 1 ? ` (sibling #${issue.target.siblingIndex})` : ''
  const targetPath =
    issue.targetPath && issue.targetPath.length > 0
      ? ` [DOM: ${issue.targetPath
          .map(
            (target) => `<${target.tagName}>#${target.siblingIndex}${target.className ? `.${target.className}` : ''}`
          )
          .join(' > ')}]`
      : ''
  const position = issue.position ? ` [line ${issue.position.line}, column ${issue.position.column}]` : ''
  return `${issue.path.join(' > ') || '(root)'}${sibling}${targetPath}${position}`
}

export type ValidationStatus = 'pass' | 'provisional' | 'ignored' | 'failed' | 'blocked'

export const findMaxDepthIssue = (issues: HtmlLintIssue[]): HtmlLintIssue | undefined =>
  issues.find((issue) => issue.code === 'MAX_DEPTH_EXCEEDED')

export const validationStatusFor = (args: {
  configStatus: 'missing' | 'loaded' | 'error'
  hasIssues: boolean
  allowProvisional: boolean
  ignoreStructureErrors?: boolean
}): ValidationStatus => {
  if (args.configStatus === 'error' || (args.configStatus === 'missing' && !args.allowProvisional)) return 'blocked'
  if (args.hasIssues && !args.ignoreStructureErrors) return 'failed'
  if (args.hasIssues && args.ignoreStructureErrors) return 'ignored'
  if (args.configStatus === 'missing') return 'provisional'
  return 'pass'
}
