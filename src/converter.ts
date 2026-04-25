import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import type { PaperFormat } from 'puppeteer';

import { createMarkdown, extractTitle } from './markdown';
import { buildHtml } from './template';
import { PdfRenderer } from './pdf';
import * as logger from './logger';
import type { RenderMode } from './prompt';
import type { ConvertedItem, FailureItem } from './logger';
import type { DesignTokens } from './design';
import { ProgressReporter } from './progress';

export interface ConvertOptions {
  inputDir: string;
  outputDir: string;
  recursive: boolean;
  singleFile: boolean;
  mode: RenderMode;
  format: PaperFormat;
  toc: boolean;
  cover: boolean;
  pageNumbers: boolean;
  headerText?: string;
  footerText?: string;
  showLinkUrls: boolean;
  concurrency: number;
  accent?: string | null;
  /** Parsed light-mode DESIGN.md tokens; null/undefined uses the Claude baseline. */
  designLight?: DesignTokens | null;
  /** Parsed dark-mode DESIGN.md tokens; null/undefined uses the Claude baseline. */
  designDark?: DesignTokens | null;
  /** When true (default), use the progress-bar UI; when false, use ora spinners. */
  useProgressBars?: boolean;
}

interface PerFileContext {
  inputFile: string;
  inputRoot: string;
  outputDir: string;
  mode: RenderMode;
  format: PaperFormat;
  toc: boolean;
  cover: boolean;
  pageNumbers: boolean;
  headerText?: string;
  footerText?: string;
  showLinkUrls: boolean;
  accent?: string | null;
  designLight?: DesignTokens | null;
  designDark?: DesignTokens | null;
  renderer: PdfRenderer;
  progress?: ProgressReporter;
}

interface MergeContext extends Omit<PerFileContext, 'inputFile'> {
  files: string[];
  coverTitle?: string;
}

/**
 * Discover all .md files under inputDir, sorted alphabetically.
 */
export async function discover(inputDir: string, recursive: boolean): Promise<string[]> {
  const pattern = recursive ? '**/*.md' : '*.md';
  const entries = await fg(pattern, {
    cwd: inputDir,
    absolute: true,
    dot: false,
    onlyFiles: true,
    caseSensitiveMatch: false,
  });
  entries.sort((a, b) => a.localeCompare(b));
  return entries;
}

interface RenderedMarkdown {
  bodyHtml: string;
  tocHtml: string;
}

/**
 * Render a single markdown string to body HTML + optional TOC HTML. Runs a
 * second render pass with an injected [[toc]] placeholder when a TOC is
 * requested, so we can extract just the <nav class="toc"> block.
 */
function renderMarkdown(
  source: string,
  sourcePath: string,
  wantToc: boolean
): RenderedMarkdown {
  const md = createMarkdown({ sourcePath });
  const body = md.render(source);
  let tocHtml = '';

  if (wantToc) {
    const probeSource = '[[toc]]\n\n' + source;
    const withToc = md.render(probeSource);
    const match = withToc.match(/<nav[^>]*class="toc"[^>]*>([\s\S]*?)<\/nav>/i);
    if (match) {
      tocHtml = match[0];
    }
  }

  return { bodyHtml: body, tocHtml };
}

/**
 * Convert a single .md file into a PDF on disk.
 */
async function convertOne(ctx: PerFileContext): Promise<ConvertedItem> {
  const startedAt = Date.now();
  ctx.progress?.stage('parse');
  const source = await fsp.readFile(ctx.inputFile, 'utf8');
  const title = extractTitle(source) ?? path.basename(ctx.inputFile, '.md');
  const { bodyHtml, tocHtml } = renderMarkdown(source, ctx.inputFile, ctx.toc);

  ctx.progress?.stage('html');
  const html = buildHtml({
    bodyHtml,
    tocHtml,
    title,
    mode: ctx.mode,
    cover: ctx.cover,
    toc: ctx.toc,
    subtitle: '',
    showLinkUrls: ctx.showLinkUrls,
    accent: ctx.accent,
    designLight: ctx.designLight,
    designDark: ctx.designDark,
    pageNumbers: ctx.pageNumbers,
    headerText: resolveHeaderTokens(ctx.headerText, path.basename(ctx.inputFile), title),
    footerText: resolveHeaderTokens(ctx.footerText, path.basename(ctx.inputFile), title),
  });

  const relative = path.relative(ctx.inputRoot, ctx.inputFile);
  const outFile = path.join(
    ctx.outputDir,
    relative.replace(/\.md$/i, '.pdf')
  );
  await fsp.mkdir(path.dirname(outFile), { recursive: true });

  const pdfBuffer = await ctx.renderer.render({
    html,
    format: ctx.format,
    progress: ctx.progress,
  });

  await fsp.writeFile(outFile, pdfBuffer);

  return {
    file: relative,
    out: path.relative(process.cwd(), outFile),
    bytes: pdfBuffer.length,
    ms: Date.now() - startedAt,
  };
}

