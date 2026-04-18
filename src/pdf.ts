import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import puppeteer, { type Browser, type PaperFormat } from 'puppeteer';

export interface RenderOptions {
  /** Full HTML document to print. */
  html: string;
  /** Puppeteer-accepted page format. */
  format?: PaperFormat;
  /** Optional progress reporter; `stage()` is emitted at natural boundaries. */
  progress?: StageEmitter;
}

/**
 * Minimal interface pdf.ts needs from the progress reporter. Defined
 * structurally so we avoid a circular import with progress.ts.
 */
export interface StageEmitter {
  stage(stage: 'browser' | 'render' | 'write'): void;
}

/**
 * Thin wrapper around a puppeteer browser -- launched once per run and
 * reused across files.
 */
export class PdfRenderer {
  private browser: Browser | null = null;

  async launch(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Render a full HTML document to a PDF buffer. The HTML must carry all
   * styling + mermaid runtime inline. Puppeteer's header/footer strips are
   * disabled -- running headers/footers are produced by CSS Paged Media
   * `@page` margin boxes in the HTML itself (see template.ts).
   */
  async render(opts: RenderOptions): Promise<Buffer> {
    const { html, format = 'A4', progress } = opts;

    const browser = await this.launch();
    const page = await browser.newPage();

    // Write the HTML to a temp file and navigate via file:// so that
    // same-origin file:// subresources (mermaid.min.js, KaTeX fonts) load.
    // `setContent` creates an about:blank document which Chromium blocks
    // from fetching file:// resources under its isolation rules.
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'md-to-pdf-'));
    const tmpHtml = path.join(
      tmpDir,
      `doc-${crypto.randomBytes(4).toString('hex')}.html`
    );

    try {
      page.on('pageerror', (err: Error) => {
        console.error(`[pdf] pageerror: ${err.message}`);
      });
      page.on('requestfailed', (req) => {
        const failure = req.failure();
        const fail = failure ? failure.errorText : 'unknown';
        if (fail === 'net::ERR_ABORTED') return;
        console.error(`[pdf] requestfailed: ${req.url()} -- ${fail}`);
      });

      await fsp.writeFile(tmpHtml, html, 'utf8');

      progress?.stage('browser');
      await page.goto(pathToFileURL(tmpHtml).href, {
        waitUntil: ['load', 'networkidle0'],
        timeout: 60_000,
      });

      await page
        .evaluate(async () => {
          const w = window as unknown as { __mermaidDone?: Promise<unknown> };
          if (w.__mermaidDone) {
            try {
              await w.__mermaidDone;
            } catch {
              /* ignore */
            }
          }
          if (document.fonts && document.fonts.ready) {
            try {
              await document.fonts.ready;
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => undefined);

      // Give the renderer one extra frame to settle (inline SVG size changes).
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );

      progress?.stage('render');

      // Full bleed: zero puppeteer margins + @page { margin: 0 } in CSS so
      // the html/body background paints edge to edge. Running headers,
      // footers, and page numbers are rendered via CSS Paged Media
      // @top-X/@bottom-X margin boxes from template.ts when enabled.
      const buffer = await page.pdf({
        format,
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      progress?.stage('write');
      return Buffer.from(buffer);
    } finally {
      await page.close().catch(() => undefined);
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
