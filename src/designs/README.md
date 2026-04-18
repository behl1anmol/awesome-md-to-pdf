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
- **Typography** — font families for serif/sans/mono from the "Typography Rules" section.
- **Dark mode** — from explicit dark tokens when mentioned; otherwise synthesized by inverting the light palette.

Anything we can't cleanly map falls back to the bundled Claude baseline so the PDF is never worse than the default.

## Bundled designs

- `claude.md` — the reference design used for development. It's a condensed copy of the full Claude DESIGN.md from getdesign.md.
