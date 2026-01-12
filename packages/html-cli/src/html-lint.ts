import { promises as fsp } from 'fs'
import * as path from 'path'

import {
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
  allowExternalClasses?: string[]
  allowExternalPrefixes?: string[]
}

async function loadConfigFromConfig(rootDir: string): Promise<LintConfig> {
  const configPath = path.join(rootDir, 'spiracss.config.js')
  const config = await loadSpiracssConfig(configPath)
  if (config && typeof config === 'object') {
    const stylelintCfg = config.stylelint as Record<string, unknown> | undefined
    const classStructure = stylelintCfg?.classStructure as Record<string, unknown> | undefined
    const naming = classStructure?.naming
    const allowExternalClasses = classStructure?.allowExternalClasses
    const allowExternalPrefixes = classStructure?.allowExternalPrefixes
    const selectorPolicy = config.selectorPolicy as Record<string, unknown> | undefined
    const resolvedNaming =
      naming && typeof naming === 'object' ? (naming as NamingOptions) : {}
    const resolvedPolicy =
      selectorPolicy && typeof selectorPolicy === 'object'
        ? (selectorPolicy as SelectorPolicy)
        : undefined
    return {
      naming: resolvedNaming,
      selectorPolicy: resolvedPolicy,
      allowExternalClasses: Array.isArray(allowExternalClasses)
        ? allowExternalClasses.filter((item) => typeof item === 'string' && item.trim() !== '')
        : undefined,
      allowExternalPrefixes: Array.isArray(allowExternalPrefixes)
        ? allowExternalPrefixes.filter((item) => typeof item === 'string' && item.trim() !== '')
        : undefined
    }
  }
  return { naming: {}, selectorPolicy: undefined }
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
  const { naming, selectorPolicy, allowExternalClasses, allowExternalPrefixes } =
    await loadConfigFromConfig(rootDir)
  warnInvalidCustomPatterns(naming, (message) => {
    console.error(message)
  })

  let html: string
  let filePath: string | undefined

  if (args.useStdin) {
    html = await readStdin()
  } else {
    filePath = path.resolve(args.inputPath as string)
    html = await fsp.readFile(filePath, 'utf8')
  }

  const isRootMode = args.mode === 'root'
  const issues: HtmlLintIssue[] = lintHtmlStructure(html, isRootMode, naming, selectorPolicy, {
    allowExternalClasses,
    allowExternalPrefixes
  })

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
