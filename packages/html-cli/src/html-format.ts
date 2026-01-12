/* =========================================================
 *  spiracss-html-format: add placeholder classes to HTML
 * ========================================================= */

import type { Cheerio, CheerioAPI } from 'cheerio'
import { load } from 'cheerio'
import type { Element } from 'domhandler'
import { existsSync, promises as fsp } from 'fs'
import * as path from 'path'

import { classifyBaseClass, type NamingOptions } from './generator-core'
import { loadSpiracssConfig } from './config-loader'
import { warnInvalidCustomPatterns } from './config-warnings'

/**
 * Detect whether template syntax (EJS, Nunjucks, JSX, etc.) is present.
 * If present, applying sanitizeHtml would break templates.
 */
function containsTemplateSyntax(html: string): boolean {
  // EJS: <% ... %>
  if (/<%[\s\S]*?%>/.test(html)) return true
  // Nunjucks: {{ ... }}, {% ... %}, {# ... #}
  if (/\{\{[\s\S]*?\}\}/.test(html)) return true
  if (/\{%[\s\S]*?%\}/.test(html)) return true
  if (/\{#[\s\S]*?#\}/.test(html)) return true
  // Astro frontmatter: --- ... --- (allow BOM/leading whitespace, file-start only)
  if (/^\s*---[\s\S]*?---/.test(html)) return true
  // JSX/React: only allow className/class bindings that are string or template literals
  const hasInvalidBinding = (attrName: 'class' | 'className'): boolean => {
    // Match template literals (backticks) first
    const templateRe = new RegExp(`${attrName}\\s*=\\s*\\{\\s*\`[^\`]*\`\\s*\\}`, 'g')
    // Match strings (double/single quotes)
    const stringDqRe = new RegExp(`${attrName}\\s*=\\s*\\{\\s*"[^"]*"\\s*\\}`, 'g')
    const stringSqRe = new RegExp(`${attrName}\\s*=\\s*\\{\\s*'[^']*'\\s*\\}`, 'g')
    // Any other { ... } binding is invalid
    const braceRe = new RegExp(`${attrName}\\s*=\\s*\\{`, 'g')

    // Invalid if "{" remains after removing all valid literals
    let cleaned = html
    cleaned = cleaned.replace(templateRe, '')
    cleaned = cleaned.replace(stringDqRe, '')
    cleaned = cleaned.replace(stringSqRe, '')
    return braceRe.test(cleaned)
  }
  if (hasInvalidBinding('className') || hasInvalidBinding('class')) return true
  return false
}

const RX = {
  CLASSNAME_TEMPLATE: /className\s*=\s*\{\s*`([^`]*)`\s*\}/g,
  CLASSNAME_BRACE_DQ: /className\s*=\s*\{\s*"([^"]*)"\s*\}/g,
  CLASSNAME_BRACE_SQ: /className\s*=\s*\{\s*'([^']*)'\s*\}/g,
  CLASSNAME_DQ: /className\s*=\s*"([^"]*)"/g,
  CLASSNAME_SQ: /className\s*=\s*'([^']*)'/g,
  CLASS_TEMPLATE: /class\s*=\s*\{\s*`([^`]*)`\s*\}/g,
  CLASS_BRACE_DQ: /class\s*=\s*\{\s*"([^"]*)"\s*\}/g,
  CLASS_BRACE_SQ: /class\s*=\s*\{\s*'([^']*)'\s*\}/g,
  CLASS_DQ: /class\s*=\s*"([^"]*)"/g,
  CLASS_SQ: /class\s*=\s*'([^']*)'/g,
  PLACEHOLDER: /\$\{[\s\S]*?\}/g
} as const

export type ClassAttribute = 'class' | 'className'

type NormalizedHtml = {
  html: string
  attributeChanged: boolean
}

