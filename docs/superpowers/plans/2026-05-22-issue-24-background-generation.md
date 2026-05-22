# Issue 24 Background Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide `/projects/:projectId/background` with Alpha one-background generation, Codex `imageGeneration` adapter usage, and generated background asset linkage to the project.

**Architecture:** Use #20's shared `background` image job contract, add a project-background use-case policy that allows one active background, and render the UI through the central detail shell without reusing the old `assets` visible tab.

**Tech Stack:** `engine-core`, `project-store`, `use-cases`, `generation-codex`, CLI, Web API, React, alpha sandbox adapter, Node integration tests.

---

## Background Contract Guard

Issue #24 normally runs after #20. Still, before implementing this issue, confirm the shared `background` contract exists in the working tree. If it does not, implement the missing pieces here rather than silently relying on an absent prerequisite.

**Files:**
- Modify if missing: `packages/engine-core/src/index.ts`
- Modify if missing: `packages/generation-codex/src/index.ts`
- Modify if missing: `tests/vn-maker-domain.test.mjs`
- Modify if missing: `tests/vn-maker-regression.test.mjs`

- [x] **Step 0.1: Add or verify contract tests**

Ensure these assertions exist:

```js
assert.equal(core.createImageGenerationJob({
  id: "job-background-contract",
  kind: "background",
  targetId: "project-background-contract",
  prompt: "contract background",
  outputAssetId: "asset-background-contract"
}).kind, "background");
assert.match(readText("packages/generation-codex/src/index.ts"), /type:\\s*"imageGeneration"/);
assert.match(readText("packages/generation-codex/src/index.ts"), /background/);
```

- [x] **Step 0.2: Implement missing contract only if the test fails**

If the assertions fail, add `background` to:

```ts
export type GenerationJobKind =
  | "character"
  | "route"
  | "scene"
  | "dialogue"
  | "portrait"
  | "expression"
  | "cg"
  | "background";

type CodexImageKind = "portrait" | "expression" | "cg" | "background";
```

Keep the Codex adapter request item as `type: "imageGeneration"`. Do not introduce a background-only adapter path.

Verification:
- Existing core and Codex contracts already accepted `background`.
- Added guard assertions in `tests/vn-maker-domain.test.mjs` and `tests/vn-maker-regression.test.mjs`.
- No contract implementation change was required in `packages/engine-core` or `packages/generation-codex`.

### Task 1: Background Project Asset Linkage Use Case

**Files:**
- Modify: `packages/project-store/src/index.ts`
- Modify: `packages/use-cases/src/index.ts`
- Modify: `tests/vn-maker-use-cases.test.mjs`

- [x] **Step 1: Write failing use-case assertions**

Add after the #20 background job assertions in `tests/vn-maker-use-cases.test.mjs`:

```js
const backgroundRun = await useCases.runGenerationJobs({
  projectDirectory,
  jobIds: ["job-usecase-background"],
  replaceCompleted: true
});
assert.equal(backgroundRun.ok, true);
assert.equal(backgroundRun.assets[0].kind, "background");
const projectAfterBackground = backgroundRun.project;
assert.equal(projectAfterBackground.assets.filter((asset) => asset.kind === "background").length, 1);
assert.equal(
  projectAfterBackground.scenes.some((scene) => scene.backgroundAssetId === "asset-usecase-background"),
  true,
  "생성된 배경은 프로젝트 장면 backgroundAssetId에 연결되어야 합니다."
);

const secondBackground = await useCases.createGenerationJob({
  projectDirectory,
  id: "job-usecase-background-second",
  kind: "background",
  targetId: created.project.id,
  prompt: "second classroom background",
  outputAssetId: "asset-usecase-background-second"
});
assert.equal(secondBackground.ok, true);
assert.equal(secondBackground.backgroundPolicy.limit, 1);
assert.equal(secondBackground.backgroundPolicy.replacesExisting, true);
```

- [x] **Step 2: Run use-case test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: FAIL because background results are not linked to scenes and no background policy DTO exists.

- [x] **Step 3: Implement background policy**

In `packages/use-cases/src/index.ts`, add helper:

```ts
function backgroundPolicy(project: VnMakerProject) {
  return {
    limit: 1,
    existingAssetId: project.assets.find((asset) => asset.kind === "background")?.id,
    replacesExisting: project.assets.some((asset) => asset.kind === "background")
  };
}
```

Return `backgroundPolicy` from `createGenerationJob`, `generateImage`, `runGenerationJobs`, and `listGenerationJobs` when relevant.

