# .cursor/ — agentic development bundle for awesome-md-to-pdf

This folder turns the repo into an agent-ready workspace. It contains project rules, reusable SDLC workflows, deep knowledge skills, and a seven-role scrum team of personas.

Nothing outside `.cursor/` is modified by this bundle. Source code, docs, CI, and scripts stay untouched.

## Layout

```text
.cursor/
  README.md          <- this file
  AGENTS.md          <- team summary + rules digest (auto-discovered by Cursor)
  rules/             <- .mdc project rules, scoped by glob
  instructions/      <- reusable SDLC workflow playbooks
  skills/            <- 7 dense knowledge packs (SKILL.md format)
  agents/            <- scrum team personas + ROSTER + PROTOCOLS
  plans/             <- orchestrator stores sprint plans + bug plans here
```

## How to use

### As a human

1. Read [AGENTS.md](.cursor/AGENTS.md) for a fast orientation.
2. For any non-trivial change, follow the matching playbook in [instructions/](.cursor/instructions). They're the same checklists the agents use.
3. When editing a source file, Cursor auto-applies the relevant `.mdc` rules in [rules/](.cursor/rules) to remind you of invariants.

### As an agent / with an agent

1. Start by reading [AGENTS.md](.cursor/AGENTS.md) and the relevant entries under [skills/](.cursor/skills).
2. For a multi-step task, adopt the `orchestrator` persona ([agents/orchestrator.md](.cursor/agents/orchestrator.md)) and create a plan under `.cursor/plans/<slug>.plan.md`.
3. Fan out to implementer personas (backend, frontend, tester, devops) using the envelopes in [agents/PROTOCOLS.md](.cursor/agents/PROTOCOLS.md).
4. Route through code-reviewer before merge. Route through devops for release.

## Rules (`.cursor/rules/`)

Cursor auto-applies these based on the `globs:` frontmatter.

| File | Scope | Enforces |
|---|---|---|
| [00-core-conventions.mdc](.cursor/rules/00-core-conventions.mdc) | always | runtime, logging discipline, comment hygiene |
| [10-typescript-style.mdc](.cursor/rules/10-typescript-style.mdc) | `src/**/*.ts` | types, async IO, HTML/CSS escaping |
| [20-logger-and-console.mdc](.cursor/rules/20-logger-and-console.mdc) | `src/**/*.ts` | `console.*` bans + sanctioned callsites |
| [30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc) | themes, design.ts, template.ts, mermaid-runtime.ts | token traversal, no hardcoded colors |
| [40-pdf-pipeline-invariants.mdc](.cursor/rules/40-pdf-pipeline-invariants.mdc) | pdf.ts, template.ts, mermaid-runtime.ts | full-bleed contract, readiness dance |
| [50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc) | cli.ts, repl.ts, banner.ts, progress.ts, prompt.ts, tty-colors.ts | flag + slash command coherence |
| [60-build-assets-and-docs.mdc](.cursor/rules/60-build-assets-and-docs.mdc) | scripts, themes, designs, docs, package.json | build, asset copy, docs surface |
| [70-commits-and-changelog.mdc](.cursor/rules/70-commits-and-changelog.mdc) | always | commit style, version parity |
| [80-security-and-deps.mdc](.cursor/rules/80-security-and-deps.mdc) | package.json, .github | secrets, OIDC, Puppeteer hygiene |

## Instructions (`.cursor/instructions/`)

Playbooks for common tasks. Each calls out owner, reviewer, and relevant rules/skills.

- [add-cli-flag.md](.cursor/instructions/add-cli-flag.md)
- [add-slash-command.md](.cursor/instructions/add-slash-command.md)
- [add-markdown-feature.md](.cursor/instructions/add-markdown-feature.md)
- [add-or-update-design-token.md](.cursor/instructions/add-or-update-design-token.md)
- [add-theme-css-rule.md](.cursor/instructions/add-theme-css-rule.md)
- [add-github-workflow.md](.cursor/instructions/add-github-workflow.md)
- [release-and-publish.md](.cursor/instructions/release-and-publish.md)
- [triage-bug.md](.cursor/instructions/triage-bug.md)
- [visual-verify-full-bleed.md](.cursor/instructions/visual-verify-full-bleed.md)
- [review-a-pr.md](.cursor/instructions/review-a-pr.md)
- [sprint-ceremonies.md](.cursor/instructions/sprint-ceremonies.md)

## Skills (`.cursor/skills/`)

Seven dense knowledge packs. Read the relevant one BEFORE editing the corresponding subsystem.

- [markdown-pipeline-knowledge](.cursor/skills/markdown-pipeline-knowledge/SKILL.md) — markdown-it, plugins, fence/image/link renderers, slugify, extractTitle.
- [design-system-knowledge](.cursor/skills/design-system-knowledge/SKILL.md) — DESIGN.md parsing, PaletteTokens, SYNONYMS, dark synthesis.
- [template-css-knowledge](.cursor/skills/template-css-knowledge/SKILL.md) — buildHtml, CSS layering, KaTeX rewrite, @page chrome.
- [pdf-pipeline-knowledge](.cursor/skills/pdf-pipeline-knowledge/SKILL.md) — Puppeteer, readiness dance, mermaid runtime.
- [cli-repl-knowledge](.cursor/skills/cli-repl-knowledge/SKILL.md) — Commander, Session, slash commands, raw-mode UI, banner.
- [build-publish-knowledge](.cursor/skills/build-publish-knowledge/SKILL.md) — tsc, copy-assets, CI matrix, release, Pages.
- [testing-verification-knowledge](.cursor/skills/testing-verification-knowledge/SKILL.md) — samples fixtures, demo scripts, verify-fullbleed.

## Agents (`.cursor/agents/`)

Markdown persona files. Seven roles + ROSTER + PROTOCOLS.

- [ROSTER.md](.cursor/agents/ROSTER.md) — team index + RACI.
- [PROTOCOLS.md](.cursor/agents/PROTOCOLS.md) — message shapes (standup, fan-out, handoff, review gate, agent-to-agent query, escalation).
- [orchestrator.md](.cursor/agents/orchestrator.md)
- [scrum-master.md](.cursor/agents/scrum-master.md)
- [code-reviewer.md](.cursor/agents/code-reviewer.md)
- [backend-developer.md](.cursor/agents/backend-developer.md)
- [frontend-developer.md](.cursor/agents/frontend-developer.md)
- [tester.md](.cursor/agents/tester.md)
- [devops.md](.cursor/agents/devops.md)

## Plans (`.cursor/plans/`)

Orchestrator's workspace. Sprint plans, bug repro plans, retros. Agents update their own todo `status` as they progress.

## FAQ

**Do I need to read everything to work on the repo?**
No. Start with [AGENTS.md](.cursor/AGENTS.md). Then pull the one or two skills relevant to the file you're editing. The rules auto-apply as you edit.

**Can I add a new rule / instruction / skill?**
Yes. Keep them precise and file-cited. Add rule files with proper `description` + `globs` frontmatter. Instructions should have an explicit owner + reviewer. Skills follow the Anthropic SKILL.md format with a `triggers` field.

**Are the agents automatically registered as Cursor subagents?**
No. They're markdown personas a human or another agent references. To spin one up as a Cursor subagent, copy the persona body into a Task-tool invocation.
