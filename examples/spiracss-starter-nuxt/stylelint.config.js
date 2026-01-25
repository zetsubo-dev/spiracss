// Stylelint Configuration for Nuxt Simple Example
/** @type {import('stylelint').Config} */
import spiracssPlugin, { createRules } from '@spiracss/stylelint-plugin'
import spiracssConfig from './spiracss.config.js'

export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-recess-order'],
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  ignoreFiles: [
    'src/**/*.vue',
    'node_modules/**/*',
    '.nuxt/**/*',
    '.output/**/*',
    'dist/**/*',
    'src/styles/partials/**/*.scss',
    '!src/styles/partials/keyframes.scss'
  ],
  rules: {
    ...createRules(spiracssConfig),
    'at-rule-no-unknown': null,
    'function-no-unknown': null,
    'length-zero-no-unit': true,
    'no-descending-specificity': null,
    'no-invalid-position-at-import-rule': null,
    'rule-empty-line-before': [
      'always-multi-line',
      {
        ignore: ['after-comment', 'first-nested']
      }
    ],
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global', 'local']
      }
    ],
    'selector-pseudo-element-colon-notation': 'double',
    'declaration-property-value-no-unknown': null,
    'scss/comment-no-empty': null
  }
}
