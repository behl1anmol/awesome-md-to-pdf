#!/usr/bin/env node
'use strict';

// Filter the noisy punycode deprecation warning (DEP0040) that bubbles up
// from a transitive dep of puppeteer / markdown-it, without silencing real
// warnings. Must run before any other require() so the patched emit is
// installed when the deps load and emit the warning.
const origEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (
    name === 'warning' &&
    data &&
    data.name === 'DeprecationWarning' &&
    data.code === 'DEP0040'
  ) {
    return false;
  }
  return origEmit.call(this, name, data, ...args);
};

// Thin JS entry point. Loads the compiled TypeScript output from dist/.
// Run `npm run build` first if dist/ is missing (or if you changed src/).

const fs = require('fs');
const path = require('path');

const distCli = path.join(__dirname, '..', 'dist', 'cli.js');
if (!fs.existsSync(distCli)) {
  console.error(
    '[awesome-md-to-pdf] dist/cli.js not found.\n' +
      '                   Run `npm run build` (or `npm install` for a fresh checkout) first.'
  );
  process.exit(127);
}

const { run } = require(distCli);

run(process.argv).catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
