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
import type { CacheSizes, FileNameCase, NamingOptions } from './types'
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
  childFileCase?: ClassStructureOptions['paths']['childFileCase']
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
  fileCase?: RelCommentsOptions['fileCase']
  childFileCase?: RelCommentsOptions['childFileCase']
  comments?: CommentConfig
  naming?: NamingOptions
  external?: ExternalConfig
  cache?: CacheSizes
}

type PageLayerConfig = {
  enabled?: boolean
  pageEntryAlias?: string
  pageEntrySubdir?: string
  componentsDirs?: string[]
  aliasRoots?: Record<string, string[]>
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
  marginSideTags?: boolean
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

type FileCaseConfig = {
  root?: FileNameCase
  child?: FileNameCase
}

type PseudoNestingConfig = {
  enabled?: boolean
  cache?: CacheSizes
}

type SpiracssConfig = {
  aliasRoots?: Record<string, string[]>
  selectorPolicy?: ClassStructureSelectorPolicy
  fileCase?: FileNameCase | FileCaseConfig
  generator?: {
    rootFileCase?: ClassStructureOptions['root']['case']
    childFileCase?: FileNameCase
    childScssDir?: string
    pageEntryAlias?: string
    pageEntrySubdir?: string
  }
  stylelint?: {
    base?: BaseConfig
    class?: ClassStructureConfig
    pageLayer?: PageLayerConfig
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

const isFileNameCase = (value: unknown): value is FileNameCase =>
  value === 'preserve' ||
  value === 'kebab' ||
  value === 'snake' ||
  value === 'camel' ||
  value === 'pascal'

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

const createConfigRequiredError = (): Error =>
  new Error(
    `createRules() requires a config object.\n` +
      `Import spiracss.config.js and pass the config object, or use createRulesAsync(path) for path-based loading.\n` +
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

const loadConfigFromPathAsync = async (absolutePath: string): Promise<SpiracssConfig> => {
  const moduleUrl = pathToFileURL(absolutePath).href
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

type ConfigTarget = {
  configSource: string
  absolutePath?: string
  spiracss?: SpiracssConfig
}

const resolveConfigTarget = (
  configPathOrConfig?: string | SpiracssConfig
): ConfigTarget => {
  if (!configPathOrConfig || typeof configPathOrConfig === 'string') {
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
        `https://spiracss.jp/downloads/spiracss.config.example.js\n\n` +
        `See https://spiracss.jp/configuration/ for details.`
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
  config: SpiracssConfig
): { spiracss: SpiracssConfig; configSource: string } => {
  if (!config || typeof config === 'string') {
    throw createConfigRequiredError()
  }
  return finalizeConfig(config, 'spiracss.config.js (object)')
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
        `See https://spiracss.jp/configuration/ for details.`
    )
  }

  if (spiracss.aliasRoots === undefined) {
    throw new Error(
      `Missing aliasRoots section in spiracss.config.js: ${configSource}\n\n` +
        `aliasRoots is required for path resolution in spiracss/rel-comments.\n` +
        `See https://spiracss.jp/configuration/ for details.`
    )
  }

  if (!isAliasRoots(spiracss.aliasRoots)) {
    throw new Error(
      `Invalid aliasRoots section in spiracss.config.js: ${configSource}\n` +
        `aliasRoots must be an object whose values are string arrays.\n` +
        `See https://spiracss.jp/configuration/ for details.`
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
  const fileCaseConfig = resolveFileCaseConfig(spiracss.fileCase)

  const mergeObjects = <T extends object>(
    baseValue?: Partial<T>,
    override?: Partial<T>
  ): Partial<T> | undefined => {
    if (!baseValue && !override) return undefined
    return { ...(baseValue ?? {}), ...(override ?? {}) }
  }

  const assignIfDefined = <T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined
  ): void => {
    if (value !== undefined) {
      target[key] = value
    }
  }

  const baseComments = base?.comments
  const baseNaming = base?.naming
  const baseExternal = base?.external
  const baseCache = base?.cache
  const basePolicy = base?.selectorPolicy ?? spiracss.selectorPolicy
  const basePaths = base?.paths
  const baseComponentsDirs = basePaths?.components
  const aliasComponentsDirs = spiracss.aliasRoots?.components
  const componentsDirsFallback =
    Array.isArray(baseComponentsDirs) && baseComponentsDirs.length > 0
      ? baseComponentsDirs
      : Array.isArray(aliasComponentsDirs) && aliasComponentsDirs.length > 0
        ? aliasComponentsDirs
        : undefined

  const classConfig = { ...(stylelint?.class ?? {}) }
  assignIfDefined(
    classConfig,
    'comments',
    mergeObjects<CommentConfig>(baseComments, classConfig.comments)
  )
  assignIfDefined(
    classConfig,
    'external',
    mergeObjects<ExternalConfig>(baseExternal, classConfig.external)
  )
  if (classConfig.naming === undefined) {
    assignIfDefined(classConfig, 'naming', baseNaming)
  }
  const classPolicy = classConfig.selectorPolicy ?? basePolicy
  if (classPolicy !== undefined) {
    classConfig.selectorPolicy = classPolicy
  }
  if (classConfig.cache === undefined) {
    assignIfDefined(classConfig, 'cache', baseCache)
  }
  if (classConfig.rootCase === undefined) {
    if (generator?.rootFileCase !== undefined) {
      classConfig.rootCase = generator.rootFileCase
    } else if (fileCaseConfig.root !== undefined) {
      classConfig.rootCase = fileCaseConfig.root
    }
  }
  if (classConfig.childFileCase === undefined) {
    if (generator?.childFileCase !== undefined) {
      classConfig.childFileCase = generator.childFileCase
    } else if (fileCaseConfig.child !== undefined) {
      classConfig.childFileCase = fileCaseConfig.child
    }
  }
  if (classConfig.childDir === undefined) {
    assignIfDefined(classConfig, 'childDir', basePaths?.childDir)
  }
  if (classConfig.componentsDirs === undefined) {
    assignIfDefined(classConfig, 'componentsDirs', componentsDirsFallback)
  }
  if (classConfig.childDir === undefined && generator?.childScssDir) {
    classConfig.childDir = generator.childScssDir
  }

  const sharedNaming = baseNaming ?? classConfig.naming
  const sharedExternal = mergeObjects<ExternalConfig>(
    baseExternal,
    classConfig.external
  )

  const pageLayerConfig = { ...(stylelint?.pageLayer ?? {}) }
  const pageLayerEnabled = pageLayerConfig.enabled !== false
  delete pageLayerConfig.enabled
  assignIfDefined(
    pageLayerConfig,
    'external',
    mergeObjects<ExternalConfig>(sharedExternal, pageLayerConfig.external)
  )
  if (pageLayerConfig.naming === undefined) {
    assignIfDefined(pageLayerConfig, 'naming', sharedNaming)
  }
  if (pageLayerConfig.cache === undefined) {
    assignIfDefined(pageLayerConfig, 'cache', baseCache)
  }
  if (pageLayerConfig.componentsDirs === undefined) {
    assignIfDefined(pageLayerConfig, 'componentsDirs', componentsDirsFallback)
  }
  if (pageLayerConfig.pageEntryAlias === undefined && generator?.pageEntryAlias) {
    pageLayerConfig.pageEntryAlias = generator.pageEntryAlias
  }
  if (pageLayerConfig.pageEntrySubdir === undefined && generator?.pageEntrySubdir !== undefined) {
    pageLayerConfig.pageEntrySubdir = generator.pageEntrySubdir
  }
  if (pageLayerConfig.aliasRoots === undefined) {
    pageLayerConfig.aliasRoots = spiracss.aliasRoots
  }

  const placementConfig = { ...(stylelint?.placement ?? {}) }
  assignIfDefined(
    placementConfig,
    'comments',
    mergeObjects<CommentConfig>(baseComments, placementConfig.comments)
  )
  assignIfDefined(
    placementConfig,
    'external',
    mergeObjects<ExternalConfig>(sharedExternal, placementConfig.external)
  )
  if (placementConfig.naming === undefined) {
    assignIfDefined(placementConfig, 'naming', sharedNaming)
  }
  const placementPolicy = placementConfig.selectorPolicy ?? basePolicy
  if (placementPolicy !== undefined) {
    placementConfig.selectorPolicy = placementPolicy
  }
  if (placementConfig.cache === undefined) {
    assignIfDefined(placementConfig, 'cache', baseCache)
  }
  if (placementConfig.elementDepth === undefined && classConfig.elementDepth !== undefined) {
    placementConfig.elementDepth = classConfig.elementDepth
  }

  const interactionScope = { ...(interactionScopeConfig ?? {}) }
  assignIfDefined(
    interactionScope,
    'comments',
    mergeObjects<CommentConfig>(baseComments, interactionScope.comments)
  )
  const interactionPolicy = interactionScope.selectorPolicy ?? basePolicy
  if (interactionPolicy !== undefined) {
    interactionScope.selectorPolicy = interactionPolicy
  }
  if (interactionScope.cache === undefined) {
    assignIfDefined(interactionScope, 'cache', baseCache)
  }

  const interactionProps = { ...(interactionPropsConfig ?? {}) }
  assignIfDefined(
    interactionProps,
    'comments',
    mergeObjects<CommentConfig>(baseComments, interactionProps.comments)
  )
  assignIfDefined(
    interactionProps,
    'external',
    mergeObjects<ExternalConfig>(sharedExternal, interactionProps.external)
  )
  if (interactionProps.naming === undefined) {
    assignIfDefined(interactionProps, 'naming', sharedNaming)
  }
  if (interactionProps.cache === undefined) {
    assignIfDefined(interactionProps, 'cache', baseCache)
  }

  const keyframesConfig = { ...(stylelint?.keyframes ?? {}) }
  const keyframesEnabled = keyframesConfig.enabled !== false
  delete keyframesConfig.enabled
  assignIfDefined(
    keyframesConfig,
    'external',
    mergeObjects<ExternalConfig>(sharedExternal, keyframesConfig.external)
  )
  if (keyframesConfig.naming === undefined) {
    assignIfDefined(keyframesConfig, 'naming', sharedNaming)
  }
  if (keyframesConfig.cache === undefined) {
    assignIfDefined(keyframesConfig, 'cache', baseCache)
  }

  const pseudoConfig = { ...(stylelint?.pseudo ?? {}) }
  const pseudoEnabled = pseudoConfig.enabled !== false
  delete pseudoConfig.enabled
  if (pseudoConfig.cache === undefined) {
    assignIfDefined(pseudoConfig, 'cache', baseCache)
  }

  const relConfig = { ...(stylelint?.rel ?? {}) }
  assignIfDefined(
    relConfig,
    'comments',
    mergeObjects<CommentConfig>(baseComments, relConfig.comments)
  )
  assignIfDefined(
    relConfig,
    'external',
    mergeObjects<ExternalConfig>(sharedExternal, relConfig.external)
  )
  if (relConfig.naming === undefined) {
    assignIfDefined(relConfig, 'naming', sharedNaming)
  }
  if (relConfig.cache === undefined) {
    assignIfDefined(relConfig, 'cache', baseCache)
  }
  if (relConfig.childDir === undefined) {
    assignIfDefined(relConfig, 'childDir', basePaths?.childDir)
  }
  if (!relConfig.childDir && generator?.childScssDir) {
    relConfig.childDir = generator.childScssDir
  }
  if (relConfig.fileCase === undefined) {
    if (generator?.rootFileCase !== undefined) {
      relConfig.fileCase = generator.rootFileCase
    } else if (fileCaseConfig.root !== undefined) {
      relConfig.fileCase = fileCaseConfig.root
    }
  }
  if (relConfig.childFileCase === undefined) {
    if (generator?.childFileCase !== undefined) {
      relConfig.childFileCase = generator.childFileCase
    } else if (fileCaseConfig.child !== undefined) {
      relConfig.childFileCase = fileCaseConfig.child
    }
  }
  if (relConfig.aliasRoots === undefined) {
    relConfig.aliasRoots = spiracss.aliasRoots
  }

  return {
    'spiracss/class-structure': [true, classConfig],
    'spiracss/page-layer': pageLayerEnabled ? [true, pageLayerConfig] : false,
    'spiracss/property-placement': [true, placementConfig],
    'spiracss/interaction-scope': [true, interactionScope],
    'spiracss/interaction-properties': [true, interactionProps],
    'spiracss/keyframes-naming': keyframesEnabled ? [true, keyframesConfig] : false,
    'spiracss/pseudo-nesting': pseudoEnabled ? [true, pseudoConfig] : false,
    'spiracss/rel-comments': [true, relConfig]
  }
}

/**
 * Builds SpiraCSS rules from a spiracss config object.
 * For path-based loading, use {@link createRulesAsync} instead.
 * @param config - A spiracss config object (imported from spiracss.config.js).
 * @returns SpiraCSS rules object.
 */
export function createRules(config: SpiracssConfig): Record<string, unknown> {
  const { spiracss, configSource } = resolveSpiracssConfig(config)
  ensureConfigSections(spiracss, configSource)
  return buildRules(spiracss)
}

/**
 * Builds SpiraCSS rules from a spiracss config object or file path.
 * Supports both config object (sync resolution) and path string (async import).
 * @param configPathOrConfig - Path to spiracss.config.js or a config object.
 * @returns SpiraCSS rules object.
 */
export async function createRulesAsync(
  configPathOrConfig?: string | SpiracssConfig
): Promise<Record<string, unknown>> {
  const { spiracss, configSource } = await resolveSpiracssConfigAsync(configPathOrConfig)
  ensureConfigSections(spiracss, configSource)
  return buildRules(spiracss)
}
