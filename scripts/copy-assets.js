#!/usr/bin/env node
/*
 * copy-assets.js -- post-build step that copies static assets from
 * src/ into dist/. TypeScript's compiler only emits .js for .ts input;
 * CSS files, bundled DESIGN.md samples, and any other non-code assets
 * have to travel alongside it manually.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Each entry: [sourceSubpath under src/, destSubpath under dist/].
const COPY_DIRS = [
  ['themes', 'themes'],
  ['designs', 'designs'],
];

function copyRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      count += copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      count += 1;
    }
  }
  return count;
}

try {
  let total = 0;
  for (const [src, dest] of COPY_DIRS) {
    const srcAbs = path.join(ROOT, 'src', src);
    const destAbs = path.join(ROOT, 'dist', dest);
    if (!fs.existsSync(srcAbs)) continue;
    const n = copyRecursive(srcAbs, destAbs);
    total += n;
    console.log(`[copy-assets] ${src} -> ${path.relative(ROOT, destAbs)}  (${n} file(s))`);
  }
  console.log(`[copy-assets] Total: ${total} asset(s) copied.`);
} catch (err) {
  console.error('[copy-assets] Failed:', err.message || err);
  process.exit(1);
}
