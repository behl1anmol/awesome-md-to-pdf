---
name: build-publish-knowledge
description: End-to-end knowledge of the build toolchain and release flow. Covers tsconfig, copy-assets.js, bin shims, dist layout, npm script graph, CI matrix (ubuntu Node 24 + windows Node 24), PUPPETEER_SKIP_DOWNLOAD hygiene, publish.yml tag-version parity, npm provenance via OIDC, Pages workflow (Jekyll from docs/), Dependabot, and the engines/files manifest. Use when editing build scripts, CI workflows, the release pipeline, or touching docs publishing.
triggers: tsc, build, copy-assets, dist, bin, package.json files, engines, CI, GitHub Actions, ci.yml, pages.yml, publish.yml, PUPPETEER_SKIP_DOWNLOAD, npm publish, provenance, OIDC, Dependabot, Jekyll, GitHub Pages, release tag, version bump, changelog, npm ci, typecheck, smoke test, @vercel/ncc, bundler
---

# Build & publish

## TypeScript build

- [tsconfig.json](tsconfig.json) targets CommonJS, strict mode. Source maps off (release artefacts, no stack traces needed since this is a CLI).
- `src/**/*.ts` compiles to `dist/*.js`. No bundler.
- Entry point for npm consumers is `dist/cli.js` (per `main` in [package.json](package.json)). `bin/awesome-md-to-pdf.js` and `bin/md-to-pdf.js` are CommonJS shims that simply `require('../dist/cli.js')`.

## `scripts/copy-assets.js`

TypeScript doesn't emit non-TS files. [scripts/copy-assets.js](scripts/copy-assets.js) runs after `tsc` and copies:

- `src/themes/*` -> `dist/themes/`
- `src/designs/*` -> `dist/designs/`

Recursive, overwrites existing files. Extend `COPY_DIRS` in that file if you add a new top-level runtime asset directory under `src/`.

## npm scripts

| script | effect |
|---|---|
| `build` | `tsc && node scripts/copy-assets.js` |
| `clean` | runs `scripts/clean.js` to remove `dist/` |
| `rebuild` | `clean` then `build` |
| `prestart` | `build` (so `npm start` is always fresh) |
| `start` | `node bin/md-to-pdf.js` |
| `typecheck` | `tsc --noEmit` — CI's primary gate |
| `demo:light` | `build` then convert `samples/` with light mode + cover + toc |
| `demo:dark` | same, dark mode |
| `prepublishOnly` | `build` — npm ensures dist/ is fresh before publish |

## Dist layout at publish

```text
dist/
  *.js                  (tsc output)
  *.d.ts                (type declarations)
  themes/
    tokens.css
    base.css
    fonts.css
    theme-light.css
    theme-dark.css
    highlight-light.css
    highlight-dark.css
    print.css
  designs/
    claude.md
    README.md
    ...
```

The npm `files` allowlist in [package.json](package.json) is `["bin", "dist", "README.md", "LICENSE"]`. Everything else (samples, docs, scripts, node_modules) is excluded. Do not add top-level files to the package without updating `files`.

## Bin shims

```js
// bin/awesome-md-to-pdf.js
#!/usr/bin/env node
'use strict';
require('../dist/cli.js');
```

Two shims pointing at the same `cli.js`:

- `awesome-md-to-pdf` — the primary command name, matches the package name.
- `md-to-pdf` — a shorter alias for convenience.

Both are listed in the `bin` map of [package.json](package.json). If you rename the package, rename the primary shim to match.

## CI (ci.yml)

[.github/workflows/ci.yml](.github/workflows/ci.yml) — triggers on push to `main`, PRs against `main`, and `workflow_dispatch`.

- Concurrency group: `ci-${{ github.ref }}` with `cancel-in-progress: true` — a new push cancels the old run.
- Workflow-level env: `PUPPETEER_SKIP_DOWNLOAD: "1"`.
- Matrix: ubuntu × 24 + windows × 24. `fail-fast: false` so every cell reports independently.
- Steps: checkout, setup-node (with `cache: npm`), `npm ci`, `npm run typecheck`, `npm run build`, `node bin/awesome-md-to-pdf.js --help`.