function normalizeClassAttributes(html: string, classAttribute: ClassAttribute): NormalizedHtml {
  const classAttrName = classAttribute === 'className' ? 'data-spiracss-classname' : 'class'
  const shouldChangeClassName = classAttribute === 'class'
  const shouldChangeClass = classAttribute === 'className'
  const dropPlaceholders = (value: string): string =>
    value.replace(RX.PLACEHOLDER, '').replace(/\s{2,}/g, ' ').trim()

  let attributeChanged = false
  let out = html
  out = out.replace(RX.CLASSNAME_TEMPLATE, (_m, inner) => {
    if (shouldChangeClassName) attributeChanged = true
    return `data-spiracss-classname="${dropPlaceholders(inner)}"`
  })
  out = out.replace(RX.CLASSNAME_BRACE_DQ, (_m, inner) => {
    if (shouldChangeClassName) attributeChanged = true
    return `data-spiracss-classname="${inner}"`
  })
  out = out.replace(RX.CLASSNAME_BRACE_SQ, (_m, inner) => {
    if (shouldChangeClassName) attributeChanged = true
    return `data-spiracss-classname="${inner}"`
  })
  out = out.replace(RX.CLASSNAME_DQ, (_m, inner) => {
    if (shouldChangeClassName) attributeChanged = true
    return `data-spiracss-classname="${inner}"`
  })
  out = out.replace(RX.CLASSNAME_SQ, (_m, inner) => {
    if (shouldChangeClassName) attributeChanged = true
    return `data-spiracss-classname="${inner}"`
  })
  out = out.replace(RX.CLASS_TEMPLATE, (_m, inner) => {
    if (shouldChangeClass) attributeChanged = true
    return `${classAttrName}="${dropPlaceholders(inner)}"`
  })
  out = out.replace(RX.CLASS_BRACE_DQ, (_m, inner) => {
    if (shouldChangeClass) attributeChanged = true
    return `${classAttrName}="${inner}"`
  })
  out = out.replace(RX.CLASS_BRACE_SQ, (_m, inner) => {
    if (shouldChangeClass) attributeChanged = true
    return `${classAttrName}="${inner}"`
  })
  out = out.replace(RX.CLASS_DQ, (_m, inner) => {
    if (shouldChangeClass) attributeChanged = true
    return `${classAttrName}="${inner}"`
  })
  out = out.replace(RX.CLASS_SQ, (_m, inner) => {
    if (shouldChangeClass) attributeChanged = true
    return `${classAttrName}="${inner}"`
  })

  return { html: out, attributeChanged }
}

/* ---------- config loading ---------- */

type HtmlFormatOptions = {
  naming: NamingOptions
  classAttribute: ClassAttribute
}

function resolveClassAttribute(value: unknown): ClassAttribute {
  return value === 'className' || value === 'class' ? value : 'class'
}

async function loadHtmlFormatOptionsFromConfig(baseDir: string): Promise<HtmlFormatOptions> {
  const configPath = path.join(baseDir, 'spiracss.config.js')
  const config = await loadSpiracssConfig(configPath)
  const naming: NamingOptions = {}
  let classAttribute: ClassAttribute = 'class'
  if (config && typeof config === 'object') {
    const stylelintCfg = (config as Record<string, unknown>).stylelint as
      | Record<string, unknown>
      | undefined
    const classStructure = stylelintCfg?.classStructure as Record<string, unknown> | undefined
    const namingValue = classStructure?.naming
    if (namingValue && typeof namingValue === 'object') {
      Object.assign(naming, namingValue)
    }

    const htmlFormat = (config as Record<string, unknown>).htmlFormat as
      | Record<string, unknown>
      | undefined
    if (htmlFormat && typeof htmlFormat === 'object') {
      classAttribute = resolveClassAttribute(htmlFormat.classAttribute)
    }
  }
  return { naming, classAttribute }
}

/* ---------- placeholder insertion ---------- */
const MAX_DEPTH = 256

/**
 * Check whether an element has child tag elements.
 */
function hasChildElements($: CheerioAPI, $el: Cheerio<Element>): boolean {
  return $el.children().toArray().some((ch) => ch.type === 'tag')
}

