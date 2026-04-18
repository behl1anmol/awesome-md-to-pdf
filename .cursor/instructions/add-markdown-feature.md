# Add a markdown feature

Reusable workflow for introducing a new markdown capability (new plugin, new container type, new renderer rule).

- Owner: `backend-developer`
- Review: `code-reviewer`
- Docs + visual QA: `frontend-developer`, `tester`
- Related rules: [10-typescript-style.mdc](.cursor/rules/10-typescript-style.mdc), [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc)
- Related skills: `markdown-pipeline-knowledge`, `template-css-knowledge`

## Checklist

1. Pick a `markdown-it`-compatible plugin OR design a custom rule. If a plugin exists and is widely used (e.g. in the `markdown-it-*` family), prefer it.
2. Install: `npm install --save <package>`. Add to `dependencies` in [package.json](package.json). If types are not bundled, install `@types/<package>` as a devDependency. If none exist, add a shim to [src/types/shims.d.ts](src/types/shims.d.ts).
3. Wire it up in [src/markdown.ts](src/markdown.ts) inside `createMarkdown`. Ordering matters:
   - Anchor + TOC must run before any plugin that cares about heading IDs.
   - Admonition containers come before custom fence rules.
   - `katex` runs last so math tokens aren't consumed by earlier plugins.
4. If the plugin adds a new HTML element/class, style it in [src/themes/base.css](src/themes/base.css). Use CSS custom properties — never hardcode colors. See [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc).
5. If the feature has print-specific concerns (page-break behaviour, orphan/widow control), extend [src/themes/print.css](src/themes/print.css).
6. Add a fixture to [samples/](samples) — a small `.md` file exercising the new feature. Keep fixtures small so `npm run demo:*` stays fast.
7. Run:
   ```bash
   npm run typecheck
   npm run build
   npm run demo:light
   npm run demo:dark
   ```
8. Generate page-1 PNGs for visual inspection:
   ```bash
   node scripts/pdf-page1-to-png.js samples/out/<fixture>.pdf samples/out/<fixture>.page1.png
   ```
   Check both modes. Dark mode often exposes unthemed fallback colors.
9. Update docs:
   - [docs/markdown-features.md](docs/markdown-features.md) — add the feature to the list.
   - README's "Markdown features supported" list.
10. Commit: `feat(markdown): support <feature-name>`. Bump minor version, changelog entry.

## Common pitfalls

- Plugin ordering conflicts — if tokens come out malformed, check `md.use(...)` order against the source plugins' README.
- Adding a renderer override without delegating to the default. Always capture the old renderer and fall back to it (see `overrideImageRenderer` and `overrideLinkRenderer` in [src/markdown.ts](src/markdown.ts) for the pattern).
- Forgetting to HTML-escape user-controlled strings in custom renderers. Use `md.utils.escapeHtml` or the local `escapeHtml` helper.
- Breaking the mermaid fence passthrough. The custom fence renderer in `buildFenceRenderer` sees `lang === 'mermaid'` BEFORE other fence handling; preserve that branch.