The `--help` smoke test exercises the dist + asset copy + bin shim in one go. A regression in any of the three fails CI here.

## Publish (publish.yml)

[.github/workflows/publish.yml](.github/workflows/publish.yml) — triggers on `release: [published]` and `workflow_dispatch`.

- `permissions: contents: read, id-token: write` — OIDC enables `npm publish --provenance` with no long-lived npm-side token beyond `NPM_TOKEN`.
- Version parity gate:
  ```bash
  RAW_TAG="${{ github.event.release.tag_name || inputs.tag }}"
  TAG_VERSION="${RAW_TAG#v}"
  PKG_VERSION="$(node -p \"require('./package.json').version\")"
  if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
    exit 1
  fi
  ```
  Publish cannot proceed unless `vX.Y.Z` in the release matches `"version": "X.Y.Z"` in package.json.
- Publishes with `npm publish --provenance --access public`.

Release flow end-to-end: see [.cursor/instructions/release-and-publish.md](.cursor/instructions/release-and-publish.md).

## Pages (pages.yml)

[.github/workflows/pages.yml](.github/workflows/pages.yml) — Jekyll build + deploy.

- Triggers on pushes to `main` that touch `docs/**` OR the workflow itself.
- `permissions: contents: read, pages: write, id-token: write`.
- Concurrency group `pages`, `cancel-in-progress: false` (deploys should complete).
- Two jobs: `build` (Ruby 3.3, `bundle exec jekyll build`) and `deploy` (environment `github-pages`).
- Baseurl is derived from `actions/configure-pages` so the site works under the repo's GitHub Pages path.

## Dependency policy

- [.github/dependabot.yml](.github/dependabot.yml) owns bumps. Do not manually upgrade versions in `package.json` / `package-lock.json`.
- `PUPPETEER_SKIP_DOWNLOAD=1` is set in every workflow so CI never downloads a Chromium.
- New runtime dependencies must be justified (size, provenance, maintenance).

## Engines & platform

- `"engines": { "node": ">=24" }` in [package.json](package.json). 24 is the minimum; CI tests 24 on ubuntu/windows.
- Windows + Linux are first-class. macOS is untested in CI but should work (Puppeteer fully supports it).

## Common tasks

- Add a new runtime asset dir: extend `COPY_DIRS` in [scripts/copy-assets.js](scripts/copy-assets.js).
- Add a CI matrix cell: edit the matrix in [.github/workflows/ci.yml](.github/workflows/ci.yml). Keep `fail-fast: false`.
- Add a new npm script: add to [package.json](package.json). If it's a release-relevant step, wire it into `prepublishOnly`.
- Bump Node minimum: update `engines`, update the CI matrix floor, update README requirements.

## Gotchas

- Forgetting to rerun `copy-assets.js` after `tsc` -> runtime `ENOENT` on `dist/themes/tokens.css`. The `build` script chains them; don't run `tsc` standalone in scripts.
- `npm publish` from outside CI bypasses provenance. Always tag and release via GitHub UI so `publish.yml` does the publish.
- `prepublishOnly` runs on `npm publish` (including `--provenance`). Removing it skips the build step if someone publishes locally — keep it.
- The `files` allowlist is exclusive. A new top-level file (e.g. `CHANGELOG.md`) won't ship unless listed. Docs are intentionally NOT shipped — they live on Pages, not npm.
- OIDC requires `id-token: write`. Removing that permissions flag silently breaks provenance without failing the job.

## File pointers

- [package.json](package.json) — scripts, dependencies, bin, files, engines.
- [tsconfig.json](tsconfig.json) — compiler config.
- [scripts/copy-assets.js](scripts/copy-assets.js) — asset copy.
- [scripts/clean.js](scripts/clean.js) — delete dist/.
- [bin/awesome-md-to-pdf.js](bin/awesome-md-to-pdf.js), [bin/md-to-pdf.js](bin/md-to-pdf.js) — shims.
- [.github/workflows/ci.yml](.github/workflows/ci.yml), [.github/workflows/publish.yml](.github/workflows/publish.yml), [.github/workflows/pages.yml](.github/workflows/pages.yml).
- [.github/dependabot.yml](.github/dependabot.yml).
- [docs/development.md](docs/development.md) — developer-facing docs.
