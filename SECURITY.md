# Security status and runtime updates

## Node.js 24 LTS

Development is pinned to Node.js 24.22.3, and current source manifests require
`>=24.22.3 <25`. The already-published v0.5.1 npm releases still declare
`>=24.22.2 <25`; this development update does not republish or change those
artifacts. Use the newest available Node.js 24 patch, not an older patch that
merely satisfies a package's minimum.

Checked on 2026-11-12: the official distribution index lists 24.22.3 as the
latest Node.js 24 release, dated 2026-11-10, with `security: true` and OpenSSL
3.5.9. The release blog dates the security release November 11. Its HTTP/2 and
TLS/HTTPS fixes matter to affected server workloads; this is not evidence of
a remotely exploitable offline SpiraCSS CLI. Recheck the official release feed
before release or deployment. A dependency audit does not audit the Node.js runtime.

- [Node.js distribution index](https://nodejs.org/dist/index.json)
- [Node.js 24.22.3](https://nodejs.org/en/blog/release/v24.22.3)
- [November security release](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)

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
| `minimatch@11.0.5`           | ESLint 10.14.0, `@eslint/config-array` 0.23.5                            | [Globparts amplification DoS](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| `minimatch@11.0.5`           | `@typescript-eslint/typescript-estree` 8.72.1                           | [Globparts amplification DoS](https://github.com/advisories/GHSA-g3hv-75wg-m249) |

These are major-version substitutions, not an assumption of semver compatibility.
The inspected parents do not use the removed `Minimatch.makeRe` or
`Pattern.isRegExp` APIs. `pnpm test:tooling` checks the APIs they do use: CommonJS
and ESM glob discovery, ignores and dotfiles, Mocha watch Pattern traversal,
include/exclude matching, reporter diffs, option serialization, and coverage
file filtering. Also run the package suites, VS Code integration tests, and VSIX
packaging before accepting a change to these pins.

The optional markup ESLint host adds the two ESLint parents above. They request
Minimatch 10, which is still affected by the same advisory; only these exact
parent versions are redirected to 11.0.5. The contract tests resolve Minimatch
from each parent, check the matcher APIs used by the parents, and exercise real
flat-config inclusion and exclusion/ignored-file cases. The markup host suite
also verifies actual HTML/WebC file matching and diagnostic output. Audit zero
alone is not compatibility evidence for this major substitution. Remove each
ESLint-parent override when that parent requires a patched release, updating
the parent-resolution and file-selection expectations together.

The TSX supplied-AST host uses `@typescript-eslint/parser` 8.72.1 for testing.
Its exact `typescript-estree` 8.72.1 parent also requests the vulnerable major
for project-file pattern matching. That parent alone is redirected to 11.0.5;
the parent-resolved matcher contract and the real TSX ESLint suite must pass.
Remove this override when that parent requires a patched version, and rerun
both the project-pattern and actual host tests rather than relying on audit zero.

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
