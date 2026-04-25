---
title: Themes & modes
layout: default
nav_order: 7
---

# Themes & modes
{: .no_toc }

Every design has both a **light** and a **dark** mode. You pick one per
conversion; the chosen mode swaps the root CSS variables and the syntax
highlighting theme accordingly.
{: .fs-5 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Light mode

The default (and the namesake of this site's theme). Parchment canvas,
warm ivory surfaces, terracotta accents, near-black text.

```bash
awesome-md-to-pdf docs --mode light
```

## Dark mode

Near-black canvas, ivory text, coral accent. Tuned so code blocks and
Mermaid diagrams stay legible without glowing.

```bash
awesome-md-to-pdf docs --mode dark
```

## Prompted mode

If you omit `--mode`, the CLI prompts you:

```text
? Render mode > (Use arrow keys)
  light -- Parchment canvas
  dark  -- Near Black canvas
```

Set `MD_TO_PDF_MODE=light` (or `dark`) to bypass the prompt in CI without
having to add the flag everywhere.

## Accent override

`--accent <hex>` replaces just the brand color in whichever mode is active.
Useful when a design is otherwise perfect but the brand accent clashes
with your document's subject.

```bash
awesome-md-to-pdf docs --design-light designs/linear-light.md --design-dark designs/linear-dark.md --mode dark --accent "#a855f7"
```

{: .tip }
> Accents re-tint links, list bullets, active chips, and the focus ring.
> Headings and body text stay in the design's own colors.

## Fonts

All three stacks (`serif`, `sans`, `mono`) come from the active design.
If a named font isn't installed on the system Chromium uses the cascading
fallback automatically -- typically Georgia / system-ui / JetBrains Mono.

See [Troubleshooting -> Fonts look different](./troubleshooting#fonts-look-different)
if you need to bundle custom fonts.

## Page canvas

All modes render **full-bleed** by default: the canvas extends to every
page edge with typographic margins inside the content (22 mm / 20 mm /
24 mm / 20 mm on A4).

Enabling `--page-numbers`, `--header`, or `--footer` reserves a band at
the page edge and breaks full-bleed. Combine those with a different
`--format` if you need US-Letter compliance for print shops.
