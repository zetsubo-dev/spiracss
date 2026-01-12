import { defineConfig } from '@vscode/test-cli'
import * as os from 'os'
import * as path from 'path'

export default defineConfig({
  files: 'dist/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: './fixtures',
  launchArgs: ['--user-data-dir', path.join(os.tmpdir(), 'vscode-test-comment-links')],
  mocha: {
    ui: 'tdd',
    timeout: 20000
  }
})
