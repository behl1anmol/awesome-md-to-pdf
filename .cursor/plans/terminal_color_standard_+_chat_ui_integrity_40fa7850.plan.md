---
name: Terminal Color Standard + Chat UI Integrity
overview: "Adopt a terminal-safe color standard so body text renders on both light and dark terminals, and fix the remaining chat UI regressions: blank prompt header after a command, dropdown/suggestion misbehavior after errors, blank filenames in /convert progress bar, blank values in /status, and tab completion that inserts wrong/partial text for infix selections."
todos:
  - id: color-palette
    content: Add src/tty-colors.ts with the tc helper (body, bodyBold, meta, muted, brand, brandBold, error, success, link) and a rule comment
    status: completed
  - id: repl-colors
    content: "In src/repl.ts, replace #141413 and #4d4c48 usages in printWelcome, renderYouBubble, renderDropdownRow, cmdHelp, cmdDesign, cmdStatus, cmdInput, cmdOutput, cmdAccent, cmdLs with tc.* helpers"
    status: completed
  - id: logger-colors
    content: "In src/logger.ts, replace every #141413 and #4d4c48 in summary, banner, and info with tc.bodyBold / tc.body / tc.meta"
    status: completed
  - id: progress-colors
    content: In src/progress.ts startFile format, replace chalk.hex('#141413')(label.padEnd(32)) with tc.body so the filename column is readable
    status: completed
  - id: banner-colors
    content: "In src/banner.ts renderTaglineLines, replace the #4d4c48 body helper with tc.body so tagline body text uses the terminal default foreground"
    status: completed
  - id: prompt-integrity
    content: Add a rePrompt helper in src/repl.ts that does cursorTo(0)+clearLine+setPrompt+prompt on TTY, call it from every line-handler exit, and teach renderYouBubble to clear wrapped rows based on terminal columns
    status: completed
  - id: tab-complete
    content: Rewrite applyCompletion (and applyGhost) in src/repl.ts to replace the entire rl.line with '/<name>' (+ trailing space when argHint exists) via rl._refreshLine(), and reset ghost/dropdown overlay state
    status: completed
  - id: smoke
    content: "Non-TTY pipe regression (/help, /status, /exit). TTY walkthrough: /help, /status, /convert samples/demo.md, tab-complete an infix match like /ng -> /convert, run two commands in a row and verify the prompt prefix survives"
    status: completed
isProject: false
---

## Root cause

All five reported bugs share one of two causes:

- **Dark-on-dark text.** Body text and emphasized values across the CLI are rendered in `#141413` (Anthropic Near Black) and `#4d4c48` (Charcoal Warm). These colors are beautiful on the Parchment PDF canvas but invisible on a dark terminal. This explains the blank `[md-to-pdf . light]` prompt prefix (actually not caused by this -- see below), the blank `/status` values, the blank progress-bar filename, and the blank `/help` description columns visible in the screenshots.
- **Cursor integrity around `rl.prompt()`.** Some commands emit output that does not end on column 0 of a fresh line (cli-progress bar closes without a trailing `\n`, boxen panels are fine, but the Enter -> `you` bubble path assumes the echoed prompt row is exactly one terminal row tall). When the next prompt is printed starting mid-line, the opening `[md` characters can be visually chopped off (image 2). The tab-completion bug is a third issue: `applyCompletion` naively slices `cmd.name` by the token length, which mis-completes infix matches.

## Color standard (new)

Adopt a single semantic palette for all terminal output. The rule: never dye *body* text; let the terminal's configured foreground win, since that is always readable on the terminal the user actually chose. Only color semantic accents.

Create a new small module [src/tty-colors.ts](src/tty-colors.ts):

```ts
import chalk from 'chalk';

/** Terminal-safe color palette.
 *  Body text is INTENTIONALLY uncolored so it always reads correctly on
 *  both light and dark terminals. Color is reserved for semantic accents. */
export const tc = {
  body: (s: string) => s,                              // terminal default fg
  bodyBold: (s: string) => chalk.bold(s),              // emphasis via weight, not hue
  meta: (s: string) => chalk.hex('#87867f')(s),        // stone gray -- neutral on both
  muted: (s: string) => chalk.hex('#87867f').dim(s),
  brand: (s: string) => chalk.hex('#c96442')(s),       // terracotta
  brandBold: (s: string) => chalk.hex('#c96442').bold(s),
  error: (s: string) => chalk.hex('#b53333')(s),       // crimson
  errorBold: (s: string) => chalk.hex('#b53333').bold(s),
  success: (s: string) => chalk.hex('#6b7a5a')(s),     // muted green (already in use)
  link: (s: string) => chalk.hex('#5a7a8a')(s),        // muted blue
};
```

Document the convention with a comment at the top: "terminal colors never use `#141413`/`#30302e`/`#3d3d3a`/`#4d4c48` -- those are for the PDF canvas only".

## Per-file replacements

### [src/repl.ts](src/repl.ts)

