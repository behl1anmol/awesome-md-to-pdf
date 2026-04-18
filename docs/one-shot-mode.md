---
title: One-shot mode
layout: default
nav_order: 4
---

# One-shot mode
{: .no_toc }

Pass a directory or file and awesome-md-to-pdf will run once and exit.
This is the mode you want for CI, Makefiles, and pre-commit hooks.
{: .fs-5 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Usage

```bash
awesome-md-to-pdf <inputDir> [options]
```

If `--mode` is omitted you'll be prompted interactively for **light** or
**dark**. Pass `--mode light` or `--mode dark` (or set the `MD_TO_PDF_MODE`
env var) in CI to skip the prompt.

## Examples

### Minimal

```bash
awesome-md-to-pdf docs
```

### Recursive, with TOC and cover page, dark mode

```bash
awesome-md-to-pdf docs -r --toc --cover --mode dark
```

### Merge everything into one report

```bash
awesome-md-to-pdf docs -s --toc --cover --mode light -o build
```

### Theme with a specific design

```bash
awesome-md-to-pdf docs --design designs/linear.md --mode dark
```

### Override just the accent

```bash
awesome-md-to-pdf docs --accent "#0ea5e9" --mode light
```

### CI-friendly (no banner, no prompt)

```bash
awesome-md-to-pdf docs \
  --mode light --no-banner \
  --toc --cover \
  -o artifacts
```

### Watch mode (rebuild on change)

```bash
awesome-md-to-pdf docs --mode light -w
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All files rendered successfully. |
| `1` | One or more files failed. The error is printed to stderr. |
| `2` | Invalid CLI flags. |

## Flags

See the [CLI reference](./cli-reference) for the full table.
