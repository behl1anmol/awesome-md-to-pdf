# Design parser fixtures

This folder holds a corpus of condensed `DESIGN.md` files used by
[scripts/verify-design-parse.js](../../scripts/verify-design-parse.js) to guard the
parser against regressions.

Each fixture is a spec-compliant `DESIGN.md` document per Google's
[DESIGN.md spec](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md): an opening `---` block of
YAML frontmatter that defines `colors`, `typography`, `rounded`, `spacing`, and
`components`, followed by the standard prose sections (Overview, Colors, Typography,
Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts).

The corpus:

- **apple.md** -- Ultra-minimal monochrome with soft gray surfaces and Apple Link Blue.
- **figma.md** -- Black-on-white chrome with pill-shaped controls and translucent outlines.
- **linear.md** -- Dark-mode-first, near-black canvas with a Linear Purple accent.
- **nike.md** -- High-contrast editorial with Signal Orange CTAs and oversized display type.
- **stripe.md** -- Technical trust with confident Camphor headlines and an indigo accent.
- **uber.md** -- Literally monochrome utility-first design with sharp-cornered rectangles.
- **vercel.md** -- Pure white canvas with tight Geist typography and a single blue accent.

Fixtures contain only text: no logos, artwork, or licensed assets. They are paraphrased
in generic English so the corpus can sit in source control without carrying any brand
identity beyond the CSS-literal hex values that every design system freely publishes.

## Adding a fixture

1. Add a new `<name>.md` with a YAML frontmatter block defining at minimum `name`,
   `colors.primary`, and `typography['body-md']`.
2. Follow the spec's section order in the prose body -- the parser errors on duplicate
   canonical sections.
3. Run `npm run verify:design` to make sure the new fixture parses and passes
   every assertion.