In `packages/project-store/src/index.ts`, after `storeGenerationResult()` applies a `background` result, update the project so the default route entry scene or first scene receives `backgroundAssetId = result.asset.id`. Replace prior generated background assets/jobs only through project policy, not by deleting imported assets.

- [x] **Step 4: Run use-case test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: PASS.

Verification:
- RED: `npm run build:maker && node tests/vn-maker-use-cases.test.mjs` failed because directly generated background assets were not linked to any scene `backgroundAssetId`.
- Root cause found: background result storage only upserted assets/jobs and did not apply a project-background policy.
- GREEN: `npm run build:maker && node tests/vn-maker-use-cases.test.mjs` passed after linking the default route entry scene and returning `backgroundPolicy`.

### Task 2: CLI/API Background Happy Path

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Modify: `tests/vn-maker-alpha-sandbox.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`

- [x] **Step 1: Write API/CLI assertions**

In `tests/vn-maker-alpha-sandbox.test.mjs`, add an API and CLI path under `VN_MAKER_ALPHA_SANDBOX=1`:

```js
const apiBackgroundJob = await sandboxApi({
  method: "POST",
  path: "/api/generation/jobs",
  body: {
    projectDirectory: apiProjectDirectory,
    id: "job-api-background",
    kind: "background",
    targetId: apiProject.body.project.id,
    prompt: "alpha sandbox classroom background",
    outputAssetId: "asset-api-background"
  }
});
assert.equal(apiBackgroundJob.status, 200);
assert.equal(apiBackgroundJob.body.job.kind, "background");
const apiBackgroundRun = await sandboxApi({
  method: "POST",
  path: "/api/generation/jobs/run",
  body: { projectDirectory: apiProjectDirectory, jobIds: ["job-api-background"], replaceCompleted: true }
});
assert.equal(apiBackgroundRun.status, 200);
assert.equal(apiBackgroundRun.body.assets[0].kind, "background");
```

For CLI:

```js
const cliBackgroundJob = JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", "create-image-job"], {
  input: JSON.stringify({
    projectDirectory: cliProjectDirectory,
    id: "job-cli-background",
    kind: "background",
    targetId: cliProject.project.id,
    prompt: "alpha sandbox cli background",
    outputAssetId: "asset-cli-background"
  }),
  encoding: "utf8",
  env: { ...process.env, VN_MAKER_ALPHA_SANDBOX: "1" }
}));
assert.equal(cliBackgroundJob.job.kind, "background");
const cliBackgroundRun = JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", "run-generation-jobs"], {
  input: JSON.stringify({
    projectDirectory: cliProjectDirectory,
    jobIds: ["job-cli-background"],
    replaceCompleted: true
  }),
  encoding: "utf8",
  env: { ...process.env, VN_MAKER_ALPHA_SANDBOX: "1" }
}));
assert.equal(cliBackgroundRun.ok, true);
assert.equal(cliBackgroundRun.assets[0].kind, "background");
const cliGeneratedBackground = JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", "generate-image"], {
  input: JSON.stringify({
    projectDirectory: cliProjectDirectory,
    kind: "background",
    targetId: cliProject.project.id,
    prompt: "alpha sandbox cli direct background",
    outputAssetId: "asset-cli-direct-background"
  }),
  encoding: "utf8",
  env: { ...process.env, VN_MAKER_ALPHA_SANDBOX: "1" }
}));
assert.equal(cliGeneratedBackground.ok, true);
assert.equal(cliGeneratedBackground.asset.kind, "background");
```

- [x] **Step 2: Verify shared-boundary RED condition**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-sandbox.test.mjs
```

Expected: FAIL until CLI/API support the shared background contract.

- [x] **Step 3: Wire adapters without new transport ownership**

Reuse:
- `/api/generation/jobs`
- `/api/generation/jobs/run`
- CLI `create-image-job`
- CLI `run-generation-jobs`
- CLI `generate-image`

Only add background-specific route/command if the shared route cannot expose confirmation data; the default implementation should reuse shared use cases.

- [x] **Step 4: Run sandbox and regression tests**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-sandbox.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: PASS.

Verification:
- The new API/CLI assertions cover `/api/generation/jobs`, `/api/generation/jobs/run`, CLI `create-image-job`, CLI `run-generation-jobs`, and CLI `generate-image`.
- The missing behavior was verified at the shared use-case boundary before implementation; API/CLI reuse the same use case and did not require new routes or commands.
- GREEN: `npm run build:maker && node tests/vn-maker-alpha-sandbox.test.mjs` passed.
- GREEN: `npm run build:maker && node tests/vn-maker-alpha-sandbox.test.mjs && node tests/vn-maker-regression.test.mjs && node tests/vn-maker-alpha-shell.test.mjs` passed.

### Task 3: Background Tab UI

**Files:**
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `apps/web/src/client/pages/projects/projectPageTypes.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Create: `docs/qa/issue-24-background-route.md`

