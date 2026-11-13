const esbuild = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')

/** Keep the compiler's relative ../astro.wasm lookup valid after either host is relocated. */
async function buildParserAssets(outputDirectory) {
  const directory = path.resolve(outputDirectory)
  fs.mkdirSync(path.join(directory, 'parsers'), { recursive: true })
  await esbuild.build({
    stdin: { contents: 'module.exports = require("@astrojs/compiler/sync")', resolveDir: path.resolve(__dirname, '..') },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    minify: true,
    outfile: path.join(directory, 'parsers/astro.cjs'),
    logLevel: 'silent'
  })
  fs.copyFileSync(require.resolve('@astrojs/compiler/astro.wasm'), path.join(directory, 'astro.wasm'))
}

module.exports = { buildParserAssets }
