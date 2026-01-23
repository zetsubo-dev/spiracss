import { promises as fsp } from 'fs'
import * as path from 'path'

import {
  type ExternalOptions,
  type HtmlLintIssue,
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
  inputPath?: string
  json: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function parseArgs(argv: string[]): ParsedArgs {
  const mode: Mode = argv.includes('--selection') ? 'selection' : 'root'
  const useStdin = argv.includes('--stdin')
  const json = argv.includes('--json')

  const positional = argv.filter((arg) => !arg.startsWith('--'))
  const inputPath = useStdin ? undefined : positional[0]

  return { mode, useStdin, inputPath, json }
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

type LintConfig = {
  naming: NamingOptions
  selectorPolicy?: SelectorPolicy
  external?: ExternalOptions
  namingSource: string
}

async function loadConfigFromConfig(rootDir: string): Promise<LintConfig> {
  const configPath = path.join(rootDir, 'spiracss.config.js')
  const config = await loadSpiracssConfig(configPath)
  if (config && typeof config === 'object') {
    const stylelintCfg = config.stylelint as Record<string, unknown> | undefined
    const base = stylelintCfg?.base as Record<string, unknown> | undefined
    const classConfig = stylelintCfg?.class as Record<string, unknown> | undefined
    const selectorPolicy = config.selectorPolicy as Record<string, unknown> | undefined
    const resolvedSelectorPolicy =
      selectorPolicy && typeof selectorPolicy === 'object'
        ? (selectorPolicy as SelectorPolicy)
        : undefined
    const baseNaming = base?.naming
    const classNaming = classConfig?.naming
    let resolvedNaming: NamingOptions = {}
    let namingSource = 'stylelint.base.naming.customPatterns'
    if (isRecord(baseNaming)) {
      resolvedNaming = baseNaming as NamingOptions
      namingSource = 'stylelint.base.naming.customPatterns'
    } else if (isRecord(classNaming)) {
      resolvedNaming = classNaming as NamingOptions
      namingSource = 'stylelint.class.naming.customPatterns'
    }
    const baseExternal = base?.external
    const classExternal = classConfig?.external
    const external = {
      ...(isRecord(baseExternal) ? baseExternal : {}),
      ...(isRecord(classExternal) ? classExternal : {})
    }
    const classes = Array.isArray(external.classes)
      ? external.classes.filter((item: unknown) => typeof item === 'string' && item.trim() !== '')
      : undefined
    const prefixes = Array.isArray(external.prefixes)
      ? external.prefixes.filter((item: unknown) => typeof item === 'string' && item.trim() !== '')
      : undefined
    return {
      naming: resolvedNaming,
      namingSource,
      selectorPolicy: resolvedSelectorPolicy,
      external: {
        classes,
        prefixes
      }
    }
  }
  return { naming: {}, namingSource: 'stylelint.base.naming.customPatterns', selectorPolicy: undefined }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (!args.useStdin && !args.inputPath) {
    console.error(
      'Usage: spiracss-html-lint [--root | --selection] [--stdin | path/to/input.html] [--json]'
    )
    process.exitCode = 1
    return
  }

  const rootDir = process.cwd()
  const { naming, namingSource, selectorPolicy, external } = await loadConfigFromConfig(rootDir)
  warnInvalidCustomPatterns(naming, (message) => {
    console.error(message)
  }, namingSource)

  let html: string
  let filePath: string | undefined

  if (args.useStdin) {
    html = await readStdin()
  } else {
    filePath = path.resolve(args.inputPath as string)
    html = await fsp.readFile(filePath, 'utf8')
  }

  const isRootMode = args.mode === 'root'
  const issues: HtmlLintIssue[] = lintHtmlStructure(
    html,
    isRootMode,
    naming,
    selectorPolicy,
    external
  )

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          file: filePath ?? null,
          mode: args.mode,
          ok: issues.length === 0,
          errors: issues
        },
        null,
        2
      )
    )
  } else {
    if (issues.length === 0) {
      console.log('No SpiraCSS HTML structure errors.')
    } else {
      for (const issue of issues) {
        const loc = issue.path.join(' > ') || '(root)'
        console.error(`ERROR [${issue.code}] at ${loc}: ${issue.message}`)
      }
    }
  }

  if (issues.length > 0) {
    process.exitCode = 1
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
}
