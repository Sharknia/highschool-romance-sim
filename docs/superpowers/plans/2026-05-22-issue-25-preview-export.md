# Issue 25 Preview Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make preview and export tabs show readiness, blockers, core validation summaries, included project data/assets, execution results, and safe API failure states without implying completion on failure.

**Architecture:** Use `engine-core` validation/runtime/export results through `use-cases`, add display DTOs for preview/export readiness, and keep React responsible only for rendering result states and user next actions.

**Tech Stack:** `engine-core`, `use-cases`, Web API, CLI, React, Node integration tests, safe API parser from #20.

---

### Task 1: Preview Readiness DTO

**Files:**
- Modify: `packages/use-cases/src/index.ts`
- Modify: `tests/vn-maker-use-cases.test.mjs`

- [ ] **Step 1: Write failing use-case assertions**

Add after the assigned snapshot and background generation setup:

```js
const previewBeforeReady = await useCases.previewProject({
  projectDirectory: blankProjectDirectory
});
assert.equal(previewBeforeReady.ok, true);
assert.equal(Array.isArray(previewBeforeReady.previewReadiness.missingItems), true);
assert.equal(previewBeforeReady.previewReadiness.nextActions.some((action) => action.tab === "background"), true);
```

For a ready project:

```js
const previewReady = await useCases.previewProject({ projectDirectory });
assert.equal(previewReady.ok, true);
assert.equal(previewReady.previewReadiness.canRun, true);
assert.equal(previewReady.previewReadiness.state, "prepared");
assert.equal(previewReady.previewReadiness.availableState, "ready");
```

For a failed preview run:

```js
const previewFailed = await useCases.previewProject({
  projectDirectory: brokenProjectDirectory
});
assert.equal(previewFailed.ok, false);
assert.equal(previewFailed.previewReadiness.state, "failed");
assert.equal(previewFailed.previewReadiness.retryable, true);
assert.match(previewFailed.previewReadiness.nextAction, /다시 시도|차단 항목/);
assert.ok(previewFailed.previewReadiness.failureCause);
```

- [ ] **Step 2: Run use-case test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: FAIL because `previewReadiness` is missing.

- [ ] **Step 3: Add preview readiness helper**

In `packages/use-cases/src/index.ts`, add:

```ts
function previewReadiness(project: VnMakerProject, validation: { ok?: boolean; issues?: ValidationIssue[] }) {
  const missingItems = [];
  if (project.characters.length === 0) missingItems.push({ id: "heroine", label: "히로인 스냅샷", tab: "heroine" });
  if (!project.assets.some((asset) => asset.kind === "background")) missingItems.push({ id: "background", label: "배경 화면", tab: "background" });
  if (project.scenes.length === 0) missingItems.push({ id: "studio", label: "장면", tab: "studio" });
  const blockingIssues = (validation.issues || []).filter((issue) => issue.severity === "error");
  return {
    state: missingItems.length || blockingIssues.length ? "blocked" : "prepared",
    availableState: missingItems.length || blockingIssues.length ? "blocked" : "ready",
    canRun: missingItems.length === 0 && blockingIssues.length === 0,
    missingItems,
    blockingIssues,
    nextActions: missingItems.map((item) => ({ tab: item.tab, label: `${item.label} 해결` })),
    retryable: missingItems.length === 0,
    failureCause: undefined
  };
}
```

Return it from `previewProject()`. When runtime preparation throws or returns a failed result, return:

```ts
{
  state: "failed",
  availableState: "failed",
  canRun: false,
  failureCause: error instanceof Error ? error.message : String(error),
  retryable: true,
  nextAction: "차단 항목을 확인한 뒤 다시 시도하세요."
}
```

The UI may use `state: "running"` while the `/api/project/preview` request is in flight. The use-case returns `blocked`, `prepared`, or `failed`; the UI derives `ready` before execution from `availableState === "ready"` and `running` from request state. This avoids mixing two independent state machines.

- [ ] **Step 4: Run use-case test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: PASS.

### Task 2: Export Plan DTO

**Files:**
- Modify: `packages/use-cases/src/index.ts`
- Modify: `tests/vn-maker-use-cases.test.mjs`

- [ ] **Step 1: Write failing export assertions**

Add:

```js
const exportReadyPlan = await useCases.exportProject({ projectDirectory });
assert.equal(exportReadyPlan.ok, true);
assert.equal(exportReadyPlan.exportPlan.target, "localDesktopWebApp");
assert.equal(exportReadyPlan.exportPlan.includedData.includes("project"), true);
assert.equal(exportReadyPlan.exportPlan.includedAssets.some((asset) => asset.kind === "background"), true);
assert.equal(exportReadyPlan.exportPlan.githubPagesTarget, false);
assert.equal(exportReadyPlan.exportPlan.validationSummary.ok, true);
assert.equal(Array.isArray(exportReadyPlan.exportPlan.validationSummary.warnings), true);
```

For blocked export:

```js
assert.equal(blockedExportWithPlannedCg.workflowSummary.exportState, "blocked");
assert.equal(blockedExportWithPlannedCg.exportPlan.blockers.some((blocker) => blocker.kind === "generationJob"), true);
assert.equal(blockedExportWithPlannedCg.exportPlan.state, "blocked");
assert.notEqual(blockedExportWithPlannedCg.exportPlan.state, "complete");
```

For failed export:

```js
const failedExport = await useCases.exportProject({ projectDirectory, outputDirectory: unwritableOutputDirectory }).catch((error) => error);
assert.equal(failedExport.exportPlan.state, "failed");
assert.ok(failedExport.exportPlan.failureCause);
assert.equal(failedExport.exportPlan.retryable, true);
assert.match(failedExport.exportPlan.nextAction, /다시 시도|저장 위치/);
assert.notEqual(failedExport.exportPlan.state, "complete");
```

- [ ] **Step 2: Run use-case test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: FAIL because `exportPlan` is missing.

- [ ] **Step 3: Add export plan helper**

In `packages/use-cases/src/index.ts`, add:

```ts
function exportPlanFor(project: VnMakerProject, validation: { ok?: boolean; issues?: ValidationIssue[] }) {
  const blockers = [];
  if (validation.ok === false) blockers.push({ kind: "validation", issues: validation.issues || [] });
  project.generationJobs
    .filter((job) => ["background", "cg"].includes(job.kind) && job.status !== "completed")
    .forEach((job) => blockers.push({ kind: "generationJob", jobId: job.id, status: job.status }));
  return {
    target: "localDesktopWebApp",
    state: blockers.length === 0 ? "ready" : "blocked",
    githubPagesTarget: false,
    canExport: blockers.length === 0,
    includedData: ["project", "runtime", "assetManifest"],
    includedAssets: project.assets.map((asset) => ({ id: asset.id, kind: asset.kind, label: asset.label, uri: asset.uri })),
    blockers,
    warnings: [],
    validationSummary: {
      ok: validation.ok !== false,
      warnings: (validation.issues || []).filter((issue) => issue.severity === "warning"),
      errors: (validation.issues || []).filter((issue) => issue.severity === "error")
    },
    failureCause: undefined,
    retryable: blockers.length > 0,
    nextAction: blockers.length > 0 ? "차단 항목을 해결한 뒤 다시 시도하세요." : "내보내기를 실행할 수 있습니다."
  };
}
```

Return `exportPlan` for success, `ExportBlockedError` context, and failed export errors. For an unexpected export error, set `state: "failed"`, `canExport: false`, `failureCause`, `retryable: true`, and `nextAction`.

- [ ] **Step 4: Run use-case test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: PASS.

### Task 3: Preview/Export UI States

**Files:**
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `apps/web/src/client/pages/projects/projectPageTypes.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing UI source assertions**

Add:

```js
[
  "previewReadiness",
  "availableState",
  "prepared",
  "running",
  "failed",
  "누락 항목",
  "해결 탭으로 이동",
  "실패 원인",
  "재시도 가능 여부",
  "다음 행동",
  "공통 헤더와 탭 바는 유지됩니다"
].forEach((text) => assert.match(projectDetailViewSource, new RegExp(text), `프리뷰 탭에 ${text} 표시가 있어야 합니다.`));
[
  "exportPlan",
  "validationSummary",
  "로컬 데스크톱형 웹 앱",
  "GitHub Pages는 레거시 대상이며 이번 내보내기 대상이 아닙니다.",
  "githubPagesTarget",
  "포함될 프로젝트 데이터",
  "포함될 에셋",
  "차단 항목",
  "실패 상태가 완료 상태로 오인되지 않습니다"
].forEach((text) => assert.match(projectDetailViewSource, new RegExp(text), `내보내기 탭에 ${text} 표시가 있어야 합니다.`));
```

- [ ] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL until UI renders readiness/export plan.

- [ ] **Step 3: Extend client types**

In `projectPageTypes.ts`, add:

```ts
export interface ProjectPreviewReadiness {
  state?: "blocked" | "prepared" | "running" | "failed";
  availableState?: "blocked" | "ready" | "failed";
  canRun?: boolean;
  missingItems?: Array<{ id?: string; label?: string; tab?: ProjectTabId }>;
  nextActions?: Array<{ tab?: ProjectTabId; label?: string }>;
  blockingIssues?: ProjectIssue[];
  failureCause?: string;
  retryable?: boolean;
  nextAction?: string;
}

