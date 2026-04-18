/*
 * design.ts -- DESIGN.md parser.
 *
 * Takes a path to a DESIGN.md file (or a folder containing one) and produces
 * a DesignTokens object that the template layer can inject as :root CSS
 * variable overrides on top of the bundled Claude baseline.
 *
 * The parser is deliberately heuristic, not strict. DESIGN.md files on
 * getdesign.md are written for humans and AI agents; they are not a
 * machine-readable spec. We extract what we can and leave everything else
 * to fall through to the Claude baseline tokens.
 */

import fs from 'fs';
import path from 'path';
import type { RenderMode } from './prompt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaletteTokens {
  bgPage?: string;
  bgSurface?: string;
  bgSand?: string;
  textPrimary?: string;
  textSecondary?: string;
  textTertiary?: string;
  brand?: string;
  brandSoft?: string;
  borderSoft?: string;
  borderWarm?: string;
  codeBg?: string;
  codeBorder?: string;
  codeInlineBg?: string;
  error?: string;
  focus?: string;
}

export interface FontTokens {
  serif?: string;
  sans?: string;
  mono?: string;
}

export interface DesignTokens {
  /** Display name (e.g. "Claude", "Linear"). Derived from the DESIGN.md title. */
  name: string;
  /** Absolute path of the source DESIGN.md. */
  source: string;
  /** Raw markdown length (for debugging). */
  rawBytes: number;
  light: PaletteTokens;
  dark: PaletteTokens;
  fonts: FontTokens;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a DESIGN.md file or a directory containing one.
 *
 * Never throws; if parsing fails completely, returns a tokens object with
 * empty palettes and the `name` derived from the filename. Callers can then
 * layer this over the Claude baseline so nothing breaks.
 */
export function parseDesignMd(target: string): DesignTokens {
  const filePath = resolveDesignFile(target);
  const raw = fs.readFileSync(filePath, 'utf8');

  const name = deriveName(filePath, raw);
  const light = extractPalette(raw);
  const dark = extractDarkPalette(raw, light);
  const fonts = extractFonts(raw);

  return {
    name,
    source: filePath,
    rawBytes: raw.length,
    light,
    dark,
    fonts,
  };
}

/**
 * Resolve a user-supplied path (file or directory) to the actual DESIGN.md.
 * Searches common filename variants inside a directory.
 */
export function resolveDesignFile(target: string): string {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) {
    throw new Error(`Design path does not exist: ${abs}`);
  }

  const stat = fs.statSync(abs);
  if (stat.isFile()) return abs;

  if (stat.isDirectory()) {
    const candidates = [
      'DESIGN.md',
      'design.md',
      'Design.md',
      'design-md.md',
      'design.markdown',
    ];
    for (const c of candidates) {
      const p = path.join(abs, c);
      if (fs.existsSync(p)) return p;
    }
    // Fall back to any *.md that looks design-like.
    const entries = fs.readdirSync(abs).filter((f) => /\.md$/i.test(f));
    const designLike = entries.find((f) => /design/i.test(f));
    if (designLike) return path.join(abs, designLike);
    if (entries.length === 1) return path.join(abs, entries[0]);
    throw new Error(
      `No DESIGN.md found in directory: ${abs}. Expected one of ${candidates.join(', ')}.`
    );
  }

  throw new Error(`Unsupported design path (not a file or directory): ${abs}`);
}

/**
 * Return a short, human-friendly summary of what was extracted, for use by
 * the REPL's `/design info` command.
 */
