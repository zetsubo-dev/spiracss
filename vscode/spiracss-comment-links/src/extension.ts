import { existsSync, realpathSync, statSync } from 'fs'
import { createRequire } from 'module'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { pathToFileURL } from 'url'
import {
  DocumentLink,
  DocumentLinkProvider,
  EventEmitter,
  ExtensionContext,
  l10n,
  languages,
  Range,
  TextDocument,
  Uri,
  window,
  workspace,
  WorkspaceFolder
} from 'vscode'

const DEBUG = false

type ResolveContext = {
  document: TextDocument
  workspaceFolder: WorkspaceFolder
  aliasRoots?: AliasRoots
}

type ResolveFn = (match: RegExpExecArray, context: ResolveContext) => Uri

interface LinkPattern {
  regex: RegExp
  resolve: ResolveFn
}

type AliasRoots = Record<string, string[]>

// Default alias roots for SpiraCSS.
// Can be overridden by aliasRoots in the project's spiracss.config.js.
const defaultAliasRoots: AliasRoots = {
  src: ['src'],
  components: ['src/components'],
  styles: ['src/styles'],
  common: ['src/components/common'],
  pages: ['src/components/pages'],
  parts: ['src/components/parts'],
  assets: ['src/assets']
}

const localRequire = createRequire(__filename)

const stripLeadingSlashes = (value: string): string => value.replace(/^\/+/, '')
const stripTrailingPunctuation = (value: string): string => value.replace(/[.,;]+$/, '')

const pickExistingPath = (candidates: string[]): Uri => {
  // Prefer an existing path; otherwise use the first candidate (respect priority).
  const selected = candidates.find(existsSync) ?? candidates[0]
  return Uri.file(selected)
}

type WorkspaceConfigCache = {
  configStatKey: string
  aliasRoots?: AliasRoots
  aliasPattern: RegExp
}

const workspaceConfigCache = new Map<string, WorkspaceConfigCache>()
const configWarningRoots = new Set<string>()
const aliasRootWarningKeys = new Set<string>()
let configImportNonce = 0

const bumpConfigImportNonce = (): void => {
  configImportNonce += 1
}

const warnConfigLoadError = (root: string, error: unknown): void => {
  if (configWarningRoots.has(root)) return
  configWarningRoots.add(root)
  const message = l10n.t(
    'Failed to load spiracss.config.js. Comment Links settings might not be applied.'
  )
  const detail = error instanceof Error ? error.message : String(error)
  window.showWarningMessage(message)
  if (DEBUG) {
    console.error('[spiracss-comment-links] failed to load spiracss.config.js', detail)
  }
}

const warnAliasRootOutside = (root: string, base: string): void => {
  const key = `${root}::${base}`
  if (aliasRootWarningKeys.has(key)) return
  aliasRootWarningKeys.add(key)
  window.showWarningMessage(
    l10n.t(
      'aliasRoots path is outside the project root and will be ignored: {0}',
      base
    )
  )
}

type SpiracssConfig = Record<string, unknown>

const normalizeConfigModule = (moduleValue: unknown): SpiracssConfig | undefined => {
  if (!moduleValue || typeof moduleValue !== 'object') return undefined
  if ('default' in moduleValue) {
    const maybeDefault = (moduleValue as { default?: unknown }).default
    if (maybeDefault && typeof maybeDefault === 'object') {
      return maybeDefault as SpiracssConfig
    }
    return undefined
  }
  return moduleValue as SpiracssConfig
}

const loadCjsConfig = (configPath: string): SpiracssConfig | undefined | null => {
  try {
    const resolvedPath = localRequire.resolve(configPath)
    delete localRequire.cache[resolvedPath]
    const config = localRequire(resolvedPath)
    return normalizeConfigModule(config)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ERR_REQUIRE_ESM') return null
    }
    throw error
  }
}

