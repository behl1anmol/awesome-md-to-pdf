/*
 * design.ts -- DESIGN.md parser, aligned with Google's DESIGN.md spec.
 *
 * See https://github.com/google/design.md (docs/spec.md).
 *
 * A DESIGN.md file has two parts:
 *   1. An optional YAML frontmatter block (between two `---` lines) and/or
 *      fenced ```yaml code blocks. The YAML describes *normative* design
 *      tokens -- colors, typography, rounded, spacing, components -- plus
 *      `name`, `description`, `version`.
 *   2. A markdown body with `## H2` sections (Overview, Colors, Typography,
 *      Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts).
 *      Prose is documentation only; tokens are not inferred from prose.
 *
 * This parser does two things:
 *   - Reads every YAML block (frontmatter + fenced ```yaml) via the `yaml`
 *     package, merges them (rejecting duplicate top-level keys), validates
 *     the shapes, and resolves `{token.path}` references.
 *   - Walks H2 headings and rejects duplicate canonical sections such as
 *     two `## Colors`, per the spec's Consumer Behavior table.
 *
 * It never falls back to prose-heuristic extraction. A DESIGN.md without
 * YAML throws a `DesignParseError` describing the missing frontmatter.
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// ---------------------------------------------------------------------------
// Types -- one-to-one with the spec.
// ---------------------------------------------------------------------------

export interface Typography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: string | number;
  letterSpacing?: string;
  fontFeature?: string;
  fontVariation?: string;
}

export type ColorValue = string;
export type Dimension = string;
export type SpacingValue = string | number;
export type ComponentValue = string | number;

export interface DesignTokens {
  /** Optional `version` token from the YAML (e.g. "alpha"). */
  version?: string;
  /** Display name: first `name:` in YAML, else H1, else filename. */
  name: string;
  /** Optional `description` token from YAML. */
  description?: string;
  /** Absolute path to the parsed DESIGN.md file. */
  source: string;

  colors: Record<string, ColorValue>;
  typography: Record<string, Typography>;
  rounded: Record<string, Dimension>;
  spacing: Record<string, SpacingValue>;
  /** Components with `{token.path}` refs pre-resolved to literal values. */
  components: Record<string, Record<string, ComponentValue>>;

  /** All `## H2` heading texts in document order. */
  sections: string[];
  /** Non-fatal warnings surfaced during parsing (unknown component props, etc.). */
  warnings: string[];
}

export class DesignParseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DesignParseError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Canonical H2 section names that must be unique per document. Any alias
 * listed with a given canonical name maps back to it -- `Brand & Style`
 * is treated as `Overview`, `Layout & Spacing` as `Layout`, `Elevation`
 * as `Elevation & Depth`.
 */
const SECTION_ALIASES: Record<string, string> = {
  overview: 'overview',
  'brand & style': 'overview',
  'brand and style': 'overview',
  colors: 'colors',
  color: 'colors',
  typography: 'typography',
  layout: 'layout',
  'layout & spacing': 'layout',
  'layout and spacing': 'layout',
  'elevation & depth': 'elevation',
  'elevation and depth': 'elevation',
  elevation: 'elevation',
  shapes: 'shapes',
  components: 'components',
  "do's and don'ts": 'dos-and-donts',
  'dos and donts': 'dos-and-donts',
};

/** Canonical YAML top-level keys the parser recognizes. Unknown keys are accepted verbatim. */
const KNOWN_YAML_KEYS = new Set([
  'version',
  'name',
  'description',
  'colors',
  'typography',
  'rounded',
  'spacing',
  'components',
]);

/** Properties the spec declares for a typography token. */
const KNOWN_TYPOGRAPHY_PROPS = new Set([
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'fontFeature',
  'fontVariation',
]);

// Regexes
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// The DESIGN.md spec allows px|em|rem. This parser additionally accepts `pt`
// because awesome-md-to-pdf targets print-layout PDF rendering where pt is
// the idiomatic unit; `%` is accepted for backwards compatibility with older
// token sets. Both are CSS-valid and render correctly through Puppeteer.
const DIMENSION_RE = /^-?\d*\.?\d+(px|em|rem|pt|%)$/i;
const TOKEN_REF_RE = /^\{([a-zA-Z0-9_.-]+)\}$/;
const TOKEN_REF_EMBED_RE = /\{([a-zA-Z0-9_.-]+)\}/g;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a DESIGN.md file or a directory containing one.
 *
 * Throws `DesignParseError` on any hard failure (no YAML found, YAML syntax
 * error, duplicate `## Colors`, unresolved token reference, cycle, …).
 */
