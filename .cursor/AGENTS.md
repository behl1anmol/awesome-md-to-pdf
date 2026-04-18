# Agents entrypoint

**Fast orientation for any agent opening this repo.** Read this first. Then read one or two skills relevant to your task. Then get to work.

## What this project is

`awesome-md-to-pdf` is a Node.js CLI (TypeScript, CommonJS) that converts Markdown files into beautifully styled PDFs via Puppeteer (headless Chromium). It features:

- A Claude-inspired editorial design baseline.
- A `DESIGN.md`-driven theming system (parse natural-language palettes into CSS custom properties).
- Mermaid diagrams, KaTeX math, highlight.js code blocks.
- Full-bleed page rendering with optional CSS Paged Media running chrome.
- A one-shot CLI and an interactive chat REPL with slash commands.

Full architectural overview: [docs/architecture.md](docs/architecture.md).

## Your north star rules (read first)

All rules live under [.cursor/rules/](.cursor/rules) and auto-apply via glob. The load-bearing ones:

- **[00-core-conventions.mdc](.cursor/rules/00-core-conventions.mdc)** — Node >=18, 2-space indent, single quotes, no emoji, no narrating comments, no raw `console.log` outside [src/logger.ts](src/logger.ts).
- **[40-pdf-pipeline-invariants.mdc](.cursor/rules/40-pdf-pipeline-invariants.mdc)** — do not change `page.pdf` options; navigation must stay on `file://`; await `window.__mermaidDone` + `document.fonts.ready` + double rAF before rendering.
- **[30-design-tokens-and-css.mdc](.cursor/rules/30-design-tokens-and-css.mdc)** — every color/font/spacing comes from a CSS custom property declared in [src/themes/tokens.css](src/themes/tokens.css). Never hardcode.
- **[50-cli-and-repl.mdc](.cursor/rules/50-cli-and-repl.mdc)** — CLI flags traverse `RawCliOptions -> ConvertOptions -> Session`. Slash commands update `COMMAND_META` in [src/repl.ts](src/repl.ts) AND docs/chat-mode.md.

The full list with scopes lives in [.cursor/README.md](.cursor/README.md).

## Workflow picker

If the user asks for... | Start here
--- | ---
A new CLI flag | [.cursor/instructions/add-cli-flag.md](.cursor/instructions/add-cli-flag.md)
A new slash command | [.cursor/instructions/add-slash-command.md](.cursor/instructions/add-slash-command.md)
A new markdown feature | [.cursor/instructions/add-markdown-feature.md](.cursor/instructions/add-markdown-feature.md)
A new palette slot | [.cursor/instructions/add-or-update-design-token.md](.cursor/instructions/add-or-update-design-token.md)
A CSS theme rule | [.cursor/instructions/add-theme-css-rule.md](.cursor/instructions/add-theme-css-rule.md)
A GitHub Actions workflow | [.cursor/instructions/add-github-workflow.md](.cursor/instructions/add-github-workflow.md)
A release | [.cursor/instructions/release-and-publish.md](.cursor/instructions/release-and-publish.md)
A bug report | [.cursor/instructions/triage-bug.md](.cursor/instructions/triage-bug.md)
A visual verify | [.cursor/instructions/visual-verify-full-bleed.md](.cursor/instructions/visual-verify-full-bleed.md)
A PR review | [.cursor/instructions/review-a-pr.md](.cursor/instructions/review-a-pr.md)
A sprint ceremony | [.cursor/instructions/sprint-ceremonies.md](.cursor/instructions/sprint-ceremonies.md)

## Skill picker

If you're editing... | Read
--- | ---
[src/markdown.ts](src/markdown.ts) | [markdown-pipeline-knowledge](.cursor/skills/markdown-pipeline-knowledge/SKILL.md)
[src/design.ts](src/design.ts), [src/designs/**](src/designs) | [design-system-knowledge](.cursor/skills/design-system-knowledge/SKILL.md)
[src/template.ts](src/template.ts), [src/themes/**](src/themes) | [template-css-knowledge](.cursor/skills/template-css-knowledge/SKILL.md)
[src/pdf.ts](src/pdf.ts), [src/mermaid-runtime.ts](src/mermaid-runtime.ts) | [pdf-pipeline-knowledge](.cursor/skills/pdf-pipeline-knowledge/SKILL.md)
[src/cli.ts](src/cli.ts), [src/repl.ts](src/repl.ts), [src/progress.ts](src/progress.ts), [src/banner.ts](src/banner.ts), [src/prompt.ts](src/prompt.ts) | [cli-repl-knowledge](.cursor/skills/cli-repl-knowledge/SKILL.md)
[.github/workflows/**](.github/workflows), [scripts/**](scripts), [package.json](package.json) | [build-publish-knowledge](.cursor/skills/build-publish-knowledge/SKILL.md)
[samples/**](samples) or anything rendering-adjacent | [testing-verification-knowledge](.cursor/skills/testing-verification-knowledge/SKILL.md)

## Team

The scrum team lives under [.cursor/agents/](.cursor/agents):

| Role | File |
|---|---|
| orchestrator | [agents/orchestrator.md](.cursor/agents/orchestrator.md) |
| scrum-master | [agents/scrum-master.md](.cursor/agents/scrum-master.md) |
| code-reviewer | [agents/code-reviewer.md](.cursor/agents/code-reviewer.md) |
| backend-developer | [agents/backend-developer.md](.cursor/agents/backend-developer.md) |
| frontend-developer | [agents/frontend-developer.md](.cursor/agents/frontend-developer.md) |
| tester | [agents/tester.md](.cursor/agents/tester.md) |
| devops | [agents/devops.md](.cursor/agents/devops.md) |

RACI matrix, communication topology, and who-do-I-ping-for-X: [agents/ROSTER.md](.cursor/agents/ROSTER.md). Message envelopes for delegation: [agents/PROTOCOLS.md](.cursor/agents/PROTOCOLS.md).

## Definition of done

For any user-visible change:

1. `npm run typecheck` green.
2. `npm run build` green.
3. `npm run demo:light` + `npm run demo:dark` green.
4. Visual PNGs attached (light + dark) if rendering touched.
5. Docs updated per rule 60.
6. Changelog entry added.
7. Code-reviewer approval via [review-a-pr.md](.cursor/instructions/review-a-pr.md) checklist.

## Anti-patterns we block on

- Hardcoded colors in components.
- Raw `console.*` calls outside sanctioned callsites.
- `page.setContent(html)` instead of temp-file `file://` navigation.
- Touching `page.pdf` options without re-running `verify-fullbleed.js`.
- CLI flag that works in one-shot but not in chat mode (or vice versa).
- Committing `dist/`, `pdf/`, or `samples/out*/`.
- Emoji in code or commit messages.
