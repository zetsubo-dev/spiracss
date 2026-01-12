const esbuild = require('esbuild')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started')
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        console.error(`    ${location.file}:${location.line}:${location.column}:`)
      })
      console.log('[watch] build finished')
    })
  }
}

async function main() {
  // Library build (no shebang)
  const libCtx = await esbuild.context({
    entryPoints: {
      index: 'src/index.ts'
    },
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outdir: 'dist',
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin]
  })

  // CLI build (with shebang - required for npx on macOS/Linux)
  const cliCtx = await esbuild.context({
    entryPoints: {
      cli: 'src/cli.ts',
      'html-lint': 'src/html-lint.ts',
      'html-format': 'src/html-format.ts'
    },
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outdir: 'dist',
    logLevel: 'silent',
    banner: {
      js: '#!/usr/bin/env node'
    },
    plugins: [esbuildProblemMatcherPlugin]
  })

  if (watch) {
    await libCtx.watch()
    await cliCtx.watch()
  } else {
    await libCtx.rebuild()
    await cliCtx.rebuild()
    await libCtx.dispose()
    await cliCtx.dispose()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
