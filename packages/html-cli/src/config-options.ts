import * as path from 'path'

import { loadSpiracssConfig, type SpiracssConfig } from './config-loader'
import {
  type ExternalOptions,
  type FileNameCase,
  type GeneratorOptions,
  type HtmlLintOptions,
  type JsxClassBindingsConfig,
  type NamingOptions,
  type SelectorPolicy,
  type WordCase
} from './generator-core'

export type ConfigStatus = 'missing' | 'loaded' | 'error'

export type ResolvedHtmlFormatOptions = {
  classAttribute: 'class' | 'className'
}

export type ResolvedProjectOptions = GeneratorOptions & {
  namingSource: string
  htmlFormat: ResolvedHtmlFormatOptions
}

export type LoadedProjectOptions = ResolvedProjectOptions & {
  configStatus: ConfigStatus
  configPath: string
  configError?: string
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const WORD_CASES = new Set<WordCase>(['kebab', 'snake', 'camel', 'pascal'])
const FILE_NAME_CASES = new Set<FileNameCase>(['preserve', 'kebab', 'snake', 'camel', 'pascal'])

const assertRecord = (value: unknown, fieldName: string): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${fieldName} must be an object.`)
  return value
}

const assertKnownKeys = (
  value: Record<string, unknown> | undefined,
  allowedKeys: readonly string[],
  fieldName: string
): void => {
  if (!value) return
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key))
  if (unknownKeys.length > 0) {
    throw new Error(`${fieldName} contains unknown option(s): ${unknownKeys.join(', ')}.`)
  }
}

const assertString = (value: unknown, fieldName: string, allowEmpty = false): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new Error(`${fieldName} must be a${allowEmpty ? ' string' : ' non-empty string'}.`)
  }
  return value.trim()
}

const assertStringList = (value: unknown, fieldName: string): string[] | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${fieldName} must be an array of non-empty strings.`)
  }
  return value.map((item) => (item as string).trim())
}

const assertSafeRelativeDirectory = (value: unknown, fieldName: string): string | undefined => {
  const directory = assertString(value, fieldName)
  if (directory === undefined) return undefined
  if (
    directory.includes('\0') ||
    /^[A-Za-z]:/.test(directory) ||
    path.isAbsolute(directory) ||
    path.posix.isAbsolute(directory) ||
    path.win32.isAbsolute(directory) ||
    directory.split(/[\\/]+/).some((segment) => segment === '..')
  ) {
    throw new Error(`${fieldName} must be a safe relative directory inside the document directory.`)
  }
  return directory
}

const assertCase = (value: unknown, fieldName: string): void => {
  if (value === undefined) return
  if (typeof value !== 'string' || !WORD_CASES.has(value as WordCase)) {
    throw new Error(`${fieldName} must be "kebab" | "snake" | "camel" | "pascal".`)
  }
}

const assertFileCase = (value: unknown, fieldName: string): void => {
  if (value === undefined) return
  if (typeof value !== 'string' || !FILE_NAME_CASES.has(value as FileNameCase)) {
    throw new Error(`${fieldName} must be "preserve" | "kebab" | "snake" | "camel" | "pascal".`)
  }
}

const assertNaming = (value: unknown, fieldName: string): NamingOptions | undefined => {
  const naming = assertRecord(value, fieldName)
  if (!naming) return undefined
  assertKnownKeys(
    naming,
    ['blockCase', 'elementCase', 'modifierCase', 'blockMaxWords', 'modifierPrefix', 'customPatterns'],
    fieldName
  )
  assertCase(naming.blockCase, `${fieldName}.blockCase`)
  assertCase(naming.elementCase, `${fieldName}.elementCase`)
  assertCase(naming.modifierCase, `${fieldName}.modifierCase`)
  if (naming.blockMaxWords !== undefined) {
    if (
      typeof naming.blockMaxWords !== 'number' ||
      !Number.isInteger(naming.blockMaxWords) ||
      naming.blockMaxWords < 2
    ) {
      throw new Error(`${fieldName}.blockMaxWords must be an integer greater than or equal to 2.`)
    }
  }
  if (naming.modifierPrefix !== undefined) {
    assertString(naming.modifierPrefix, `${fieldName}.modifierPrefix`)
  }
  if (naming.customPatterns !== undefined) {
    const patterns = assertRecord(naming.customPatterns, `${fieldName}.customPatterns`)
    assertKnownKeys(patterns, ['block', 'element', 'modifier'], `${fieldName}.customPatterns`)
    for (const key of ['block', 'element', 'modifier']) {
      const pattern = patterns?.[key]
      if (pattern !== undefined && !(pattern instanceof RegExp)) {
        throw new Error(`${fieldName}.customPatterns.${key} must be a RegExp.`)
      }
      if (pattern instanceof RegExp && (pattern.flags.includes('g') || pattern.flags.includes('y'))) {
        throw new Error(`${fieldName}.customPatterns.${key} must not include "g" or "y" flags.`)
      }
    }
  }
  return naming as NamingOptions
}