const loadSpiracssConfig = async (
  root: string,
  configPath: string,
  cacheBuster?: string
): Promise<SpiracssConfig | undefined> => {
  try {
    const cjsConfig = loadCjsConfig(configPath)
    if (cjsConfig !== null) return cjsConfig

    const url = pathToFileURL(configPath).href
    const moduleUrl = cacheBuster ? `${url}?t=${cacheBuster}` : url
    const config = await import(moduleUrl)
    return normalizeConfigModule(config)
  } catch (error) {
    warnConfigLoadError(root, error)
    return undefined
  }
}

const getShortcutBases = (key: string, aliasRoots?: AliasRoots): string[] => {
  if (aliasRoots && Array.isArray(aliasRoots[key]) && aliasRoots[key].length > 0) {
    return aliasRoots[key]
  }
  // If not specified in the project config, fall back to SpiraCSS defaults.
  return defaultAliasRoots[key] ?? ['src']
}

const normalizePath = (target: string): string => {
  try {
    return realpathSync(target)
  } catch {
    return resolve(target)
  }
}

const isWithinProjectRoot = (projectRoot: string, candidate: string): boolean => {
  const normalizedRoot = normalizePath(projectRoot)
  const normalizedCandidate = normalizePath(candidate)
  const relativePath = relative(normalizedRoot, normalizedCandidate)
  if (!relativePath) return true
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) return false
  return !isAbsolute(relativePath)
}

const resolveShortcut: ResolveFn = (match, { workspaceFolder, aliasRoots }) => {
  const root = workspaceFolder.uri.fsPath
  const relative = stripLeadingSlashes(stripTrailingPunctuation(match[2] ?? ''))
  const bases = getShortcutBases(match[1], aliasRoots)
  const candidates = bases.flatMap((base) => {
    const resolvedBase = isAbsolute(base) ? base : resolve(root, base)
    if (!isWithinProjectRoot(root, resolvedBase)) {
      warnAliasRootOutside(root, base)
      return []
    }
    const candidate = resolve(resolvedBase, relative)
    return isWithinProjectRoot(root, candidate) ? [candidate] : []
  })
  if (candidates.length === 0) {
    throw new Error('No alias root candidates inside project root.')
  }
  return pickExistingPath(candidates)
}

const resolveRelAlias: ResolveFn = (match, { document }) =>
  Uri.file(join(dirname(document.uri.fsPath), stripLeadingSlashes(stripTrailingPunctuation(match[1]))))

// Escape regex metacharacters.
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Build a regex pattern from aliasRoots keys.
const buildAliasPattern = (aliasRoots?: AliasRoots): RegExp => {
  const configKeys = aliasRoots ? Object.keys(aliasRoots) : []
  const defaultKeys = Object.keys(defaultAliasRoots)
  // Merge without duplicates (config takes precedence, but both sets are recognized as keys).
  const allKeys = [...new Set([...configKeys, ...defaultKeys])]
  // Exclude rel because it is handled by a separate pattern.
  const filteredKeys = allKeys.filter((k) => k !== 'rel')
  // Sort by length to avoid prefix collisions (e.g., comp vs components).
  const sortedKeys = filteredKeys.sort((a, b) => b.length - a.length || a.localeCompare(b))
  if (sortedKeys.length === 0) return /(?!)/g // Non-matching regex.
  const keysPattern = sortedKeys.map(escapeRegex).join('|')
  return new RegExp(`\\/\\/\\s*@(${keysPattern})\\/([^\\s)'\"\`]+)`, 'g')
}

