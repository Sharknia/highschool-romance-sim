---
name: vn-maker-notion-uiux-planner
description: Use when the user asks for a VN Maker Notion UI/UX planning document, product or feature planning from an idea, existing screen audit, maker workflow design, screen flow planning, or implementation-ready UX specification for this repository.
---

# VN Maker Notion UI/UX Planner

## Workflow

1. Read the local project rules first: `AGENTS.md`, then `docs/vn-maker-toolkit.md`, and `docs/architecture-decisions.md` only if DB, backend, packaging, or app-shell decisions are involved.
2. Use GitHub Project #4 before writing the document. Find a matching item or create a draft item; do not substitute an Issue unless the user explicitly asks for it.
3. Treat the user's idea as a planning request, not an implementation request. Do not edit app code unless the user separately asks for implementation.
4. Choose the operating mode:
   - Idea-to-plan: turn a new product or feature idea into a Notion planning document.
   - UI/UX audit-to-plan: inspect existing screens, gather desktop/mobile evidence, then create the planning document. Load `references/uiux-audit-workflow.md`.
5. If the idea is underspecified, make conservative product assumptions and record them in the Notion document. Ask the user only when a missing decision changes the product direction or architecture boundary.
6. Write a short execution plan before creating the Notion document. Review the plan against the user request and project rules before proceeding.
7. Gather evidence from the repo when the plan touches existing UI or flows. Prefer `rg`, targeted file reads, and browser screenshots when visual audit is part of the request.
8. Write the Notion document under the VN Maker planning context. Use the template in `references/notion-planning-template.md`.
9. Keep the document implementation-ready: include goals, non-goals, user journey, information architecture, screen states, data/API boundaries, generation behavior, acceptance criteria, validation plan, risks, and follow-up work.
10. Run the completion review gate before reporting: verify request coverage, evidence coverage, project rule compliance, mock-vs-real labels, implementation readiness, unresolved blockers, and follow-up items.
11. Update the Project item with the Notion URL, progress, blockers, and verification notes.
12. Report in Korean to `주인님` only after the completion review gate passes or a blocker is explicit. Include what the document actually says, not only links or file paths.

## Project Rules

- Use the product frame from this repository: VN Maker is a local desktop-style web app, not a single static GitHub Pages game.
- Preserve the architecture boundary: `engine-core` owns schema and validation, `use-cases` owns workflow orchestration, `generation-codex` owns Codex app-server and ChatGPT managed OAuth generation, `cli` owns JSON stdin/stdout automation, and `apps/web` owns human maker UI and Node API routes.
- Do not call an API key flow "Codex OAuth login".
- Treat image generation as Codex app-server ChatGPT OAuth with the `imageGeneration` path unless the user explicitly chooses a different future architecture.
- Separate UX planning evidence from implementation status. Label mock checks as mock checks and real CLI/API/browser execution as real execution.

## Notion Output

Load `references/notion-planning-template.md` before drafting the Notion document.

For small ideas, keep the Notion document compact but preserve the section order. For large ideas, split implementation work into GitHub Project items after the plan is approved or when the user asks.

## Completion Gate

Do not final-report just because a Notion page exists. Final-report only when one of these is true:

- Complete: the Notion plan covers the request, the evidence is recorded, Project item is updated, and the review gate has no blocking gaps.
- Partial: the Notion plan is useful but a named dependency is unavailable, such as Notion access, browser execution, GitHub Project permission, or real Codex app-server execution.
- Blocked: the same required external dependency prevents meaningful progress.

The final report must include:

- Notion document title and URL.
- Project item URL and status.
- A concise summary of the plan content: goals, target user, core flow, major screen changes, architecture/data boundary, generation behavior, acceptance criteria, and risks.
- Done, partial, not done, verification commands or observations, mock checks versus real execution, and commit/push status.