const assertExternal = (value: unknown, fieldName: string): ExternalOptions | undefined => {
  const external = assertRecord(value, fieldName)
  if (!external) return undefined
  assertKnownKeys(external, ['classes', 'prefixes'], fieldName)
  return {
    classes: assertStringList(external.classes, `${fieldName}.classes`),
    prefixes: assertStringList(external.prefixes, `${fieldName}.prefixes`)
  }
}

const assertValueNaming = (value: unknown, fieldName: string): void => {
  const naming = assertRecord(value, fieldName)
  if (!naming) return
  assertKnownKeys(naming, ['case', 'maxWords'], fieldName)
  assertCase(naming.case, `${fieldName}.case`)
  if (naming.maxWords !== undefined) {
    if (typeof naming.maxWords !== 'number' || !Number.isInteger(naming.maxWords) || naming.maxWords < 1) {
      throw new Error(`${fieldName}.maxWords must be a positive integer.`)
    }
  }
}

const assertSelectorPolicy = (value: unknown, fieldName: string): SelectorPolicy | undefined => {
  const policy = assertRecord(value, fieldName)
  if (!policy) return undefined
  assertKnownKeys(policy, ['variant', 'state', 'valueNaming'], fieldName)
  const variant = assertRecord(policy.variant, `${fieldName}.variant`)
  const state = assertRecord(policy.state, `${fieldName}.state`)
  assertKnownKeys(variant, ['mode', 'dataKeys', 'valueNaming'], `${fieldName}.variant`)
  assertKnownKeys(state, ['mode', 'ariaKeys', 'dataKey', 'valueNaming'], `${fieldName}.state`)
  if (variant?.mode !== undefined && variant.mode !== 'data' && variant.mode !== 'class') {
    throw new Error(`${fieldName}.variant.mode must be "data" or "class".`)
  }
  if (state?.mode !== undefined && state.mode !== 'data' && state.mode !== 'class') {
    throw new Error(`${fieldName}.state.mode must be "data" or "class".`)
  }
  assertStringList(variant?.dataKeys, `${fieldName}.variant.dataKeys`)
  assertStringList(state?.ariaKeys, `${fieldName}.state.ariaKeys`)
  assertString(state?.dataKey, `${fieldName}.state.dataKey`)
  assertValueNaming(policy.valueNaming, `${fieldName}.valueNaming`)
  assertValueNaming(variant?.valueNaming, `${fieldName}.variant.valueNaming`)
  assertValueNaming(state?.valueNaming, `${fieldName}.state.valueNaming`)
  return policy as SelectorPolicy
}

const assertHtmlLint = (value: unknown): HtmlLintOptions | undefined => {
  const htmlLint = assertRecord(value, 'htmlLint')
  if (!htmlLint) return undefined
  assertKnownKeys(htmlLint, ['classlessTagCheck', 'classlessTagAllowlist'], 'htmlLint')
  if (htmlLint.classlessTagCheck !== undefined && typeof htmlLint.classlessTagCheck !== 'boolean') {
    throw new Error('htmlLint.classlessTagCheck must be a boolean.')
  }
  return {
    classlessTagCheck: htmlLint.classlessTagCheck as boolean | undefined,
    classlessTagAllowlist: assertStringList(htmlLint.classlessTagAllowlist, 'htmlLint.classlessTagAllowlist')
  }
}

