---
title: Changelog
layout: default
nav_order: 12
---

# Changelog

Releases are driven by [GitHub Releases](https://github.com/<owner>/awesome-md-to-pdf/releases).
Each published release also triggers an automated `npm publish` with
[provenance](https://docs.npmjs.com/generating-provenance-statements),
so every version on the npm registry is cryptographically linked to a
specific commit and GitHub Actions run.

## Upcoming (`main`)

- Full CI / publish / Pages automation under [`.github/workflows/`](https://github.com/<owner>/awesome-md-to-pdf/tree/main/.github/workflows).
- Documentation site at [`docs/`](https://github.com/<owner>/awesome-md-to-pdf/tree/main/docs)
  powered by Just the Docs with a custom `parchment` color scheme.

## 0.1.1

Broader `DESIGN.md` parsing so files authored in generic functional
English (not just the Claude dialect) resolve their palette correctly.

- Parser now reads both the name BEFORE the hex and the description AFTER
  the hex when deciding which token slot a color belongs to. Descriptions
  like `All text, all solid buttons, all borders` now populate
  `textPrimary`, `brand`, and `borderSoft` simultaneously.
- Expanded the role-synonym table with universal functional vocabulary
  (`page background`, `card surfaces`, `primary cta`, `active states`,
  `divider`, ...) while keeping the legacy Claude-specific names for
  back-compat. Zero new brand names were added.
- Compound font labels are parsed: `Body / UI:`, `Monospace / Labels:`,
  `Display / Buttons:` now all resolve correctly.
- The dark-palette filter no longer mis-classifies descriptive prose
  such as `text on dark surfaces` as dark-mode role lines.
- New `npm run verify:design` script and fixture corpus under
  [`samples/design-fixtures/`](https://github.com/<owner>/awesome-md-to-pdf/tree/main/samples/design-fixtures)
  guard the parser against regressions.

## 0.1.0

Initial public snapshot.

- Claude/Anthropic-inspired editorial base design.
- Dynamic `DESIGN.md` parser ([getdesign.md](https://getdesign.md) integration).
- Interactive chat mode with slash commands, ghost hints, and a live
  progress bar per file.
- 3D gradient welcome banner.
- Mermaid, KaTeX, admonitions, footnotes, task lists, GFM tables.
- Light and dark modes, full-bleed canvas, watch mode.