- [x] **Step 1: Write failing UI source assertions**

Add:

```js
[
  "activeTab === \"background\"",
  "/projects/${currentProject?.id || projectId}/background",
  "대상 프로젝트",
  "Alpha에서는 프로젝트당 배경 1개만 생성할 수 있습니다.",
  "생성할 배경 설명",
  "저장될 결과 위치",
  "기존 배경 교체",
  "/api/generation/jobs",
  "/api/generation/jobs/run",
  "OAuth",
  "app-server",
  "adapter",
  "응답 파싱",
  "다시 시도",
  "backgroundAssetId",
  "저장 위치/에셋 연결 상태"
].forEach((text) => assert.match(projectDetailViewSource, new RegExp(text), `배경 탭에 ${text} 흐름이 있어야 합니다.`));
assert.match(projectPageTypesSource, /id: "background"/, "background 탭 URL 정의가 있어야 합니다.");
```

- [x] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL until background UI exists.

- [x] **Step 3: Implement the tab**

In `ProjectDetailView.tsx`:
- track `backgroundPrompt`, `backgroundStatus`, `backgroundBusy`, `backgroundJobId`, `backgroundErrors`;
- show the target project id/title and storage directory before generation as `대상 프로젝트`;
- show existing background preview from `currentProject.assets.find((asset) => asset.kind === "background")`;
- create or replace a deterministic job ID `job-background-${currentProject.id}`;
- run the job through shared generation endpoints;
- show generated preview, output asset id, URI, scene linkage, and `backgroundAssetId`;
- on failure, keep the prompt and show `다시 시도` that calls the same job creation/run path.

Use error categorization:

```ts
function generationErrorCategory(result: ProjectApiResult): string {
  if (result.code === "OAUTH_REQUIRED" || result.httpStatus === 401) return "OAuth";
  if (result.code === "NON_JSON_RESPONSE" || result.code === "EMPTY_RESPONSE") return "응답 파싱";
  if (result.message?.includes("app-server")) return "app-server";
  return "adapter";
}
```

The UI text must say that image generation uses the Codex app-server with ChatGPT managed OAuth and `imageGeneration`. Do not describe API keys as OAuth, do not ask users to paste an API key, and do not create an API-key login path in this issue.

- [x] **Step 4: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

Verification:
- RED: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs` failed because the visible background tab lacked the required #24 confirmation/linkage flow.
- GREEN: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs` passed after replacing the visible tab with the background-focused flow.

### Task 4: Browser Route And Direct URL Verification

**Files:**
- Create: `docs/qa/issue-24-background-route.md`

- [x] **Step 1: Create QA route evidence file**

Create:

```md
# Issue 24 Background Route QA

| Viewport | Direct `/projects/:projectId/background` | Reload stays on background | Tab click URL sync | Target project shown | Result |
| --- | --- | --- | --- | --- | --- |
| 390x844 | not-run | not-run | not-run | not-run | not-run |
| 768x1024 | not-run | not-run | not-run | not-run | not-run |
| 1440x900 | not-run | not-run | not-run | not-run | not-run |
```

- [x] **Step 2: Run route checks before commit**

Start the local app:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

At `390x844`, `768x1024`, and `1440x900`:
- open `/projects/:projectId/background` directly;
- reload the page and confirm the background tab remains active;
- navigate to another tab, click `배경 화면 생성`, and confirm the URL becomes `/projects/:projectId/background`;
- confirm the tab displays `대상 프로젝트`, title/id, storage directory, one-background limit, retry action, and `backgroundAssetId`/scene linkage area.

Record results and console errors in `docs/qa/issue-24-background-route.md`. Do not leave all rows `not-run` before the #24 commit.

Verification:
- Browser QA used Playwright Chromium because `agent-browser` was unavailable in this environment.
- `390x844`, `768x1024`, and `1440x900` passed direct URL, reload, tab URL sync, target project text, required background UI text, and console/runtime/non-favicon HTTP error checks.
- `1440x900` also clicked `배경 생성` once under `VN_MAKER_ALPHA_SANDBOX=1`; this is recorded as a `목 테스트` browser happy path.
- Screenshots recorded in `/tmp/vn-maker-issue24-background/background-*.png`.

