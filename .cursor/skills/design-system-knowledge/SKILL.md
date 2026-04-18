---
name: design-system-knowledge
description: Deep knowledge of the DESIGN.md parser (src/design.ts) and how parsed tokens flow into rendered PDFs. Covers DesignTokens/PaletteTokens/FontTokens, the SYNONYMS synonym table, three-pass extraction (Quick Color Reference, Color Palette & Roles, inline sweep), dark-mode synthesis, font extraction, describeTokens, and the precedence chain with --accent and the Claude baseline. Use when DESIGN.md parsing is involved, when adding a palette slot, or when debugging a mis-extracted color.
triggers: DESIGN.md, accent, palette, PaletteTokens, FontTokens, DesignTokens, parseDesignMd, describeTokens, SYNONYMS, extractPalette, extractDarkPalette, extractFonts, synthesizeDark, getdesign.md, design token, brand color, dark mode, token slot, color role, design inheritance, Claude baseline
---

# Design system

All design-driven theming in awesome-md-to-pdf flows through [src/design.ts](src/design.ts) and lands as CSS custom property overrides emitted by [src/template.ts](src/template.ts). Fonts land the same way, plus mermaid themeVariables via [src/mermaid-runtime.ts](src/mermaid-runtime.ts).

## Types

```ts
export interface PaletteTokens {
  bgPage?, bgSurface?, bgSand?,
  textPrimary?, textSecondary?, textTertiary?,
  brand?, brandSoft?,
  borderSoft?, borderWarm?,
  codeBg?, codeBorder?, codeInlineBg?,
  error?, focus?
}

export interface FontTokens { serif?, sans?, mono? }

export interface DesignTokens {
  name: string;            // derived from H1 "inspired by X" / directory / filename
  source: string;          // absolute path to the parsed DESIGN.md
  rawBytes: number;
  light: PaletteTokens;
  dark: PaletteTokens;
  fonts: FontTokens;
}
```

Every slot in `PaletteTokens` is optional. Missing slots inherit from the Claude baseline at render time — nothing ever crashes because a slot is absent.

## Public API

- `parseDesignMd(target: string): DesignTokens` — parse a file OR a directory that contains a `DESIGN.md`. Never throws for normal parse failures; returns a `DesignTokens` with an empty palette + derived name.
- `resolveDesignFile(target: string): string` — resolve a file/directory path to the actual `.md`. Accepts `DESIGN.md`, `design.md`, `Design.md`, `design-md.md`, `design.markdown`. Falls back to any `*.md` whose name contains "design", then to the sole `*.md` in the dir.
- `describeTokens(tokens: DesignTokens): string` — human-readable summary for `/design info` in the REPL.

## Precedence chain (rendering)

From lowest priority to highest:

1. Claude baseline in [src/themes/tokens.css](src/themes/tokens.css) (`:root` + `[data-mode="dark"]`).
2. Parsed `DesignTokens` -> emitted as two blocks by `buildDesignOverride` in [src/template.ts](src/template.ts):
   - `:root { ... light palette + fonts ... }`
   - `[data-mode="dark"] { ... dark palette ... }`
3. `--accent <hex>` (CLI) -> `:root { --brand: X; --brand-soft: X; }`. Overrides the brand ONLY.

Unset slots cascade transparently because they're not emitted.

## Parser internals

### Name derivation (`deriveName`)

1. First H1 match: `^#\s+(.+)$`. If the text matches `/inspired\s+by\s+(.+)$/i`, the captured group wins (typical DESIGN.md title format at getdesign.md).
2. Otherwise, strip leading `Design System:` / `Design System -` if present.
3. Fallback: parent directory name (if meaningful), then filename without extension.

### Palette extraction — 3 passes

Implemented in `extractPalette`. First pass that fills a slot wins; subsequent passes fill only remaining gaps.

1. **Quick Color Reference**: slice under a heading `/##+\s+(?:[0-9.\s]+)?Quick\s+Color\s+Reference/i`. Highest signal-to-noise; often a clean table or list.
2. **Color Palette & Roles**: slice under `/##+\s+(?:[0-9.\s]+)?Color\s+Palette(?:\s*&\s*Roles)?/i`. The standard section name across getdesign.md entries.
3. **Inline sweep over the whole doc**: only triggered if fewer than 4 slots were filled by passes 1+2. Last resort.

