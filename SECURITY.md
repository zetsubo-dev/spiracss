# Security status and runtime updates

## Node.js 24 LTS

Development is pinned to Node.js 24.22.2. The v0.5.1 npm releases require
`>=24.22.2 <25`. Use the newest available Node.js 24 patch, not an older patch
that merely satisfies Stylelint's own minimum.

Checked on 2026-11-09: 24.22.2 is the latest published Node.js 24 release. It
includes the October 2026 security fixes. Node.js has announced another security
release for November 11, including a HIGH-severity issue affecting the 24.x line;
that fix is not yet published. Recheck the official release feed before release
or deployment. A successful dependency audit does not audit the Node.js runtime.

- [Node.js 24.22.2](https://nodejs.org/en/blog/release/v24.22.2)
- [October security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [November security release announcement](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)

## Dependency audit

The 2026-11-09 migration refreshed compatible dependency resolutions and updated
Oxfmt to 0.77.0 to remove the vulnerable Tinypool dependency. Both the production
and full workspace audits report zero advisories, including development tools.
This does not mean all runtime or supply-chain risks are absent.

### Tested, parent-scoped security overrides

The latest `@vscode/test-cli` 0.0.15 requires Mocha 11 and uses its CommonJS
constructor. Mocha 12 changes that API, so overriding Mocha itself would break
the VS Code runner. Several latest tooling packages also still request vulnerable
Glob and Minimatch majors. `pnpm-workspace.yaml` therefore overrides only the
specific parent versions inspected during this migration:

| Replacement                  | Parents                                                               | Fixed advisories                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diff@8.0.3`                 | Mocha 11.8.0                                                          | [DoS](https://github.com/advisories/GHSA-73rr-hh4g-fpgx)                                                                                                                                |
| `serialize-javascript@7.1.4` | Mocha 11.8.0                                                          | [RCE](https://github.com/advisories/GHSA-5c6j-r48x-rmvq), [CPU exhaustion](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v), [XSS](https://github.com/advisories/GHSA-m5mm-p8h7-m29v) |
| `glob@14.0.4`                | Mocha 11.8.0, VS Code test CLI 0.0.15, VSCE 3.9.2, test-exclude 8.0.0 | [Cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)                                                                                                                |
| `minimatch@11.0.5`           | The same four parents                                                 | [DoS](https://github.com/advisories/GHSA-g3hv-75wg-m249)                                                                                                                                |

These are major-version substitutions, not an assumption of semver compatibility.
The inspected parents do not use the removed `Minimatch.makeRe` or
`Pattern.isRegExp` APIs. `pnpm test:tooling` checks the APIs they do use: CommonJS
and ESM glob discovery, ignores and dotfiles, Mocha watch Pattern traversal,
include/exclude matching, reporter diffs, option serialization, and coverage
file filtering. Also run the package suites, VS Code integration tests, and VSIX
packaging before accepting a change to these pins.

There are no global dependency overrides or audit suppressions. When an upstream
parent adopts the patched dependency, remove its override and update the contract
test expectations together, then rerun all checks. Recheck the audit whenever a
parent version changes. Do not run untrusted test code in a credential-bearing
environment, regardless of audit results.

Reproduce from the workspace root with its pinned Node.js and pnpm versions:

```sh
pnpm install --frozen-lockfile
pnpm test:tooling
pnpm audit --prod
pnpm audit
```
