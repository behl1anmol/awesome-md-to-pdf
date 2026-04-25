#!/usr/bin/env node
/*
 * Regression guard for the DESIGN.md parser.
 *
 * Parses every fixture in [samples/design-fixtures/](../samples/design-fixtures/),
 * the bundled Claude baseline [src/designs/claude.md](../src/designs/claude.md),
 * and the official Google DESIGN.md examples shipped in sibling workspace
 * [../../design.md/examples/](../../design.md/examples/). Prints a summary
 * grid and asserts a small set of invariants that every spec-compliant
 * DESIGN.md must satisfy:
 *
 *   - `colors.primary` is a valid hex color
 *   - `typography['body-md'].fontFamily` resolves
 *   - `rounded.md` is a valid Dimension
 *   - every `{token.path}` reference in `components` resolves
 *
 * Also asserts negative paths:
 *
 *   - a DESIGN.md with no YAML throws NO_YAML_FOUND
 *   - a DESIGN.md with duplicate `## Colors` throws DUPLICATE_SECTION
 *   - a DESIGN.md with a YAML syntax error throws YAML_PARSE_ERROR
 *   - a DESIGN.md with an unresolved {ref} throws UNRESOLVED_REF
 *
 * Usage:
 *   npm run verify:design
 *
 * Exits non-zero on any regression.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const DIST = path.resolve(__dirname, '..', 'dist');
const { parseDesignMd, DesignParseError } = require(path.join(DIST, 'design'));

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'samples', 'design-fixtures');
const CLAUDE = path.join(ROOT, 'src', 'designs', 'claude.md');
const SPEC_EXAMPLES = path.resolve(ROOT, '..', 'design.md', 'examples');

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const DIM_RE = /^-?\d*\.?\d+(px|em|rem|pt|%)$/i;

function listDesigns() {
  const out = [];
  if (fs.existsSync(CLAUDE)) out.push({ label: 'claude (baseline)', file: CLAUDE });

  if (fs.existsSync(FIXTURE_DIR)) {
    for (const name of fs.readdirSync(FIXTURE_DIR).sort()) {
      if (!name.endsWith('.md')) continue;
      if (name.toLowerCase() === 'readme.md') continue;
      out.push({
        label: path.basename(name, '.md'),
        file: path.join(FIXTURE_DIR, name),
      });
    }
  }

  if (fs.existsSync(SPEC_EXAMPLES)) {
    for (const subdir of fs.readdirSync(SPEC_EXAMPLES).sort()) {
      const candidate = path.join(SPEC_EXAMPLES, subdir, 'DESIGN.md');
      if (fs.existsSync(candidate)) {
        out.push({ label: `spec:${subdir}`, file: candidate });
      }
    }
  }

  return out;
}

function pad(s, n) {
  s = String(s ?? '');
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function printGrid(rows) {
  const labelW = Math.max(22, ...rows.map((r) => r.label.length)) + 2;

  const headers = ['design', 'primary', 'neutral', 'surface', 'on-surface', 'outline', 'body-md.font', 'rounded.md', 'sections', 'comps'];
  process.stdout.write(pad(headers[0], labelW));
  for (const h of headers.slice(1)) process.stdout.write(pad(h, 14));
  process.stdout.write('\n');

  for (const row of rows) {
    process.stdout.write(pad(row.label, labelW));
    if (row.error) {
      process.stdout.write('  ERROR: ' + row.error);
      process.stdout.write('\n');
      continue;
    }
    const t = row.tokens;
    process.stdout.write(pad(t.colors.primary ?? '--', 14));
    process.stdout.write(pad(t.colors.neutral ?? t.colors.background ?? '--', 14));
    process.stdout.write(pad(t.colors.surface ?? '--', 14));
    process.stdout.write(pad(t.colors['on-surface'] ?? '--', 14));
    process.stdout.write(pad(t.colors.outline ?? '--', 14));
    process.stdout.write(pad((t.typography['body-md'] && t.typography['body-md'].fontFamily) || '--', 14));
    process.stdout.write(pad(t.rounded.md ?? '--', 14));
    process.stdout.write(pad(String(t.sections.length), 14));
    process.stdout.write(pad(String(Object.keys(t.components).length), 14));
    process.stdout.write('\n');
  }
}

function assert(cond, msg, failures) {
  if (!cond) failures.push(msg);
}

function checkFixture(label, tokens) {
  const failures = [];

  assert(tokens.colors.primary, `${label}: colors.primary is required`, failures);
  if (tokens.colors.primary) {
    assert(HEX_RE.test(tokens.colors.primary), `${label}: colors.primary is not a valid hex (${tokens.colors.primary})`, failures);
  }
  for (const [k, v] of Object.entries(tokens.colors)) {
    assert(HEX_RE.test(v), `${label}: colors.${k} is not a valid hex (${v})`, failures);
  }

  const body = tokens.typography['body-md'] || tokens.typography['body'] || tokens.typography['body-lg'];
  assert(body && body.fontFamily, `${label}: typography.body-md (or body/body-lg) with fontFamily is required`, failures);

  if (tokens.rounded && tokens.rounded.md) {
    assert(DIM_RE.test(tokens.rounded.md), `${label}: rounded.md is not a valid Dimension (${tokens.rounded.md})`, failures);
  }

  // Components should already have refs resolved by the parser -- any remaining
  // `{...}` literal is evidence that a ref wasn't applied.
  for (const [compName, props] of Object.entries(tokens.components)) {
    for (const [prop, val] of Object.entries(props)) {
      if (typeof val === 'string' && /^\{[^}]+\}$/.test(val.trim())) {
        failures.push(`${label}: components.${compName}.${prop} has unresolved ref ${val}`);
      }
    }
  }

  return failures;
}

function checkNegative(label, build, expectedCode) {
  const tmp = path.join(os.tmpdir(), `verify-design-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
  fs.writeFileSync(tmp, build(), 'utf8');
  try {
    parseDesignMd(tmp);
  } catch (err) {
    if (err instanceof DesignParseError && err.code === expectedCode) {
      return [];
    }
    return [`${label}: expected ${expectedCode}, got ${err && err.code ? err.code : err}`];
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
  return [`${label}: expected ${expectedCode}, but parseDesignMd did not throw`];
}

function main() {
  const designs = listDesigns();
  const rows = designs.map(({ label, file }) => {
    try {
      const tokens = parseDesignMd(file);
      return { label, tokens };
    } catch (err) {
      return { label, error: String((err && err.message) || err) };
    }
  });

  printGrid(rows);

  const failures = [];

  for (const row of rows) {
    if (row.error) {
      failures.push(`${row.label}: parse error -- ${row.error}`);
      continue;
    }
    failures.push(...checkFixture(row.label, row.tokens));
  }

  // --- Negative path checks -------------------------------------------------
  failures.push(...checkNegative(
    'no-yaml',
    () => '# Just prose\n\nNo frontmatter, no fenced yaml.\n',
    'NO_YAML_FOUND'
  ));

  failures.push(...checkNegative(
    'yaml-syntax',
    () => '---\nname: broken\ncolors:\n  primary: "#ffffff\n    invalid\n---\n# Broken\n',
    'YAML_PARSE_ERROR'
  ));

  failures.push(...checkNegative(
    'duplicate-colors-section',
    () => [
      '---',
      'name: dup',
      'colors:',
      '  primary: "#000000"',
      'typography:',
      '  body-md:',
      '    fontFamily: Inter',
      '---',
      '',
      '# Dup',
      '',
      '## Colors',
      'first',
      '',
      '## Colors',
      'second',
      '',
    ].join('\n'),
    'DUPLICATE_SECTION'
  ));

  failures.push(...checkNegative(
    'unresolved-ref',
    () => [
      '---',
      'name: bad-ref',
      'colors:',
      '  primary: "#000000"',
      'typography:',
      '  body-md:',
      '    fontFamily: Inter',
      'components:',
      '  button-primary:',
      '    backgroundColor: "{colors.nonexistent}"',
      '---',
      '# BadRef',
      '',
    ].join('\n'),
    'UNRESOLVED_REF'
  ));

  failures.push(...checkNegative(
    'invalid-color',
    () => [
      '---',
      'name: bad-color',
      'colors:',
      '  primary: "not-a-color"',
      '---',
      '# BadColor',
      '',
    ].join('\n'),
    'INVALID_COLOR'
  ));

  failures.push(...checkLegacyDesignFlagRemoved());

  if (failures.length) {
    console.error('\n[verify-design] FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }

  console.log('\n[verify-design] OK (' + rows.length + ' designs parsed, all invariants held)');
}

function checkLegacyDesignFlagRemoved() {
  const root = path.resolve(__dirname, '..');
  const cliPath = path.join(root, 'bin', 'md-to-pdf.js');
  if (!fs.existsSync(cliPath)) {
    return ['legacy-design-flag: CLI not found. Run `npm run build` first.'];
  }
  const run = spawnSync(process.execPath, [cliPath, '--design', 'samples/design-fixtures/linear.md', '--help'], {
    cwd: root,
    env: { ...process.env, MDTOPDF_NO_BANNER: '1' },
    encoding: 'utf8',
  });
  const output = `${run.stdout || ''}\n${run.stderr || ''}`;
  const errs = [];
  if (run.status === 0) {
    errs.push('legacy-design-flag: expected non-zero exit code when using removed `--design`.');
  }
  if (!output.includes('`--design` was removed')) {
    errs.push('legacy-design-flag: missing migration hint for removed `--design` flag.');
  }
  return errs;
}

main();
