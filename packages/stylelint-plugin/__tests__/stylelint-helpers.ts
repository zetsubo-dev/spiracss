import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

type StylelintModule = typeof import('stylelint')

export type LintOptions = Parameters<StylelintModule['default']['lint']>[0]
export type LintResult = Awaited<ReturnType<StylelintModule['default']['lint']>>
type StandaloneLint = (options: LintOptions) => Promise<LintResult>

const require = createRequire(import.meta.url)
const stylelintRoot = dirname(require.resolve('stylelint/package.json'))
const stylelintEsmUrl = pathToFileURL(join(stylelintRoot, 'lib', 'index.mjs')).href

let lintPromise: Promise<StandaloneLint> | undefined

const getLint = async (): Promise<StandaloneLint> => {
  if (!lintPromise) {
    lintPromise = import(stylelintEsmUrl).then(
      (module) => module.default.lint as StandaloneLint
    )
  }
  return lintPromise
}

export const lint = async (options: LintOptions): Promise<LintResult> => {
  const lintFn = await getLint()
  return lintFn(options)
}