/**
 * Combine all source files into a single big markdown document (with page
 * breaks between), render once, and write a single PDF.
 */
async function convertMerged(ctx: MergeContext): Promise<ConvertedItem> {
  const startedAt = Date.now();
  const pieces: string[] = [];
  const titles: string[] = [];

  for (let i = 0; i < ctx.files.length; i++) {
    const file = ctx.files[i];
    const source = await fsp.readFile(file, 'utf8');
    const title = extractTitle(source) ?? path.basename(file, '.md');
    titles.push(title);
    if (i > 0) {
      pieces.push('\n\n<div class="page-break"></div>\n\n');
    }
    pieces.push(source);
  }

  const merged = pieces.join('');

  // Render each piece with its own markdown-it instance so relative image
  // paths in each file stay correct.
  let bodyHtml = '';
  let tocHtml = '';
  for (let i = 0; i < ctx.files.length; i++) {
    const file = ctx.files[i];
    const source = await fsp.readFile(file, 'utf8');
    const { bodyHtml: part, tocHtml: partToc } = renderMarkdown(source, file, ctx.toc);
    if (i > 0) {
      bodyHtml += '\n<div class="page-break"></div>\n';
    }
    bodyHtml += part;
    if (!tocHtml && partToc) tocHtml = partToc;
  }

  if (ctx.toc) {
    const md = createMarkdown({ sourcePath: ctx.files[0] });
    const probe = md.render('[[toc]]\n\n' + merged);
    const match = probe.match(/<nav[^>]*class="toc"[^>]*>([\s\S]*?)<\/nav>/i);
    if (match) tocHtml = match[0];
  }

  const fileList = ctx.files.map((f) => path.relative(ctx.inputRoot, f));
  const docTitle = ctx.coverTitle ?? titles[0] ?? 'Collected Documents';

  const html = buildHtml({
    bodyHtml,
    tocHtml,
    title: docTitle,
    mode: ctx.mode,
    cover: ctx.cover,
    toc: ctx.toc,
    subtitle: fileList.length > 1 ? `${fileList.length} documents` : '',
    fileList,
    showLinkUrls: ctx.showLinkUrls,
    accent: ctx.accent,
    designLight: ctx.designLight,
    designDark: ctx.designDark,
    pageNumbers: ctx.pageNumbers,
    headerText: resolveHeaderTokens(ctx.headerText, '', docTitle),
    footerText: resolveHeaderTokens(ctx.footerText, '', docTitle),
  });

  const outFile = path.join(ctx.outputDir, sanitizeFileName(docTitle) + '.pdf');
  await fsp.mkdir(path.dirname(outFile), { recursive: true });

  const pdfBuffer = await ctx.renderer.render({
    html,
    format: ctx.format,
    progress: ctx.progress,
  });

  await fsp.writeFile(outFile, pdfBuffer);

  return {
    file: fileList.join(', '),
    out: path.relative(process.cwd(), outFile),
    bytes: pdfBuffer.length,
    ms: Date.now() - startedAt,
  };
}

function sanitizeFileName(name: string): string {
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'document';
}

/**
 * Expand {file}, {title}, {date} tokens in a header/footer string. Returns
 * undefined when the input is empty so callers can skip the corresponding
 * @page margin box entirely.
 */
function resolveHeaderTokens(
  text: string | undefined,
  fileName: string,
  docTitle: string
): string | undefined {
  if (!text) return undefined;
  return String(text)
    .replace(/\{file\}/g, fileName || '')
    .replace(/\{title\}/g, docTitle || '')
    .replace(/\{date\}/g, new Date().toLocaleDateString());
}

interface PoolResult<T> {
  results: T[];
  failures: FailureItem[];
}

/**
 * Run a bounded pool of promises, preserving input order in results.
 */
