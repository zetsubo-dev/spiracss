import type { FileNameCase, WordCase } from '../types'

const splitWords = (input: string): string[] => {
  if (!input.trim()) return []
  const normalized = input
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return normalized.trim().split(/\s+/).filter(Boolean)
}

/**
 * Formats a word or phrase into the configured case.
 */
export const formatWordCase = (input: string, caseName: WordCase): string => {
  if (!input) return input
  const words = splitWords(input)
  if (words.length === 0) return input

  const lower = words.map((word) => word.toLowerCase())
  const capitalize = (word: string): string =>
    word ? word[0].toUpperCase() + word.slice(1) : ''

  switch (caseName) {
    case 'kebab':
      return lower.join('-')
    case 'snake':
      return lower.join('_')
    case 'camel': {
      const [head, ...rest] = lower
      return head + rest.map(capitalize).join('')
    }
    case 'pascal':
      return lower.map(capitalize).join('')
    default:
      return input
  }
}

/**
 * Formats a file base name into the configured case.
 */
export const formatFileBase = (input: string, fileCase: FileNameCase): string => {
  if (!input) return input
  if (fileCase === 'preserve') return input
  return formatWordCase(input, fileCase)
}
