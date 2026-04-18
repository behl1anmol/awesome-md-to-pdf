import path from 'path';
import { Command } from 'commander';
import chokidar from 'chokidar';
import { spawn } from 'child_process';
import type { PaperFormat } from 'puppeteer';

import { convert, type ConvertOptions } from './converter';
import { askMode, type RenderMode } from './prompt';
import * as logger from './logger';
import { renderBanner } from './banner';
import { runRepl } from './repl';
import { parseDesignMd, type DesignTokens } from './design';

// Walk up one directory because tsc emits to dist/, while package.json
// lives at the project root.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as {
  version: string;
  description: string;
};

const ALLOWED_MODES = new Set<RenderMode>(['light', 'dark']);
const ALLOWED_FORMATS = new Set<PaperFormat>(['A4', 'Letter', 'Legal']);

interface RawCliOptions {
  output: string;
  recursive?: boolean;
  singleFile?: boolean;
  mode?: string;
  accent?: string;
  design?: string;
  format: string;
  toc?: boolean;
  cover?: boolean;
  pageNumbers?: boolean;
  header?: string;
  footer?: string;
  showLinkUrls?: boolean;
  concurrency: number;
  watch?: boolean;
  open?: boolean;
  noBanner?: boolean;
  banner?: boolean;
}

function parseAccent(value: string | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return '#' + v;
  return null;
}

function normalizeFormat(value: string): PaperFormat | null {
  if (!value) return 'A4';
  const f = String(value).trim();
  const canonical = f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  if (canonical === 'A4') return 'A4';
  if (canonical === 'A3') return 'A3';
  if (canonical === 'Letter') return 'Letter';
  if (canonical === 'Legal') return 'Legal';
  return null;
}

function shouldShowBanner(opts: RawCliOptions): boolean {
  if (opts.banner === false) return false; // --no-banner (commander sets this key)
  if (process.env.MDTOPDF_NO_BANNER) return false;
  return true;
}

function printBanner(): void {
  console.log(renderBanner());
}

