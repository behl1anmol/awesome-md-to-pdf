---
name: markdown-pipeline-knowledge
description: Comprehensive knowledge of the markdown-it pipeline in awesome-md-to-pdf. Covers createMarkdown, every loaded plugin, the custom fence renderer (mermaid passthrough + code-wrap), image URL rewriting to file://, external-link marking, slugify, extractTitle, and the TOC second-pass strategy. Use when adding a markdown feature, fixing a parse bug, or understanding how .md becomes HTML.
triggers: markdown-it, markdown plugin, fence renderer, admonition, toc, anchor, task list, footnote, katex, emoji, attrs, slugify, extractTitle, image rewrite, external link, code highlight, highlight.js, container, :::, extractTitle
---

# Markdown pipeline

The markdown -> HTML transformation for awesome-md-to-pdf lives entirely in [src/markdown.ts](src/markdown.ts). It's a `markdown-it` instance configured with a deliberate plugin stack plus three custom renderer overrides. This skill covers every moving part.

## Entry point: `createMarkdown(opts)`

```ts
export function createMarkdown(opts: CreateMarkdownOptions = {}): MarkdownIt
```

- `opts.sourcePath` (optional, absolute path to the `.md` file) — used by the image renderer override to resolve relative `src="..."` attributes to `file://` URLs. Omit only if the markdown contains no relative image references.
- `opts.toc` — currently unused hook; the TOC plugin is always mounted.

Called once per file in [src/converter.ts](src/converter.ts) (`renderMarkdown`) because image resolution is file-scoped. DO NOT cache the instance across files.

## Base markdown-it config

```ts
new MarkdownIt({
  html: true,            // allow raw HTML blocks
  linkify: true,         // autolink bare URLs
  typographer: true,     // smart quotes, dashes
  breaks: false,         // GFM-style hard breaks OFF; editorial feel
  highlight: highlightCode,
});
```

`breaks: false` is intentional — this is long-form editorial typography, not chat.

## Plugin stack (order-sensitive)

Applied in this exact order by `createMarkdown`:

1. `markdown-it-anchor` with `permalink.linkInsideHeader` — produces `<h2 id="...">...</h2>` with an empty-text anchor link INSIDE the heading so CSS can skip it. Uses the local `slugify`.
2. `markdown-it-toc-done-right` — emits `<nav class="toc">...</nav>` wherever `[[toc]]` appears. Configured with `listType: 'ul'`, `level: [1,2,3]`, and the same `slugify`. Levels 4+ intentionally excluded to keep the TOC skimmable.
3. `markdown-it-task-lists` — GFM task lists with `{label: true, labelAfter: true}` so clicks target the full line.
4. `markdown-it-footnote`.
5. `markdown-it-emoji` — `:sparkles:` etc.
6. `markdown-it-attrs` — `{.class #id key=val}` block/inline attributes.
7. `@vscode/markdown-it-katex` — `$x$` inline, `$$...$$` display math; `throwOnError: false`, `errorColor: '#b53333'`.
8. Admonition containers via `markdown-it-container`: `note`, `tip`, `warning`, `danger`. Each emits `<div class="admonition note">...</div>` with an optional title (`::: note Some Title`).

**Ordering rationale**: anchor + toc must bind heading IDs before any plugin that cares about them; attrs runs before katex so custom classes don't eat dollar signs; katex runs last among block-parsing plugins so math tokens aren't consumed by others.

## Custom renderer overrides

After plugins load, `createMarkdown` replaces three renderer rules. All overrides capture the default renderer and fall back to it — follow this pattern for any new override.

### 1. Fence renderer (`md.renderer.rules.fence`)

Built by `buildFenceRenderer()`. Branches:

- `lang === 'mermaid'`: emits `<div class="mermaid">ESCAPED_SOURCE</div>` verbatim. The mermaid runtime (see [src/mermaid-runtime.ts](src/mermaid-runtime.ts) and `pdf-pipeline-knowledge`) picks these up inside Chromium. Escaping prevents XSS-style injection via diagram source.
- any other language: wraps the highlighted code in `<div class="code-wrap"><span class="code-lang">LANG</span><pre><code class="hljs language-LANG">...</code></pre></div>`. The language chip is CSS-positioned.
- no language: highlight.js auto-detects via `highlightAuto`. Class list is just `hljs`.

### 2. Image renderer (`md.renderer.rules.image`)

`overrideImageRenderer(md, sourcePath)` rewrites non-absolute `src` attributes to `file://` URLs using `path.resolve(baseDir, src)` + `pathToFileURL`. `baseDir` is the directory of `sourcePath`, or `process.cwd()` if unset. `isAbsoluteUrl` allows protocols (`http:`, `https:`, `file:`, etc.), protocol-relative `//`, and `data:` URIs through untouched.

This is why relative image references in source markdown "just work" in the PDF — Chromium needs an absolute `file://` to fetch them.

### 3. Link renderer (`md.renderer.rules.link_open`)

`overrideLinkRenderer(md)` marks external links (`http://`, `https://`) with:

- class `external-link` (used by [src/themes/base.css](src/themes/base.css) to add the `↗` glyph and brand accent).
- `target="_blank"` and `rel="noopener noreferrer"`.

