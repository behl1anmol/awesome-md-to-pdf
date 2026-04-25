---
title: Designs
layout: default
nav_order: 6
---

# Designs
{: .no_toc }

awesome-md-to-pdf follows Google's official
[DESIGN.md spec](https://github.com/google-code-labs/design.md). A `DESIGN.md` file ships
its design tokens as **YAML frontmatter** between two `---` lines; the prose
below is documentation. awesome-md-to-pdf parses the YAML, resolves
`{token.path}` references, and injects CSS custom properties for every group.
{: .fs-5 .fw-300 }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

## Minimum viable DESIGN.md

```markdown
---
version: alpha
name: My Brand
colors:
  primary: "#3366ff"
  neutral: "#ffffff"
  surface: "#ffffff"
  on-surface: "#111111"
  outline: "#e2e8f0"
typography:
  h1:
    fontFamily: Inter
    fontSize: 32pt
    fontWeight: 700
    lineHeight: 1.1
  body-md:
    fontFamily: Inter
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  sm: 8px
  md: 12px
  lg: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 8px
---

# My Brand

## Overview
A clean sans-serif system on white.

## Colors
- **Primary (Blue):** CTAs and links.
- **Neutral (White):** The canvas.

## Typography
Inter at 400 for body, 700 for headlines.

## Layout
20mm page margin with an 8pt spacing scale.
```

Run it:

```bash
awesome-md-to-pdf docs --design-light my-brand-light.md --design-dark my-brand-dark.md
```

Or inside [chat mode](./chat-mode):

```text
/design light my-brand-light.md
/design dark my-brand-dark.md
/convert docs
```

## The Claude baseline

No `--design-light`/`--design-dark` flags? awesome-md-to-pdf ships spec-compliant Claude baselines
that defines every token group (`colors`, `typography`, `rounded`, `spacing`,
`components`). Any key a user's `DESIGN.md` omits falls back to the baseline
via the default values declared in
[`src/themes/tokens.css`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/src/themes/tokens.css).

## Token groups

### Colors

`colors` is a flat `map<string, hex>`. Common keys and how they wire into the
PDF:

| Spec key              | CSS outcome                                |
| --------------------- | ------------------------------------------ |
| `primary`             | `--brand`, `--color-primary`               |
| `secondary`           | `--color-secondary`                        |
| `tertiary`            | `--brand-soft`, `--color-tertiary`         |
| `neutral`             | `--bg-page`, `--color-neutral`             |
| `surface`             | `--bg-surface`, code block background      |
| `on-surface`          | `--text-primary`                           |
| `on-surface-variant`  | `--text-secondary`                         |
| `outline`             | `--border-soft`                            |
| `outline-variant`     | `--border-warm`, `--code-border`           |
| `error`               | `--error`                                  |
| `focus`               | `--focus`                                  |

Any other key (e.g. `surface-container-high`) is emitted verbatim as
`--color-surface-container-high` so your `components.*` section can reference
it.

### Typography

`typography` is `map<string, Typography>`. The PDF's heading selectors read
specific level names:

| Typography key   | Where it shows up                         |
| ---------------- | ----------------------------------------- |
| `h1` ... `h6`    | Markdown `# H1` ... `###### H6`           |
| `body-md`        | Paragraphs, table cells, list items       |
| `body-lg`        | The lead paragraph directly under an H1   |
| `body-sm`        | Footnotes                                 |
| `code`           | Inline code and fenced code blocks        |
| `label-md`       | Component labels (buttons, chips, badges) |

Additional levels (`headline-xl`, `display-lg`, `label-caps`, …) emit vars but
are not wired into default selectors. Add a custom selector in your own
stylesheet to use them.

Each `Typography` entry supports `fontFamily`, `fontSize`, `fontWeight`,
`lineHeight` (dimension or unitless multiplier), `letterSpacing`, `fontFeature`,
`fontVariation` -- the full spec surface.

### Rounded, spacing

`rounded` maps scale levels (`sm`, `md`, `lg`, `xl`, `full`) to Dimensions.
`spacing` accepts Dimensions or raw numbers. The default base.css selectors
read `--rounded-md`, `--rounded-lg` on cards, code blocks, tables, and
`--spacing-md` on paragraph margins.

### Components

`components` is `map<string, map<string, value | {ref}>>`. Supported recognized
keys include `button-primary`, `button-secondary`, `button-tertiary`, `chip`,
`badge`, `card`, `tooltip`, `input-field`, and `list-item`. Each renders as a
`.component-<name>` CSS class; triggering the class inside markdown uses
`markdown-it-container` syntax:

```markdown
::: button-primary
Submit
:::

::: card
## Feature card title
Card body copy goes here.
:::
```

Component properties (`backgroundColor`, `textColor`, `rounded`, `padding`,
`borderColor`, etc.) may reference other tokens:

```yaml
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    borderColor: "{colors.outline}"
```

References are resolved at parse time. Cycles and unresolved paths are hard
errors.

## Dimension units

The spec requires `px | em | rem`. awesome-md-to-pdf additionally accepts
`pt` and `%` because it targets print-layout PDFs where `pt` is idiomatic --
Chromium's print pipeline resolves both. Stick to `px` for portability across
consumers.

## Section ordering

The spec requires `Overview -> Colors -> Typography -> Layout -> Elevation &
Depth -> Shapes -> Components -> Do's and Don'ts`. Unknown section headings are
preserved; **duplicate canonical sections error** (two `## Colors` headings is
a hard failure).

## Overriding just the accent

Don't need a whole DESIGN.md -- just a different link color?

```bash
awesome-md-to-pdf docs --accent "#0ea5e9"
```

Inside chat mode:

```text
/accent 0ea5e9
/accent reset
```

`--accent` overrides `--brand` / `--color-primary` even when a DESIGN.md is
loaded.

## Inspecting a parsed design

```text
/design light designs/my-brand-light.md
/design dark designs/my-brand-dark.md
/design info all
```

prints the full parsed token set -- colors, typography, rounded, spacing,
components, plus any non-fatal warnings -- so you can sanity-check the parse
before running a batch.

## Implementation pointer

The parser lives at
[`src/design.ts`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/src/design.ts).
The spec-to-CSS emitter lives at
[`src/template.ts`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/src/template.ts).
The CSS variables those emit are consumed by
[`src/themes/base.css`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/src/themes/base.css)
and
[`src/themes/tokens.css`](https://github.com/behl1anmol/awesome-md-to-pdf/blob/main/src/themes/tokens.css).
