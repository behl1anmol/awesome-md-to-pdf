# Add a slash command

Reusable workflow for adding a new `/command` to the chat REPL.

- Owner: `frontend-developer`
- Review: `code-reviewer`
- Related rules: [50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc)
- Related skills: `cli-repl-knowledge`

## Checklist

1. Choose a lowercase single-word name. If it collides with an existing command (see `COMMAND_META` in [src/repl.ts](src/repl.ts)), pick another. Reserve pluralized names for settings that take on/off (e.g. `/pages`, `/recursive`) and singular names for actions (e.g. `/convert`, `/open`).
2. Decide the group:
   - `primary` — core action commands (`help`, `convert`, `design`, `mode`).
   - `flags` — toggles for pipeline options.
   - `session` — working-set mutation (`input`, `output`, `ls`, `status`, `open`, `clear`, `exit`).
3. Add the `CommandMeta` entry to `COMMAND_META` in [src/repl.ts](src/repl.ts) with `name`, `argHint` (e.g. `'<path>'`, `'[on|off]'`, `''`), `description`, `group`. `/help` and the autosuggest dropdown read this table directly — no separate wiring.
4. Implement the handler. Add an entry to the `COMMANDS` record (same file). Signature:
   ```ts
   async (args: string[], session: Session): Promise<void | 'exit'>
   ```
   Return `'exit'` from handlers that should close the REPL (see `exit` / `quit`).
5. Inside the handler:
   - Validate args. Print errors via `logger.error(...)` with the same `  x ` prefix style used elsewhere; never throw — it'll print a raw stack to the user.
   - Mutate `session` in place for stateful commands (e.g. `/mode`, `/toc`).
   - Call `convert(...)` for action commands. Do not launch a second `PdfRenderer`; the REPL's `/convert` already handles that inside `convert()`.
6. If the command supports `on|off` / toggle semantics, reuse the same arg parsing style as `/toc` / `/cover` (no arg = toggle, explicit `on`/`off` sets).
7. Update the `/status` output to include the new field if it represents persistent state.
8. Update docs:
   - [docs/chat-mode.md](docs/chat-mode.md) command table.
   - README's chat-mode highlights table.
9. Smoke-test:
   ```bash
   npm run build
   echo "/status\n/your-command args\n/exit" | node bin/awesome-md-to-pdf.js
   ```
   Pipe-driven input uses the non-TTY fallback (no dropdown / ghost hint). Your handler MUST work there too.
10. Commit: `feat(repl): add /your-command`.

## UI interactions to keep working

- Tab/Enter accept the highlighted dropdown item. Right arrow / End accepts the ghost hint.
- Adding a new command automatically appears in the dropdown because `filterCommands` reads `COMMAND_META`.
- If your command renders a panel, reuse `boxen` with the terracotta rounded-border style (see `/help` and `/status` helpers). Do not introduce a new box style.
