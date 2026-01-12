import { defineConfig } from '@vscode/test-cli'
import os from 'node:os'
import path from 'node:path'

export default defineConfig({
  files: 'dist/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: path.resolve('fixtures'),
  launchArgs: [
    '--user-data-dir',
    path.join(os.tmpdir(), 'vscode-test-spiracss')
  ],
  mocha: {
    ui: 'tdd',
    timeout: 20000
  }
})
