/* =========================================================
 *  SpiraCSS HTML to SCSS - VS Code Extension (extension.ts)
 * ========================================================= */

import {
  generateFromHtml,
  type GeneratorOptions,
  type HtmlLintIssue,
  isGeneratedIndexFile,
  insertPlaceholdersWithInfo,
  loadProjectOptions,
  type LoadedProjectOptions,
  lintHtmlStructure,
  type RootBlockSummary,
  summarizeRootBlocks
} from '@spiracss/html-cli'
import { promises as fsp } from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

/* ---------- global overwrite choice / output channel ---------- */
let globalWriteChoice: 'overwrite' | null = null
const outputChannel = vscode.window.createOutputChannel('SpiraCSS HTML to SCSS')

/* ---------- workspace / config loading ---------- */
function getWorkspaceRoot(uri: vscode.Uri): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  return folder?.uri.fsPath
}

const configWarningRoots = new Set<string>()
const configMissingWarningRoots = new Set<string>()

function warnConfigLoadError(root: string, error: unknown): void {
  if (configWarningRoots.has(root)) return
  configWarningRoots.add(root)
  const message = vscode.l10n.t('Failed to load spiracss.config.js. Settings might not be applied.')
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  vscode.window.showWarningMessage(message)
  outputChannel.appendLine(`[WARN] ${message}`)
  outputChannel.appendLine(detail)
  outputChannel.show(true)
}

async function confirmProvisionalConfig(uri: vscode.Uri): Promise<boolean> {
  const root = getWorkspaceRoot(uri) ?? path.dirname(uri.fsPath)
  const message = vscode.l10n.t('spiracss.config.js was not found. Default settings are provisional.')
  if (!configMissingWarningRoots.has(root)) {
    configMissingWarningRoots.add(root)
    vscode.window.showWarningMessage(message)
    outputChannel.appendLine(`[WARN] ${message}`)
    outputChannel.show(true)
  }
  const continueLabel = vscode.l10n.t('Continue with provisional settings')
  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true, detail: vscode.l10n.t('Create spiracss.config.js before relying on generated output.') },
    continueLabel
  )
  if (!isProvisionalContinuationConfirmed(choice, continueLabel)) return false
  outputChannel.appendLine(
    vscode.l10n.t('Generation continued only after explicit confirmation with provisional settings.')
  )
  outputChannel.show(true)
  return true
}

export function isProvisionalContinuationConfirmed(choice: string | undefined, continueLabel: string): boolean {
  return choice === continueLabel
}

async function loadProjectOptionsForUri(uri: vscode.Uri): Promise<LoadedProjectOptions | undefined> {
  const root = getWorkspaceRoot(uri) ?? path.dirname(uri.fsPath)
  const options = await loadProjectOptions(root)
  if (options.configStatus === 'error') {
    warnConfigLoadError(root, options.configError)
    return undefined
  }
  if (options.configStatus === 'missing' && !(await confirmProvisionalConfig(uri))) return undefined
  return options
}