Each pass calls `assignFromLines(tokens, lines, darkHint)` which:

- For each line, finds every color literal via `COLOR_RE = /(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi`.
- Takes the text BEFORE each color literal, runs it through `extractRolePhrase` (strips list markers, bold/italic/code markup, clamps to the last ~8 words).
- Maps the role phrase through `resolveSlot` -> `SYNONYMS` -> a `TokenSlot`.
- Writes the color ONLY if the slot is still undefined.

### Color normalization

`normalizeColor(raw)` converts any matched literal to a CSS-safe string. Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`. Output is lowercased.

### `SYNONYMS` synonym table

A `SynonymRule[]` in `src/design.ts`. Each rule has:

```ts
{
  slot: TokenSlot;
  patterns: RegExp[];
  not?: RegExp[];   // disqualifying matches
}
```

**Order matters**. The table is walked in order; first match wins. Crucial orderings:

- `brand` BEFORE `error` so "Ship Red" (Vercel's brand CTA) isn't misread as error.
- `textPrimary` has `not: [/\bdark\b/i, /\bsurface\b/i, /\bbackground\b/i]` so "Dark Surface" doesn't grab the text slot.
- `bgPage` has `not: [/\bdark\b/i, /\bink\b/i]` so dark-mode variants skip the light slot.

Existing slot coverage:

| Slot | Example natural-language matches |
|---|---|
| `bgPage` | parchment, paper white, newsprint, page background, canvas, pure white |
| `bgSurface` | ivory, card surface, elevated, surface, container, panel |
| `bgSand` | sand, chip, warm sand, subtle bg |
| `textPrimary` | near black, primary text, heading text, headline, body text, page ink |
| `textSecondary` | olive gray, secondary text, muted text, body gray, gray 600/700 |
| `textTertiary` | stone gray, tertiary, metadata, caption gray, footnote, disabled gray, gray 400/500 |
| `brand` | terracotta, primary cta, link blue, ship red, preview pink, brand color, accent |
| `brandSoft` | coral, brand soft, hover blue, brand hover |
| `borderSoft` | border cream, subtle border, hairline tint |
| `borderWarm` | border warm, prominent border, section divider |
| `error` | error, crimson, danger (but NOT brand/cta/link/ship/preview) |
| `focus` | focus ring, focus color, focus blue |
| `codeBg` | code background, code surface, console bg |
| `codeBorder` | code border |
| `codeInlineBg` | inline code, code chip |

## Dark-mode extraction (`extractDarkPalette`)

1. Filter lines to those containing `\bdark\b` within the line.
2. Run `assignFromLines(dark, lines, darkHint=true)` (the hint is currently ignored in `resolveSlot`; each mode parses independently).
3. For any slots still missing, fall back to `synthesizeDark(light)` — an algorithmic inversion that keeps brand/accent consistent but flips backgrounds/text.

The `darkHint` parameter is wired through for future per-mode disambiguation but intentionally no-ops today to avoid incorrect flips.

## Font extraction (`extractFonts`)

- Scans every line for a `role: family, family2` pattern via `matchFontLine`.
- Role classification by substring:
  - `headline | display | serif | heading` -> `fonts.serif`
  - `body | ui | sans | primary | text` -> `fonts.sans`
  - `mono | code` -> `fonts.mono`
- First hit per role wins. Result is joined with `, ` so the full cascade lands in CSS as the first family, followed by the `appendFallback` generic cascade added by [src/template.ts](src/template.ts).

## Emission to HTML

`buildDesignOverride(design)` in [src/template.ts](src/template.ts) maps parsed tokens to CSS:

- `paletteToCss(design.light)` -> `[['bgPage','--bg-page'], ['bgSurface','--bg-surface'], ...]` — one decl per defined slot.
- `paletteToCss(design.dark)` -> same mapping, emitted under `[data-mode="dark"]`.
- `fontRules` — only `--font-serif / --font-sans / --font-mono` if present. `appendFallback(family, kind)` adds the standard fallback cascade.
- Empty palettes emit nothing (no trailing `:root { }` noise).

## Mermaid hookup

`applyDesignToMermaid` in [src/mermaid-runtime.ts](src/mermaid-runtime.ts) maps:

| PaletteTokens slot | Mermaid themeVariable |
|---|---|
| `bgPage` | `background` |
| `bgSurface` | `primaryColor` |
| `textPrimary` | `primaryTextColor`, `noteTextColor` |
| `borderWarm` | `primaryBorderColor` |
| `textSecondary` | `lineColor`, `secondaryTextColor`, `tertiaryTextColor` |
| `borderSoft` | `secondaryColor`, `noteBkgColor` |
| `bgSand` | `tertiaryColor` |
| `fonts.sans` | `fontFamily` |

Unmapped slots retain Claude defaults. When you add a new `PaletteTokens` slot that should affect diagrams, extend this map.

## Worked example

Given:

```md
# Design System Inspired by Linear

