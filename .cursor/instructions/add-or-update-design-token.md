# Add or update a design token

Reusable workflow for extending the palette/font token surface parsed from `DESIGN.md` and injected into the HTML.

- Owner: `frontend-developer`
- Review: `code-reviewer`
- Related rules: [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc)
- Related skills: `design-system-knowledge`, `template-css-knowledge`

## When to add a new token

Add a new slot only when:

- An existing token cannot be reasonably retargeted.
- More than one design in [src/designs/](src/designs) (or on getdesign.md) names the slot.
- The slot materially changes the look in both light and dark modes.

Otherwise, reuse an existing slot or synthesise from `brand` / `brandSoft`.

## Checklist (new slot)

1. Add the field to `PaletteTokens` (or `FontTokens`) in [src/design.ts](src/design.ts). Use lowerCamelCase (e.g. `accentCool`). Document its role in a one-line JSDoc comment.
2. Add a `SynonymRule` to `SYNONYMS` in `src/design.ts` with a set of `patterns` (regexes) matching natural-language role names in DESIGN.md files. Include `not` patterns only if needed to avoid collisions.
3. Extend `paletteToCss` in [src/template.ts](src/template.ts) with the TS-field -> CSS-var mapping. Convention: `--kebab-case`, matching the token name (e.g. `accentCool` -> `--accent-cool`).
4. Add the default value for the new CSS variable in [src/themes/tokens.css](src/themes/tokens.css) under `:root`.
5. Add the dark-mode override in `[data-mode="dark"]` inside the same file.
6. If the token affects diagrams, extend `applyDesignToMermaid` in [src/mermaid-runtime.ts](src/mermaid-runtime.ts) to map it to the corresponding mermaid themeVariable.
7. Use the variable in [src/themes/base.css](src/themes/base.css) (or `print.css`). Never hardcode the colour at the callsite.
8. Update [src/designs/claude.md](src/designs/claude.md) if the Claude baseline needs to name the new slot explicitly.
9. Add a test by running against a DESIGN.md that defines the new token. Verify extraction with `/design info` inside chat:
   ```bash
   node bin/awesome-md-to-pdf.js
   /design path/to/DESIGN.md
   /design info
   ```
10. Regenerate demo outputs:
    ```bash
    npm run demo:light
    npm run demo:dark
    ```
11. Update docs: [docs/designs.md](docs/designs.md) + [docs/themes-and-modes.md](docs/themes-and-modes.md).
12. Commit: `feat(design): add <tokenName> token`. Bump minor version.

## Checklist (update an existing slot)

- Only change extraction heuristics (the `SYNONYMS` table) when a real DESIGN.md in the wild is being mis-parsed. Add a regex that matches it; verify it doesn't regress other designs by re-running the demo against every file under [src/designs/](src/designs).
- Never silently change the default value of a CSS variable. It is a user-visible change; follow the changelog discipline in [70-commits-and-changelog.mdc](.cursor/rules/70-commits-and-changelog.mdc).
