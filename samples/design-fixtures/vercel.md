---
version: alpha
name: Vercel
description: An ultra-clean developer aesthetic -- pure white canvas, true black ink, single blue accent.
colors:
  primary: "#0070f3"
  secondary: "#0761d1"
  tertiary: "#0070f3"
  neutral: "#ffffff"
  surface: "#ffffff"
  surface-container: "#fafafa"
  surface-container-high: "#f4f4f5"
  on-surface: "#000000"
  on-surface-variant: "#666666"
  outline: "#eaeaea"
  outline-variant: "#d4d4d4"
  error: "#ee0000"
  focus: "#0070f3"
  background: "#ffffff"
  on-background: "#000000"
typography:
  h1:
    fontFamily: Geist
    fontSize: 36pt
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.02em
  h2:
    fontFamily: Geist
    fontSize: 24pt
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.015em
  h3:
    fontFamily: Geist
    fontSize: 18pt
    fontWeight: 600
    lineHeight: 1.25
  h4:
    fontFamily: Geist
    fontSize: 14pt
    fontWeight: 600
    lineHeight: 1.3
  h5:
    fontFamily: Geist
    fontSize: 12pt
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: Geist
    fontSize: 10pt
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.04em
  body-md:
    fontFamily: Geist
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.55
  body-lg:
    fontFamily: Geist
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Geist
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Geist
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.04em
  code:
    fontFamily: Geist Mono
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.5
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
    backgroundColor: "#ffffff"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 8px
    borderColor: "{colors.outline}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 16px
    borderColor: "{colors.outline}"
  chip:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 4px
---

# Vercel

## Overview

An ultra-clean developer aesthetic: pure white canvas, true black ink, and a single blue
accent for CTAs. Typography is geometric sans with tight tracking.

## Colors

- **Primary (Link Blue):** The single brand accent, reserved for CTAs, links, and focus rings.
- **Neutral (Pure White):** The default canvas.
- **On-surface (True Black):** Headlines, body copy, borders at full emphasis.
- **Outline (Default):** Subtle hairline dividers.
- **Error (Vercel Red):** Destructive actions and error messaging.

## Typography

**Geist** drives everything -- headlines with tight tracking and weight 700, body at 400.
**Geist Mono** handles code and inline labels.

## Layout

A 20mm typographic margin around a single column. Spacing follows a 4/8/12/16/24pt scale.

## Elevation & Depth

Depth is entirely implied through borders; shadows are barely perceptible. Cards use a
single 1px hairline on pure white.

## Shapes

Corners are small (4/6/8px). Pills use `rounded.full`.

## Components

Primary buttons are the only surface that uses `--color-primary`. Secondary buttons
inherit the monochrome palette (black text, white background, hairline border).
