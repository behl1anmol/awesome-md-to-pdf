#!/usr/bin/env node
/*
 * Visual-regression harness for the DESIGN.md pipeline.
 *
 * For every fixture listed below, runs the full DESIGN.md -> PDF -> PNG
 * pipeline using the compiled `dist/` build:
 *
 *   1. parse the DESIGN.md via src/design.ts
 *   2. render scripts/fixtures/visual.md through src/converter.ts with the
 *      parsed tokens applied
 *   3. rasterize page 1 to a PNG using scripts/pdf-page1-to-png.js
 *   4. compare the new PNG against scripts/baselines/<label>.png (if
 *      present). On first run, if no baseline exists, write one and warn.
 *
 * This is a smoke test, not a pixel-exact diff -- it ensures Puppeteer can
 * render every fixture end-to-end and produces a non-empty PNG.
 *
 * Usage:
 *   npm run verify:visual        -- run the harness
 *   npm run verify:visual -- --update-baselines   -- refresh baselines
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FIXTURES_DIR = path.join(ROOT, 'samples', 'design-fixtures');
const SPEC_EXAMPLES = path.resolve(ROOT, '..', 'design.md', 'examples');
const BASELINE_DIR = path.join(__dirname, 'baselines');
const OUTPUT_DIR = path.join(__dirname, 'visual-output');
const VISUAL_MD = path.join(__dirname, 'fixtures', 'visual.md');

const FIXTURES = [
  { label: 'claude-baseline', design: path.join(ROOT, 'src', 'designs', 'claude.md') },
  { label: 'linear', design: path.join(FIXTURES_DIR, 'linear.md') },
  { label: 'stripe', design: path.join(FIXTURES_DIR, 'stripe.md') },
  { label: 'spec-totality-festival', design: path.join(SPEC_EXAMPLES, 'totality-festival', 'DESIGN.md') },
  { label: 'spec-paws-and-paths', design: path.join(SPEC_EXAMPLES, 'paws-and-paths', 'DESIGN.md') },
];

async function main() {
  const args = process.argv.slice(2);
  const updateBaselines = args.includes('--update-baselines');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(BASELINE_DIR, { recursive: true });

  if (!fs.existsSync(VISUAL_MD)) {
    fs.mkdirSync(path.dirname(VISUAL_MD), { recursive: true });
    fs.writeFileSync(VISUAL_MD, DEFAULT_VISUAL_MD, 'utf8');
  }

  const cliPath = path.join(ROOT, 'bin', 'md-to-pdf.js');
  if (!fs.existsSync(cliPath)) {
    console.error(`[verify-visual] CLI not found at ${cliPath}. Run \`npm run build\` first.`);
    process.exit(2);
  }
  if (!fs.existsSync(path.join(DIST, 'design.js'))) {
    console.error('[verify-visual] dist/ not found. Run `npm run build` first.');
    process.exit(2);
  }

  const failures = [];

  for (const fx of FIXTURES) {
    if (!fs.existsSync(fx.design)) {
      console.log(`[verify-visual] SKIP ${fx.label} -- design not found: ${fx.design}`);
      continue;
    }

    const stageDir = path.join(OUTPUT_DIR, fx.label);
    fs.mkdirSync(stageDir, { recursive: true });
    const stageMd = path.join(stageDir, 'visual.md');
    fs.copyFileSync(VISUAL_MD, stageMd);

    const pdfDir = path.join(stageDir, 'pdf');
    fs.mkdirSync(pdfDir, { recursive: true });

    console.log(`[verify-visual] rendering ${fx.label} ...`);
    const code = await spawnCli(cliPath, [
      stageDir,
      '--output', pdfDir,
      '--design-light', fx.design,
      '--mode', 'light',
      '--no-banner',
    ]);
    if (code !== 0) {
      failures.push(`${fx.label}: CLI exited with code ${code}`);
      continue;
    }

    const pdfPath = path.join(pdfDir, 'visual.pdf');
    if (!fs.existsSync(pdfPath)) {
      failures.push(`${fx.label}: PDF not produced at ${pdfPath}`);
      continue;
    }
    const bytes = fs.statSync(pdfPath).size;
    if (bytes < 4096) {
      failures.push(`${fx.label}: PDF is suspiciously small (${bytes} bytes)`);
    }

    const rasterCode = await spawnNode(
      path.join(__dirname, 'pdf-page1-to-png.js'),
      [pdfPath]
    );
    if (rasterCode !== 0) {
      failures.push(`${fx.label}: pdf-page1-to-png exited with code ${rasterCode}`);
      continue;
    }

    const pngPath = pdfPath.replace(/\.pdf$/i, '.page1.png');
    if (!fs.existsSync(pngPath)) {
      failures.push(`${fx.label}: rasterized PNG not found at ${pngPath}`);
      continue;
    }
    const pngBytes = fs.statSync(pngPath).size;
    if (pngBytes < 2048) {
      failures.push(`${fx.label}: rasterized PNG is suspiciously small (${pngBytes} bytes)`);
    }

    const baseline = path.join(BASELINE_DIR, `${fx.label}.png`);
    if (updateBaselines || !fs.existsSync(baseline)) {
      fs.copyFileSync(pngPath, baseline);
      console.log(`  -> baseline ${fs.existsSync(baseline) ? 'updated' : 'created'}: ${path.relative(ROOT, baseline)}`);
    } else {
      // Byte-level compare as a cheap smoke diff; we don't ship pixelmatch
      // in the default dep set. Anything non-trivial will show up as a
      // byte-size delta beyond a small tolerance.
      const baselineBytes = fs.statSync(baseline).size;
      const drift = Math.abs(pngBytes - baselineBytes) / baselineBytes;
      if (drift > 0.15) {
        failures.push(
          `${fx.label}: PNG drift vs baseline is ${(drift * 100).toFixed(1)}% (${baselineBytes} -> ${pngBytes} bytes). Re-run with --update-baselines if expected.`
        );
      } else {
        console.log(`  -> matches baseline (drift ${(drift * 100).toFixed(1)}%)`);
      }
    }
  }

  if (failures.length) {
    console.error('\n[verify-visual] FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }

  console.log('\n[verify-visual] OK');
}

function spawnCli(cliPath, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: 'inherit',
      env: { ...process.env, MDTOPDF_NO_BANNER: '1' },
    });
    child.on('close', resolve);
  });
}

function spawnNode(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit' });
    child.on('close', resolve);
  });
}

const DEFAULT_VISUAL_MD = `# Visual regression sample

This document exercises the spec-driven typography, color, rounded, and spacing
surfaces so a DESIGN.md change shows up visually on page 1.

## Typography scale

### H3 subheading

Body copy that should pick up \`--type-body-md-*\` variables. The lead paragraph
directly under H1 uses \`--type-body-lg-*\` for contrast.

## Colors and components

- **Primary** accent on links and CTAs.
- **Secondary** hover state.
- **On-surface** is the text color.

| Column A | Column B | Column C |
|---|---|---|
| Row 1 | data | data |
| Row 2 | data | data |

\`\`\`ts
const tokens = parseDesignMd('./DESIGN.md');
console.log(tokens.colors.primary);
\`\`\`

::: tip
Admonitions inherit border-left from the brand accent, so any DESIGN.md that
overrides \`colors.primary\` will retint this block.
:::

::: button-primary
Primary button
:::
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
