---
version: alpha
name: Figma
description: Monochrome interface chrome -- black text on white surfaces, every control a pill or circle, vibrant color reserved for product content.
colors:
  primary: "#000000"
  secondary: "#1a1a1a"
  tertiary: "#18a0fb"
  neutral: "#ffffff"
  surface: "#ffffff"
  surface-container: "#f5f5f5"
  surface-container-high: "#e5e5e5"
  on-surface: "#000000"
  on-surface-variant: "#333333"
  outline: "#0000001a"
  outline-variant: "#00000029"
  error: "#dc2626"
  focus: "#18a0fb"
  background: "#ffffff"
  on-background: "#000000"
typography:
  h1:
    fontFamily: figmaSans
    fontSize: 40pt
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  h2:
    fontFamily: figmaSans
    fontSize: 26pt
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.01em
  h3:
    fontFamily: figmaSans
    fontSize: 18pt
    fontWeight: 600
    lineHeight: 1.2
  h4:
    fontFamily: figmaSans
    fontSize: 14pt
    fontWeight: 600
    lineHeight: 1.3
  h5:
    fontFamily: figmaSans
    fontSize: 12pt
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: figmaSans
    fontSize: 10pt
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.05em
  body-md:
    fontFamily: figmaSans
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.55
  body-lg:
    fontFamily: figmaSans
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: figmaSans
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: figmaSans
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.04em
  code:
    fontFamily: figmaMono
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
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
    rounded: "{rounded.full}"
    padding: 10px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 10px
    borderColor: "{colors.outline-variant}"
  chip:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 4px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 16px
    borderColor: "{colors.outline-variant}"
---

# Figma

## Overview

Monochrome interface chrome: black text on white surfaces, with every control expressed
as a pill or circle. Vibrant color lives only inside product screenshots, never in the
chrome itself.

## Colors

- **Primary (Pure Black):** All text, solid buttons, and borders at full emphasis.
- **Neutral (Pure White):** The default canvas.
- **Surface-container (Light Panel):** Section backgrounds.
- **Outline (translucent black 10%):** Subtle dividers.
- **Tertiary (Figma Blue):** Reserved for tool UI; not used on the page chrome itself.

## Typography

**figmaSans** owns everything from headlines (weight 700, tight tracking) to body copy.
**figmaMono** is for code and inline labels.

## Layout

Compact 8pt spacing grid, tight internal card padding. Margins are generous outside to
let chrome breathe.

## Elevation & Depth

Flat: depth is implied through hairline borders and subtle grays on white; no shadows.

## Shapes

Pills dominate -- every button uses `rounded.full`. Cards use a modest `lg` radius
(8px).

## Components

Primary buttons are pure black pills. Secondary buttons are outlined white pills. Chips
carry a subtle gray fill.
