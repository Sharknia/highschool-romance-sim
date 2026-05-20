# SA-41 DDD Lite Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every SA-41 child task so VN Maker uses domain-owned DTO validation, pure domain mutation, shared web/CLI use cases, provider-neutral generation contracts, and split domain tests.

**Architecture:** Keep domain rules and DTO parsers in `@vn-maker/engine-core`, persistence in `@vn-maker/project-store`, provider calls in `@vn-maker/generation-codex`, and orchestration in a thin shared use case package used by both CLI and Web API. React should pass user intent and explicit UI selection only; default route/job/prompt decisions live in shared selectors/use cases.

**Tech Stack:** TypeScript workspaces, Vite React, Hono, better-sqlite3, Node ESM, custom lightweight DTO parsers in engine-core.

---

### Task 1: DTO Schemas and Pure Project Mutation

**Files:**
- Modify: `packages/engine-core/src/index.ts`
- Modify: `packages/project-store/src/index.ts`
- Test: `tests/vn-maker-domain.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing domain/DTO tests**

Create tests for `parseVnMakerProject`, `parseEventExpansionPlan`, `upsertProjectCharacter`, `upsertProjectScene`, and `applyGenerationResultToProject`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run build -w @vn-maker/engine-core && node tests/vn-maker-domain.test.mjs`
Expected: failure because parser and mutation exports do not exist.

- [ ] **Step 3: Implement minimal engine-core exports**

Add path-aware DTO result helpers, parsers, pure mutation helpers, and shared event expansion policy description helpers.

- [ ] **Step 4: Use pure mutation helpers in project-store**

Replace direct project array mutation in `upsertCharacter`, `upsertScene`, and `storeGenerationResult`.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm run build -w @vn-maker/engine-core && npm run build -w @vn-maker/project-store && node tests/vn-maker-domain.test.mjs`
Expected: pass.

### Task 2: Shared VN Maker Use Cases

**Files:**
- Create: `packages/use-cases/package.json`
- Create: `packages/use-cases/tsconfig.json`
- Create: `packages/use-cases/src/index.ts`
- Modify: `package.json`
- Modify: `packages/cli/package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Test: `tests/vn-maker-use-cases.test.mjs`

- [ ] **Step 1: Write failing use case tests**

Test create/open/validate, event expand/approve with a fake event adapter, and provider-neutral image generation through a fake image adapter.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run build -w @vn-maker/use-cases && node tests/vn-maker-use-cases.test.mjs`
Expected: package not found or missing exports.

- [ ] **Step 3: Implement use case package**

Add `createVnMakerUseCases()` with project store orchestration, DTO parsing, provider-neutral image request handling, and shared event expansion flow.

- [ ] **Step 4: Refactor CLI and Web API**

Keep CLI and Hono as transport layers: read body/stdin, dispatch command/path, return JSON.

- [ ] **Step 5: Run use case and regression tests**

Run: `npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-regression.test.mjs`
Expected: pass.

### Task 3: Provider Boundary and Client Domain Defaults

**Files:**
- Modify: `packages/generation-codex/src/index.ts`
- Modify: `apps/web/src/client/pages/WorkspacePage.tsx`
- Modify: `apps/web/src/client/api/types.ts`
- Test: `tests/vn-maker-domain.test.mjs`
- Test: `tests/vn-maker-regression.test.mjs`

- [ ] **Step 1: Write failing tests for schema and provider-neutral requests**

Assert invalid `EventExpansionPlan` returns schema paths, and API image generation accepts `jobId` without client-sent prompt/style/provider fields.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run build:maker && node tests/vn-maker-regression.test.mjs`
Expected: failure until handlers/use cases support provider-neutral requests.

- [ ] **Step 3: Replace generation-codex shape guard with engine-core schema**

Use `parseEventExpansionPlan` and domain policy helper text.

- [ ] **Step 4: Remove client-side default route/job/prompt decisions**

Send only `userEvent`, optional `afterSceneId`, `jobId`, or `kind/targetId/heroine`.

- [ ] **Step 5: Run full maker validation**

Run: `npm run typecheck && npm run test:maker`
Expected: pass.

### Task 4: Legacy Boundary and Test Split

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `tests/vn-maker-regression.test.mjs`
- Test: `tests/vn-maker-domain.test.mjs`
- Test: `tests/vn-maker-use-cases.test.mjs`

- [ ] **Step 1: Split maker domain/use case tests from E2E smoke**

Ensure `test:maker` runs domain, use case, and regression tests.

- [ ] **Step 2: Clarify legacy script names**

Expose explicit `legacy:*` script aliases and keep integrated validation command.

- [ ] **Step 3: Run final verification**

Run: `npm run typecheck`, `npm run test:maker`, `git diff --check`, and `git status --short`.

- [ ] **Step 4: Commit per completed Linear task group**

Commit foundation, use case/API, provider/client, and docs/test split separately.

---

Self-review: This plan maps SA-42 through SA-49 to concrete files and verification commands. No intentional placeholder work remains; implementation details should follow the existing single-file package style unless a file becomes too large.
