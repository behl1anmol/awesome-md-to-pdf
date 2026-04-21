---
name: Fix Jekyll SCSS import
overview: Update the docs stylesheet entrypoint to the current Just the Docs include-based pattern so GitHub Actions can compile the site without missing `just-the-docs` Sass imports, then verify the Pages build locally/CI.
todos:
  - id: replace-scss-entrypoint
    content: Update docs/assets/css/just-the-docs-parchment.scss to include-based Just the Docs entrypoint with parchment color scheme.
    status: completed
  - id: validate-jekyll-build
    content: Run local Jekyll build in docs/ and confirm Sass compilation succeeds.
    status: completed
  - id: ci-followup
    content: Re-run GitHub Pages workflow and confirm build/deploy pass.
    status: completed
isProject: false
---

# Fix Pages Build SCSS Import

## Diagnosis
The failing job is the Jekyll build step in [.github/workflows/pages.yml](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/.github/workflows/pages.yml), where Jekyll compiles [docs/assets/css/just-the-docs-parchment.scss](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/assets/css/just-the-docs-parchment.scss).

That file currently uses:

```7:7:/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/assets/css/just-the-docs-parchment.scss
@import "just-the-docs";
```

With the current dependency set (`jekyll-sass-converter 3` + `sass-embedded` + `just-the-docs 0.12`), this import is no longer reliably resolved from remote/theme gem paths in CI, causing `Can't find stylesheet to import`.

## Proposed Fix
- Replace the SCSS `@import` entrypoint in [docs/assets/css/just-the-docs-parchment.scss](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/assets/css/just-the-docs-parchment.scss) with the Just the Docs include-based entrypoint:
  - keep front matter
  - use `{% include css/just-the-docs.scss.liquid color_scheme="parchment" %}`
- Keep [docs/_config.yml](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/docs/_config.yml) `color_scheme: parchment` unchanged unless a follow-up visual mismatch appears.
- Do not pin/downgrade gem versions as first-line fix; this keeps the site aligned with current Just the Docs behavior.

## Verification
- Run local docs build from `docs/` (`bundle exec jekyll build --source . --destination ../_site --baseurl "/awesome-md-to-pdf"`) to confirm no Sass import errors.
- Confirm output CSS asset is generated and site pages render.
- Re-run the GitHub Pages workflow to verify CI passes.

## Optional Hardening
- Add `--trace` to the Pages workflow build command in [.github/workflows/pages.yml](/mnt/stuff/WebstormProjects/awesome-md-to-pdf/.github/workflows/pages.yml) for faster root-cause visibility if Sass fails again.
- If you want stricter lockstep with the remote theme, we can also switch from `remote_theme` to gem theme usage, but that is a separate change and not required for this fix.