/*
 * tty-colors.ts -- terminal-safe color palette.
 *
 * Body text is INTENTIONALLY uncolored (tc.body) so it always reads on both
 * light and dark terminals -- the terminal's own configured foreground is
 * the single most reliable visible color on any theme. Color is reserved
 * for semantic accents (brand, error, success, link, meta).
 *
 * Rule: terminal text NEVER uses the PDF-canvas colors
 *   #141413 (Near Black) / #30302e (Dark Surface) / #3d3d3a (Dark Warm) /
 *   #4d4c48 (Charcoal Warm)
 * which render as near-invisible on common dark terminal themes. Those
 * colors belong to the PDF canvas only -- see src/themes/*.css and
 * src/template.ts for the PDF palette.
 */

import chalk from 'chalk';

/** Terminal-safe color palette. Import as `import { tc } from './tty-colors';`. */
export const tc = {
  /** Primary body text -- uncolored so the terminal's default foreground wins. */
  body: (s: string) => s,
  /** Emphasis via weight, not hue -- still honors the terminal's own foreground. */
  bodyBold: (s: string) => chalk.bold(s),
  /** Metadata, descriptions, labels: warm stone gray, neutral on both themes. */
  meta: (s: string) => chalk.hex('#87867f')(s),
  /** Very-secondary metadata: dimmed stone gray. */
  muted: (s: string) => chalk.hex('#87867f').dim(s),
  /** Brand accent: terracotta. */
  brand: (s: string) => chalk.hex('#c96442')(s),
  /** Brand accent + bold. */
  brandBold: (s: string) => chalk.hex('#c96442').bold(s),
  /** Error: warm crimson. */
  error: (s: string) => chalk.hex('#b53333')(s),
  /** Error + bold. */
  errorBold: (s: string) => chalk.hex('#b53333').bold(s),
  /** Success: muted olive green. */
  success: (s: string) => chalk.hex('#6b7a5a')(s),
  /** Link / URL: muted blue, the only cool tone (matches the design focus color). */
  link: (s: string) => chalk.hex('#5a7a8a')(s),
};
