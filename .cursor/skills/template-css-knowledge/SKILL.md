---
name: template-css-knowledge
description: Everything about how the full HTML document is assembled (src/template.ts) and the theme CSS layering order. Covers buildHtml, the readCss cache, KaTeX font-path rewrite, fonts.css/tokens.css/base.css/theme-*.css/highlight-*.css/print.css layering, :root and [data-mode="dark"] blocks, @page margin boxes for running chrome, cover/toc sections, page-break, full-bleed contract, and the interplay with design overrides and the accent shortcut. Use when editing the HTML shell, CSS themes, page chrome, or debugging a layering / specificity issue.
triggers: buildHtml, template.ts, themes.css, tokens.css, base.css, print.css, highlight-light.css, highlight-dark.css, @page, page chrome, running header, running footer, page numbers, full-bleed, KaTeX CSS, page break, cover page, toc, data-mode, CSS variable, --brand, --bg-page, readCss cache, paletteToCss, buildDesignOverride, buildPageChromeCss, escapeCssString
---

# Template & CSS

All HTML generation for the rendered PDF lives in [src/template.ts](src/template.ts). Every page's appearance is a deterministic function of `buildHtml(BuildHtmlOptions)` + the loaded theme CSS in [src/themes/](src/themes).

## Entry point: `buildHtml(opts)`

```ts
export function buildHtml(opts: BuildHtmlOptions): string
```

Returns a complete HTML document (starting with `<!DOCTYPE html>`) that Chromium loads via `page.goto(file://...)` in [src/pdf.ts](src/pdf.ts).

Options surface:

```ts
interface BuildHtmlOptions {
  bodyHtml: string;        // rendered markdown body
  title?: string;          // <title> + cover
  mode?: 'light' | 'dark';
  cover?: boolean;
  toc?: boolean;
  tocHtml?: string;        // pre-rendered by the second-pass TOC extract
  subtitle?: string;
  fileList?: string[];     // merge-mode cover list
  showLinkUrls?: boolean;  // body class toggles inline URL printing
  accent?: string | null;
  design?: DesignTokens | null;
  pageNumbers?: boolean;
  headerText?: string;     // tokens: {file} {title} {date}
  footerText?: string;
}
```

## Document shape

```html
<!DOCTYPE html>
<html lang="en" data-mode="{mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escaped title}</title>
<style>
  {tokens.css}
  {fonts.css}
  {base.css}
  {theme-light.css}
  {theme-dark.css}
  {highlight-light.css}
  {highlight-dark.css}
  {print.css}
  {katex.min.css (with rewritten font paths)}
  {designOverride}   /* :root { ... } + [data-mode="dark"] { ... } */
  {accentOverride}   /* :root { --brand, --brand-soft } */
  {pageChromeCss}    /* @page margin boxes */
</style>
</head>
<body>
  {coverHtml?}
  {tocSection?}
  <main class="page">
    <article class="markdown-body {show-link-urls?}">
      {bodyHtml}
    </article>
  </main>
  {mermaidScript}
</body>
</html>
```

Notes:

- `data-mode="light|dark"` on `<html>` is the selector every dark override uses.
- `<article class="markdown-body">` wraps the rendered body so all element styles can be scoped under that class and avoid bleeding into cover / toc.
- `{mermaidScript}` is appended AFTER the content, so diagrams parse once the DOM is built. See `pdf-pipeline-knowledge` for the runtime side.

## CSS layering order (source of truth)

Exact load order inside the `<style>` block:

