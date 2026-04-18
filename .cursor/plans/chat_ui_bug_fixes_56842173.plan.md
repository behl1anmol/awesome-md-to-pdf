---
name: Chat UI bug fixes
overview: "Fix four concrete REPL bugs: the invisible \"md-to-pdf\" and \"Welcome.\" labels caused by using near-black on a dark terminal; the endless-dropdown rendering caused by save/restore-cursor interacting badly with scroll plus a race between setImmediate refreshes and the line event; and add a compact rounded \"you\" bubble around each user command so chat turns are visually distinct."
todos:
  - id: terminal-colors
    content: "Replace #141413 (Near Black, invisible on dark terminals) with #c96442 (Terracotta) for the 'md-to-pdf' prompt label and 'Welcome.' in printWelcome"
    status: completed
  - id: dropdown-redraw
    content: Rewrite drawDropdown/clearDropdown in src/repl.ts using readline.moveCursor + cursorTo + clearScreenDown; cap visible rows at 5; track visible prompt width for cursor restoration
    status: completed
  - id: enter-race
    content: Handle Enter/Return synchronously in the keypress handler (clear + set submitting flag) so pending setImmediate refreshes don't draw after command output
    status: completed
  - id: drawing-flag
    content: Add a drawing reentrancy flag so fast typing can't interleave two draws
    status: completed
  - id: user-bubble
    content: On every rl.on('line') event in TTY mode, erase the echoed prompt+input line and replace with a compact rounded boxen panel titled 'you' containing the user's command
    status: completed
  - id: smoke
    content: "Re-run: (a) non-TTY pipe test for regressions, (b) interactive TTY check of dropdown replacement behavior and the 'you' bubble, (c) confirm prompt + welcome labels render visibly on a dark terminal"
    status: completed
isProject: false
---

## Bug 1 & 2 - Invisible "md-to-pdf" and "Welcome." -- [src/repl.ts](src/repl.ts)

Current code in `renderPrompt`:

```ts
chalk.hex('#141413').bold('md-to-pdf')
```

and in `printWelcome`:

```ts
chalk.hex('#141413').bold('Welcome.')
```

`#141413` is Anthropic Near Black -- perfect on a Parchment PDF canvas, invisible on a typical dark terminal. Same color is the reason the "Welcome." greeting reads as empty space before "Type /".

Fix: use a terminal-visible warm color for any text that's meant to pop as the product brand voice. Terracotta `#c96442` is already our brand and reads well on both light and dark terminals (chalk falls back to 256-color terracotta-ish on lower-color terminals).

```ts
// Prompt tag
chalk.hex('#c96442').bold('md-to-pdf')   // was chalk.hex('#141413').bold(...)

// Welcome panel lead
chalk.hex('#c96442').bold('Welcome.')    // was chalk.hex('#141413').bold(...)
```

