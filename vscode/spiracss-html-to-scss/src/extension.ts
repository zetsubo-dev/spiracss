/* =========================================================
 *  SpiraCSS HTML to SCSS - VS Code Extension (extension.ts)
 * ========================================================= */

import {
  type ExternalOptions,
  type FileNameCase,
  generateFromHtml,
  type GeneratorOptions,
  type HtmlLintIssue,
  insertPlaceholdersWithInfo,
  lintHtmlStructure,
  type NamingOptions,
  type RootBlockSummary,
  type SelectorPolicy,
  summarizeRootBlocks
} from '@spiracss/html-cli'
import { existsSync, promises as fsp, readFileSync, statSync } from 'fs'
import { createRequire } from 'module'
import * as path from 'path'
import { pathToFileURL } from 'url'
import * as vscode from 'vscode'

/* ---------- global overwrite choice / output channel ---------- */
let globalWriteChoice: 'overwrite' | null = null
const outputChannel = vscode.window.createOutputChannel('SpiraCSS HTML to SCSS')

function isFileNameCase(value: string): value is FileNameCase {
  return (
    value === 'preserve' ||
    value === 'kebab' ||
    value === 'snake' ||
    value === 'camel' ||
    value === 'pascal'
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

type FileCaseConfig = {
  root?: FileNameCase
  child?: FileNameCase
}

const resolveFileCaseConfig = (value: unknown): FileCaseConfig => {
  if (typeof value === 'string' && isFileNameCase(value)) {
    return { root: value, child: value }
  }
  if (!isRecord(value)) return {}
  const root = value.root
  const child = value.child
  return {
    root: typeof root === 'string' && isFileNameCase(root) ? root : undefined,
    child: typeof child === 'string' && isFileNameCase(child) ? child : undefined
  }
}

/* ---------- workspace / config loading ---------- */
const isModuleWorkspace = (root: string): boolean => {
  const pkgPath = path.join(root, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { type?: string }
    return pkg.type === 'module'
  } catch {
    return false
  }
}

function getWorkspaceRoot(uri: vscode.Uri): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  return folder?.uri.fsPath
}

type SpiracssConfig = Record<string, unknown>
type ClassAttribute = 'class' | 'className'

const configWarningRoots = new Set<string>()

function warnConfigLoadError(root: string, error: unknown): void {
  if (configWarningRoots.has(root)) return
  configWarningRoots.add(root)
  const message = vscode.l10n.t(
    'Failed to load spiracss.config.js. Settings might not be applied.'
  )
  const detail = error instanceof Error ? error.stack ?? error.message : String(error)
  vscode.window.showWarningMessage(message)
  outputChannel.appendLine(`[WARN] ${message}`)
  outputChannel.appendLine(detail)
  outputChannel.show(true)
}

const normalizeConfigModule = (moduleValue: unknown): SpiracssConfig | undefined => {
  if (!moduleValue || typeof moduleValue !== 'object') return undefined
  if ('default' in moduleValue) {
    const maybeDefault = (moduleValue as { default?: unknown }).default
    if (maybeDefault && typeof maybeDefault === 'object') {
      return maybeDefault as SpiracssConfig
    }
  }
  return moduleValue as SpiracssConfig
}

async function loadSpiracssConfig(uri: vscode.Uri): Promise<SpiracssConfig | undefined> {
  const root = getWorkspaceRoot(uri)
  if (!root) return undefined
  const configPath = path.join(root, 'spiracss.config.js')
  if (!existsSync(configPath)) return undefined

  if (!isModuleWorkspace(root)) {
    try {
      const require = createRequire(__filename)
      const resolved = require.resolve(configPath)
      delete require.cache[resolved]
      const config = require(resolved)
      return normalizeConfigModule(config)
    } catch (error) {
      warnConfigLoadError(root, error)
      return undefined
    }
  }

  // Load via ESM (disable cache with cacheBuster)
  try {
    let cacheBuster = ''
    try {
      const stat = statSync(configPath)
      cacheBuster = String(stat.mtimeMs)
    } catch {
      cacheBuster = String(Date.now())
    }
    const moduleUrl = cacheBuster
      ? `${pathToFileURL(configPath).href}?t=${cacheBuster}`
      : pathToFileURL(configPath).href
    const config = await import(moduleUrl)
    return normalizeConfigModule(config)
  } catch (error) {
    warnConfigLoadError(root, error)
    return undefined
  }
}

function loadGlobalScssModuleFromConfig(config?: SpiracssConfig): string {
  const fallback = '@styles/partials/global'
  if (!config) return fallback
  const generator = config.generator as Record<string, unknown> | undefined
  const entry = generator?.globalScssModule
  if (typeof entry === 'string' && entry.trim() !== '') {
    return entry
  }
  return fallback
}

function loadPageEntryPrefixFromConfig(config?: SpiracssConfig): string {
  const defaultAlias = 'assets'
  const defaultSubdir = 'css'
  if (!config) return `@${defaultAlias}/${defaultSubdir}`
  const generator = config.generator as Record<string, unknown> | undefined
  const alias = (generator?.pageEntryAlias as string | undefined) ?? defaultAlias
  const subdir = (generator?.pageEntrySubdir as string | undefined) ?? defaultSubdir
  if (subdir && subdir.trim() !== '') {
    return `@${alias}/${subdir}`
  }
  return `@${alias}`
}

function loadLayoutMixinsFromConfig(config?: SpiracssConfig): string[] {
  const fallback = ['@include breakpoint-up(md)']
  if (!config) return fallback
  const generator = config.generator as Record<string, unknown> | undefined
  const raw = generator?.layoutMixins
  if (Array.isArray(raw)) {
    const list = raw.filter((v) => typeof v === 'string' && v.trim() !== '')
    if (list.length > 0) {
      return list
    }
    return []
  }
  return fallback
}

function loadChildScssDirFromConfig(config?: SpiracssConfig): string {
  const fallback = 'scss'
  if (!config) return fallback
  const generator = config.generator as Record<string, unknown> | undefined
  const dir = (generator?.childScssDir as string | undefined) ?? fallback
  if (dir && dir.trim() !== '') {
    return dir
  }
  return fallback
}

function loadRootFileCaseFromConfig(config?: SpiracssConfig): FileNameCase {
  const fallback: FileNameCase = 'preserve'
  if (!config) return fallback
  const globalFileCase = resolveFileCaseConfig(config.fileCase)
  const generator = config.generator as Record<string, unknown> | undefined
  const fileCase = generator?.rootFileCase as string | undefined
  if (typeof fileCase === 'string' && isFileNameCase(fileCase)) {
    return fileCase
  }
  if (globalFileCase.root) {
    return globalFileCase.root
  }
  return fallback
}

function loadChildFileCaseFromConfig(config?: SpiracssConfig): FileNameCase {
  const fallback: FileNameCase = 'preserve'
  if (!config) return fallback
  const globalFileCase = resolveFileCaseConfig(config.fileCase)
  const generator = config.generator as Record<string, unknown> | undefined
  const fileCase = generator?.childFileCase as string | undefined
  if (typeof fileCase === 'string' && isFileNameCase(fileCase)) {
    return fileCase
  }
  if (globalFileCase.child) {
    return globalFileCase.child
  }
  return fallback
}

function loadNamingFromConfig(config?: SpiracssConfig): NamingOptions {
  if (!config) return {}
  const stylelintCfg = config.stylelint as Record<string, unknown> | undefined
  const base = stylelintCfg?.base as Record<string, unknown> | undefined
  const classConfig = stylelintCfg?.class as Record<string, unknown> | undefined
  const baseNaming = base?.naming
  if (isRecord(baseNaming)) {
    return baseNaming as NamingOptions
  }
  const classNaming = classConfig?.naming
  if (isRecord(classNaming)) {
    return classNaming as NamingOptions
  }
  return {}
}

function loadHtmlFormatClassAttributeFromConfig(config?: SpiracssConfig): ClassAttribute {
  const fallback: ClassAttribute = 'class'
  if (!config) return fallback
  const htmlFormat = config.htmlFormat as Record<string, unknown> | undefined
  if (htmlFormat && typeof htmlFormat === 'object') {
    const value = htmlFormat.classAttribute
    if (value === 'class' || value === 'className') {
      return value
    }
  }
  return fallback
}

function loadExternalOptionsFromConfig(config?: SpiracssConfig): ExternalOptions {
  if (!config) {
    return { classes: [], prefixes: [] }
  }
  const stylelintCfg = config.stylelint as Record<string, unknown> | undefined
  const base = stylelintCfg?.base as Record<string, unknown> | undefined
  const classConfig = stylelintCfg?.class as Record<string, unknown> | undefined
  const baseExternal = base?.external
  const classExternal = classConfig?.external
  const external = {
    ...(isRecord(baseExternal) ? baseExternal : {}),
    ...(isRecord(classExternal) ? classExternal : {})
  }
  const classes = Array.isArray(external.classes)
    ? external.classes.filter((item) => typeof item === 'string' && item.trim() !== '')
    : []
  const prefixes = Array.isArray(external.prefixes)
    ? external.prefixes.filter((item) => typeof item === 'string' && item.trim() !== '')
    : []
  return { classes, prefixes }
}

function loadSelectorPolicyFromConfig(config?: SpiracssConfig): SelectorPolicy | undefined {
  if (!config) return undefined
  const selectorPolicyConfig = config.selectorPolicy
  if (selectorPolicyConfig && typeof selectorPolicyConfig === 'object') {
    return selectorPolicyConfig as SelectorPolicy
  }
  return undefined
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
  const updatedLines = [
    ...lines.slice(0, insertAt),
    ...missingUses,
    ...lines.slice(insertAt)
  ]
  await fsp.writeFile(file, ensureTrailingNewline(updatedLines.join('\n')), 'utf8')
  return true
}

/* ---------- generateScss (core wrapper) ---------- */
type GenerateScssResult = {
  generatedCount: number
  wroteCount: number
}

function getLintRuleMessage(code: HtmlLintIssue['code']): string {
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
    default:
      return vscode.l10n.t('Rule: Unknown lint rule.')
  }
}

