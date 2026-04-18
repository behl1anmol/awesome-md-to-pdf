---
name: pdf-pipeline-knowledge
description: Deep knowledge of the Puppeteer-driven PDF rendering pipeline. Covers PdfRenderer (launch args, browser reuse, cleanup), temp-file file:// navigation strategy, window.__mermaidDone + document.fonts.ready + double requestAnimationFrame readiness dance, page.pdf invariants, mermaid-runtime.ts (resolveMermaidSrc, buildMermaidScript, applyDesignToMermaid), and page error forwarding. Use when touching pdf.ts, mermaid rendering, or diagnosing blank diagrams, missing fonts, or pagination glitches.
triggers: puppeteer, PdfRenderer, page.pdf, file://, setContent, mermaid, __mermaidDone, document.fonts.ready, requestAnimationFrame, headless Chromium, preferCSSPageSize, printBackground, displayHeaderFooter, full bleed, page error, requestfailed, launch args, no-sandbox, disable-dev-shm-usage, font-render-hinting, temp html, resolveMermaidSrc, buildMermaidScript, applyDesignToMermaid, mermaid theme
---

# PDF pipeline

Two files own the Node -> Chromium -> PDF flow:

- [src/pdf.ts](src/pdf.ts) — Puppeteer lifecycle and the actual `page.pdf()` call.
- [src/mermaid-runtime.ts](src/mermaid-runtime.ts) — the inline script that initializes mermaid inside Chromium and exposes the readiness promise.

Both are governed by [40-pdf-pipeline-invariants.mdc](.cursor/rules/40-pdf-pipeline-invariants.mdc). Every change here must be verified in BOTH light and dark mode via `scripts/verify-fullbleed.js` (see `testing-verification-knowledge`).

## `PdfRenderer`

```ts
export class PdfRenderer {
  async launch(): Promise<Browser>
  async close(): Promise<void>
  async render(opts: RenderOptions): Promise<Buffer>
}
```

- One browser per `convert()` call. [src/converter.ts](src/converter.ts) launches before the pool and closes in the outer `finally`.
- Reused across all files in a batch to amortise the 1-3 second launch cost.
- `close()` is idempotent; safe to call twice.

### Launch args (intentional)

```ts
puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
  ],
});
```

- `--no-sandbox`, `--disable-setuid-sandbox` — required on Linux CI without user namespaces. Removing them breaks ubuntu CI.
- `--disable-dev-shm-usage` — `/dev/shm` defaults in containers are too small; without this Chromium OOMs on large documents.
- `--font-render-hinting=none` — stabilises typography across hosts. Without it, A-b-c comparisons across machines drift.

## `RenderOptions`

```ts
interface RenderOptions {
  html: string;
  format?: PaperFormat;       // defaults A4
  progress?: StageEmitter;    // optional; ProgressReporter conforms
}
```

`StageEmitter` is structurally typed to avoid a circular import with `progress.ts`:

```ts
export interface StageEmitter {
  stage(stage: 'browser' | 'render' | 'write'): void;
}
```

## The render sequence

Inside `render(opts)`:

1. Acquire browser via `launch()` (idempotent).
2. `newPage()`.
3. Attach error forwarders:
   - `page.on('pageerror', (err) => console.error('[pdf] pageerror: ' + err.message))`
   - `page.on('requestfailed', ...)` — filters out `net::ERR_ABORTED` (benign).
4. Write the HTML to a temp file: `os.tmpdir()/md-to-pdf-XXXX/doc-<rand>.html`.
5. `page.goto(pathToFileURL(tmpHtml).href, { waitUntil: ['load', 'networkidle0'], timeout: 60_000 })`.
6. Await the readiness dance (see below).
7. `progress?.stage('render')`.
8. Call `page.pdf({ format, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, margin: { 0, 0, 0, 0 } })`.
9. `progress?.stage('write')`.
10. `finally`: close the page, recursively delete the temp dir (both tolerate failures).

## Why `file://` navigation, not `setContent`?

`page.setContent(html)` creates an `about:blank` document. Chromium applies its isolation rules to `about:blank` and REFUSES to fetch `file://` subresources (mermaid.min.js, KaTeX fonts, local images). The result: silently broken diagrams and math.

The workaround is to write the HTML to a temp file and `page.goto(pathToFileURL(...).href)`. Now the document itself is a `file://` URL and can fetch sibling `file://` resources.

**Do not revert this to `setContent`.** It is load-bearing for mermaid + KaTeX + relative images.

## The readiness dance (`page.evaluate`)

Before calling `page.pdf`, we `await`, in order:

```ts
await page.evaluate(async () => {
  if (window.__mermaidDone) { try { await window.__mermaidDone; } catch {} }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
});
await page.evaluate(() => new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
));
```

All three waits matter:

1. **`window.__mermaidDone`**: resolves when every `<div class="mermaid">` has been turned into SVG. Exposed by [src/mermaid-runtime.ts](src/mermaid-runtime.ts). If you skip this, mermaid diagrams in the PDF are blank (or stuck at "Syntax error").
2. **`document.fonts.ready`**: ensures custom fonts and KaTeX math fonts are loaded. Skipping causes tofu in math and sometimes in headings.
3. **Double rAF**: lets inline SVG size changes (mermaid can resize after initial render) settle. Skipping causes content to clip at page boundaries.

The outer `try/catch` on each step is intentional: a broken diagram should not abort the entire conversion. We prefer to emit a PDF with a broken diagram (visible red error text from mermaid) over hard-failing.

## `page.pdf` invariants

```ts
const buffer = await page.pdf({
  format,
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
```

Every flag is load-bearing:

