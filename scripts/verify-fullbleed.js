#!/usr/bin/env node
/*
 * Reproduces the same HTML that the converter feeds to Puppeteer's
 * page.pdf(), but screenshots it as a PNG at A4 proportions for visual
 * verification of the full-bleed background and active design palette.
 *
 * Usage:
 *   node scripts/verify-fullbleed.js <markdownFile> [outDir] [designPath]
 */

'use strict';

const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

const DIST = path.resolve(__dirname, '..', 'dist');
const { createMarkdown, extractTitle } = require(path.join(DIST, 'markdown'));
const { buildHtml } = require(path.join(DIST, 'template'));
const { parseDesignMd } = require(path.join(DIST, 'design'));

// A4 at 96 DPI -> 794 x 1123
const A4_W = 794;
const A4_H = 1123;

async function renderOne(mdPath, mode, outDir, design) {
  const source = await fs.readFile(mdPath, 'utf8');
  const title = extractTitle(source) || path.basename(mdPath, '.md');
  const md = createMarkdown({ sourcePath: mdPath });
  const bodyHtml = md.render(source);

  const html = buildHtml({
    bodyHtml,
    title,
    mode,
    cover: true,
    toc: false,
    subtitle: '',
    design,
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-fb-'));
  const tmp = path.join(tmpDir, `v-${crypto.randomBytes(3).toString('hex')}.html`);
  await fs.writeFile(tmp, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: A4_W, height: A4_H, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: ['load', 'networkidle0'] });
  await page.evaluate(async () => {
    if (window.__mermaidDone) { try { await window.__mermaidDone; } catch (_e) {} }
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_e) {} }
  });

  const png = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: A4_W, height: A4_H },
  });

  const pixels = await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const htmlCs = getComputedStyle(document.documentElement);
    return { bodyBg: cs.backgroundColor, htmlBg: htmlCs.backgroundColor };
  });

  await browser.close();

  const name = design ? `${path.basename(mdPath, '.md')}-${design.name.toLowerCase().replace(/\W+/g, '')}-${mode}` : `${path.basename(mdPath, '.md')}-${mode}`;
  const out = path.join(outDir, `${name}.page1.png`);
  await fs.writeFile(out, png);
  await fs.rm(tmpDir, { recursive: true, force: true });

  return { out, pixels };
}

(async () => {
  const [mdArg, outDirArg, designArg] = process.argv.slice(2);
  if (!mdArg) {
    console.error('Usage: node verify-fullbleed.js <markdownFile> [outDir] [designPath]');
    process.exit(2);
  }
  const outDir = path.resolve(outDirArg || path.dirname(mdArg));
  await fs.mkdir(outDir, { recursive: true });

  const design = designArg ? parseDesignMd(path.resolve(designArg)) : null;

  for (const mode of ['light', 'dark']) {
    const { out, pixels } = await renderOne(path.resolve(mdArg), mode, outDir, design);
    console.log(`[${mode}] ${out}`);
    console.log(`  html bg: ${pixels.htmlBg}`);
    console.log(`  body bg: ${pixels.bodyBg}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
