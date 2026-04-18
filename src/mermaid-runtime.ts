import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import type { RenderMode } from './prompt';
import type { DesignTokens, PaletteTokens } from './design';

/**
 * Resolve the on-disk location of mermaid.min.js and return its file:// URL
 * so Puppeteer's `file://` page can load it without a network hop. Falls
 * back to a CDN if the local copy can't be found.
 */
export function resolveMermaidSrc(): string {
  try {
    const pkgJson = require.resolve('mermaid/package.json');
    const pkgDir = path.dirname(pkgJson);
    const candidates = [
      path.join(pkgDir, 'dist', 'mermaid.min.js'),
      path.join(pkgDir, 'dist', 'mermaid.js'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return pathToFileURL(candidate).href;
      }
    }
  } catch {
    /* fall through */
  }
  return 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
}

type ThemeVariables = Record<string, string>;

/**
 * Build the inline `<script>` that initializes mermaid inside the Puppeteer
 * page and exposes a promise `window.__mermaidDone` which resolves when all
 * diagrams have rendered. pdf.ts awaits this before calling `page.pdf()`.
 *
 * When `design` is provided, any palette slot present in the parsed tokens
 * overrides the corresponding mermaid themeVariable so diagrams stay on
 * the active DESIGN.md's palette. Unmapped slots keep the Claude defaults.
 */
export function buildMermaidScript(
  mode: RenderMode,
  design: DesignTokens | null = null
): string {
  const base: ThemeVariables =
    mode === 'dark'
      ? {
          background: '#141413',
          primaryColor: '#30302e',
          primaryTextColor: '#faf9f5',
          primaryBorderColor: '#3d3d3a',
          lineColor: '#b0aea5',
          secondaryColor: '#30302e',
          tertiaryColor: '#1d1d1b',
          secondaryTextColor: '#b0aea5',
          tertiaryTextColor: '#b0aea5',
          noteBkgColor: '#30302e',
          noteTextColor: '#faf9f5',
          fontFamily:
            "'Anthropic Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        }
      : {
          background: '#faf9f5',
          primaryColor: '#faf9f5',
          primaryTextColor: '#141413',
          primaryBorderColor: '#e8e6dc',
          lineColor: '#5e5d59',
          secondaryColor: '#f0eee6',
          tertiaryColor: '#e8e6dc',
          secondaryTextColor: '#5e5d59',
          tertiaryTextColor: '#5e5d59',
          noteBkgColor: '#f0eee6',
          noteTextColor: '#141413',
          fontFamily:
            "'Anthropic Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        };

  const themeVars = applyDesignToMermaid(base, design, mode);

  const src = resolveMermaidSrc();

  return `
<script src="${src}"></script>
<script>
(function () {
  if (typeof mermaid === 'undefined') {
    window.__mermaidDone = Promise.resolve();
    return;
  }
  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: ${JSON.stringify(themeVars)},
      flowchart: { htmlLabels: true, curve: 'basis' },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true }
    });
  } catch (e) {
    console.error('mermaid.initialize failed:', e);
  }
  var nodes = document.querySelectorAll('.mermaid');
  if (!nodes.length) { window.__mermaidDone = Promise.resolve(); return; }
  window.__mermaidDone = (async function () {
    try {
      if (typeof mermaid.run === 'function') {
        await mermaid.run({ nodes: nodes });
      } else if (typeof mermaid.init === 'function') {
        mermaid.init(undefined, nodes);
      }
    } catch (e) {
      console.error('mermaid render failed:', e);
    }
  })();
})();
</script>`;
}

/**
 * Overlay the active DESIGN.md palette onto the mermaid theme variables for
 * the current render mode. Only the slots we reliably parse are pushed --
 * anything missing keeps the Claude defaults (which themselves already work
 * with either light or dark).
 */
function applyDesignToMermaid(
  base: ThemeVariables,
  design: DesignTokens | null,
  mode: RenderMode
): ThemeVariables {
  if (!design) return base;
  const palette: PaletteTokens = mode === 'dark' ? design.dark : design.light;
  const out: ThemeVariables = { ...base };

  if (palette.bgPage) out.background = palette.bgPage;
  if (palette.bgSurface) out.primaryColor = palette.bgSurface;
  if (palette.textPrimary) {
    out.primaryTextColor = palette.textPrimary;
    out.noteTextColor = palette.textPrimary;
  }
  if (palette.borderWarm) out.primaryBorderColor = palette.borderWarm;
  if (palette.textSecondary) {
    out.lineColor = palette.textSecondary;
    out.secondaryTextColor = palette.textSecondary;
    out.tertiaryTextColor = palette.textSecondary;
  }
  if (palette.borderSoft) {
    out.secondaryColor = palette.borderSoft;
    out.noteBkgColor = palette.borderSoft;
  }
  if (palette.bgSand) out.tertiaryColor = palette.bgSand;

  if (design.fonts.sans) {
    out.fontFamily = `${design.fonts.sans}, 'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif`;
  }

  return out;
}
