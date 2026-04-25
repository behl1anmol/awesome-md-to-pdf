---
name: design-system-knowledge
description: Deep knowledge of the spec-compliant DESIGN.md parser (src/design.ts) and how parsed YAML tokens flow into rendered PDFs. Covers DesignTokens/Typography interfaces, the YAML frontmatter parser, duplicate-section detection, {token.path} reference resolution, the CSS emission layer in src/template.ts, and the CSS variable naming conventions. Use when DESIGN.md parsing is involved, when adding a new token key, or when debugging why a token isn't taking effect in the PDF.
triggers: DESIGN.md, DesignTokens, Typography, parseDesignMd, describeTokens, DesignParseError, colors, typography, rounded, spacing, components, token reference, buildDesignOverride, --type-h1, --rounded-md, --color-primary, --component-button-primary, Google DESIGN.md spec, YAML frontmatter
---

# Design system

All design-driven theming in awesome-md-to-pdf flows through
[src/design.ts](src/design.ts) -- a spec-compliant parser for Google's
[DESIGN.md spec](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md) -- and lands as CSS custom
property overrides emitted by [src/template.ts](src/template.ts). The parser
reads only YAML; prose in the body is documentation, not a source of truth.

## Types

```ts
export interface DesignTokens {
  version?: string;
  name: string;
  description?: string;
  source: string;
  colors: Record<string, string>;
  typography: Record<string, Typography>;
  rounded: Record<string, string>;
  spacing: Record<string, string | number>;
  components: Record<string, Record<string, string | number>>;
  sections: string[];
  warnings: string[];
}

export interface Typography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: string | number;
  letterSpacing?: string;
  fontFeature?: string;
  fontVariation?: string;
}
```

`DesignParseError` (exported) is thrown on any hard failure with a `code` field:
`NO_YAML_FOUND`, `YAML_PARSE_ERROR`, `DUPLICATE_YAML_KEY`, `DUPLICATE_SECTION`,
`INVALID_COLOR`, `INVALID_TYPOGRAPHY`, `INVALID_DIMENSION`, `INVALID_COMPONENT`,
`INVALID_REF`, `UNRESOLVED_REF`, `REF_CYCLE`, `COMPOSITE_REF_NOT_ALLOWED`.

## Public API

- `parseDesignMd(target: string): DesignTokens` -- parse a file or a directory
  containing a `DESIGN.md`. Throws `DesignParseError` on any failure; does not
  fall back silently.
- `resolveDesignFile(target: string): string` -- resolve a file/directory path
  to the actual `.md`. Accepts `DESIGN.md`, `design.md`, `Design.md`,
  `design-md.md`, `design.markdown`.
- `describeTokens(tokens: DesignTokens): string` -- human-readable summary for
  `/design info` in the REPL.

## Parser pipeline

1. **Read** the file; extract every YAML block:
   - An optional leading `---\n...\n---` frontmatter block.
   - Any number of fenced <code>```yaml</code> / <code>```yml</code> blocks in
     the body.
2. **Parse** each YAML block via the `yaml` package. Syntax errors throw
   `YAML_PARSE_ERROR`.