export function describeTokens(tokens: DesignTokens): string {
  const lines: string[] = [];
  lines.push(`name:   ${tokens.name}`);
  lines.push(`source: ${tokens.source}`);
  lines.push('');
  lines.push('light palette:');
  for (const [k, v] of Object.entries(tokens.light)) {
    if (v) lines.push(`  ${k.padEnd(15)} ${v}`);
  }
  lines.push('');
  lines.push('dark palette:');
  for (const [k, v] of Object.entries(tokens.dark)) {
    if (v) lines.push(`  ${k.padEnd(15)} ${v}`);
  }
  lines.push('');
  if (tokens.fonts.serif) lines.push(`serif: ${tokens.fonts.serif}`);
  if (tokens.fonts.sans) lines.push(`sans:  ${tokens.fonts.sans}`);
  if (tokens.fonts.mono) lines.push(`mono:  ${tokens.fonts.mono}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

function deriveName(filePath: string, raw: string): string {
  // Prefer the H1 heading text: "# Design System Inspired by Claude".
  const h1 = raw.match(/^#\s+(.+?)\s*$/m);
  if (h1) {
    const t = h1[1].trim();
    const after = t.match(/inspired\s+by\s+(.+)$/i);
    if (after) return after[1].trim();
    return t.replace(/^Design\s+System(\s*[-:])?\s*/i, '').trim() || t;
  }
  // Fallback: the folder name or filename.
  const base = path.basename(path.dirname(filePath));
  if (base && base.toLowerCase() !== 'designs' && base !== '.' && base !== '/') {
    return capitalize(base);
  }
  return capitalize(path.basename(filePath, path.extname(filePath)));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Palette extraction
// ---------------------------------------------------------------------------

type TokenSlot = keyof PaletteTokens;

/**
 * Ordered list of token slots + their synonym matchers. First match wins.
 * Order matters for disambiguation -- e.g. we want "brand / link" to claim
 * colors before "error / red" so Vercel's "Ship Red" (which is actually its
 * brand CTA) doesn't get misread as an error.
 */
interface SynonymRule {
  slot: TokenSlot;
  patterns: RegExp[];
  /** Negative matches that disqualify a role name. */
  not?: RegExp[];
}

/*
 * The SYNONYMS table is a FUNCTIONAL-ROLE LEXICON, not a brand registry.
 * Every pattern must describe a generic English design role ("body text",
 * "page background", "card surface", "primary cta") that any designer from
 * any company would use. Brand-specific names ("terracotta", "ship red",
 * "preview pink", "ivory") exist ONLY as legacy entries for back-compat
 * with the bundled Claude baseline and the getdesign.md fixtures we
 * originally shipped; never add new ones.
 *
 * If you find yourself wanting to add a brand name, stop and ask: "does
 * the DESIGN.md author also describe this slot in functional terms
 * somewhere on the same line?" If yes, teach the parser that functional
 * term instead.
 */
const SYNONYMS: SynonymRule[] = [
  // Backgrounds / canvases
  {
    slot: 'bgPage',
    patterns: [
      // Functional vocabulary (universal across designs)
      /\bpage\s*(?:background|bg|canvas)\b/i,
      /\broot\s*(?:background|bg)\b/i,
      /\ball\s+backgrounds?\b/i,
      /\bbody\s*background\b/i,
      /\bprimary\s+(?:page\s+)?background\b/i,
      /\bcanvas\b/i,
      /\bbackground(?:\s*color)?$/i,
      /^\s*background\b/i,
      // Generic English color names (not brand-specific)
      /\bpure\s*white\b/i,
      // Legacy brand-ish names from shipped fixtures
      /\bparchment\b/i,
      /\bpaper(?:\s*white)?\b/i,
      /\bnewsprint\b/i,
    ],
    // "dark" keeps light-mode selector out of dark-hinted phrasing; "ink"
    // is an intentional exclusion so the Claude "page ink" token lands on
    // textPrimary instead of bgPage. We deliberately do NOT blacklist
    // "card" or "surface" here -- descriptions like "Page background and
    // card surfaces" are common and must still assign to bgPage because
    // bgSurface fires second when the author didn't split the two.
    not: [/\bdark\b/i, /\bink\b/i],
  },
  {
    slot: 'bgSurface',
    patterns: [
      // Functional vocabulary (plural-tolerant: designers often write
      // "card surfaces" or "elevated panels").
      /\bcards?\s*(?:surfaces?|backgrounds?|bg|fill)?\b/i,
      /\bcontent\s*container\b/i,
      /\belevated(?:\s*surfaces?)?\b/i,
      /\bsurfaces?\s*(?:elevated|default|primary)?\b/i,
      /\bcontainers?\b/i,
      /\bpanels?\b/i,
      // Legacy
      /\bivory\b/i,
    ],
    not: [/\bdark\b/i],
  },
  {
    slot: 'bgSand',
    patterns: [
      /\bsand\b/i,
      /\bwarm\s*sand\b/i,
      /\bsubtle\s*bg\b/i,
      /\bsection\s*background\b/i,
      /\balt(?:ernate)?\s*background\b/i,
      /\bchip\b/i,
    ],
  },

  // Text
  {
    slot: 'textPrimary',
    patterns: [
      // Functional vocabulary (universal)
      /\ball\s+text\b/i,
      /\bprimary\s*text\b/i,
      /\bheading\s*text\b/i,
      /\bheadline(?:\s*text)?\b/i,
      /\bheadings?\s+and\s+body\b/i,
      /\bbody\s*text\b/i,
      /\btext\s+primary\b/i,
      /\bprimary\s+(?:body|headline|heading)\b/i,
      // Generic English
      /\bnear\s*black\b/i,
      /\bpure\s*black\b/i,
      /\btrue\s*black\b/i,
      // Legacy
      /\bpage\s*ink\b/i,
    ],
    not: [/\bdark\b/i, /\bsurface\b/i, /\bbackground\b/i, /\bbutton\b/i, /\bcta\b/i, /\bbrand\b/i, /\baccent\b/i],
  },
  {
    slot: 'textSecondary',
    patterns: [
      /\bsecondary\s*text\b/i,
      /\btext\s+secondary\b/i,
      /\bmuted\s*text\b/i,
      /\bbody\s*gray\b/i,
      /\bgray\s*(?:600|700)\b/i,
      // Legacy
      /\bolive\s*gray\b/i,
      /\bsilver\b/i,
    ],
  },
  {
    slot: 'textTertiary',
    patterns: [
      /\btertiary(?:\s*text)?\b/i,
      /\btext\s+tertiary\b/i,
      /\bmetadata\b/i,
      /\bcaption(?:\s*gray)?\b/i,
      /\bfootnote\b/i,
      /\bdisabled(?:\s*text|\s*gray)?\b/i,
      /\bgray\s*(?:400|500)\b/i,
      // Legacy
      /\bstone\s*gray\b/i,
    ],
  },

  // Brand (must come BEFORE error so "link blue" or generic "cta" wins over "error/red")
  {
    slot: 'brand',
    patterns: [
      // Functional vocabulary
      /\bprimary\s*(?:cta|button|action)\b/i,
      /\bsolid\s*buttons?\b/i,
      /\ball\s+(?:solid\s+)?buttons?\b/i,
      /\bcta\b/i,
      /\baccent\b/i,
      /\bbrand\s*(?:color|accent|primary)\b/i,
      /^brand\b/i,
      /\blink\s*(?:blue|color)?\b/i,
      /^link\b/i,
      /\bactive\s+states?\b/i,
      // Legacy brand-ish names from shipped Claude / Vercel / other fixtures
      /\bterracotta\b/i,
      /\bship(?:\s*red)?\b/i,
      /\bpreview\s*pink\b/i,
    ],
    not: [/\bsoft\b/i, /\bhover\b/i, /\bsecondary\b/i, /\bdisabled\b/i, /\bmuted\b/i],
  },
  {
    slot: 'brandSoft',
    patterns: [
      /\bbrand\s*(?:soft|hover)\b/i,
      /\bhover\s*(?:blue|accent|color|state)?\b/i,
      /\bcta\s*hover\b/i,
      /\baccent\s*hover\b/i,
      // Legacy
      /\bcoral\b/i,
    ],
  },

  // Borders
  {
    slot: 'borderSoft',
    patterns: [
      /\bborders?\s*(?:default|subtle|light|soft|color)?\b/i,
      /\bsubtle\s*border\b/i,
      /\bhairline\s*(?:tint|border)\b/i,
      /\bborder\s*\(light\)\b/i,
      /\bdivider(?:\s*line)?\b/i,
      /^divider\b/i,
      // Legacy
      /\bborder\s*cream\b/i,
    ],
  },
  {
    slot: 'borderWarm',
    patterns: [
      /\bborders?\s*(?:strong|prominent|warm)\b/i,
      /\bsection\s*divider\b/i,
      /\bborders?\s*\(prominent\)\b/i,
    ],
  },

  // Semantic (come after brand)
  {
    slot: 'error',
    patterns: [/\berror\b/i, /\bcrimson\b/i, /\bdanger\b/i, /\bnegative\s*(?:red|text)?\b/i],
    not: [/\bbrand\b/i, /\bcta\b/i, /\blink\b/i, /\bship\b/i, /\bpreview\b/i],
  },
  {
    slot: 'focus',
    patterns: [/\bfocus\s*(?:ring|color|blue|outline)?\b/i],
  },

  // Code surfaces (rarely explicit in DESIGN.md but worth trying)
  {
    slot: 'codeBg',
    patterns: [/\bcode\s*(?:background|surface|block)\b/i, /\bconsole\s*bg\b/i],
  },
  {
    slot: 'codeBorder',
    patterns: [/\bcode\s*border\b/i],
  },
  {
    slot: 'codeInlineBg',
    patterns: [/\binline\s*code\b/i, /\bcode\s*chip\b/i],
  },
];

// ---------------------------------------------------------------------------
// Color regex (hex, rgb, rgba, hsl, hsla)
// ---------------------------------------------------------------------------

const COLOR_RE =
  /(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;

/**
 * Extract the light-mode palette. Strategy:
 *   1) If there's a "Quick Color Reference" block, use it (cleanest).
 *   2) Walk the "Color Palette & Roles" bullets; for each role-name + color
 *      pair, try to map the role into a token slot via the synonym table.
 *   3) Fall through to an inline sweep over the whole doc.
 *
 * Unknown slots stay undefined and inherit the Claude baseline at render
 * time.
 */
function extractPalette(raw: string): PaletteTokens {
  const tokens: PaletteTokens = {};

  // Pass 1: Quick Color Reference (highest signal-to-noise).
  const quickRef = sliceSection(raw, /##+\s*(?:[0-9.\s]+)?Quick\s+Color\s+Reference/i);
  if (quickRef) assignFromLines(tokens, splitLines(quickRef), /* darkHint */ false);

  // Pass 2: Color Palette & Roles section.
  const palette = sliceSection(raw, /##+\s*(?:[0-9.\s]+)?Color\s+Palette(?:\s*&\s*Roles)?/i);
  if (palette) assignFromLines(tokens, splitLines(palette), false);

  // Pass 3: Inline sweep (last resort) across the full doc.
  if (countDefinedTokens(tokens) < 4) {
    assignFromLines(tokens, splitLines(raw), false);
  }

  return tokens;
}

/**
 * Try to find explicit dark-mode tokens in the DESIGN.md. If none are found,
 * synthesize a dark palette by inverting the light one.
 */
function extractDarkPalette(raw: string, light: PaletteTokens): PaletteTokens {
  const dark: PaletteTokens = {};

  // Heuristic: a line belongs to the DARK palette only if "dark" appears as
  // a ROLE QUALIFIER ("dark mode", "dark surface", "dark theme page
  // background") -- NOT as descriptive prose ("text on dark surfaces",
  // "stands out on dark backgrounds", "against dark canvases").
  //
  // The distinction matters because Figma-style monochrome palettes have
  // light-mode lines like `**Pure White** (#ffffff): ...visible on dark
  // surfaces`, and without this filter every "on dark" descriptive line
  // dragged light colors into the dark palette.
  const isRoleQualifier = (l: string): boolean => {
    // Skip lines where "dark" is purely descriptive: "on (a) dark ...",
    // "against dark ...", "visible on dark ...".
    if (/\bon\s+(?:a\s+|the\s+)?dark\b/i.test(l)) return false;
    if (/\bagainst\s+(?:a\s+|the\s+)?dark\b/i.test(l)) return false;
    if (/\bvisible\s+on\s+dark\b/i.test(l)) return false;
    // Accept only when "dark" qualifies a role noun.
    return /\bdark\s*(?:mode|theme|surface|background|bg|canvas|card|palette|variant|page|ink|ui|navigation|sidebar)\b/i.test(l)
      || /\bdark[-\s](?:mode|theme)\b/i.test(l);
  };
  const lines = splitLines(raw).filter(isRoleQualifier);
  assignFromLines(dark, lines, true);

  // Fill any missing slots by inverting the light palette.
  const synthesized = synthesizeDark(light);
  for (const k of Object.keys(synthesized) as TokenSlot[]) {
    if (!dark[k] && synthesized[k]) dark[k] = synthesized[k];
  }

  return dark;
}

/**
 * Given a list of lines (potentially with bullet markers, bold markup, and
 * descriptive prose), try to map each "role-name + color" pair to a token
 * slot and write the color into the tokens object (without clobbering).
 *
 * For each color literal we build a CONTEXT PHRASE that includes BOTH the
 * text before the literal (the "name", e.g. "Pure Black") AND the
 * description after the literal (e.g. "All text, all solid buttons, all
 * borders"). Descriptions carry the functional role in the vast majority
 * of real DESIGN.md files because the name is brand-specific and the
 * description is how humans explain what the color is for.
 *
 * When the context phrase contains multi-role language ("all text, all
 * buttons"), the same color is allowed to populate multiple slots in one
 * pass -- otherwise the first matching slot wins.
 */
function assignFromLines(
  tokens: PaletteTokens,
  lines: string[],
  darkHint: boolean
): void {
  for (const line of lines) {
    // Find every color literal on the line.
    const matches = Array.from(line.matchAll(COLOR_RE));
    if (matches.length === 0) continue;

    const matchArr = matches;
    for (let i = 0; i < matchArr.length; i++) {
      const m = matchArr[i];
      const color = normalizeColor(m[0]);
      if (!color) continue;

      const start = m.index ?? 0;
      const end = start + m[0].length;

      const before = line.slice(0, start);
      // Description after the color runs up to the NEXT color literal on
      // the same line (so multi-color lines don't cross-contaminate) or to
      // end-of-line.
      const nextStart = i + 1 < matchArr.length ? (matchArr[i + 1].index ?? line.length) : line.length;
      const after = line.slice(end, nextStart);

      const phrase = extractContextPhrase(before, after);
      if (!phrase) continue;

      const slots = resolveAllSlots(phrase, darkHint);
      if (!slots.length) continue;

      for (const slot of slots) {
        if (tokens[slot] === undefined) {
          tokens[slot] = color;
        }
      }
    }
  }
}

/**
 * Strip markdown markup (bullets, bold/italic, backticks, straight quotes)
 * and trim. Used by both halves of the context phrase extraction.
 */
function stripMarkup(s: string): string {
  return s
    .replace(/^[-*+]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/"/g, '')
    .replace(/[\u2018\u2019\u201c\u201d]/g, '')
    .trim();
}

/**
 * Pull the "role name" out of the text preceding a color literal. Examples:
 *   "**Terracotta Brand** (`#c96442`): The core brand color..."
 *     -> "Terracotta Brand"
 *   "- Primary CTA: 'Vercel Black (#171717)'"
 *     -> "Primary CTA: Vercel Black"
 *   "Page Ink (#1a1a1a): Near-black used for headlines..."
 *     -> "Page Ink"
 */
function extractRolePhrase(before: string): string | null {
  let s = stripMarkup(before);
  s = s.replace(/[\s(:\-,]+$/, '').trim();

  // Keep only the last ~8 words before the color (role names are short).
  const words = s.split(/\s+/).filter(Boolean);
  const tail = words.slice(-8).join(' ');
  return tail || null;
}

/**
 * Pull the "description" out of the text following a color literal. The
 * description usually sits between the color and the next sentence and
 * carries the functional role:
 *   "(#000000): All text, all solid buttons, all borders."
 *     -> "All text, all solid buttons, all borders"
 *   "(#ffffff): Primary page background and card surfaces."
 *     -> "Primary page background and card surfaces"
 *
 * Important invariant: when a single line lists multiple colors in the
 * form `"Name A (#aaa)" and "Name B (#bbb)"`, the text between the first
 * hex and the second hex belongs to Color B, NOT Color A. We therefore
 * stop the description at the first closing straight/curly quote, since
 * that marks the end of the current color's clause in all formats we've
 * seen across the getdesign.md fixture corpus.
 */
function extractDescriptionPhrase(after: string): string {
  let s = after.replace(/^[\s)\]:,.\-]+/, '');

  // Cut at the first closing quote (straight or curly). This isolates the
  // current color's clause when a line chains multiple colors together.
  const quoteIdx = s.search(/["\u201c\u201d\u2018\u2019]/);
  if (quoteIdx >= 0) s = s.slice(0, quoteIdx);

  // Cut at conjunctions that introduce a NEW color label (heuristic: the
  // conjunction is followed by a capitalized word that looks like a name).
  // Skip this when the word after `and`/`or` is lowercase -- that case is
  // genuine description text like "page background and card surfaces".
  const conjMatch = s.match(/\s(?:and|or)\s+(?=[A-Z][a-zA-Z]*\s+(?:Black|White|Gray|Grey|Blue|Red|Green|Yellow|Purple|Pink|Orange|Brown|Gold))/);
  if (conjMatch && typeof conjMatch.index === 'number') {
    s = s.slice(0, conjMatch.index);
  }

  s = stripMarkup(s);

  // Stop at the first sentence-ending period so multi-sentence descriptions
  // don't smuggle unrelated phrasing into the role lookup.
  const dotIdx = s.search(/\.\s|\.$/);
  if (dotIdx > 0) s = s.slice(0, dotIdx);

  // Clamp length so pathological long descriptions don't slow regex matching.
  if (s.length > 240) s = s.slice(0, 240);
  return s.trim();
}

/**
 * Combine the name (before hex) and description (after hex) into a single
 * searchable phrase. The separator " | " keeps the two halves disjoint so
 * a pattern that anchors to start-of-string with ^ still works against
 * either half independently.
 */
function extractContextPhrase(before: string, after: string): string | null {
  const name = extractRolePhrase(before) ?? '';
  const desc = extractDescriptionPhrase(after);
  const combined = [name, desc].filter(Boolean).join(' | ');
  return combined || null;
}

/**
 * A role-noun family: phrases like "text", "heading", "body"; "button",
 * "cta", "action"; "border", "divider"; "background", "page", "canvas",
 * "surface", "card", "panel". A phrase that references two or more
 * DIFFERENT families is describing a color that spans multiple slots.
 */
const ROLE_FAMILIES: RegExp[] = [
  /\b(?:text|headings?|body|content|type|copy)\b/i,
  /\b(?:buttons?|cta|actions?)\b/i,
  /\b(?:borders?|dividers?)\b/i,
  /\b(?:backgrounds?|page|canvas|surfaces?|cards?|panels?)\b/i,
  /\b(?:links?|accents?)\b/i,
];

/**
 * Heuristic: does the phrase explicitly declare a color that serves
 * multiple roles? Fires when:
 *   - "all X" appears two or more times ("All text, all buttons, all
 *     borders"), OR
 *   - the phrase mentions two or more distinct role-noun families, which
 *     covers comma-separated lists like "Page background, card surfaces"
 *     and "All text, primary CTA, borders".
 */
function isMultiRolePhrase(phrase: string): boolean {
  const allMatches = phrase.match(/\ball\s+\w+/gi);
  if (allMatches && allMatches.length >= 2) return true;

  let families = 0;
  for (const re of ROLE_FAMILIES) {
    if (re.test(phrase)) families += 1;
    if (families >= 2) return true;
  }
  return false;
}

/**
 * Map a role phrase through the synonym table and return the best slot.
 */
function resolveSlot(rolePhrase: string, darkHint: boolean): TokenSlot | null {
  // In dark mode, a "primary text" becomes the bg-page and vice versa.
  // Don't apply that flip here -- we parse each mode independently.
  void darkHint;
  for (const rule of SYNONYMS) {
    if (rule.not && rule.not.some((n) => n.test(rolePhrase))) continue;
    if (rule.patterns.some((p) => p.test(rolePhrase))) {
      return rule.slot;
    }
  }
  return null;
}

/**
 * Return every slot whose rule matches the phrase, in SYNONYMS order.
 * Used when a color explicitly serves multiple roles on the same line.
 * For non-multi-role phrases this collapses to `[resolveSlot(...)]`.
 *
 * In multi-role mode we deliberately RELAX the per-rule NOT filters --
 * they exist to disambiguate narrow single-role phrases (e.g. "hover
 * blue" should be brandSoft, not brand) and they cause false negatives
 * when the phrase intentionally names several peers ("All text, primary
 * CTA, borders"). The other rules' patterns still gate membership, so
 * "all text" won't accidentally land in bgPage even with NOTs relaxed.
 */
function resolveAllSlots(rolePhrase: string, darkHint: boolean): TokenSlot[] {
  void darkHint;
  const multi = isMultiRolePhrase(rolePhrase);
  const hits: TokenSlot[] = [];
  for (const rule of SYNONYMS) {
    if (!multi && rule.not && rule.not.some((n) => n.test(rolePhrase))) continue;
    if (rule.patterns.some((p) => p.test(rolePhrase))) {
      hits.push(rule.slot);
      if (!multi) break;
    }
  }
  return hits;
}

function countDefinedTokens(obj: PaletteTokens): number {
  return Object.values(obj).filter((v) => v !== undefined).length;
}

// ---------------------------------------------------------------------------
// Font extraction
// ---------------------------------------------------------------------------

function extractFonts(raw: string): FontTokens {
  const fonts: FontTokens = {};
  const lines = splitLines(raw);

  for (const line of lines) {
    const m = matchFontLine(line);
    if (!m) continue;
    const { role, families } = m;
    const joined = families.join(', ');
    if (/headline|display|serif|heading/i.test(role) && !fonts.serif) {
      fonts.serif = joined;
    } else if (/body|ui|sans|primary|text/i.test(role) && !fonts.sans) {
      fonts.sans = joined;
    } else if (/mono|code/i.test(role) && !fonts.mono) {
      fonts.mono = joined;
    }
  }

  return fonts;
}

/**
 * Parse lines like:
 *   Headline: `Anthropic Serif`, with fallback: `Georgia`
 *   Primary: Geist, with fallbacks: Arial, Apple Color Emoji
 *   Monospace: `Anthropic Mono`, with fallback: `Arial`
 *
 * Also tolerates COMPOUND labels where designers combine two role keywords
 * with a slash or dash before the colon:
 *   Body / UI: Inter, with fallback: system-ui
 *   Monospace / Labels: JetBrains Mono
 *   Display / Buttons: Figma Sans
 *   Headline - Display: SF Pro Display
 *
 * The regex captures the FIRST keyword as the authoritative role; any
 * additional keywords are absorbed into an optional non-capturing
 * "qualifier" tail and discarded.
 */
function matchFontLine(line: string): { role: string; families: string[] } | null {
  const labelMatch = line.match(
    /^\s*(?:[-*]\s*)?(?:\*\*)?(Headline|Display|Body|UI|Primary|Sans|Serif|Mono(?:space)?|Code)(?:[\s/\-][^*:\n]{0,40})?(?:\*\*)?\s*[:\-]\s*(.+)$/i
  );
  if (!labelMatch) return null;

  const role = labelMatch[1];
  const rest = labelMatch[2].replace(/[`*]/g, '');

  // Split across "with fallback(s):" and commas.
  const parts: string[] = [];
  const fallbackIdx = rest.search(/with\s+fallbacks?\s*[:\-]/i);
  if (fallbackIdx >= 0) {
    parts.push(rest.slice(0, fallbackIdx));
    parts.push(rest.slice(fallbackIdx).replace(/^with\s+fallbacks?\s*[:\-]/i, ''));
  } else {
    parts.push(rest);
  }

  const families: string[] = [];
  for (const part of parts) {
    for (const piece of part.split(/,|\bor\b/i)) {
      const f = piece.trim().replace(/\.$/, '').replace(/^"|"$/g, '').trim();
      if (!f) continue;
      if (/^\(|^\*/.test(f)) continue;
      if (/^with\s+fallback/i.test(f)) continue;
      families.push(/\s/.test(f) && !/^['"]/.test(f) ? `"${f}"` : f);
    }
  }

  if (!families.length) return null;
  return { role, families };
}

// ---------------------------------------------------------------------------
// Dark synthesis
// ---------------------------------------------------------------------------

/**
 * Invert a light palette to produce a reasonable dark palette when the
 * DESIGN.md doesn't spell one out. Strategy:
 *   - bgPage becomes near-black, bgSurface a step lighter.
 *   - textPrimary becomes light (was bgPage inverted), textSecondary dims.
 *   - brand keeps hue, slightly brightened for contrast.
 *   - borders darken.
 */
function synthesizeDark(light: PaletteTokens): PaletteTokens {
  const out: PaletteTokens = {};

  if (light.textPrimary) out.bgPage = darken(light.textPrimary, 0);
  else out.bgPage = '#141413';

  out.bgSurface = lighten(out.bgPage, 0.08);
  out.bgSand = lighten(out.bgPage, 0.12);

  if (light.bgPage) out.textPrimary = light.bgPage;
  else out.textPrimary = '#faf9f5';

  if (light.textSecondary) out.textSecondary = light.textSecondary;
  else out.textSecondary = '#b0aea5';

  if (light.textTertiary) out.textTertiary = light.textTertiary;
  else out.textTertiary = '#87867f';

  if (light.brand) out.brand = lighten(light.brand, 0.06);
  if (light.brandSoft) out.brandSoft = light.brandSoft;

  out.borderSoft = lighten(out.bgPage, 0.06);
  out.borderWarm = lighten(out.bgPage, 0.14);

  out.codeBg = darken(out.bgPage, 0.04);
  out.codeBorder = out.borderSoft;
  out.codeInlineBg = out.bgSurface;

  if (light.error) out.error = light.error;
  if (light.focus) out.focus = light.focus;

  return out;
}

// ---------------------------------------------------------------------------
// Color normalization + math
// ---------------------------------------------------------------------------

function normalizeColor(input: string): string | null {
  const s = input.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    // Expand #abc -> #aabbcc
    const [_, r, g, b] = s.match(/#([0-9a-f])([0-9a-f])([0-9a-f])/i)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.toLowerCase();
  if (/^rgba?\(/i.test(s)) return s.toLowerCase().replace(/\s+/g, '');
  if (/^hsla?\(/i.test(s)) return s.toLowerCase().replace(/\s+/g, '');
  return null;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#([0-9a-f]{6})/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lighten(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return toHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount
  );
}

function darken(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return toHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}

// ---------------------------------------------------------------------------
// Section slicing + line utilities
// ---------------------------------------------------------------------------

/**
 * Extract the text of a markdown section from its heading until the next
 * heading of equal-or-higher level. Returns null if the heading isn't found.
 */
function sliceSection(raw: string, headingRe: RegExp): string | null {
  const lines = raw.split(/\r?\n/);
  let start = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headingRe.test(line)) {
      const levelMatch = line.match(/^(#+)/);
      startLevel = levelMatch ? levelMatch[1].length : 2;
      start = i + 1;
      break;
    }
  }

  if (start < 0) return null;

  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s+/);
    if (m && m[1].length <= startLevel) {
      return lines.slice(start, i).join('\n');
    }
  }
  return lines.slice(start).join('\n');
}

function splitLines(raw: string): string[] {
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}
