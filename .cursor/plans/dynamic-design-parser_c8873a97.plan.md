---
name: dynamic-design-parser
overview: Make the DESIGN.md parser in src/design.ts dynamically extract tokens from any Design.md by reading both color names AND descriptions, expanding SYNONYMS with generic functional vocabulary, and fixing compound-font-label and dark-line-filter bugs -- with zero brand-specific hardcoding.
todos:
  - id: parse-after-hex
    content: Extend assignFromLines to capture description text after the color literal; add extractContextPhrase helper
    status: completed
  - id: expand-synonyms
    content: Add functional-vocabulary patterns to SYNONYMS (text, background, card, button, border, link, heading) with zero brand names
    status: completed
  - id: fix-font-regex
    content: Rewrite matchFontLine regex to tolerate compound labels like 'Body / UI', 'Monospace / Labels', 'Display / Buttons'
    status: completed
  - id: harden-dark-filter
    content: Fix extractDarkPalette to distinguish dark-as-role-qualifier from dark-as-description
    status: completed
  - id: multi-slot-assignment
    content: Add resolveAllSlots for colors explicitly serving multiple roles ('All text, all buttons, all borders')
    status: completed
  - id: verify-script
    content: Create scripts/verify-design-parse.js and seed samples/design-fixtures/ with 6 representative DESIGN.md files
    status: completed
  - id: npm-script
    content: Add verify:design npm script
    status: completed
  - id: docs
    content: Update docs/designs.md, src/designs/README.md, docs/changelog.md, and bump package.json version
    status: completed
  - id: validate
    content: Run typecheck, verify:design, demo:light with --design Design.md, and Playwright MCP visual spot-check
    status: completed
isProject: false
---

# Dynamic DESIGN.md parser

Cross-design validation across 12 real DESIGN.md files (Figma, Vercel, Apple, Uber, xAI, SpaceX, Nike, Stripe, Linear, Notion, Airbnb, Spotify, Shopify) revealed the parser's SYNONYMS table is 80% brand-specific vocabulary but designers write descriptions using universal functional terms. The fix is generic: parse more context, match against functional roles only, no brand names.

## Design principle

Every added SYNONYM pattern must pass: *"Would this help parse an arbitrary future Design.md, or does it only help one brand?"* Brand-specific rejected.

## Changes in [src/design.ts](src/design.ts)

### 1. Parse text AFTER the hex, not just before
`assignFromLines` at lines 403-432 currently discards the description that follows each color literal. Descriptions contain the real functional role: `**Pure Black** (#000000): All text, all solid buttons, all borders`. Add `extractContextPhrase(before, after)` returning `"Pure Black | All text, all solid buttons, all borders"` and feed it to `resolveSlot`.

### 2. Expand SYNONYMS with functional vocabulary (lines 195-337)
Add generic English role terms that every designer uses, keep existing rules for back-compat. Sample additions (not exhaustive):
- `textPrimary`: `/\ball\s+text\b/i`, `/\bpure\s*black\b/i`, `/\btrue\s*black\b/i`, `/\bheadings?\s+and\s+body\b/i`
- `bgPage`: `/\bpage\s*background\b/i`, `/\broot\s*background\b/i`, `/\ball\s+backgrounds?\b/i`
- `bgSurface`: `/\bcard\s*(?:surface|background|fill)?\b/i`
- `brand`: `/\bprimary\s+button\b/i`, `/\bsolid\s+buttons?\b/i`, `/\bcta\b/i`, `/\baccent\b/i` (already partial)
- `borderSoft`: `/\bborders?\s+(?:default|subtle|light)?\b/i`, `/\bdividers?\b/i`

No brand names -- every term is universal English.

