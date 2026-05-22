# SA-124 Heroine Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Alpha heroine management into dedicated routes, shared use cases, Web API, CLI commands, and responsive UI that satisfy SA-124 and SA-125 through SA-132.

**Architecture:** Treat the Linear document `VN Maker Alpha 히로인 관리 페이지 상세 기획서` as the approved product contract. `@vn-maker/use-cases` owns heroine action contracts and error envelopes, `@vn-maker/project-store` owns library storage/revisions/assets, Web routes and CLI are thin adapters, and `apps/web` owns route orchestration and display state only.

**Tech Stack:** TypeScript, Vite, React, React Router, Hono, better-sqlite3, Node CLI, existing `engine-core`, `project-store`, `use-cases`, `generation-codex`, and `alpha-sandbox` packages.

---

## SA-125 Audit Summary

### Current Coupling

`apps/web/src/client/pages/HeroineStartPage.tsx` currently handles listing, draft editing, save, delete, Codex session status, portrait generation, and selected heroine routing in one component. It routes both `/heroines` and `/heroines/:heroineId` to the same editable page, so the detail page is not read-only and `/heroines/new` plus `/heroines/:heroineId/edit` do not exist yet.

`apps/web/src/client/pages/WorkspacePage.tsx` still exposes the Beta-style Heroine Library rail with search, tag filter, user-controlled sort, clone, direct edit, portrait generation, delete, and project creation. This conflicts with SA-124 because Alpha heroine management should live under the heroine routes and should not expose search UI, tag filters, sort controls, clone, default emotion assets, or extra expression tag asset flows in the default heroine page.

`packages/use-cases/src/index.ts` currently exposes `listHeroines`, `saveHeroine`, `cloneHeroine`, and `deleteHeroine`. `saveHeroine` upserts, so create/update contracts are not separated and ID conflicts are not represented. `deleteHeroine` does not check target existence, confirmation values, or expected revisions. Failure mapping is still generic `InputValidationError`/HTTP adapter behavior rather than the required `{ ok: false, code, message, requestId?, issues?, retryable }` heroine envelope.

`packages/project-store/src/index.ts` stores heroine rows but returns profiles without `updatedAt` or revision refs. It orders by insertion position, not `updatedAt desc`, and `saveHeroine` always upserts. `deleteHeroine` blindly deletes by ID. The project snapshot fields already include `sourceHeroineId`, `sourceHeroineName`, and `sourceSnapshotCreatedAt`, but not `sourceHeroineRevision`.

`apps/web/src/server/handlers.ts` is already mostly an adapter, but it only registers `/api/heroines/list`, `/api/heroines/save`, `/api/heroines/clone`, and `/api/heroines/delete`. It needs `/api/heroines/get`, `/api/heroines/create`, `/api/heroines/update`, and `/api/heroines/portrait/generate`, plus heroine-specific failure status mapping.

`packages/cli/src/index.ts` mirrors the old use case commands: `list-heroines`, `save-heroine`, `clone-heroine`, and `delete-heroine`. It needs `get-heroine`, `create-heroine`, `update-heroine`, and `generate-heroine-portrait` while keeping compatible wrappers where useful.

### Target Ownership

`project-store` owns canonical library rows, asset writes/imports, `updatedAt`, heroine revision refs, library revision refs, existence checks, create conflict detection, update/delete revision comparison, and staged portrait records.

`use-cases` owns request parsing, required field validation, reserved/URL-safe ID rules, create/update/delete/get/list/generate portrait DTOs, failure envelopes, and project snapshot policy. It also owns the bridge from `generation-codex` image generation into stored heroine assets.

Web API routes own HTTP status mapping and JSON transport only. CLI commands call the same use cases and print the same DTO shapes.

React pages own route state, loading/error/notFound/ready/saving/deleting/conflict display, dirty draft handling, sticky actions, delete dialog state, responsive layout, and navigation.

### Subissue Mapping

SA-125 is satisfied by this audit and the Linear comment that summarizes it.

SA-126 covers `project-store`, `use-cases`, `apps/web/src/server/handlers.ts`, `packages/cli/src/index.ts`, and use-case/API/CLI tests.

SA-127 covers `/heroines` list route, count, fixed sort, detail navigation, and isolated delete entry.

SA-128 covers `/heroines/:heroineId` read-only detail, notFound, snapshot policy, and create-project-from-heroine entry.

SA-129 covers `/heroines/new`, `/heroines/:heroineId/edit`, `HeroineFormPanel`, ID rules, dirty leave, sticky action bar, and draft preservation.

SA-130 covers `HeroineDeleteDialog`, confirmation values, delete failure/conflict behavior, and snapshot preservation verification.

SA-131 covers `HeroinePortraitPanel`, `generateHeroinePortrait`, staged portrait creation, import/designated portrait handling, and create-time staged attachment.

SA-132 covers typecheck, maker tests, CLI/API happy path, browser viewport checks, and Linear verification notes.

---

## Task 1: SA-125 Audit Record

**Files:**
- Create: `docs/superpowers/plans/2026-05-22-sa-124-heroine-management.md`
- Linear: `SA-125` comment and status

