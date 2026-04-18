# Sprint ceremonies

The `scrum-master` agent's reusable workflows for running the team. Adapted for a small scrum team working inside a single repo with AI-agent collaborators.

- Owner: `scrum-master`
- Related agents: see [.cursor/agents/ROSTER.md](.cursor/agents/ROSTER.md)
- Related skills: none — these are process playbooks, not technical ones.

## Sprint shape

- Length: 1 week. Lightweight — this is a small project.
- Artifacts: plans under [.cursor/plans/](.cursor/plans) (one per sprint goal), retros under `.cursor/plans/retros/`, backlog as a bulleted list at the top of the active sprint plan.

## Planning (start of sprint)

1. Pull outstanding work from the backlog + release notes + bug triage outputs (see [triage-bug.md](.cursor/instructions/triage-bug.md)).
2. Classify each item by owner bucket using the table in [triage-bug.md](.cursor/instructions/triage-bug.md).
3. Write a sprint plan at `.cursor/plans/sprint-<date>.plan.md` with:
   - Goal (one sentence).
   - Committed items (with owner agent name).
   - Stretch items.
   - Definition-of-done per item.
4. Hand to `orchestrator` for decomposition + fan-out.

## Daily standup (when running the team)

The orchestrator collects a standup envelope from each implementer agent. Shape:

```json
{
  "agent": "backend-developer",
  "yesterday": ["..."],
  "today": ["..."],
  "blockers": ["..."]
}
```

Scrum-master reads the concatenated standups and:

1. Resolves blockers by pinging the right collaborator (backend <-> frontend, tester <-> implementer, devops <-> everyone on infra).
2. Updates the sprint plan's todo statuses.
3. Flags scope creep back to the user via the orchestrator.

## Review / definition-of-done

Per-item DoD for this repo:

- Code compiles: `npm run typecheck`.
- Build + assets copied: `npm run build`.
- Demos render: `npm run demo:light && npm run demo:dark`.
- Visual verification done when the change touches rendering (see [visual-verify-full-bleed.md](.cursor/instructions/visual-verify-full-bleed.md)).
- Docs updated per the surface table in [60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc).
- Changelog entry for user-visible changes.
- Code-reviewer approved via [review-a-pr.md](.cursor/instructions/review-a-pr.md) checklist.

## Retrospective (end of sprint)

Write `.cursor/plans/retros/retro-<date>.md` covering:

- What went well.
- What slowed us down (blockers, ambiguous requirements, flaky tools).
- Action items (additions to rules / instructions / skills to prevent the slow-down next sprint).

Action items that turn into recurring patterns become new entries in `.cursor/rules/` or `.cursor/instructions/`.

## Backlog grooming (any time)

- Keep the backlog list at the top of the current sprint plan (or a dedicated `backlog.md`). Remove stale items quarterly.
- Ideas coming from users (GitHub issues, discussions) land in the backlog first, not the current sprint.

## Scope policing

Every commit message must map to a sprint item. PRs that introduce work outside the sprint goal get returned to the author with a polite ask to split.