export function parseDesignMd(target: string): DesignTokens {
  const filePath = resolveDesignFile(target);
  const raw = fs.readFileSync(filePath, 'utf8');

  const blocks = extractYamlBlocks(raw);
  if (blocks.length === 0) {
    throw new DesignParseError(
      'NO_YAML_FOUND',
      `No YAML found in ${filePath}. DESIGN.md requires a frontmatter block (between --- lines) or a fenced \`\`\`yaml block. See https://github.com/google/design.md (docs/spec.md).`
    );
  }

  const merged = mergeYamlBlocks(blocks);
  const sections = extractH2Sections(raw);
  assertUniqueSections(sections);

  const warnings: string[] = [];
  const colors = validateColors(merged['colors']);
  const typography = validateTypography(merged['typography'], warnings);
  const rounded = validateRounded(merged['rounded']);
  const spacing = validateSpacing(merged['spacing']);

  // Build a scope used for `{token.path}` resolution. References inside
  // the `components` section may resolve to composite values; references
  // in primitive groups must resolve to a primitive (enforced below).
  const refScope: RefScope = {
    colors,
    typography,
    rounded,
    spacing,
  };

  const components = validateComponents(merged['components'], refScope, warnings);

  const name = pickName(merged, raw, filePath);
  const description = typeof merged['description'] === 'string' ? (merged['description'] as string) : undefined;
  const version = typeof merged['version'] === 'string' ? (merged['version'] as string) : undefined;

  for (const key of Object.keys(merged)) {
    if (!KNOWN_YAML_KEYS.has(key)) {
      warnings.push(`Unknown top-level key '${key}' in YAML -- preserved but not applied.`);
    }
  }

  return {
    version,
    name,
    description,
    source: filePath,
    colors,
    typography,
    rounded,
    spacing,
    components,
    sections,
    warnings,
  };
}

/**
 * Resolve a user-supplied path (file or directory) to the actual DESIGN.md.
 */
export function resolveDesignFile(target: string): string {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) {
    throw new DesignParseError('NOT_FOUND', `Design path does not exist: ${abs}`);
  }

  const stat = fs.statSync(abs);
  if (stat.isFile()) return abs;

  if (stat.isDirectory()) {
    const candidates = ['DESIGN.md', 'design.md', 'Design.md', 'design-md.md', 'design.markdown'];
    for (const c of candidates) {
      const p = path.join(abs, c);
      if (fs.existsSync(p)) return p;
    }
    const entries = fs.readdirSync(abs).filter((f) => /\.md$/i.test(f));
    const designLike = entries.find((f) => /design/i.test(f));
    if (designLike) return path.join(abs, designLike);
    if (entries.length === 1) return path.join(abs, entries[0]);
    throw new DesignParseError(
      'NOT_FOUND',
      `No DESIGN.md found in directory: ${abs}. Expected one of ${candidates.join(', ')}.`
    );
  }

  throw new DesignParseError('NOT_FOUND', `Unsupported design path (not a file or directory): ${abs}`);
}

/**
 * Human-readable summary for the REPL's `/design info` command.
 */
