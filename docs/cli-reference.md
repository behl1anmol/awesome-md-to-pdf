---
title: CLI reference
layout: default
nav_order: 5
---

# CLI reference
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Synopsis

```bash
awesome-md-to-pdf [inputDir] [options]
```

When `inputDir` is omitted the CLI drops into [chat mode](./chat-mode).

## Options

| Flag | Description | Default |
|---|---|---|
| `-o, --output <dir>` | Output directory | `./pdf` |
| `-r, --recursive` | Recurse into subdirectories | `false` |
| `-s, --single-file` | Merge all `.md` files into one PDF | `false` |
| `-m, --mode <mode>` | `light` or `dark` | prompt |
| `--design <path>` | Path to a `DESIGN.md` file or folder | bundled Claude |
| `--accent <hex>` | Override the brand accent (`#rrggbb` or `rrggbb`) | design default |
| `-f, --format <fmt>` | `A4` / `Letter` / `Legal` | `A4` |
| `--toc` | Auto-generate a table of contents | `false` |
| `--cover` | Generate a cover page | `false` |
| `--page-numbers` | `page X / Y` band at the bottom (breaks full-bleed) | `false` |
| `--header <text>` | Custom top band (tokens: `{file}`, `{title}`, `{date}`) | none |
| `--footer <text>` | Custom bottom band | none |
| `--show-link-urls` | Print external URLs after link text | `false` |
| `--no-banner` | Suppress the welcome banner (CI-friendly) | off |
| `-c, --concurrency <n>` | Parallel conversions | `3` |
| `-w, --watch` | Watch for changes and rebuild | `false` |
| `--open` | Open the output folder when done | `false` |
| `-V, --version` | Print the version and exit | |
| `-h, --help` | Print help and exit | |

## Environment variables

| Variable | Purpose |
|---|---|
| `MD_TO_PDF_MODE` | Fallback for `--mode` when the flag is omitted. |
| `PUPPETEER_SKIP_DOWNLOAD` | Set to `1` to skip the bundled Chromium download. |
| `PUPPETEER_EXECUTABLE_PATH` | Point at a locally installed Chrome/Edge when skipping the download. |
| `FORCE_COLOR` | Set to `2` or `3` to force 256/true-color ANSI. |
| `HTTPS_PROXY` / `HTTP_PROXY` | Used by `npm install` and Puppeteer's download. |

## Header & footer templates

The `--header` and `--footer` flags accept literal text plus these tokens:

| Token | Expands to |
|---|---|
| `{file}` | The current filename (no extension). |
| `{title}` | The first `<h1>` in the document. |
| `{date}` | The build date (local time, `YYYY-MM-DD`). |

Example:

```bash
awesome-md-to-pdf docs \
  --header "awesome-md-to-pdf  /  {title}" \
  --footer "{date}  /  page {pageNumber} of {totalPages}"
```

{: .warning }
> Enabling `--header`, `--footer`, or `--page-numbers` reserves vertical
> space at the page edges and breaks the default full-bleed canvas.
> Leave them off for the "editorial magazine" look.
