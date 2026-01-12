import { register } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.env.TS_NODE_PROJECT) {
  process.env.TS_NODE_PROJECT = path.resolve('tsconfig.test.json')
}

register('ts-node/esm', pathToFileURL('./'))
