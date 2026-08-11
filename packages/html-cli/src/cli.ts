import { promises as fsp } from 'fs'
import * as path from 'path'

import { loadSpiracssConfig } from './config-loader'
import { warnInvalidCustomPatterns } from './config-warnings'
import {
  type FileNameCase,
  generateFromHtml,
  type GeneratorOptions,
  type HtmlLintOptions,
  type JsxClassBindingsConfig,
  lintHtmlStructure,
  type NamingOptions,
  type SelectorPolicy
} from './generator-core'

type Mode = 'root' | 'selection'

type ParsedArgs = {
  mode: Mode
  useStdin: boolean
  allowProvisional: boolean
  baseDir?: string
  inputPath?: string
  ignoreStructureErrors: boolean
  dryRun: boolean
  json: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function formatIssueLocation(issue: {
  path: string[]
  target?: { siblingIndex: number }
  targetPath?: Array<{ tagName: string; siblingIndex: number; className?: string }>
}): string {
  const sibling = issue.target && issue.target.siblingIndex > 1 ? ` (sibling #${issue.target.siblingIndex})` : ''
  const targetPath =
    issue.targetPath && issue.targetPath.length > 0
      ? ` [DOM: ${issue.targetPath.map((target) => `<${target.tagName}>#${target.siblingIndex}${target.className ? `.${target.className}` : ''}`).join(' > ')}]`
      : ''
  return `${issue.path.join(' > ') || '(root)'}${sibling}${targetPath}`
}

function isFileNameCase(value: string): value is FileNameCase {
  return value === 'preserve' || value === 'kebab' || value === 'snake' || value === 'camel' || value === 'pascal'
}

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

const normalizeMemberAccessAllowlist = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
}

function parseArgs(argv: string[]): ParsedArgs {
  const mode: Mode = argv.includes('--selection') ? 'selection' : 'root'
  const useStdin = argv.includes('--stdin')
  const allowProvisional = argv.includes('--allow-provisional')
  const dryRun = argv.includes('--dry-run')
  const json = argv.includes('--json')
  const ignoreStructureErrors = argv.includes('--ignore-structure-errors')

  const baseDirIndex = argv.indexOf('--base-dir')
  let baseDir: string | undefined
  if (baseDirIndex !== -1 && argv[baseDirIndex + 1] && !argv[baseDirIndex + 1].startsWith('--')) {
    baseDir = argv[baseDirIndex + 1]
  }

  const baseDirValue = baseDirIndex !== -1 ? argv[baseDirIndex + 1] : undefined
  const positional = argv.filter((arg, idx) => {
    if (arg.startsWith('--')) return false
    if (baseDirIndex !== -1 && idx === baseDirIndex + 1) return false
    return true
  })

  const inputPath = positional[0]

  return { mode, useStdin, allowProvisional, baseDir, inputPath, ignoreStructureErrors, dryRun, json }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', (err) => reject(err))
  })
}

async function loadGeneratorOptions(rootDir: string): Promise<
  GeneratorOptions & {
    namingSource: string
    configStatus: 'missing' | 'loaded' | 'error'
    configPath: string
    configError?: string
  }