### 3. Fix compound font labels in `matchFontLine` (lines 513-545)
Current regex requires keyword immediately followed by `**` or `:`. Change:
```
Before: (?:\*\*)?(Headline|Display|...|Code)(?:\*\*)?\s*[:\-]
After:  (?:\*\*)?(Headline|Display|Body|UI|Primary|Sans|Serif|Mono(?:space)?|Code)(?:[\s/][^*:\n]{0,40})?(?:\*\*)?\s*[:\-]
```
Handles `Body / UI`, `Monospace / Labels`, `Headline / Display`, `Display / Buttons`, `Body / Headings`, `UI / Body` generically. Delete redundant `Body\s*\/\s*UI` literal.

### 4. Harden dark-line filter in `extractDarkPalette` (lines 379-396)
Current `/\bdark\b/i` matches descriptive `"text on dark surfaces"` -> pulls `#ffffff` into dark `bgPage`. Require `dark` to be a role qualifier, not descriptive context: disqualify lines matching `/\bon\s+(?:a\s+)?dark\b/i`. Prefer role-shape patterns `/\bdark\s*(?:mode|theme|surface|background|bg|canvas|card|palette|variant|page)\b/i`.

### 5. Allow multi-slot assignment for universal colors
When a phrase has `/\ball\s+\w+/i` repeated across role groups ("All text, all buttons, all borders"), the single color fills ALL matched slots (still first-wins at per-slot level). New helper `resolveAllSlots(phrase): TokenSlot[]`. Gated behind multi-role language detection; single-role phrases unchanged.

## Validation

### New script [scripts/verify-design-parse.js](scripts/verify-design-parse.js)
Mirrors the `verify-fullbleed.js` convention -- standalone Node script.
- Reads every `*.md` in `samples/design-fixtures/` plus `src/designs/claude.md` and `Design.md`
- Runs `parseDesignMd` on each
- Prints a grid: rows = designs, cols = PaletteTokens slots, cells = value or "--"
- Exits non-zero on regressions: Claude must produce its current tokens byte-for-byte; Figma must produce `textPrimary=#000000`, `brand=#000000`, `bgSurface=#ffffff`, `fonts.mono=figmaMono...`

### `samples/design-fixtures/` seed set
Drop 6 representative DESIGN.md files covering the pattern space:
- Figma (monochrome + compound font label)
- Vercel (Pure White + True Black + simple fonts)
- Apple (Pure Black + percentage-opacity names)
- Uber (Pure White + compound font labels)
- Nike (brand-qualified colors + standard text vocabulary)
- Stripe (rich functional vocabulary, simple fonts)

Markdown only, no logos / artwork / licensed assets.

### npm script
Add `"verify:design": "npm run build && node scripts/verify-design-parse.js"` to [package.json](package.json).

## Documentation

- [docs/designs.md](docs/designs.md): new "How the parser discovers roles" section listing the recognized functional vocabulary and showing how both name and description are scanned.
- [src/designs/README.md](src/designs/README.md): add a "Recognized role vocabulary" block.
- [docs/changelog.md](docs/changelog.md): entry describing the broader extraction; per [.cursor/rules/70-commits-and-changelog.mdc](.cursor/rules/70-commits-and-changelog.mdc) also bump `package.json` patch version.

## Mandatory pre-merge checks

Per [.cursor/rules/30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc) and [.cursor/rules/60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc):
1. `npm run typecheck`
2. `npm run verify:design` (new)
3. `npm run demo:light` and `npm run demo:dark` using `--design Design.md` (Figma) plus the Claude baseline
4. Visual spot-check via Playwright MCP on the regenerated Figma PDF to confirm black text, black CTA, white card surfaces, and figmaSans rendering

## Explicitly out of scope

- No brand synonyms ever (no "rausch", "terracotta", "geist", "vercel", "figma" in the code)
- No per-design special-casing
- No new `PaletteTokens` slots
- No changes to `buildDesignOverride`, `paletteToCss`, CSS themes, or the Puppeteer pipeline
- No font hosting / font downloading -- `figmaSans` still falls through `appendFallback` as today
