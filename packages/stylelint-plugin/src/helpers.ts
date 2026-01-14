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
import type { CacheSizes } from './types'
import { isAliasRoots, isPlainObject } from './utils/validate'

type ClassStructureConfig = Partial<
  Omit<
    ClassStructureOptions,
    'selectorPolicy' | 'sharedCommentPattern' | 'interactionCommentPattern' | 'cacheSizes'
  >
> & {
  selectorPolicy?: ClassStructureSelectorPolicy
  sharedCommentPattern?: RegExp | string
  interactionCommentPattern?: RegExp | string
  cacheSizes?: CacheSizes
}

type InteractionScopeConfig = Partial<
  Omit<InteractionScopeOptions, 'selectorPolicy' | 'interactionCommentPattern' | 'cacheSizes'>
> & {
  selectorPolicy?: InteractionScopeSelectorPolicy
  interactionCommentPattern?: RegExp | string
  cacheSizes?: CacheSizes
}

type RelCommentsConfig = Partial<
  Omit<RelCommentsOptions, 'sharedCommentPattern' | 'interactionCommentPattern' | 'cacheSizes'>
> & {
  sharedCommentPattern?: RegExp | string
  interactionCommentPattern?: RegExp | string
  cacheSizes?: CacheSizes
}

type InteractionPropertiesConfig = Partial<
  Omit<
    InteractionPropertiesOptions,
    'sharedCommentPattern' | 'interactionCommentPattern' | 'cacheSizes'
  >
> & {
  sharedCommentPattern?: RegExp | string
  interactionCommentPattern?: RegExp | string
  cacheSizes?: CacheSizes
}

type PropertyPlacementConfig = Partial<
  Omit<
    PropertyPlacementOptions,
    'selectorPolicy' | 'sharedCommentPattern' | 'interactionCommentPattern' | 'cacheSizes'
  >
> & {
  selectorPolicy?: ClassStructureSelectorPolicy
  sharedCommentPattern?: RegExp | string
  interactionCommentPattern?: RegExp | string
  cacheSizes?: CacheSizes
}

type KeyframesNamingConfig = Partial<
  Omit<KeyframesNamingOptions, 'sharedFiles' | 'ignoreFiles' | 'ignorePatterns' | 'cacheSizes'>
> & {
  sharedFiles?: Array<string | RegExp>
  ignoreFiles?: Array<string | RegExp>
  ignorePatterns?: Array<string | RegExp>
  cacheSizes?: CacheSizes
  enabled?: boolean
}

type PseudoNestingConfig = Partial<Omit<PseudoNestingOptions, 'cacheSizes'>> & {
  cacheSizes?: CacheSizes
}

