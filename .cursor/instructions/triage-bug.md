# Triage a bug

Reproduce, classify, and file a bug with enough context that any other agent can pick up the fix.

- Owner: `tester`
- Review: `code-reviewer`
- Handoff: `backend-developer` or `frontend-developer` based on classification
- Related skills: `testing-verification-knowledge`, `markdown-pipeline-knowledge`, `pdf-pipeline-knowledge`, `design-system-knowledge`

## Step 1 — Reproduce

1. Isolate to the smallest possible `.md`. Strip imports, trim content, remove images that don't matter.
2. Save the fixture to `samples/bug-<id>/input.md` (where `<id>` is a short slug or issue number).
3. Reproduce both one-shot and (if relevant) chat-mode:
   ```bash
   npm run build
   node bin/awesome-md-to-pdf.js samples/bug-<id> -o samples/bug-<id>/out --mode light
   node bin/awesome-md-to-pdf.js samples/bug-<id> -o samples/bug-<id>/out --mode dark
   ```
4. Capture page-1 PNGs:
   ```bash
   node scripts/pdf-page1-to-png.js samples/bug-<id>/out/input.pdf samples/bug-<id>/out/input.page1.png
   ```

## Step 2 — Classify

Place the bug in exactly one of these buckets so the right owner picks it up:

| Bucket | Ownership | Likely suspect modules |
|---|---|---|
| `parse` | backend-developer | [src/markdown.ts](src/markdown.ts), plugin choice, custom fence renderer |
| `design` | frontend-developer | [src/design.ts](src/design.ts) parser, `SYNONYMS` rules, [src/designs/*.md](src/designs) |
| `render` | frontend-developer | [src/template.ts](src/template.ts), [src/themes/*.css](src/themes) |
| `pdf` | backend-developer | [src/pdf.ts](src/pdf.ts), [src/mermaid-runtime.ts](src/mermaid-runtime.ts), Puppeteer readiness |
| `cli` | backend-developer | [src/cli.ts](src/cli.ts), Commander wiring, flag normalization |
| `repl` | frontend-developer | [src/repl.ts](src/repl.ts), readline raw-mode, ghost hints |
| `build` | devops | [scripts/copy-assets.js](scripts/copy-assets.js), [.github/workflows/*](.github/workflows) |

## Step 3 — File a plan

1. Create `.cursor/plans/bug-<id>.plan.md` with:
   - Summary (1-2 sentences).
   - Repro steps (link `samples/bug-<id>/`).
   - Classification bucket + expected owner.
   - Likely suspect file(s) with citations like `[src/markdown.ts](src/markdown.ts)`.
   - Acceptance criteria: page-1 PNG matches a known-good baseline, typecheck passes, no regression on other samples.
2. Tag the plan's frontmatter with `status: pending` and the owner.

## Step 4 — Handoff

Use the handoff envelope from [.cursor/agents/PROTOCOLS.md](.cursor/agents/PROTOCOLS.md):

```json
{
  "from": "tester",
  "to": "backend-developer",
  "artifact_paths": ["samples/bug-<id>/input.md", "samples/bug-<id>/out/input.page1.png", ".cursor/plans/bug-<id>.plan.md"],
  "checks_passed": ["reproduced on light", "reproduced on dark"],
  "open_questions": ["..."]
}
```

## Gotchas

- "Bug in mermaid diagram" is almost always a syntax error in the diagram source — it shows up in Puppeteer's `pageerror` forwarding. Check stderr first.
- "Fonts look different" is usually the fallback cascade doing its job because a private font isn't installed. Not a bug unless the fallback is wrong.
- "Progress bar overlaps" is expected when `--concurrency > 1` with multiple files (see [50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc)). The converter already falls back to ora in that case.
