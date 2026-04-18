# Add a theme CSS rule

Decide which file a new rule belongs in. The theme stack is loaded in a fixed order by `buildHtml` in [src/template.ts](src/template.ts):

```text
fonts.css -> tokens.css -> base.css -> theme-light.css -> theme-dark.css
           -> highlight-light.css -> highlight-dark.css -> print.css -> katex.min.css
           -> design override (:root + [data-mode="dark"]) -> accent override -> page chrome
```

Later files win on cascade ties. Pick the earliest file where the rule naturally belongs.

- Owner: `frontend-developer`
- Review: `code-reviewer`, `tester`
- Related rules: [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc), [40-pdf-pipeline-invariants.mdc](.cursor/rules/40-pdf-pipeline-invariants.mdc)
- Related skills: `template-css-knowledge`

## File-by-file scope

- [src/themes/fonts.css](src/themes/fonts.css) — `@font-face` declarations only. New web fonts go here.
- [src/themes/tokens.css](src/themes/tokens.css) — CSS custom properties under `:root` and `[data-mode="dark"]`. Semantic defaults (palette, type scale, spacing, radii, shadows). No selectors other than the two roots.
- [src/themes/base.css](src/themes/base.css) — semantic element/component rules: `html/body`, `.markdown-body`, headings, paragraphs, lists, tables, admonitions, cover, toc, page layout, `.code-wrap`. All colors reference `var(--...)` tokens.
- [src/themes/theme-light.css](src/themes/theme-light.css), [src/themes/theme-dark.css](src/themes/theme-dark.css) — mode-specific overrides beyond simple token swaps. Most mode behaviour is already expressed via the `[data-mode="dark"]` block in `tokens.css`; only use these when a rule genuinely differs structurally between modes.
- [src/themes/highlight-light.css](src/themes/highlight-light.css), [src/themes/highlight-dark.css](src/themes/highlight-dark.css) — code-block syntax highlighting palettes, warm-toned. Modify only to rebalance code colors.
- [src/themes/print.css](src/themes/print.css) — print-only rules: `@page`, page-break behaviour, widow/orphan control, header/footer bands. Every `page-break-*` rule belongs here.

## Checklist

1. Locate the layer above and place the rule there.
2. Use tokens from [src/themes/tokens.css](src/themes/tokens.css). Add a new token (see [add-or-update-design-token.md](.cursor/instructions/add-or-update-design-token.md)) if no existing token fits.
3. Keep specificity low. Stack uses author-stylesheet order; do not reach for `!important`.
4. If the rule touches page layout (margins, page size, break behaviour), it MUST go in `print.css` and you MUST re-verify the full-bleed contract via `scripts/verify-fullbleed.js` afterwards.
5. Rebuild + regenerate demos:
   ```bash
   npm run build
   npm run demo:light
   npm run demo:dark
   node scripts/pdf-page1-to-png.js samples/out/demo.pdf samples/out/demo.page1.png
   ```
6. Compare the page-1 PNG against the last known-good image. If intentional, replace the baseline in `samples/out*/`.

## Gotchas

- `tokens.css` MUST contain only the two root selectors. Adding an element selector here will fire before `base.css` is even loaded and will quietly override nothing.
- `print.css` runs inside `@media print { ... }` or at top level for `@page`. Rules at the top level without `@media print` still apply during Puppeteer's `page.pdf` because the headless render path treats print the same as screen. Prefer explicit `@media print` blocks for anything screen-specific.
- KaTeX CSS is appended AFTER your styles — if a math element refuses to take your override, you'll need a higher-specificity selector.