type ClassAttr = {
  name: 'class' | 'data-spiracss-classname'
  value: string
}

function getClassAttr($el: Cheerio<Element>, classAttribute: ClassAttribute): ClassAttr {
  const classNameValue = $el.attr('data-spiracss-classname')
  if (classNameValue !== undefined) {
    return { name: 'data-spiracss-classname', value: classNameValue }
  }
  const classValue = $el.attr('class')
  if (classValue !== undefined) {
    return { name: 'class', value: classValue }
  }
  if (classAttribute === 'className') {
    return { name: 'data-spiracss-classname', value: '' }
  }
  return { name: 'class', value: '' }
}

/**
 * Return the default Block placeholder name based on blockCase.
 * - kebab: block-box
 * - snake: block_box
 * - camel: blockBox
 * - pascal: BlockBox
 */
function getDefaultBlockPlaceholder(naming: NamingOptions): string {
  const blockCase = naming.blockCase || 'kebab'
  switch (blockCase) {
    case 'snake':
      return 'block_box'
    case 'camel':
      return 'blockBox'
    case 'pascal':
      return 'BlockBox'
    case 'kebab':
    default:
      return 'block-box'
  }
}

/**
 * Return the default Element placeholder name based on elementCase.
 * - kebab/snake/camel: element
 * - pascal: Element
 */
function getDefaultElementPlaceholder(naming: NamingOptions): string {
  const elementCase = naming.elementCase || 'kebab'
  switch (elementCase) {
    case 'pascal':
      return 'Element'
    case 'kebab':
    case 'snake':
    case 'camel':
    default:
      return 'element'
  }
}

/**
 * Convert an Element name to a Block name.
 * Append "box" in the format dictated by blockCase.
 * Regardless of the elementCase/blockCase combination, normalize to a valid
 * Block name for isBlockClass().
 *
 * Example (elementCase: pascal, blockCase: camel):
 * - Content -> contentBox (normalize to lower camel)
 *
 * Example (elementCase: pascal, blockCase: kebab):
 * - Content -> content-box (normalize to lowercase)
 */
function elementToBlock(elementName: string, naming: NamingOptions): string {
  const blockCase = naming.blockCase || 'kebab'

  switch (blockCase) {
    case 'snake':
      // snake_case Block must start with lowercase
      return `${elementName.toLowerCase()}_box`
    case 'camel':
      // camelCase Block must start with lowercase
      return `${elementName.charAt(0).toLowerCase()}${elementName.slice(1)}Box`
    case 'pascal':
      // PascalCase Block must start with uppercase
      return `${elementName.charAt(0).toUpperCase()}${elementName.slice(1)}Box`
    case 'kebab':
    default:
      // kebab-case Block must be lowercase
      return `${elementName.toLowerCase()}-box`
  }
}

/**
 * Type holding a change counter.
 */
type ChangeTracker = { count: number }

/**
 * Move the placeholder class to the front.
 * If it exists but is not first, move it to the front and return true.
 * If it doesn't exist, unshift and return true.
 * If it is already first, return false.
 */
function ensurePlaceholderFirst(classes: string[], placeholder: string): boolean {
  const idx = classes.indexOf(placeholder)
  if (idx === 0) {
    // Already at the front
    return false
  } else if (idx > 0) {
    // Exists but not first -> move to front
    classes.splice(idx, 1)
    classes.unshift(placeholder)
    return true
  } else {
    // Not present -> add to front
    classes.unshift(placeholder)
    return true
  }
}

/**
 * Recursively walk descendants and normalize to Block > Element structure.
 * - Elements with children are treated as Block (xxx-box)
 * - Elements without children (leaf nodes) are treated as Element (element)
 * - Increment tracker.count when changes occur
 */