/* ---------- File Helpers ---------- */
async function fileExists(file: string): Promise<boolean> {
  try {
    await fsp.access(file)
    return true
  } catch {
    return false
  }
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`
}

/* ---------- writeSafely (confirm overwrite by default) ---------- */

async function writeSafely(file: string, content: string): Promise<boolean> {
  const exists = await fileExists(file)
  const writeOverwrite = async (): Promise<void> => {
    await fsp.writeFile(file, ensureTrailingNewline(content), 'utf8')
  }

  if (!exists) {
    await writeOverwrite()
    return true
  }
  if (globalWriteChoice === 'overwrite') {
    await writeOverwrite()
    return true
  }

  const overwriteLabel = vscode.l10n.t('Overwrite')
  const skipLabel = vscode.l10n.t('Skip')
  const overwriteAllLabel = vscode.l10n.t('Overwrite All')
  const choice = await vscode.window.showWarningMessage(
    vscode.l10n.t('{0} already exists. What would you like to do?', path.basename(file)),
    { modal: true },
    overwriteLabel,
    skipLabel,
    overwriteAllLabel
  )

  switch (choice) {
    case overwriteLabel:
      await writeOverwrite()
      return true
    case overwriteAllLabel:
      globalWriteChoice = 'overwrite'
      await writeOverwrite()
      return true
    case skipLabel:
      return false
    default:
      // cancel -> no-op
      return false
  }
}

/* ---------- index.scss merge ---------- */
const normalizeUseLine = (line: string): string => line.trim()
const isUseLine = (line: string): boolean => normalizeUseLine(line).startsWith('@use ')
const extractUseLines = (lines: string[]): string[] => {
  const uses: string[] = []
  const seen = new Set<string>()
  lines.forEach((line) => {
    const normalized = normalizeUseLine(line)
    if (!isUseLine(normalized) || seen.has(normalized)) return
    seen.add(normalized)
    uses.push(normalized)
  })
  return uses
}

async function mergeIndex(dir: string, entries: string[]): Promise<boolean> {
  const file = path.join(dir, 'index.scss')
  const incomingUses = extractUseLines(entries)
  if (incomingUses.length === 0) return false

  if (!(await fileExists(file))) {
    await fsp.writeFile(file, ensureTrailingNewline(incomingUses.join('\n')), 'utf8')
    return true
  }

  const current = await fsp.readFile(file, 'utf8')
  const lines = current.split('\n')
  const existingUses = new Set(extractUseLines(lines))
  const missingUses = incomingUses.filter((line) => !existingUses.has(line))
  if (missingUses.length === 0) return false

  let lastUseIndex = -1
  lines.forEach((line, index) => {
    if (isUseLine(line)) lastUseIndex = index
  })
  const insertAt = lastUseIndex >= 0 ? lastUseIndex + 1 : 0
  const updatedLines = [...lines.slice(0, insertAt), ...missingUses, ...lines.slice(insertAt)]
  await fsp.writeFile(file, ensureTrailingNewline(updatedLines.join('\n')), 'utf8')
  return true
}

/* ---------- generateScss (core wrapper) ---------- */
type GenerateScssResult = {
  generatedCount: number
  wroteCount: number
}

export function getLintRuleMessage(code: HtmlLintIssue['code']): string {
  switch (code) {
    case 'INVALID_BASE_CLASS':
      return vscode.l10n.t('Rule: Base class must be a valid Block or Element.')
    case 'UNBALANCED_HTML':
      return vscode.l10n.t('Rule: HTML fragment must have balanced tags.')
    case 'MULTIPLE_ROOT_ELEMENTS':
      return vscode.l10n.t('Rule: Root mode requires a single root element.')
    case 'MODIFIER_WITHOUT_BASE':
      return vscode.l10n.t('Rule: Modifier cannot be used without a Block or Element base.')
    case 'DISALLOWED_MODIFIER':
      return vscode.l10n.t('Rule: Modifier is not allowed by naming rules.')
    case 'UTILITY_WITHOUT_BASE':
      return vscode.l10n.t('Rule: Utility cannot be used without a Block or Element base.')
    case 'MULTIPLE_BASE_CLASSES':
      return vscode.l10n.t('Rule: Only one Block or Element base is allowed per element.')
    case 'ROOT_NOT_BLOCK':
      return vscode.l10n.t('Rule: Root element must be a Block.')
    case 'ELEMENT_WITHOUT_BLOCK_ANCESTOR':
      return vscode.l10n.t('Rule: Element must have a Block ancestor.')
    case 'ELEMENT_PARENT_OF_BLOCK':
      return vscode.l10n.t('Rule: Block cannot be nested directly under Element.')
    case 'DISALLOWED_VARIANT_ATTRIBUTE':
      return vscode.l10n.t('Rule: Disallowed variant attribute.')
    case 'DISALLOWED_STATE_ATTRIBUTE':
      return vscode.l10n.t('Rule: Disallowed state attribute.')
    case 'INVALID_VARIANT_VALUE':
      return vscode.l10n.t('Rule: Invalid variant value.')
    case 'INVALID_STATE_VALUE':
      return vscode.l10n.t('Rule: Invalid state value.')
    case 'DYNAMIC_CLASS_UNRESOLVED':
      return vscode.l10n.t('Rule: Dynamic class values cannot be verified statically.')
    case 'CLASSLESS_TAG_NOT_ALLOWED':
      return vscode.l10n.t('Rule: HTML tags must have a SpiraCSS Block or Element class.')
    case 'MAX_DEPTH_EXCEEDED':
      return vscode.l10n.t('Rule: HTML traversal exceeded the safety limit; simplify or split the input.')
    default:
      return vscode.l10n.t('Rule: Unknown lint rule.')
  }
}

export function formatLintIssueLines(issue: HtmlLintIssue, includeDetail: boolean): string[] {
  const sibling =
    issue.target && issue.target.siblingIndex > 1 ? vscode.l10n.t(' (sibling #{0})', issue.target.siblingIndex) : ''
  const targetPath =
    issue.targetPath && issue.targetPath.length > 0
      ? ` [DOM: ${issue.targetPath.map((target) => `<${target.tagName}>#${target.siblingIndex}${target.className ? `.${target.className}` : ''}`).join(' > ')}]`
      : ''
  const location = `${issue.path.length > 0 ? issue.path.join(' > ') : vscode.l10n.t('(root)')}${sibling}${targetPath}`
  const baseLabel = issue.baseClass ? vscode.l10n.t('Base: "{0}"', issue.baseClass) : vscode.l10n.t('Base: (none)')
  const sourceLabel = issue.position
    ? vscode.l10n.t('Source: line {0}, column {1}', issue.position.line, issue.position.column)
    : undefined
  const lines = [getLintRuleMessage(issue.code), sourceLabel, vscode.l10n.t('Target: {0}', location), baseLabel].filter(
    (line): line is string => line !== undefined
  )
  if (includeDetail) {
    const detailLabel = issue.message ? vscode.l10n.t('Detail: {0}', issue.message) : vscode.l10n.t('Detail: (none)')
    lines.push(detailLabel)
  }
  return lines
}

type SourceStartPosition = { line: number; character: number }

function documentPositionForSelectedOffset(
  selectedSource: string,
  leadingTrimLength: number,
  relativeOffset: number,
  selectionStart: SourceStartPosition,
  selectionStartOffset: number
): { offset: number; line: number; column: number } {
  const prefix = selectedSource.slice(0, leadingTrimLength + relativeOffset)
  const lineBreaks = prefix.match(/\r\n|\r|\n/g)?.length ?? 0
  const lastNewline = Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r'))
  const columnOffset = lastNewline === -1 ? selectionStart.character + prefix.length : prefix.length - lastNewline - 1
  return {
    offset: selectionStartOffset + leadingTrimLength + relativeOffset,
    line: selectionStart.line + lineBreaks + 1,
    column: columnOffset + 1
  }
}

export function adjustLintIssuePositions(
  issues: HtmlLintIssue[],
  selectedSource: string,
  selectionStart: SourceStartPosition,
  selectionStartOffset: number
): HtmlLintIssue[] {
  const leadingTrimLength = selectedSource.length - selectedSource.trimStart().length
  return issues.map((issue) => {
    if (!issue.position) return issue
    const start = documentPositionForSelectedOffset(
      selectedSource,
      leadingTrimLength,
      issue.position.offset,
      selectionStart,
      selectionStartOffset
    )
    const end = documentPositionForSelectedOffset(
      selectedSource,
      leadingTrimLength,
      issue.position.endOffset,
      selectionStart,
      selectionStartOffset
    )
    return {
      ...issue,
      position: {
        ...issue.position,
        ...start,
        endOffset: end.offset,
        endLine: end.line,
        endColumn: end.column
      }
    }
  })
}

async function reportLintIssues(issues: HtmlLintIssue[]): Promise<void> {
  if (issues.length === 0) return
  const headline = vscode.l10n.t('SpiraCSS HTML structure errors found. Generation was canceled.')
  const modalDetail = vscode.l10n.t('Check the notification for the first issue and the output panel for full details.')
  await vscode.window.showErrorMessage(headline, { modal: true, detail: modalDetail })
  const firstIssue = issues[0]
  const toastSummary = formatLintIssueLines(firstIssue, false).join(' | ')
  const moreSuffix = issues.length > 1 ? ` ${vscode.l10n.t('(and {0} more)', issues.length - 1)}` : ''
  vscode.window.showErrorMessage(`[${firstIssue.code}] ${toastSummary}${moreSuffix}`)
  outputChannel.appendLine(`[ERROR] ${headline}`)
  issues.forEach((issue, index) => {
    outputChannel.appendLine(`[ERROR] ${index + 1}. [${issue.code}]`)
    formatLintIssueLines(issue, true).forEach((line) => {
      outputChannel.appendLine(`  ${line}`)
    })
    outputChannel.appendLine('')
  })
  outputChannel.show(true)
}

function reportMergedRoots(merged: RootBlockSummary[]): void {
  if (merged.length === 0) return
  outputChannel.appendLine(`[INFO] ${vscode.l10n.t('Merged duplicate root blocks:')}`)
  merged.forEach((entry) => {
    outputChannel.appendLine(`  ${entry.baseClass}: ${entry.count}`)
  })
  outputChannel.appendLine('')
}

async function generateScss(
  html: string,
  docDir: string,
  isRootMode: boolean,
  options: GeneratorOptions
): Promise<GenerateScssResult> {
  const { childScssDir } = options
  const generated = generateFromHtml(html, docDir, isRootMode, options)
  const childDir = path.join(docDir, childScssDir)
  await fsp.mkdir(childDir, { recursive: true })
  const indexUses: string[] = []
  let wroteCount = 0

  for (const file of generated) {
    // index.scss is merged with existing files, so only extract @use lines
    if (isGeneratedIndexFile(file.path, childScssDir)) {
      const lines = extractUseLines(file.content.split('\n'))
      indexUses.push(...lines)
      continue
    }
    const outPath = path.join(docDir, file.path)
    if (await writeSafely(outPath, file.content)) {
      wroteCount += 1
    }
  }

  if (indexUses.length > 0) {
    if (await mergeIndex(childDir, indexUses)) {
      wroteCount += 1
    }
  }

  return { generatedCount: generated.length, wroteCount }
}

/* ---------- command registration ---------- */
export function activate(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(outputChannel)
  const createHandler = (isRoot: boolean) => async (): Promise<void> => {
    const ed = vscode.window.activeTextEditor
    if (!ed) return

    const selectedSource = ed.document.getText(ed.selection)
    const html = selectedSource.trim()
    if (!html) {
      vscode.window.showErrorMessage(vscode.l10n.t('No selection.'))
      return
    }

    const docDir = path.dirname(ed.document.uri.fsPath)
    const options = await loadProjectOptionsForUri(ed.document.uri)
    if (!options) return

    globalWriteChoice = null
    try {
      const lintIssues = lintHtmlStructure(
        html,
        isRoot,
        options.naming,
        options.selectorPolicy,
        options.external,
        options.jsxClassBindings,
        options.htmlLint
      )
      if (lintIssues.length > 0) {
        await reportLintIssues(
          adjustLintIssuePositions(
            lintIssues,
            selectedSource,
            ed.selection.start,
            ed.document.offsetAt(ed.selection.start)
          )
        )
        return
      }
      const rootSummary = isRoot ? [] : summarizeRootBlocks(html, false, options)
      const mergedRoots = rootSummary.filter((entry) => entry.count > 1)
      const result = await generateScss(html, docDir, isRoot, options)
      if (result.generatedCount === 0) {
        vscode.window.showWarningMessage(
          vscode.l10n.t('No SCSS was generated. Check the root selection and SpiraCSS naming rules.')
        )
        return
      }
      if (result.wroteCount === 0) {
        vscode.window.showInformationMessage(
          vscode.l10n.t('No SCSS files were written (all outputs were skipped or unchanged).')
        )
        return
      }
      if (mergedRoots.length > 0) {
        reportMergedRoots(mergedRoots)
        const first = mergedRoots[0]
        const suffix = mergedRoots.length > 1 ? ` ${vscode.l10n.t('(and {0} more)', mergedRoots.length - 1)}` : ''
        vscode.window.showInformationMessage(
          vscode.l10n.t(
            'SCSS generated. Merged duplicate root blocks: {0} x{1}{2}',
            first.baseClass,
            first.count,
            suffix
          )
        )
        return
      }
      vscode.window.showInformationMessage(vscode.l10n.t('SCSS generated.'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      const errorMessage = vscode.l10n.t('Error generating SCSS: {0}', msg)
      vscode.window.showErrorMessage(errorMessage)
      outputChannel.appendLine(`[ERROR] ${errorMessage}`)
      if (stack) outputChannel.appendLine(stack)
      outputChannel.show()
    }
  }

  ctx.subscriptions.push(vscode.commands.registerCommand('extension.generateSpiracssScssFromRoot', createHandler(true)))
  ctx.subscriptions.push(
    vscode.commands.registerCommand('extension.generateSpiracssScssFromSelection', createHandler(false))
  )

  // Placeholder insertion command
  ctx.subscriptions.push(
    vscode.commands.registerCommand('extension.insertSracssPlaceholders', async (): Promise<void> => {
      const ed = vscode.window.activeTextEditor
      if (!ed) return
      const html = ed.document.getText(ed.selection).trim()
      if (!html) {
        vscode.window.showErrorMessage(vscode.l10n.t('No selection.'))
        return
      }
      const options = await loadProjectOptionsForUri(ed.document.uri)
      if (!options) return
      const result = insertPlaceholdersWithInfo(html, options.naming, options.htmlFormat.classAttribute, {
        jsxClassBindings: options.jsxClassBindings
      })

      if (result.errorCode === 'MAX_DEPTH_EXCEEDED') {
        const message = vscode.l10n.t(
          'HTML traversal exceeded the safety limit. Simplify or split the input before inserting placeholders.'
        )
        vscode.window.showErrorMessage(message)
        outputChannel.appendLine(`[ERROR] ${message}`)
        outputChannel.show(true)
        return
      }

      // If template syntax is detected, warn and skip
      if (result.hasTemplateSyntax) {
        vscode.window.showWarningMessage(
          vscode.l10n.t(
            'Template syntax (EJS, Nunjucks, JSX, etc.) was detected, so placeholder insertion was skipped. Use only static HTML fragments.'
          )
        )
        return
      }

      if (result.changeCount === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No placeholders to insert.'))
        return
      }
      await ed.edit((edit) => {
        edit.replace(ed.selection, result.html)
      })
      vscode.window.showInformationMessage(vscode.l10n.t('SpiraCSS placeholders inserted.'))
    })
  )
}

/* ---------- deactivate ---------- */
export function deactivate(): void {
  /* no-op */
}
