// Development stylelint config (ESM)
// - Loads the locally built dist to verify rule behavior.
// - Auto-generates settings from ./spiracss.config.js.

import spiracss, { createRulesAsync } from './dist/esm/index.js'
import config from './spiracss.config.js'

const rules = await createRulesAsync(config)

export default {
  plugins: spiracss,
  customSyntax: 'postcss-scss',
  rules
}
