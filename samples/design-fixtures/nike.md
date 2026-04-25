---
version: alpha
name: Nike
description: Athletic, high-contrast, editorial -- black-and-white backgrounds with oversized italic display type and a signal-orange accent.
colors:
  primary: "#fa5400"
  secondary: "#d64900"
  tertiary: "#fa5400"
  neutral: "#f5f5f5"
  surface: "#ffffff"
  surface-container: "#f5f5f5"
  surface-container-high: "#e8e8e8"
  on-surface: "#111111"
  on-surface-variant: "#555555"
  outline: "#d8d8d8"
  outline-variant: "#8c8c8c"
  error: "#d43f3a"
  focus: "#fa5400"
  background: "#f5f5f5"
  on-background: "#111111"
typography:
  h1:
    fontFamily: Nike Futura
    fontSize: 48pt
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: -0.03em
  h2:
    fontFamily: Nike Futura
    fontSize: 32pt
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.02em
  h3:
    fontFamily: Nike Futura
    fontSize: 22pt
    fontWeight: 700
    lineHeight: 1.15
  h4:
    fontFamily: Helvetica Neue
    fontSize: 14pt
    fontWeight: 700
    lineHeight: 1.25
  h5:
    fontFamily: Helvetica Neue
    fontSize: 12pt
    fontWeight: 700
    lineHeight: 1.3
  h6:
    fontFamily: Helvetica Neue
    fontSize: 10pt
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.1em
  body-md:
    fontFamily: Helvetica Neue
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.55
  body-lg:
    fontFamily: Helvetica Neue
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Helvetica Neue
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Helvetica Neue
    fontSize: 10pt
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.1em
  code:
    fontFamily: Menlo
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: 2px
  md: 4px
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
    padding: 14px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 14px
    borderColor: "{colors.on-surface}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 20px
---

# Nike

## Overview

Athletic, high-contrast, editorial. Black-and-white photography backgrounds paired with
oversized italic display type. CTAs are confident pills.

## Colors

- **Primary (Signal Orange):** CTAs and active states, never chrome.
- **Neutral (Off White):** The page canvas.
- **Surface (Pure White):** Card surfaces that pop off the warm off-white page.
- **On-surface (Jet Black):** Headlines and body.
- **Outline (Hairline Gray):** Subtle dividers.

## Typography

**Nike Futura** owns the display levels at weight 700 with tight letter-spacing.
**Helvetica Neue** carries body text. All labels are uppercase with wide tracking.

## Layout

A tight 8pt grid with generous 24-32pt section breaks.

## Elevation & Depth

White cards floating above an off-white canvas. No shadows, just the 1px hairline
variation between on-surface and outline.

## Shapes

Buttons are pills; cards keep a modest 4px radius.

## Components

Primary buttons always fill with Signal Orange, but only once per page. Secondary
buttons are ghost outlines. Cards are white rectangles.