const assertJsxClassBindings = (value: unknown): JsxClassBindingsConfig | undefined => {
  const bindings = assertRecord(value, 'jsxClassBindings')
  if (!bindings) return undefined
  assertKnownKeys(bindings, ['memberAccessAllowlist'], 'jsxClassBindings')
  return {
    memberAccessAllowlist: assertStringList(bindings.memberAccessAllowlist, 'jsxClassBindings.memberAccessAllowlist')
  }
}

const assertHtmlFormat = (value: unknown): ResolvedHtmlFormatOptions | undefined => {
  const htmlFormat = assertRecord(value, 'htmlFormat')
  if (!htmlFormat) return undefined
  assertKnownKeys(htmlFormat, ['classAttribute'], 'htmlFormat')
  if (
    htmlFormat.classAttribute !== undefined &&
    htmlFormat.classAttribute !== 'class' &&
    htmlFormat.classAttribute !== 'className'
  ) {
    throw new Error('htmlFormat.classAttribute must be "class" or "className".')
  }
  return {
    classAttribute: (htmlFormat.classAttribute as 'class' | 'className' | undefined) ?? 'class'
  }
}

const validateConsumedConfig = (config: SpiracssConfig): void => {
  if (!isRecord(config)) throw new Error('spiracss.config.js must export an object.')
  const generator = assertRecord(config.generator, 'generator')
  assertKnownKeys(
    generator,
    [
      'globalScssModule',
      'pageEntryAlias',
      'pageEntrySubdir',
      'childScssDir',
      'layoutMixins',
      'rootFileCase',
      'childFileCase'
    ],
    'generator'
  )
  assertString(generator?.globalScssModule, 'generator.globalScssModule')
  assertString(generator?.pageEntryAlias, 'generator.pageEntryAlias')
  assertString(generator?.pageEntrySubdir, 'generator.pageEntrySubdir', true)
  assertSafeRelativeDirectory(generator?.childScssDir, 'generator.childScssDir')
  assertStringList(generator?.layoutMixins, 'generator.layoutMixins')
  assertFileCase(generator?.rootFileCase, 'generator.rootFileCase')
  assertFileCase(generator?.childFileCase, 'generator.childFileCase')

  const fileCase = config.fileCase
  if (typeof fileCase === 'string') {
    assertFileCase(fileCase, 'fileCase')
  } else if (fileCase !== undefined) {
    const fileCaseObject = assertRecord(fileCase, 'fileCase')
    assertKnownKeys(fileCaseObject, ['root', 'child'], 'fileCase')
    assertFileCase(fileCaseObject?.root, 'fileCase.root')
    assertFileCase(fileCaseObject?.child, 'fileCase.child')
  }

  const stylelint = assertRecord(config.stylelint, 'stylelint')
  const base = assertRecord(stylelint?.base, 'stylelint.base')
  const classConfig = assertRecord(stylelint?.class, 'stylelint.class')
  assertNaming(base?.naming, 'stylelint.base.naming')
  assertNaming(classConfig?.naming, 'stylelint.class.naming')
  assertExternal(base?.external, 'stylelint.base.external')
  assertExternal(classConfig?.external, 'stylelint.class.external')

  assertSelectorPolicy(config.selectorPolicy, 'selectorPolicy')
  assertHtmlLint(config.htmlLint)
  assertJsxClassBindings(config.jsxClassBindings)
  assertHtmlFormat(config.htmlFormat)
}

const resolveFileCase = (value: unknown): { root?: FileNameCase; child?: FileNameCase } => {
  if (typeof value === 'string' && FILE_NAME_CASES.has(value as FileNameCase)) {
    return { root: value as FileNameCase, child: value as FileNameCase }
  }
  if (!isRecord(value)) return {}
  return {
    root: FILE_NAME_CASES.has(value.root as FileNameCase) ? (value.root as FileNameCase) : undefined,
    child: FILE_NAME_CASES.has(value.child as FileNameCase) ? (value.child as FileNameCase) : undefined
  }
}

