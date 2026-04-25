# Visual regression sample

This document exercises the spec-driven typography, color, rounded, and spacing
surfaces so a DESIGN.md change shows up visually on page 1.

## Typography scale

### H3 subheading

Body copy that should pick up `--type-body-md-*` variables. The lead paragraph
directly under H1 uses `--type-body-lg-*` for contrast.

## Colors and components

- **Primary** accent on links and CTAs.
- **Secondary** hover state.
- **On-surface** is the text color.

| Column A | Column B | Column C |
|---|---|---|
| Row 1 | data | data |
| Row 2 | data | data |

```ts
const tokens = parseDesignMd('./DESIGN.md');
console.log(tokens.colors.primary);
```

::: tip
Admonitions inherit border-left from the brand accent, so any DESIGN.md that
overrides `colors.primary` will retint this block.
:::

::: button-primary
Primary button
:::
