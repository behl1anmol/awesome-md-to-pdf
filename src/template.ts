import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildMermaidScript } from './mermaid-runtime';
import type { RenderMode } from './prompt';
import type { DesignTokens, Typography } from './design';

const THEMES_DIR = path.join(__dirname, 'themes');

/** Cached CSS strings so we don't re-read on every file. */
const cssCache = new Map<string, string>();

function readCss(name: string): string {
  const cached = cssCache.get(name);
  if (cached !== undefined) return cached;
  const filePath = path.join(THEMES_DIR, name);
  const css = fs.readFileSync(filePath, 'utf8');
  cssCache.set(name, css);
  return css;
}

/**
 * Locate the KaTeX stylesheet bundled inside the `katex` npm package, and
 * rewrite its relative font URLs to absolute file:// so Puppeteer can load
 * them.
 */
function readKatexCss(): string {
  const cached = cssCache.get('__katex__');
  if (cached !== undefined) return cached;
  try {
    const katexPkg = require.resolve('katex/package.json');
    const css = fs.readFileSync(
      path.join(path.dirname(katexPkg), 'dist', 'katex.min.css'),
      'utf8'
    );
    const fontDir = path.join(path.dirname(katexPkg), 'dist', 'fonts');
    const rewritten = css.replace(/url\(fonts\/([^)]+)\)/g, (_match, f: string) => {
      return `url(${pathToFileURL(path.join(fontDir, f)).href})`;
    });
    cssCache.set('__katex__', rewritten);
    return rewritten;
  } catch {
    return '';
  }
}

export interface BuildHtmlOptions {
  /** Rendered markdown HTML. */
  bodyHtml: string;
  /** Document title (for <title> + cover). */
  title?: string;
  /** Render mode. */
  mode?: RenderMode;
  /** Emit a cover page section. */
  cover?: boolean;
  /** Emit a table-of-contents section. */
  toc?: boolean;
  /** Pre-rendered TOC HTML (from markdown-it-toc-done-right). */
  tocHtml?: string;
  /** Subtitle for the cover. */
  subtitle?: string;
  /** File list for the cover (single-file merge mode). */
  fileList?: string[];
  /** Print external URLs after link text. */
  showLinkUrls?: boolean;
  /** Override the Terracotta brand accent (hex). Shortcut for a design override of just --brand. */
  accent?: string | null;
  /** Parsed light-mode DESIGN.md tokens; any slot not set falls back to the Claude baseline. */
  designLight?: DesignTokens | null;
  /** Parsed dark-mode DESIGN.md tokens; any slot not set falls back to the Claude baseline. */
  designDark?: DesignTokens | null;
  /** Whether to show page numbers via @page margin boxes. */
  pageNumbers?: boolean;
  /** Custom header text (adds a band). */
  headerText?: string;
  /** Custom footer text (adds a band). */
  footerText?: string;
}

/**
 * Build the full HTML document fed to Puppeteer.
 */
export function buildHtml(opts: BuildHtmlOptions): string {
  const {
    bodyHtml,
    title = 'Document',
    mode = 'light',
    cover = false,
    toc: wantToc = false,
    tocHtml = '',
    subtitle = '',
    fileList = [],
    showLinkUrls = false,
    accent,
    designLight,
    designDark,
  } = opts;

  const tokens = readCss('tokens.css');
  const base = readCss('base.css');
  const fonts = readCss('fonts.css');
  const themeLight = readCss('theme-light.css');
  const themeDark = readCss('theme-dark.css');
  const hlLight = readCss('highlight-light.css');
  const hlDark = readCss('highlight-dark.css');
  const printCss = readCss('print.css');
  const katexCss = readKatexCss();

  const activeDesign = mode === 'dark' ? (designDark ?? null) : (designLight ?? null);
  const mermaidScript = buildMermaidScript(mode, activeDesign);

  const accentOverride = accent
    ? `:root { --brand: ${accent}; --brand-soft: ${accent}; }`
    : '';

  const designOverride = buildDesignOverrides({ designLight, designDark });

  const bodyClass = ['markdown-body', showLinkUrls ? 'show-link-urls' : '']
    .filter(Boolean)
    .join(' ');

  const coverHtml = cover ? renderCover({ title, subtitle, fileList }) : '';
  const tocSection =
    wantToc && tocHtml
      ? `<section class="toc-page"><h2>Contents</h2>${tocHtml}</section>`
      : '';

  const pageChromeCss = buildPageChromeCss(opts);

  return `<!DOCTYPE html>
<html lang="en" data-mode="${mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${tokens}
${fonts}
${base}
${themeLight}
${themeDark}
${hlLight}
${hlDark}
${printCss}
${katexCss}
${designOverride}
${accentOverride}
${pageChromeCss}
</style>
</head>
<body>
${coverHtml}
${tocSection}
<main class="page">
<article class="${bodyClass}">
${bodyHtml}
</article>
</main>
${mermaidScript}
</body>
</html>`;
}