type SpiracssConfig = {
  aliasRoots?: Record<string, string[]>
  selectorPolicy?: ClassStructureSelectorPolicy
  generator?: {
    rootFileCase?: ClassStructureOptions['rootFileCase']
    childScssDir?: string
  }
  stylelint?: {
    cacheSizes?: CacheSizes
    classStructure?: ClassStructureConfig
    interactionScope?: InteractionScopeConfig
    interactionProperties?: InteractionPropertiesConfig
    propertyPlacement?: PropertyPlacementConfig
    keyframesNaming?: KeyframesNamingConfig
    pseudoNesting?: PseudoNestingConfig
    relComments?: RelCommentsConfig
    sectionCommentPatterns?: {
      shared?: RegExp | string
      interaction?: RegExp | string
    }
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

const canRequire = typeof require === 'function'
// Keep dynamic import in CJS output (avoid TS transforming it to require()).
let dynamicImport: ((specifier: string) => Promise<unknown>) | null = null

const loadConfigFromPath = (absolutePath: string): SpiracssConfig => {
  if (!canRequire) {
    throw new Error(
      `In ESM environments, createRules() cannot accept a file path.\n` +
        `Use createRulesAsync(path) or import spiracss.config.js and pass the config object to createRules(config).\n` +
        `Example: import config from './spiracss.config.js'`
    )
  }
  try {
    const loaded = resolveConfigModule(require(absolutePath))
    if (!loaded) {
      throw new Error(
        `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
          `Ensure the config file format is valid.`
      )
    }
    return loaded
  } catch (error) {
    if (isRequireEsmError(error)) {
      throw new Error(
        `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
          `In ESM projects ("type": "module"), require() is unavailable.\n` +
          `Use createRulesAsync(path) or import the config and pass it to createRules(config).`
      )
    }
    throw error
  }
}

const loadConfigFromPathAsync = async (absolutePath: string): Promise<SpiracssConfig> => {
  if (canRequire) {
    try {
      const loaded = resolveConfigModule(require(absolutePath))
      if (!loaded) {
        throw new Error(
          `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
            `Ensure the config file format is valid.`
        )
      }
      return loaded
    } catch (error) {
      if (!isRequireEsmError(error)) {
        throw error
      }
    }
  }

  const moduleUrl = pathToFileURL(absolutePath).href
  if (!canRequire) {
    const loaded = resolveConfigModule(await import(moduleUrl))
    if (!loaded) {
      throw new Error(
        `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
          `Ensure the config file format is valid.`
      )
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
          `Use createRules(config) instead of createRulesAsync(path).`
      )
    }
  }

  const loaded = resolveConfigModule(await dynamicImport(moduleUrl))
  if (!loaded) {
    throw new Error(
      `Failed to load spiracss.config.js: ${absolutePath}\n\n` +
        `Ensure the config file format is valid.`
    )
  }
  return loaded
}

const resolveSpiracssConfig = (
  configPathOrConfig?: string | SpiracssConfig
): { spiracss: SpiracssConfig; configSource: string } => {
  let spiracss: SpiracssConfig | undefined
  let configSource = 'spiracss.config.js'

  if (!configPathOrConfig || typeof configPathOrConfig === 'string') {
    if (!canRequire) {
      throw new Error(
        `In ESM environments, createRules() cannot accept a file path.\n` +
          `Use createRulesAsync(path) or import spiracss.config.js and pass the config object to createRules(config).\n` +
          `Example: import config from './spiracss.config.js'`
      )
    }
    // Default to ./spiracss.config.js in the caller's working directory.
    const resolvedPath = configPathOrConfig || './spiracss.config.js'
    const absolutePath = path.resolve(resolvedPath)
    configSource = absolutePath

    // Check file existence.
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

    spiracss = loadConfigFromPath(absolutePath)
  } else {
    spiracss = configPathOrConfig
    configSource = 'spiracss.config.js (object)'
  }

  if (!spiracss || typeof spiracss !== 'object') {
    throw new Error(
      `Failed to load spiracss.config.js: ${configSource}\n\n` +
        `Ensure the config file format is valid.`
    )
  }

  return { spiracss, configSource }
}

const resolveSpiracssConfigAsync = async (
  configPathOrConfig?: string | SpiracssConfig
): Promise<{ spiracss: SpiracssConfig; configSource: string }> => {
  let spiracss: SpiracssConfig | undefined
  let configSource = 'spiracss.config.js'

  if (!configPathOrConfig || typeof configPathOrConfig === 'string') {
    // Default to ./spiracss.config.js in the caller's working directory.
    const resolvedPath = configPathOrConfig || './spiracss.config.js'
    const absolutePath = path.resolve(resolvedPath)
    configSource = absolutePath

    // Check file existence.
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

    spiracss = await loadConfigFromPathAsync(absolutePath)
  } else {
    spiracss = configPathOrConfig
    configSource = 'spiracss.config.js (object)'
  }

  if (!spiracss || typeof spiracss !== 'object') {
    throw new Error(
      `Failed to load spiracss.config.js: ${configSource}\n\n` +
        `Ensure the config file format is valid.`
    )
  }

  return { spiracss, configSource }
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
  const sectionCommentPatterns =
    spiracss.stylelint?.sectionCommentPatterns &&
    typeof spiracss.stylelint.sectionCommentPatterns === 'object'
      ? spiracss.stylelint.sectionCommentPatterns
      : undefined
  const cacheSizes = spiracss.stylelint?.cacheSizes
  const sharedCommentPattern = sectionCommentPatterns?.shared
  const interactionCommentPattern = sectionCommentPatterns?.interaction
  const generator = spiracss.generator && typeof spiracss.generator === 'object'
    ? spiracss.generator
    : undefined

  const withFallback = <T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined
  ): void => {
    if (value === undefined) return
    if (target[key] !== undefined) return
    target[key] = value
  }

  const classStructure = { ...spiracss.stylelint?.classStructure }
  if (spiracss.selectorPolicy) {
    classStructure.selectorPolicy = spiracss.selectorPolicy
  }
  withFallback(classStructure, 'sharedCommentPattern', sharedCommentPattern)
  withFallback(classStructure, 'interactionCommentPattern', interactionCommentPattern)
  withFallback(classStructure, 'rootFileCase', generator?.rootFileCase)
  withFallback(classStructure, 'childScssDir', generator?.childScssDir)
  withFallback(classStructure, 'cacheSizes', cacheSizes)

  const interactionScope = { ...spiracss.stylelint?.interactionScope }
  if (spiracss.selectorPolicy && interactionScope.selectorPolicy === undefined) {
    interactionScope.selectorPolicy = spiracss.selectorPolicy
  }
  withFallback(interactionScope, 'interactionCommentPattern', interactionCommentPattern)
  withFallback(interactionScope, 'cacheSizes', cacheSizes)

  const interactionProperties = { ...spiracss.stylelint?.interactionProperties }
  withFallback(interactionProperties, 'sharedCommentPattern', sharedCommentPattern)
  withFallback(interactionProperties, 'interactionCommentPattern', interactionCommentPattern)
  withFallback(interactionProperties, 'naming', classStructure.naming)
  withFallback(interactionProperties, 'allowExternalClasses', classStructure.allowExternalClasses)
  withFallback(interactionProperties, 'allowExternalPrefixes', classStructure.allowExternalPrefixes)
  withFallback(interactionProperties, 'cacheSizes', cacheSizes)

  const propertyPlacement = { ...spiracss.stylelint?.propertyPlacement }
  if (spiracss.selectorPolicy && propertyPlacement.selectorPolicy === undefined) {
    propertyPlacement.selectorPolicy = spiracss.selectorPolicy
  }
  withFallback(propertyPlacement, 'sharedCommentPattern', sharedCommentPattern)
  withFallback(propertyPlacement, 'interactionCommentPattern', interactionCommentPattern)
  withFallback(propertyPlacement, 'naming', classStructure.naming)
  withFallback(propertyPlacement, 'allowExternalClasses', classStructure.allowExternalClasses)
  withFallback(propertyPlacement, 'allowExternalPrefixes', classStructure.allowExternalPrefixes)
  withFallback(
    propertyPlacement,
    'allowElementChainDepth',
    classStructure.allowElementChainDepth
  )
  withFallback(propertyPlacement, 'cacheSizes', cacheSizes)

  const keyframesNaming = { ...spiracss.stylelint?.keyframesNaming }
  const keyframesNamingEnabled = keyframesNaming.enabled !== false
  delete keyframesNaming.enabled
  withFallback(keyframesNaming, 'naming', classStructure.naming)
  withFallback(keyframesNaming, 'allowExternalClasses', classStructure.allowExternalClasses)
  withFallback(keyframesNaming, 'allowExternalPrefixes', classStructure.allowExternalPrefixes)
  withFallback(keyframesNaming, 'cacheSizes', cacheSizes)

  const pseudoNesting = { ...spiracss.stylelint?.pseudoNesting }
  withFallback(pseudoNesting, 'cacheSizes', cacheSizes)

  const relComments = { ...spiracss.stylelint?.relComments }
  withFallback(relComments, 'sharedCommentPattern', sharedCommentPattern)
  withFallback(relComments, 'interactionCommentPattern', interactionCommentPattern)
  withFallback(relComments, 'childScssDir', generator?.childScssDir)
  withFallback(relComments, 'naming', classStructure.naming)
  withFallback(relComments, 'allowExternalClasses', classStructure.allowExternalClasses)
  withFallback(relComments, 'allowExternalPrefixes', classStructure.allowExternalPrefixes)
  withFallback(relComments, 'cacheSizes', cacheSizes)

  return {
    'spiracss/class-structure': [true, classStructure],
    'spiracss/property-placement': [true, propertyPlacement],
    'spiracss/interaction-scope': [true, interactionScope],
    'spiracss/interaction-properties': [true, interactionProperties],
    'spiracss/keyframes-naming': keyframesNamingEnabled ? [true, keyframesNaming] : false,
    'spiracss/pseudo-nesting': [true, pseudoNesting],
    'spiracss/rel-comments': [
      true,
      {
        ...relComments,
        aliasRoots: spiracss.aliasRoots
      }
    ]
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
