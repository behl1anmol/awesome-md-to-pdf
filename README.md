# Designs

Drop any `DESIGN.md` into this folder (or point `--design` at a path anywhere on disk) and awesome-md-to-pdf will render your PDFs in that visual system.

## Where to get DESIGN.md files

The easiest source is [getdesign.md](https://getdesign.md) — an open collection of design specs for 60+ popular brands (Stripe, Linear, Vercel, WIRED, Notion, and many more). Each brand page has a **DESIGN.md** tab: open it, copy the content, paste it into a `.md` file, and drop the file here or anywhere on disk.

Example:

```bash
# Convert a directory using the Linear design language
awesome-md-to-pdf docs --design ./designs/linear.md --mode dark

# Or from inside the chat REPL:
/design ./designs/linear.md
/convert docs
```

## What gets extracted

The parser (see `src/design.ts`) pulls out:

- **Palette** — from the "Color Palette & Roles" section (always present on getdesign.md files), with the "Quick Color Reference" section acting as a higher-signal override when available.
- **Typography** — font families for serif/sans/mono from the "Typography Rules" section. Compound labels such as `Body / UI:`, `Monospace / Labels:`, and `Display / Buttons:` are supported — the first keyword wins and the qualifier after the slash is discarded.
- **Dark mode** — from explicit dark tokens when mentioned; otherwise synthesized by inverting the light palette. A line only contributes to the dark palette when `dark` acts as a **role qualifier** (`dark mode`, `dark surface`, `dark theme page background`); descriptive prose such as `text on dark surfaces` is correctly ignored.

Anything we can't cleanly map falls back to the bundled Claude baseline so the PDF is never worse than the default.

## Recognized role vocabulary

For every color literal, the parser builds a **context phrase** from the
text on both sides of the hex and runs it against a table of
functional-role synonyms (no brand names). A non-exhaustive cheat sheet:

| Slot | Recognized phrases |
| --- | --- |
| `textPrimary` | `all text`, `primary text`, `headings and body`, `pure black`, `true black`, `near black` |
| `textSecondary` | `secondary text`, `muted text`, `body gray`, `gray 600/700` |
| `textTertiary` | `tertiary text`, `metadata`, `caption`, `footnote`, `disabled text` |
| `bgPage` | `page background`, `root background`, `all backgrounds`, `body background`, `canvas`, `pure white` |
| `bgSurface` | `card surface(s)`, `elevated surface`, `container`, `panel` |
| `brand` | `primary cta`, `primary button`, `solid buttons`, `cta`, `accent`, `brand color`, `link blue`, `active states` |
| `brandSoft` | `brand hover`, `cta hover`, `accent hover` |
| `borderSoft` | `borders`, `borders default`, `subtle border`, `hairline`, `divider` |
| `error` | `error`, `danger`, `negative red`, `crimson` |
| `focus` | `focus ring`, `focus outline` |

When a description names **two or more different role families**
(`All text, all buttons, all borders`; `Page background, card surfaces`),
the same color is assigned to every matching slot in a single pass.

## Bundled designs

- `claude.md` — the reference design used for development. It's a condensed copy of the full Claude DESIGN.md from getdesign.md.
