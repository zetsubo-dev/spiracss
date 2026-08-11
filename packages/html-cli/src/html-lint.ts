import { promises as fsp } from 'fs'
import * as path from 'path'

import { warnInvalidCustomPatterns } from './config-warnings'
import { parseCliArgs } from './cli-args'
import { loadProjectOptions } from './config-options'
import { findMaxDepthIssue, formatIssueLocation, validationStatusFor } from './diagnostics'
import { type HtmlLintIssue, lintHtmlStructure } from './generator-core'

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

async function run(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2), 'lint')

  if (!args.useStdin && !args.inputPath) {
    console.error(
      'Usage: spiracss-html-lint [--root | --selection] [--stdin | path/to/input.html] [--json] [--allow-provisional]'
    )
    process.exitCode = 1
    return
  }

  const rootDir = process.cwd()
  const options = await loadProjectOptions(rootDir)
  const {
    naming,
    namingSource,
    selectorPolicy,
    external,
    jsxClassBindings,
    htmlLint,
    configStatus,
    configPath,
    configError
  } = options
  if (configStatus === 'missing') {
    console.error(`WARN: ${configPath} was not found; default SpiraCSS settings are provisional.`)
  }
  warnInvalidCustomPatterns(
    naming,
    (message) => {
      console.error(message)
    },
    namingSource
  )

  let html: string
  let filePath: string | undefined

  if (!args.useStdin) {
    filePath = path.resolve(args.inputPath as string)
  }

  if (configStatus === 'error' || (configStatus === 'missing' && !args.allowProvisional)) {
    const isMissing = configStatus === 'missing'
    const blocked = {
      code: isMissing ? 'CONFIG_MISSING' : 'CONFIG_LOAD_ERROR',
      message: isMissing
        ? `spiracss.config.js was not found at ${configPath}. Add the project config or rerun with --allow-provisional after explicitly accepting default settings.`
        : (configError ?? `Failed to load spiracss.config.js at ${configPath}.`)
    }
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            file: filePath ?? null,
            mode: args.mode,
            ok: false,
            status: 'blocked',
            config: { status: configStatus, path: configPath },
            provisional: isMissing,
            blocked,
            errors: []
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

  html = args.useStdin ? await readStdin() : await fsp.readFile(filePath as string, 'utf8')

  const isRootMode = args.mode === 'root'
  const issues: HtmlLintIssue[] = lintHtmlStructure(
    html,
    isRootMode,
    naming,
    selectorPolicy,
    external,
    jsxClassBindings,
    htmlLint
  )
  const maxDepthIssue = findMaxDepthIssue(issues)
  if (maxDepthIssue) {
    const blocked = { code: maxDepthIssue.code, message: maxDepthIssue.message }
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            file: filePath ?? null,
            mode: args.mode,
            ok: false,
            status: 'blocked',
            config: { status: configStatus, path: configPath },
            provisional: configStatus === 'missing',
            blocked,
            errors: issues
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
  const status = validationStatusFor({
    configStatus,
    hasIssues: issues.length > 0,
    allowProvisional: args.allowProvisional
  })

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          file: filePath ?? null,
          mode: args.mode,
          ok: status === 'pass',
          status,
          config: { status: configStatus, path: configPath },
          provisional: configStatus === 'missing',
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
        const loc = formatIssueLocation(issue)
        console.error(`ERROR [${issue.code}] at ${loc}: ${issue.message}`)
      }
    }
  }

  if (status !== 'pass') {
    process.exitCode = 1
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
}
