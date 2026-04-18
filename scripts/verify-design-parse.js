#!/usr/bin/env node
/*
 * Regression guard for the DESIGN.md parser.
 *
 * Parses every fixture in [samples/design-fixtures/](../samples/design-fixtures/)
 * plus the bundled Claude baseline and the top-level Figma-inspired
 * Design.md, then prints a grid of extracted token values. Also asserts a
 * small set of invariants -- the Claude baseline must produce a complete
 * palette, and the Figma fixture must resolve the functional roles we
 * rely on in the visual tests (textPrimary, brand, bgSurface all black or
 * white, and a monospace font family).
 *
 * Usage:
 *   npm run verify:design
 *
 * Exits non-zero on any regression.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const DIST = path.resolve(__dirname, '..', 'dist');
const { parseDesignMd } = require(path.join(DIST, 'design'));

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'samples', 'design-fixtures');
const CLAUDE = path.join(ROOT, 'src', 'designs', 'claude.md');
const FIGMA = path.join(ROOT, 'Design.md');

const SLOTS = [
  'bgPage',
  'bgSurface',
  'bgSand',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'brand',
  'brandSoft',
  'borderSoft',
  'borderWarm',
  'error',
  'focus',
];

function listDesigns() {
  const out = [];
  if (fs.existsSync(CLAUDE)) out.push({ label: 'claude (baseline)', file: CLAUDE });
  if (fs.existsSync(FIGMA)) out.push({ label: 'figma (top-level)', file: FIGMA });

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

  return out;
}

function pad(s, n) {
  s = String(s ?? '');
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function printGrid(rows) {
  const labelW = Math.max(18, ...rows.map((r) => r.label.length)) + 2;
  const slotW = 9;

  process.stdout.write(pad('design', labelW));
  for (const s of SLOTS) process.stdout.write(pad(s.slice(0, slotW), slotW + 1));
  process.stdout.write('mono?\n');

  for (const row of rows) {
    process.stdout.write(pad(row.label, labelW));
    for (const s of SLOTS) {
      process.stdout.write(pad(row.light[s] ?? '--', slotW + 1));
    }
    process.stdout.write(row.fonts.mono ? 'yes' : '--');
    process.stdout.write('\n');
  }
}

function assert(cond, msg, failures) {
  if (!cond) failures.push(msg);
}

function check(rows) {
  const failures = [];
  const find = (label) => rows.find((r) => r.label.startsWith(label));

  const claude = find('claude');
  if (claude) {
    for (const required of ['bgPage', 'bgSurface', 'textPrimary', 'textSecondary', 'brand', 'borderSoft']) {
      assert(claude.light[required], `claude: missing ${required}`, failures);
    }
    assert(claude.fonts.sans, 'claude: missing fonts.sans', failures);
    assert(claude.fonts.serif, 'claude: missing fonts.serif', failures);
    assert(claude.fonts.mono, 'claude: missing fonts.mono', failures);
  }

  const figma = find('figma (top-level)') || find('figma');
  if (figma) {
    assert(figma.light.textPrimary === '#000000', `figma: textPrimary should be #000000, got ${figma.light.textPrimary}`, failures);
    assert(figma.light.brand === '#000000', `figma: brand should be #000000, got ${figma.light.brand}`, failures);
    assert(figma.light.bgSurface === '#ffffff', `figma: bgSurface should be #ffffff, got ${figma.light.bgSurface}`, failures);
    assert(figma.light.bgPage === '#ffffff', `figma: bgPage should be #ffffff, got ${figma.light.bgPage}`, failures);
    assert(figma.fonts.mono && /figmaMono/.test(figma.fonts.mono), `figma: fonts.mono missing or wrong, got ${figma.fonts.mono}`, failures);
  }

  const vercel = find('vercel');
  if (vercel) {
    assert(vercel.light.bgPage === '#ffffff', `vercel: bgPage #ffffff`, failures);
    assert(vercel.light.textPrimary === '#000000', `vercel: textPrimary #000000`, failures);
  }

  const apple = find('apple');
  if (apple) {
    assert(apple.light.bgPage === '#ffffff', `apple: bgPage #ffffff`, failures);
    assert(apple.light.textPrimary === '#000000', `apple: textPrimary #000000`, failures);
  }

  const uber = find('uber');
  if (uber) {
    assert(uber.light.textPrimary === '#000000', `uber: textPrimary #000000 (from "All text, all buttons")`, failures);
    assert(uber.light.bgPage === '#ffffff', `uber: bgPage #ffffff (from "Page background, card surfaces")`, failures);
    assert(uber.fonts.sans && /UberMoveText/.test(uber.fonts.sans), `uber: Body / UI compound label must parse to sans (got ${uber.fonts.sans})`, failures);
    assert(uber.fonts.mono && /UberMono/.test(uber.fonts.mono), `uber: Monospace / Code compound label must parse to mono`, failures);
  }

  const stripe = find('stripe');
  if (stripe) {
    assert(stripe.light.brand === '#635bff', `stripe: brand should be indigo #635bff (from "Primary CTA")`, failures);
    assert(stripe.light.borderSoft === '#e3e8ee', `stripe: borderSoft from "Border Default"`, failures);
  }

  return failures;
}

function main() {
  const designs = listDesigns();
  const rows = designs.map(({ label, file }) => {
    try {
      const tokens = parseDesignMd(file);
      return { label, light: tokens.light, dark: tokens.dark, fonts: tokens.fonts };
    } catch (err) {
      return { label, light: {}, dark: {}, fonts: {}, error: String(err && err.message || err) };
    }
  });

  printGrid(rows);

  const failures = check(rows);
  if (failures.length) {
    console.error('\n[verify-design] FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }

  console.log('\n[verify-design] OK (' + rows.length + ' designs parsed)');
}

main();
