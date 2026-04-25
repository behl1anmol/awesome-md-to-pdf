/*
 * repl.ts -- interactive chat-style REPL.
 *
 * Users launch awesome-md-to-pdf with no args, get the banner, and then land in a
 * persistent prompt where they can drive conversions with slash commands
 * (/help, /convert, /design, /mode, ...). Non-slash input gets a gentle
 * hint pointing to /help.
 *
 * UX niceties powered by readline + raw-mode keypress events:
 *   - Live slash-command dropdown docked below the prompt. Up/Down to move,
 *     Tab or Enter to accept, Escape to dismiss.
 *   - Fish-shell-style ghost autosuggest -- the best match for the partial
 *     command is shown in dim grey after the cursor; Right arrow / End
 *     accepts it.
 *   - Rounded terracotta-bordered panels for /help, /status, /design info,
 *     and the initial welcome block.
 *
 * Non-TTY stdin (piped input, tests) transparently falls back to plain
 * readline with no raw-mode handling, so the existing smoke-test pipes
 * still work unchanged.
 */

import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';
import boxen from 'boxen';
import type { PaperFormat } from 'puppeteer';

import { convert, type ConvertOptions } from './converter';
import type { RenderMode } from './prompt';
import { parseDesignMd, describeTokens, type DesignTokens } from './design';
import * as logger from './logger';
import { tc } from './tty-colors';

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

interface Session {
  inputDir: string;
  outputDir: string;
  mode: RenderMode;
  format: PaperFormat;
  toc: boolean;
  cover: boolean;
  singleFile: boolean;
  recursive: boolean;
  pageNumbers: boolean;
  showLinkUrls: boolean;
  concurrency: number;
  accent: string | null;
  designLight: DesignTokens | null;
  designDark: DesignTokens | null;
  header?: string;
  footer?: string;
}

