---
version: alpha
name: Linear
description: Dark-mode-first product design -- a near-black canvas where luminous content emerges from darkness like starlight.
colors:
  primary: "#5e6ad2"
  secondary: "#7a83d8"
  tertiary: "#5e6ad2"
  neutral: "#08090a"
  surface: "#0f1011"
  surface-container: "#1a1b1e"
  surface-container-low: "#0f1011"
  surface-container-high: "#1e2024"
  on-surface: "#f7f8f8"
  on-surface-variant: "#8a8f98"
  outline: "#1e2024"
  outline-variant: "#2a2c31"
  error: "#eb5757"
  focus: "#5e6ad2"
  background: "#08090a"
  on-background: "#f7f8f8"
typography:
  h1:
    fontFamily: Inter Variable
    fontSize: 36pt
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter Variable
    fontSize: 24pt
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter Variable
    fontSize: 18pt
    fontWeight: 600
    lineHeight: 1.25
  h4:
    fontFamily: Inter Variable
    fontSize: 14pt
    fontWeight: 600
    lineHeight: 1.3
  h5:
    fontFamily: Inter Variable
    fontSize: 12pt
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: Inter Variable
    fontSize: 10pt
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.04em
  body-md:
    fontFamily: Inter Variable
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.6
  body-lg:
    fontFamily: Inter Variable
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Inter Variable
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Inter Variable
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.04em
  code:
    fontFamily: Berkeley Mono
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
    rounded: "{rounded.md}"
    padding: 8px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
  button-secondary:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 8px
    borderColor: "{colors.outline-variant}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 16px
    borderColor: "{colors.outline}"
  chip:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: 4px
---

# Linear

## Overview

Linear's product is a masterclass in dark-mode-first design -- a near-black canvas where
content emerges from darkness like starlight. Every surface is only a few luminance
points off the background; the hierarchy is entirely tonal.

## Colors

- **Primary (Linear Purple):** The single signature brand accent for CTAs and
  interactive moments.
- **Neutral (Deep Space):** The primary page background -- a true near-black.
- **Surface:** Barely-elevated cards, one step above neutral.
- **Surface-container:** Subtle container backgrounds.
- **On-surface (Luminous White):** Soft, glowing body and heading text.
- **On-surface-variant (Muted Gray):** Metadata and captions.
- **Outline / Outline-variant:** Barely-visible and prominent dividers respectively.
- **Error:** A warm, readable red on the dark canvas.

## Typography

**Inter Variable** takes everything from display to body with weights 400-600.
**Berkeley Mono** handles code.

## Layout

Compact 8pt grid, moderate gutters. Cards feel dense; whitespace between sections keeps
the dark canvas breathing.

## Elevation & Depth

Depth is luminance-only: each layer (neutral -> surface -> surface-container-high)
brightens by a few points. Shadows are rarely used because the dark canvas absorbs them.

## Shapes

Compact corners (4-8px). Chips are pills; cards are `lg` (8px).

## Components

Primary button fills with Linear Purple; secondary button uses a subtle surface-
container step. Cards are dark rectangles with hairline outlines.