function processDescendants(
  $: CheerioAPI,
  $parent: Cheerio<Element>,
  naming: NamingOptions,
  classAttribute: ClassAttribute,
  depth: number,
  tracker: ChangeTracker
): void {
  if (depth > MAX_DEPTH) return

  $parent.children().each((_, childEl) => {
    if (childEl.type !== 'tag') return
    const $child = $(childEl)
    const { name: childClassAttrName, value: childClassAttr } = getClassAttr($child, classAttribute)
    const childClasses = childClassAttr.split(/\s+/).filter(Boolean)
    const childBase = childClasses[0] ?? ''
    const childKind = childBase ? classifyBaseClass(childBase, naming) : 'invalid'
    const hasChildren = hasChildElements($, $child)

    if (childKind === 'block') {
      // Already a Block; recurse into its children
      processDescendants($, $child, naming, classAttribute, depth + 1, tracker)
    } else if (childKind === 'element') {
      if (hasChildren) {
        // Element with children should become a Block
        // Convert to xxx-box using the existing Element name (blockCase-dependent)
        const blockName = elementToBlock(childBase, naming)
        childClasses[0] = blockName
        $child.attr(childClassAttrName, childClasses.join(' '))
        tracker.count++
        processDescendants($, $child, naming, classAttribute, depth + 1, tracker)
      }
      // If no children, keep as Element (leaf node)
    } else {
      // Neither Block nor Element
      const blockPlaceholder = getDefaultBlockPlaceholder(naming)
      const elementPlaceholder = getDefaultElementPlaceholder(naming)
      if (hasChildren) {
        // With children, ensure Block placeholder at the front
        if (ensurePlaceholderFirst(childClasses, blockPlaceholder)) {
          $child.attr(childClassAttrName, childClasses.join(' '))
          tracker.count++
        }
        processDescendants($, $child, naming, classAttribute, depth + 1, tracker)
      } else {
        // Without children, ensure Element placeholder at the front
        if (ensurePlaceholderFirst(childClasses, elementPlaceholder)) {
          $child.attr(childClassAttrName, childClasses.join(' '))
          tracker.count++
        }
      }
    }
  })
}

export type InsertPlaceholdersResult = {
  html: string
  hasTemplateSyntax: boolean
  changeCount: number
}

export function insertPlaceholders(
  html: string,
  naming: NamingOptions,
  classAttribute: ClassAttribute = 'class'
): string {
  return insertPlaceholdersWithInfo(html, naming, classAttribute).html
}

/**
 * Insert placeholders and return details.
 * If template syntax is detected, skip processing and return original HTML.
 */
export function insertPlaceholdersWithInfo(
  html: string,
  naming: NamingOptions,
  classAttribute: ClassAttribute = 'class'
): InsertPlaceholdersResult {
  // Skip processing when template syntax is present (avoid destructive changes)
  if (containsTemplateSyntax(html)) {
    return { html, hasTemplateSyntax: true, changeCount: 0 }
  }

  const normalized = normalizeClassAttributes(html, classAttribute)

  // Use a unique wrapper tag name to avoid collisions
  const WRAPPER_TAG = 'spiracss-internal-wrapper'
  const raw = `<${WRAPPER_TAG}>${normalized.html}</${WRAPPER_TAG}>`
  const $ = load(raw)

  const roots = $(WRAPPER_TAG)
    .children()
    .filter((_, el) => el.type === 'tag')

  if (roots.length === 0) return { html, hasTemplateSyntax: false, changeCount: 0 }

  // Track whether changes occurred
  const tracker: ChangeTracker = { count: 0 }

  roots.each((_, rootEl) => {
    const $root = $(rootEl)
    const { name: rootClassAttrName, value: classAttr } = getClassAttr($root, classAttribute)
    const classes = classAttr.split(/\s+/).filter(Boolean)
    const base = classes[0] ?? ''
    const baseKind = base ? classifyBaseClass(base, naming) : 'invalid'

    // If the root is not a Block, ensure a placeholder at the front
    if (baseKind !== 'block') {
      const blockPlaceholder = getDefaultBlockPlaceholder(naming)
      if (ensurePlaceholderFirst(classes, blockPlaceholder)) {
        $root.attr(rootClassAttrName, classes.join(' '))
        tracker.count++
      }
    }

    // Recursively process descendants
    processDescendants($, $root, naming, classAttribute, 1, tracker)
  })

  // If no changes, return original HTML (avoid cheerio serialization diffs)
  if (tracker.count === 0 && !normalized.attributeChanged) {
    return { html, hasTemplateSyntax: false, changeCount: 0 }
  }

  let updated = $(WRAPPER_TAG).html()
  if (updated) {
    const outputAttr = classAttribute === 'className' ? 'className' : 'class'
    updated = updated.replace(/data-spiracss-classname/g, outputAttr)
  }
  const changeCount = tracker.count + (normalized.attributeChanged ? 1 : 0)
  return { html: updated ?? html, hasTemplateSyntax: false, changeCount }
}

