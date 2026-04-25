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
- **BREAKING:** Removed legacy `--design` / single-design session flow. Use
  `--design-light` and `--design-dark` (CLI) and `/design light|dark ...` (chat mode).

## 0.2.0-beta.1

**BREAKING:** `DESIGN.md` parsing has been rewritten to follow Google's
official [DESIGN.md spec](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md) exactly. The
legacy prose-heuristic parser has been removed; a `DESIGN.md` must now ship a
YAML frontmatter block (between `---` lines) that declares its design tokens.

Any `DESIGN.md` authored in the old prose-only style (bullet lists under
"Color Palette & Roles") will no longer parse and will produce a
`DesignParseError: NO_YAML_FOUND`. Migrate by wrapping the normative tokens
in YAML frontmatter; see [docs/designs.md](./designs.md) for the format and
[src/designs/README.md](../src/designs/README.md) for a worked example.

Highlights:

- New YAML parser in `src/design.ts` that implements the full spec surface:
  `colors`, `typography`, `rounded`, `spacing`, `components` with
  `{token.path}` reference resolution.
- Per-level typography scale (`--type-h1-*`, `--type-body-md-*`, `--type-code-*`,
  etc.) that lets a DESIGN.md author retune every heading, body, and code
  selector without touching the package's CSS.
- Component containers in markdown: `::: button-primary`, `::: card`, `::: chip`,
  etc. consume the resolved `components.*` tokens as CSS custom properties.
- All bundled fixtures (`apple`, `figma`, `linear`, `nike`, `stripe`, `uber`,
  `vercel`) rewritten as spec-compliant YAML DESIGN.md files. The Claude
  baseline (`src/designs/claude.md`) is also spec-compliant.
- `npm run verify:design` now checks hex validity, required tokens
  (`colors.primary`, `typography.body-md`), reference resolution, plus five
  negative paths (no-YAML, YAML-syntax-error, duplicate `## Colors`,
  unresolved ref, invalid color).
- New `npm run verify:visual` smoke-tests the full DESIGN.md -> PDF -> PNG
  pipeline against checked-in baselines in `scripts/baselines/`.
- Dimensions accept `pt` and `%` in addition to the spec's `px | em | rem` --
  a PDF-specific extension documented in [docs/designs.md](./designs.md).

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
  [`samples/design-fixtures/`](https://github.com/behl1anmol/awesome-md-to-pdf/tree/main/samples/design-fixtures)
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
