# SA-102 Recent Project Deep Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SA-102 so recent projects can be reopened from `/projects`, and `/projects/:projectId/:tab` restores the project directory from the recent index after refresh.

**Architecture:** `@vn-maker/project-store` owns the file-backed recent project index. `@vn-maker/use-cases` updates and resolves that index for create/open/remove operations. `apps/web` exposes thin API routes and renders `/projects` plus project detail tab routes without duplicating project/domain state.

**Tech Stack:** TypeScript workspaces, Node filesystem APIs, Hono API handlers, Vite + React + React Router.

---

### Task 1: Recent Project Index and Use Case Contract

**Files:**
- Modify: `packages/project-store/src/index.ts`
- Modify: `packages/use-cases/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Test: `tests/vn-maker-use-cases.test.mjs`
- Test: `tests/vn-maker-regression.test.mjs`

- [ ] **Step 1: Write failing use-case tests**

Add assertions that create/open upsert a recent entry, `openProject({ projectId })` restores `projectDirectory`, missing directories are marked `missing: true`, ID mismatch throws `PROJECT_ID_MISMATCH`, and remove does not delete `project.sqlite`.

- [ ] **Step 2: Verify RED**

Run: `npm run build:maker && node tests/vn-maker-use-cases.test.mjs`

Expected: FAIL because `recentProjectIndexFile`, `listRecentProjects`, `removeRecentProject`, and projectId-only open are not implemented.

- [ ] **Step 3: Implement project-store index owner**

Add exported `RecentProjectIndexEntry`, `RecentProjectIndexStore`, `getDefaultRecentProjectIndexPath`, and `projectWorkspaceExists`. Store JSON at the configured index path, sort most recently opened first, and refresh missing flags by checking each entry's `project.sqlite`.

- [ ] **Step 4: Implement use-case and API boundary**

Add `recentProjectIndexFile?: string` to use-case/API options, upsert on create/open/create-from-heroine, support `openProject({ projectId })`, expose `listRecentProjects` and `removeRecentProject`, and map custom recent-project errors to 404/409 responses.

- [ ] **Step 5: Verify GREEN**

Run: `npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-regression.test.mjs`

Expected: PASS for recent index and API behavior.

### Task 2: Project Routes and Deep Link Restoration

**Files:**
- Modify: `apps/web/src/client/App.tsx`
- Modify: `apps/web/src/client/pages/ProjectStartPage.tsx`
- Test: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing route/source tests**

Assert the app declares `/projects/:projectId` and `/projects/:projectId/:tab`, that detail tab names include `overview`, `heroine`, `event`, `assets`, `preview`, `export`, and that the project page contains the user-facing miss/missing/mismatch messages.

- [ ] **Step 2: Verify RED**

Run: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs`

Expected: FAIL because only `/projects` exists and `ProjectStartPage` does not restore by projectId.

- [ ] **Step 3: Implement route orchestration**

Use React Router params in `ProjectStartPage`; when `projectId` is present, call `/api/projects/open` with `{ projectId }`, update shell state from the response, and keep the current tab in the URL.

- [ ] **Step 4: Verify GREEN**

Run: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs`

Expected: PASS.

### Task 3: Recent Project List UX

**Files:**
- Modify: `apps/web/src/client/pages/ProjectStartPage.tsx`
- Modify: `apps/web/src/client/styles.css`
- Test: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing UI source tests**

Assert `ProjectStartPage` calls `/api/projects/recent/list`, `/api/projects/recent/remove`, renders recent project metadata, has a reconnect action, and uses wording that removal only deletes the list entry.

- [ ] **Step 2: Verify RED**

Run: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs`

Expected: FAIL until the UI exists.

- [ ] **Step 3: Implement list/open/reconnect/remove controls**

Render recent entries with title, directory, last opened, validation state, and missing state. Use the directory input for reconnecting a selected entry, and navigate successful opens to `/projects/:projectId/overview`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs`

Expected: PASS.

### Task 4: Verification, Commit, Push, and Linear Review

**Files:**
- Modify: Linear issues `SA-115`, `SA-116`, `SA-117`, `SA-118`, `SA-102`

- [ ] **Step 1: Run required verification**

Run: `npm run typecheck`, `npm run test:maker`, `git diff --check`, and `git status --short --branch`.

- [ ] **Step 2: Run actual app happy path**

Start the web app with `VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web`, create/open a project through `/projects`, reload `/projects/:projectId/event`, `/assets`, `/preview`, `/export`, and check desktop/mobile widths.

- [ ] **Step 3: Commit and push**

Commit SA-102 changes on `feature/sa-102-recent-project-deeplink` and push the branch.

- [ ] **Step 4: Linear review transition**

Mark completed sub-issues Done, add verification evidence to SA-102, and move SA-102 to In Review.
