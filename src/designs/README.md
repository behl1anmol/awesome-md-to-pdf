# Designs

Drop any `DESIGN.md` into this folder (or point `--design` at a path anywhere on disk)
and awesome-md-to-pdf will render your PDFs in that visual system.

awesome-md-to-pdf follows Google's [DESIGN.md spec](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)
(see the local copy at `../../design.md/docs/spec.md`). A spec-compliant
`DESIGN.md` has two parts:

1. **YAML frontmatter** between two `---` lines that defines the normative tokens:
   `colors`, `typography`, `rounded`, `spacing`, and `components`.
2. **Prose sections** (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes,
   Components, Do's and Don'ts) that explain the design intent for humans.

Only the YAML is parsed. The prose is documentation.

## Minimal example

```yaml
---
version: alpha
name: My Design
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

# My Design

## Overview
Clean sans-serif system on white.

## Colors
- **Primary (Blue):** CTAs and links.
- **Neutral (White):** The canvas.
...
```

## What gets rendered

| Spec group   | CSS vars emitted                          | Where it shows up in the PDF              |
| ------------ | ----------------------------------------- | ----------------------------------------- |
| `colors`     | `--color-<key>` + role aliases            | Every color surface                       |
| `typography` | `--type-<level>-family/size/weight/line/track` | Headings, body, code                 |
| `rounded`    | `--rounded-<key>` + `--radius-*`          | Borders on cards, tables, code blocks     |
| `spacing`    | `--spacing-<key>`                         | Paragraph/list margins                    |
| `components` | `--component-<name>-<prop>`               | `::: button-primary`, `::: card`, etc. containers and CSS classes |

Color aliases wired into the Claude baseline selectors:

| Spec color key        | Legacy CSS var         |
| --------------------- | ---------------------- |
| `primary`             | `--brand`              |
| `tertiary`            | `--brand-soft`         |
| `surface`             | `--bg-surface`         |
| `on-surface`          | `--text-primary`       |
| `on-surface-variant`  | `--text-secondary`     |
| `outline`             | `--border-soft`        |
| `outline-variant`     | `--border-warm`        |
| `neutral`/`background`| `--bg-page`            |
| `error`               | `--error`              |

Any other color key is emitted verbatim as `--color-<key>` so a `components.*`
reference to `{colors.surface-container-high}` works out of the box.

## Typography level naming

The heading selectors in [../themes/base.css](../themes/base.css) read specific
level names:

- `h1` ... `h6` -> `--type-hN-*`
- body paragraphs -> `--type-body-md-*`
- lead paragraph under H1 -> `--type-body-lg-*`
- inline / block code -> `--type-code-*`

Using these names maximizes control. Other names (`headline-xl`, `display-lg`,
`label-md`, etc.) still emit vars but need a custom selector to take effect.

## Token references

Any component property can reference another token via `{group.name}` syntax:

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
```

References are resolved at parse time, error on cycles, and error on unresolved
paths.

## Bundled designs

- `claude.md` -- the Claude baseline, used automatically when no `--design` is
  passed.
- Additional fixtures live in `../../samples/design-fixtures/`.
