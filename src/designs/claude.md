---
version: alpha
name: Claude
description: A warm, editorial, parchment-canvas design system inspired by Anthropic's Claude product surface.
colors:
  primary: "#c96442"
  secondary: "#d97757"
  tertiary: "#d97757"
  neutral: "#f5f4ed"
  surface: "#faf9f5"
  surface-container: "#f5f4ed"
  surface-container-low: "#faf9f5"
  surface-container-high: "#e8e6dc"
  on-surface: "#141413"
  on-surface-variant: "#5e5d59"
  outline: "#f0eee6"
  outline-variant: "#e8e6dc"
  error: "#b53333"
  focus: "#3898ec"
  background: "#f5f4ed"
  on-background: "#141413"
typography:
  h1:
    fontFamily: Anthropic Serif
    fontSize: 32pt
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: 0px
  h2:
    fontFamily: Anthropic Serif
    fontSize: 24pt
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0px
  h3:
    fontFamily: Anthropic Serif
    fontSize: 18pt
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0px
  h4:
    fontFamily: Anthropic Serif
    fontSize: 14pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
  h5:
    fontFamily: Anthropic Serif
    fontSize: 12pt
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
  h6:
    fontFamily: Anthropic Serif
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.5px
  body-md:
    fontFamily: Anthropic Sans
    fontSize: 11pt
    fontWeight: 400
    lineHeight: 1.6
  body-lg:
    fontFamily: Anthropic Sans
    fontSize: 13pt
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Anthropic Sans
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Anthropic Sans
    fontSize: 10pt
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.5px
  code:
    fontFamily: Anthropic Mono
    fontSize: 9.5pt
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: -0.2px
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 24px
  3xl: 32px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  base: 11px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
    borderColor: "{colors.outline-variant}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 16px
    borderColor: "{colors.outline-variant}"
  chip:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: 4px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 10px
    borderColor: "{colors.outline-variant}"
---

# Claude

## Overview

Claude's interface is a literary salon reimagined as a product page -- warm, unhurried, and
quietly intellectual. The entire experience is built on a parchment-toned canvas
(`#f5f4ed`) that deliberately evokes the feeling of high-quality paper rather than a
digital surface. Where most AI product pages lean into cold, futuristic aesthetics,
Claude's design radiates human warmth, as if the AI itself had good taste in interior
design.

## Colors

- **Primary (Terracotta):** The brand accent -- a burnt orange-brown used for primary CTAs
  and signature moments. Deliberately earthy and un-tech.
- **Secondary (Coral):** A lighter, warmer variant used for hover states and secondary
  emphasis.
- **Neutral (Parchment):** The default page canvas -- warm cream with a yellow-green
  tint.
- **Surface (Ivory):** The lightest surface, used for cards and elevated containers.
- **On-surface (Near Black):** The primary text color -- a warm, olive-tinted dark.
- **On-surface-variant (Olive Gray):** Secondary body text.
- **Outline (Border Cream):** Hairline dividers.
- **Outline-variant (Border Warm):** Prominent borders and section dividers.
- **Error (Error Crimson):** A deep, warm red for error states.

## Typography

All headlines use **Anthropic Serif** at weight 500 -- the serif gives every heading the
gravitas of a published title. **Anthropic Sans** handles body copy and UI with quiet
efficiency at 1.6 line-height. **Anthropic Mono** handles code and labels.

## Layout

The layout follows a single-column editorial flow with a 20mm typographic margin. An 8pt
spacing scale (`spacing.*`) maintains a consistent rhythm across lists, cards, and
admonitions.

## Elevation & Depth

Depth is achieved through tonal layers rather than heavy shadows: a parchment page sits
beneath ivory cards, and cards carry a near-invisible warm ring (`shadow-whisper`) for
definition without drop shadows.

## Shapes

Interactive elements use a medium corner radius (8px). Cards use the extra-large radius
(16px) to feel soft and approachable; pills and chips use `rounded.full`.

## Components

Buttons, cards, chips, and input fields all follow the same warm neutral + terracotta
language. The primary button flips from terracotta-on-ivory to coral-on-ivory on hover.

## Do's and Don'ts

- Do reserve the primary color for the single most important CTA per page.
- Do lean into warm neutrals; every gray should have a yellow-brown undertone.
- Don't introduce cool blue-grays outside of the focus ring.
- Don't exceed two font weights per page.