Apply the same swap to the boxen panel titles in `boxWithBorder` for `Commands` / `Session` / `Design` (already coloured with the border-hex variable, but I'll double-check nothing near-blacks in there).

## Bug 3 - Endless / stale dropdowns -- [src/repl.ts](src/repl.ts)

Two compounding root causes:

### 3a. Scroll invalidates `\x1b7` / `\x1b[u` save-restore

Current `drawDropdown` uses:

```text
write '\x1b7\x1b[s'   // save cursor
write '\n'
write '\x1b[0J'       // clear to end of screen
write row + '\n'  (* N)
write '\x1b[u\x1b8'   // restore cursor
```

When the prompt line is near the bottom of the viewport, each `\n` in the row loop scrolls the buffer up. After N scrolls the saved position is stale -- restore puts the cursor somewhere inside the now-drawn panel, so subsequent writes land in the wrong place and we get the "dropdown drawn multiple times" effect.

Fix: use Node's built-in `readline.moveCursor` / `readline.cursorTo` / `readline.clearScreenDown`. These are scroll-aware. Replace save/restore entirely with explicit relative moves, and track the visible prompt width so we can snap the cursor back to the right input column.

```ts
import { moveCursor, cursorTo, clearScreenDown } from 'readline';

function visibleLen(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

private drawDropdown(matches: CommandMeta[]): void {
  const rl = this.rl as unknown as { line: string; cursor: number };
  const promptWidth = visibleLen(this.currentPrompt);
  const inputCol = promptWidth + rl.cursor;

  // Always clear first, then draw. Drops the old panel on the floor cleanly.
  moveCursor(process.stdout, -inputCol, 1);    // to column 0, one row below prompt
  cursorTo(process.stdout, 0);
  clearScreenDown(process.stdout);

  if (matches.length === 0) {
    moveCursor(process.stdout, 0, -1);          // back up to prompt row
    cursorTo(process.stdout, inputCol);
    this.suggestionsDrawn = 0;
    return;
  }

  const MAX = 5;                                // was 8 -- keep small to avoid scrolls
  const visible = matches.slice(0, MAX);
  const extra = matches.length - visible.length;

  for (let i = 0; i < visible.length; i++) {
    process.stdout.write(renderDropdownRow(visible[i], i === this.selectedIdx));
    if (i < visible.length - 1 || extra > 0) process.stdout.write('\n');
  }
  if (extra > 0) {
    process.stdout.write('  ' + chalk.hex('#87867f')(`+${extra} more... (type to narrow)`));
  }

  const drawn = visible.length + (extra > 0 ? 1 : 0);
  moveCursor(process.stdout, 0, -drawn);         // back up over the panel
  cursorTo(process.stdout, inputCol);            // back to the input column
  this.suggestionsDrawn = drawn;
}
```

Store `this.currentPrompt` once per `rl.setPrompt(...)` call so visible width is free to compute. Drop `clearDropdown()`'s old loop entirely -- `clearScreenDown` handles it in one call.

### 3b. setImmediate fires AFTER the line event

Current flow:

1. User types last char, `keypress` fires -> `setImmediate(refresh)` scheduled.
2. User presses Enter.
3. `keypress` for Enter fires -> `setImmediate(refresh)` scheduled again.
4. `line` event fires -> `this.clearAll()` -> dispatch runs and prints output.
5. The two pending `setImmediate`s now fire and redraw the dropdown BELOW the output.

Fix: handle Enter synchronously in the keypress handler so the dropdown disappears before the line event ever fires, and mark a `submitting` flag that cancels any pending refresh:

```ts
private submitting = false;

private handleKeypress(_ch, key: KeypressKey | undefined): void {
  if (!key) return;

  if (key.name === 'return' || key.name === 'enter') {
    this.submitting = true;
    this.clearAll();                    // synchronous, no setImmediate
    return;
  }

  // navigation keys as before ...

  setImmediate(() => {
    if (this.submitting) return;        // skip stale refreshes
    this.refresh();
  });
}
```

Reset `this.submitting = false` immediately before calling `rl.prompt()` inside the `line` handler.

### 3c. Extra guard: serialize redraws

Add a tiny `drawing` reentrancy flag inside `refresh()` so fast typing can't start a second `drawDropdown` before the first finishes (all stdout writes are synchronous but Node can still interleave setImmediate callbacks):

```ts
private drawing = false;
private refresh() {
  if (this.drawing) return;
  this.drawing = true;
  try {
    // ... redraw ...
  } finally {
    this.drawing = false;
  }
}
```

## Bug 4 - Rounded "you" bubble around each user command -- [src/repl.ts](src/repl.ts)

After each Enter, the echoed prompt line (`[md-to-pdf · light] › /help`) sits in scrollback as plain text. Replace it with a compact rounded boxen panel titled "you" so chat turns are visually distinct. Non-TTY (piped input) stays unchanged because readline doesn't echo there anyway.

```ts
rl.on('line', async (rawLine) => {
  ui.clearAll();

  const line = rawLine.trim();
  if (line && tty) {
    // Erase the echoed prompt+input line that readline just wrote.
    moveCursor(process.stdout, 0, -1);
    cursorTo(process.stdout, 0);
    process.stdout.write('\x1b[2K');

    // Render as a compact bubble.
    const content = chalk.hex('#4d4c48')(line);
    console.log(
      boxen(content, {
        borderStyle: 'round',
        borderColor: '#c96442',
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 0, left: 2, right: 0 },
        title: chalk.hex('#c96442').bold('you'),
        titleAlignment: 'left',
      })
    );
  }

  // existing dispatch continues unchanged ...
});
```

Visual result (light mode):

```text
  +- you ------+
  | /help      |
  +------------+

  +- Commands --------------------------------+
  | Primary                                   |
  | /help   Show this help panel.             |
  ...
```

Dark mode uses the coral border variant we already use in `boxWithBorder`.

Empty lines (just Enter) stay invisible (no bubble, no box). Non-TTY keeps piped-input semantics intact.

## Files touched

- [src/repl.ts](src/repl.ts): swap `#141413` -> `#c96442` for brand labels, rewrite `drawDropdown` / `clearDropdown` using `readline.moveCursor` + `cursorTo` + `clearScreenDown`, add `submitting` + `drawing` flags, handle Enter synchronously, emit the "you" bubble on each line event, cache `currentPrompt` alongside `rl.setPrompt`.

No changes to converter, pdf renderer, design parser, banner, template, or the public CLI surface.

## Acceptance checks

- Typing `/` in an interactive terminal shows exactly one filtered dropdown below the prompt. Every subsequent keystroke replaces it in place -- no stacked rows, no orphan rows ever.
- Pressing Enter on `/help` shows: the old prompt line replaced by a small `+- you -+ | /help |` bubble, followed by the existing `/help` panel. No dropdown appears below the help output.
- The prompt reads `[md-to-pdf · light] ›` with `md-to-pdf` visible in terracotta on both light and dark terminals.
- The welcome panel opens with a visible `Welcome.` followed by `Type / and pick a command...`.
- Non-TTY piped runs (`'/help','/exit' | node bin/md-to-pdf.js`) still produce clean plain-text output with no box errors and no missing labels.
- `/help`, `/status`, `/design info` panels look unchanged from the last revision.
