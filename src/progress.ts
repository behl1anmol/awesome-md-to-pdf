/*
 * progress.ts -- ProgressReporter.
 *
 * Drives a cli-progress bar during conversions. Each file passes through a
 * fixed 5-stage pipeline (parse -> html -> browser -> render -> write); we
 * map each stage to a fractional advance of the bar so the user sees steady
 * forward motion on large files.
 *
 * In non-TTY contexts (CI / piped output) we silently no-op -- callers
 * still print their own summary so nothing is lost.
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { tc } from './tty-colors';

// ---------------------------------------------------------------------------
// Stage map
// ---------------------------------------------------------------------------

export type Stage = 'parse' | 'html' | 'browser' | 'render' | 'write';

const STAGE_PROGRESS: Record<Stage, number> = {
  parse: 15,
  html: 35,
  browser: 60,
  render: 85,
  write: 100,
};

const STAGE_LABEL: Record<Stage, string> = {
  parse: 'parsing',
  html: 'building html',
  browser: 'loading chromium',
  render: 'rendering',
  write: 'writing pdf',
};

// ---------------------------------------------------------------------------
// ProgressReporter
// ---------------------------------------------------------------------------

export class ProgressReporter {
  private fileBar: cliProgress.SingleBar | null = null;
  private overallBar: cliProgress.SingleBar | null = null;
  private enabled: boolean;
  private currentFile: string | null = null;
  private batchTotal = 0;
  private batchDone = 0;

  constructor(opts: { enabled?: boolean } = {}) {
    const tty = Boolean(process.stdout.isTTY);
    this.enabled = opts.enabled ?? tty;
  }

  /** Begin a batch of `total` files. Single-file conversions pass total=1. */
  startBatch(total: number): void {
    if (!this.enabled) return;
    this.batchTotal = total;
    this.batchDone = 0;
    if (total > 1) {
      this.overallBar = new cliProgress.SingleBar(
        {
          format:
            chalk.hex('#87867f')('  batch   ') +
            chalk.hex('#c96442')('{bar}') +
            chalk.hex('#87867f')(' {value}/{total} files ({duration_formatted})'),
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true,
          clearOnComplete: false,
        },
        cliProgress.Presets.shades_classic
      );
      this.overallBar.start(total, 0);
    }
  }

  /** Begin a new per-file bar. Closes any previous per-file bar first. */
  startFile(file: string): void {
    if (!this.enabled) return;
    this.closeFileBar();
    this.currentFile = file;
    const label = truncate(file, 32);
    this.fileBar = new cliProgress.SingleBar(
      {
        format:
          chalk.hex('#c96442')('  ') +
          tc.body(label.padEnd(32)) +
          ' ' +
          chalk.hex('#c96442')('{bar}') +
          ' ' +
          chalk.hex('#87867f')('{percentage}%') +
          ' ' +
          chalk.hex('#87867f')('{stage}'),
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        clearOnComplete: false,
      },
      cliProgress.Presets.shades_classic
    );
    this.fileBar.start(100, 0, { stage: STAGE_LABEL.parse });
  }

  /** Report advancement through a named stage of the pipeline. */
  stage(stage: Stage): void {
    if (!this.enabled || !this.fileBar) return;
    this.fileBar.update(STAGE_PROGRESS[stage], { stage: STAGE_LABEL[stage] });
  }

  /** Close the current file bar; bumps the overall bar if we're batching. */
  completeFile(bytes: number, ms: number): void {
    if (!this.enabled) return;
    if (this.fileBar) {
      this.fileBar.update(100, {
        stage: `${Math.round(bytes / 102.4) / 10} KB in ${ms} ms`,
      });
      this.fileBar.stop();
      this.fileBar = null;
    }
    this.batchDone += 1;
    if (this.overallBar) this.overallBar.update(this.batchDone);
    this.currentFile = null;
  }

  /** Mark the current file as failed; bar is stopped without 100%. */
  failFile(error: string): void {
    if (!this.enabled) return;
    if (this.fileBar) {
      this.fileBar.update(this.fileBar.getProgress() * 100, {
        stage: chalk.hex('#b53333')(`failed: ${truncate(error, 40)}`),
      });
      this.fileBar.stop();
      this.fileBar = null;
    }
    this.batchDone += 1;
    if (this.overallBar) this.overallBar.update(this.batchDone);
    this.currentFile = null;
  }

  /** Close the overall batch bar. */
  endBatch(): void {
    if (!this.enabled) return;
    this.closeFileBar();
    if (this.overallBar) {
      this.overallBar.stop();
      this.overallBar = null;
    }
  }

  private closeFileBar(): void {
    if (this.fileBar) {
      this.fileBar.stop();
      this.fileBar = null;
    }
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}

/**
 * A no-op reporter for environments where we don't want any progress UI
 * (e.g. JSON output or scripted CI runs).
 */
export const NullReporter: ProgressReporter = new ProgressReporter({ enabled: false });