- `printBackground: true` — without this, `--bg-page` is not painted and the PDF has white pages.
- `preferCSSPageSize: true` — honors the CSS `@page { size: ... }` declaration. Lets us switch A4 / Letter / Legal entirely via CSS.
- `displayHeaderFooter: false` — Chromium's own header/footer strips are disabled. Running chrome is produced by `@page` margin boxes in the CSS (see [src/template.ts](src/template.ts) `buildPageChromeCss`).
- `margin: { 0, 0, 0, 0 }` — full bleed. Typographic margins live inside `<main class="page">`.

## Temp file cleanup

```ts
} finally {
  await page.close().catch(() => undefined);
  await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
}
```

Always tolerate cleanup failures. On Windows, file locks can delay delete; we prefer a leak over an exception.

## Mermaid runtime (`mermaid-runtime.ts`)

### `resolveMermaidSrc()`

Returns the URL of the mermaid bundle. Tries:

1. `node_modules/mermaid/dist/mermaid.min.js`
2. `node_modules/mermaid/dist/mermaid.js`

Falls back to `https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js` if neither exists (e.g. when running the CLI from a not-yet-installed checkout).

### `buildMermaidScript(mode, design)`

Emits an inline `<script>` that:

1. Loads mermaid via the resolved `src`.
2. Initializes it with `startOnLoad: false`, `securityLevel: 'loose'`, `theme: 'base'`, and a `themeVariables` map.
3. Queries `.mermaid` nodes; if none, sets `window.__mermaidDone = Promise.resolve()` and returns.
4. Runs the preferred rendering API (`mermaid.run` on v10, fallback to `mermaid.init` on older) and resolves `window.__mermaidDone` when done.

Errors are caught and logged via `console.error` INSIDE Chromium (not Node). The pageerror forwarder in `pdf.ts` surfaces them.

### `applyDesignToMermaid(base, design, mode)`

Overlays the parsed DESIGN.md palette onto the mermaid themeVariables so diagrams match the active design. Mapping:

| PaletteTokens | mermaid themeVariable |
|---|---|
| `bgPage` | `background` |
| `bgSurface` | `primaryColor` |
| `textPrimary` | `primaryTextColor`, `noteTextColor` |
| `borderWarm` | `primaryBorderColor` |
| `textSecondary` | `lineColor`, `secondaryTextColor`, `tertiaryTextColor` |
| `borderSoft` | `secondaryColor`, `noteBkgColor` |
| `bgSand` | `tertiaryColor` |
| `fonts.sans` | `fontFamily` |

Unmapped slots keep Claude defaults. Extend this when adding a palette slot that should affect diagrams.

### Mermaid theme defaults

- **Light**: warm parchment/near-black palette derived from Claude tokens.
- **Dark**: near-black canvas, warm gray lines, light text.
- Font family: `'Anthropic Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif`.

These defaults ship inside `buildMermaidScript`. They are the fallback when NO design is loaded or when a design doesn't define a slot. Do not remove them.

## Concurrency

- A single `PdfRenderer` / `Browser` is shared across the pool in [src/converter.ts](src/converter.ts). Each file creates its own `page`.
- Do NOT launch a second browser for a per-file task. If you think you need one, you're probably working around a missing feature in `buildHtml`.

## Common tasks

### Adding a new Puppeteer option

- Modify `render()` in [src/pdf.ts](src/pdf.ts). Keep the documented invariants.
- If the option should be user-controllable, thread it through `ConvertOptions` (see [.cursor/instructions/add-cli-flag.md](.cursor/instructions/add-cli-flag.md)).
- Re-run `scripts/verify-fullbleed.js` in both modes.

### Fixing a blank mermaid diagram

- Check stderr for `[pdf] pageerror:` messages. Mermaid prints its syntax errors there.
- Verify `window.__mermaidDone` is still awaited in `pdf.ts`.
- Verify the `<div class="mermaid">` fence is emitted by [src/markdown.ts](src/markdown.ts).
- Check that `applyDesignToMermaid` isn't overriding a themeVariable with `undefined`.

### Fixing missing fonts (tofu)

- Verify `document.fonts.ready` await is intact.
- Verify KaTeX font rewrite in [src/template.ts](src/template.ts) `readKatexCss` resolves the right directory.
- For custom web fonts, ensure the `@font-face` source URL is a `file://` URL reachable from the temp HTML's directory.

### Fixing content clipped at page breaks

- Double rAF await still in place?
- Consider whether `base.css` / `print.css` need `page-break-inside: avoid` for the affected element.

## Gotchas

- `waitUntil: ['load', 'networkidle0']` — `networkidle0` waits for 500ms of no network activity. Our CDN fallback for mermaid can stretch this; keep the 60s timeout.
- `page.setContent` also accepts `waitUntil` but CANNOT load `file://` subresources. See the navigation section above.
- On Windows, `os.tmpdir()` may be on a different drive than the source `.md`. This is fine — `file://` URLs are absolute.
- `page.pdf` returns a `Uint8Array` on some Puppeteer versions; we wrap with `Buffer.from(buffer)` defensively. Keep the wrap.

## File pointers

- [src/pdf.ts](src/pdf.ts) — `PdfRenderer`, `RenderOptions`, `StageEmitter`.
- [src/mermaid-runtime.ts](src/mermaid-runtime.ts) — `resolveMermaidSrc`, `buildMermaidScript`, `applyDesignToMermaid`.
- [src/converter.ts](src/converter.ts) — consumer; owns the browser lifecycle.
- [src/template.ts](src/template.ts) — builds the HTML and `@page` chrome; emits `{mermaidScript}` at the end of the body.
- [scripts/verify-fullbleed.js](scripts/verify-fullbleed.js) — the visual-verification harness.
