import { promises as fsp } from 'fs'
import * as path from 'path'

import { warnInvalidCustomPatterns } from './config-warnings'
import { loadProjectOptions } from './config-options'
import { parseCliArgs } from './cli-args'
import { findMaxDepthIssue, formatIssueLocation, validationStatusFor } from './diagnostics'
import { generateFromHtml, isGeneratedIndexFile, lintHtmlStructure } from './generator-core'

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
  const args = parseCliArgs(process.argv.slice(2))

  if (!args.useStdin && !args.inputPath) {
    console.error(
      'Usage: spiracss-html-to-scss [--root | --selection] [--stdin | path/to/input.html] [--base-dir dir] [--dry-run] [--json] [--allow-provisional]'
    )
    process.exitCode = 1
    return
  }

  const rootDir = process.cwd()
  const options = await loadProjectOptions(rootDir)
  warnInvalidCustomPatterns(
    options.naming,
    (message) => {
      console.error(message)
    },
    options.namingSource
  )
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
            status: 'blocked',
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
  const maxDepthIssue = findMaxDepthIssue(structureIssues)
  if (maxDepthIssue) {
    const blocked = { code: maxDepthIssue.code, message: maxDepthIssue.message }
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: 'blocked',
            mode: args.mode,
            file: inputPath,
            docDir,
            config: { status: options.configStatus, path: options.configPath },
            provisional: options.configStatus === 'missing',
            blocked,
            errors: structureIssues,
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
  const status = validationStatusFor({
    configStatus: options.configStatus,
    hasIssues: structureIssues.length > 0,
    allowProvisional: args.allowProvisional,
    ignoreStructureErrors: args.ignoreStructureErrors
  })

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
              status: validationStatusFor({
                configStatus: options.configStatus,
                hasIssues: true,
                allowProvisional: args.allowProvisional
              }),
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

  let generated: ReturnType<typeof generateFromHtml>
  try {
    generated = generateFromHtml(html, docDir, isRootMode, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.startsWith('HTML traversal exceeded the safety limit')
      ? 'MAX_DEPTH_EXCEEDED'
      : 'GENERATION_ERROR'
    const blocked = { code, message }
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: 'blocked',
            mode: args.mode,
            file: inputPath,
            docDir,
            config: { status: options.configStatus, path: options.configPath },
            provisional: options.configStatus === 'missing',
            blocked,
            errors: args.ignoreStructureErrors ? structureIssues : [],
            files: []
          },
          null,
          2
        )
      )
    } else {
      console.error(`ERROR [${code}]: ${message}`)
    }
    process.exitCode = 1
    return
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ok: status === 'pass',
          status,
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
    if (status !== 'pass') process.exitCode = 1
    return
  }

  if (args.dryRun) {
    for (const file of generated) {
      console.log(path.join(docDir, file.path))
    }
    if (status !== 'pass') process.exitCode = 1
    return
  }

  const childDir = path.join(docDir, options.childScssDir)
  await fsp.mkdir(childDir, { recursive: true })

  const indexUses: string[] = []

  for (const file of generated) {
    if (isGeneratedIndexFile(file.path, options.childScssDir)) {
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
  if (status !== 'pass') process.exitCode = 1
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
}
