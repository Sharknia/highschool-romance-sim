# VN Maker planning alignment audit - 2026-05-26

## Scope

- Audit time: 2026-05-26T13:16:32Z
- Baseline: `origin/main` at `3c39ac3` (`Merge pull request #82 from Sharknia/feature/issue-65-uxui-review`)
- Audit branch: `chore/planning-alignment-audit`
- Project item: `[감사] VN Maker 기획서 정합 검사` (`PVTI_lAHOAylLDM4BYfrWzgt1SIg`)
- Open PRs checked but not treated as merged: #89, #90, #91, #92, #93, #94

This audit compares the current implementation against the Notion VN Maker planning set and local architecture/QA docs. Open PR evidence is called out only as pending coverage.

## Planning Sources

- VN Maker hub: `36845e8947528170b5fdfbfec23e27a2`
- Top-level VN Maker plan: `36845e89475281339cc9fa244313c234`
- Alpha plan: `36845e89475281d392faf4e0daa37a52`
- Alpha project detail: `36845e8947528161a8c6f6e55090b21d`
- Alpha heroine detail: `36845e89475281388cb6e50395e88fd6`
- Main-page Alpha UX requirements: `36845e894752810d8a63fc0ddcda3df7`
- UX/UI improvement plan, 2026-05-23: `36945e89475281b095e0d65af87caa4f`
- Beta plan: `36845e8947528110b80dd6a85e69be02`
- Local docs: `docs/vn-maker-toolkit.md`, `docs/architecture-decisions.md`, `docs/ux-quality-gate.md`, `docs/main-page-ux-improvement-plan.md`, `docs/qa/issue-24-background-route.md`, `docs/qa/issue-25-preview-export.md`, `docs/qa/issue-27-alpha-project-management.md`

## Alignment Matrix

| Area | Planning requirement | Current evidence | Status |
| --- | --- | --- | --- |
| Product frame | The product is a VN maker local desktop-style web app, not a static single-file game target. | Core packages, CLI package, web app, Node API routes, SQLite/file project store, and local export path are present. | Pass |
| Architecture boundaries | Core schema/validation, project store, use cases, CLI, web API, and generation adapter should have clear owners. | `packages/engine-core`, `packages/project-store`, `packages/use-cases`, `packages/cli`, `packages/generation-codex`, and `apps/web` are separated. | Pass |
| App IA | Authenticated app nav is `/projects`, `/heroines`, `/settings`; `/login` is a system route, not app nav. | `WorkspaceLayout` nav is limited to projects/heroines/settings. | Pass |
| Project routes | Project list first, project detail under `/projects/:projectId/:tab`, with overview/heroine/background/studio/preview/export flow. | `ProjectStartPage` and `ProjectDetailView` implement these routes and tabs. | Pass |
| Shared project UI | Lists, tabs, delete confirmation, status panels, asset panels, and diagnostics should be centralized. | `ContentList`, `TabList`, `DeleteConfirmDialog`, `ReadinessPanel`, `AssetStatePanel`, `DiagnosticDrawer`, and related tests are present. | Pass |
| Heroine library | Heroine library is original source; projects receive snapshots. Original edits/deletes do not silently mutate project snapshots. | Heroine routes and snapshot assignment flow are implemented and covered by alpha shell/use-case tests. | Pass |
| Background generation | Alpha allows one background per project; generation goes through the shared generation adapter and project asset/job results. | Background tab, generation job APIs, `generation-codex`, and shared use cases cover this path. | Pass |
| Web/CLI parity | Web app and CLI should share core and generation/use-case boundaries. | Web server handlers and CLI call `createVnMakerUseCases`; tests cover API and CLI happy paths. | Pass |
| API error handling | Empty, non-JSON, 4xx/5xx, network, and abort responses should be safe for the frontend. | `apps/web/src/client/api/client.ts` handles these response classes, and alpha shell tests assert the contract. | Pass |
| Preview/export target | Preview and export should use project/runtime/export DTOs and local app export semantics. | `previewProject` and `exportProject` expose readiness/export DTOs, runtime, smoke result, and local export output. | Pass |
| Frontend domain-state ownership | Frontend should display use-case/API state, not rederive preview/export readiness from project data. | This branch removes `createPreviewReadinessFallback` and `createExportPlanFallback`, adds preview/export DTOs to `withActionState` and `validateProject`, and updates UI/tests to consume DTOs. | Fixed in this branch |
| Main-page UX | Alpha happy path should not require raw JSON knowledge; raw IDs/DTO details belong in diagnostics. | Project detail uses user-facing labels and diagnostic drawers; UX quality tests guard raw/internal leakage. | Pass |
| Settings | Settings should expose Codex connection state and generation defaults. | Current `origin/main` has a placeholder settings page. PR #89 covers this, but it is not merged. | Pending open PR |
| Login gate | App routing should not let login mechanics dominate maker workflow. | Current `origin/main` still routes unauthenticated users through `AuthGate` and `/login`; PR #91 covers login gate cleanup, but it is not merged. | Pending open PR / risk |
| Fallback/dummy generation docs | Dummy fallback behavior and regression documentation should be explicit. | PRs #90, #92, #93, and #94 cover packaged mock assets, fallback orchestration/UX, and docs; none are merged into `main`. | Pending open PR |
| Beta scope | Beta expands Alpha and should not redefine the current Alpha acceptance surface. | Beta plan was reviewed as forward scope only; no current-main requirement was downgraded because of Beta. | Pass |

