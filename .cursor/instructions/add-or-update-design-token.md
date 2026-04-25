# Add or update a design token

Reusable workflow for extending the DESIGN.md token surface parsed by
[src/design.ts](src/design.ts) and emitted as CSS by
[src/template.ts](src/template.ts).

- Owner: `frontend-developer`
- Review: `code-reviewer`
- Related rules: [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc)
- Related skills: `design-system-knowledge`, `template-css-knowledge`

## When to add a new spec field

awesome-md-to-pdf follows the Google DESIGN.md spec one-for-one. Before adding
anything new, ask:

1. **Is the field in the spec?** If yes, it's already accepted by the parser;
   you only need to add CSS emission or a selector binding.
2. **Is it a known convention** (e.g. `primary-60` color, `headline-xl`
   typography level)? These already parse; you just need to extend
   `buildDesignOverride` or `base.css` to consume them.
3. **Is it an entirely new token group?** Very unlikely -- coordinate with the
   upstream spec before diverging.

## Checklist: add a new color alias

You want `colors.myRole` in a DESIGN.md to drive a particular CSS var.

1. Add the mapping to `ALIAS_MAP` in `buildDesignOverride`
   ([src/template.ts](src/template.ts)):
   ```ts
   ['myRole', '--my-role'],
   ```
2. Consume `var(--my-role, <fallback>)` in [src/themes/base.css](src/themes/base.css)
   or another style consumer. Always include a fallback.
3. Document the alias in the
   [design-system-knowledge skill](.cursor/skills/design-system-knowledge/SKILL.md)
   canonical color mapping table and in
   [docs/designs.md](docs/designs.md).
4. Re-run `npm run verify:design`.
5. Commit: `feat(design): alias colors.myRole -> --my-role`.

## Checklist: add a new typography level

You want a custom level (e.g. `caption-xs`) to style a specific markdown
element.

1. Add defaults in [src/themes/tokens.css](src/themes/tokens.css) under `:root`
   (`--type-caption-xs-family`, `-size`, `-weight`, `-line`, `-track`).
2. Add the selector in [src/themes/base.css](src/themes/base.css) that reads
   `var(--type-caption-xs-*)` with the tokens.css defaults as fallback.
3. The parser already emits `--type-<level>-*` for every typography entry -- no
   parser change needed.
4. Document the new level in
   [docs/designs.md](docs/designs.md)'s "Typography" table.
5. Re-run `npm run verify:design` and `npm run verify:visual` to confirm the
   new level renders.

## Checklist: add a new component key

You want `::: my-widget` containers to style a `components.my-widget` entry.

1. Add `'my-widget'` to `DESIGN_COMPONENT_KEYS` in
   [src/markdown.ts](src/markdown.ts). The `markdown-it-container` registration
   for the new key is wired automatically.
2. Add a `.component-my-widget` CSS block in [src/themes/base.css](src/themes/base.css)
   that reads `var(--component-my-widget-bg, ...)`, `-fg`, `-rounded`,
   `-padding`, `-border-color` with sensible fallbacks.
3. Optional: extend the `COMP_PROP_MAP` in `buildDesignOverride`
   ([src/template.ts](src/template.ts)) if you want a tidier alias for a
   domain-specific property (e.g. `iconColor` -> `--component-my-widget-icon`).
4. Add a DESIGN.md fixture in `samples/design-fixtures/` that exercises the
   new component so the verify script catches regressions.
5. Document the new component in
   [docs/designs.md](docs/designs.md) and
   [src/designs/README.md](src/designs/README.md).
6. Re-run `npm run verify:design` and `npm run verify:visual`.

## Checklist: update an existing CSS default

You want to change the Claude baseline's default value (e.g. `--rounded-md`
from `8px` to `10px`).

1. Update the value in [src/themes/tokens.css](src/themes/tokens.css).
2. This is a user-visible visual change. Add an entry to
   [docs/changelog.md](docs/changelog.md) under the next version.
3. Refresh visual baselines if they drift:
   ```bash
   npm run verify:visual -- --update-baselines
   ```
4. Commit with `chore(design): retune --rounded-md default` (not a breaking
   change because it's a fallback, not a spec contract).

## Verification steps (every change)

```bash
npm run typecheck        # TypeScript must pass
npm run verify:design    # parser invariants + negative paths
npm run verify:visual    # end-to-end PDF rendering
```

If either verify step fails, fix the root cause -- do not relax the
assertion.
