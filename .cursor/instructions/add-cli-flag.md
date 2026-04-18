# Add a CLI flag

Reusable workflow for introducing a new user-facing flag that should work in one-shot mode AND chat mode.

- Owner: `backend-developer`
- Review: `code-reviewer`
- Docs: `frontend-developer`
- Related rules: [50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc), [60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc)
- Related skills: `cli-repl-knowledge`, `build-publish-knowledge`

## Checklist

1. Pick a name following the existing convention in [src/cli.ts](src/cli.ts) (`--kebab-case`, short alias where it improves ergonomics, e.g. `-o, --output`).
2. Add the `program.option(...)` call in [src/cli.ts](src/cli.ts). If the value requires parsing (number, enum, hex), use a Commander value-parser callback, mirroring `parseInt` on `--concurrency`.
3. Add the field on `RawCliOptions` in [src/cli.ts](src/cli.ts). Use a primitive type (`string`, `number`, `boolean`) or a typed union.
4. Normalize / validate. If the flag accepts a constrained set of values, add a helper like `parseAccent` or `normalizeFormat` and fail fast with `logger.error(...)` + `process.exit(2)` on bad input.
5. Thread the normalized value into `ConvertOptions` in [src/converter.ts](src/converter.ts) inside the `runOptions` literal.
6. Consume it in the per-file pipeline. Depending on what the flag controls:
   - Rendering: read it inside `convertOne` / `convertMerged` and pass it to `buildHtml` or the markdown renderer.
   - PDF surface: extend `BuildHtmlOptions` in [src/template.ts](src/template.ts) and route through `buildPageChromeCss` or a new helper.
7. If the flag should be tunable from chat mode:
   - Add the field to `Session` in [src/repl.ts](src/repl.ts) and initialize it from `opts.initial`.
   - Add a slash command entry to `COMMAND_META` (+ handler in `COMMANDS`). Follow [add-slash-command.md](.cursor/instructions/add-slash-command.md).
   - Show it in `/status` output.
8. Update the README options table AND [docs/cli-reference.md](docs/cli-reference.md). Mention the default, the allowed values, and any interaction with other flags (e.g. `--page-numbers` breaks full-bleed).
9. Run:
   ```bash
   npm run typecheck
   npm run build
   npm run demo:light
   npm run demo:dark
   ```
   All four must pass. Eyeball the first-page PNG in `samples/out/` for visual regressions.
10. Commit: `feat: add --flag-name (<short summary>)`. Bump `package.json` minor version and add a changelog entry per [70-commits-and-changelog.mdc](.cursor/rules/70-commits-and-changelog.mdc).

## Common pitfalls

- Forgetting to thread the option into `ConvertOptions` — the flag will be accepted at the CLI but never reach `buildHtml`, silently doing nothing.
- Using a boolean flag without Commander's implicit `false` default when the flag is absent. Use `Boolean(opts.myFlag)` at the use-site.
- Adding the flag to chat mode without matching the one-shot precedence. `opts.initial` must seed the REPL session fields.