export function describeTokens(tokens: DesignTokens): string {
  const lines: string[] = [];
  lines.push(`name:    ${tokens.name}`);
  if (tokens.version) lines.push(`version: ${tokens.version}`);
  if (tokens.description) lines.push(`about:   ${tokens.description}`);
  lines.push(`source:  ${tokens.source}`);
  lines.push('');

  lines.push(`colors (${Object.keys(tokens.colors).length}):`);
  for (const [k, v] of Object.entries(tokens.colors).slice(0, 12)) {
    lines.push(`  ${k.padEnd(22)} ${v}`);
  }
  if (Object.keys(tokens.colors).length > 12) {
    lines.push(`  ... ${Object.keys(tokens.colors).length - 12} more`);
  }

  const tyKeys = Object.keys(tokens.typography);
  if (tyKeys.length) {
    lines.push('');
    lines.push(`typography (${tyKeys.length}):`);
    for (const k of tyKeys.slice(0, 8)) {
      const t = tokens.typography[k];
      const summary = [t.fontFamily, t.fontSize, t.fontWeight]
        .filter(Boolean)
        .join(' / ');
      lines.push(`  ${k.padEnd(22)} ${summary}`);
    }
  }

  const rKeys = Object.keys(tokens.rounded);
  if (rKeys.length) {
    lines.push('');
    lines.push(`rounded:  ${rKeys.map((k) => `${k}=${tokens.rounded[k]}`).join(', ')}`);
  }

  const sKeys = Object.keys(tokens.spacing);
  if (sKeys.length) {
    lines.push('');
    lines.push(`spacing:  ${sKeys.map((k) => `${k}=${tokens.spacing[k]}`).join(', ')}`);
  }

  const cKeys = Object.keys(tokens.components);
  if (cKeys.length) {
    lines.push('');
    lines.push(`components: ${cKeys.join(', ')}`);
  }

  if (tokens.warnings.length) {
    lines.push('');
    lines.push('warnings:');
    for (const w of tokens.warnings) lines.push(`  ! ${w}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// YAML extraction
// ---------------------------------------------------------------------------

interface YamlBlock {
  yaml: string;
  source: 'frontmatter' | 'fenced';
  /** 1-based line number where the YAML content starts in the file. */
  startLine: number;
}

/**
 * Pull every YAML block out of the raw text:
 *   1. An optional leading `---\n…\n---` frontmatter block.
 *   2. Any number of fenced ```yaml / ```yml code blocks in the body.
 */
function extractYamlBlocks(raw: string): YamlBlock[] {
  const blocks: YamlBlock[] = [];
  const lines = raw.split(/\r?\n/);

  let bodyStart = 0;
  if (lines.length >= 2 && lines[0].trim() === '---') {
    // Find the matching closing `---`.
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        end = i;
        break;
      }
    }
    if (end > 0) {
      const yaml = lines.slice(1, end).join('\n');
      blocks.push({ yaml, source: 'frontmatter', startLine: 2 });
      bodyStart = end + 1;
    }
  }

  // Scan the body for fenced yaml blocks.
  let inFence = false;
  let fenceLang = '';
  let fenceStart = 0;
  let fenceBuf: string[] = [];
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    const fenceOpen = line.match(/^```\s*([a-zA-Z0-9_+-]*)\s*$/);
    if (!inFence && fenceOpen) {
      inFence = true;
      fenceLang = fenceOpen[1];
      fenceStart = i + 2; // 1-based line AFTER the ``` marker
      fenceBuf = [];
      continue;
    }
    if (inFence && /^```\s*$/.test(line)) {
      if (fenceLang === 'yaml' || fenceLang === 'yml') {
        blocks.push({
          yaml: fenceBuf.join('\n'),
          source: 'fenced',
          startLine: fenceStart,
        });
      }
      inFence = false;
      fenceLang = '';
      fenceBuf = [];
      continue;
    }
    if (inFence) fenceBuf.push(line);
  }

  return blocks;
}

/**
 * Parse each YAML block, reject duplicate top-level keys across blocks,
 * and return the merged plain object.
 */
function mergeYamlBlocks(blocks: YamlBlock[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const seen = new Map<string, number>();

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    let parsed: unknown;
    try {
      parsed = YAML.parse(block.yaml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new DesignParseError(
        'YAML_PARSE_ERROR',
        `YAML parse error in ${block.source} (line ~${block.startLine}): ${msg}`
      );
    }
    if (parsed == null) continue;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new DesignParseError(
        'YAML_SHAPE_ERROR',
        `YAML root must be a mapping (line ~${block.startLine}).`
      );
    }
    const obj = parsed as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (seen.has(key)) {
        throw new DesignParseError(
          'DUPLICATE_YAML_KEY',
          `Top-level key '${key}' is defined in multiple YAML blocks (first seen in block #${seen.get(key)! + 1}).`
        );
      }
      seen.set(key, idx);
      merged[key] = obj[key];
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Section (H2) handling
// ---------------------------------------------------------------------------

function extractH2Sections(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function assertUniqueSections(sections: string[]): void {
  const seen = new Map<string, string>();
  for (const heading of sections) {
    const canonical = SECTION_ALIASES[heading.toLowerCase().trim()] ?? null;
    if (!canonical) continue;
    const prev = seen.get(canonical);
    if (prev) {
      throw new DesignParseError(
        'DUPLICATE_SECTION',
        `Duplicate canonical section '${canonical}' -- both '## ${prev}' and '## ${heading}' are present. Per spec, sections must be unique.`
      );
    }
    seen.set(canonical, heading);
  }
}

// ---------------------------------------------------------------------------
// Validation -- colors, typography, rounded, spacing
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null && !Array.isArray(v);
}

function asRecord(raw: unknown, label: string): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) {
    throw new DesignParseError('SHAPE_ERROR', `'${label}' must be a mapping.`);
  }
  return raw;
}