- `printWelcome`: `#4d4c48` text becomes `tc.body`; the literal `/` and `/help` tokens stay `tc.brand`.
- `renderYouBubble`: bubble content `chalk.hex('#4d4c48')(line)` becomes `tc.bodyBold(line)` (bold so the user's own text pops inside the bubble).
- `renderDropdownRow`: selected-row desc `#4d4c48` becomes `tc.body` (when selected against the terracotta highlight); unselected stays `tc.meta`.
- `cmdHelp`: description column `#4d4c48` becomes `tc.body`.
- `cmdDesign`: `Active: ...`, `Source: ...`, `Using built-in Claude baseline.` all drop `#141413` / `#4d4c48` for `tc.bodyBold` or `tc.body`. Continue using `tc.meta` for the source path.
- `cmdStatus`: value column `chalk.hex('#141413')(v)` becomes `tc.body(v)`. This is the direct fix for the blank Session panel in image 5.
- `cmdInput`, `cmdOutput`, `cmdAccent`, `cmdLs` (file rows): replace `#4d4c48` with `tc.body`.

### [src/progress.ts](src/progress.ts)

- `startFile` format string: `chalk.hex('#141413')(label.padEnd(32))` becomes `tc.body(label.padEnd(32))`. This fixes the blank filename in image 3 and 4.

### [src/logger.ts](src/logger.ts)

- `summary` heading, file rows, totals: every `chalk.bold.hex('#141413')` / `chalk.hex('#141413')` becomes `tc.bodyBold` or `tc.body`.
- `chalk.hex('#4d4c48')(item.out)` becomes `tc.body(item.out)`.
- `info` stays `tc.meta` (currently `#5e5d59` which is borderline dark -- swap to `#87867f` via `tc.meta`).

### [src/banner.ts](src/banner.ts)

- `body = chalk.hex('#4d4c48')(s)` in `renderTaglineLines` becomes `tc.body` (no color). The tagline keeps its terracotta/stone-gray accents; only the body phrases default to the terminal's own foreground.

## Chat UI integrity fixes

### Prompt cursor integrity (Bug 1 and 2 -- prompt prefix `[md` chopped)

After every command dispatch in the `rl.on('line', ...)` handler, the prompt sometimes lands mid-line because cli-progress closes without a final `\n`. Guarantee a clean start by writing a reset sequence immediately before `rl.setPrompt(...)` / `rl.prompt()`:

```ts
if (tty) {
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
}
ui.submitting = false;
rl.setPrompt(renderPrompt(session));
rl.prompt();
```

Done once in a small helper `rePrompt(rl, session, tty, ui)` and called from every line-handler exit path (empty, non-slash, unknown, handler-returned, handler-threw). No extra blank line, no visible artifact -- just ensures column 0.

### `renderYouBubble` handles wrapped prompt rows

Current erase moves up one row only. For long commands the prompt+input can wrap. Compute row count from the visible prompt width + input length / `process.stdout.columns` and clear each wrapped row. Pseudo:

```ts
function renderYouBubble(line: string, promptVisible: string): void {
  const cols = process.stdout.columns || 80;
  const rows = Math.max(1, Math.ceil((visibleLen(promptVisible) + line.length) / cols));
  for (let i = 0; i < rows; i++) {
    readline.moveCursor(process.stdout, 0, -1);
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }
  ...existing bubble render...
}
```

The caller (the `line` handler) passes the current prompt string so we don't need to re-derive it.

### Tab completion (Bug 4)

Current `applyCompletion` mis-completes when the arrow-selected command is an **infix** match (e.g. user typed `/ng`, arrow-selected `/convert`: today we'd splice `'vert'` after `/ng`, producing `/ngvert`). Fix by replacing the entire buffer:

```ts
private applyCompletion(cmd: CommandMeta): void {
  this.clearGhost();
  const replacement = '/' + cmd.name + (cmd.argHint ? ' ' : '');
  const rl = this.rl as unknown as {
    line: string;
    cursor: number;
    _refreshLine: () => void;
  };
  rl.line = replacement;
  rl.cursor = replacement.length;
  rl._refreshLine();
  // After refresh, reset our overlay state; the dropdown/ghost will redraw
  // on the next keystroke.
  this.suggestionsDrawn = 0;
  this.ghostLen = 0;
  this.selectedIdx = 0;
  this.lastToken = replacement.slice(1);
}
```

`_refreshLine` is a long-stable readline internal; using it is safer than trying to emulate `\u0001` + `\u000b` + text because it redraws cleanly and readline's own cursor accounting stays in sync.

Same `infix-slice` bug exists in `applyGhost` (Right/End arrow). Apply the same replacement pattern there.

## Todos mapping

Todos are already created in the plan sidebar. The intended mapping:

- color-palette: add [src/tty-colors.ts](src/tty-colors.ts) with the `tc` helper
- repl-colors: replace dark hexes in [src/repl.ts](src/repl.ts) per above
- logger-colors: same in [src/logger.ts](src/logger.ts)
- progress-colors: same in [src/progress.ts](src/progress.ts)
- banner-colors: same in [src/banner.ts](src/banner.ts)
- prompt-integrity: add `rePrompt` helper + wrapped-row `renderYouBubble`
- tab-complete: rewrite `applyCompletion` and `applyGhost` to replace the full buffer via `rl._refreshLine`
- smoke: pipe regression + TTY walkthrough covering `/help`, `/status`, `/convert samples/demo.md`, tab completion of an infix match, two consecutive commands

## Acceptance checks

- On a dark terminal, `/status` shows every value, `/convert` shows the filename inside the progress bar, `/help` shows every description, the summary shows per-file filenames and the totals.
- Typing `/` after `/help` displays the full prompt `[md-to-pdf . light] > /` with no chopped `[md` and no blank prefix.
- Typing `/ng`, arrow-down to `/convert`, pressing Tab produces `/convert ` (trailing space) -- not `/ngvert`, not `/ng`, and not the ghost text.
- Non-TTY piped runs still produce clean output (same shape as the previous smoke test).
- The standard is documented once in [src/tty-colors.ts](src/tty-colors.ts); future terminal-text edits import `tc` instead of picking hex values.