interface CoverData {
  title: string;
  subtitle: string;
  fileList: string[];
}

function renderCover({ title, subtitle, fileList }: CoverData): string {
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const files =
    fileList && fileList.length
      ? `<div class="cover__meta"><strong>Includes</strong></div>
         <ul class="cover__files">${fileList
           .map((f) => `<li>${escapeHtml(f)}</li>`)
           .join('')}</ul>`
      : '';

  return `
<section class="cover">
  <div class="cover__eyebrow">awesome-md-to-pdf</div>
  <h1 class="cover__title">${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="cover__subtitle">${escapeHtml(subtitle)}</p>` : ''}
  <hr class="cover__divider" />
  <div class="cover__meta">
    <strong>Generated</strong> ${escapeHtml(today)}
  </div>
  ${files}
</section>`;
}

/**
 * If the caller asked for running page chrome (page numbers, header text, or
 * footer text), inject CSS Paged Media @page margin boxes. Each enabled edge
 * reserves a 14mm band which will appear as the page background color plus
 * the configured text. Chromium headless supports the @top and @bottom
 * margin boxes natively via the CSS Paged Media Module.
 */
function buildPageChromeCss(opts: BuildHtmlOptions): string {
  const { pageNumbers = false, headerText, footerText, mode = 'light' } = opts;

  if (!pageNumbers && !headerText && !footerText) return '';

  const bandBg = mode === 'dark' ? '#141413' : '#f5f4ed';
  const bandFg = mode === 'dark' ? '#b0aea5' : '#87867f';

  const topMargin = headerText ? '14mm' : '0';
  const bottomMargin = pageNumbers || footerText ? '14mm' : '0';

  const topRight = headerText
    ? `@top-right { content: "${escapeCssString(headerText)}"; color: ${bandFg}; font-family: "Inter", system-ui, "Segoe UI", Arial, sans-serif; font-size: 8pt; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase; padding: 8mm 20mm 0 0; background: ${bandBg}; }`
    : '';

  let bottomCenter = '';
  let bottomRight = '';
  if (footerText) {
    bottomCenter = `@bottom-center { content: "${escapeCssString(footerText)}"; color: ${bandFg}; font-family: "Inter", system-ui, "Segoe UI", Arial, sans-serif; font-size: 8pt; padding: 0 20mm 8mm 20mm; background: ${bandBg}; }`;
  }
  if (pageNumbers) {
    bottomRight = `@bottom-right { content: counter(page) " / " counter(pages); color: ${bandFg}; font-family: "Inter", system-ui, "Segoe UI", Arial, sans-serif; font-size: 8pt; padding: 0 20mm 8mm 0; background: ${bandBg}; }`;
  }

  return `
@page {
  margin-top: ${topMargin};
  margin-right: 0;
  margin-bottom: ${bottomMargin};
  margin-left: 0;
  background: ${bandBg};
  ${topRight}
  ${bottomCenter}
  ${bottomRight}
}

