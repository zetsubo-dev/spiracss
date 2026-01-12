import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'url'

export type SpiracssConfig = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasDefaultExport = (value: Record<string, unknown>): value is { default: unknown } =>
  Object.prototype.hasOwnProperty.call(value, 'default')

const resolveConfigModule = (moduleValue: unknown): SpiracssConfig | undefined => {
  if (!isRecord(moduleValue)) return undefined
  if (hasDefaultExport(moduleValue)) {
    const maybeDefault = moduleValue.default
    return isRecord(maybeDefault) ? (maybeDefault as SpiracssConfig) : undefined
  }
  return moduleValue
}

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return undefined
  if (!('code' in error)) return undefined
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === 'string' ? code : undefined
}

const isRequireEsmError = (error: unknown): boolean => {
  if (!error) return false
  const code = getErrorCode(error)
  if (code === 'ERR_REQUIRE_ESM') return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ERR_REQUIRE_ESM')
}

const canRequire = typeof require === 'function'
let dynamicImport: ((specifier: string) => Promise<unknown>) | null = null

const formatLoadError = (absolutePath: string, cause?: unknown): Error => {
  const message =
    `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
    `Ensure the config file format is valid.`
  if (!cause) return new Error(message)
  const causeMessage = cause instanceof Error ? cause.message : String(cause)
  return new Error(`${message}\n\nCause: ${causeMessage}`)
}

const ensureConfigReadable = (absolutePath: string): boolean => {
  try {
    fs.accessSync(absolutePath, fs.constants.R_OK)
    const stats = fs.statSync(absolutePath)
    if (!stats.isFile()) {
      throw new Error(
        `Cannot access spiracss.config.js: ${absolutePath}\n\n` +
          `Check permissions and path state.`
      )
    }
    return true
  } catch (error) {
    const code = getErrorCode(error)
    if (code === 'ENOENT') return false
    if (
      code === 'EACCES' ||
      code === 'EPERM' ||
      code === 'ELOOP' ||
      code === 'ENOTDIR' ||
      code === 'EISDIR'
    ) {
      throw new Error(
        `Cannot access spiracss.config.js: ${absolutePath}\n\n` +
          `Check permissions and path state.`
      )
    }
    throw error
  }
}

const loadConfigWithRequire = (absolutePath: string): SpiracssConfig | undefined => {
  const resolved = require.resolve(absolutePath)
  delete require.cache[resolved]
  const config = require(absolutePath)
  return resolveConfigModule(config)
}

export const loadSpiracssConfig = async (
  configPath: string
): Promise<SpiracssConfig | undefined> => {
  const absolutePath = path.resolve(configPath)
  if (!ensureConfigReadable(absolutePath)) return undefined

  let requiresEsm = false
  if (canRequire) {
    let loaded: SpiracssConfig | undefined
    try {
      loaded = loadConfigWithRequire(absolutePath)
    } catch (error) {
      if (isRequireEsmError(error)) {
        requiresEsm = true
      } else {
        throw formatLoadError(absolutePath, error)
      }
    }
    if (loaded) return loaded
    if (!requiresEsm) {
      throw formatLoadError(absolutePath)
    }
  }

  const moduleUrl = pathToFileURL(absolutePath).href
  if (!canRequire) {
    let imported: unknown
    try {
      imported = await import(moduleUrl)
    } catch (error) {
      throw formatLoadError(absolutePath, error)
    }
    const loaded = resolveConfigModule(imported)
    if (!loaded) {
      throw formatLoadError(absolutePath)
    }
    return loaded
  }

  if (!dynamicImport) {
    try {
      dynamicImport = new Function(
        'specifier',
        'return import(specifier)'
      ) as (specifier: string) => Promise<unknown>
    } catch {
      throw new Error(
        `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
          `Dynamic import is unavailable in this environment.\n` +
          `Use CommonJS (module.exports) for spiracss.config.js or remove --disallow-code-generation-from-strings.`
      )
    }
  }

  let imported: unknown
  try {
    imported = await dynamicImport(moduleUrl)
  } catch (error) {
    throw formatLoadError(absolutePath, error)
  }
  const loaded = resolveConfigModule(imported)
  if (!loaded) {
    throw formatLoadError(absolutePath)
  }
  return loaded
}