- [x] **Step 1: Confirm current state**

Run:

```bash
npm run typecheck
npm run test:maker
```

Expected: both pass on the updated `main` baseline.

- [x] **Step 2: Record coupling and target boundaries**

Record the current coupling and target ownership sections above.

- [ ] **Step 3: Post SA-125 comment and mark complete**

Use Linear to summarize the audit, risks, target routes, and follow-up mapping.

Expected: `SA-125` has a comment proving its completion criteria and moves to `Done`.

- [ ] **Step 4: Commit and push SA-125**

Run:

```bash
git diff --check
git status --short
git add docs/superpowers/plans/2026-05-22-sa-124-heroine-management.md
git commit -m "docs: audit SA-124 heroine management split"
git push -u origin feature/sa-124-heroine-management
```

Expected: the audit commit is pushed.

## Task 2: SA-126 Contract Tests

**Files:**
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Add failing use-case tests for create/update/get/delete contracts**

Add assertions that:

```js
const created = await useCases.createHeroine({ projectDirectory, heroine });
assert.equal(created.ok, true);
assert.equal(created.heroine.id, heroine.id);
assert.equal(created.heroineRevision.kind, "heroineRevision");

await assert.rejects(
  () => useCases.createHeroine({ projectDirectory, heroine }),
  (error) => error.code === "HEROINE_ID_CONFLICT"
);

const fetched = await useCases.getHeroine({ projectDirectory, heroineId: heroine.id });
assert.equal(fetched.ok, true);

const updated = await useCases.updateHeroine({
  projectDirectory,
  heroine: { ...heroine, name: "하루 수정" },
  expectedHeroineRevision: fetched.heroineRevision
});
assert.equal(updated.ok, true);

await assert.rejects(
  () => useCases.updateHeroine({
    projectDirectory,
    heroine: { ...heroine, name: "충돌" },
    expectedHeroineRevision: fetched.heroineRevision
  }),
  (error) => error.code === "HEROINE_REVISION_CONFLICT"
);
```

- [ ] **Step 2: Add failing API and CLI adapter tests**

Add assertions that Web API routes `/api/heroines/get`, `/api/heroines/create`, `/api/heroines/update`, and `/api/heroines/delete` return the expected HTTP status codes and failure envelopes. Add CLI assertions for `get-heroine`, `create-heroine`, `update-heroine`, and `delete-heroine`.

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm run build:maker
node tests/vn-maker-use-cases.test.mjs
node tests/vn-maker-regression.test.mjs
node tests/vn-maker-alpha-shell.test.mjs
```

Expected: fail because the new contracts and routes do not exist yet.

## Task 3: SA-126 Contract Implementation

**Files:**
- Modify: `packages/engine-core/src/index.ts`
- Modify: `packages/project-store/src/index.ts`
- Modify: `packages/use-cases/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/client/api/types.ts`

- [ ] **Step 1: Add heroine metadata/revision support in project-store**

Implement stable heroine and library revision refs, include `updatedAt`, support `getHeroine`, `createHeroine`, `updateHeroine`, and `deleteHeroine` with target existence and expected revision checks.

- [ ] **Step 2: Add use-case request/result DTOs and failures**

Implement `HeroineActionError` with `code`, `message`, `issues`, `retryable`, and optional `requestId`. Add `listHeroines`, `getHeroine`, `createHeroine`, `updateHeroine`, `deleteHeroine`, `generateHeroinePortrait`, and compatible `saveHeroine` wrapper.

- [ ] **Step 3: Add Web API and CLI commands**

Register `/api/heroines/get`, `/api/heroines/create`, `/api/heroines/update`, `/api/heroines/portrait/generate`, and CLI commands `get-heroine`, `create-heroine`, `update-heroine`, `generate-heroine-portrait`.

- [ ] **Step 4: Run GREEN verification**

Run:

```bash
npm run build:maker
node tests/vn-maker-use-cases.test.mjs
node tests/vn-maker-regression.test.mjs
```

Expected: SA-126 tests pass.

- [ ] **Step 5: Commit and push SA-126**

Run:

```bash
git diff --check
git status --short
git add packages/engine-core/src/index.ts packages/project-store/src/index.ts packages/use-cases/src/index.ts apps/web/src/server/handlers.ts packages/cli/src/index.ts apps/web/src/client/api/types.ts tests/vn-maker-use-cases.test.mjs tests/vn-maker-regression.test.mjs tests/vn-maker-alpha-shell.test.mjs
git commit -m "feat: define heroine management use case contracts"
git push
```

Expected: SA-126 implementation commit is pushed and Linear is updated.

## Task 4: SA-127 to SA-130 Route and UI Tests

**Files:**
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Add or modify React page/component source checks as needed

- [ ] **Step 1: Add failing route/component source tests**

Assert that `App.tsx` includes `/heroines`, `/heroines/new`, `/heroines/:heroineId`, and `/heroines/:heroineId/edit` with separate page components. Assert source files exist for `HeroineListPage`, `HeroineCreatePage`, `HeroineDetailPage`, `HeroineEditPage`, `HeroineFormPanel`, `HeroineActionBar`, and `HeroineDeleteDialog`.

- [ ] **Step 2: Add source contract tests for Alpha exclusions and UX states**

Assert no search UI, sort UI, tag filter, clone action, default emotion asset, or extra expression tag action appears in heroine route components. Assert count/fixed sort text, notFound text, delete confirmation text, snapshot policy text, dirty leave handling, sticky action bar classes, and revision conflict reload action exist.

- [ ] **Step 3: Run and verify RED**

Run:

```bash
node tests/vn-maker-alpha-shell.test.mjs
```

Expected: fail because the new pages/components do not exist yet.

## Task 5: SA-127 to SA-130 Route and UI Implementation

**Files:**
- Modify: `apps/web/src/client/App.tsx`
- Replace or reduce: `apps/web/src/client/pages/HeroineStartPage.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineListPage.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineCreatePage.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineDetailPage.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineEditPage.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineFormPanel.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineActionBar.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroineDeleteDialog.tsx`
- Create: `apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx`
- Create: `apps/web/src/client/pages/heroines/heroineApi.ts`
- Modify: `apps/web/src/client/pages/heroines/heroinePageTypes.ts`
- Modify: `apps/web/src/client/styles.css`

- [ ] **Step 1: Add separate route pages**

Create page-level components that orchestrate load/action/navigation only and use common heroine API helpers.

- [ ] **Step 2: Add form/action/delete components**

Move draft validation, dirty state display, sticky action bar, and delete confirmation into focused components.

- [ ] **Step 3: Remove default Alpha exposure from WorkspacePage**

Replace the WorkspacePage heroine library editor area with navigation to `/heroines` or keep it outside Alpha heroine management flows without search/tag/sort/clone as default heroine management.

- [ ] **Step 4: Run GREEN verification**

Run:

```bash
npm run typecheck
node tests/vn-maker-alpha-shell.test.mjs
```

Expected: route/component contract tests pass.

- [ ] **Step 5: Commit and push SA-127 through SA-130**

Run:

```bash
git diff --check
git status --short
git add apps/web/src/client/App.tsx apps/web/src/client/pages/HeroineStartPage.tsx apps/web/src/client/pages/heroines apps/web/src/client/styles.css tests/vn-maker-alpha-shell.test.mjs
git commit -m "feat: split heroine management routes"
git push
```

Expected: UI split commit is pushed and Linear is updated for SA-127 through SA-130.

## Task 6: SA-131 Portrait Tests and Implementation

**Files:**
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`
- Modify: `packages/project-store/src/index.ts`
- Modify: `packages/use-cases/src/index.ts`
- Modify: `apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx`

