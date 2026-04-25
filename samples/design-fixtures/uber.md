---
version: alpha
name: Uber
description: Utility-first and literally monochrome -- buttons are rectangles, chrome never competes with content.
colors:
  primary: "#000000"
  secondary: "#1a1a1a"
  tertiary: "#276ef1"
  neutral: "#ffffff"
  surface: "#ffffff"
  surface-container: "#f6f6f6"
  surface-container-high: "#e2e2e2"
  on-surface: "#000000"
  on-surface-variant: "#545454"
  outline: "#e2e2e2"
  outline-variant: "#8c8c8c"
  error: "#e11900"
  focus: "#276ef1"
  background: "#ffffff"
  on-background: "#000000"
typography:
  h1:
    fontFamily: UberMove
    fontSize: 38pt
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.02em
  h2:
    fontFamily: UberMove
    fontSize: 26pt
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.01em
  h3:
    fontFamily: UberMove
    fontSize: 18pt
    fontWeight: 700
    lineHeight: 1.25
  h4:
    fontFamily: UberMoveText
    fontSize: 14pt
    fontWeight: 600
    lineHeight: 1.3
  h5:
    fontFamily: UberMoveText
    fontSize: 12pt
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: UberMoveText
    fontSize: 10pt
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.05em
  body-md:
    fontFamily: UberMoveText
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.55
  body-lg:
    fontFamily: UberMoveText
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: UberMoveText
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: UberMoveText
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.04em
  code:
    fontFamily: UberMono
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 2px
  md: 4px
  lg: 6px
  xl: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 12px
    borderColor: "{colors.on-surface}"
  card:
    backgroundColor: "{colors.surface-container}"
    rounded: "{rounded.md}"
    padding: 16px
---

# Uber

## Overview

Utility-first and literally monochrome. Buttons are sharp-cornered rectangles with tight
letter-spacing. Motion is minimal. Chrome never competes with content.

## Colors

- **Primary (Pure Black):** All text and the primary CTA surface.
- **Neutral (Pure White):** The default canvas.
- **Surface-container (Light Panel):** Section backgrounds and cards.
- **On-surface-variant (Mid Gray):** Secondary copy.
- **Outline (Hairline Gray):** Default dividers.

## Typography

**UberMove** takes headlines with confident weight 700. **UberMoveText** takes body and
UI. **UberMono** handles code.

## Layout

Tight 8pt spacing scale, no extravagant gutters. Sections sit snugly on the grid.

## Elevation & Depth

Contained: depth comes from subtle gray panels on white, never shadows.

## Shapes

Near-sharp corners (2/4/6/8px) for a no-nonsense feel.

## Components

The primary button is literally black-on-white with a 2px corner. Secondary buttons flip
to outline-on-white. Cards are the only place where radius exceeds 4px.