function defaultSession(overrides: Partial<Session> = {}): Session {
  return {
    inputDir: process.cwd(),
    outputDir: path.resolve(process.cwd(), 'pdf'),
    mode: 'light',
    format: 'A4',
    toc: false,
    cover: false,
    singleFile: false,
    recursive: false,
    pageNumbers: false,
    showLinkUrls: false,
    concurrency: 1,
    accent: null,
    designLight: null,
    designDark: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Command metadata (single source of truth)
// ---------------------------------------------------------------------------

interface CommandMeta {
  name: string;
  argHint: string;
  description: string;
  /** Controls /help grouping. */
  group: 'primary' | 'flags' | 'session';
}

const COMMAND_META: CommandMeta[] = [
  { name: 'help', argHint: '', description: 'Show this help panel.', group: 'primary' },
  { name: 'convert', argHint: '[path]', description: 'Convert a file or directory (defaults to current input).', group: 'primary' },
  {
    name: 'design',
    argHint: '<light|dark> <path> | reset <light|dark|all> | info <light|dark|all>',
    description: 'Set, reset, or inspect mode-specific DESIGN.md files.',
    group: 'primary',
  },
  { name: 'mode', argHint: '[light|dark]', description: 'Set the render mode. No arg toggles.', group: 'primary' },

  { name: 'input', argHint: '<dir>', description: 'Set the working input directory.', group: 'session' },
  { name: 'output', argHint: '<dir>', description: 'Set the output directory.', group: 'session' },
  { name: 'ls', argHint: '', description: 'List .md files in the input directory.', group: 'session' },
  { name: 'status', argHint: '', description: 'Show the current session settings.', group: 'session' },
  { name: 'open', argHint: '', description: 'Open the output folder in your file explorer.', group: 'session' },

  { name: 'toc', argHint: '[on|off]', description: 'Toggle the table of contents.', group: 'flags' },
  { name: 'cover', argHint: '[on|off]', description: 'Toggle the cover page.', group: 'flags' },
  { name: 'pages', argHint: '[on|off]', description: 'Toggle "page X / Y" band (breaks full-bleed).', group: 'flags' },
  { name: 'single', argHint: '[on|off]', description: 'Toggle single-file merge mode.', group: 'flags' },
  { name: 'recursive', argHint: '[on|off]', description: 'Toggle recursive .md discovery.', group: 'flags' },
  { name: 'accent', argHint: '<hex|reset>', description: 'Override the brand accent color.', group: 'flags' },

  { name: 'clear', argHint: '', description: 'Clear the terminal.', group: 'session' },
  { name: 'exit', argHint: '', description: 'Leave the chat (Ctrl+D also works).', group: 'session' },
  { name: 'quit', argHint: '', description: 'Same as /exit.', group: 'session' },
];

function findCommand(name: string): CommandMeta | undefined {
  return COMMAND_META.find((c) => c.name === name);
}

function filterCommands(partial: string): CommandMeta[] {
  // `partial` is already the substring AFTER the leading slash.
  const token = partial.split(/\s+/, 1)[0].toLowerCase();
  if (!token) return COMMAND_META;
  // Prefix matches first, then infix.
  const prefix = COMMAND_META.filter((c) => c.name.startsWith(token));
  const infix = COMMAND_META.filter((c) => !c.name.startsWith(token) && c.name.includes(token));
  return [...prefix, ...infix];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ReplOptions {
  initial?: Partial<Session>;
}

/**
 * Run the interactive chat loop until the user exits (via /exit, /quit, or
 * Ctrl+D). Returns when the prompt is closed.
 */
export async function runRepl(opts: ReplOptions = {}): Promise<void> {
  const session = defaultSession(opts.initial);
  const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: renderPrompt(session),
    terminal: tty,
  });

  const ui = new ReplUi(rl, tty);

  printWelcome();
  rl.prompt();

  rl.on('line', async (rawLine) => {
    ui.clearAll();

    const line = rawLine.trim();
    const promptBeforeSubmit = renderPrompt(session);

    // Replace the echoed prompt+input line with a compact rounded "you"
    // bubble so chat turns are visually distinct. Only on TTY -- piped
    // input (tests, scripts) has no echoed line to erase.
    if (line && tty) {
      renderYouBubble(line, promptBeforeSubmit);
    }

    if (!line) {
      rePrompt(rl, session, tty, ui);
      return;
    }

    if (!line.startsWith('/')) {
      nonCommandHint(line);
      rePrompt(rl, session, tty, ui);
      return;
    }

    const [cmd, ...args] = line.slice(1).split(/\s+/);
    const handler = COMMANDS[cmd as CommandName];
    if (!handler) {
      console.log(
        tc.error(`  Unknown command: /${cmd}. Try `) +
          tc.brand('/help') +
          tc.error('.')
      );
    } else {
      try {
        const result = await handler(args, session);
        if (result === 'exit') {
          rl.close();
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message);
      }
    }

    rePrompt(rl, session, tty, ui);
  });

  // Raw-mode keypress handling for live dropdown + ghost hint. Skipped
  // entirely on non-TTY stdin so piped tests still work.
  if (tty) {
    ui.attach(session);
  }

  await new Promise<void>((resolve) => {
    rl.on('close', () => {
      ui.detach();
      console.log('');
      console.log(tc.meta('  See you next time.'));
      // Release stdin on both TTY and non-TTY paths so Node's event loop
      // can drain and the process exits. Without this /exit can sit
      // forever on "See you next time." while the stdin handle keeps
      // the loop alive.
      try {
        process.stdin.pause();
      } catch {
        // ignore -- stdin may already be closed.
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// ReplUi -- owns the live dropdown + ghost hint + resize handling.
// ---------------------------------------------------------------------------

class ReplUi {
  private rl: readline.Interface;
  private tty: boolean;
  private suggestionsDrawn = 0;
  private ghostLen = 0;
  private selectedIdx = 0;
  private lastToken = '';
  private keypressHandler?: (ch: string | undefined, key: KeypressKey | undefined) => void;
  private resizeHandler?: () => void;
  private sigintHandler?: () => void;
  private session: Session | null = null;
  /** True between Enter keypress and next rl.prompt() -- skip stale redraws. */
  public submitting = false;
  /** Reentrancy guard around drawDropdown/drawGhost. */
  private drawing = false;

  constructor(rl: readline.Interface, tty: boolean) {
    this.rl = rl;
    this.tty = tty;
  }

  attach(session: Session): void {
    if (!this.tty) return;
    this.session = session;

    // emitKeypressEvents + setRawMode wire stdin so we see each keystroke.
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    this.keypressHandler = (_ch, key) => this.handleKeypress(_ch, key);
    process.stdin.on('keypress', this.keypressHandler);

    this.resizeHandler = () => this.clearAll();
    process.stdout.on('resize', this.resizeHandler);

    this.sigintHandler = () => {
      this.clearAll();
      // Let readline handle the SIGINT flow (clears the current input line).
    };
    this.rl.on('SIGINT', this.sigintHandler);
  }

  detach(): void {
    if (!this.tty) return;
    this.clearAll();
    if (this.keypressHandler) process.stdin.off('keypress', this.keypressHandler);
    if (this.resizeHandler) process.stdout.off('resize', this.resizeHandler);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    // Release the stdin handle so Node's event loop can drain and the
    // process can exit. Without this, the raw-mode listener keeps the
    // loop alive and /exit sits on "See you next time." forever until
    // the user hits Ctrl+C.
    try {
      process.stdin.pause();
    } catch {
      // ignore -- stdin may already be closed.
    }
  }

  /** Clear both the dropdown panel and the ghost suggestion. */
  clearAll(): void {
    this.clearGhost();
    this.clearDropdown();
    this.selectedIdx = 0;
    this.lastToken = '';
  }

  /**
   * Forget every piece of overlay state WITHOUT writing to the screen.
   * Used by rePrompt after command output: the caller has already wiped
   * any visible panels with clearScreenDown, so we only need to zero the
   * trackers so the next keystroke starts from a known-clean baseline.
   */
  fullReset(): void {
    this.suggestionsDrawn = 0;
    this.ghostLen = 0;
    this.selectedIdx = 0;
    this.lastToken = '';
    this.submitting = false;
    this.drawing = false;
  }

  private handleKeypress(_ch: string | undefined, key: KeypressKey | undefined): void {
    if (!key) return;

    // Handle Enter/Return synchronously so the dropdown disappears BEFORE
    // readline fires the 'line' event. Without this, any pending
    // setImmediate(refresh) queued by the last character keypress would
    // repaint the dropdown after the command output has already been
    // written, stacking stale panels in the scrollback.
    if (key.name === 'return' || key.name === 'enter') {
      this.submitting = true;
      this.clearAll();
      return;
    }

    // While a submit is in flight (Enter pressed, command output being
    // written), swallow every other keystroke's overlay work. Readline
    // still processes the keys normally for its own line buffer; we
    // just refuse to paint the dropdown or ghost over output in flight.
    if (this.submitting) return;

    const rl = this.rl as unknown as RlLineState;
    const line = rl.line ?? '';
    const looksSlash = line.startsWith('/');

    // Intercept navigation keys when the dropdown is active.
    if (looksSlash) {
      const matches = filterCommands(line.slice(1));

      if ((key.name === 'up' || key.name === 'down') && matches.length > 0) {
        if (key.name === 'up') {
          this.selectedIdx = (this.selectedIdx - 1 + matches.length) % matches.length;
        } else {
          this.selectedIdx = (this.selectedIdx + 1) % matches.length;
        }
        this.redraw(matches);
        return;
      }

      if (key.name === 'tab' && matches.length > 0) {
        this.applyCompletion(matches[this.selectedIdx]);
        return;
      }

      if (key.name === 'escape') {
        this.clearAll();
        return;
      }

      if ((key.name === 'right' || key.name === 'end') && this.ghostLen > 0) {
        this.applyGhost();
        return;
      }
    } else {
      if (key.name === 'escape') {
        this.clearAll();
        return;
      }
    }

    // Defer the repaint one tick so readline has finished updating its own
    // line buffer and cursor before we draw over the screen below it.
    setImmediate(() => {
      if (this.submitting) return;
      this.refresh();
    });
  }

  /** Recompute and redraw (or clear) both panel + ghost after a keystroke. */
  private refresh(): void {
    if (this.drawing) return;
    this.drawing = true;
    try {
      const rl = this.rl as unknown as RlLineState;
      const line = rl.line ?? '';

      if (!line.startsWith('/')) {
        this.clearAll();
        return;
      }

      const token = line.slice(1);
      if (token !== this.lastToken) {
        this.selectedIdx = 0;
        this.lastToken = token;
      }

      const matches = filterCommands(token);
      this.redraw(matches);
    } finally {
      this.drawing = false;
    }
  }

  private redraw(matches: CommandMeta[]): void {
    this.drawGhost(matches);
    this.drawDropdown(matches);
  }

  // --- Ghost hint --------------------------------------------------------

  private drawGhost(matches: CommandMeta[]): void {
    this.clearGhost();
    if (matches.length === 0) return;

    const rl = this.rl as unknown as RlLineState;
    const line = rl.line ?? '';
    const token = line.slice(1);
    const best = matches[this.selectedIdx] ?? matches[0];
    if (!best) return;

    const remainder = best.name.slice(token.length);
    if (!remainder) return;

    const tail = best.argHint ? ` ${best.argHint}` : '';
    const ghost = remainder + tail;
    const painted = chalk.hex('#87867f').dim(ghost);

    // Write the ghost and move the cursor back to the end of real input.
    // Using readline.moveCursor keeps the left-move consistent with the
    // rest of the overlay (Windows Terminal has occasionally flaked on
    // bare \x1b[ND when cursor is near column 0).
    process.stdout.write(painted);
    readline.moveCursor(process.stdout, -ghost.length, 0);
    this.ghostLen = ghost.length;
  }

  private clearGhost(): void {
    if (this.ghostLen === 0) return;
    // Overwrite with spaces + move cursor back to the end of the real input.
    process.stdout.write(' '.repeat(this.ghostLen));
    readline.moveCursor(process.stdout, -this.ghostLen, 0);
    this.ghostLen = 0;
  }

  private applyGhost(): void {
    const rl = this.rl as unknown as RlLineState;
    const line = rl.line ?? '';
    const token = line.slice(1);
    const matches = filterCommands(token);
    if (!matches.length) return;
    const best = matches[this.selectedIdx] ?? matches[0];
    this.replaceBufferWith(best);
  }

  // --- Dropdown panel ----------------------------------------------------

  /**
   * Compute the column the cursor lives on right now -- visible prompt width
   * plus current input cursor position. We use this to snap the cursor back
   * to the edit point after drawing the dropdown below the prompt.
   */
  private currentInputCol(): number {
    const rl = this.rl as unknown as RlLineState & { getPrompt?: () => string };
    const promptStr =
      typeof rl.getPrompt === 'function'
        ? rl.getPrompt()
        : ((this.rl as unknown as { _prompt?: string })._prompt ?? '');
    return visibleLen(promptStr) + (rl.cursor ?? 0);
  }

  private drawDropdown(matches: CommandMeta[]): void {
    // Always clear first, then paint.
    this.clearDropdown();
    if (matches.length === 0) return;

    const inputCol = this.currentInputCol();

    const MAX_ROWS = 5;
    const visible = matches.slice(0, MAX_ROWS);
    const extra = matches.length - visible.length;
    const drawn = visible.length + (extra > 0 ? 1 : 0);

    // Pre-reserve the rows we're about to fill. Writing N newlines
    // forces the terminal to scroll NOW (while the cursor is still on
    // the prompt row) if the dropdown won't fit below the viewport.
    // We then step back up to the prompt row. After this, we know
    // `drawn` rows below the cursor exist on-screen, so the relative
    // moveCursor calls below won't land on a scrolled-off row.
    //
    // Without this, a tall command panel (like /help) that pushes the
    // prompt to the last row would make the dropdown scroll the prompt
    // row OFF-SCREEN while drawing, and the "move back up" at the end
    // would clamp to an arbitrary on-screen row -- readline then writes
    // subsequent keystrokes to a row that isn't where the prompt is
    // actually displayed, so the user types invisible characters until
    // backspace forces a full readline refresh.
    process.stdout.write('\n'.repeat(drawn));
    readline.moveCursor(process.stdout, 0, -drawn);

    // Drop one row below the prompt, then paint.
    readline.moveCursor(process.stdout, -inputCol, 1);
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);

    for (let i = 0; i < visible.length; i++) {
      const row = renderDropdownRow(visible[i], i === this.selectedIdx);
      process.stdout.write(row);
      if (i < visible.length - 1 || extra > 0) process.stdout.write('\n');
    }
    if (extra > 0) {
      process.stdout.write('  ' + tc.meta(`+${extra} more... (type to narrow)`));
    }

    this.suggestionsDrawn = drawn;

    // Snap cursor back to the real input position. We're at the last
    // drawn panel row; step up (drawn - 1) rows to the first panel row,
    // then one more to the prompt row, then across to inputCol.
    readline.moveCursor(process.stdout, 0, -(drawn - 1) - 1);
    readline.cursorTo(process.stdout, inputCol);
  }

  private clearDropdown(): void {
    if (this.suggestionsDrawn === 0) return;
    const inputCol = this.currentInputCol();
    // Step one row below the prompt and wipe downward.
    readline.moveCursor(process.stdout, -inputCol, 1);
    readline.cursorTo(process.stdout, 0);
    readline.clearScreenDown(process.stdout);
    // Back up to the original prompt row at the input column.
    readline.moveCursor(process.stdout, 0, -1);
    readline.cursorTo(process.stdout, inputCol);
    this.suggestionsDrawn = 0;
  }

  private applyCompletion(cmd: CommandMeta): void {
    this.replaceBufferWith(cmd);
  }

  /**
   * Replace the entire readline buffer with the canonical form of the given
   * command: `/<name>` plus a trailing space when the command takes args.
   * Used for both Tab completion and Right-arrow ghost acceptance.
   *
   * We can't just append a remainder (best.name.slice(token.length)): when
   * the user typed an infix token like `/ng` and arrow-selected `/convert`,
   * there IS no remainder (ng isn't a prefix of convert) and naive append
   * would produce `/ngvert`. Replacing the whole buffer via
   * rl._refreshLine keeps readline's internal cursor accounting in sync
   * and redraws the prompt cleanly.
   */
  private replaceBufferWith(cmd: CommandMeta): void {
    this.clearGhost();
    this.clearDropdown();

    const replacement = '/' + cmd.name + (cmd.argHint ? ' ' : '');
    const rl = this.rl as unknown as {
      line: string;
      cursor: number;
      _refreshLine: () => void;
    };
    rl.line = replacement;
    rl.cursor = replacement.length;
    if (typeof rl._refreshLine === 'function') {
      rl._refreshLine();
    }

    // Reset overlay accounting. The dropdown/ghost will repaint on the next
    // keystroke or via the immediate refresh scheduled below.
    this.suggestionsDrawn = 0;
    this.ghostLen = 0;
    this.selectedIdx = 0;
    this.lastToken = cmd.name;
  }
}

interface KeypressKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

interface RlLineState {
  line: string;
  cursor: number;
}

function renderDropdownRow(m: CommandMeta, selected: boolean): string {
  const arrow = selected ? chalk.hex('#c96442')('›') : ' ';
  const name = `/${m.name}`;
  const args = m.argHint ? ' ' + m.argHint : '';
  const label = name + args;
  const gap = Math.max(1, 20 - label.length);
  const desc = m.description;

  const body =
    (selected
      ? chalk.bgHex('#c96442').hex('#faf9f5')(' ' + label.padEnd(Math.max(label.length, 18)) + ' ')
      : tc.brand(label)) +
    ' '.repeat(gap) +
    (selected ? tc.body(desc) : tc.meta(desc));

  return '  ' + arrow + ' ' + body;
}

/** Strip ANSI escape sequences to measure the terminal-visible width. */
function visibleLen(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

// ---------------------------------------------------------------------------
// Prompt / hint / welcome rendering
// ---------------------------------------------------------------------------

function renderPrompt(session: Session): string {
  const modeColored =
    session.mode === 'dark'
      ? chalk.hex('#5a7a8a')('dark')
      : chalk.hex('#c96442')('light');
  const mark = chalk.hex('#c96442').bold('\u25c8');
  const tag =
    chalk.hex('#87867f')('[') +
    mark +
    chalk.hex('#87867f')(' \u00b7 ') +
    modeColored +
    chalk.hex('#87867f')(']');
  return tag + ' ' + chalk.hex('#c96442')('\u203a ');
}

function printWelcome(): void {
  const body =
    tc.brandBold('Welcome.') +
    ' ' +
    tc.body('Type ') +
    tc.brand('/') +
    tc.body(' and pick a command, or ') +
    tc.brand('/help') +
    tc.body(' for the full list.') +
    '\n' +
    tc.meta('DESIGN.md spec at ') +
    tc.link('https://github.com/google-labs-code/design.md/blob/main/docs/spec.md');

  console.log(
    boxen(body, {
      borderStyle: 'round',
      borderColor: '#c96442',
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 0, bottom: 1, left: 2, right: 0 },
    })
  );
}

/**
 * Erase the echoed prompt+input line that readline just wrote and replace it
 * with a compact rounded boxen bubble titled "you", so each chat turn is
 * visually distinct. Safe no-op on non-TTY (caller already gates on tty).
 *
 * When the prompt+input is long enough that readline wrapped it across
 * multiple terminal rows, we step up ONE row per wrapped row and clear each.
 * Otherwise only the last wrapped row gets erased and the opening chars of
 * the prompt are left behind as visual debris.
 */
function renderYouBubble(line: string, prompt: string): void {
  const cols = process.stdout.columns || 80;
  const totalLen = visibleLen(prompt) + line.length;
  const rows = Math.max(1, Math.ceil(totalLen / cols));
  for (let i = 0; i < rows; i++) {
    readline.moveCursor(process.stdout, 0, -1);
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }

  const content = tc.bodyBold(line);
  const bubble = boxen(content, {
    borderStyle: 'round',
    borderColor: '#c96442',
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 2, right: 0 },
    title: tc.brandBold('you'),
    titleAlignment: 'left',
  });
  console.log(bubble);
}

/**
 * Redraw a fresh prompt at column 0 of a new row. Commands occasionally
 * finish with output that does NOT end on a clean newline boundary (cli-
 * progress closes without a trailing \n, for example). Without this reset
 * the prompt prefix can be chopped visually ("[md..." -> blank) because
 * readline writes it mid-row.
 *
 * We also ABSOLUTELY reset the overlay trackers and wipe anything below
 * the cursor with clearScreenDown. After a tall panel (like /help) the
 * terminal has typically scrolled, leaving our old overlay-anchor row
 * off-screen; any stale `suggestionsDrawn` / `ghostLen` counters would
 * cause the next keystroke's refresh to move the cursor relative to a
 * row that no longer exists, which is exactly how bug 2 shows up:
 * typed characters land on a scrolled-away row and remain invisible
 * until the user hits backspace (which triggers readline's own
 * _refreshLine, resynchronizing everything).
 *
 * Safe on both TTY and non-TTY -- the ANSI writes are gated on tty.
 */
function rePrompt(
  rl: readline.Interface,
  session: Session,
  tty: boolean,
  ui: ReplUi
): void {
  ui.fullReset();
  if (tty) {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    readline.clearScreenDown(process.stdout);
  }
  rl.setPrompt(renderPrompt(session));
  rl.prompt();
}

function nonCommandHint(line: string): void {
  const trimmed = line.replace(/^["']|["']$/g, '');
  if (/\.md$/i.test(trimmed) && fs.existsSync(trimmed)) {
    console.log(
      tc.meta('  Did you mean ') +
        tc.brand(`/convert ${trimmed}`) +
        tc.meta(' ?')
    );
  } else {
    console.log(
      tc.meta('  I only speak slash commands in here. Try ') +
        tc.brand('/help') +
        tc.meta('.')
    );
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

type CommandName =
  | 'help'
  | 'convert'
  | 'design'
  | 'mode'
  | 'input'
  | 'output'
  | 'toc'
  | 'cover'
  | 'pages'
  | 'single'
  | 'recursive'
  | 'accent'
  | 'ls'
  | 'status'
  | 'open'
  | 'clear'
  | 'exit'
  | 'quit';

type CommandResult = void | 'exit';
type CommandFn = (args: string[], session: Session) => Promise<CommandResult> | CommandResult;

const COMMANDS: Record<CommandName, CommandFn> = {
  help: cmdHelp,
  convert: cmdConvert,
  design: cmdDesign,
  mode: cmdMode,
  input: cmdInput,
  output: cmdOutput,
  toc: cmdToggle('toc'),
  cover: cmdToggle('cover'),
  pages: cmdToggle('pageNumbers'),
  single: cmdToggle('singleFile'),
  recursive: cmdToggle('recursive'),
  accent: cmdAccent,
  ls: cmdLs,
  status: cmdStatus,
  open: cmdOpen,
  clear: cmdClear,
  exit: () => 'exit',
  quit: () => 'exit',
};

function cmdHelp(_args: string[], session: Session): void {
  const groups: Array<{ title: string; group: CommandMeta['group'] }> = [
    { title: 'Primary', group: 'primary' },
    { title: 'Session', group: 'session' },
    { title: 'Flags', group: 'flags' },
  ];

  const lines: string[] = [];
  for (const g of groups) {
    const rows = COMMAND_META.filter((m) => m.group === g.group);
    if (!rows.length) continue;
    if (lines.length) lines.push('');
    lines.push(chalk.hex('#87867f').bold(g.title));
    for (const m of rows) {
      const label = `/${m.name}${m.argHint ? ' ' + m.argHint : ''}`;
      lines.push(tc.brand(label.padEnd(22)) + ' ' + tc.body(m.description));
    }
  }

  lines.push('');
  lines.push(tc.meta('DESIGN.md spec at ') + tc.link('https://github.com/google/design.md'));

  console.log(boxWithBorder('Commands', lines.join('\n'), session));
}

async function cmdConvert(args: string[], session: Session): Promise<void> {
  const target = args.length ? args.join(' ') : session.inputDir;
  const abs = path.resolve(target.replace(/^["']|["']$/g, ''));

  if (!fs.existsSync(abs)) {
    logger.error(`Path does not exist: ${abs}`);
    return;
  }

  const stat = fs.statSync(abs);
  const isFile = stat.isFile();
  const isDir = stat.isDirectory();

  if (!isFile && !isDir) {
    logger.error(`Not a file or directory: ${abs}`);
    return;
  }

  const options: ConvertOptions = {
    inputDir: isFile ? path.dirname(abs) : abs,
    outputDir: session.outputDir,
    recursive: session.recursive,
    singleFile: session.singleFile,
    mode: session.mode,
    format: session.format,
    toc: session.toc,
    cover: session.cover,
    pageNumbers: session.pageNumbers,
    headerText: session.header,
    footerText: session.footer,
    showLinkUrls: session.showLinkUrls,
    concurrency: session.concurrency,
    accent: session.accent,
    designLight: session.designLight,
    designDark: session.designDark,
    useProgressBars: true,
  };

  if (isFile) {
    await convertSingleFile(abs, session);
    return;
  }

  const code = await convert(options);
  if (code !== 0) {
    logger.warn(`Conversion exited with code ${code}.`);
  }
}

async function convertSingleFile(absFile: string, session: Session): Promise<void> {
  const fsp = await import('fs/promises');
  const os = await import('os');
  const stagingDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mdtopdf-stage-'));
  try {
    const staged = path.join(stagingDir, path.basename(absFile));
    await fsp.copyFile(absFile, staged);

    const options: ConvertOptions = {
      inputDir: stagingDir,
      outputDir: session.outputDir,
      recursive: false,
      singleFile: false,
      mode: session.mode,
      format: session.format,
      toc: session.toc,
      cover: session.cover,
      pageNumbers: session.pageNumbers,
      headerText: session.header,
      footerText: session.footer,
      showLinkUrls: session.showLinkUrls,
      concurrency: 1,
      accent: session.accent,
      designLight: session.designLight,
      designDark: session.designDark,
      useProgressBars: true,
    };
    await convert(options);
  } finally {
    const fsp = await import('fs/promises');
    await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function cmdDesign(args: string[], session: Session): void {
  if (!args.length) {
    const lines = [
      tc.body('Usage:'),
      tc.brand('/design light <path>'),
      tc.brand('/design dark <path>'),
      tc.brand('/design reset <light|dark|all>'),
      tc.brand('/design info <light|dark|all>'),
    ];
    console.log(boxWithBorder('Design', lines.join('\n'), session));
    return;
  }

  const action = args[0].toLowerCase();
  if (action === 'reset') {
    const target = (args[1] ?? 'all').toLowerCase();
    if (target !== 'light' && target !== 'dark' && target !== 'all') {
      logger.error('Usage: /design reset <light|dark|all>');
      return;
    }
    if (target === 'light' || target === 'all') session.designLight = null;
    if (target === 'dark' || target === 'all') session.designDark = null;
    logger.success(`Design reset: ${target}.`);
    return;
  }

  if (action === 'info') {
    const target = (args[1] ?? 'all').toLowerCase();
    if (target !== 'light' && target !== 'dark' && target !== 'all') {
      logger.error('Usage: /design info <light|dark|all>');
      return;
    }
    if (target === 'light' || target === 'all') {
      printModeDesignInfo('light', session.designLight, session);
    }
    if (target === 'dark' || target === 'all') {
      printModeDesignInfo('dark', session.designDark, session);
    }
    return;
  }

  if (action !== 'light' && action !== 'dark') {
    logger.error('Usage: /design <light|dark> <path>');
    return;
  }

  const targetPath = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
  if (!targetPath) {
    logger.error('Usage: /design <light|dark> <path>');
    return;
  }
  try {
    const tokens = parseDesignMd(targetPath);
    if (action === 'light') session.designLight = tokens;
    else session.designDark = tokens;
    logger.success(`Loaded ${action} design: ${tokens.name} (${path.relative(process.cwd(), tokens.source)})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
  }
}

function cmdMode(args: string[], session: Session): void {
  if (!args.length) {
    session.mode = session.mode === 'light' ? 'dark' : 'light';
  } else {
    const arg = args[0].toLowerCase();
    if (arg !== 'light' && arg !== 'dark') {
      logger.error(`Invalid mode: ${arg}. Use light or dark.`);
      return;
    }
    session.mode = arg;
  }
  logger.success(`Mode set to ${session.mode}.`);
}

function cmdInput(args: string[], session: Session): void {
  if (!args.length) {
    console.log('  ' + tc.body('Input: ') + tc.body(session.inputDir));
    return;
  }
  const abs = path.resolve(args.join(' ').replace(/^["']|["']$/g, ''));
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    logger.error(`Not a directory: ${abs}`);
    return;
  }
  session.inputDir = abs;
  logger.success(`Input: ${abs}`);
}

function cmdOutput(args: string[], session: Session): void {
  if (!args.length) {
    console.log('  ' + tc.body('Output: ') + tc.body(session.outputDir));
    return;
  }
  session.outputDir = path.resolve(args.join(' ').replace(/^["']|["']$/g, ''));
  logger.success(`Output: ${session.outputDir}`);
}

function cmdToggle(
  key: 'toc' | 'cover' | 'pageNumbers' | 'singleFile' | 'recursive'
): CommandFn {
  return (args: string[], session: Session) => {
    if (!args.length) {
      session[key] = !session[key];
    } else {
      const v = args[0].toLowerCase();
      if (v === 'on' || v === 'true' || v === '1') session[key] = true;
      else if (v === 'off' || v === 'false' || v === '0') session[key] = false;
      else {
        logger.error(`Invalid value: ${v}. Use on/off.`);
        return;
      }
    }
    logger.success(`${key}: ${session[key] ? 'on' : 'off'}`);
  };
}

function cmdAccent(args: string[], session: Session): void {
  if (!args.length) {
    console.log(
      '  ' + tc.body('Accent: ') + (session.accent ? tc.body(session.accent) : tc.meta('(design default)'))
    );
    return;
  }
  const arg = args[0];
  if (arg === 'reset' || arg === 'none') {
    session.accent = null;
    logger.success('Accent: reset to design default.');
    return;
  }
  const normalized = /^#/.test(arg) ? arg : '#' + arg;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    logger.error(`Invalid accent: ${arg}. Use #rrggbb or #rgb.`);
    return;
  }
  session.accent = normalized;
  logger.success(`Accent: ${normalized}`);
}

async function cmdLs(_args: string[], session: Session): Promise<void> {
  const fg = await import('fast-glob');
  const pattern = session.recursive ? '**/*.md' : '*.md';
  const files = await fg.default(pattern, {
    cwd: session.inputDir,
    onlyFiles: true,
    caseSensitiveMatch: false,
  });
  if (!files.length) {
    console.log('  ' + tc.meta('(no .md files found)'));
    return;
  }
  console.log('');
  for (const f of files.sort()) {
    console.log('  ' + tc.body(f));
  }
  console.log('');
}

function cmdStatus(_args: string[], session: Session): void {
  const lightDesign = session.designLight ? session.designLight.name : 'claude (baseline)';
  const darkDesign = session.designDark ? session.designDark.name : 'claude (baseline)';
  const rows: Array<[string, string]> = [
    ['input', session.inputDir],
    ['output', session.outputDir],
    ['mode', session.mode],
    ['design-light', lightDesign],
    ['design-dark', darkDesign],
    ['format', session.format],
    ['toc', String(session.toc)],
    ['cover', String(session.cover)],
    ['single-file', String(session.singleFile)],
    ['recursive', String(session.recursive)],
    ['page numbers', String(session.pageNumbers)],
    ['accent', session.accent ?? '(design default)'],
    ['concurrency', String(session.concurrency)],
  ];
  const body = rows
    .map(([k, v]) => tc.meta(k.padEnd(14)) + tc.body(v))
    .join('\n');
  console.log(boxWithBorder('Session', body, session));
}

function printModeDesignInfo(
  mode: 'light' | 'dark',
  design: DesignTokens | null,
  session: Session
): void {
  if (!design) {
    console.log(boxWithBorder(`Design (${mode})`, tc.body('Using built-in Claude baseline.'), session));
    return;
  }
  console.log(boxWithBorder(`Design (${mode}) · ${design.name}`, describeTokens(design), session));
}

function cmdOpen(_args: string[], session: Session): void {
  const dir = session.outputDir;
  if (!fs.existsSync(dir)) {
    logger.warn(`Output dir does not exist yet: ${dir}`);
    return;
  }
  try {
    if (process.platform === 'win32') {
      spawn('explorer', [dir], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).unref();
    }
    logger.success(`Opened ${dir}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Could not open: ${message}`);
  }
}

function cmdClear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

// ---------------------------------------------------------------------------
// Boxen helpers
// ---------------------------------------------------------------------------

/**
 * Wrap arbitrary text in a rounded terracotta-bordered panel with a small
 * title bar. The border color tracks the session mode so the panel visually
 * belongs to the active theme.
 */
function boxWithBorder(title: string, body: string, session: Session): string {
  const borderColor = session.mode === 'dark' ? '#d97757' : '#c96442';
  const titled =
    chalk.hex(borderColor).bold(title) +
    '\n' +
    chalk.hex('#87867f')('\u2500'.repeat(title.length)) +
    '\n' +
    body;
  return boxen(titled, {
    borderStyle: 'round',
    borderColor,
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 1, left: 2, right: 0 },
  });
}