## Fixed In This Branch

- `packages/use-cases/src/index.ts`
  - Added `validateProject` to the action-state contract.
  - Centralized default `previewReadiness` and `exportPlan` population in `withActionState`.
  - Ensured `validateProject` returns the same preview/export DTO shape used by open/preview/export actions.
- `apps/web/src/client/pages/ProjectStartPage.tsx`
  - Stores `previewReadiness` and `exportPlan` from project API results and passes them into project detail.
- `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
  - Removed frontend preview/export readiness fallback calculation.
  - Preview run enablement now depends on `previewReadiness.canRun === true`.
  - Export run enablement now depends on `exportPlan.canExport === true`.
- `apps/web/src/client/pages/projects/projectDetailState.ts`
  - Removed preview/export domain readiness fallback functions from the frontend state helper.
- Tests updated:
  - `tests/vn-maker-use-cases.test.mjs`
  - `tests/vn-maker-alpha-shell.test.mjs`
  - `tests/vn-maker-uxui-foundation.test.mjs`
  - `tests/vn-maker-alpha-ui-state.test.mjs`

## Remaining Risks

- Settings and login-gate cleanup are represented by open PRs, not by current `origin/main`.
- The PR stack #89-#94 should be reviewed and merged/rebased in order before declaring those planning items complete on `main`.
- This audit found no reason to replace the current package/core/use-case/web architecture, but any DB/backend/package decision changes still need `docs/architecture-decisions.md` updates.

## Verification

Completed before writing this report:

- `npm run build:maker`
- `node tests/vn-maker-use-cases.test.mjs`
- `node tests/vn-maker-alpha-shell.test.mjs`
- `node tests/vn-maker-uxui-foundation.test.mjs`
- `node tests/vn-maker-alpha-ui-state.test.mjs`
- `npm run typecheck`
- `npm run test:maker`
- Browser smoke with `VN_MAKER_ALPHA_SANDBOX=1 VITE_PORT=6273 API_PORT=6274 npm run dev -w @vn-maker/web`
  - Desktop `1440x900`: `/projects` opened, a project was created through the UI, `/projects/:projectId/preview` rendered readiness/export DTO state, screenshot saved to `/tmp/vn-maker-planning-audit-detail-desktop.png`.
  - Mobile `390x844`: `/projects/:projectId/export` rendered the export plan panel without visible overlap, screenshot saved to `/tmp/vn-maker-planning-audit-export-mobile.png`.
  - The browser smoke used the alpha sandbox session for local auth. No image generation was executed in this audit.

Remaining before PR:

- `git diff --check`
- `git status --short --branch`
