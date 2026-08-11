import * as fs from 'fs'
import { createHash } from 'crypto'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { Worker } from 'worker_threads'

export type SpiracssConfig = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

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
const ESM_CONFIG_LOAD_TIMEOUT_MS = 10_000

const ESM_CONFIG_WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads')

;(async () => {
  try {
    const imported = await import(workerData.moduleUrl)
    const value = Object.prototype.hasOwnProperty.call(imported, 'default') ? imported.default : imported
    parentPort.postMessage({ ok: true, value })
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: {
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    })
  }
})()
`

const loadEsmConfigInWorker = (moduleUrl: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(ESM_CONFIG_WORKER_SOURCE, { eval: true, workerData: { moduleUrl } })
    } catch (error) {
      const unavailable = error instanceof Error ? error : new Error(String(error))
      Object.assign(unavailable, { workerUnavailable: true })
      reject(unavailable)
      return
    }

    let settled = false
    let timeout: NodeJS.Timeout
    const finish = (handler: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      void worker.terminate().then(handler, handler)
    }
    worker.once(
      'message',
      (result: { ok: boolean; value?: unknown; error?: { code?: string; message: string; stack?: string } }) => {
        finish(() => {
          if (result.ok) {
            resolve(result.value)
            return
          }
          const error = new Error(result.error?.message ?? 'Failed to load ESM configuration.')
          if (result.error?.code) Object.assign(error, { code: result.error.code })
          if (result.error?.stack) error.stack = result.error.stack
          reject(error)
        })
      }
    )
    worker.once('error', (error) => {
      finish(() => reject(error))
    })
    worker.once('exit', (code) => {
      finish(() => reject(new Error(`ESM configuration worker exited before returning a result (exit code: ${code}).`)))
    })
    timeout = setTimeout(() => {
      finish(() => reject(new Error(`ESM configuration evaluation timed out after ${ESM_CONFIG_LOAD_TIMEOUT_MS}ms.`)))
    }, ESM_CONFIG_LOAD_TIMEOUT_MS)
  })

const isEsmConfig = (absolutePath: string): boolean => {
  const extension = path.extname(absolutePath).toLowerCase()
  if (extension === '.mjs') return true
  if (extension === '.cjs') return false

  let directory = path.dirname(absolutePath)
  while (true) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')) as {
        type?: unknown
      }
      if (packageJson.type === 'module') return true
      if (packageJson.type === 'commonjs') return false
    } catch {
      // Continue toward the filesystem root when package metadata is absent or invalid.
    }
    const parent = path.dirname(directory)
    if (parent === directory) return false
    directory = parent
  }
}

const formatLoadError = (absolutePath: string, cause?: unknown): Error => {
  const message = `Failed to load spiracss.config.js: ${absolutePath}\n\n` + `Ensure the config file format is valid.`
  if (!cause) return new Error(message)
  const causeMessage = cause instanceof Error ? cause.message : String(cause)
  return new Error(`${message}\n\nCause: ${causeMessage}`)
}

const ensureConfigReadable = (absolutePath: string): boolean => {
  try {
    fs.accessSync(absolutePath, fs.constants.R_OK)
    const stats = fs.statSync(absolutePath)
    if (!stats.isFile()) {
      throw new Error(`Cannot access spiracss.config.js: ${absolutePath}\n\n` + `Check permissions and path state.`)
    }
    return true
  } catch (error) {
    const code = getErrorCode(error)
    if (code === 'ENOENT') return false
    if (code === 'EACCES' || code === 'EPERM' || code === 'ELOOP' || code === 'ENOTDIR' || code === 'EISDIR') {
      throw new Error(`Cannot access spiracss.config.js: ${absolutePath}\n\n` + `Check permissions and path state.`)
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

export const loadSpiracssConfig = async (configPath: string): Promise<SpiracssConfig | undefined> => {
  const absolutePath = path.resolve(configPath)
  if (!ensureConfigReadable(absolutePath)) return undefined

  let requiresEsm = false
  if (canRequire && !isEsmConfig(absolutePath)) {
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

  const configDigest = createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex')
  const moduleUrl = `${pathToFileURL(absolutePath).href}?spiracss-config=${configDigest}`
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

  let imported: unknown
  try {
    imported = await loadEsmConfigInWorker(moduleUrl)
  } catch (error) {
    throw formatLoadError(absolutePath, error)
  }
  const loaded = resolveConfigModule(imported)
  if (!loaded) {
    throw formatLoadError(absolutePath)
  }
  return loaded
}
