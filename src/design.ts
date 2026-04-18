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

const SYNONYMS: SynonymRule[] = [
  // Backgrounds / canvases
  {
    slot: 'bgPage',
    patterns: [
      /\bparchment\b/i,
      /\bpaper(?:\s*white)?\b/i,
      /\bnewsprint\b/i,
      /\bpage\s*(?:background|bg|canvas)\b/i,
      /\bcanvas\b/i,
      /\bpure\s*white\b/i,
      /^background\b/i,
    ],
    not: [/\bdark\b/i, /\bink\b/i],
  },
  {
    slot: 'bgSurface',
    patterns: [
      /\bivory\b/i,
      /\bcard\s*surface\b/i,
      /\belevated\b/i,
      /\bsurface\b/i,
      /\bcontainer\b/i,
      /\bpanel\b/i,
    ],
    not: [/\bdark\b/i],
  },
  {
    slot: 'bgSand',
    patterns: [/\bsand\b/i, /\bchip\b/i, /\bwarm\s*sand\b/i, /\bsubtle\s*bg\b/i],
  },

  // Text
  {
    slot: 'textPrimary',
    patterns: [
      /\bnear\s*black\b/i,
      /\bprimary\s*text\b/i,
      /\bheading\s*text\b/i,
      /\bheadline(?:\s*text)?\b/i,
      /\bbody\s*text\b/i,
      /\bpage\s*ink\b/i,
    ],
    not: [/\bdark\b/i, /\bsurface\b/i, /\bbackground\b/i],
  },
  {
    slot: 'textSecondary',
    patterns: [
      /\bolive\s*gray\b/i,
      /\bsecondary\s*text\b/i,
      /\bmuted\s*text\b/i,
      /\bbody\s*gray\b/i,
      /\bgray\s*600\b/i,
      /\bgray\s*700\b/i,
    ],
  },
  {
    slot: 'textTertiary',
    patterns: [
      /\bstone\s*gray\b/i,
      /\btertiary(?:\s*text)?\b/i,
      /\bmetadata\b/i,
      /\bcaption(?:\s*gray)?\b/i,
      /\bfootnote\b/i,
      /\bdisabled(?:\s*gray)?\b/i,
      /\bgray\s*400\b/i,
      /\bgray\s*500\b/i,
    ],
  },

  // Brand (must come BEFORE error so "ship red" or "link blue" wins)
  {
    slot: 'brand',
    patterns: [
      /\bterracotta\b/i,
      /\bprimary\s*cta\b/i,
      /\blink\s*(?:blue|color)\b/i,
      /^link\b/i,
      /\bship(?:\s*red)?\b/i,
      /\bpreview\s*pink\b/i,
      /\bbrand\s*color\b/i,
      /^brand\b/i,
      /\baccent\b/i,
    ],
    not: [/\bsoft\b/i, /\bhover\b/i, /\bsecondary\b/i],
  },
  {
    slot: 'brandSoft',
    patterns: [
      /\bcoral\b/i,
      /\bbrand\s*soft\b/i,
      /\bhover\s*(?:blue|accent|color)?\b/i,
      /\bbrand\s*hover\b/i,
    ],
  },

  // Borders
  {
    slot: 'borderSoft',
    patterns: [
      /\bborder\s*cream\b/i,
      /\bborder\s*soft\b/i,
      /\bsubtle\s*border\b/i,
      /\bhairline\s*(?:tint|border)\b/i,
      /\bborder\s*\(light\)\b/i,
    ],
  },
  {
    slot: 'borderWarm',
    patterns: [
      /\bborder\s*warm\b/i,
      /\bprominent\s*border\b/i,
      /\bsection\s*divider\b/i,
      /^divider\b/i,
      /\bborders?\s*\(prominent\)\b/i,
    ],
  },

  // Semantic (come after brand)
  {
    slot: 'error',
    patterns: [/\berror\b/i, /\bcrimson\b/i, /\bdanger\b/i],
    not: [/\bbrand\b/i, /\bcta\b/i, /\blink\b/i, /\bship\b/i, /\bpreview\b/i],
  },
  {
    slot: 'focus',
    patterns: [/\bfocus\s*(?:ring|color|blue)?\b/i],
  },

  // Code surfaces (rarely explicit in DESIGN.md but worth trying)
  {
    slot: 'codeBg',
    patterns: [/\bcode\s*(?:background|surface)\b/i, /\bconsole\s*bg\b/i],
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

  // Heuristic: look at lines that mention "dark" anywhere within 80 chars
  // and try to map them to slots with a "dark hint" bias (e.g. "Dark
  // Surface (#30302e)" -> bgSurface in dark mode, "Near Black (#141413):
  // dark-theme page background" -> bgPage in dark mode).
  const lines = splitLines(raw).filter((l) => /\bdark\b/i.test(l));
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

    for (const m of matches) {
      const color = normalizeColor(m[0]);
      if (!color) continue;

      // The "role phrase" is a slice of the line before the color literal,
      // trimmed of markup.
      const before = line.slice(0, m.index ?? 0);
      const rolePhrase = extractRolePhrase(before);
      if (!rolePhrase) continue;

      const slot = resolveSlot(rolePhrase, darkHint);
      if (!slot) continue;

      // First match wins -- don't overwrite.
      if (tokens[slot] === undefined) {
        tokens[slot] = color;
      }
    }
  }
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
  // Strip list markers and bold/italic markup.
  let s = before
    .replace(/^[-*+]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/"/g, '')
    .trim();

  // Drop trailing punctuation/quotes that immediately precede the paren.
  s = s.replace(/[\s(:\-,]+$/, '').trim();

  // Keep only the last ~6 words before the color (role names are short).
  const words = s.split(/\s+/).filter(Boolean);
  const tail = words.slice(-8).join(' ');
  return tail || null;
}

/**
 * Map a role phrase through the synonym table and return the best slot.
 */
function resolveSlot(rolePhrase: string, darkHint: boolean): TokenSlot | null {
  for (const rule of SYNONYMS) {
    if (rule.not && rule.not.some((n) => n.test(rolePhrase))) continue;
    if (rule.patterns.some((p) => p.test(rolePhrase))) {
      // In dark mode, a "primary text" becomes the bg-page and vice versa.
      // Don't apply that flip here -- we parse each mode independently.
      void darkHint;
      return rule.slot;
    }
  }
  return null;
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
 */
function matchFontLine(line: string): { role: string; families: string[] } | null {
  const labelMatch = line.match(
    /^\s*(?:[-*]\s*)?(?:\*\*)?(Headline|Display|Body|UI|Body\s*\/\s*UI|Primary|Sans|Serif|Mono(?:space)?|Code)(?:\*\*)?\s*[:\-]\s*(.+)$/i
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
