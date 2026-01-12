import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const mochaPath = require.resolve('mocha/bin/mocha.js')

await import(mochaPath)
