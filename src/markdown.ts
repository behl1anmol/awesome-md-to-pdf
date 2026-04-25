import path from 'path';
import { pathToFileURL } from 'url';
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token';
import type StateCore from 'markdown-it/lib/rules_core/state_core';
import type Renderer from 'markdown-it/lib/renderer';
import hljs from 'highlight.js';

import anchor from 'markdown-it-anchor';
import toc from 'markdown-it-toc-done-right';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import emoji from 'markdown-it-emoji';
import container from 'markdown-it-container';
import attrs from 'markdown-it-attrs';
import katex from '@vscode/markdown-it-katex';

export interface CreateMarkdownOptions {
  /** Absolute path to the source .md file (used to resolve relative images). */
  sourcePath?: string;
  /** Whether the TOC plugin should be active (it's always mounted; this is a future hook). */
  toc?: boolean;
}

/**
 * Build a configured markdown-it instance for a given source file. The
 * instance is per-file because image src paths are rewritten relative to
 * the .md file's directory.
 */
export function createMarkdown(opts: CreateMarkdownOptions = {}): MarkdownIt {
  const { sourcePath } = opts;

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight: highlightCode,
  });

  // Override the fenced-code renderer so ```mermaid emits a <div class="mermaid">
  // verbatim (not HTML-escaped). Other languages fall through to the default
  // markdown-it pipeline (our highlight function runs there).
  md.renderer.rules.fence = buildFenceRenderer();

  // Plugins
  md.use(anchor, {
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '',
      placement: 'before',
    }),
    slugify,
  });

  md.use(toc, {
    listType: 'ul',
    containerClass: 'toc',
    level: [1, 2, 3],
    slugify,
  });

  md.use(taskLists, { label: true, labelAfter: true });
  md.use(footnote);
  md.use(emoji.full);
  md.use(attrs);
  md.use(katex, { throwOnError: false, errorColor: '#b53333' });

  // Admonition containers: ::: note / tip / warning / danger
  for (const kind of ['note', 'tip', 'warning', 'danger'] as const) {
    md.use(container, kind, {
      render(tokens: Token[], idx: number): string {
        const token = tokens[idx];
        if (token.nesting === 1) {
          const info = token.info.trim().slice(kind.length).trim();
          const title = info || kind.charAt(0).toUpperCase() + kind.slice(1);
          return (
            `<div class="admonition ${kind}">` +
            `<p class="admonition-title">${md.utils.escapeHtml(title)}</p>\n`
          );
        }
        return '</div>\n';
      },
    });
  }

  // DESIGN.md component containers: ::: button-primary / chip / card / ...
  // Emits a <div class="component-<name>"> wrapper that the CSS in
  // themes/base.css styles via --component-<name>-* custom properties
  // emitted by src/template.ts from the parsed DESIGN.md.
  for (const comp of DESIGN_COMPONENT_KEYS) {
    md.use(container, comp, {
      render(tokens: Token[], idx: number): string {
        const token = tokens[idx];
        if (token.nesting === 1) {
          return `<div class="component-${comp}">\n`;
        }
        return '</div>\n';
      },
    });
  }

  overrideImageRenderer(md, sourcePath);
  overrideLinkRenderer(md);
  addComponentClassesToTaskLists(md);

  return md;
}

/**
 * Component keys the spec recognizes. Each gets a `::: <key>` fenced
 * container registered on the markdown-it instance. Unknown components
 * listed in a DESIGN.md still emit --component-<name>-* CSS vars via
 * src/template.ts, but don't get a markdown shortcut.
 */
const DESIGN_COMPONENT_KEYS = [
  'button-primary',
  'button-secondary',
  'button-tertiary',
  'chip',
  'card',
  'badge',
  'tooltip',
  'input-field',
  'list-item',
] as const;

/**
 * Tack `.component-checkbox` onto task-list checkboxes so DESIGN.md's
 * `components.checkbox` styling (accent-color via --component-checkbox-*)
 * takes effect. markdown-it-task-lists already emits the checkbox input;
 * this post-processes the rendered HTML with a minimal core rule so we
 * don't need to fork the plugin.
 */
