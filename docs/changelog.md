---
title: Changelog
layout: default
nav_order: 12
---

# Changelog

Releases are driven by [GitHub Releases](https://github.com/behl1anmol/awesome-md-to-pdf/releases).
Each published release also triggers an automated `npm publish` with
[provenance](https://docs.npmjs.com/generating-provenance-statements),
so every version on the npm registry is cryptographically linked to a
specific commit and GitHub Actions run.

## Upcoming (`main`)

- Full CI / publish / Pages automation under [`.github/workflows/`](https://github.com/behl1anmol/awesome-md-to-pdf/tree/main/.github/workflows).
- Documentation site at [`docs/`](https://github.com/behl1anmol/awesome-md-to-pdf/tree/main/docs)
  powered by Just the Docs with a custom `parchment` color scheme.

## 0.1.0

Initial public snapshot.

- Claude/Anthropic-inspired editorial base design.
- Dynamic `DESIGN.md` parser ([getdesign.md](https://getdesign.md) integration).
- Interactive chat mode with slash commands, ghost hints, and a live
  progress bar per file.
- 3D gradient welcome banner.
- Mermaid, KaTeX, admonitions, footnotes, task lists, GFM tables.
- Light and dark modes, full-bleed canvas, watch mode.