> {
  const defaultGlobalScssModule = '@styles/partials/global'
  const defaultPageAlias = 'assets'
  const defaultPageSubdir = 'css'
  const defaultChildDir = 'scss'
  // Default to no layout mixins to avoid generating SCSS that won't compile
  // unless the project defines the expected mixin(s).
  const defaultLayoutMixins: string[] = []
  const defaultRootFileCase: FileNameCase = 'preserve'
  const defaultChildFileCase: FileNameCase = 'preserve'

  let globalScssModule = defaultGlobalScssModule
  let pageEntryPrefix = `@${defaultPageAlias}/${defaultPageSubdir}`
  let childScssDir = defaultChildDir
  let layoutMixins = defaultLayoutMixins
  let naming: NamingOptions = {}
  let rootFileCase: FileNameCase = defaultRootFileCase
  let childFileCase: FileNameCase = defaultChildFileCase
  let namingSource = 'stylelint.base.naming.customPatterns'
  let selectorPolicy: SelectorPolicy | undefined
  let externalClasses: string[] = []
  let externalPrefixes: string[] = []
  let jsxClassBindings: JsxClassBindingsConfig | undefined
  let htmlLint: HtmlLintOptions | undefined

  const configPath = path.join(rootDir, 'spiracss.config.js')
  let config: Awaited<ReturnType<typeof loadSpiracssConfig>>
  let configStatus: 'missing' | 'loaded' | 'error'
  let configError: string | undefined
  try {
    config = await loadSpiracssConfig(configPath)
    configStatus = config ? 'loaded' : 'missing'
  } catch (error) {
    config = undefined
    configStatus = 'error'
    configError = error instanceof Error ? error.message : String(error)
  }
  if (config && typeof config === 'object') {
    const fileCaseConfig = resolveFileCaseConfig((config as Record<string, unknown>).fileCase)
    const generator = config.generator as Record<string, unknown> | undefined
    const stylelintCfg = config.stylelint as Record<string, unknown> | undefined
    const base = stylelintCfg?.base as Record<string, unknown> | undefined
    const classConfig = stylelintCfg?.class as Record<string, unknown> | undefined
    const selectorPolicyConfig = config.selectorPolicy as Record<string, unknown> | undefined
    const htmlLintConfig = config.htmlLint

    const entry = generator?.globalScssModule
    if (typeof entry === 'string' && entry.trim() !== '') {
      globalScssModule = entry
    }

    const alias = (generator?.pageEntryAlias as string | undefined) ?? defaultPageAlias
    const subdir = (generator?.pageEntrySubdir as string | undefined) ?? defaultPageSubdir
    pageEntryPrefix = subdir && subdir.trim() !== '' ? `@${alias}/${subdir}` : `@${alias}`

    const dir = (generator?.childScssDir as string | undefined) ?? defaultChildDir
    if (dir && dir.trim() !== '') {
      childScssDir = dir
    }

    const mixins = generator?.layoutMixins
    if (Array.isArray(mixins)) {
      const list = mixins.filter((v: unknown) => typeof v === 'string' && (v as string).trim() !== '')
      layoutMixins = list.length > 0 ? list : []
    }

    const fileCase = generator?.rootFileCase as string | undefined
    if (typeof fileCase === 'string' && isFileNameCase(fileCase)) {
      rootFileCase = fileCase
    } else if (fileCaseConfig.root) {
      rootFileCase = fileCaseConfig.root
    }

    const childCase = generator?.childFileCase as string | undefined
    if (typeof childCase === 'string' && isFileNameCase(childCase)) {
      childFileCase = childCase
    } else if (fileCaseConfig.child) {
      childFileCase = fileCaseConfig.child
    }

    const baseNaming = base?.naming
    const classNaming = classConfig?.naming
    if (isRecord(baseNaming)) {
      naming = baseNaming as NamingOptions
      namingSource = 'stylelint.base.naming.customPatterns'
    } else if (isRecord(classNaming)) {
      naming = classNaming as NamingOptions
      namingSource = 'stylelint.class.naming.customPatterns'
    }

    const baseExternal = base?.external
    const classExternal = classConfig?.external
    const external = {
      ...(isRecord(baseExternal) ? baseExternal : {}),
      ...(isRecord(classExternal) ? classExternal : {})
    }
    if (Array.isArray(external.classes)) {
      externalClasses = external.classes.filter((item: unknown) => typeof item === 'string' && item.trim() !== '')
    }
    if (Array.isArray(external.prefixes)) {
      externalPrefixes = external.prefixes.filter((item: unknown) => typeof item === 'string' && item.trim() !== '')
    }

    if (selectorPolicyConfig && typeof selectorPolicyConfig === 'object') {
      selectorPolicy = selectorPolicyConfig as SelectorPolicy
    }

    const jsxBindingsConfig = (config as Record<string, unknown>).jsxClassBindings as
      | Record<string, unknown>
      | undefined
    if (jsxBindingsConfig && typeof jsxBindingsConfig === 'object') {
      const allowlist = normalizeMemberAccessAllowlist(jsxBindingsConfig.memberAccessAllowlist)
      if (allowlist !== undefined) {
        jsxClassBindings = { memberAccessAllowlist: allowlist }
      }
    }

    if (isRecord(htmlLintConfig)) {
      htmlLint = htmlLintConfig as HtmlLintOptions
    }
  }

  warnInvalidCustomPatterns(
    naming,
    (message) => {
      console.error(message)
    },
    namingSource
  )

  return {
    globalScssModule,
    pageEntryPrefix,
    childScssDir,
    layoutMixins,
    naming,
    rootFileCase,
    childFileCase,
    selectorPolicy,
    external: {
      classes: externalClasses,
      prefixes: externalPrefixes
    },
    jsxClassBindings,
    htmlLint,
    namingSource,
    configStatus,
    configPath,
    configError
  }
}

