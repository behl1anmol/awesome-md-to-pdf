# Scrum team roster

Seven persona files under [.cursor/agents/](.cursor/agents) describe a small, self-sufficient scrum team for awesome-md-to-pdf. Each persona is a markdown file a human or another agent can reference ("work on this as the backend-developer") or copy into a Task / subagent invocation.

| Agent | Role | Owns | Reads | Writes |
|---|---|---|---|---|
| [orchestrator](.cursor/agents/orchestrator.md) | Plan decomposition, parallel fan-out, serial gates | `.cursor/plans/*.plan.md` | everything | `.cursor/plans/` |
| [scrum-master](.cursor/agents/scrum-master.md) | Ceremonies, DoD, unblocking, scope-policing | [sprint-ceremonies.md](.cursor/instructions/sprint-ceremonies.md) | plans, retros | `.cursor/plans/retros/` |
| [code-reviewer](.cursor/agents/code-reviewer.md) | Readonly review against every rule | all rules | full repo (readonly) | PR comments only |
| [backend-developer](.cursor/agents/backend-developer.md) | Core pipeline code | `markdown-pipeline`, `design-system`, `pdf-pipeline` skills | `src/converter.ts`, `src/pdf.ts`, `src/markdown.ts`, `src/design.ts`, `src/logger.ts` | same |
| [frontend-developer](.cursor/agents/frontend-developer.md) | UI + CSS + chat experience | `template-css`, `cli-repl` skills | `src/themes/**`, `src/template.ts`, `src/mermaid-runtime.ts`, `src/banner.ts`, `src/repl.ts`, `src/progress.ts`, `src/prompt.ts`, `src/tty-colors.ts`, `docs/**` | same |
| [tester](.cursor/agents/tester.md) | Smoke tests, visual regressions, bug repros | `testing-verification` skill | `samples/**`, `scripts/verify-fullbleed.js`, `scripts/pdf-page1-to-png.js` | `samples/**` |
| [devops](.cursor/agents/devops.md) | CI/CD, npm release, Pages, Dependabot | `build-publish` skill | `.github/**`, `scripts/**`, `package.json` | same |

## RACI per SDLC phase

Legend: R = Responsible, A = Accountable, C = Consulted, I = Informed.

| Phase | orchestrator | scrum-master | backend-dev | frontend-dev | tester | code-reviewer | devops |
|---|---|---|---|---|---|---|---|
| Discover (triage, backlog) | A | R | C | C | R | I | I |
| Plan (sprint planning) | A, R | R | C | C | C | I | C |
| Implement (code) | A | I | R | R | I | I | I |
| Verify (tests, visual) | A | I | C | C | R | C | I |
| Review (PR) | A | I | I | I | C | R | I |
| Release (publish) | A | I | I | I | I | C | R |
| Retro | A | R | C | C | C | C | C |

## Who do I ping for...

- ...a new CLI flag? -> backend-developer + frontend-developer (docs) + tester (smoke).
- ...a new slash command? -> frontend-developer.
- ...a new markdown feature? -> backend-developer (plugin wiring) + frontend-developer (CSS).
- ...a new palette slot? -> frontend-developer + backend-developer (design parser).
- ...a PDF bug (blank diagram, missing font)? -> backend-developer (readiness dance) + tester (repro).
- ...a CI failure? -> devops.
- ...a release? -> devops + scrum-master (DoD gate).
- ...a visual regression? -> tester escalates to frontend-developer or backend-developer per classification.
- ...an architecture question? -> orchestrator decomposes; owning agent answers.

## Team operating principles

1. **Small, sharp tasks.** Each plan item has one owner and a verifiable outcome.
2. **Async-first.** Handoffs use the envelopes in [PROTOCOLS.md](.cursor/agents/PROTOCOLS.md). Don't wait on humans for routine decisions.
3. **One source of truth.** Rules live in [.cursor/rules/](.cursor/rules), workflows in [.cursor/instructions/](.cursor/instructions), knowledge in [.cursor/skills/](.cursor/skills). Don't duplicate between them.
4. **DoD is non-negotiable.** Typecheck, build, demo:light, demo:dark, docs, changelog. See [sprint-ceremonies.md](.cursor/instructions/sprint-ceremonies.md).
5. **Visual verification is first-class.** Every rendering change ships with page-1 PNGs in both modes.
