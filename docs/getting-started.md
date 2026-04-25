---
title: Getting started
layout: default
nav_order: 2
---

# Getting started
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Requirements

- **Node.js 24 or newer** (`node --version`). The CLI targets `>=24`.
- **~200 MB of free disk** for the bundled Chromium that Puppeteer downloads
  on first install. You can skip that download behind a corporate proxy --
  see [Troubleshooting](./troubleshooting#puppeteer-fails-to-download-chromium).

## Install

### Globally (recommended for day-to-day use)

```bash
npm install -g awesome-md-to-pdf
```

This installs two identical command-line entry points:

- `awesome-md-to-pdf` -- the canonical name.
- `md-to-pdf` -- kept as an alias for backward compatibility.

### One-off via npx

```bash
npx awesome-md-to-pdf ./docs --toc --cover --mode light
```

### From source

```bash
git clone https://github.com/behl1anmol/awesome-md-to-pdf.git
cd awesome-md-to-pdf
npm install
npm run build
node bin/awesome-md-to-pdf.js
```

## Your first PDF

Create a folder with a Markdown file:

```bash
mkdir notes
cat > notes/hello.md <<'EOF'
# Hello, PDF

Welcome to **awesome-md-to-pdf**.

- [x] Markdown
- [x] Mermaid
- [x] KaTeX
EOF
```

Then convert it:

```bash
awesome-md-to-pdf notes -o pdf --mode light
```

You'll see the 3D welcome banner, a live progress bar per file, and an
editorial-quality PDF under `pdf/hello.pdf`.

{: .tip }
> Run `awesome-md-to-pdf` with no arguments to land in [chat mode](./chat-mode)
> where you can iterate on designs and flags without re-typing.

## Next steps

- Try a non-default design: `awesome-md-to-pdf notes --design designs/linear.md --mode dark`.
- Author your own `DESIGN.md` following Google's [DESIGN.md spec](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md) -- see [Designs](./designs).
- Explore the [full CLI reference](./cli-reference).