// @rel pattern is fixed.
const relPattern = /\/\/\s*@rel\/([^\s)'"`]+)/g

const ensureGlobalRegex = (regex: RegExp): RegExp => {
  if (regex.global) return regex
  return new RegExp(regex.source, `${regex.flags}g`)
}

type TargetedDocumentLink = DocumentLink & { target: Uri }

const getWorkspaceAliasConfig = async (
  workspaceFolder: WorkspaceFolder
): Promise<{ aliasRoots?: AliasRoots; aliasPattern: RegExp }> => {
  const root = workspaceFolder.uri.fsPath
  const configPath = join(root, 'spiracss.config.js')

  let configStatKey = 'missing'
  let cacheBuster = ''
  if (existsSync(configPath)) {
    try {
      const stat = statSync(configPath)
      configStatKey = `${stat.mtimeMs}:${stat.size}`
      cacheBuster = `${stat.mtimeMs}:${stat.size}:${configImportNonce}`
    } catch {
      configStatKey = `error:${Date.now()}`
      cacheBuster = String(configImportNonce)
    }
  }

  const cached = workspaceConfigCache.get(root)
  if (cached && cached.configStatKey === configStatKey) {
    return { aliasRoots: cached.aliasRoots, aliasPattern: cached.aliasPattern }
  }

  let aliasRoots: AliasRoots | undefined
  if (existsSync(configPath)) {
    const config = await loadSpiracssConfig(root, configPath, cacheBuster)
    if (config && typeof config === 'object' && config.aliasRoots) {
      aliasRoots = config.aliasRoots as AliasRoots
    }
  }

  const aliasPattern = buildAliasPattern(aliasRoots)
  workspaceConfigCache.set(root, { configStatKey, aliasRoots, aliasPattern })
  return { aliasRoots, aliasPattern }
}

class LinkProvider implements DocumentLinkProvider {
  private readonly linkChangeEmitter = new EventEmitter<void>()
  readonly onDidChangeDocumentLinks = this.linkChangeEmitter.event

  refreshForConfigFile(uri?: Uri): void {
    if (uri && basename(uri.fsPath) !== 'spiracss.config.js') return
    workspaceConfigCache.clear()
    configWarningRoots.clear()
    aliasRootWarningKeys.clear()
    bumpConfigImportNonce()
    this.linkChangeEmitter.fire()
  }

  dispose(): void {
    this.linkChangeEmitter.dispose()
  }

  async provideDocumentLinks(document: TextDocument): Promise<DocumentLink[] | undefined> {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder || workspaceFolder.uri.scheme !== 'file') return undefined

    const { aliasRoots, aliasPattern } = await getWorkspaceAliasConfig(workspaceFolder)
    const content = document.getText()
    const links: TargetedDocumentLink[] = []
    const context: ResolveContext = { document, workspaceFolder, aliasRoots }

    const patterns: LinkPattern[] = [
      { regex: relPattern, resolve: resolveRelAlias },
      { regex: aliasPattern, resolve: resolveShortcut }
    ]

    for (const pattern of patterns) {
      const regex = ensureGlobalRegex(pattern.regex)
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(content)) !== null) {
        try {
          const target = pattern.resolve(match, context)
          const range = new Range(
            document.positionAt(match.index),
            document.positionAt(match.index + match[0].length)
          )
          links.push({ range, target })
        } catch (error) {
          if (DEBUG) {
            console.error('[spiracss-comment-links] failed to resolve link', { error, match: match?.[0] })
          }
        }
      }
    }

    return links
  }
}

export function activate(context: ExtensionContext) {
  const provider = new LinkProvider()
  const configWatcher = workspace.createFileSystemWatcher('**/spiracss.config.js')
  const configSaveListener = workspace.onDidSaveTextDocument((document) => {
    if (document.uri.scheme !== 'file') return
    provider.refreshForConfigFile(document.uri)
  })
  context.subscriptions.push(
    provider,
    configWatcher,
    configSaveListener,
    configWatcher.onDidChange((uri) => provider.refreshForConfigFile(uri)),
    configWatcher.onDidCreate((uri) => provider.refreshForConfigFile(uri)),
    configWatcher.onDidDelete((uri) => provider.refreshForConfigFile(uri)),
    languages.registerDocumentLinkProvider({ scheme: 'file', language: 'scss' }, provider)
  )
}

export function deactivate(): void {
  workspaceConfigCache.clear()
  configWarningRoots.clear()
  aliasRootWarningKeys.clear()
}
