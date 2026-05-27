# Issue 106 Phase 0 Decision Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing Studio Phase 0 generation, repair, preview, and UX event evidence into a single Go/Iterate/Stop decision report that is available from core DTOs, use-cases, CLI, Web API, and the Web App.

**Architecture:** `engine-core` owns DTO names and decision vocabulary. `use-cases` owns the report calculator so CLI and Web API share the same evidence and threshold logic. The Web App renders the report and exports event evidence without creating a second client-side decision model.

**Tech Stack:** TypeScript, Vite + React, Hono API routes, SQLite project store, Node CLI, existing `node:test`-style `.mjs` regression tests.

---

### Task 1: Contract Tests

**Files:**
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`

- [ ] **Step 1: Add shell assertions**

Add assertions that require `Phase0DecisionReportDto`, `Phase0WorkPackageStatus`, `Phase0Decision`, `createPhase0DecisionReport`, `/api/phase0/decision-report`, `phase0-decision-report`, and visible Web labels for `Ready`, `Partial`, `Missing`, `Go`, `Iterate`, `Stop/Rethink`, `eventLogId`, `preflightResult`, and actual/mock preview separation.

- [ ] **Step 2: Add use-case evidence tests**

Seed UX decision events for fixed and free sessions, pass participant result rows to the report use-case, and assert:
- work-package status table has 9 rows
- fixed/free input metrics are separate
- validation denominator includes abandoned, 90s stall, static tutorial recovery, and hint sessions
- fake/mock preview caps the decision at `Iterate`
- `conditionRuntimeSupport.support_false` produces condition preview `not_evaluated` while actual preview evidence can still count when `preflightResult.canRun` is true
- guided repair success requires revision before/after, `issueCode`, `repairActionId`, `preflightResult`, and `eventLogId`

- [ ] **Step 3: Add API/CLI parity tests**

Call `/api/phase0/decision-report` and `packages/cli/dist/index.js phase0-decision-report` with the same fixture evidence, then assert the same `decision`, `eventLogId`, work-package rows, denominator, and mock/actual separation.

### Task 2: Shared DTOs And Calculator

**Files:**
- Modify: `packages/engine-core/src/index.ts`
- Modify: `packages/use-cases/src/index.ts`

- [ ] **Step 1: Add DTO contracts**

Define `Phase0WorkPackageStatus`, `Phase0Decision`, `Phase0TaskInputMode`, participant screening, session evidence, metric, and report DTOs in `engine-core`.

- [ ] **Step 2: Add report input parsing**

In `use-cases`, parse `sessionIds`, `eventLogIds`, `participantResults`, `workPackages`, and optional `generatedAt`. Treat missing participant rows as non-novice until explicitly screened.

- [ ] **Step 3: Compute evidence**

Combine exported UX event logs, generation result logs, current project revision, current preflight, condition runtime support, and participant rows. Preserve per-session `eventLogId`, `promptId`, `taskId`, input mode, elapsed time, help/hint/stall/abandon evidence, revision before/after, repair action, and preview evidence.

- [ ] **Step 4: Apply decision thresholds**

Implement the #106 thresholds:
- Go only if all Go criteria pass and no Missing/fake/mock replacement exists
- Missing or fake/mock replacement caps result at `Iterate`
- completion 50-69 or repeated term/repair stalls returns `Iterate`
- completion <50, repeated data-loss anxiety, preview/runtime mismatch, or condition model trust issue returns `Stop/Rethink`

### Task 3: CLI And Web API

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`

- [ ] **Step 1: Add use-case command**

Map `phase0-decision-report` to `createPhase0DecisionReport` and return the shared report envelope.

- [ ] **Step 2: Add API route**

Expose `POST /api/phase0/decision-report` using the same use-case and existing JSON error envelope handling.

### Task 4: Web App Surface

**Files:**
- Modify: `apps/web/src/client/pages/projects/projectPageTypes.ts`
- Modify: `apps/web/src/client/pages/projects/StudioWorkspace.tsx`
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `apps/web/src/client/styles.css` if layout support is needed

- [ ] **Step 1: Add client types**

Add Phase 0 report interfaces to `projectPageTypes.ts` and include `phase0DecisionReport` on `ProjectApiResult`.

- [ ] **Step 2: Add Studio report controls**

Add a compact Phase 0 protocol panel in Studio that can export the current event log and request `/api/phase0/decision-report` for the active browser session.

- [ ] **Step 3: Add Preview/Export evidence display**

Show actual preview evidence, condition preview `not_evaluated`, `preflightResult`, and `eventLogId` in the existing preview/export surfaces without duplicating decision logic.

### Task 5: Verification And Project Operations

**Files:**
- Modify: `docs/vn-maker-toolkit.md`
- Update GitHub issue/project comments

- [ ] **Step 1: Run verification**

Run `npm run build:maker`, focused tests, `npm run typecheck`, `npm run test:maker`, CLI/API happy path, Playwright desktop/mobile checks, `git diff --check`, and `git diff --cached --check`.

- [ ] **Step 2: Commit and push**

Commit in Korean, push `feature/issue-96-vn-maker-uiux`, update #106 with implementation and verification evidence, move the Project item to `DONE`, and close #106.