function addComponentClassesToTaskLists(md: MarkdownIt): void {
  const defaultHtmlInlineRender =
    md.renderer.rules.html_inline ??
    ((tokens, idx, _opts, _env, self) => self.renderToken(tokens, idx, _opts));

  md.renderer.rules.html_inline = function (tokens, idx, options, env, self): string {
    const token = tokens[idx];
    // markdown-it-task-lists emits `<input …>` as html_inline when `label: true`.
    if (
      token.content.startsWith('<input') &&
      token.content.includes('task-list-item-checkbox') &&
      !token.content.includes('component-checkbox')
    ) {
      token.content = token.content.replace(
        /class="([^"]*)task-list-item-checkbox([^"]*)"/,
        'class="$1task-list-item-checkbox component-checkbox$2"'
      );
    }
    return defaultHtmlInlineRender(tokens, idx, options, env, self);
  };
}

/**
 * Slugify with a slightly gentler ruleset than markdown-it-anchor's default,
 * preserving hyphens and lowercasing.
 */
export function slugify(str: string): string {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^a-z0-9_\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * highlight.js wrapper used by markdown-it. Returns the inner <code> HTML;
 * the surrounding <pre> is produced by our fence renderer so we can add the
 * language chip and break-inside wrapper.
 */
function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      /* fall through */
    }
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fence renderer that:
 *   - emits ```mermaid blocks verbatim as <div class="mermaid">
 *   - wraps every other fenced block in a .code-wrap with a language chip
 */
function buildFenceRenderer(): Renderer.RenderRule {
  return function fence(tokens, idx): string {
    const token = tokens[idx];
    const info = (token.info || '').trim();
    const lang = info.split(/\s+/, 1)[0] || '';
    const content = token.content;

    if (lang === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(content)}</div>\n`;
    }

    const highlighted = lang ? highlightCode(content, lang) : escapeHtml(content);
    const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
    const codeClass = lang ? `hljs language-${escapeHtml(lang)}` : 'hljs';

    return (
      `<div class="code-wrap">${langLabel}` +
      `<pre><code class="${codeClass}">${highlighted}</code></pre>` +
      `</div>\n`
    );
  };
}

/**
 * Rewrite relative image sources to absolute file:// URLs so Puppeteer loads
 * local assets referenced by the .md file.
 */
function overrideImageRenderer(md: MarkdownIt, sourcePath: string | undefined): void {
  const baseDir = sourcePath ? path.dirname(sourcePath) : process.cwd();
  const defaultImage: Renderer.RenderRule =
    md.renderer.rules.image ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.image = function (tokens, idx, options, env, self): string {
    const token = tokens[idx];
    const srcIdx = token.attrIndex('src');
    if (srcIdx >= 0 && token.attrs) {
      const src = token.attrs[srcIdx][1];
      if (src && !isAbsoluteUrl(src)) {
        const absolute = path.resolve(baseDir, src);
        token.attrs[srcIdx][1] = pathToFileURL(absolute).href;
      }
    }
    return defaultImage(tokens, idx, options, env, self);
  };
}

function isAbsoluteUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//') || src.startsWith('data:');
}

/**
 * Mark external (http/https) links with a .external-link class and open in
 * a new tab (harmless in PDF, but preserved when HTML is reused).
 */
function overrideLinkRenderer(md: MarkdownIt): void {
  const defaultLinkOpen: Renderer.RenderRule =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = function (tokens, idx, options, env, self): string {
    const token = tokens[idx];
    const hrefIdx = token.attrIndex('href');
    if (hrefIdx >= 0 && token.attrs) {
      const href = token.attrs[hrefIdx][1] || '';
      if (/^https?:\/\//i.test(href)) {
        const classIdx = token.attrIndex('class');
        if (classIdx < 0) {
          token.attrPush(['class', 'external-link']);
        } else {
          token.attrs[classIdx][1] = (token.attrs[classIdx][1] + ' external-link').trim();
        }
        if (token.attrIndex('target') < 0) {
          token.attrPush(['target', '_blank']);
        }
        if (token.attrIndex('rel') < 0) {
          token.attrPush(['rel', 'noopener noreferrer']);
        }
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
}

/**
 * Extract the first H1 text from a raw markdown source, for use as the
 * document title / cover title. Returns null if not found.
 */
export function extractTitle(source: string): string | null {
  const match = source.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : null;
}

// Re-export to appease unused import checks when consumer uses StateCore types
export type { Token, StateCore };
