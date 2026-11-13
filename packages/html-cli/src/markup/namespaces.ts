import type { MarkupElement } from './types'

const HTML = 'http://www.w3.org/1999/xhtml'
const SVG = 'http://www.w3.org/2000/svg'
const MATH = 'http://www.w3.org/1998/Math/MathML'
// Child context of a MathML text integration point: HTML, except mglyph and malignmark.
const MATH_TEXT = 'mathml-text-integration-point'

export const markupNamespace = (tag: string, inherited = HTML): string => {
  const name = tag.toLowerCase()
  if (name === 'svg') return SVG
  if (name === 'math') return MATH
  if (inherited !== MATH_TEXT) return inherited
  return name === 'mglyph' || name === 'malignmark' ? MATH : HTML
}

export function markupChildNamespace(namespace: string, tag: string, attributes: MarkupElement['attributes']): string {
  const name = tag.toLowerCase()
  if (namespace === MATH && ['mi', 'mo', 'mn', 'ms', 'mtext'].includes(name)) return MATH_TEXT
  const encoding = attributes.find((attribute) => attribute.name === 'encoding')?.value.toLowerCase()
  return (namespace === SVG && ['foreignobject', 'desc', 'title'].includes(name)) ||
    (namespace === MATH && name === 'annotation-xml' && ['text/html', 'application/xhtml+xml'].includes(encoding ?? ''))
    ? HTML
    : namespace
}

/** Propagate source namespaces, including the HTML integration points. */
export function applyMarkupNamespaces(elements: MarkupElement[], inherited = HTML): void {
  for (const element of elements) {
    const tag = element.tag.toLowerCase()
    const namespace = element.namespace ?? markupNamespace(tag, inherited)
    element.namespace = namespace
    applyMarkupNamespaces(element.children, markupChildNamespace(namespace, tag, element.attributes))
  }
}
