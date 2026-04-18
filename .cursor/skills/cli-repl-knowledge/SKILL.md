---
name: cli-repl-knowledge
description: Comprehensive knowledge of the CLI surface (src/cli.ts), interactive chat REPL (src/repl.ts), welcome banner (src/banner.ts), progress reporter (src/progress.ts), light/dark prompt (src/prompt.ts), and logger/TTY color helpers (src/logger.ts, src/tty-colors.ts). Covers Commander setup, RawCliOptions -> ConvertOptions -> Session threading, watch mode, slash commands, ghost autosuggest, raw-mode keypress handling, dropdown, banner gating, progress-vs-spinner policy, and non-TTY fallback for piped input. Use when adding a CLI flag, a slash command, or touching the chat UX.
triggers: Commander, RawCliOptions, ConvertOptions, Session, CLI flag, --flag, watch mode, chokidar, REPL, chat mode, slash command, /command, ghost hint, autosuggest, dropdown, readline, raw mode, keypress, banner, renderBanner, ANSI Shadow, A W E S O M E, MD-TO-PDF, starburst, progress bar, cli-progress, ora spinner, no-banner, MDTOPDF_NO_BANNER, askMode, logger, tty-colors, tc.brand, tc.body, 24-bit color
---

# CLI & REPL

The user-facing entry points are Commander (one-shot) and the chat REPL (interactive). They share an option surface and a single converter pipeline. This skill documents everything that happens OUTSIDE the converter.

## File map

- [src/cli.ts](src/cli.ts) — Commander setup, flag parsing, one-shot vs REPL routing, watch mode.
- [src/repl.ts](src/repl.ts) — chat loop, slash commands, raw-mode UI (dropdown + ghost hint).
- [src/banner.ts](src/banner.ts) — 3D welcome banner.
- [src/progress.ts](src/progress.ts) — `cli-progress` wrapper (per-file + overall bars).
- [src/prompt.ts](src/prompt.ts) — `prompts`-based light/dark picker.
- [src/logger.ts](src/logger.ts) — info/warn/error/summary helpers.
- [src/tty-colors.ts](src/tty-colors.ts) — 24-bit / 256-color / no-color detection helpers.

## Commander setup (`cli.ts`)

`program.parse(argv)` produces `RawCliOptions`, which is deliberately a flat DTO matching Commander's kebab-case -> camelCase mapping:

```ts
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
```

Note that `--no-banner` makes Commander set `opts.banner === false`. Use `shouldShowBanner(opts)` to check.

### Normalizers

- `parseAccent(value)` — accepts `#rgb`, `#rrggbb`, `rgb` (no `#`), `rrggbb` (no `#`). Returns `null` for anything else.
- `normalizeFormat(value)` — accepts `a4`, `A4`, `letter`, `Letter`, `legal`, `Legal`, `a3`, `A3`. Returns the canonical Commander-acceptable form.
- `shouldShowBanner(opts)` — respects `--no-banner` AND `MDTOPDF_NO_BANNER` env var.

When adding a normalizer, follow this pattern: return `null` on invalid, fail fast with `logger.error(...)` + `process.exit(2)` at the callsite.

## Routing

`run(argv)` decides between two paths based on `program.args[0]`:

- **No positional arg** — call `runRepl({ initial: {...} })`. The REPL runs until Ctrl+D / `/exit` / `/quit`.
- **Positional `inputDir`** — one-shot pipeline:
  1. Validate format, accent, mode.
  2. Load `--design` via `parseDesignMd`.
  3. Print banner (if not suppressed).
  4. Prompt for mode if not specified (`askMode('light')`).
  5. Build `ConvertOptions`, call `convert(runOptions)`.
  6. Open output folder if `--open`.
  7. Enter watch loop if `--watch`.

## Watch mode

`chokidar.watch(glob, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 } })` with a debounce flag to avoid concurrent `convert()` calls:

```ts
let running = false;
let pending = false;
const trigger = async (what, which) => {
  if (running) { pending = true; return; }
  running = true;
  await convert(runOptions);
  running = false;
  if (pending) { pending = false; void trigger('Rebuild', which); }
};
```

One pending rebuild is held; any additional changes during a run coalesce into a single follow-up.

## REPL (`repl.ts`)

### Session

Mutable state that slash commands modify:

```ts
interface Session {
  inputDir, outputDir, mode, format,
  toc, cover, singleFile, recursive,
  pageNumbers, showLinkUrls,
  concurrency,  // always 1 inside REPL so the progress bar works
  accent, design, header, footer
}
```

Seeded by `defaultSession(opts.initial)` in `runRepl`.

### Command metadata (single source of truth)

```ts
interface CommandMeta { name, argHint, description, group }
const COMMAND_META: CommandMeta[] = [ ... ]
```

Used by `/help`, the dropdown (`filterCommands`), and the ghost hint. Add a new slash command by appending here + adding a handler in the `COMMANDS` map; all UI bits update automatically.

Groups:

- `primary` — core actions (`help`, `convert`, `design`, `mode`).
- `flags` — pipeline toggles (`toc`, `cover`, `pages`, `single`, `recursive`, `accent`).
- `session` — working-set and meta (`input`, `output`, `ls`, `status`, `open`, `clear`, `exit`, `quit`).

### Raw-mode UI (`ReplUi`)

Only attaches when `process.stdin.isTTY && process.stdout.isTTY`. Piped-input tests transparently skip it.

