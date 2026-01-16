import type { NormalizedSelectorPolicyBase } from '../types'

export type SelectorPolicySetsBase = {
  dataStateEnabled: boolean
  dataVariantEnabled: boolean
  stateKey: string
  ariaKeys: Set<string>
  variantKeys: Set<string>
}

const normalizePolicyKey = (value: string): string => value.toLowerCase()
const policySetsCache = new WeakMap<NormalizedSelectorPolicyBase, SelectorPolicySetsBase>()

export const buildSelectorPolicySetsBase = (
  policy: NormalizedSelectorPolicyBase,
  normalizeKey: (value: string) => string = normalizePolicyKey
): SelectorPolicySetsBase => {
  if (normalizeKey === normalizePolicyKey) {
    const cached = policySetsCache.get(policy)
    if (cached) return cached
  }
  const built = {
    dataStateEnabled: policy.state.mode === 'data',
    dataVariantEnabled: policy.variant.mode === 'data',
    stateKey: normalizeKey(policy.state.dataKey),
    ariaKeys: new Set(policy.state.ariaKeys.map(normalizeKey)),
    variantKeys: new Set(policy.variant.dataKeys.map(normalizeKey))
  }
  if (normalizeKey === normalizePolicyKey) {
    policySetsCache.set(policy, built)
  }
  return built
}

export const DEFAULT_SELECTOR_POLICY_BASE: NormalizedSelectorPolicyBase = {
  variant: {
    mode: 'data',
    dataKeys: ['data-variant']
  },
  state: {
    mode: 'data',
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
  }
}

export const createDefaultSelectorPolicyBase = (): NormalizedSelectorPolicyBase => ({
  variant: {
    mode: DEFAULT_SELECTOR_POLICY_BASE.variant.mode,
    dataKeys: [...DEFAULT_SELECTOR_POLICY_BASE.variant.dataKeys]
  },
  state: {
    mode: DEFAULT_SELECTOR_POLICY_BASE.state.mode,
    dataKey: DEFAULT_SELECTOR_POLICY_BASE.state.dataKey,
    ariaKeys: [...DEFAULT_SELECTOR_POLICY_BASE.state.ariaKeys]
  }
})
