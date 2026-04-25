---
version: alpha
name: Apple
description: Luxurious and product-forward -- full-bleed imagery against pure white, near-black for text, microscopic use of color.
colors:
  primary: "#0066cc"
  secondary: "#0052a3"
  tertiary: "#0066cc"
  neutral: "#ffffff"
  surface: "#ffffff"
  surface-container: "#f5f5f7"
  surface-container-high: "#e8e8ed"
  on-surface: "#000000"
  on-surface-variant: "#1d1d1f"
  outline: "#d2d2d7"
  outline-variant: "#86868b"
  error: "#e30000"
  focus: "#0066cc"
  background: "#ffffff"
  on-background: "#000000"
typography:
  h1:
    fontFamily: SF Pro Display
    fontSize: 44pt
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.03em
  h2:
    fontFamily: SF Pro Display
    fontSize: 28pt
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  h3:
    fontFamily: SF Pro Display
    fontSize: 20pt
    fontWeight: 600
    lineHeight: 1.2
  h4:
    fontFamily: SF Pro Display
    fontSize: 15pt
    fontWeight: 600
    lineHeight: 1.25
  h5:
    fontFamily: SF Pro Display
    fontSize: 12pt
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: SF Pro Display
    fontSize: 10pt
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.03em
  body-md:
    fontFamily: SF Pro Text
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.5
  body-lg:
    fontFamily: SF Pro Text
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: SF Pro Text
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: SF Pro Text
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.3
  code:
    fontFamily: SF Mono
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface-container}"
    rounded: "{rounded.xl}"
    padding: 32px
---

# Apple

## Overview

Luxurious, product-forward, and almost silent. Full-bleed photography against pure white
surfaces, with microscopic amounts of near-black for text. Every pixel either whispers or
is completely silent.

## Colors

- **Primary (Link Blue):** The only non-monochrome element, used for links and CTAs.
- **Neutral (Pure White):** The page canvas.
- **Surface-container (Soft Gray):** Card surfaces and subtle elevated panels.
- **On-surface (Pure Black):** All copy.
- **Outline (Hairline):** The most subtle separator possible.

## Typography

**SF Pro Display** for headlines -- large, heavy, with tight tracking. **SF Pro Text**
for body at 1.5 line-height. **SF Mono** for code.

## Layout

Extreme generosity: section padding at 40-64pt, card pads at 32pt, and wide outer
margins. Whitespace is the primary design element.

## Elevation & Depth

Depth comes entirely from soft gray surface-containers on pure white; there are no drop
shadows.

## Shapes

Rounded is aggressive: pills for buttons (`rounded.full`), 20px cards. Corners are always
soft.

## Components

Every CTA is a pill. Cards are oversized with 32pt interior padding and a subtle gray
fill.