function formatLintIssueLines(issue: HtmlLintIssue, includeDetail: boolean): string[] {
  const location = issue.path.length > 0 ? issue.path.join(' > ') : vscode.l10n.t('(root)')
  const baseLabel = issue.baseClass
    ? vscode.l10n.t('Base: "{0}"', issue.baseClass)
    : vscode.l10n.t('Base: (none)')
  const lines = [
    getLintRuleMessage(issue.code),
    vscode.l10n.t('Target: {0}', location),
    baseLabel
  ]
  if (includeDetail) {
    const detailLabel = issue.message
      ? vscode.l10n.t('Detail: {0}', issue.message)
      : vscode.l10n.t('Detail: (none)')
    lines.push(detailLabel)
  }
  return lines
}

async function reportLintIssues(issues: HtmlLintIssue[]): Promise<void> {
  if (issues.length === 0) return
  const headline = vscode.l10n.t(
    'SpiraCSS HTML structure errors found. Generation was canceled.'
  )
  const modalDetail = vscode.l10n.t(
    'Check the notification for the first issue and the output panel for full details.'
  )
  await vscode.window.showErrorMessage(headline, { modal: true, detail: modalDetail })
  const firstIssue = issues[0]
  const toastSummary = formatLintIssueLines(firstIssue, false).join(' | ')
  const moreSuffix =
    issues.length > 1
      ? ` ${vscode.l10n.t('(and {0} more)', issues.length - 1)}`
      : ''
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
  const childDir = path.join(docDir, childScssDir)
  await fsp.mkdir(childDir, { recursive: true })

  const generated = generateFromHtml(html, docDir, isRootMode, options)
  const indexUses: string[] = []
  let wroteCount = 0

  for (const file of generated) {
    // index.scss is merged with existing files, so only extract @use lines
    if (file.path.endsWith('/index.scss') || file.path === `${childScssDir}/index.scss`) {
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

    const html = ed.document.getText(ed.selection).trim()
    if (!html) {
      vscode.window.showErrorMessage(vscode.l10n.t('No selection.'))
      return
    }

    const docDir = path.dirname(ed.document.uri.fsPath)
    const config = await loadSpiracssConfig(ed.document.uri)
    const globalScssModule = loadGlobalScssModuleFromConfig(config)
    const pageEntryPrefix = loadPageEntryPrefixFromConfig(config)
    const layoutMixins = loadLayoutMixinsFromConfig(config)
    const naming = loadNamingFromConfig(config)
    const selectorPolicy = loadSelectorPolicyFromConfig(config)
    const external = loadExternalOptionsFromConfig(config)
    const childScssDir = loadChildScssDirFromConfig(config)
    const rootFileCase = loadRootFileCaseFromConfig(config)
    const childFileCase = loadChildFileCaseFromConfig(config)

    const options: GeneratorOptions = {
      globalScssModule,
      pageEntryPrefix,
      childScssDir,
      layoutMixins,
      naming,
      rootFileCase,
      childFileCase,
      selectorPolicy,
      external
    }

    globalWriteChoice = null
    try {
      const lintIssues = lintHtmlStructure(
        html,
        isRoot,
        options.naming,
        options.selectorPolicy,
        options.external
      )
      if (lintIssues.length > 0) {
        await reportLintIssues(lintIssues)
        return
      }
      const rootSummary = isRoot ? [] : summarizeRootBlocks(html, false, options)
      const mergedRoots = rootSummary.filter((entry) => entry.count > 1)
      const result = await generateScss(html, docDir, isRoot, options)
      if (result.generatedCount === 0) {
        vscode.window.showWarningMessage(
          vscode.l10n.t(
            'No SCSS was generated. Check the root selection and SpiraCSS naming rules.'
          )
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
        const suffix =
          mergedRoots.length > 1
            ? ` ${vscode.l10n.t('(and {0} more)', mergedRoots.length - 1)}`
            : ''
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

  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.generateSpiracssScssFromRoot',
      createHandler(true)
    )
  )
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.generateSpiracssScssFromSelection',
      createHandler(false)
    )
  )

  // Placeholder insertion command
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.insertSracssPlaceholders',
      async (): Promise<void> => {
        const ed = vscode.window.activeTextEditor
        if (!ed) return
        const html = ed.document.getText(ed.selection).trim()
        if (!html) {
          vscode.window.showErrorMessage(vscode.l10n.t('No selection.'))
          return
        }
        const config = await loadSpiracssConfig(ed.document.uri)
        const naming = loadNamingFromConfig(config)
        const classAttribute = loadHtmlFormatClassAttributeFromConfig(config)
        const result = insertPlaceholdersWithInfo(html, naming, classAttribute)

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
      }
    )
  )
}

/* ---------- deactivate ---------- */
export function deactivate(): void {
  /* no-op */
}