export interface ProjectExportPlan {
  state?: "blocked" | "ready" | "running" | "failed" | "complete";
  target?: "localDesktopWebApp";
  githubPagesTarget?: boolean;
  canExport?: boolean;
  includedData?: string[];
  includedAssets?: Array<Pick<ProjectAsset, "id" | "kind" | "label" | "uri">>;
  blockers?: Array<{ kind?: string; jobId?: string; status?: string; issues?: ProjectIssue[] }>;
  warnings?: string[];
  validationSummary?: { ok?: boolean; warnings?: ProjectIssue[]; errors?: ProjectIssue[] };
  failureCause?: string;
  retryable?: boolean;
  nextAction?: string;
}
```

Add optional `previewReadiness` and `exportPlan` to `ProjectApiResult`.

- [ ] **Step 4: Render safe states**

In `ProjectDetailView.tsx`:
- show `previewReadiness.missingItems` with buttons that navigate to each tab;
- show failed preview cause, `result.retryable`, `result.code`, and `result.nextAction` when preview API calls fail;
- set a UI-only `previewReadiness.state = "running"` while `/api/project/preview` is in flight;
- explicitly handle empty response, nonJSON response, and 5xx response envelopes from `/api/project/preview`;
- show export target as `로컬 데스크톱형 웹 앱`;
- display `githubPagesTarget === false` as `GitHub Pages는 레거시 대상이며 이번 내보내기 대상이 아닙니다.`;
- display blockers before the export action;
- never render export `state: "blocked"` or `state: "failed"` as complete;
- show failed export cause, retryability, and next action;
- display `validationSummary` warnings and errors before the export action;
- leave header and `<TabList>` outside all error branches.

- [ ] **Step 5: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

### Task 4: Web/API/CLI Happy Path

**Files:**
- Modify: `tests/vn-maker-alpha-sandbox.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`

- [ ] **Step 1: Add API/CLI assertions**

In sandbox/regression tests, assert preview/export include the new DTOs:

```js
assert.equal(apiPreview.body.previewReadiness.canRun, true);
assert.equal(apiPreview.body.previewReadiness.state, "prepared");
assert.equal(apiExport.body.exportPlan.target, "localDesktopWebApp");
assert.equal(apiExport.body.exportPlan.githubPagesTarget, false);
assert.equal(apiExport.body.exportPlan.validationSummary.ok, true);
assert.equal(apiExport.body.exportPlan.includedData.includes("assetManifest"), true);
assert.equal(apiExport.body.exportPlan.includedAssets.some((asset) => asset.kind === "background"), true);
```

For CLI:

```js
assert.equal(cliPreview.previewReadiness.canRun, true);
assert.equal(cliPreview.previewReadiness.state, "prepared");
assert.equal(cliExport.exportPlan.target, "localDesktopWebApp");
assert.equal(cliExport.exportPlan.validationSummary.ok, true);
assert.equal(cliExport.exportPlan.includedData.includes("assetManifest"), true);
assert.equal(cliExport.exportPlan.includedAssets.some((asset) => asset.kind === "background"), true);
```

Also assert blocked and failure envelopes:

```js
assert.equal(apiBlockedExport.body.exportPlan.state, "blocked");
assert.equal(apiBlockedExport.body.exportPlan.blockers.some((blocker) => blocker.kind === "generationJob"), true);
assert.equal(apiExportFailed.body.exportPlan.state, "failed");
assert.ok(apiExportFailed.body.exportPlan.failureCause);
assert.equal(apiExportFailed.body.exportPlan.retryable, true);
assert.match(apiExportFailed.body.exportPlan.nextAction, /다시 시도|저장 위치|차단 항목/);
assert.notEqual(apiExportFailed.body.exportPlan.state, "complete");
assert.equal(apiPreviewEmpty.body.ok, false);
assert.equal(apiPreviewEmpty.body.code, "EMPTY_RESPONSE");
assert.equal(apiPreviewNonJson.body.code, "NON_JSON_RESPONSE");
assert.equal(apiPreview5xx.body.retryable, true);
assert.equal(cliBlockedExport.exportPlan.state, "blocked");
assert.equal(cliBlockedExport.exportPlan.blockers.some((blocker) => blocker.kind === "generationJob"), true);
assert.equal(cliFailedExport.exportPlan.state, "failed");
assert.ok(cliFailedExport.exportPlan.failureCause);
assert.equal(cliFailedExport.exportPlan.retryable, true);
assert.match(cliFailedExport.exportPlan.nextAction, /다시 시도|저장 위치|차단 항목/);
assert.notEqual(cliFailedExport.exportPlan.state, "complete");
```

Use the existing transport paths `/api/project/preview` and `/api/project/export`. Do not introduce `/api/projects/preview` or `/api/projects/export` unless #20 has intentionally migrated and aliased the old paths.

- [ ] **Step 2: Run tests**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-sandbox.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: PASS.

### Task 5: Commit and Push Issue 25

**Files:**
- All files modified in Tasks 1-4
- This plan file

- [ ] **Step 1: Run required verification**

Run:

```bash
npm run typecheck
npm run test:maker
git diff --check
git status --short --branch
```

- [ ] **Step 2: Commit and push**

Run:

```bash
git add packages/use-cases/src/index.ts apps/web/src/client/pages/projects/ProjectDetailView.tsx apps/web/src/client/pages/projects/projectPageTypes.ts tests/vn-maker-use-cases.test.mjs tests/vn-maker-alpha-shell.test.mjs tests/vn-maker-alpha-sandbox.test.mjs tests/vn-maker-regression.test.mjs docs/superpowers/plans/2026-05-22-issue-25-preview-export.md
git commit -m "feat: implement issue 25 preview export states"
git push
```

- [ ] **Step 3: Update GitHub Issue #25**

Post done/partial/not done, Web/API/CLI happy path evidence, verification commands, commit SHA, and push status to #25.