3. **Merge** blocks, rejecting duplicate top-level keys (`DUPLICATE_YAML_KEY`).
4. **Walk H2 headings** and reject duplicate canonical sections (Overview,
   Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and
   Don'ts). Two `## Colors` headings -> `DUPLICATE_SECTION`.
5. **Validate** each token group:
   - `colors`: every value matches `#RRGGBB`, `#RGB`, or `#RRGGBBAA`.
   - `typography`: every value has the correct shape; unknown properties are
     preserved with a warning.
   - `rounded`: every value matches `px | em | rem | pt | %`.
   - `spacing`: same Dimension grammar, plus raw numbers.
6. **Resolve `{token.path}` references** inside `components`. Primitives-only
   outside `components`; composite `{typography.body-md}` refs allowed inside
   components. Cycle detection throws `REF_CYCLE`; unresolved paths throw
   `UNRESOLVED_REF`.
7. **Emit** `DesignTokens`. No synthesis, no silent fallback.

## Precedence chain (rendering)

From lowest priority to highest, as consumed by [src/template.ts](src/template.ts):

1. Claude baseline defaults in [src/themes/tokens.css](src/themes/tokens.css)
   `:root` + `[data-mode="dark"]`.
2. Parsed `DesignTokens` -> emitted as one `:root { ... }` block by
   `buildDesignOverride` after the baseline. Emits:
   - `--color-<key>` for every `colors` entry.
   - `--type-<level>-family`, `-size`, `-weight`, `-line`, `-track` for each
     `typography` entry.
   - `--rounded-<key>` for each `rounded` entry.
   - `--spacing-<key>` for each `spacing` entry.
   - `--component-<name>-<prop>` for each `components.*.*` pair (refs resolved).
   - Legacy aliases: `--brand`, `--bg-surface`, `--text-primary`,
     `--border-soft`, `--radius-sm/md/lg/xl`, `--font-sans/serif/mono` --
     wired from the spec colors/fonts for backwards compatibility.
3. `--accent <hex>` (CLI) -> `:root { --brand: X; --brand-soft: X; }`. Still
   wins over YAML for the brand accent only.

Unset slots cascade transparently because they're not emitted.

## Canonical color mapping

| Spec key             | CSS aliases                       |
| -------------------- | --------------------------------- |
| `primary`            | `--brand`                         |
| `tertiary`           | `--brand-soft`                    |
| `neutral`            | `--bg-page`                       |
| `background`         | `--bg-page`                       |
| `surface`            | `--bg-surface`, `--code-bg`, `--code-inline-bg` |
| `on-surface`         | `--text-primary`                  |
| `on-background`      | `--text-primary`                  |
| `on-surface-variant` | `--text-secondary`                |
| `outline`            | `--border-soft`                   |
| `outline-variant`    | `--border-warm`, `--code-border`  |
| `error`              | `--error`                         |

Any other color key lands verbatim as `--color-<key>` and is available for
custom selectors or component refs.

## Typography selectors

[src/themes/base.css](src/themes/base.css) reads the typography vars under
these names:

| Selector target                  | Typography key it reads |
| -------------------------------- | ----------------------- |
| `.markdown-body h1`              | `h1`                    |
| `.markdown-body h2`              | `h2`                    |
| `.markdown-body h3`              | `h3`                    |
| `.markdown-body h4`              | `h4`                    |
| `.markdown-body h5`              | `h5`                    |
| `.markdown-body h6`              | `h6`                    |
| `.markdown-body p`, table cells  | `body-md`               |
| `.markdown-body h1 + p` (lead)   | `body-lg`               |
| `.markdown-body code`, `pre`     | `code`                  |

If a DESIGN.md uses alternate names (`headline-xl`, `display-lg`, …) those
still emit CSS vars (`--type-headline-xl-*`) but require a custom selector to
take effect.

## Components -> markdown

[src/markdown.ts](src/markdown.ts) registers a `markdown-it-container`
handler for each of `button-primary`, `button-secondary`, `button-tertiary`,
`chip`, `card`, `badge`, `tooltip`, `input-field`, `list-item`. Authors opt
into the class on a per-block basis:

```markdown
::: button-primary
Submit
:::
```

The CSS class `.component-<name>` in [src/themes/base.css](src/themes/base.css)
reads `--component-<name>-*` vars for background, text color, rounded, padding,
and border. Unknown component keys still emit vars but don't get an auto-wired
markdown shortcut.

## Mermaid hookup

[src/mermaid-runtime.ts](src/mermaid-runtime.ts) `applyDesignToMermaid`
reads from `design.colors` (primary/secondary/surface/on-surface/outline/
surface-container*) and `design.typography['body-md'].fontFamily`. Only
`fontFamily` carries over to mermaid; more advanced typography properties
don't have mermaid equivalents.

## Worked example

```yaml
---
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
  md: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
---
```

Emitted CSS (abridged):

```css
:root {
  --color-primary: #3366ff;
  --color-neutral: #ffffff;
  --color-surface: #ffffff;
  --color-on-surface: #111111;
  --color-outline: #e2e8f0;
  --brand: #3366ff;
  --bg-page: #ffffff;
  --bg-surface: #ffffff;
  --text-primary: #111111;
  --border-soft: #e2e8f0;
  --code-bg: #ffffff;
  --type-h1-family: Inter, Georgia, "Times New Roman", serif;
  --type-h1-size: 32pt;
  --type-h1-weight: 700;
  --type-h1-line: 1.1;
  --type-body-md-family: Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  --type-body-md-size: 11pt;
  --type-body-md-weight: 400;
  --type-body-md-line: 1.6;
  --rounded-md: 8px;
  --radius-md: 8px;
  --component-button-primary-bg: #3366ff;
  --component-button-primary-fg: #ffffff;
  --component-button-primary-rounded: 8px;
}
```

## Common tasks

- **Add a new token slot**: follow
  [.cursor/instructions/add-or-update-design-token.md](.cursor/instructions/add-or-update-design-token.md).
- **Debug why a DESIGN.md token isn't showing up**: run `/design info` in the
  REPL to see the full parsed token set; if it's listed there, the issue is
  in the CSS binding in `src/template.ts` or `src/themes/base.css`.
- **Add a new component class**: extend `DESIGN_COMPONENT_KEYS` in
  [src/markdown.ts](src/markdown.ts) and add a `.component-<name>` block in
  [src/themes/base.css](src/themes/base.css).

## Gotchas

- The parser is **strict**. A DESIGN.md without YAML frontmatter throws
  `NO_YAML_FOUND`; it does NOT fall back to the old prose-heuristic behavior.
- Duplicate `## Colors` or `## Typography` headings are a hard error per spec.
- `{token.path}` references in non-component groups must resolve to a
  primitive. Composite refs like `{typography.body-md}` are only allowed
  inside `components.*`.
- The Dimension grammar accepts `pt` and `%` in addition to the spec's
  `px|em|rem` -- this is a documented PDF-specific extension. Stick to `px`
  for portability across other DESIGN.md consumers.

## File pointers

- [src/design.ts](src/design.ts) -- YAML parser, validation, ref resolver.
- [src/template.ts](src/template.ts) -- `buildDesignOverride`, CSS emitter.
- [src/mermaid-runtime.ts](src/mermaid-runtime.ts) `applyDesignToMermaid`.
- [src/markdown.ts](src/markdown.ts) -- `DESIGN_COMPONENT_KEYS` container
  handlers and task-list checkbox class injection.
- [src/themes/tokens.css](src/themes/tokens.css) -- Claude baseline defaults
  for every token group.
- [src/themes/base.css](src/themes/base.css) -- selectors consume the new vars.
- [src/designs/claude.md](src/designs/claude.md) -- the spec-compliant Claude
  baseline.
- [src/designs/README.md](src/designs/README.md) -- authoring guide.
- [docs/designs.md](docs/designs.md) -- user-facing docs.
- [scripts/verify-design-parse.js](scripts/verify-design-parse.js) -- parser
  regression guard.
- [scripts/verify-visual.js](scripts/verify-visual.js) -- end-to-end PDF
  rendering smoke test.
