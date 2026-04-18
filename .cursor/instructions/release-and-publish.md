# Release & publish

End-to-end workflow for shipping a new version of `awesome-md-to-pdf` to npm.

- Owner: `devops`
- Gated by: `scrum-master` (definition-of-done check)
- Review: `code-reviewer` must have approved all PRs included in the release
- Related rules: [70-commits-and-changelog.mdc](.cursor/rules/70-commits-and-changelog.mdc), [80-security-and-deps.mdc](.cursor/rules/80-security-and-deps.mdc)
- Related skills: `build-publish-knowledge`

## Pre-release checklist

1. `main` is green on CI across the full matrix.
2. [docs/changelog.md](docs/changelog.md) has a heading for the new version summarising user-visible changes since the last tag.
3. Every user-visible change has a doc update (options table, CLI reference, chat-mode, markdown-features, designs, themes-and-modes, architecture — as applicable).
4. `npm run demo:light` and `npm run demo:dark` pass locally. Page-1 PNGs inspected.
5. `README.md` reflects the new version's features (the options table and chat-mode highlights are the usual suspects).

## Version bump

1. Decide the SemVer delta:
   - PATCH: bug fix, internal refactor, docs-only.
   - MINOR: new flag, new slash command, new markdown feature, new design token.
   - MAJOR: breaking change to CLI surface, removed flag, renamed command, different output format default.
2. Edit `version` in [package.json](package.json).
3. Commit: `chore(release): vX.Y.Z`. Push to `main` via a PR if branch protection requires.

## Tag + release

1. After the version-bump commit lands on `main`, create an annotated tag:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
2. Open the GitHub UI and create a Release from the tag. Paste the changelog section into the release notes.
3. Publishing to the release triggers [.github/workflows/publish.yml](.github/workflows/publish.yml), which:
   - asserts `RAW_TAG` stripped of `v` equals `package.json` `version` (fails with a clear message otherwise);
   - runs `npm ci`, `npm run typecheck`, `npm run build`;
   - runs `npm publish --provenance --access public` using `NPM_TOKEN`.
4. Verify the new version appears on npm: `npm view awesome-md-to-pdf version`.
5. Verify provenance:
   ```bash
   npm view awesome-md-to-pdf@X.Y.Z dist.attestations
   ```

## Rollback

npm does not allow un-publishing after 72 hours. If you need to revert:

- Publish a new PATCH that restores the previous behaviour. Never try to yank.
- `npm deprecate awesome-md-to-pdf@X.Y.Z "Use X.Y.(Z+1); see changelog"` if the broken version is still installable.

## Failure modes

- Tag / package.json mismatch — delete the tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), fix `package.json`, commit, recreate tag, recreate release.
- `NPM_TOKEN` expired — regenerate an automation token scoped to the `awesome-md-to-pdf` package and update the repo secret.
- OIDC provenance failure — check that the workflow still has `permissions: id-token: write`.