function validateColors(raw: unknown): Record<string, string> {
  const obj = asRecord(raw, 'colors');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string' || !HEX_COLOR_RE.test(v.trim())) {
      throw new DesignParseError(
        'INVALID_COLOR',
        `colors.${k}: expected a hex color like "#RRGGBB" or "#RRGGBBAA", got ${JSON.stringify(v)}.`
      );
    }
    out[k] = v.trim().toLowerCase();
  }
  return out;
}

function validateTypography(
  raw: unknown,
  warnings: string[]
): Record<string, Typography> {
  const obj = asRecord(raw, 'typography');
  const out: Record<string, Typography> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isPlainObject(v)) {
      throw new DesignParseError(
        'INVALID_TYPOGRAPHY',
        `typography.${k}: expected a mapping, got ${JSON.stringify(v)}.`
      );
    }
    const t: Typography = {};
    for (const [pk, pv] of Object.entries(v)) {
      if (!KNOWN_TYPOGRAPHY_PROPS.has(pk)) {
        warnings.push(`Unknown typography property '${pk}' on typography.${k} -- preserved.`);
      }
      switch (pk) {
        case 'fontFamily':
          t.fontFamily = String(pv);
          break;
        case 'fontSize':
          t.fontSize = validateDimension(pv, `typography.${k}.fontSize`);
          break;
        case 'fontWeight':
          // The spec allows bare number OR quoted string; both are equivalent.
          if (typeof pv !== 'number' && typeof pv !== 'string') {
            throw new DesignParseError(
              'INVALID_TYPOGRAPHY',
              `typography.${k}.fontWeight: expected number or string, got ${JSON.stringify(pv)}.`
            );
          }
          t.fontWeight = pv;
          break;
        case 'lineHeight':
          // Dimension OR unitless number.
          if (typeof pv === 'number') t.lineHeight = pv;
          else if (typeof pv === 'string') {
            if (DIMENSION_RE.test(pv.trim())) t.lineHeight = pv.trim();
            else if (/^-?\d*\.?\d+$/.test(pv.trim())) t.lineHeight = Number(pv.trim());
            else {
              throw new DesignParseError(
                'INVALID_TYPOGRAPHY',
                `typography.${k}.lineHeight: expected Dimension or unitless number, got ${JSON.stringify(pv)}.`
              );
            }
          } else {
            throw new DesignParseError(
              'INVALID_TYPOGRAPHY',
              `typography.${k}.lineHeight: expected Dimension or unitless number, got ${JSON.stringify(pv)}.`
            );
          }
          break;
        case 'letterSpacing':
          t.letterSpacing = validateLetterSpacing(pv, `typography.${k}.letterSpacing`);
          break;
        case 'fontFeature':
          t.fontFeature = String(pv);
          break;
        case 'fontVariation':
          t.fontVariation = String(pv);
          break;
        default:
          // Unknown property -- preserve as a string on the typography
          // entry for forward compatibility.
          (t as unknown as Record<string, unknown>)[pk] = pv;
      }
    }
    out[k] = t;
  }
  return out;
}