### Task 5: Commit and Push Issue 24

**Files:**
- All files modified in Tasks 1-4 and the contract guard if it changed files
- This plan file

- [x] **Step 1: Run required verification**

Run:

```bash
npm run typecheck
npm run test:maker
git diff --check
git status --short --branch
```

Verification:
- `npm run typecheck && npm run test:maker && git diff --check && git status --short --branch` exited 0.
- Subagent review first pass returned REVISE on failed `runGenerationJobs` error classification.
- Added `code/message/error/retryable` failure DTO coverage for image job failures, made the UI inspect `errors[]`, and added an OAuth failure regression test.
- Re-ran `npm run typecheck && npm run test:maker && git diff --check && git status --short --branch`; exit 0.
- Subagent re-review: PASS.

- [x] **Step 2: Run actual or sandbox imageGeneration path**

Run a real Codex app-server `imageGeneration` path if authenticated:

```bash
npm run build:maker
node packages/cli/dist/index.js codex-auth-status
node packages/cli/dist/index.js create-project <<'JSON'
{"projectDirectory":"/tmp/vn-maker-actual-background.vnmaker","starter":{"id":"actual-project","title":"Actual Background","premise":"Actual Codex background verification"}}
JSON
node packages/cli/dist/index.js create-image-job <<'JSON'
{"projectDirectory":"/tmp/vn-maker-actual-background.vnmaker","id":"job-actual-background","kind":"background","targetId":"actual-project","prompt":"clean high school classroom background","outputAssetId":"asset-actual-background"}
JSON
node packages/cli/dist/index.js run-generation-jobs <<'JSON'
{"projectDirectory":"/tmp/vn-maker-actual-background.vnmaker","jobIds":["job-actual-background"],"replaceCompleted":true}
JSON
```

Success criteria for an actual run:
- `codex-auth-status` returns `ok: true`, `session.connected === true`, and `session.capabilities.imageGeneration !== false`;
- CLI/API output has `ok: true`;
- `VN_MAKER_ALPHA_SANDBOX` is unset for the actual run, and output/session mode is not `alpha-sandbox`;
- source assertion confirms `packages/generation-codex` sends an app-server item with `type: "imageGeneration"`;
- result asset has `kind: "background"`;
- result includes generated asset metadata such as `uri` or `codexSavedPath`;
- project contains exactly one generated background asset after replacement;
- at least one scene has `backgroundAssetId` equal to the generated background asset id;
- no API key prompt or API-key-as-OAuth wording appears in Web or CLI output.

If `codex-auth-status` is disconnected or `imageGeneration` is false, record the actual run as not completed with the exact session/capability reason. Do not call the sandbox result actual.

If unavailable, run:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run build:maker
VN_MAKER_ALPHA_SANDBOX=1 node tests/vn-maker-alpha-sandbox.test.mjs
```

Record sandbox as `목 테스트` only.

Verification:
- Actual run completed with `VN_MAKER_ALPHA_SANDBOX` unset.
- `node packages/cli/dist/index.js codex-auth-status` returned `ok: true`, `session.connected: true`, `mode: "chatgpt"`, and `capabilities.imageGeneration: true`.
- CLI `create-project`, `create-image-job`, and `run-generation-jobs` completed for `/tmp/vn-maker-actual-background-202605222040.vnmaker`.
- Generated asset `asset-actual-background` has `kind: "background"`, `source: "generated"`, and image URI metadata.
- The project has exactly one generated background asset and `scene-opening.backgroundAssetId === "asset-actual-background"`.
- Browser sandbox happy path remains recorded separately as `목 테스트`.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add packages/engine-core/src/index.ts packages/generation-codex/src/index.ts packages/project-store/src/index.ts packages/use-cases/src/index.ts packages/cli/src/index.ts apps/web/src/server/handlers.ts apps/web/src/client/pages/projects/ProjectDetailView.tsx apps/web/src/client/pages/projects/projectPageTypes.ts tests/vn-maker-domain.test.mjs tests/vn-maker-use-cases.test.mjs tests/vn-maker-alpha-sandbox.test.mjs tests/vn-maker-regression.test.mjs tests/vn-maker-alpha-shell.test.mjs docs/qa/issue-24-background-route.md docs/superpowers/plans/2026-05-22-issue-24-background-generation.md
git commit -m "feat: implement issue 24 background generation"
git push
```

- [ ] **Step 4: Update GitHub Issue #24**

Post done/partial/not done, actual vs mock imageGeneration status, verification commands, commit SHA, and push status to #24.
