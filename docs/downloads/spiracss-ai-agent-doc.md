# SpiraCSS AI Agent Routing Guide v0.5.0

This is the small, diagnostic-first entry point for AI agents working with SpiraCSS. Do not load the full reference for every task. Read the current project config and tool output first, then load only the linked rule or option page required by the diagnostic.

## Authority and version

Use these sources in this order:

1. The project `spiracss.config.js` (project-specific settings always win).
2. Current Stylelint / HTML CLI output (the reported location, rule/code, message, and `Docs:` URL are the immediate evidence).
3. The rule or option page linked by the diagnostic.
4. This routing guide.
5. The [full reference](https://spiracss.jp/downloads/spiracss-ai-agent-doc.full.md) only when the diagnostic and focused pages are insufficient.

If the tool output conflicts with documentation, follow the tool output, re-check the config, and report possible documentation drift. Do not change config unless explicitly requested.

Compatibility: `@spiracss/stylelint-plugin` v0.5.0 and `@spiracss/html-cli` v0.5.0. Confirm the installed versions before applying version-specific guidance.

When upgrading from v0.4.x, the component root default changes to `scope-explicit`. To preserve existing class-form roots and CSS, the project owner can select `generator.scssRootStyle: 'class'`. This does not exempt child files from the new scope prohibition. Do not change config or migrate styles automatically; follow the chosen project setting.

## Default context budget

For a normal lint-fix task, load only:

- the project config;
- this guide;
- the exact rule page named by `Docs:` (prefer the `#messageKey` anchor).

Do not preload every rule page, every example, or the full reference. Expand the context only when the diagnostic is config-dependent, spans multiple files, or remains ambiguous after one focused read.

## Diagnostic-first fix loop

1. Capture the tool name, file, line/column, rule or error code, message, code frame, and `Docs:` URL.
2. If the message contains a `Docs:` URL, open that exact URL and anchor. The URL is the route, not a request to read this entire document again.
3. Apply the smallest correction that satisfies the message and the project config. Preserve unrelated structure.
4. Treat `Auto-fix:` text as a repair strategy. Do not assume that the Stylelint rule will rewrite the file automatically; verify the tool's actual fix support and result.
5. Re-run the same lint command. Use the new diagnostic as the next source of truth.
6. When several messages point to the same selector, fix the highest-level structural issue first, then re-run instead of applying every suggestion blindly.
7. Stop after three unsuccessful attempts on the same diagnostic. Report the exact diagnostic, relevant code, config section, and attempted changes.

Do not turn skipped, unresolved, provisional, or downgraded coverage into a clean pass without reporting it.

## Stylelint routing

Use the exact `Docs: https://spiracss.jp/stylelint-rules/<rule>/#<messageKey>` URL emitted by the plugin whenever available.

| Diagnostic rule | Focused page |
| --- | --- |
| `spiracss/class-structure` | [class-structure](https://spiracss.jp/stylelint-rules/class-structure/) |
| `spiracss/property-placement` | [property-placement](https://spiracss.jp/stylelint-rules/property-placement/) |
| `spiracss/page-layer` | [page-layer](https://spiracss.jp/stylelint-rules/page-layer/) |
| `spiracss/interaction-scope` | [interaction-scope](https://spiracss.jp/stylelint-rules/interaction-scope/) |
| `spiracss/interaction-properties` | [interaction-properties](https://spiracss.jp/stylelint-rules/interaction-properties/) |
| `spiracss/keyframes-naming` | [keyframes-naming](https://spiracss.jp/stylelint-rules/keyframes-naming/) |
| `spiracss/pseudo-nesting` | [pseudo-nesting](https://spiracss.jp/stylelint-rules/pseudo-nesting/) |
| `spiracss/rel-comments` | [rel-comments](https://spiracss.jp/stylelint-rules/rel-comments/) |

Load [configuration options](https://spiracss.jp/configuration/options/) as well when the message depends on naming, selector policy, section comments, paths, `marginSide`, `sizeInternal`, `position`, interaction settings, keyframes settings, or cache/path resolution.

Important boundaries:

- `spiracss/class-structure` checks SCSS selector structure. It does not impose a maximum HTML Block nesting depth.
- For `rootScopeRequired` (v0.5.0+), load the [exact repair section](https://spiracss.jp/stylelint-rules/class-structure/#rootScopeRequired) and `generator.scssRootStyle` in [configuration options](https://spiracss.jp/configuration/options/). Repair the component root only; meta-loaded child Block files do not need conversion. This diagnostic and setting are not available before v0.5.0.
- For `childScopeNotAllowed` (v0.5.0+), keep child and descendant Block files under configured `childDir` in class form. Every child-file `@scope`, including a theme wrapper, is an error for all settings. Loading a child `:scope` inside the root's `:scope` can produce the non-matching `:scope :scope`. Follow the [exact repair section](https://spiracss.jp/stylelint-rules/class-structure/#childScopeNotAllowed); do not move the root include or auto-rewrite CSS.
- For `scopeOwnerAmbiguous` (v0.5.0+), follow the [ownership repair section](https://spiracss.jp/stylelint-rules/class-structure/#scopeOwnerAmbiguous). Identify the component via its filename/directory or declare a thematic wrapper in existing external-class configuration; do not invent ownership or disable structural checks.
- `spiracss/property-placement` is config-sensitive. Resolve the effective config before moving properties.
- `spiracss/page-layer` and `spiracss/rel-comments` can require file-path and cross-file checks; do not solve them from the warning text alone.
- A message may include an `Auto-fix:` suggestion while the rule remains non-fixable by Stylelint. Follow the suggestion manually and verify with a fresh lint run.

## HTML CLI routing

For `INVALID_BASE_CLASS`, `MODIFIER_WITHOUT_BASE`, `UTILITY_WITHOUT_BASE`, `MULTIPLE_BASE_CLASSES`, `ELEMENT_WITHOUT_BLOCK_ANCESTOR`, `ELEMENT_PARENT_OF_BLOCK`, or variant/state errors, load [HTML CLI](https://spiracss.jp/tooling/html-cli/) and the relevant [configuration options](https://spiracss.jp/configuration/options/).

For `DYNAMIC_CLASS_UNRESOLVED`, resolve the template binding first. Do not invent a replacement class or treat the element as classless from incomplete static input.

For `CONFIG_MISSING`, stop. Do not present fallback defaults as final project validation. A provisional command is valid only when explicitly accepted and must remain marked provisional.

For `UNBALANCED_HTML`, `MULTIPLE_ROOT_ELEMENTS`, or `MAX_DEPTH_EXCEEDED`, fix or simplify the input before attempting SCSS generation. `--ignore-structure-errors` does not make blocked input valid.

## When to expand context

Load [configuration troubleshooting](https://spiracss.jp/configuration/troubleshooting/) when the effective config cannot be resolved or the diagnostic appears inconsistent with it.

Load [the workflow guide](https://spiracss.jp/guides/workflow/) when a fix spans generated files, `@rel` relationships, page/component boundaries, or more than one package.

Load [component structure](https://spiracss.jp/architecture/components/structure/) when the error cannot be resolved locally without deciding whether a class is a Block, Element, Modifier, Utility, or External class.

Use the [full reference](https://spiracss.jp/downloads/spiracss-ai-agent-doc.full.md) only for undocumented diagnostics, version migration, broad generation tasks, or unresolved documentation drift. It is a fallback reference, not the default context.

## Completion criteria

- The same lint command passes for the changed scope.
- Config-dependent checks used the effective project config.
- No unresolved, skipped, ignored, provisional, or downgraded result is silently reported as a clean pass.
- Changes unrelated to the reported diagnostic were not introduced.
- If the diagnostic and documentation disagree, the mismatch is reported with the rule, message key, versions, and URL.