async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  describe: (item: T) => string
): Promise<PoolResult<R>> {
  const results: Array<R | null> = new Array(items.length).fill(null);
  const failures: FailureItem[] = [];
  let cursor = 0;

  const workerCount = Math.max(1, concurrency);
  const workers = new Array(workerCount).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ file: describe(items[i]), error: message });
        results[i] = null;
      }
    }
  });

  await Promise.all(workers);
  return { results: results.filter((r): r is R => r !== null), failures };
}

/**
 * Main entry point. Returns exit code.
 */
export async function convert(options: ConvertOptions): Promise<number> {
  const {
    inputDir,
    outputDir,
    recursive,
    singleFile,
    mode,
    format,
    toc,
    cover,
    pageNumbers,
    headerText,
    footerText,
    showLinkUrls,
    concurrency,
    accent,
    designLight,
    designDark,
    useProgressBars,
  } = options;

  const absInput = path.resolve(inputDir);
  const absOutput = path.resolve(outputDir);

  if (!fs.existsSync(absInput) || !fs.statSync(absInput).isDirectory()) {
    logger.error(`Input directory does not exist: ${absInput}`);
    return 2;
  }

  const files = await discover(absInput, recursive);
  if (!files.length) {
    logger.warn(`No .md files found in ${absInput}`);
    return 0;
  }

  await fsp.mkdir(absOutput, { recursive: true });

  logger.info(
    `${files.length} markdown file(s) -> ${path.relative(process.cwd(), absOutput) || '.'}`
  );
  logger.info(
    `Mode: ${mode}   Format: ${format}   Concurrency: ${concurrency}` +
      buildDesignSummary(designLight, designDark)
  );
  console.log('');

  const renderer = new PdfRenderer();
  const started = Date.now();

  // Concurrency > 1 and a progress bar per file collide visually; fall back
  // to ora spinners if bars would overlap.
  const canBar =
    (useProgressBars ?? true) &&
    Boolean(process.stdout.isTTY) &&
    (singleFile || concurrency === 1 || files.length === 1);
  const progress = canBar ? new ProgressReporter() : null;

  try {
    await renderer.launch();

    let items: ConvertedItem[] = [];
    let failures: FailureItem[] = [];

    if (singleFile) {
      progress?.startBatch(1);
      progress?.startFile(`${files.length} files merged`);
      const spin = progress ? null : logger.spinner(`Merging ${files.length} files -> single PDF`).start();
      try {
        const result = await convertMerged({
          files,
          inputRoot: absInput,
          outputDir: absOutput,
          mode,
          format,
          toc,
          cover,
          pageNumbers,
          headerText,
          footerText,
          showLinkUrls,
          accent,
          designLight,
          designDark,
          renderer,
          progress: progress ?? undefined,
        });
        items = [result];
        progress?.completeFile(result.bytes, result.ms);
        spin?.succeed(`Merged ${files.length} files -> ${result.out}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        progress?.failFile(message);
        spin?.fail(`Merge failed: ${message}`);
        failures = [{ file: 'merged', error: message }];
      }
      progress?.endBatch();
    } else {
      progress?.startBatch(files.length);

      const pool = await runPool(
        files,
        concurrency,
        async (file) => {
          const rel = path.relative(absInput, file);
          progress?.startFile(rel);
          const spin = progress ? null : logger.spinner(rel).start();
          try {
            const result = await convertOne({
              inputFile: file,
              inputRoot: absInput,
              outputDir: absOutput,
              mode,
              format,
              toc,
              cover,
              pageNumbers,
              headerText,
              footerText,
              showLinkUrls,
              accent,
              designLight,
              designDark,
              renderer,
              progress: progress ?? undefined,
            });
            progress?.completeFile(result.bytes, result.ms);
            spin?.succeed(`${result.file}  ${logger.muted('->')}  ${result.out}`);
            return result;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            progress?.failFile(message);
            spin?.fail(`${rel}  ${message}`);
            throw err;
          }
        },
        (file) => path.relative(absInput, file)
      );
      items = pool.results;
      failures = pool.failures;
      progress?.endBatch();
    }

    const elapsed = Date.now() - started;

    logger.summary({
      total: singleFile ? 1 : files.length,
      success: items.length,
      failed: failures.length,
      elapsedMs: elapsed,
      items,
      failures,
    });

    return failures.length ? 1 : 0;
  } finally {
    await renderer.close();
  }
}

function buildDesignSummary(
  designLight: DesignTokens | null | undefined,
  designDark: DesignTokens | null | undefined
): string {
  const light = designLight ? designLight.name : 'claude';
  const dark = designDark ? designDark.name : 'claude';
  return `   Design(light): ${light}   Design(dark): ${dark}`;
}
