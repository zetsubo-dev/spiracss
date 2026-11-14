# SpiraCSS AI agent guide v0.6.0

SpiraCSS tools check whether class names and SCSS selectors follow the SpiraCSS structure. Your job is to fix what the diagnostics report. For a normal lint fix, read this guide and the diagnostic output. Do not load the full reference.

Compatibility: `@spiracss/stylelint-plugin` v0.6.0 and `@spiracss/html-cli` v0.6.0. Both require Node.js `>=24.22.3 <25`. The Stylelint plugin supports Stylelint 17 and 18.

## Prepare before you edit

1. Find the lint commands the project already uses. Look in `package.json` scripts, the Stylelint config, and CI or Git hook config. SpiraCSS checks can run through Stylelint, `spiracss-html-lint`, or the ESLint `markup` rule.
2. If the project defines no command, run the locally installed binary through the project's package manager, for example `pnpm exec stylelint "src/**/*.scss"`. `npx`, `pnpm dlx`, and `yarn dlx` can download packages. Do not use them, and do not install or upgrade packages without approval.
3. Check the installed version of each SpiraCSS package that the project's commands use, for example in `node_modules/@spiracss/stylelint-plugin/package.json`. This guide describes 0.6.0. If the installed version differs, check the documentation for that version before you apply guidance that depends on the version.
4. Find the SpiraCSS settings each tool uses. The HTML CLI reads `spiracss.config.js` from the current directory, so run it from the directory that contains that file. Stylelint gets SpiraCSS settings from the Stylelint config, through `createRules()` with an object, `createRulesAsync()` with a path, or rule options written directly. Run Stylelint from the project root, because path checks such as `@rel` resolve from the current directory. To see the rule options that Stylelint applies to a file, run `stylelint --print-config <file>` through the same package manager.
5. If a tool's required SpiraCSS settings are unavailable, stop validation with that tool and report the missing settings. `createRules()` and `createRulesAsync()` throw an error without `aliasRoots`. The HTML CLI returns `CONFIG_MISSING` when it finds no `spiracss.config.js`. Use `--allow-provisional` only when the user accepts default settings, and report every such result as provisional.

## Fix from the diagnostic

1. Run the lint command and read each diagnostic. A SpiraCSS Stylelint message names its `spiracss/` rule and includes a `Docs:` URL. The URL anchor is the message key. Messages from other Stylelint rules do not include these SpiraCSS details. An HTML CLI `--json` diagnostic gives `code`, `reason`, `repair.conditions`, `repair.effective`, and `docs`. It adds `range` and `position` only when the report can be traced to the source, and it adds `condition` and `repair.missingInformation` when they apply.
2. Decide the fix from those fields. Open the `Docs:` or `docs` page only when the fields do not settle the fix. Do not reload this guide or the full reference for each diagnostic.
3. Make the smallest change that satisfies the diagnostic under the effective config. Leave unrelated code as it is.
4. If several diagnostics point at one selector or element, fix the highest-level structural issue first. Then rerun.
5. Rerun the same command with the same format, mode, and config. The new output replaces the old one as the current state.
6. If one diagnostic survives three attempts, stop. Report the diagnostic, the code, the config section, and each change you tried.

## Keep the fix honest

- Do not change `spiracss.config.js`, rule options, severities, or ignore lists to remove an error, unless the user asks for that change.
- Do not delete, rename, or add classes, attributes, or dynamic bindings only to reach zero errors.
- The `Auto-fix:` text in a Stylelint message describes a repair. The tool does not apply it. In 0.6.0, `stylelint --fix` does not fix any SpiraCSS rule. Make the change yourself and rerun lint.
- If `repair.missingInformation` is present, resolve it from project evidence, such as the config, the surrounding source, and the project's requirements. Ask the user only when the intended role or runtime behavior is still unknown. For `SOURCE_RELATION_UNRESOLVED` and `DYNAMIC_CLASS_UNRESOLVED`, supply the missing static evidence or ask for the intent. For `MULTIPLE_ROOT_ELEMENTS`, keep the intended root, or use selection mode for input that holds several components on purpose.
- Only a pass is a pass. Report every unresolved, skipped, ignored, provisional, blocked, or downgraded result. `--ignore-structure-errors` does not make blocked input valid.
- A diagnostic without `range` or `position` is a file-level report. Do not invent a location for it.
- A pass in the ESLint host does not prove a pass in the CLI, and the reverse is also true. ESLint does not report coverage.

## Know what SpiraCSS checks

- The HTML CLI checks class names and the relationships between Blocks and Elements in source markup. It does not expand component props or slots to reconstruct rendered DOM. The CLI counts some unexpanded sites in `coverage`, and a count is not an inspection.
- HTML has no SpiraCSS limit on Block nesting depth. `MAX_DEPTH_EXCEEDED` is an HTML traversal safety limit, not a design rule. Simplify or split the input.
- Stylelint checks how selectors and properties are written inside each SCSS file. Its depth checks, such as `tooDeepBlockNesting`, apply to SCSS selectors, not to HTML.
- SpiraCSS is not a replacement for syntax, accessibility, or general CSS linters. A parser failure, such as `PARSE_ERROR` or `UNBALANCED_HTML`, blocks class-structure analysis. Repair only the reported cause, then rerun.

## Load more only when the diagnostic needs it

- One rule or code in detail: the `Docs:` URL, the [Stylelint rules](https://spiracss.jp/tooling/stylelint/#rules), or the [HTML CLI error codes](https://spiracss.jp/tooling/html-cli/#error-codes).
- Messages that depend on config, such as naming, selector policy, paths, placement, interaction, or keyframes: [configuration options](https://spiracss.jp/configuration/options/) and [troubleshooting](https://spiracss.jp/configuration/troubleshooting/).
- The 0.6.0 diagnostic fields, parser limits, Vue and Astro cases, ESLint setup, and host limits: [source-aware engine](https://spiracss.jp/tooling/html-cli/#source-aware-engine-060).
- Component root `@scope` syntax and the upgrade from v0.4.x: [scope root syntax](https://spiracss.jp/configuration/options/#scope-root-syntax). Do not change `generator.scssRootStyle` or migrate styles without the user's decision.
- Fixes across files, `@rel` links, or page and component boundaries: [workflow guide](https://spiracss.jp/guides/workflow/).
- Requirements of earlier versions: section 0 of the [full reference](https://spiracss.jp/downloads/spiracss-ai-agent-doc.full.md), and the [changelog](https://spiracss.jp/introduction/changelog/) for release notes.
- New generation, diagnostics that no page documents, or a conflict between tools and docs: the [full reference](https://spiracss.jp/downloads/spiracss-ai-agent-doc.full.md).

## Resolve conflicts

The project config overrides every document. If tool output disagrees with the documentation, follow the tool output and recheck the config. Report the mismatch with the rule or code, the installed versions, and the URL.
