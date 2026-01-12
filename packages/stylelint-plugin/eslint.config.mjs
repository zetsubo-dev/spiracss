import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort'

export default [
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
      '@typescript-eslint': typescriptEslint
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off'
    }
  },
  {
    ignores: ['dist/', 'node_modules/']
  },
  eslintConfigPrettier
]