async function mergeIndex(dir: string, entries: string[]): Promise<void> {
  const file = path.join(dir, 'index.scss')
  let cur: string[] = []
  try {
    const text = await fsp.readFile(file, 'utf8')
    cur = text.split('\n')
  } catch {
    // no-op (create new if missing)
  }
  const uses = new Set(cur.filter((l) => l.startsWith('@use')))
  entries.forEach((e) => uses.add(e))
  await fsp.writeFile(file, Array.from(uses).join('\n') + '\n', 'utf8')
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (!args.useStdin && !args.inputPath) {
    console.error(
      'Usage: spiracss-html-to-scss [--root | --selection] [--stdin | path/to/input.html] [--base-dir dir] [--dry-run] [--json] [--allow-provisional]'
    )
    process.exitCode = 1
    return
  }

  const rootDir = process.cwd()
  const options = await loadGeneratorOptions(rootDir)
  if (options.configStatus === 'missing') {
    console.error(`WARN: ${options.configPath} was not found; default SpiraCSS settings are provisional.`)
  }

  let html: string
  let docDir: string
  let inputPath: string | null = null

  if (args.useStdin) {
    docDir = args.baseDir ? path.resolve(args.baseDir) : rootDir
  } else {
    inputPath = path.resolve(args.inputPath as string)
    docDir = args.baseDir ? path.resolve(args.baseDir) : path.dirname(inputPath)
  }

  if (options.configStatus === 'error' || (options.configStatus === 'missing' && !args.allowProvisional)) {
    const isMissing = options.configStatus === 'missing'
    const blocked = {
      code: isMissing ? 'CONFIG_MISSING' : 'CONFIG_LOAD_ERROR',
      message: isMissing
        ? `spiracss.config.js was not found at ${options.configPath}. Add the project config or rerun with --allow-provisional after explicitly accepting default settings.`
        : (options.configError ?? `Failed to load spiracss.config.js at ${options.configPath}.`)
    }
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            mode: args.mode,
            file: inputPath,
            docDir,
            config: { status: options.configStatus, path: options.configPath },
            provisional: isMissing,
            blocked,
            errors: [],
            files: []
          },
          null,
          2
        )
      )
    } else {
      console.error(`ERROR [${blocked.code}]: ${blocked.message}`)
    }
    process.exitCode = 1
    return
  }

  html = args.useStdin ? await readStdin() : await fsp.readFile(inputPath as string, 'utf8')

  const isRootMode = args.mode === 'root'
  const structureIssues = lintHtmlStructure(
    html,
    isRootMode,
    options.naming,
    options.selectorPolicy,
    options.external,
    options.jsxClassBindings,
    options.htmlLint
  )

  if (structureIssues.length > 0) {
    if (args.ignoreStructureErrors) {
      for (const issue of structureIssues) {
        const loc = formatIssueLocation(issue)
        console.error(`WARN [${issue.code}] at ${loc}: ${issue.message} (ignored)`)
      }
    } else {
      if (args.json) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              mode: args.mode,
              file: inputPath,
              docDir,
              config: { status: options.configStatus, path: options.configPath },
              provisional: options.configStatus === 'missing',
              errors: structureIssues,
              files: []
            },
            null,
            2
          )
        )
        process.exitCode = 1
        return
      }
      for (const issue of structureIssues) {
        const loc = formatIssueLocation(issue)
        console.error(`ERROR [${issue.code}] at ${loc}: ${issue.message}`)
      }
      process.exitCode = 1
      return
    }
  }

  const generated = generateFromHtml(html, docDir, isRootMode, options)

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ok: structureIssues.length === 0,
          mode: args.mode,
          file: inputPath,
          docDir,
          config: { status: options.configStatus, path: options.configPath },
          provisional: options.configStatus === 'missing',
          errors: args.ignoreStructureErrors ? structureIssues : [],
          files: generated
        },
        null,
        2
      )
    )
    return
  }

  if (args.dryRun) {
    for (const file of generated) {
      console.log(path.join(docDir, file.path))
    }
    return
  }

  const childDir = path.join(docDir, options.childScssDir)
  await fsp.mkdir(childDir, { recursive: true })

  const indexUses: string[] = []

  for (const file of generated) {
    if (file.path.endsWith('/index.scss') || file.path === `${options.childScssDir}/index.scss`) {
      const lines = file.content.split('\n').filter((l) => l.startsWith('@use'))
      indexUses.push(...lines)
      continue
    }
    const outPath = path.join(docDir, file.path)
    await fsp.mkdir(path.dirname(outPath), { recursive: true })
    await fsp.writeFile(outPath, file.content, 'utf8')
  }

  if (indexUses.length > 0) {
    await mergeIndex(childDir, indexUses)
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
}