- `readline.emitKeypressEvents(process.stdin)` + `setRawMode(true)` → individual keystrokes.
- Dropdown is drawn below the prompt when the current line starts with `/`. Up/Down cycles `selectedIdx`, Tab/Enter accepts, Esc dismisses.
- Ghost hint is shown after the cursor when the prefix has exactly one "best match". `Right` or `End` accepts.
- Resize handler clears the drawn UI so it doesn't leave artifacts.
- SIGINT handler clears the UI; readline handles the line clear.

### Line submission flow

On `rl.on('line', ...)`:

1. Clear drawn UI (`ui.clearAll()`).
2. Render the submitted line as a compact "you" bubble (on TTY) so chat turns are visually distinct.
3. If empty or non-slash, print a hint and re-prompt.
4. Parse `/<cmd> <args...>`. Look up in `COMMANDS`. Run.
5. Return `'exit'` from a handler to close the REPL.

### Panels

`/help`, `/status`, `/design info`, and the welcome block use `boxen` with the terracotta rounded-border style. Keep them consistent.

## Banner (`banner.ts`)

Exports `renderBanner(): string`. A 3D gradient ANSI Shadow wordmark with an isometric 4-point starburst and an `A W E S O M E` eyebrow, colored via 24-bit true-color where supported.

Gating:

- `cli.ts` calls `renderBanner()` ONLY when `shouldShowBanner(opts)` is true.
- Respect `--no-banner` and `MDTOPDF_NO_BANNER`. CI is expected to disable it.
- Never call from converter / per-file code.

## Progress (`progress.ts`)

Class `ProgressReporter` implements `StageEmitter`:

- `startBatch(total)` — opens the overall bar when `total > 1`.
- `startFile(name)` — opens the per-file bar.
- `stage(stage)` — advances the per-file bar to the progress percentage mapped for that stage:

  | stage | % |
  |---|---|
  | parse | 15 |
  | html | 35 |
  | browser | 60 |
  | render | 85 |
  | write | 100 |
- `completeFile(bytes, ms)` — finalises the per-file bar and bumps the overall bar.
- `failFile(msg)` — marks the file failed.
- `endBatch()` — closes the overall bar.

### `canBar` rule (from [src/converter.ts](src/converter.ts))

```ts
const canBar =
  (useProgressBars ?? true) &&
  Boolean(process.stdout.isTTY) &&
  (singleFile || concurrency === 1 || files.length === 1);
```

If `canBar` is true, use the progress bar; otherwise fall back to ora spinners. Mixing them corrupts stdout.

## Logger (`logger.ts`) & colors (`tty-colors.ts`)

- `logger.info / warn / error / success` — indented, branded prefix icons (`!`, `x`, `v`).
- `logger.banner(text)` — bordered brand heading.
- `logger.spinner(text)` — ora spinner in brand yellow.
- `logger.summary(stats)` — final summary table.
- `logger.muted / brand` — string formatters for inline use.
- `tc` from `tty-colors` — palette-aware chalk wrappers. Uses 24-bit hex when `FORCE_COLOR=3` / Windows Terminal / modern TTYs; degrades to 256-color on older.

NEVER write raw `console.log` from app code. See [20-logger-and-console.mdc](.cursor/rules/20-logger-and-console.mdc) for exceptions.

## Mode prompt (`prompt.ts`)

`askMode(defaultMode: RenderMode)` uses the `prompts` package. Called by `cli.ts` in one-shot mode when `--mode` is absent. In the REPL, mode is always pre-set via `Session.mode`.

## Common tasks

- Add a CLI flag: [.cursor/instructions/add-cli-flag.md](.cursor/instructions/add-cli-flag.md).
- Add a slash command: [.cursor/instructions/add-slash-command.md](.cursor/instructions/add-slash-command.md).
- Debug non-TTY behaviour: pipe input (`echo "/status\n/exit" | node bin/awesome-md-to-pdf.js`). The raw-mode UI must not attach.
- Add a new color: add a helper to `tty-colors.ts`, then use it via `tc.<name>(text)`. Don't import `chalk` directly in new code.

## Gotchas

- The REPL forces `concurrency: 1` to keep the progress bar usable. Do not override.
- The banner must print BEFORE any spinner or progress bar; it uses cursor-absolute writes that collide with bars.
- `readline.setRawMode` must be balanced with a re-set to `false` on detach, or the terminal stays in raw mode after the process exits. `ReplUi.detach()` handles this.
- `process.stdin.pause()` on close is intentional — without it, `/exit` can hang on "See you next time." while an idle stdin listener keeps the event loop alive.
- Commander's `--no-banner` sets `opts.banner === false` (NOT `opts.noBanner === true`). Use the documented `shouldShowBanner` helper.
- Watch-mode `chokidar` globs must match the converter's discovery; any new discovery rule (e.g. `.mdx`) must update both.

## File pointers

- [src/cli.ts](src/cli.ts) — run/parse/route/watch.
- [src/repl.ts](src/repl.ts) — interactive loop, UI.
- [src/banner.ts](src/banner.ts) — welcome banner.
- [src/progress.ts](src/progress.ts) — progress bar.
- [src/prompt.ts](src/prompt.ts) — mode prompt.
- [src/logger.ts](src/logger.ts) — output helpers.
- [src/tty-colors.ts](src/tty-colors.ts) — color detection + palette.
- [src/converter.ts](src/converter.ts) — the `canBar` switch lives here.
- [docs/cli-reference.md](docs/cli-reference.md), [docs/chat-mode.md](docs/chat-mode.md) — user-facing docs.
