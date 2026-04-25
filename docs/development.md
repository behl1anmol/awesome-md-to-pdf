---
title: Development
layout: default
nav_order: 10
---

# Development
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Clone & install

```bash
git clone https://github.com/behl1anmol/awesome-md-to-pdf.git
cd awesome-md-to-pdf
npm install
```

`npm install` will fetch the bundled Chromium by default (~150 MB). See
[Troubleshooting](./troubleshooting#puppeteer-fails-to-download-chromium)
if that fails.

## Scripts

| Script | What it does |
|---|---|
| `npm run build` | `tsc` compile + `node scripts/copy-assets.js` (copies themes + designs to `dist/`). |
| `npm run typecheck` | `tsc --noEmit`. Fast, no disk writes. |
| `npm run clean` | Remove `dist/`. |
| `npm run rebuild` | `clean` + `build`. |
| `npm start` | `build` then run `node bin/md-to-pdf.js`. |
| `npm run demo:light` | Render the sample deck in light mode -> `samples/out/`. |
| `npm run demo:dark` | Render the sample deck in dark mode -> `samples/out/`. |

## Project layout

```text
src/                TypeScript source
  cli.ts            Argument parsing + chat routing
  converter.ts      Glob, concurrency pool, per-file pipeline
  markdown.ts       markdown-it + plugins
  template.ts       HTML shell, :root CSS variable overrides
  pdf.ts            Puppeteer lifecycle
  mermaid-runtime.ts  Client-side mermaid init (design-aware)
  design.ts         DESIGN.md parser (synonyms + regex + dark synthesis)
  banner.ts         3D welcome banner (origami icon + AWESOME eyebrow + wordmark)
  repl.ts           Interactive chat loop + slash commands
  progress.ts       cli-progress wrapper (per-file + overall bars)
  logger.ts         ora + chalk helpers
  prompt.ts         Light/dark picker
  themes/           CSS assets (copied to dist/ during build)
  designs/          Bundled claude.md + README
  types/            Ambient .d.ts shims for untyped packages
dist/               tsc output (gitignored) -- what the bin entry loads
bin/awesome-md-to-pdf.js  Thin JS shim that requires dist/cli.js (primary)
bin/md-to-pdf.js          Legacy-alias shim (kept for backward compatibility)
scripts/            Build helpers (copy-assets, clean, verify-fullbleed, ...)
samples/            Source Markdown + rendered samples for smoke-testing
.github/            CI, publish, and Pages workflows
docs/               Jekyll site (this one) -- deployed via GitHub Pages
```

## Release flow

1. Bump `version` in [package.json](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/package.json).
2. Update the changelog (if you keep one) and the docs for any new flags.
3. Commit and push.
4. Create a GitHub Release with a tag like `v0.2.0`. The release tag's
   version must match `package.json` or the publish workflow will fail by
   design.
5. GitHub Actions runs `.github/workflows/publish.yml`:
   - `npm ci` (clean install)
   - asserts the tag matches `package.json`
   - `npm run build`
   - `npm publish --provenance --access public` using `NPM_TOKEN`

## Secrets required on GitHub

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | Automation token from npm with publish rights for `awesome-md-to-pdf`. |

GitHub Pages and npm provenance both use OIDC (`id-token: write`) and need
no extra secret.

## Local docs preview

```bash
cd docs
bundle install
bundle exec jekyll serve --livereload
```

Then open `http://127.0.0.1:4000/awesome-md-to-pdf/`.
