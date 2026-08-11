export type CliMode = 'root' | 'selection'
export type CliEntryPoint = 'generator' | 'lint'

export type ParsedCliArgs = {
  mode: CliMode
  useStdin: boolean
  allowProvisional: boolean
  baseDir?: string
  inputPath?: string
  ignoreStructureErrors: boolean
  dryRun: boolean
  json: boolean
}

export function parseCliArgs(argv: string[], entryPoint: CliEntryPoint = 'generator'): ParsedCliArgs {
  const supportedFlags = new Set([
    '--root',
    '--selection',
    '--stdin',
    '--allow-provisional',
    '--json',
    ...(entryPoint === 'generator' ? ['--ignore-structure-errors', '--dry-run'] : [])
  ])
  let rootMode = false
  let selectionMode = false
  let useStdin = false
  let allowProvisional = false
  let ignoreStructureErrors = false
  let dryRun = false
  let json = false
  let baseDir: string | undefined
  const positional: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--base-dir') {
      if (entryPoint === 'lint') {
        throw new Error('Usage error: --base-dir is not supported by spiracss-html-lint.')
      }
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('Usage error: --base-dir requires a directory operand.')
      }
      if (baseDir !== undefined) {
        throw new Error('Usage error: --base-dir may be specified only once.')
      }
      baseDir = value
      index += 1
      continue
    }
    if (arg.startsWith('--')) {
      if (!supportedFlags.has(arg)) throw new Error(`Usage error: option "${arg}" is not supported by this CLI.`)
      if (arg === '--root') rootMode = true
      if (arg === '--selection') selectionMode = true
      if (arg === '--stdin') useStdin = true
      if (arg === '--allow-provisional') allowProvisional = true
      if (arg === '--ignore-structure-errors') ignoreStructureErrors = true
      if (arg === '--dry-run') dryRun = true
      if (arg === '--json') json = true
      continue
    }
    positional.push(arg)
  }

  if (rootMode && selectionMode) {
    throw new Error('Usage error: --root and --selection are mutually exclusive.')
  }
  if (useStdin && positional.length > 0) {
    throw new Error('Usage error: --stdin cannot be combined with an input path.')
  }
  if (!useStdin && positional.length !== 1) {
    throw new Error('Usage error: provide exactly one input path or use --stdin.')
  }

  return {
    mode: selectionMode ? 'selection' : 'root',
    useStdin,
    allowProvisional,
    baseDir,
    inputPath: positional[0],
    ignoreStructureErrors,
    dryRun,
    json
  }
}
