# Visual verify the full-bleed contract

Every change that touches rendering (template, themes, pdf.ts, mermaid runtime, DESIGN.md parsing) MUST be verified visually in light AND dark mode before handoff.

- Owner: `tester`
- Review: `code-reviewer`
- Related rules: [40-pdf-pipeline-invariants.mdc](.cursor/rules/40-pdf-pipeline-invariants.mdc), [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc)
- Related skills: `testing-verification-knowledge`, `template-css-knowledge`, `pdf-pipeline-knowledge`

## What "full bleed" means here

- The canvas background (tokens.css `--bg-page`) paints edge-to-edge on every PDF page.
- There are NO white borders around the content. Typographic margins live as `padding` inside `<main class="page">` in [src/themes/base.css](src/themes/base.css), not as Puppeteer paper margins.
- Enabling `--page-numbers`, `--header`, or `--footer` intentionally breaks full bleed at the affected edge (they reserve a 14mm band). That is expected.

## Fast path: verify-fullbleed.js

The canonical visual check is [scripts/verify-fullbleed.js](scripts/verify-fullbleed.js). It reproduces the exact HTML the converter would feed to Puppeteer, but renders a PNG at A4 proportions (794 × 1123 at 96 DPI) for eyeballing.

```bash
npm run build
node scripts/verify-fullbleed.js samples/demo.md samples/out-fullbleed
node scripts/verify-fullbleed.js samples/demo.md samples/out-fullbleed src/designs/claude.md
```

Outputs include `<name>.light.png` and `<name>.dark.png`. Inspect both.

## PDF page-1 snapshot

For a real PDF-path check (catches bugs that don't show up in the HTML-only path, e.g. Chromium's CSS Paged Media differences):

```bash
npm run demo:light
npm run demo:dark
node scripts/pdf-page1-to-png.js samples/out/demo.pdf samples/out/demo.page1.png
```

## Visual criteria

Walk the PNG and check:

1. Canvas color reaches all four edges; no white halos.
2. Cover page title uses the serif headline family; eyebrow text uses sans, small caps.
3. TOC links use the brand accent.
4. Code blocks: language chip is right-aligned; background uses `--code-bg`; no horizontal scrollbar.
5. Mermaid diagrams render (not placeholder text) and follow the design palette.
6. KaTeX formulas render with correct fonts (no tofu).
7. Admonitions (`:::note`, `:::tip`, `:::warning`, `:::danger`) have distinct left borders in the correct mode-aware colors.
8. Dark mode: headings and body text have sufficient contrast. Check the grays haven't drifted cool.

## When to capture a new baseline

If the visual change is intentional (e.g. new feature, palette tune), copy the new PNG into `samples/out-*/` as the baseline and commit it. Otherwise, the diff is a regression and must be fixed before handoff.

## Automation status

There is no automated pixel diff today. Add one only with explicit approval — storing baseline PNGs inflates the repo quickly. For now, humans (or the tester agent) eyeball.
