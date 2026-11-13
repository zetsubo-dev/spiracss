import * as vscode from 'vscode'
import type { MarkupLintResult } from '@spiracss/html-cli'

/** Format existing preflight evidence only; never parse or count in the UI. */
export function generationCoverageLine(coverage: MarkupLintResult['coverage'] | undefined): string | undefined {
  const count = coverage?.generationUnenumeratedSites ?? 0
  return count > 0
    ? `[INFO] ${vscode.l10n.t('Selectors were not generated for unenumerable dynamic values at {0} site(s).', count)}`
    : undefined
}
