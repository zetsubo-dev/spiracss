import type { CacheSizes, NormalizedCacheSizes } from '../types'
import type { InvalidOptionReporter } from './normalize'

export type LruCache<K, V> = {
  get: (key: K) => V | undefined
  set: (key: K, value: V) => void
  has: (key: K) => boolean
}

export const DEFAULT_CACHE_SIZE = 1000
export const DEFAULT_CACHE_SIZES: NormalizedCacheSizes = {
  selector: DEFAULT_CACHE_SIZE,
  patterns: DEFAULT_CACHE_SIZE,
  naming: DEFAULT_CACHE_SIZE,
  path: DEFAULT_CACHE_SIZE
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const normalizeCacheSize = (
  value: unknown,
  fallback: number,
  label: string,
  reportInvalid?: InvalidOptionReporter
): number => {
  if (value === undefined) return fallback
  if (isPositiveInteger(value)) return value
  reportInvalid?.(label, value, 'Expected a positive integer.')
  return fallback
}

export const normalizeCacheSizes = (
  value: unknown,
  reportInvalid?: InvalidOptionReporter
): NormalizedCacheSizes => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CACHE_SIZES }
  const raw = value as CacheSizes
  return {
    selector: normalizeCacheSize(
      raw.selector,
      DEFAULT_CACHE_SIZES.selector,
      'cacheSizes.selector',
      reportInvalid
    ),
    patterns: normalizeCacheSize(
      raw.patterns,
      DEFAULT_CACHE_SIZES.patterns,
      'cacheSizes.patterns',
      reportInvalid
    ),
    naming: normalizeCacheSize(
      raw.naming,
      DEFAULT_CACHE_SIZES.naming,
      'cacheSizes.naming',
      reportInvalid
    ),
    path: normalizeCacheSize(
      raw.path,
      DEFAULT_CACHE_SIZES.path,
      'cacheSizes.path',
      reportInvalid
    )
  }
}

/**
 * Creates a minimal LRU cache with a fixed max size.
 */
export const createLruCache = <K, V>(maxSize: number): LruCache<K, V> => {
  const cache = new Map<K, V>()

  /**
   * Updates LRU ordering by re-inserting the key as most recently used.
   */
  const touch = (key: K, value: V): void => {
    cache.delete(key)
    cache.set(key, value)
  }

  const get = (key: K): V | undefined => {
    if (!cache.has(key)) return undefined
    const value = cache.get(key) as V
    touch(key, value)
    return value
  }

  const set = (key: K, value: V): void => {
    if (cache.has(key)) {
      touch(key, value)
      return
    }
    cache.set(key, value)
    if (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value
      if (oldestKey !== undefined) cache.delete(oldestKey)
    }
  }

  return {
    get,
    set,
    has: (key: K) => cache.has(key)
  }
}
