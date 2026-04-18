---
title: Designs
layout: default
nav_order: 6
---

# Designs
{: .no_toc }

`DESIGN.md` is a plain-Markdown, human-authored specification for a brand's
palette and typography. awesome-md-to-pdf parses it and layers the tokens
over the Claude baseline, so every parsed slot wins and every missing slot
falls back gracefully.
{: .fs-5 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Using a design from getdesign.md

[getdesign.md](https://getdesign.md) is an open collection of `DESIGN.md`
specs for 60+ popular brands (Stripe, Linear, Vercel, WIRED, Notion, ...).

1. Open the brand page, e.g. `https://getdesign.md/linear.app/design-md`.
2. Click the **DESIGN.md** tab.
3. Copy the markdown into a file, e.g. `designs/linear.md`.
4. Run:

   ```bash
   awesome-md-to-pdf docs --design designs/linear.md --mode dark
   ```

Or from inside [chat mode](./chat-mode):

```text
/design designs/linear.md
/convert docs
```

## The Claude baseline

The default design (no `--design` flag) is bundled. It produces PDFs styled
after the Anthropic product aesthetic:

- Warm parchment canvas (`#f5f4ed`) with ivory surfaces (`#faf9f5`).
- Serif headings (weight 500) with literary line-height.
- Terracotta brand accent (`#c96442`) with a coral dark-mode sibling (`#d97757`).
- Warm-toned neutrals throughout -- no cool blue-grays (except the focus ring).
- Ring-based depth (`box-shadow: 0 0 0 1px ...`) rather than heavy drop shadows.

See the full token set at
[`src/themes/tokens.css`](https://github.com/<owner>/awesome-md-to-pdf/blob/main/src/themes/tokens.css).

## Authoring your own DESIGN.md

Minimum viable spec:

~~~markdown
# Your Brand

## Color Palette & Roles

- **Brand** `#c96442` -- primary accent, links, CTAs.
- **Canvas** `#f5f4ed` -- page background.
- **Surface** `#faf9f5` -- cards, code blocks.
- **Text Primary** `#141413` -- body copy.
- **Text Secondary** `#5e5d59` -- meta, captions.
- **Border Warm** `#e8e6dc` -- dividers.

## Quick Color Reference

| Token | Hex |
|---|---|
| Brand | #c96442 |
| Canvas | #f5f4ed |
| Text | #141413 |

## Typography

- **Serif** `"Iowan Old Style", Georgia, serif` -- headings.
- **Sans** `"Inter", system-ui, sans-serif` -- body.
- **Mono** `"JetBrains Mono", monospace` -- code.
~~~

The parser walks the **Color Palette & Roles** section first, then the
**Quick Color Reference** block if present, and finally falls back to any
inline hex codes it can find near named roles.

## How the parser discovers roles

For every color literal on a line, the parser stitches together a
**context phrase** from the text **before** the color (the name) and the
text **after** the color (the description) and runs that phrase against
a table of functional-role synonyms. Descriptions carry most of the
signal because the name is typically brand-specific (`Pure Black`,
`Geist Blue`, `Signal Orange`) while the description is written in
universal English.

The recognized functional vocabulary is:

- `textPrimary` -- `all text`, `primary text`, `headings and body`,
  `pure black`, `true black`, `near black`.
- `textSecondary` -- `secondary text`, `muted text`, `body gray`,
  `gray 600/700`.
- `textTertiary` -- `tertiary text`, `metadata`, `caption`, `footnote`,
  `disabled text`, `gray 400/500`.
- `bgPage` -- `page background`, `root background`, `all backgrounds`,
  `body background`, `primary page background`, `canvas`, `pure white`.
- `bgSurface` -- `card surface(s)`, `card background`, `elevated
  surface`, `container`, `panel`.
- `bgSand` -- `section background`, `alternate background`.
- `brand` -- `primary cta`, `primary button`, `solid buttons`, `cta`,
  `accent`, `brand color`, `link blue`, `active states`.
- `brandSoft` -- `brand hover`, `cta hover`, `accent hover`, `hover
  color`.
- `borderSoft` -- `borders`, `borders default`, `subtle border`,
  `hairline`, `divider`.
- `borderWarm` -- `borders strong`, `section divider`.
- `error` -- `error`, `danger`, `negative red`, `crimson`.
- `focus` -- `focus ring`, `focus outline`, `focus color`.

A phrase that mentions **two or more different role families** -- such
as `All text, all buttons, all borders` or `Page background, card
surfaces` -- is treated as a **multi-role declaration** and assigns the
same color to every matching slot in one pass.

Font lines accept compound labels (`Body / UI:`, `Monospace / Labels:`,
`Display / Buttons:`); the first keyword is taken as the authoritative
role and the qualifier after the slash is discarded.

## Dark mode

If the `DESIGN.md` mentions dark-mode tokens explicitly (often as a nested
heading or a second palette block), those are used verbatim. Otherwise
dark-mode tokens are synthesized by inversion + warm bias.

## Overriding just the accent

Don't need a whole design -- just a different link color?

```bash
awesome-md-to-pdf docs --accent "#0ea5e9"
```

Inside chat mode:

```text
/accent 0ea5e9
/accent reset
```

## Inspecting a parsed design

```text
/design designs/linear.md
/design info
```

prints the palette and font stacks extracted from the file so you can
sanity-check the parser before running a batch.

## Implementation pointer

The parser lives at
[`src/design.ts`](https://github.com/<owner>/awesome-md-to-pdf/blob/main/src/design.ts).
It's a forgiving regex + synonym table; any slot it can't cleanly identify
inherits from the Claude baseline so the output never breaks.
