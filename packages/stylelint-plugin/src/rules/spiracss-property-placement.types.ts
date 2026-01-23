import type {
  NamingOptions,
  NormalizedCacheSizes,
  NormalizedSelectorPolicyBase
} from '../types'

export type Options = {
  element: {
    depth: number
  }
  external: {
    classes: string[]
    prefixes: string[]
  }
  margin: {
    side: 'top' | 'bottom'
  }
  position: boolean
  size: {
    internal: boolean
  }
  responsive: {
    mixins: string[]
  }
  naming?: NamingOptions
  selectorPolicy: NormalizedSelectorPolicyBase
  comments: {
    shared: RegExp
    interaction: RegExp
  }
  cache: NormalizedCacheSizes
}
