---
title: Troubleshooting
layout: default
nav_order: 11
---

# Troubleshooting
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Puppeteer fails to download Chromium

Behind a corporate proxy or firewall, `npm install` may stall on
downloading Chromium.

- **Option A**: set `HTTPS_PROXY` before install.

  ```bash
  HTTPS_PROXY=http://proxy.example.com:8080 npm install
  ```

- **Option B**: skip the download entirely and point at a local browser.

  ```bash
  PUPPETEER_SKIP_DOWNLOAD=1 npm install
  export PUPPETEER_EXECUTABLE_PATH="/path/to/chrome"
  ```

  Any recent Chrome, Chromium, or Edge build works.

## Mermaid diagram is blank in the PDF

Almost always a syntax error in the diagram source. Chromium's page
errors are forwarded to stderr during conversion -- scroll up in the
console for a `Mermaid parse error` line.

When running batch conversions with `--concurrency > 1`, errors from one
file can get interleaved with progress output. Re-run the offending file
on its own with `--concurrency 1` to get a clean trace:

```bash
awesome-md-to-pdf path/to/just-this-one.md --concurrency 1
```

## Fonts look different than in a design reference

Brand fonts named inside a `DESIGN.md` (Anthropic Serif, Geist, Inter Variable,
UberMove, etc.) are often not public system fonts. The tool falls back to
Georgia / system-ui / JetBrains Mono, which are close analogues.

If your `DESIGN.md` names a specific font and the system doesn't have it,
Chromium uses the cascading fallback automatically -- the PDF will render
but will look closer to the closest installed substitute.

To bundle a custom font, add `@font-face` rules referencing a data URL or
a local file inside a `DESIGN.md` (Markdown authors can embed a fenced
`css` block with the `font-face` declarations).

## Banner renders as ASCII garbage or is monochrome

Your terminal doesn't support 24-bit color. Two fixes:

- Pass `--no-banner` to skip the banner entirely.
- Set `FORCE_COLOR=2` (256-color) or `FORCE_COLOR=3` (true-color) if you
  know your terminal supports it but auto-detection is failing.

Windows Terminal, iTerm2, Ghostty, WezTerm, and Kitty all support
24-bit color out of the box. The legacy `cmd.exe` console does not.

## Progress bar overlaps other console output

The per-file progress bar only activates when `--concurrency=1` (the
default in chat mode). In batch one-shot runs with `--concurrency > 1`
we fall back to `ora` spinners. If you want pristine logs for CI, pass
`--no-banner` and `--concurrency > 1` together.

## `node bin/awesome-md-to-pdf.js --help` exits with "Cannot find module dist/cli.js"

You haven't built yet. From the repo root:

```bash
npm run build
```

The `prestart` hook runs this automatically when you use `npm start`, and
CI runs it as a required step in [`.github/workflows/ci.yml`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/.github/workflows/ci.yml).

## `npm publish` fails with "403 Forbidden"

Make sure the repository's `NPM_TOKEN` secret points at an **automation**
token (not a publish-to-legacy token), and that the token's owner has
publish rights on the `awesome-md-to-pdf` package.

Also verify the release tag matches `package.json`:

```bash
node -p "require('./package.json').version"
```

should equal the release tag minus the leading `v`.

## GitHub Pages deploy succeeds but the site 404s

Two common causes:

1. The `baseurl` in [`docs/_config.yml`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/docs/_config.yml)
   doesn't match the repository name. For a repo named `awesome-md-to-pdf`
   owned by `behl1anmol`, `baseurl: "/awesome-md-to-pdf"` is correct.
2. Pages isn't set to deploy from **GitHub Actions** in the repository
   settings (Settings -> Pages -> Source: **GitHub Actions**).