/* ---------- CLI main ---------- */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  let file = ''
  let useStdin = false
  let outputPath = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stdin') {
      useStdin = true
    } else if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i] ?? ''
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: spiracss-html-format [options] <file>

Adds placeholder classes to HTML and formats it into a SpiraCSS structure.

Placeholder names change based on blockCase / elementCase in spiracss.config.js (independent settings):

  Block placeholder (depends on blockCase):
    kebab -> block-box  |  camel -> blockBox  |  pascal -> BlockBox  |  snake -> block_box

  Element placeholder (depends on elementCase):
    kebab/snake/camel -> element  |  pascal -> Element

Output attribute follows htmlFormat.classAttribute in spiracss.config.js (class | className).

Options:
  --stdin           Read HTML from stdin
  -o, --output PATH Output file path (stdout if omitted)
  -h, --help        Show this help

Examples:
  # Read from file, write to stdout
  npx spiracss-html-format path/to/file.html

  # Read from stdin, write to file
  cat path/to/file.html | npx spiracss-html-format --stdin -o path/to/formatted.html

  # Read from file and overwrite
  npx spiracss-html-format path/to/file.html -o path/to/file.html
`)
      process.exit(0)
    } else if (!file) {
      file = args[i]
    }
  }

  let html = ''
  // Like other CLIs, always resolve config from cwd
  const rootDir = process.cwd()

  if (useStdin) {
    // Read from stdin
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
      chunks.push(chunk)
    }
    html = Buffer.concat(chunks).toString('utf8')
  } else if (file) {
    // Read from file
    if (!existsSync(file)) {
      console.error(`Error: File not found: ${file}`)
      process.exit(1)
    }
    html = await fsp.readFile(file, 'utf8')
  } else {
    console.error('Error: No input specified. Use --help for usage.')
    process.exit(1)
  }

  const { naming, classAttribute } = await loadHtmlFormatOptionsFromConfig(rootDir)
  warnInvalidCustomPatterns(naming, (message) => {
    console.error(message)
  })
  const result = insertPlaceholdersWithInfo(html, naming, classAttribute)

  // If template syntax is detected, warn and skip writing files
  if (result.hasTemplateSyntax) {
    console.error(
      'Warning: Template syntax (EJS, Nunjucks, JSX, etc.) was detected, so processing was skipped.\n' +
      'Use this only with static HTML fragments.'
    )
    // Only output original HTML for stdout (to keep pipelines working)
    // For file output, do not write to avoid updating mtime
    if (!outputPath) {
      process.stdout.write(html)
    }
    return
  }

  if (outputPath) {
    // Skip writing if output already matches to avoid updating mtime
    if (existsSync(outputPath)) {
      const current = await fsp.readFile(outputPath, 'utf8')
      if (current === result.html) {
        console.error('No changes needed.')
        return
      }
    }
    // Write to file
    await fsp.writeFile(outputPath, result.html, 'utf8')
    console.error(`Formatted HTML written to: ${outputPath}`)
  } else {
    // Stdout
    process.stdout.write(result.html)
  }
}

// Only run main() when executed as the CLI
if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
}
