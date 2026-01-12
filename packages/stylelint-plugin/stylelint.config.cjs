// Development stylelint config (CommonJS)
// - Loads the locally built dist to verify rule behavior.
// - Auto-generates settings from ./spiracss.config.cjs.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const spiracss = require('./dist/cjs')

const plugin = spiracss.default ?? spiracss
const { createRules } = spiracss

module.exports = {
  plugins: [plugin],
  customSyntax: 'postcss-scss',
  rules: createRules('./spiracss.config.cjs')
}