1. `tokens.css` — `:root { --... }` + `[data-mode="dark"] { --... }` custom property declarations. **Only** the two root selectors belong here.
2. `fonts.css` — `@font-face` declarations.
3. `base.css` — every semantic element rule (`html`, `body`, `.markdown-body h1..h6`, `p`, `ul`, `ol`, `table`, `.admonition`, `.code-wrap`, `.cover`, `.toc`, `.page`, `.external-link`, etc.). All colors reference `var(--...)`.
4. `theme-light.css` / `theme-dark.css` — rare structural overrides that differ between modes (most work is already done via tokens).
5. `highlight-light.css` / `highlight-dark.css` — highlight.js palettes, both always loaded. The `[data-mode]` attribute selects which wins.
6. `print.css` — `@page` declarations, page-break behaviour, widow/orphan control.
7. KaTeX CSS — appended last, highest specificity.
8. `designOverride` — per-run `:root { ... }` + `[data-mode="dark"] { ... }` from the parsed DESIGN.md.
9. `accentOverride` — per-run `:root { --brand: X; --brand-soft: X; }` from `--accent`.
10. `pageChromeCss` — per-run `@page` overrides for running chrome.

Later declarations win ties. See [.cursor/instructions/add-theme-css-rule.md](.cursor/instructions/add-theme-css-rule.md) for where new rules belong.

## `readCss` cache

```ts
const cssCache = new Map<string, string>();
function readCss(name: string): string
```

Reads from `__dirname/themes/<name>` and caches for the process lifetime. Because [scripts/copy-assets.js](scripts/copy-assets.js) copies `src/themes/*` into `dist/themes/`, `__dirname/themes` resolves correctly at runtime. Do not move theme files without updating the copy step.

## KaTeX font URL rewrite (`readKatexCss`)

Reads `node_modules/katex/dist/katex.min.css`, then rewrites `url(fonts/...)` tokens into absolute `file://` URLs pointing at `node_modules/katex/dist/fonts/`. Without this rewrite, Chromium can't load the fonts from the `file://` temp HTML page and math renders as tofu.

If KaTeX changes its CSS path layout, update the regex AND verify math still renders via `samples/demo.md` in both modes.

## `buildDesignOverride(design)`

Maps a parsed `DesignTokens` (spec-compliant YAML) to a single `:root { ... }` CSS block of custom-property overrides. Implementation details:

- Colors: one `--color-<key>` per `colors` entry, plus canonical aliases (`--brand`, `--bg-surface`, `--text-primary`, `--border-soft`, etc.) for legacy selectors. See the `design-system-knowledge` skill for the full alias table.
- Typography: per-level vars `--type-<level>-family/size/weight/line/track`; the heading selectors in [src/themes/base.css](src/themes/base.css) read `h1`...`h6`, `body-md`, `body-lg`, `body-sm`, `code`, `label-md`.
- Rounded: `--rounded-<key>` plus legacy `--radius-sm/md/lg/xl` aliases.
- Spacing: `--spacing-<key>`, used by paragraph/list margins via `var()`.
- Components: `--component-<name>-<prop>` with `{token.path}` refs already resolved by the parser.
- `appendFallback` attaches a generic family cascade (Georgia / system-ui / JetBrains Mono) to any author-supplied fontFamily so the PDF renders even when the authored font isn't installed.
- Empty token groups emit nothing — no stray `:root { }` blocks.

## `buildPageChromeCss(opts)`

Emits `@page` margin boxes when ANY of `pageNumbers`, `headerText`, `footerText` is set. Key behaviours:

