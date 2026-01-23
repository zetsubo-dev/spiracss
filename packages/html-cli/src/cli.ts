import { promises as fsp } from 'fs'
import * as path from 'path'

import {
  type FileNameCase,
  generateFromHtml,
  type GeneratorOptions,
  lintHtmlStructure,
  type NamingOptions,
  type SelectorPolicy
} from './generator-core'
import { loadSpiracssConfig } from './config-loader'
import { warnInvalidCustomPatterns } from './config-warnings'

type Mode = 'root' | 'selection'

type ParsedArgs = {
  mode: Mode
  useStdin: boolean
  baseDir?: string
  inputPath?: string
  ignoreStructureErrors: boolean
  dryRun: boolean
  json: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function isFileNameCase(value: string): value is FileNameCase {
  return (
    value === 'preserve' ||
    value === 'kebab' ||
    value === 'snake' ||
    value === 'camel' ||
    value === 'pascal'
  )
}

function parseArgs(argv: string[]): ParsedArgs {
  const mode: Mode = argv.includes('--selection') ? 'selection' : 'root'
  const useStdin = argv.includes('--stdin')
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

  return { mode, useStdin, baseDir, inputPath, ignoreStructureErrors, dryRun, json }
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

async function loadGeneratorOptions(
  rootDir: string
): Promise<GeneratorOptions & { namingSource: string }> {
  const defaultGlobalScssModule = '@styles/partials/global'
  const defaultPageAlias = 'assets'
  const defaultPageSubdir = 'css'
  const defaultChildDir = 'scss'
  const defaultLayoutMixins = ['@include breakpoint-up(md)']
  const defaultRootFileCase: FileNameCase = 'preserve'

  let globalScssModule = defaultGlobalScssModule
  let pageEntryPrefix = `@${defaultPageAlias}/${defaultPageSubdir}`
  let childScssDir = defaultChildDir
  let layoutMixins = defaultLayoutMixins
  let naming: NamingOptions = {}
  let rootFileCase: FileNameCase = defaultRootFileCase
  let namingSource = 'stylelint.base.naming.customPatterns'
  let selectorPolicy: SelectorPolicy | undefined
  let externalClasses: string[] = []
  let externalPrefixes: string[] = []

  const configPath = path.join(rootDir, 'spiracss.config.js')
  const config = await loadSpiracssConfig(configPath)
  if (config && typeof config === 'object') {
    const generator = config.generator as Record<string, unknown> | undefined
    const stylelintCfg = config.stylelint as Record<string, unknown> | undefined
    const base = stylelintCfg?.base as Record<string, unknown> | undefined
    const classConfig = stylelintCfg?.class as Record<string, unknown> | undefined
    const selectorPolicyConfig = config.selectorPolicy as Record<string, unknown> | undefined

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
      externalClasses = external.classes.filter(
        (item: unknown) => typeof item === 'string' && item.trim() !== ''
      )
    }
    if (Array.isArray(external.prefixes)) {
      externalPrefixes = external.prefixes.filter(
        (item: unknown) => typeof item === 'string' && item.trim() !== ''
      )
    }

    if (selectorPolicyConfig && typeof selectorPolicyConfig === 'object') {
      selectorPolicy = selectorPolicyConfig as SelectorPolicy
    }
  }

  warnInvalidCustomPatterns(naming, (message) => {
    console.error(message)
  }, namingSource)

  return {
    globalScssModule,
    pageEntryPrefix,
    childScssDir,
    layoutMixins,
    naming,
    rootFileCase,
    selectorPolicy,
    external: {
      classes: externalClasses,
      prefixes: externalPrefixes
    },
    namingSource
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
      'Usage: spiracss-html-to-scss [--root | --selection] [--stdin | path/to/input.html] [--base-dir dir] [--dry-run] [--json]'
    )
    process.exitCode = 1
    return
  }

  const rootDir = process.cwd()
  const options = await loadGeneratorOptions(rootDir)

  let html: string
  let docDir: string

  if (args.useStdin) {
    html = await readStdin()
    docDir = args.baseDir ? path.resolve(args.baseDir) : rootDir
  } else {
    const inputPath = path.resolve(args.inputPath as string)
    html = await fsp.readFile(inputPath, 'utf8')
    docDir = args.baseDir ? path.resolve(args.baseDir) : path.dirname(inputPath)
  }

  const isRootMode = args.mode === 'root'
  const structureIssues = lintHtmlStructure(
    html,
    isRootMode,
    options.naming,
    options.selectorPolicy,
    options.external
  )

  if (structureIssues.length > 0) {
    if (args.ignoreStructureErrors) {
      for (const issue of structureIssues) {
        const loc = issue.path.join(' > ') || '(root)'
        console.error(`WARN [${issue.code}] at ${loc}: ${issue.message} (ignored)`)
      }
    } else {
      for (const issue of structureIssues) {
        const loc = issue.path.join(' > ') || '(root)'
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
          mode: args.mode,
          docDir,
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
