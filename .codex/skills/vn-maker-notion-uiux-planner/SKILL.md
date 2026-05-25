---
name: vn-maker-notion-uiux-planner
description: Create or update Notion UI/UX planning documents for this VN Maker repository when the user describes a product idea, feature idea, UX improvement, screen flow, maker workflow, or asks Codex to turn an idea into a planning document. Use for project-scoped planning work that should respect AGENTS.md, GitHub Projects #4, the VN Maker Core + CLI + Web App + Codex OAuth + generation adapter architecture, and Notion as the planning source of truth.
---

# VN Maker Notion UI/UX Planner

## Workflow

1. Read the local project rules first: `AGENTS.md`, then `docs/vn-maker-toolkit.md`, and `docs/architecture-decisions.md` only if DB, backend, packaging, or app-shell decisions are involved.
2. Use GitHub Project #4 before writing the document. Find a matching item or create a draft item; do not substitute an Issue unless the user explicitly asks for it.
3. Treat the user's idea as a planning request, not an implementation request. Do not edit app code unless the user separately asks for implementation.
4. If the idea is underspecified, make conservative product assumptions and record them in the Notion document. Ask the user only when a missing decision changes the product direction or architecture boundary.
5. Gather evidence from the repo when the plan touches existing UI or flows. Prefer `rg`, targeted file reads, and browser screenshots when visual audit is part of the request.
6. Write the Notion document under the VN Maker planning context. Use the template in `references/notion-planning-template.md`.
7. Keep the document implementation-ready: include goals, non-goals, user journey, information architecture, screen states, data/API boundaries, generation behavior, acceptance criteria, validation plan, risks, and follow-up work.
8. Update the Project item with the Notion URL, progress, blockers, and verification notes.
9. Report in Korean to `주인님` with what was created, what is partial, what was not done, validation performed, and whether any commit/push happened.

## Project Rules

- Use the product frame from this repository: VN Maker is a local desktop-style web app, not a single static GitHub Pages game.
- Preserve the architecture boundary: `engine-core` owns schema and validation, `use-cases` owns workflow orchestration, `generation-codex` owns Codex app-server and ChatGPT managed OAuth generation, `cli` owns JSON stdin/stdout automation, and `apps/web` owns human maker UI and Node API routes.
- Do not call an API key flow "Codex OAuth login".
- Treat image generation as Codex app-server ChatGPT OAuth with the `imageGeneration` path unless the user explicitly chooses a different future architecture.
- Separate UX planning evidence from implementation status. Label mock checks as mock checks and real CLI/API/browser execution as real execution.

## Notion Output

Load `references/notion-planning-template.md` before drafting the Notion document.

For small ideas, keep the Notion document compact but preserve the section order. For large ideas, split implementation work into GitHub Project items after the plan is approved or when the user asks.
