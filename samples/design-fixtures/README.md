# Design parser fixtures

This folder holds a corpus of condensed `DESIGN.md` files used by
[scripts/verify-design-parse.js](../../scripts/verify-design-parse.js) to
guard the parser against regressions.

Each fixture is a **minimal, representative slice** of a real-world
DESIGN.md pattern we observed when exploring the getdesign.md corpus
(Figma, Vercel, Apple, Uber, Nike, Stripe, etc.). The fixtures deliberately
exercise different formatting conventions:

- **figma.md** -- monochrome palette with multi-role declarations
  (`All text, all solid buttons, all borders`) and compound font labels
  (`Monospace / Labels`).
- **vercel.md** -- explicit `Pure White` / `True Black` names plus a
  single-font stack.
- **apple.md** -- `Pure Black` with percentage-opacity role hints.
- **uber.md** -- `Pure White` surfaces plus compound font labels
  (`Body / UI`).
- **nike.md** -- brand-qualified names mixed with standard functional
  vocabulary.
- **stripe.md** -- rich functional vocabulary (`Primary CTA`,
  `Card surface`) with a simple font pair.

Fixtures contain **only** text: no logos, artwork, or licensed assets.
They are paraphrased in generic English so the corpus can sit in source
control without carrying any brand identity beyond the CSS-literal hex
values that every design system freely publishes.