export function resolveProjectOptions(config?: SpiracssConfig): ResolvedProjectOptions {
  if (config) validateConsumedConfig(config)

  const stylelint = config ? (config.stylelint as Record<string, unknown> | undefined) : undefined
  const base = isRecord(stylelint?.base) ? stylelint.base : undefined
  const classConfig = isRecord(stylelint?.class) ? stylelint.class : undefined
  const generator = config && isRecord(config.generator) ? config.generator : undefined
  const fileCase = resolveFileCase(config?.fileCase)

  const baseNaming = assertNaming(base?.naming, 'stylelint.base.naming')
  const classNaming = assertNaming(classConfig?.naming, 'stylelint.class.naming')
  const naming = baseNaming ?? classNaming ?? {}
  const namingSource = baseNaming
    ? 'stylelint.base.naming.customPatterns'
    : classNaming
      ? 'stylelint.class.naming.customPatterns'
      : 'stylelint.base.naming.customPatterns'

  const baseExternal = assertExternal(base?.external, 'stylelint.base.external')
  const classExternal = assertExternal(classConfig?.external, 'stylelint.class.external')
  const external: ExternalOptions = {
    classes: [...(baseExternal?.classes ?? []), ...(classExternal?.classes ?? [])],
    prefixes: [...(baseExternal?.prefixes ?? []), ...(classExternal?.prefixes ?? [])]
  }

  const globalScssModule = typeof generator?.globalScssModule === 'string' ? generator.globalScssModule : undefined
  const pageEntryAlias = typeof generator?.pageEntryAlias === 'string' ? generator.pageEntryAlias : undefined
  const pageEntrySubdir = typeof generator?.pageEntrySubdir === 'string' ? generator.pageEntrySubdir : undefined
  const childScssDir = typeof generator?.childScssDir === 'string' ? generator.childScssDir.trim() : undefined
  const layoutMixins = Array.isArray(generator?.layoutMixins) ? (generator.layoutMixins as string[]) : []
  const selectorPolicy = config?.selectorPolicy as SelectorPolicy | undefined
  const htmlLint = config ? assertHtmlLint(config.htmlLint) : undefined
  const jsxClassBindings = config ? assertJsxClassBindings(config.jsxClassBindings) : undefined
  const htmlFormat = config ? assertHtmlFormat(config.htmlFormat) : undefined

  const rootFileCase =
    (typeof generator?.rootFileCase === 'string' ? (generator.rootFileCase as FileNameCase) : undefined) ??
    fileCase.root ??
    'preserve'
  const childFileCase =
    (typeof generator?.childFileCase === 'string' ? (generator.childFileCase as FileNameCase) : undefined) ??
    fileCase.child ??
    'preserve'

  return {
    globalScssModule: globalScssModule ?? '@styles/partials/global',
    pageEntryPrefix:
      typeof pageEntrySubdir === 'string' && pageEntrySubdir.trim() !== ''
        ? `@${pageEntryAlias ?? 'assets'}/${pageEntrySubdir}`
        : `@${pageEntryAlias ?? 'assets'}`,
    childScssDir: childScssDir ?? 'scss',
    layoutMixins: Array.isArray(layoutMixins) ? ([...layoutMixins] as string[]) : [],
    naming,
    rootFileCase,
    childFileCase,
    selectorPolicy,
    external,
    jsxClassBindings,
    htmlLint,
    namingSource,
    htmlFormat: htmlFormat ?? { classAttribute: 'class' }
  }
}

export async function loadProjectOptions(rootDir: string): Promise<LoadedProjectOptions> {
  const configPath = path.join(rootDir, 'spiracss.config.js')
  try {
    const config = await loadSpiracssConfig(configPath)
    if (!config) {
      return {
        ...resolveProjectOptions(),
        configStatus: 'missing',
        configPath
      }
    }
    try {
      return {
        ...resolveProjectOptions(config),
        configStatus: 'loaded',
        configPath
      }
    } catch (error) {
      return {
        ...resolveProjectOptions(),
        configStatus: 'error',
        configPath,
        configError: error instanceof Error ? error.message : String(error)
      }
    }
  } catch (error) {
    return {
      ...resolveProjectOptions(),
      configStatus: 'error',
      configPath,
      configError: error instanceof Error ? error.message : String(error)
    }
  }
}