- Reserves a 14mm band on the affected edge (top for header, bottom for page numbers/footer). Consequence: that edge is no longer full bleed.
- Band background color matches the page canvas (`bandBg` is `#141413` in dark and `#f5f4ed` in light — these are INTENTIONALLY hardcoded here so the CSS remains valid even when a DESIGN.md hasn't named a canvas color).
- Text color is a muted gray (`#87867f` / `#b0aea5`).
- Uses `escapeCssString` to escape user-supplied header/footer text for a `content: "..."` declaration. Do not bypass this — it prevents CSS injection.
- Header/footer text tokens (`{file}`, `{title}`, `{date}`) are resolved BEFORE reaching `buildHtml` via `resolveHeaderTokens` in [src/converter.ts](src/converter.ts).
- Adds a `.page { padding-top / padding-bottom }` rule to keep body content clear of the band.

## `renderCover({ title, subtitle, fileList })`

Simple template producing:

```html
<section class="cover">
  <div class="cover__eyebrow">awesome-md-to-pdf</div>
  <h1 class="cover__title">...</h1>
  <p class="cover__subtitle">...</p>
  <hr class="cover__divider" />
  <div class="cover__meta"><strong>Generated</strong> date</div>
  <!-- merge-mode file list -->
</section>
```

Styled entirely by `.cover__*` rules in [src/themes/base.css](src/themes/base.css).

## Escaping helpers

- `escapeHtml(str)` — used for title, cover labels, file names. Escapes `& < > " '`.
- `escapeCssString(str)` — escapes `\ "` for `content: "..."` declarations.

ALWAYS escape any interpolated value. Never concatenate user-controlled strings into the HTML/CSS output raw.

## The full-bleed contract

- `html, body` fills the entire page with `--bg-page`.
- `<main class="page">` applies typographic padding (22mm top, 20mm right, 24mm bottom, 20mm left on A4 — defined in base.css).
- `@page { margin: 0 }` (implicit via `preferCSSPageSize: true` + the Puppeteer `margin: { 0, 0, 0, 0 }` call in [src/pdf.ts](src/pdf.ts)) lets the background reach the edge.
- Running chrome (page numbers/header/footer) explicitly opts out by reserving a band.

Any rule that introduces a white background on `html/body` or removes `printBackground: true` breaks full bleed.

## Interaction with --accent vs --design

- Both are additive. `--design` writes all known tokens; `--accent` overwrites `--brand` + `--brand-soft` on `:root` regardless of design.
- Use `--accent` as a quick-override. Use `--design` for comprehensive retheming.
- Neither touches tokens in the Claude baseline — they only emit additional CSS blocks that win by source order.

## Common tasks

### Add a new CSS rule

See [.cursor/instructions/add-theme-css-rule.md](.cursor/instructions/add-theme-css-rule.md). TL;DR: tokens.css has only `:root` + `[data-mode="dark"]`; all element/component rules go in `base.css`; `print.css` for anything page-break / `@page`.

### Add a new page-chrome option

Extend `BuildHtmlOptions` and `buildPageChromeCss`. Keep the 14mm band convention. Update [50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc) if it's user-visible.

### Debug a CSS specificity issue

- KaTeX CSS loads last and has high specificity — a bare `.markdown-body .katex` override may lose. Use `[data-mode] .markdown-body .katex` or similar.
- `designOverride` and `accentOverride` only declare custom properties; they don't create new selectors. If your component isn't picking up a design override, check that it uses `var(--...)` in base.css.

## Gotchas

- The theme CSS files are read relative to `__dirname`, which resolves to `dist/` at runtime. If the copy-assets step is skipped, `readCss` throws `ENOENT`. Always run `npm run build`, never just `tsc`.
- `[data-mode="dark"]` must be on `<html>` (not `body`) — selector specificity elsewhere assumes that.
- Adding a new asset CSS file: load it in `buildHtml` AND make sure it's inside `src/themes/` so `copy-assets.js` picks it up.
- `escapeCssString` does NOT escape newlines. If you accept user input that could contain newlines, split on `\n` before emitting.
- KaTeX's CSS font-path rewrite is naive (`url(fonts/...)`). If KaTeX changes to `url("fonts/...")` with quotes, the regex misses — update it.

## File pointers

- [src/template.ts](src/template.ts) — everything in this skill.
- [src/themes/](src/themes) — all CSS.
- [src/pdf.ts](src/pdf.ts) — consumer of the built HTML.
- [src/converter.ts](src/converter.ts) — calls `buildHtml`; resolves header/footer tokens.
- [docs/themes-and-modes.md](docs/themes-and-modes.md) — user-facing.
