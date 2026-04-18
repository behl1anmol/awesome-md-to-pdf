# Design System Inspired by Figma

## 1. Visual Theme & Atmosphere

Monochrome interface chrome -- black text on white surfaces, with every
control expressed as a pill or circle. Vibrant color lives only inside
product screenshots, never in the chrome.

## 2. Color Palette & Roles

### Primary
- **Pure Black** (`#000000`): All text, all solid buttons, all borders. The sole "color" of the interface.
- **Pure White** (`#ffffff`): All backgrounds, white buttons, text on dark surfaces. The other half of the binary.

### Surface & Background
- **Pure White** (`#ffffff`): Primary page background and card surfaces.
- **Glass Black** (`rgba(0, 0, 0, 0.08)`): Subtle dark overlay for secondary circular buttons and glass effects.
- **Glass White** (`rgba(255, 255, 255, 0.16)`): Frosted glass overlay for buttons on dark/colored surfaces.

## 3. Typography Rules

### Font Family
- **Primary**: `figmaSans`, with fallbacks: `figmaSans Fallback, SF Pro Display, system-ui, helvetica`
- **Monospace / Labels**: `figmaMono`, with fallbacks: `figmaMono Fallback, SF Mono, menlo`