function validateDimension(v: unknown, label: string): string {
  if (typeof v === 'number') return `${v}px`;
  if (typeof v !== 'string') {
    throw new DesignParseError('INVALID_DIMENSION', `${label}: expected Dimension (px|em|rem), got ${JSON.stringify(v)}.`);
  }
  const trimmed = v.trim();
  if (!DIMENSION_RE.test(trimmed)) {
    throw new DesignParseError('INVALID_DIMENSION', `${label}: expected Dimension (px|em|rem), got ${JSON.stringify(v)}.`);
  }
  return trimmed;
}

function validateLetterSpacing(v: unknown, label: string): string {
  // letterSpacing is a Dimension but some sources use em values like
  // "-0.02em"; DIMENSION_RE already accepts that. Numbers are also
  // allowed by real-world fixtures -- treat as px.
  if (typeof v === 'number') return `${v}px`;
  if (typeof v !== 'string') {
    throw new DesignParseError('INVALID_DIMENSION', `${label}: expected Dimension, got ${JSON.stringify(v)}.`);
  }
  const trimmed = v.trim();
  if (!DIMENSION_RE.test(trimmed)) {
    throw new DesignParseError('INVALID_DIMENSION', `${label}: expected Dimension (px|em|rem), got ${JSON.stringify(v)}.`);
  }
  return trimmed;
}

function validateRounded(raw: unknown): Record<string, string> {
  const obj = asRecord(raw, 'rounded');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') {
      out[k] = `${v}px`;
      continue;
    }
    if (typeof v !== 'string') {
      throw new DesignParseError('INVALID_DIMENSION', `rounded.${k}: expected Dimension, got ${JSON.stringify(v)}.`);
    }
    const trimmed = v.trim();
    // Allow large px values for "full" (9999px) and a couple of sentinel forms.
    if (!DIMENSION_RE.test(trimmed)) {
      throw new DesignParseError('INVALID_DIMENSION', `rounded.${k}: expected Dimension (px|em|rem), got ${JSON.stringify(v)}.`);
    }
    out[k] = trimmed;
  }
  return out;
}

function validateSpacing(raw: unknown): Record<string, string | number> {
  const obj = asRecord(raw, 'spacing');
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') {
      out[k] = v;
      continue;
    }
    if (typeof v !== 'string') {
      throw new DesignParseError('INVALID_SPACING', `spacing.${k}: expected Dimension or number, got ${JSON.stringify(v)}.`);
    }
    const trimmed = v.trim();
    if (DIMENSION_RE.test(trimmed) || /^-?\d*\.?\d+$/.test(trimmed)) {
      out[k] = trimmed;
      continue;
    }
    // Per spec "Consumer Behavior for Unknown Content", accept raw strings
    // for unusual spacing values (e.g. `grid-columns: '5'`, `container-max: '1280px'`).
    out[k] = trimmed;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Components -- accepts composite `{token.path}` references
// ---------------------------------------------------------------------------

interface RefScope {
  colors: Record<string, string>;
  typography: Record<string, Typography>;
  rounded: Record<string, string>;
  spacing: Record<string, string | number>;
}

function validateComponents(
  raw: unknown,
  scope: RefScope,
  warnings: string[]
): Record<string, Record<string, ComponentValue>> {
  const obj = asRecord(raw, 'components');
  const out: Record<string, Record<string, ComponentValue>> = {};
  for (const [compName, compVal] of Object.entries(obj)) {
    if (!isPlainObject(compVal)) {
      throw new DesignParseError(
        'INVALID_COMPONENT',
        `components.${compName}: expected a mapping of property names to values.`
      );
    }
    const resolved: Record<string, ComponentValue> = {};
    for (const [prop, rawVal] of Object.entries(compVal)) {
      if (rawVal == null) continue;
      if (typeof rawVal === 'number') {
        resolved[prop] = rawVal;
        continue;
      }
      if (typeof rawVal !== 'string') {
        throw new DesignParseError(
          'INVALID_COMPONENT',
          `components.${compName}.${prop}: expected string or number, got ${typeof rawVal}.`
        );
      }
      resolved[prop] = resolveComponentValue(rawVal, scope, `components.${compName}.${prop}`);
    }
    out[compName] = resolved;
  }

  // Emit warnings for unknown property names (spec's consumer-behavior table).
  const KNOWN_COMP_PROPS = new Set([
    'backgroundColor',
    'textColor',
    'typography',
    'rounded',
    'padding',
    'size',
    'height',
    'width',
    'borderColor',
    'borderWidth',
  ]);
  for (const [compName, props] of Object.entries(out)) {
    for (const prop of Object.keys(props)) {
      if (!KNOWN_COMP_PROPS.has(prop)) {
        warnings.push(`Unknown component property '${prop}' on components.${compName} -- preserved.`);
      }
    }
  }

  return out;
}

