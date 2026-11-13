import * as path from 'path'
import type { MarkupFormat } from './types'

const FORMATS = new Set<MarkupFormat>(['html', 'webc', 'jsx', 'tsx', 'astro', 'vue'])
const LEGACY = new Set(['.ejs', '.njk', '.nunjucks', '.svelte'])

export function sourceFormat(file?: string, explicit?: string): MarkupFormat | 'legacy' | undefined {
  if (explicit !== undefined) return FORMATS.has(explicit as MarkupFormat) ? (explicit as MarkupFormat) : undefined
  if (!file) return 'html'
  const extension = path.extname(file).toLowerCase()
  if (extension === '.htm' || extension === '.html') return 'html'
  if (LEGACY.has(extension)) return 'legacy'
  const format = extension.slice(1) as MarkupFormat
  return FORMATS.has(format) ? format : undefined
}
