#!/usr/bin/env node
/*
 * clean.js -- remove the dist/ directory so we get a fresh TypeScript build.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');

try {
  fs.rmSync(dist, { recursive: true, force: true });
  console.log(`[clean] Removed ${path.relative(process.cwd(), dist) || dist}`);
} catch (err) {
  console.error('[clean] Failed:', err.message || err);
  process.exit(1);
}