/**
 * Resolve a component value. If the entire string is a `{path}` ref, return
 * the referenced value (primitive or stringified composite). Otherwise, do
 * recursive in-string substitution of `{path}` refs.
 */
function resolveComponentValue(raw: string, scope: RefScope, label: string): ComponentValue {
  const trimmed = raw.trim();
  const whole = trimmed.match(TOKEN_REF_RE);
  if (whole) {
    return resolveRef(whole[1], scope, label, /* allowComposite */ true, new Set());
  }
  if (trimmed.includes('{')) {
    return trimmed.replace(TOKEN_REF_EMBED_RE, (_m, p) => {
      const v = resolveRef(p, scope, label, /* allowComposite */ false, new Set());
      return String(v);
    });
  }
  return trimmed;
}

/**
 * Resolve a dotted `{path}` such as `colors.primary-60`,
 * `typography.label-md`, `rounded.md`, `spacing.gutter`.
 */
function resolveRef(
  pathStr: string,
  scope: RefScope,
  label: string,
  allowComposite: boolean,
  seen: Set<string>
): ComponentValue {
  if (seen.has(pathStr)) {
    throw new DesignParseError(
      'REF_CYCLE',
      `Cyclic reference while resolving '${label}' -> {${pathStr}}.`
    );
  }
  seen.add(pathStr);

  const segments = pathStr.split('.');
  if (segments.length < 2) {
    throw new DesignParseError(
      'INVALID_REF',
      `Invalid token reference in ${label}: {${pathStr}} -- expected group.name form (e.g. {colors.primary}).`
    );
  }
  const [group, ...rest] = segments;
  const key = rest.join('.');

  const lookup = (): unknown => {
    switch (group) {
      case 'colors':
        return scope.colors[key];
      case 'typography':
        return scope.typography[key];
      case 'rounded':
        return scope.rounded[key];
      case 'spacing':
        return scope.spacing[key];
      default:
        return undefined;
    }
  };

  const v = lookup();
  if (v === undefined) {
    throw new DesignParseError(
      'UNRESOLVED_REF',
      `Token reference {${pathStr}} in ${label} does not resolve.`
    );
  }

  if (group === 'typography') {
    if (!allowComposite) {
      throw new DesignParseError(
        'COMPOSITE_REF_NOT_ALLOWED',
        `Token reference {${pathStr}} resolves to a composite typography token; only references in components may be composite.`
      );
    }
    // Collapse a typography token into a single CSS shorthand-like string
    // so it can be dropped into a component property. Consumers of the
    // emitted CSS can still target --type-<level>-* vars for finer control.
    const t = v as Typography;
    const parts: string[] = [];
    if (t.fontWeight != null) parts.push(String(t.fontWeight));
    if (t.fontSize) parts.push(t.fontSize);
    if (t.lineHeight != null) parts.push(`/${typeof t.lineHeight === 'number' ? t.lineHeight : t.lineHeight}`);
    if (t.fontFamily) parts.push(t.fontFamily);
    return parts.join(' ').trim();
  }

  if (typeof v === 'number') return v;
  return String(v);
}

// ---------------------------------------------------------------------------
// Name derivation
// ---------------------------------------------------------------------------

function pickName(merged: Record<string, unknown>, raw: string, filePath: string): string {
  const y = merged['name'];
  if (typeof y === 'string' && y.trim()) return y.trim();

  const h1 = raw.match(/^#\s+(.+?)\s*$/m);
  if (h1) return h1[1].trim();

  const base = path.basename(path.dirname(filePath));
  if (base && base.toLowerCase() !== 'designs' && base !== '.' && base !== '/') {
    return capitalize(base);
  }
  return capitalize(path.basename(filePath, path.extname(filePath)));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
