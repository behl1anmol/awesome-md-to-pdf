#!/usr/bin/env node
/*
 * Renders page 1 of an existing PDF file to a PNG so you can visually
 * confirm the actual printed output (not just the pre-print HTML).
 *
 * Works by opening the PDF in Chromium's built-in viewer, cropping out the
 * toolbar, and snapshotting the first page.
 */

'use strict';

const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

(async () => {
  const pdfs = process.argv.slice(2);
  if (!pdfs.length) {
    console.error('Usage: node pdf-page1-to-png.js <pdf> [pdf...]');
    process.exit(2);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const rel of pdfs) {
      const pdf = path.resolve(rel);
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(pdf).href, { waitUntil: 'networkidle0', timeout: 30_000 });
      await new Promise((r) => setTimeout(r, 1500));
      const out = pdf.replace(/\.pdf$/i, '.page1.png');
      await page.screenshot({ path: out, fullPage: false });
      console.log(pdf, '->', out);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
