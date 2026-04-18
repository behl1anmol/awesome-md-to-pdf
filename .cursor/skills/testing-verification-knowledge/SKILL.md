---
name: testing-verification-knowledge
description: How to test and visually verify awesome-md-to-pdf changes. Covers the samples fixtures, npm run demo:light/dark smoke tests, scripts/verify-fullbleed.js (A4 PNG harness), scripts/pdf-page1-to-png.js (real-PDF first-page snapshot), the CI --help smoke test, where outputs land, and the visual-regression checklist. Use when authoring tests, verifying a rendering change, generating goldens, or reviewing a PR that touches the pipeline.
triggers: smoke test, verify full-bleed, verify-fullbleed.js, pdf-page1-to-png.js, samples/, samples/out, samples/out-dark, demo:light, demo:dark, visual regression, golden PNG, A4, 794x1123, PDF snapshot, CI smoke test, testing, --help, samples fixture, visual diff, baseline PNG, convert smoke, end-to-end test, README.md as fixture
---

# Testing & visual verification

This repo has no unit test harness. It relies on a tight set of end-to-end visual checks. This skill documents every check, what it proves, and how to fail fast.

## Fixtures

Authored fixtures under [samples/](samples):

- [samples/README.md](samples/README.md) and [samples/demo.md](samples/demo.md) — the canonical demos. Exercise headings, admonitions, tables, code blocks (multiple languages), mermaid, KaTeX, task lists, footnotes, emoji.
- `samples/bug-<id>/` — per-bug repro fixtures produced during triage. Check in the repro markdown; do NOT check in the generated PDFs.

Output directories:

- `samples/out/` — default output of `demo:light` / `demo:dark`.
- `samples/out-fullbleed/` — verify-fullbleed.js PNGs.
- Any `samples/out*` pattern is gitignored; promote a specific PNG to a baseline only when intentional.

## Gates

### 1. Typecheck (`npm run typecheck`)

- Pure `tsc --noEmit`. Zero-tolerance for errors.
- Runs in CI on every matrix cell.
- Local habit: run before handing off code.

### 2. Build (`npm run build`)

- `tsc` + `copy-assets.js`. Must succeed on every commit.
- Verifies that new theme / design assets exist in `src/` and get copied to `dist/`.

### 3. CLI `--help` smoke (CI)

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs `node bin/awesome-md-to-pdf.js --help` after build. Proves:

- bin shim resolves `dist/cli.js`.
- Commander setup loads.
- No top-level exception in `cli.ts`.

### 4. Demo renders (`npm run demo:light`, `npm run demo:dark`)

```bash
npm run demo:light
npm run demo:dark
```

- Renders every file under `samples/` with cover + toc to `samples/out/`.
- End-to-end sanity check for the entire pipeline.
- Failure modes observed historically:
  - Exit code non-zero -> real bug. Investigate.
  - Exit code zero but a PDF is 0 bytes -> Puppeteer crashed mid-file; check stderr for `[pdf] pageerror:`.
  - Exit code zero but a diagram is blank -> readiness dance regressed (see `pdf-pipeline-knowledge`).

## Visual verification

### `scripts/verify-fullbleed.js`

Usage:

```bash
node scripts/verify-fullbleed.js <markdownFile> [outDir] [designPath]
```

- Reuses `createMarkdown`, `buildHtml`, `parseDesignMd` from `dist/`.
- Renders at A4 proportions (794 × 1123 at 96 DPI) to PNG via Puppeteer screenshot.
- Produces `<name>.light.png` and `<name>.dark.png` in `outDir` (default `samples/out-fullbleed`).

Intended use: fast iteration on CSS / design overrides. Does NOT use `page.pdf`, so it cannot catch pagination bugs (content clipped at page boundaries).

### `scripts/pdf-page1-to-png.js`

Usage:

```bash
node scripts/pdf-page1-to-png.js <pdfPath> <pngPath>
```

- Rasterises page 1 of an existing PDF to PNG.
- Uses Puppeteer's PDF viewer via file:// navigation.
- Intended for: capturing first-page snapshots from `samples/out/*.pdf` for visual review.

Between the two: verify-fullbleed is fast iteration; pdf-page1-to-png is the ground truth.

## Visual acceptance checklist

When the change touches [src/template.ts](src/template.ts), any file under [src/themes/](src/themes), [src/pdf.ts](src/pdf.ts), [src/mermaid-runtime.ts](src/mermaid-runtime.ts), or [src/design.ts](src/design.ts):

1. Full-bleed: canvas color reaches all four edges (unless running chrome is enabled).
2. Cover: serif title, sans eyebrow "awesome-md-to-pdf", date, optional file list.
3. TOC: brand-colored links, muted metadata.
4. Code blocks: language chip right-aligned, code background from `--code-bg`.
5. Mermaid: diagrams render (not empty boxes), follow design palette.
6. KaTeX: inline + display math, no tofu.
7. Admonitions: left border in distinct color per kind (`note` / `tip` / `warning` / `danger`).
8. Dark mode: text-background contrast sufficient; grays warm.
9. Running chrome (if enabled): 14mm band at the correct edge(s), page counter format `n / N`.

## Generating a new baseline

When a visual change is intentional:

1. Render to the canonical out dir:
   ```bash
   npm run demo:light && npm run demo:dark
   node scripts/pdf-page1-to-png.js samples/out/demo.pdf samples/out/demo.page1.png
   ```
2. Eyeball against the previous baseline (diff in your image viewer of choice).
3. If accepted, commit the new PNG as the baseline. Keep baselines small and few (don't store 20 MB of PDF/PNG assets).

## Adding a new fixture

- Put the markdown under `samples/<name>.md`. Keep it small — demo runs should stay under 10 s wall-time.
- If the fixture has per-file assets (images), place them in `samples/assets/` and reference with relative paths (the image renderer in [src/markdown.ts](src/markdown.ts) rewrites to `file://`).
- Update [samples/README.md](samples/README.md) if the fixture needs explanation.

## When to add a unit test

We deliberately don't have one today. Add one only if:

- You're parsing user input with non-trivial logic (e.g. a future multi-format `--accent` parser).
- The logic is pure, has no Puppeteer / FS dependency, and has several edge cases.
- The test framework adds no heavy devDependency (prefer the Node built-in `node:test` runner).

Anything touching Puppeteer / rendering belongs in the visual pipeline above, not in a unit test.

## Debug helpers

- Enable mermaid diagnostics: render with `--mode` and check stderr for `[pdf] pageerror:` and `[pdf] requestfailed:` lines.
- Inspect the intermediate HTML: Puppeteer writes it to `os.tmpdir()/md-to-pdf-XXXX/doc-<rand>.html` and deletes on close. Set a breakpoint in [src/pdf.ts](src/pdf.ts) `render` or temporarily comment out the `fsp.rm` to keep the temp dir.
- Check the CSS cascade: render to HTML (not PDF) via `scripts/verify-fullbleed.js` — the script writes an intermediate HTML file; open it in a browser DevTools.

## File pointers

- [samples/](samples) — fixtures.
- [scripts/verify-fullbleed.js](scripts/verify-fullbleed.js) — A4 PNG harness.
- [scripts/pdf-page1-to-png.js](scripts/pdf-page1-to-png.js) — real-PDF snapshot.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — CI smoke test.
- [.cursor/instructions/visual-verify-full-bleed.md](.cursor/instructions/visual-verify-full-bleed.md) — reusable checklist.
- [.cursor/instructions/triage-bug.md](.cursor/instructions/triage-bug.md) — bug repro flow.
