// createRules helper
// Loads spiracss.config.js and builds SpiraCSS rules.

import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'url'

import type {
  Options as ClassStructureOptions,
  SelectorPolicy as ClassStructureSelectorPolicy
} from './rules/spiracss-class-structure.types'
import type { Options as InteractionPropertiesOptions } from './rules/spiracss-interaction-properties.types'
import type {
  Options as InteractionScopeOptions,
  SelectorPolicy as InteractionScopeSelectorPolicy
} from './rules/spiracss-interaction-scope.types'
import type { Options as KeyframesNamingOptions } from './rules/spiracss-keyframes-naming.types'
import type { Options as PropertyPlacementOptions } from './rules/spiracss-property-placement.types'
import type { Options as PseudoNestingOptions } from './rules/spiracss-pseudo-nesting.types'
import type { Options as RelCommentsOptions } from './rules/spiracss-rel-comments.types'
import type { CacheSizes, NamingOptions } from './types'
import { isAliasRoots, isPlainObject } from './utils/validate'

type CommentConfig = {
  shared?: RegExp | string
  interaction?: RegExp | string
}

type ExternalConfig = {
  classes?: string[]
  prefixes?: string[]
}

type BasePathsConfig = {
  childDir?: string
  components?: string[]
}

type BaseConfig = {
  comments?: CommentConfig
  naming?: NamingOptions
  external?: ExternalConfig
  selectorPolicy?: ClassStructureSelectorPolicy
  cache?: CacheSizes
  paths?: BasePathsConfig
}

type ClassStructureConfig = {
  elementDepth?: number
  childCombinator?: boolean
  childNesting?: boolean
  rootSingle?: boolean
  rootFile?: boolean
  rootCase?: ClassStructureOptions['root']['case']
  childDir?: string
  componentsDirs?: string[]
  comments?: CommentConfig
  naming?: NamingOptions
  external?: ExternalConfig
  selectorPolicy?: ClassStructureSelectorPolicy
  cache?: CacheSizes
}

type InteractionScopeConfig = {
  pseudos?: InteractionScopeOptions['pseudos']
  requireAtRoot?: boolean
  requireComment?: boolean
  requireTail?: boolean
  commentOnly?: boolean
  comments?: CommentConfig
  selectorPolicy?: InteractionScopeSelectorPolicy
  cache?: CacheSizes
}

type RelCommentsConfig = {
  requireScss?: boolean
  requireMeta?: boolean
  requireParent?: boolean
  requireChild?: boolean
  requireChildShared?: boolean
  requireChildInteraction?: boolean
  validatePath?: boolean
  skipNoRules?: boolean
  childDir?: string
  aliasRoots?: Record<string, string[]>
  comments?: CommentConfig
  naming?: NamingOptions
  external?: ExternalConfig
  cache?: CacheSizes
}

type InteractionPropertiesConfig = {
  comments?: CommentConfig
  naming?: NamingOptions
  external?: ExternalConfig
  cache?: CacheSizes
}

type PropertyPlacementConfig = {
  elementDepth?: number
  marginSide?: PropertyPlacementOptions['margin']['side']
  position?: boolean
  sizeInternal?: boolean
  responsiveMixins?: string[]
  comments?: CommentConfig
  naming?: NamingOptions
  external?: ExternalConfig
  selectorPolicy?: ClassStructureSelectorPolicy
  cache?: CacheSizes
}

type KeyframesNamingConfig = {
  enabled?: boolean
  actionMaxWords?: number
  blockSource?: KeyframesNamingOptions['block']['source']
  blockWarnMissing?: boolean
  sharedPrefixes?: string[]
  sharedFiles?: Array<string | RegExp>
  ignoreFiles?: Array<string | RegExp>
  ignorePatterns?: Array<string | RegExp>
  ignoreSkipPlacement?: boolean
  naming?: NamingOptions
  external?: ExternalConfig
  cache?: CacheSizes
}

type PseudoNestingConfig = {
  cache?: CacheSizes
}

