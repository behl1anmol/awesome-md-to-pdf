# Add a GitHub Actions workflow

- Owner: `devops`
- Review: `code-reviewer`
- Related rules: [80-security-and-deps.mdc](.cursor/rules/80-security-and-deps.mdc), [60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc)
- Related skills: `build-publish-knowledge`

## Conventions drawn from existing workflows

Inspect [.github/workflows/ci.yml](.github/workflows/ci.yml), [.github/workflows/pages.yml](.github/workflows/pages.yml), and [.github/workflows/publish.yml](.github/workflows/publish.yml) before writing a new one. The baseline patterns are:

- Always set `PUPPETEER_SKIP_DOWNLOAD: "1"` at the workflow or job `env` level. We never need a Chromium inside CI.
- Use `actions/checkout@v4` and `actions/setup-node@v4` with `cache: npm`.
- Concurrency: `group: <name>-${{ github.ref }}` with `cancel-in-progress: true` for idempotent workflows; `cancel-in-progress: false` for deploys (Pages).
- `permissions:` block scoped to the minimum. Publish + Pages need `id-token: write` for OIDC. Read-only workflows only need `contents: read`.
- Pin third-party actions to a major version tag (`@v4`) not `@latest`.

## Checklist

1. Create the file under `.github/workflows/<name>.yml`.
2. Pick triggers:
   - `push: branches: [main]` + `pull_request: branches: [main]` for CI.
   - `release: types: [published]` for release-driven pipelines.
   - `workflow_dispatch` for manual ops.
   - `schedule:` only with explicit approval — cron workflows accumulate minutes.
3. Declare `env: PUPPETEER_SKIP_DOWNLOAD: "1"` at the workflow level.
4. Set the minimum `permissions:` block. Default to `contents: read`.
5. Use a matrix only when it adds value. The CI matrix is `ubuntu × {node 18, 20, 22} + windows × node 20`. Do not add macOS unless there's a macOS-specific bug to guard.
6. Steps:
   - Checkout, setup-node (with cache), `npm ci`, then the actual work.
   - If the workflow runs user-supplied shell, `set -euo pipefail` in bash (see `publish.yml`).
7. Do NOT commit secrets into YAML. Reference `secrets.NAME` only. Add the secret in the GitHub UI.
8. Smoke-test on a branch with `workflow_dispatch`. Only merge after a green run.
9. Document the workflow in [docs/development.md](docs/development.md) if it has operational relevance (e.g. a release step).

## What NOT to do

- Do not run `npm publish`, `npm version`, or `git push` from CI unless the workflow is scoped to a release trigger.
- Do not introduce workflows that run on every push across all branches — concurrency groups protect against thundering herds but don't reduce minute spend.
- Do not cache `~/.cache/puppeteer` — we skip the Chromium download entirely.