- [ ] **Step 1: Add failing staged portrait tests**

Assert `generateHeroinePortrait` with a draft and no `heroineId` returns `stagedPortraitRef` and does not create a library heroine. Assert `createHeroine` with that ref links the generated/imported portrait to the new heroine. Assert existing heroine portrait generation updates asset metadata and heroine revision.

- [ ] **Step 2: Implement staged portrait/import boundary**

Use `project-store` for staged portrait records and stored assets. Use the existing image adapter path for generation and keep failures from blocking base profile save.

- [ ] **Step 3: Run GREEN verification**

Run:

```bash
npm run build:maker
node tests/vn-maker-use-cases.test.mjs
node tests/vn-maker-regression.test.mjs
```

Expected: staged portrait and existing portrait flows pass.

- [ ] **Step 4: Commit and push SA-131**

Run:

```bash
git diff --check
git status --short
git add packages/project-store/src/index.ts packages/use-cases/src/index.ts apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx tests/vn-maker-use-cases.test.mjs tests/vn-maker-regression.test.mjs
git commit -m "feat: add heroine portrait generation boundary"
git push
```

Expected: portrait boundary commit is pushed and Linear is updated.

## Task 7: SA-132 Verification

**Files:**
- Modify: `tests/vn-maker-regression.test.mjs`
- Linear: `SA-132` comment

- [ ] **Step 1: Run required commands**

Run:

```bash
npm run typecheck
npm run test:maker
```

Expected: both pass.

- [ ] **Step 2: Run actual CLI/API happy path**

Run CLI commands against a temporary project directory: `create-heroine`, `list-heroines`, `get-heroine`, `update-heroine`, `delete-heroine`, and `create-project-from-heroine`.

Run Web API handler calls for create/list/get/update/delete and failure cases for empty response normalization, non-JSON normalization, 5xx normalization, ID conflict, reserved ID, notFound, and revision conflict.

- [ ] **Step 3: Browser viewport verification**

Start the app:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

Verify 390x844, 768x1024, and 1440x900 for list, detail, create, edit, delete dialog, notFound, and sticky action bar.

- [ ] **Step 4: Final gates, commit, push, and Linear updates**

Run:

```bash
git diff --check
git status --short
npm run typecheck
npm run test:maker
git push
```

Expected: all verification is recorded in Linear. SA-124 and SA-125 through SA-132 can be moved to `Done` only if every acceptance criterion has direct evidence.