function loadDesign(designPath: string | undefined): DesignTokens | null {
  if (!designPath) return null;
  try {
    return parseDesignMd(designPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Could not load --design: ${message}`);
    process.exit(2);
  }
}

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('awesome-md-to-pdf')
    .description(pkg.description)
    .version(pkg.version)
    .argument('[inputDir]', 'Directory containing .md files to convert. Omit to open the chat REPL.')
    .option('-o, --output <dir>', 'Output directory', 'pdf')
    .option('-r, --recursive', 'Recurse into subdirectories', false)
    .option('-s, --single-file', 'Merge all .md files into a single PDF', false)
    .option('-m, --mode <mode>', 'Render mode: light | dark')
    .option('--accent <hex>', 'Override the brand accent (hex)')
    .option('--design <path>', 'Path to a DESIGN.md file or folder (see https://getdesign.md)')
    .option('-f, --format <fmt>', 'Page format: A4 | Letter | Legal', 'A4')
    .option('--toc', 'Auto-generate a table of contents', false)
    .option('--cover', 'Generate a cover page', false)
    .option(
      '--page-numbers',
      'Show "page X / Y" in a thin band at the bottom (breaks full-bleed)',
      false
    )
    .option('--header <text>', 'Custom header text ({file}, {title}, {date}) -- adds a thin band at top')
    .option('--footer <text>', 'Custom footer text -- adds a thin band at bottom')
    .option('--show-link-urls', 'Print external URLs after link text', false)
    .option('--no-banner', 'Suppress the welcome banner (useful in CI)')
    .option(
      '-c, --concurrency <n>',
      'Parallel conversions',
      (v: string) => parseInt(v, 10),
      3
    )
    .option('-w, --watch', 'Watch and reconvert on change', false)
    .option('--open', 'Open the output folder when done', false)
    .addHelpText(
      'after',
      '\n' +
        '  Run with no arguments to enter the interactive chat mode.\n' +
        '  Inside chat, type /help for the command list.\n' +
        '  Browse DESIGN.md files at https://getdesign.md\n'
    )
    .showHelpAfterError(true);

  program.parse(argv);
  const opts = program.opts<RawCliOptions>();
  const inputDir = program.args[0];

  // ---- Routing ----
  // No positional arg -> chat REPL (with banner).
  if (!inputDir) {
    if (shouldShowBanner(opts)) printBanner();
    const design = loadDesign(opts.design);
    const preMode: RenderMode | null = opts.mode
      ? (String(opts.mode).toLowerCase() as RenderMode)
      : null;
    const format = normalizeFormat(opts.format) ?? 'A4';
    await runRepl({
      initial: {
        outputDir: path.resolve(opts.output ?? 'pdf'),
        mode: preMode ?? 'light',
        format,
        design,
        toc: Boolean(opts.toc),
        cover: Boolean(opts.cover),
        recursive: Boolean(opts.recursive),
        pageNumbers: Boolean(opts.pageNumbers),
        singleFile: Boolean(opts.singleFile),
        showLinkUrls: Boolean(opts.showLinkUrls),
        accent: opts.accent ? parseAccent(opts.accent) : null,
      },
    });
    return;
  }

  // One-shot mode with a positional inputDir.
  const format = normalizeFormat(opts.format);
  if (!format || !ALLOWED_FORMATS.has(format)) {
    logger.error(`Invalid --format: ${opts.format}. Allowed: A4, Letter, Legal.`);
    process.exit(2);
  }

  const concurrency = Math.max(
    1,
    Number.isFinite(opts.concurrency) ? opts.concurrency : 3
  );

  const accent = opts.accent ? parseAccent(opts.accent) : null;
  if (opts.accent && !accent) {
    logger.error(`Invalid --accent: ${opts.accent}. Use #rrggbb or #rgb.`);
    process.exit(2);
  }

  let mode: RenderMode | null = opts.mode
    ? (String(opts.mode).toLowerCase() as RenderMode)
    : null;
  if (mode && !ALLOWED_MODES.has(mode)) {
    logger.error(`Invalid --mode: ${opts.mode}. Allowed: light, dark.`);
    process.exit(2);
  }

  const design = loadDesign(opts.design);

  if (shouldShowBanner(opts)) printBanner();
  logger.banner('\u2726 awesome-md-to-pdf  \u00b7  ' + inputDir);

  if (!mode) {
    mode = await askMode('light');
  }

  const runOptions: ConvertOptions = {
    inputDir,
    outputDir: opts.output,
    recursive: Boolean(opts.recursive),
    singleFile: Boolean(opts.singleFile),
    mode,
    format,
    toc: Boolean(opts.toc),
    cover: Boolean(opts.cover),
    pageNumbers: Boolean(opts.pageNumbers),
    headerText: opts.header,
    footerText: opts.footer,
    showLinkUrls: Boolean(opts.showLinkUrls),
    concurrency,
    accent,
    design,
  };

  let exitCode = 0;
  try {
    exitCode = await convert(runOptions);
  } catch (err) {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    logger.error(message);
    exitCode = 1;
  }

  if (opts.open) {
    tryOpenFolder(path.resolve(runOptions.outputDir));
  }

  if (!opts.watch) {
    process.exit(exitCode);
  }

  // Watch mode
  logger.info('Watching for changes. Press Ctrl+C to stop.');

  const glob = runOptions.recursive
    ? path.join(runOptions.inputDir, '**/*.md')
    : path.join(runOptions.inputDir, '*.md');

  const watcher = chokidar.watch(glob, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
  });

  let running = false;
  let pending = false;
  const trigger = async (what: string, which: string): Promise<void> => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    logger.info(`${what}: ${path.relative(process.cwd(), which)}`);
    try {
      await convert(runOptions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
    }
    running = false;
    if (pending) {
      pending = false;
      void trigger('Rebuild', which);
    }
  };

  watcher
    .on('add', (f: string) => void trigger('Added', f))
    .on('change', (f: string) => void trigger('Changed', f))
    .on('unlink', (f: string) => void trigger('Removed', f));
}

function tryOpenFolder(dir: string): void {
  try {
    if (process.platform === 'win32') {
      spawn('explorer', [dir], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* ignore */
  }
}
