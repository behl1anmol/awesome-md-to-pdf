# Review a PR

Checklist the `code-reviewer` runs against every change before approval.

- Owner: `code-reviewer` (readonly)
- Escalates to: `orchestrator` on blocking findings
- Related rules: every file under [.cursor/rules/](.cursor/rules)

## Hard gates (block merge on any failure)

1. `npm run typecheck` passes locally on the PR branch. No TypeScript errors.
2. `npm run build` succeeds. `dist/` is NOT committed.
3. `npm run demo:light` and `npm run demo:dark` both succeed. No new warnings on stderr.
4. CI is green across the full matrix (ubuntu Node 24, windows Node 24).
5. No stray `console.*` calls outside the sanctioned list in [20-logger-and-console.mdc](.cursor/rules/20-logger-and-console.mdc).
6. No hardcoded colors, fonts, or sizes in component-level CSS — everything routes through CSS custom properties.
7. No new dependency added without justification (size, provenance, maintenance).

## Rule-by-rule audit

Walk the diff against each rule file:

- [00-core-conventions.mdc](.cursor/rules/00-core-conventions.mdc): indent, quotes, no narrating comments, no emoji.
- [10-typescript-style.mdc](.cursor/rules/10-typescript-style.mdc): no `any`, `unknown` narrowed via the project pattern, named exports, async IO for hot paths.
- [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc): new tokens traverse DesignTokens / buildDesignOverride / tokens.css / base.css in lockstep.
- [40-pdf-pipeline-invariants.mdc](.cursor/rules/40-pdf-pipeline-invariants.mdc): `page.pdf` options unchanged; navigation still via `file://`; readiness dance intact.
- [50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc): new flag threaded through RawCliOptions -> ConvertOptions -> Session; README + docs updated.
- [60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc): new runtime assets copied; docs updated per surface; changelog entry for user-visible changes.
- [70-commits-and-changelog.mdc](.cursor/rules/70-commits-and-changelog.mdc): conventional-style subjects; no `dist/`, `pdf/`, `samples/out*/` committed.
- [80-security-and-deps.mdc](.cursor/rules/80-security-and-deps.mdc): no new secrets; OIDC permissions preserved; Puppeteer launch args unchanged unless justified.

## Visual review

If the PR touches [src/template.ts](src/template.ts), any file under [src/themes/](src/themes), [src/pdf.ts](src/pdf.ts), [src/mermaid-runtime.ts](src/mermaid-runtime.ts), or [src/design.ts](src/design.ts):

- Insist on page-1 PNG screenshots in light AND dark mode.
- Run [scripts/verify-fullbleed.js](scripts/verify-fullbleed.js) yourself if the author didn't attach output.
- Follow [visual-verify-full-bleed.md](.cursor/instructions/visual-verify-full-bleed.md) for the acceptance checklist.

## Docs review

- README matches the new behaviour.
- [docs/](docs) pages updated per the ownership table in [60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc).
- Architecture diagram in [docs/architecture.md](docs/architecture.md) still reflects the module graph.

## Soft suggestions

- Variable / field naming follows the existing convention in the surrounding code.
- Public surfaces have JSDoc explaining intent, not mechanics.
- Complex logic has a one-paragraph comment block at the top of the function (see the header comments in [src/repl.ts](src/repl.ts) and [src/progress.ts](src/progress.ts) for the house style).

## Handoff back

If everything passes, approve with a short summary of what was verified. If any gate fails, return to the owning agent via the review-gate envelope in [.cursor/agents/PROTOCOLS.md](.cursor/agents/PROTOCOLS.md), listing each blocking finding with the rule number and file:line citation.
