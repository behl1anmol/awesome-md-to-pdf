---
title: Chat mode
layout: default
nav_order: 3
---

# Chat mode
{: .no_toc }

Run `awesome-md-to-pdf` with no arguments and you land in a slash-command
REPL with a 3D welcome banner, ghost hints, a live filtered dropdown of
commands, and per-file progress bars.
{: .fs-5 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Entering chat mode

```bash
awesome-md-to-pdf
```

You'll see the gradient ANSI Shadow `MD-TO-PDF` wordmark with the
`A W E S O M E` eyebrow, an asymmetric origami icon, and the prompt:

```text
[◈ · light] ›
```

The `◈` marker at the start of the prompt is the awesome-md-to-pdf
glyph -- a compact Unicode brand mark that matches the origami icon on
the welcome banner.

## Navigation keys

As you type, the REPL helps you along.

| Key | Behavior |
|---|---|
| Type `/` | A filtered dropdown of slash commands docks below the prompt. |
| Keep typing | The dropdown narrows live to matching commands. |
| `Up` / `Down` | Move the selection within the dropdown. |
| `Tab` | Accept the highlighted command and keep typing its arguments. |
| `Right` or `End` | Accept the dim grey "ghost" suggestion after the cursor (fish-shell style). |
| `Enter` | Submit the current line. |
| `Esc` | Dismiss the dropdown and ghost hint. |
| `Ctrl+C` | Cancel the current line. |
| `Ctrl+D` | Leave the chat. |

## Slash commands

Type `/help` inside the REPL for the latest table. Highlights:

| Command | Purpose |
|---|---|
| `/help` | Show the command table. |
| `/convert [path]` | Convert a file or directory. Defaults to the current input dir. |
| `/design <path>` | Load a `DESIGN.md` from disk. `/design reset` reverts. `/design info` previews palette + fonts. |
| `/mode [light\|dark]` | Set the render mode. No argument toggles. |
| `/input <dir>` | Set the working input directory. |
| `/output <dir>` | Set the output directory. |
| `/toc` | Toggle the auto-generated table of contents. |
| `/cover` | Toggle the cover page. |
| `/pages` | Toggle the `page X / Y` footer band. |
| `/single` | Toggle single-file mode (merge all .md into one PDF). |
| `/recursive` | Toggle recursion into subdirectories. |
| `/accent <hex>` | Override the brand accent. `/accent reset` clears. |
| `/ls` | List `.md` files in the input dir. |
| `/status` | Show current session settings. |
| `/open` | Open the output folder in your file manager. |
| `/clear` | Clear the terminal. |
| `/exit`, `/quit` | Leave the chat (Ctrl+D also works). |

## Iterating on a design

A typical chat session:

```text
[◈ · light] › /input notes
[◈ · light] › /design designs/linear.md
[◈ · light] › /mode dark
[◈ · dark] › /toc
[◈ · dark] › /cover
[◈ · dark] › /convert
```

Each `/convert` runs the pipeline with a per-file progress bar showing the
stages: **parsing -> building html -> loading chromium -> rendering -> writing pdf**.

{: .note }
> The progress bar only renders when `--concurrency=1` (the chat default).
> In batch runs with `--concurrency > 1` we fall back to ora spinners so the
> output stays legible.

## Leaving chat

`Ctrl+D`, `/exit`, or `/quit`. State is not persisted between sessions --
by design, chat mode is meant to be transient.
