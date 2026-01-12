const esbuild = require('esbuild')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

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
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin]
  })

  // Build test files as well
  const testCtx = await esbuild.context({
    entryPoints: ['src/test/extension.test.ts'],
    bundle: true,
    format: 'cjs',
    minify: false,
    sourcemap: true,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/test/extension.test.js',
    external: ['vscode', 'mocha', 'assert'],
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin]
  })

  if (watch) {
    await ctx.watch()
    await testCtx.watch()
  } else {
    await ctx.rebuild()
    await testCtx.rebuild()
    await ctx.dispose()
    await testCtx.dispose()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
