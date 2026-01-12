export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean' || value instanceof Boolean

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' || value instanceof Number

export const isRegExp = (value: unknown): value is RegExp => value instanceof RegExp

export const isString = (value: unknown): value is string =>
  typeof value === 'string' || value instanceof String

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item) => {
    if (!isString(item)) return false
    const text = typeof item === 'string' ? item : String(item)
    return text.trim().length > 0
  })

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export const isEmptyObject = (value: unknown): value is Record<string, never> =>
  isPlainObject(value) && Object.keys(value).length === 0

export const isAliasRoots = (value: unknown): value is Record<string, string[]> => {
  if (!isPlainObject(value)) return false
  return Object.values(value).every((entry) => isStringArray(entry))
}