${headerText ? '.page { padding-top: 8mm; }' : ''}
${pageNumbers || footerText ? '.page { padding-bottom: 10mm; }' : ''}
`;
}

/**
 * Map a parsed DESIGN.md token set to CSS custom-property overrides.
 *
 * Emits five families of variables, all on `:root` because the spec doesn't
 * distinguish light/dark at the token level (dark mode is re-rendered from
 * whatever the author shipped):
 *
 *   --color-<key>          per entry in `colors`
 *   --type-<level>-*       per entry in `typography` (family/size/weight/line/track)
 *   --rounded-<key>        per entry in `rounded`
 *   --spacing-<key>        per entry in `spacing`
 *   --component-<name>-*   per property in `components` (refs pre-resolved)
 *
 * Legacy aliases (`--brand`, `--text-primary`, `--bg-page`, …) are also
 * emitted so existing CSS selectors continue to render without touching
 * base.css. The mapping is intentionally opinionated because the spec's
 * token names (primary/secondary/tertiary/neutral/surface/on-surface/outline)
 * must still drive a PDF theme.
 */
function buildDesignOverrides(opts: {
  designLight?: DesignTokens | null;
  designDark?: DesignTokens | null;
}): string {
  const blocks: string[] = [];
  if (opts.designLight) {
    blocks.push(buildDesignOverride(':root', opts.designLight));
  }
  if (opts.designDark) {
    blocks.push(buildDesignOverride('[data-mode="dark"]', opts.designDark));
  }
  return blocks.join('\n');
}

function buildDesignOverride(selector: string, design: DesignTokens): string {
  const decls: string[] = [];

  // --- colors ---------------------------------------------------------------
  for (const [k, v] of Object.entries(design.colors)) {
    decls.push(`--color-${k}: ${v};`);
  }

  // Canonical role aliases. Only write an alias if the author shipped the
  // source token; otherwise the Claude baseline in themes/tokens.css stays
  // in effect for that legacy var.
  const ALIAS_MAP: Array<[string, string]> = [
    ['primary', '--brand'],
    ['tertiary', '--brand-soft'],
    ['error', '--error'],
    ['surface', '--bg-surface'],
    ['on-surface', '--text-primary'],
    ['on-surface-variant', '--text-secondary'],
    ['outline', '--border-soft'],
    ['outline-variant', '--border-warm'],
    ['neutral', '--bg-page'],
    ['background', '--bg-page'],
    ['on-background', '--text-primary'],
  ];
  for (const [src, dst] of ALIAS_MAP) {
    if (design.colors[src]) decls.push(`${dst}: ${design.colors[src]};`);
  }

  // A few compound inferences: when the author didn't provide one of the
  // secondary-tier roles, fall back to the best available token. This keeps
  // text/background contrast sane across fixtures that only define a
  // primary/neutral pair.
  if (!design.colors['surface'] && design.colors['neutral']) {
    decls.push(`--bg-surface: ${design.colors['neutral']};`);
  }
  if (!design.colors['on-surface'] && design.colors['neutral']) {
    // Very crude: treat neutral as background and pick primary for text.
    const primary = design.colors['primary'];
    if (primary) decls.push(`--text-primary: ${primary};`);
  }

  // Code-surface fallbacks built from surface/outline so fenced code blocks
  // don't jump off the palette.
  if (design.colors['surface']) {
    decls.push(`--code-bg: ${design.colors['surface']};`);
    decls.push(`--code-inline-bg: ${design.colors['surface']};`);
  }
  if (design.colors['outline-variant']) {
    decls.push(`--code-border: ${design.colors['outline-variant']};`);
  } else if (design.colors['outline']) {
    decls.push(`--code-border: ${design.colors['outline']};`);
  }

  // --- typography ----------------------------------------------------------
  // Emit per-level CSS vars so base.css can pick them up. Also set
  // --font-sans / --font-serif / --font-mono from the first matching level
  // so fallbacks still land where base.css expects them.
  const fontSans = pickFontFamily(design.typography, ['body-md', 'body-lg', 'body', 'body-sm']);
  const fontSerif = pickFontFamily(design.typography, [
    'headline-xl',
    'headline-lg',
    'headline-md',
    'headline',
    'display-lg',
    'display',
    'h1',
  ]);
  const fontMono = pickFontFamily(design.typography, [
    'code',
    'mono',
    'label-caps',
    'label-md',
    'label-sm',
  ]);

  if (fontSans) decls.push(`--font-sans: ${appendFallback(fontSans, 'sans')};`);
  if (fontSerif) decls.push(`--font-serif: ${appendFallback(fontSerif, 'serif')};`);
  if (fontMono) decls.push(`--font-mono: ${appendFallback(fontMono, 'mono')};`);

  for (const [level, typo] of Object.entries(design.typography)) {
    decls.push(...typographyToCssVars(`--type-${level}`, typo));
  }

  // --- rounded -------------------------------------------------------------
  for (const [k, v] of Object.entries(design.rounded)) {
    decls.push(`--rounded-${k}: ${v};`);
  }
  // Legacy --radius-* aliases for existing base.css selectors (sm/md/lg/xl).
  const RADIUS_LEVELS: Array<[string, string]> = [
    ['sm', '--radius-sm'],
    ['md', '--radius-md'],
    ['lg', '--radius-lg'],
    ['xl', '--radius-xl'],
  ];
  for (const [k, dst] of RADIUS_LEVELS) {
    if (design.rounded[k]) decls.push(`${dst}: ${design.rounded[k]};`);
  }

  // --- spacing -------------------------------------------------------------
  for (const [k, v] of Object.entries(design.spacing)) {
    const val = typeof v === 'number' ? `${v}px` : v;
    decls.push(`--spacing-${k}: ${val};`);
  }

  // --- components ----------------------------------------------------------
  const COMP_PROP_MAP: Record<string, string> = {
    backgroundColor: 'bg',
    textColor: 'fg',
    typography: 'typography',
    rounded: 'rounded',
    padding: 'padding',
    size: 'size',
    height: 'height',
    width: 'width',
    borderColor: 'border-color',
    borderWidth: 'border-width',
  };
  for (const [compName, props] of Object.entries(design.components)) {
    for (const [prop, val] of Object.entries(props)) {
      const suffix = COMP_PROP_MAP[prop] ?? prop.toLowerCase();
      decls.push(`--component-${compName}-${suffix}: ${val};`);
    }
  }

  if (decls.length === 0) return '';
  return `${selector} {\n  ${decls.join('\n  ')}\n}`;
}

/**
 * Emit all CSS vars for a typography token at the given base name.
 * Example base "--type-h1" produces --type-h1-family, -size, -weight, etc.
 */
function typographyToCssVars(base: string, t: Typography): string[] {
  const out: string[] = [];
  if (t.fontFamily) out.push(`${base}-family: ${appendFallback(t.fontFamily, inferFontKindFromBase(base))};`);
  if (t.fontSize) out.push(`${base}-size: ${t.fontSize};`);
  if (t.fontWeight != null) out.push(`${base}-weight: ${t.fontWeight};`);
  if (t.lineHeight != null) out.push(`${base}-line: ${t.lineHeight};`);
  if (t.letterSpacing) out.push(`${base}-track: ${t.letterSpacing};`);
  if (t.fontFeature) out.push(`${base}-feature: ${t.fontFeature};`);
  if (t.fontVariation) out.push(`${base}-variation: ${t.fontVariation};`);
  return out;
}

/**
 * Guess the font-fallback bucket for a typography level based on its name.
 * Headlines & displays -> serif; labels/code -> mono; everything else -> sans.
 */
function inferFontKindFromBase(base: string): 'serif' | 'sans' | 'mono' {
  const name = base.replace(/^--type-/, '');
  if (/^(headline|display|h[1-6])/i.test(name)) return 'serif';
  if (/(label|code|mono|caption|overline)/i.test(name)) return 'mono';
  return 'sans';
}

/**
 * Return the first typography.fontFamily defined across the given level
 * names, in order. Used to derive --font-sans/--font-serif/--font-mono
 * from the YAML.
 */
function pickFontFamily(
  typography: Record<string, Typography>,
  candidates: string[]
): string | null {
  for (const name of candidates) {
    const t = typography[name];
    if (t && t.fontFamily) return t.fontFamily;
  }
  // Fallback: any typography level whose name starts with the same category.
  for (const [lvl, t] of Object.entries(typography)) {
    const c = candidates[0];
    if (c && lvl.startsWith(c.split('-')[0]) && t.fontFamily) return t.fontFamily;
  }
  return null;
}

/**
 * Append a sensible fallback cascade so the designer's primary family
 * degrades gracefully if it isn't installed on the system.
 */
function appendFallback(family: string, kind: 'serif' | 'sans' | 'mono'): string {
  const trimmed = family.trim();
  const fallback =
    kind === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : kind === 'sans'
      ? 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif'
      : '"JetBrains Mono", "Fira Code", Consolas, Menlo, monospace';

  // Quote family names with spaces so CSS treats them atomically.
  const normalized = /\s/.test(trimmed) && !/^['"]/.test(trimmed) && !trimmed.includes(',')
    ? `"${trimmed}"`
    : trimmed;
  return `${normalized}, ${fallback}`;
}

function escapeCssString(str: string): string {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