The `.show-link-urls` body class (set when `--show-link-urls` is passed) triggers a CSS rule that appends the URL after the link text for offline readability.

## Syntax highlighting (`highlightCode`)

- First tries `hljs.getLanguage(lang)` + `hljs.highlight(code, { language: lang, ignoreIllegals: true })`.
- On unknown language: `hljs.highlightAuto(code)`.
- On failure: `escapeHtml(code)` (plain text).

Returns the INNER `<code>` HTML only — the surrounding `<pre>` is produced by the fence renderer so it can add `.code-wrap` and the language chip.

Syntax palettes: warm-toned, defined in [src/themes/highlight-light.css](src/themes/highlight-light.css) and [src/themes/highlight-dark.css](src/themes/highlight-dark.css). Both are always loaded; the active one is selected via the `[data-mode]` attribute on `<html>`.

## `slugify(str)` — heading IDs

```ts
export function slugify(str: string): string
```

Lowercase, spaces/`\u3000` -> `-`, strip everything outside `[a-z0-9_-]`, collapse runs of `-`, trim leading/trailing `-`. Used by both `anchor` and `toc` so heading IDs match TOC links exactly.

## `extractTitle(source)` — cover / filename title

First `^#\s+(.+)$` match. Returns `null` if no H1. Consumers fall back to `path.basename(file, '.md')`.

## TOC rendering: two-pass trick

`markdown-it-toc-done-right` only inserts the TOC at `[[toc]]` markers. The converter doesn't require users to add `[[toc]]` — it uses a second render pass in `renderMarkdown` ([src/converter.ts](src/converter.ts)):

1. First pass: render the source normally -> body HTML.
2. If `wantToc`, render `'[[toc]]\n\n' + source` and extract the `<nav class="toc">...</nav>` block via regex.
3. Feed both into `buildHtml` which places the TOC on its own `<section class="toc-page">`.

This avoids muddying user markdown with a `[[toc]]` marker and lets `--toc` behave as a pure flag.

## Merge mode (single-file)

For `--single-file` / `/single` mode, [src/converter.ts](src/converter.ts) `convertMerged`:

- Reads every `.md`, extracts per-file titles.
- Renders each piece with its OWN `markdown-it` instance (important: image paths differ per file).
- Inserts `<div class="page-break"></div>` between pieces. Styled in [src/themes/base.css](src/themes/base.css) to force a page break in the PDF.
- Probes a merged TOC by running `[[toc]]\n\n` + merged source through a markdown-it instance rooted at the first file's path.

## Common tasks

### Adding a new plugin

See [.cursor/instructions/add-markdown-feature.md](.cursor/instructions/add-markdown-feature.md). Key points:

- Decide the insertion point in the plugin stack. Anchor/TOC/admonitions first, katex last, attrs before katex.
- If the plugin needs per-file state, consume `sourcePath` inside `createMarkdown`.
- Add CSS for any new HTML element in [src/themes/base.css](src/themes/base.css) using design tokens.

### Adding a new admonition kind

Extend the loop over `['note', 'tip', 'warning', 'danger']` in `createMarkdown`. Add a matching CSS block in [src/themes/base.css](src/themes/base.css) under the `.admonition.<kind>` selector. Update [docs/markdown-features.md](docs/markdown-features.md).

### Overriding another renderer rule

Follow the pattern:

```ts
const defaultX: Renderer.RenderRule =
  md.renderer.rules.X ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.X = function (tokens, idx, options, env, self): string {
  // ...mutate or delegate...
  return defaultX(tokens, idx, options, env, self);
};
```

Always fall back to the default for any case you don't handle.

## Gotchas

- `html: true` means raw HTML in markdown is emitted verbatim. We rely on this for `<div class="page-break"></div>` in merge mode. Don't sanitize or disable it.
- `linkify: true` autolinks bare URLs; the `link_open` override still marks them external. If you add a new link type, extend the regex in `overrideLinkRenderer`.
- The anchor plugin's `permalink.linkInsideHeader` inserts an empty `<a>` *inside* the `<h*>`. `base.css` hides it for print. Do not switch to `headerLink` — the CSS breaks.
- KaTeX injects its CSS separately (loaded by [src/template.ts](src/template.ts) via `readKatexCss`). New KaTeX versions may change selectors; when upgrading, visually verify math in dark mode.
- `escapeHtml` in this module is LOCAL to `markdown.ts`. There's a separate one in [src/template.ts](src/template.ts). They intentionally differ in scope; don't consolidate without understanding why.

## File pointers

- [src/markdown.ts](src/markdown.ts) — everything in this skill.
- [src/converter.ts](src/converter.ts) — callers of `createMarkdown` + TOC second pass.
- [src/template.ts](src/template.ts) — CSS wrap + body class `show-link-urls`.
- [src/themes/base.css](src/themes/base.css) — CSS for every emitted element.
- [src/types/shims.d.ts](src/types/shims.d.ts) — ambient declarations for untyped plugins.
- [docs/markdown-features.md](docs/markdown-features.md) — user-facing feature list.
