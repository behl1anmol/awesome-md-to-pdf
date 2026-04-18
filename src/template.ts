import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildMermaidScript } from './mermaid-runtime';
import type { RenderMode } from './prompt';
import type { DesignTokens, PaletteTokens } from './design';

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
  /** A parsed DESIGN.md token set; any slot not set falls back to the Claude baseline. */
  design?: DesignTokens | null;
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
    design,
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

  const mermaidScript = buildMermaidScript(mode, design ?? null);

  const accentOverride = accent
    ? `:root { --brand: ${accent}; --brand-soft: ${accent}; }`
    : '';

  const designOverride = design ? buildDesignOverride(design) : '';

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
 * Map a parsed DESIGN.md token set to CSS custom-property overrides. Any
 * slot left undefined falls through to the Claude baseline defined in
 * `themes/tokens.css`. Emits two blocks: one for `:root` (light) and one
 * for `[data-mode="dark"]`.
 */
function buildDesignOverride(design: DesignTokens): string {
  const light = paletteToCss(design.light);
  const dark = paletteToCss(design.dark);

  const fontRules: string[] = [];
  if (design.fonts.serif) {
    fontRules.push(`--font-serif: ${appendFallback(design.fonts.serif, 'serif')};`);
  }
  if (design.fonts.sans) {
    fontRules.push(`--font-sans: ${appendFallback(design.fonts.sans, 'sans')};`);
  }
  if (design.fonts.mono) {
    fontRules.push(`--font-mono: ${appendFallback(design.fonts.mono, 'mono')};`);
  }

  const blocks: string[] = [];
  if (light.length || fontRules.length) {
    blocks.push(`:root { ${[...light, ...fontRules].join(' ')} }`);
  }
  if (dark.length) {
    blocks.push(`[data-mode="dark"] { ${dark.join(' ')} }`);
  }
  return blocks.join('\n');
}

function paletteToCss(palette: PaletteTokens): string[] {
  const out: string[] = [];
  const map: Array<[keyof PaletteTokens, string]> = [
    ['bgPage', '--bg-page'],
    ['bgSurface', '--bg-surface'],
    ['bgSand', '--bg-sand'],
    ['textPrimary', '--text-primary'],
    ['textSecondary', '--text-secondary'],
    ['textTertiary', '--text-tertiary'],
    ['brand', '--brand'],
    ['brandSoft', '--brand-soft'],
    ['borderSoft', '--border-soft'],
    ['borderWarm', '--border-warm'],
    ['codeBg', '--code-bg'],
    ['codeBorder', '--code-border'],
    ['codeInlineBg', '--code-inline-bg'],
    ['error', '--error'],
    ['focus', '--focus'],
  ];
  for (const [key, cssVar] of map) {
    const value = palette[key];
    if (value) out.push(`${cssVar}: ${value};`);
  }
  return out;
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

  // If the user's family already contains a comma (it's already a list),
  // just append the kind's generic fallback.
  if (trimmed.includes(',')) {
    return `${trimmed}, ${fallback}`;
  }
  return `${trimmed}, ${fallback}`;
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