type SpiracssConfig = {
  aliasRoots?: Record<string, string[]>
  selectorPolicy?: ClassStructureSelectorPolicy
  generator?: {
    rootFileCase?: ClassStructureOptions['root']['case']
    childScssDir?: string
  }
  stylelint?: {
    base?: BaseConfig
    class?: ClassStructureConfig
    placement?: PropertyPlacementConfig
    interactionScope?: InteractionScopeConfig
    interactionProps?: InteractionPropertiesConfig
    keyframes?: KeyframesNamingConfig
    pseudo?: PseudoNestingConfig
    rel?: RelCommentsConfig
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasDefaultExport = (value: Record<string, unknown>): value is { default: unknown } =>
  Object.prototype.hasOwnProperty.call(value, 'default')

const isSpiracssConfig = (value: unknown): value is SpiracssConfig => isRecord(value)

const resolveConfigModule = (moduleValue: unknown): SpiracssConfig | undefined => {
  if (!isRecord(moduleValue)) return undefined
  if (hasDefaultExport(moduleValue)) {
    const maybeDefault = moduleValue.default
    if (isSpiracssConfig(maybeDefault)) {
      return maybeDefault
    }
    return undefined
  }
  return isSpiracssConfig(moduleValue) ? moduleValue : undefined
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

const createEsmPathError = (): Error =>
  new Error(
    `In ESM environments, createRules() cannot accept a file path.\n` +
      `Use createRulesAsync(path) or import spiracss.config.js and pass the config object to createRules(config).\n` +
      `Example: import config from './spiracss.config.js'`
  )

const createConfigLoadError = (source: string, cause?: unknown): Error => {
  const error = new Error(
    `Failed to load spiracss.config.js: ${source}\n\n` +
      `Ensure the config file format is valid.`
  )
  if (cause !== undefined) {
    ;(error as Error & { cause?: unknown }).cause = cause
  }
  return error
}

const createRequireEsmLoadError = (absolutePath: string): Error =>
  new Error(
    `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
      `In ESM projects ("type": "module"), require() is unavailable.\n` +
      `Use createRulesAsync(path) or import the config and pass it to createRules(config).`
  )

const createDynamicImportError = (absolutePath: string): Error =>
  new Error(
    `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
      `Dynamic import is unavailable in this environment.\n` +
      `Use createRules(config) instead of createRulesAsync(path).`
  )

const canRequire = typeof require === 'function'
// Keep dynamic import callable in CJS output (avoid TS rewriting it to require()).
// Lazy initialization is safe here because module execution is single-threaded.
let dynamicImport: ((specifier: string) => Promise<unknown>) | null = null

const loadConfigFromPath = (absolutePath: string): SpiracssConfig => {
  if (!canRequire) {
    throw createEsmPathError()
  }
  try {
    const loaded = resolveConfigModule(require(absolutePath))
    if (!loaded) {
      throw createConfigLoadError(absolutePath)
    }
    return loaded
  } catch (error) {
    if (isRequireEsmError(error)) {
      throw createRequireEsmLoadError(absolutePath)
    }
    throw createConfigLoadError(absolutePath, error)
  }
}

const loadConfigFromPathAsync = async (absolutePath: string): Promise<SpiracssConfig> => {
  if (canRequire) {
    try {
      const loaded = resolveConfigModule(require(absolutePath))
      if (!loaded) {
        throw createConfigLoadError(absolutePath)
      }
      return loaded
    } catch (error) {
      if (!isRequireEsmError(error)) {
        throw createConfigLoadError(absolutePath, error)
      }
    }
  }

  const moduleUrl = pathToFileURL(absolutePath).href
  if (!canRequire) {
    try {
      const loaded = resolveConfigModule(await import(moduleUrl))
      if (!loaded) {
        throw createConfigLoadError(absolutePath)
      }
      return loaded
    } catch (error) {
      throw createConfigLoadError(absolutePath, error)
    }
  }

  if (!dynamicImport) {
    try {
      dynamicImport = new Function(
        'specifier',
        'return import(specifier)'
      ) as (specifier: string) => Promise<unknown>
    } catch {
      throw createDynamicImportError(absolutePath)
    }
  }

  try {
    const loaded = resolveConfigModule(await dynamicImport(moduleUrl))
    if (!loaded) {
      throw createConfigLoadError(absolutePath)
    }
    return loaded
  } catch (error) {
    throw createConfigLoadError(absolutePath, error)
  }
}

type ConfigTarget = {
  configSource: string
  absolutePath?: string
  spiracss?: SpiracssConfig
}

const resolveConfigTarget = (
  configPathOrConfig?: string | SpiracssConfig,
  options?: { requireSync?: boolean }
): ConfigTarget => {
  if (!configPathOrConfig || typeof configPathOrConfig === 'string') {
    if (options?.requireSync && !canRequire) {
      throw createEsmPathError()
    }
    const resolvedPath = configPathOrConfig || './spiracss.config.js'
    const absolutePath = path.resolve(resolvedPath)
    return { configSource: absolutePath, absolutePath }
  }
  return { spiracss: configPathOrConfig, configSource: 'spiracss.config.js (object)' }
}

const ensureConfigFileExists = (absolutePath: string): void => {
  let hasConfig = false
  try {
    hasConfig = fs.existsSync(absolutePath)
  } catch (error) {
    const code = getErrorCode(error)
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
  if (!hasConfig) {
    throw new Error(
      `spiracss.config.js not found: ${absolutePath}\n\n` +
        `Place spiracss.config.js at the project root.\n` +
        `You can get a sample config here:\n` +
        `https://raw.githubusercontent.com/zetsubo-dev/spiracss/master/docs_spira/ja/spiracss.config.example.js\n\n` +
        `See docs_spira/ja/tooling/spiracss-config.md for details.`
    )
  }
}

const finalizeConfig = (
  spiracss: SpiracssConfig | undefined,
  configSource: string
): { spiracss: SpiracssConfig; configSource: string } => {
  if (!spiracss || typeof spiracss !== 'object') {
    throw createConfigLoadError(configSource)
  }
  return { spiracss, configSource }
}

const resolveSpiracssConfig = (
  configPathOrConfig?: string | SpiracssConfig
): { spiracss: SpiracssConfig; configSource: string } => {
  const target = resolveConfigTarget(configPathOrConfig, { requireSync: true })
  if (target.spiracss) return finalizeConfig(target.spiracss, target.configSource)
  const absolutePath = target.absolutePath
  // Defensive guard: resolveConfigTarget sets absolutePath for path-based configs.
  if (!absolutePath) {
    throw new Error('Missing config path for spiracss.config.js.')
  }
  ensureConfigFileExists(absolutePath)
  const spiracss = loadConfigFromPath(absolutePath)
  return finalizeConfig(spiracss, target.configSource)
}

const resolveSpiracssConfigAsync = async (
  configPathOrConfig?: string | SpiracssConfig
): Promise<{ spiracss: SpiracssConfig; configSource: string }> => {
  const target = resolveConfigTarget(configPathOrConfig)
  if (target.spiracss) return finalizeConfig(target.spiracss, target.configSource)
  const absolutePath = target.absolutePath
  // Defensive guard: resolveConfigTarget sets absolutePath for path-based configs.
  if (!absolutePath) {
    throw new Error('Missing config path for spiracss.config.js.')
  }
  ensureConfigFileExists(absolutePath)
  const spiracss = await loadConfigFromPathAsync(absolutePath)
  return finalizeConfig(spiracss, target.configSource)
}

const ensureConfigSections = (spiracss: SpiracssConfig, configSource: string): void => {
  // Validate required sections.
  if (spiracss.stylelint !== undefined && !isPlainObject(spiracss.stylelint)) {
    throw new Error(
      `Invalid stylelint section in spiracss.config.js: ${configSource}\n` +
        `stylelint must be an object when provided.\n` +
        `See docs_spira/ja/tooling/spiracss-config.md for details.`
    )
  }

  if (spiracss.aliasRoots === undefined) {
    throw new Error(
      `Missing aliasRoots section in spiracss.config.js: ${configSource}\n\n` +
        `aliasRoots is required for path resolution in spiracss/rel-comments.\n` +
        `See docs_spira/ja/tooling/spiracss-config.md for details.`
    )
  }

  if (!isAliasRoots(spiracss.aliasRoots)) {
    throw new Error(
      `Invalid aliasRoots section in spiracss.config.js: ${configSource}\n` +
        `aliasRoots must be an object whose values are string arrays.\n` +
        `See docs_spira/ja/tooling/spiracss-config.md for details.`
    )
  }
}

const buildRules = (spiracss: SpiracssConfig): Record<string, unknown> => {
  const stylelint =
    spiracss.stylelint && typeof spiracss.stylelint === 'object'
      ? spiracss.stylelint
      : undefined
  const base =
    stylelint?.base && typeof stylelint.base === 'object' ? stylelint.base : undefined
  const interactionScopeConfig =
    stylelint?.interactionScope && typeof stylelint.interactionScope === 'object'
      ? stylelint.interactionScope
      : undefined
  const interactionPropsConfig =
    stylelint?.interactionProps && typeof stylelint.interactionProps === 'object'
      ? stylelint.interactionProps
      : undefined
  const generator =
    spiracss.generator && typeof spiracss.generator === 'object'
      ? spiracss.generator
      : undefined

  const mergeObjects = <T extends object>(
    baseValue?: Partial<T>,
    override?: Partial<T>
  ): Partial<T> | undefined => {
    if (!baseValue && !override) return undefined
    return { ...(baseValue ?? {}), ...(override ?? {}) }
  }

  const baseComments = base?.comments
  const baseNaming = base?.naming
  const baseExternal = base?.external
  const baseCache = base?.cache
  const basePolicy = base?.selectorPolicy ?? spiracss.selectorPolicy
  const basePaths = base?.paths

  const classConfig = { ...(stylelint?.class ?? {}) }
  classConfig.comments = mergeObjects<CommentConfig>(
    baseComments,
    classConfig.comments
  )
  classConfig.external = mergeObjects<ExternalConfig>(
    baseExternal,
    classConfig.external
  )
  if (classConfig.naming === undefined) {
    classConfig.naming = baseNaming
  }
  const classPolicy = classConfig.selectorPolicy ?? basePolicy
  if (classPolicy !== undefined) {
    classConfig.selectorPolicy = classPolicy
  }
  if (classConfig.cache === undefined) {
    classConfig.cache = baseCache
  }
  if (classConfig.rootCase === undefined && generator?.rootFileCase !== undefined) {
    classConfig.rootCase = generator.rootFileCase
  }
  if (classConfig.childDir === undefined) {
    classConfig.childDir = basePaths?.childDir
  }
  if (classConfig.componentsDirs === undefined) {
    classConfig.componentsDirs = basePaths?.components
  }
  if (classConfig.childDir === undefined && generator?.childScssDir) {
    classConfig.childDir = generator.childScssDir
  }

  const sharedNaming = baseNaming ?? classConfig.naming
  const sharedExternal = mergeObjects<ExternalConfig>(
    baseExternal,
    classConfig.external
  )

  const placementConfig = { ...(stylelint?.placement ?? {}) }
  placementConfig.comments = mergeObjects<CommentConfig>(
    baseComments,
    placementConfig.comments
  )
  placementConfig.external = mergeObjects<ExternalConfig>(
    sharedExternal,
    placementConfig.external
  )
  if (placementConfig.naming === undefined) {
    placementConfig.naming = sharedNaming
  }
  const placementPolicy = placementConfig.selectorPolicy ?? basePolicy
  if (placementPolicy !== undefined) {
    placementConfig.selectorPolicy = placementPolicy
  }
  if (placementConfig.cache === undefined) {
    placementConfig.cache = baseCache
  }
  if (placementConfig.elementDepth === undefined && classConfig.elementDepth !== undefined) {
    placementConfig.elementDepth = classConfig.elementDepth
  }

  const interactionScope = { ...(interactionScopeConfig ?? {}) }
  interactionScope.comments = mergeObjects<CommentConfig>(
    baseComments,
    interactionScope.comments
  )
  const interactionPolicy = interactionScope.selectorPolicy ?? basePolicy
  if (interactionPolicy !== undefined) {
    interactionScope.selectorPolicy = interactionPolicy
  }
  if (interactionScope.cache === undefined) {
    interactionScope.cache = baseCache
  }

  const interactionProps = { ...(interactionPropsConfig ?? {}) }
  interactionProps.comments = mergeObjects<CommentConfig>(
    baseComments,
    interactionProps.comments
  )
  interactionProps.external = mergeObjects<ExternalConfig>(
    sharedExternal,
    interactionProps.external
  )
  if (interactionProps.naming === undefined) {
    interactionProps.naming = sharedNaming
  }
  if (interactionProps.cache === undefined) {
    interactionProps.cache = baseCache
  }

  const keyframesConfig = { ...(stylelint?.keyframes ?? {}) }
  const keyframesEnabled = keyframesConfig.enabled !== false
  delete keyframesConfig.enabled
  keyframesConfig.external = mergeObjects<ExternalConfig>(
    sharedExternal,
    keyframesConfig.external
  )
  if (keyframesConfig.naming === undefined) {
    keyframesConfig.naming = sharedNaming
  }
  if (keyframesConfig.cache === undefined) {
    keyframesConfig.cache = baseCache
  }

  const pseudoConfig = { ...(stylelint?.pseudo ?? {}) }
  if (pseudoConfig.cache === undefined) {
    pseudoConfig.cache = baseCache
  }

  const relConfig = { ...(stylelint?.rel ?? {}) }
  relConfig.comments = mergeObjects<CommentConfig>(baseComments, relConfig.comments)
  relConfig.external = mergeObjects<ExternalConfig>(sharedExternal, relConfig.external)
  if (relConfig.naming === undefined) {
    relConfig.naming = sharedNaming
  }
  if (relConfig.cache === undefined) {
    relConfig.cache = baseCache
  }
  if (relConfig.childDir === undefined) {
    relConfig.childDir = basePaths?.childDir
  }
  if (!relConfig.childDir && generator?.childScssDir) {
    relConfig.childDir = generator.childScssDir
  }
  if (relConfig.aliasRoots === undefined) {
    relConfig.aliasRoots = spiracss.aliasRoots
  }

  return {
    'spiracss/class-structure': [true, classConfig],
    'spiracss/property-placement': [true, placementConfig],
    'spiracss/interaction-scope': [true, interactionScope],
    'spiracss/interaction-properties': [true, interactionProps],
    'spiracss/keyframes-naming': keyframesEnabled ? [true, keyframesConfig] : false,
    'spiracss/pseudo-nesting': [true, pseudoConfig],
    'spiracss/rel-comments': [true, relConfig]
  }
}

/**
 * Builds SpiraCSS rules from spiracss.config.js.
 * @param configPathOrConfig - Path to spiracss.config.js (defaults to ./spiracss.config.js) or a config object.
 * @returns SpiraCSS rules object.
 */
export function createRules(configPathOrConfig?: string | SpiracssConfig): Record<string, unknown> {
  const { spiracss, configSource } = resolveSpiracssConfig(configPathOrConfig)
  ensureConfigSections(spiracss, configSource)
  return buildRules(spiracss)
}

export async function createRulesAsync(
  configPathOrConfig?: string | SpiracssConfig
): Promise<Record<string, unknown>> {
  const { spiracss, configSource } = await resolveSpiracssConfigAsync(configPathOrConfig)
  ensureConfigSections(spiracss, configSource)
  return buildRules(spiracss)
}
