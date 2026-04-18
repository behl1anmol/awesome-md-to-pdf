import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { tc } from './tty-colors';

export interface ConvertedItem {
  file: string;
  out: string;
  bytes: number;
  ms: number;
}

export interface FailureItem {
  file: string;
  error: string;
}

export interface SummaryStats {
  total: number;
  success: number;
  failed: number;
  elapsedMs: number;
  items: ConvertedItem[];
  failures?: FailureItem[];
}

export function banner(text: string): void {
  const line = '\u2500'.repeat(Math.min(text.length + 4, 60));
  console.log('');
  console.log(tc.brand(line));
  console.log(tc.brandBold('  ' + text));
  console.log(tc.brand(line));
  console.log('');
}

export function info(msg: string): void {
  console.log(tc.meta('  ' + msg));
}

export function warn(msg: string): void {
  console.log(tc.brand('  ! ' + msg));
}

export function error(msg: string): void {
  console.log(tc.errorBold('  x ' + msg));
}

export function success(msg: string): void {
  console.log(tc.success('  v ' + msg));
}

export function muted(msg: string): string {
  return tc.meta(msg);
}

export function brand(msg: string): string {
  return tc.brand(msg);
}

/**
 * Start an ora spinner with the brand color.
 */
export function spinner(text: string): Ora {
  return ora({
    text,
    color: 'yellow',
    spinner: 'dots',
  });
}

/**
 * Pretty-print the final summary.
 */
export function summary(stats: SummaryStats): void {
  const { total, elapsedMs, items = [], failures = [] } = stats;
  const successful = items.length;

  console.log('');
  console.log(tc.brand('\u2500'.repeat(60)));
  console.log(tc.bodyBold('  Summary'));
  console.log(tc.brand('\u2500'.repeat(60)));

  for (const item of items) {
    const kb = (item.bytes / 1024).toFixed(1);
    console.log(
      '  ' +
        tc.success('v') +
        ' ' +
        tc.body(item.file) +
        muted(`  ->  `) +
        tc.body(item.out) +
        muted(`   (${kb} KB, ${item.ms} ms)`)
    );
  }

  for (const f of failures) {
    console.log(
      '  ' +
        chalk.hex('#b53333')('x') +
        ' ' +
        tc.body(f.file) +
        '  ' +
        tc.error(f.error)
    );
  }

  console.log('');
  console.log(
    '  ' +
      tc.bodyBold(`${successful}/${total}`) +
      ' ' +
      muted('files converted in') +
      ' ' +
      tc.bodyBold(formatDuration(elapsedMs))
  );
  if (failures.length) {
    console.log('  ' + tc.error(`${failures.length} failed`));
  }
  console.log('');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
