---
version: alpha
name: Stripe
description: Technical trust -- confident sans-serif headlines on cool white, saturated indigo accent used sparingly.
colors:
  primary: "#635bff"
  secondary: "#5851e5"
  tertiary: "#7a73ff"
  neutral: "#ffffff"
  surface: "#ffffff"
  surface-container-low: "#f6f9fc"
  surface-container: "#f6f9fc"
  surface-container-high: "#edf0f5"
  on-surface: "#0a2540"
  on-surface-variant: "#425466"
  outline: "#e3e8ee"
  outline-variant: "#8898aa"
  error: "#df1b41"
  focus: "#635bff"
  background: "#ffffff"
  on-background: "#0a2540"
typography:
  h1:
    fontFamily: Camphor
    fontSize: 34pt
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.01em
  h2:
    fontFamily: Camphor
    fontSize: 24pt
    fontWeight: 600
    lineHeight: 1.2
  h3:
    fontFamily: Camphor
    fontSize: 18pt
    fontWeight: 600
    lineHeight: 1.25
  h4:
    fontFamily: Camphor
    fontSize: 14pt
    fontWeight: 600
    lineHeight: 1.3
  h5:
    fontFamily: Camphor
    fontSize: 12pt
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: Camphor
    fontSize: 10pt
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.04em
  body-md:
    fontFamily: Sohne
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.6
  body-lg:
    fontFamily: Sohne
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Sohne
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Sohne
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.03em
  code:
    fontFamily: Source Code Pro
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: 4px
  md: 6px
  lg: 10px
  xl: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 28px
  2xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 10px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 24px
    borderColor: "{colors.outline}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 10px
    borderColor: "{colors.outline}"
---

# Stripe

## Overview

Technical trust rendered as a product page: soft gradients behind confident sans-serif
headlines, generous whitespace, and a saturated indigo accent used sparingly.

## Colors

- **Primary (Indigo):** CTAs, links, active states.
- **Neutral (Paper White):** Page canvas.
- **Surface-container (Cool White):** Elevated cards and section backgrounds.
- **On-surface (Ink):** Headlines and body at maximum emphasis.
- **On-surface-variant (Mid Gray):** Secondary copy.
- **Outline (Border Default):** Hairline dividers and card borders.
- **Error (Crimson):** Destructive and error messaging.

## Typography

**Camphor** delivers headlines with authoritative weight. **Sohne** carries body copy at
a relaxed 1.6 line-height. **Source Code Pro** is the monospace voice for code.

## Layout

Generous spacing scale (4/8/12/20/28/40px). Outer margins favor whitespace over
information density; cards use a 24px internal padding.

## Elevation & Depth

Soft ambient shadows separate cards from cool-white surfaces. Borders are secondary --
the shadow is the primary elevation cue.

## Shapes

Corners are medium (6px for buttons, 14px for cards). Pills use `rounded.full`.

## Components

Buttons anchor every CTA in indigo. Cards combine a hairline border with a 24px pad.
Input fields mirror the button shape.