## 2. Color Palette & Roles

- **Linear Indigo** (`#5e6ad2`): Primary brand color, used for...
- **Slate Ink** (`#1c1d26`): Near-black headline text.
- **Graphite Gray** (`#8a8f98`): Secondary body text.
- **Fog Surface** (`#f4f5f8`): Elevated surface / card.
- **Dark Canvas** (`#0d0e12`): Dark mode page background.
```

Parse yields:

```jsonc
{
  "name": "Linear",
  "light": {
    "brand": "#5e6ad2",         // matched /accent/i? no -> Primary brand color -> /^brand\b/ via "Primary brand"? -> indirect; in practice matches via "Primary brand color"
    "textPrimary": "#1c1d26",   // "Near-black headline"
    "textSecondary": "#8a8f98", // "Secondary body text"
    "bgSurface": "#f4f5f8"      // "Elevated surface"
  },
  "dark": {
    "bgPage": "#0d0e12"         // "Dark canvas" line survives the dark filter
    // other slots synthesized from light via synthesizeDark
  },
  "fonts": {}
}
```

At render time:

```css
:root {
  --brand: #5e6ad2;
  --text-primary: #1c1d26;
  --text-secondary: #8a8f98;
  --bg-surface: #f4f5f8;
}
[data-mode="dark"] {
  --bg-page: #0d0e12;
  /* synthesized slots */
}
```

## Common tasks

- Add a new slot: follow [.cursor/instructions/add-or-update-design-token.md](.cursor/instructions/add-or-update-design-token.md).
- Debug a mis-extracted color: add a regex to `SYNONYMS` with a tight `not` list to disambiguate. Re-run every existing DESIGN.md to catch regressions.
- Debug why the Claude baseline leaks through: `parseDesignMd` returned an empty slot. Either the DESIGN.md didn't name the color in a recognised role, or the role isn't in `SYNONYMS` yet.

## Gotchas

- The three-pass extraction means unintended lines in the preamble can claim a slot before the Quick Color Reference runs — wait, no: pass 1 runs Quick Color Reference FIRST. But any slot it fills will win. If Quick Color Reference is messy/ambiguous, the later passes won't fix it. Rewrite the Quick Color Reference section in the source DESIGN.md rather than patching the parser.
- `resolveSlot` currently ignores `darkHint`. Don't reintroduce a flip there without verifying against the Linear, Vercel, Stripe, WIRED, and Notion fixtures.
- `synthesizeDark` is intentionally simple (invert lightness, keep brand). Do not complicate it — it's meant as a graceful fallback, not a full dark-mode designer.
- `parseDesignMd` uses `fs.readFileSync`. That's fine for one-shot initialization but do not call it in a hot per-file loop.

## File pointers

- [src/design.ts](src/design.ts) — everything in this skill.
- [src/template.ts](src/template.ts) `buildDesignOverride`, `paletteToCss`, `appendFallback`.
- [src/mermaid-runtime.ts](src/mermaid-runtime.ts) `applyDesignToMermaid`.
- [src/designs/claude.md](src/designs/claude.md) — the baseline spec. Read this to see the canonical role-naming vocabulary.
- [src/designs/README.md](src/designs/README.md) — authoring guide for DESIGN.md files.
- [docs/designs.md](docs/designs.md) — user-facing documentation.
