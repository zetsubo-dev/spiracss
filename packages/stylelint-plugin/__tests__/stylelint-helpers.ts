import stylelint from 'stylelint'

export type LintOptions = Parameters<typeof stylelint.lint>[0]
export type LintResult = Awaited<ReturnType<typeof stylelint.lint>>

export const lint = async (options: LintOptions): Promise<LintResult> => {
  return stylelint.lint(options)
}
