# Issue 20 Common Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Web/API/CLI share the same project-management use cases, failure envelopes, deletion policy DTOs, and `background` image-generation contract before UI work starts.

**Architecture:** `engine-core` owns schema and pure project mutation, `project-store` owns filesystem/SQLite operations, `use-cases` owns action DTOs and policies, CLI/Web API stay thin adapters, and the React client consumes a safe API envelope without owning domain decisions.

**Tech Stack:** TypeScript workspaces, Node ESM tests, Hono Web API, Vite React client API helpers, SQLite project-store, Codex app-server generation adapter.

---

## Required Boundary Audit

Before committing this issue, verify these DTO owners and transport mappings in code review:

| Surface | Owner | Thin Adapters |
| --- | --- | --- |
| Project list and recent restore | `packages/use-cases/src/index.ts` returns recent project DTOs | `/api/projects/recent/list`, `/api/projects/recent/restore`, CLI `list-projects` if present |
| Detail restore/open | `packages/use-cases/src/index.ts` owns project open result and workflow summary | `/api/projects/open`, `/api/projects/reconnect`, CLI `open-project` if present |
| Recent remove | `packages/use-cases/src/index.ts` returns `deletionPolicy.mode === "recentIndexOnly"` | `/api/projects/recent/remove` |
| Local project delete | `packages/use-cases/src/index.ts` decides policy; `packages/project-store/src/index.ts` performs verified filesystem delete | `/api/projects/delete`, CLI `delete-project` |
| Heroine snapshot | `packages/use-cases/src/index.ts` owns snapshot assignment/open result | Web API/CLI only pass input and return use-case DTO |
| Background generation | `packages/use-cases/src/index.ts` owns job/result DTO; `packages/generation-codex/src/index.ts` owns Codex `imageGeneration` adapter input | `/api/generation/images`, `/api/generation/jobs`, `/api/generation/jobs/run`, CLI `generate-image`, `create-image-job`, `run-generation-jobs` |
| Preview | `packages/use-cases/src/index.ts` owns readiness and validation result | `/api/project/preview`, CLI `preview` |
| Export | `packages/use-cases/src/index.ts` owns export plan and core validation summary | `/api/project/export`, CLI `export-web` |

No React component, API handler, or CLI command should recompute domain state, deletion safety, generation policy, preview readiness, or export readiness.

### Task 1: Background Image Job Core Contract

**Files:**
- Modify: `packages/engine-core/src/index.ts`
- Modify: `tests/vn-maker-domain.test.mjs`

- [x] **Step 1: Write the failing domain test**

Append this assertion after the existing `generationJob` test in `tests/vn-maker-domain.test.mjs`:

```js
const backgroundJob = core.createImageGenerationJob({
  id: "job-domain-background",
  kind: "background",
  targetId: starter.id,
  prompt: "after school classroom background",
  outputAssetId: "asset-domain-background"
});
assert.equal(backgroundJob.kind, "background");
assert.equal(backgroundJob.outputAssetId, "asset-domain-background");

const parsedBackgroundJob = core.parseVnMakerProject({
  ...starter,
  generationJobs: [backgroundJob],
  assets: [{
    id: "asset-domain-background",
    kind: "background",
    label: "도메인 배경",
    uri: "/generated-assets/asset-domain-background.png",
    source: "generated",
    generationJobId: "job-domain-background"
  }]
});
assert.equal(parsedBackgroundJob.ok, true);
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
npm run build -w @vn-maker/engine-core && node tests/vn-maker-domain.test.mjs
```

Expected: FAIL with unsupported image generation kind `background`.

- [x] **Step 3: Add background to core image job schema**

In `packages/engine-core/src/index.ts`, update:

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

export interface CreateImageGenerationJobInput {
  id: string;
  kind: Extract<GenerationJobKind, "portrait" | "expression" | "cg" | "background">;
  targetId: string;
  prompt: string;
  style?: string;
  outputAssetId?: string;
}
```

Also update `parseCreateImageGenerationJobInput()` so the allowed list is:

```ts
["portrait", "expression", "cg", "background"]
```

- [x] **Step 4: Run test to verify GREEN**

Run:

```bash
npm run build -w @vn-maker/engine-core && node tests/vn-maker-domain.test.mjs
```

Expected: PASS.

### Task 2: Shared Generation Use-Case Contract

**Files:**
- Modify: `packages/use-cases/src/index.ts`
- Modify: `packages/generation-codex/src/index.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-alpha-sandbox.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`

- [x] **Step 1: Write the failing use-case assertions**

Append near the existing `generatedPortrait` assertions in `tests/vn-maker-use-cases.test.mjs`:

```js
const plannedBackground = await useCases.createGenerationJob({
  projectDirectory,
  id: "job-usecase-background",
  kind: "background",
  targetId: created.project.id,
  prompt: "library classroom at sunset",
  outputAssetId: "asset-usecase-background"
});
assert.equal(plannedBackground.ok, true);
assert.equal(plannedBackground.job.kind, "background");

const generatedBackground = await useCases.generateImage({
  projectDirectory,
  kind: "background",
  targetId: created.project.id,
  prompt: "library classroom at sunset",
  outputAssetId: "asset-direct-background"
});
assert.equal(generatedBackground.ok, true);
assert.equal(generatedBackground.asset.kind, "background");
assert.equal(generatedBackground.job.kind, "background");
assert.equal(generatedBackground.project.assets.some((asset) => asset.kind === "background"), true);
```

Add Web API and CLI background assertions to `tests/vn-maker-alpha-sandbox.test.mjs`:

```js
const apiBackgroundImage = await sandboxApi({
  method: "POST",
  path: "/api/generation/images",
  body: {
    projectDirectory: apiProjectDirectory,
    kind: "background",
    targetId: apiProject.body.project.id,
    prompt: "shared API background",
    outputAssetId: "asset-api-direct-background"
  }
});
assert.equal(apiBackgroundImage.status, 200);
assert.equal(apiBackgroundImage.body.asset.kind, "background");
assert.equal(apiBackgroundImage.body.job.kind, "background");

const cliGenerateBackground = JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", "generate-image"], {
  input: JSON.stringify({
    projectDirectory: cliProjectDirectory,
    kind: "background",
    targetId: cliProject.project.id,
    prompt: "shared CLI background",
    outputAssetId: "asset-cli-direct-background"
  }),
  encoding: "utf8",
  env: { ...process.env, VN_MAKER_ALPHA_SANDBOX: "1" }
}));
assert.equal(cliGenerateBackground.ok, true);
assert.equal(cliGenerateBackground.asset.kind, "background");
assert.equal(cliGenerateBackground.job.kind, "background");
```

Add a Codex adapter contract assertion to `tests/vn-maker-regression.test.mjs`:

```js
assert.match(
  readText("packages/generation-codex/src/index.ts"),
  /type:\\s*"imageGeneration"/,
  "Codex adapter must keep using app-server imageGeneration items."
);
assert.match(
  readText("packages/generation-codex/src/index.ts"),
  /background/,
  "Codex image kind must include background."
);
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && VN_MAKER_ALPHA_SANDBOX=1 node tests/vn-maker-alpha-sandbox.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: FAIL because `selectGenerationInput()`, Web API, CLI, or adapter typing rejects `background`.

- [x] **Step 3: Update shared use-case and Codex adapter types**

In `packages/use-cases/src/index.ts`, update `ProjectImageGenerationInput.kind` to:

```ts
kind: Extract<VnMakerAsset["kind"], "portrait" | "expression" | "cg" | "background">;
```

In `selectGenerationInput()`, allow background:

```ts
if (!["portrait", "expression", "cg", "background"].includes(kind)) {
  throw new InputValidationError("image.kind 입력이 올바르지 않습니다.", [
    { severity: "error", path: "kind", message: `지원하지 않는 이미지 종류입니다: ${String(kind)}` }
  ]);
}
```

In `packages/generation-codex/src/index.ts`, update `CodexImageKind` to include `background` while preserving the app-server request item:

```ts
type CodexImageKind = "portrait" | "expression" | "cg" | "background";
```

The adapter request must continue to send a Codex app-server item with:

```ts
type: "imageGeneration"
```

Wire the existing Web API route `/api/generation/images` and CLI command `generate-image` to the same `generateImage()` use case. Do not add a background-only domain branch in the handler or CLI.

- [x] **Step 4: Run use-case test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && VN_MAKER_ALPHA_SANDBOX=1 node tests/vn-maker-alpha-sandbox.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: PASS.

### Task 3: Safe Client API Envelope

**Files:**
- Modify: `apps/web/src/client/api/types.ts`
- Modify: `apps/web/src/client/api/client.ts`
- Modify: `tests/vn-maker-regression.test.mjs`

- [x] **Step 1: Write failing bundled client API tests**

In `tests/vn-maker-regression.test.mjs`, after the existing esbuild setup for `client-api.mjs`, add:

```js
await esbuild({
  entryPoints: ["apps/web/src/client/api/client.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: bundledClientApiPath
});
const clientApi = await import(pathToFileURL(bundledClientApiPath).href);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, project: { id: "json-ok" } }), {
    headers: { "content-type": "application/json" },
    status: 200
  });
  const jsonOk = await clientApi.postJson("/api/json-ok", {});
  assert.equal(jsonOk.ok, true);
  assert.equal(jsonOk.project.id, "json-ok");

  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    code: "PROJECT_INPUT_INVALID",
    message: "입력 오류",
    error: "title is required",
    retryable: false,
    userSummary: "프로젝트 정보를 확인해 주세요.",
    technicalDetail: "title is required",
    nextAction: "필수 입력을 채운 뒤 다시 시도하세요."
  }), {
    headers: { "content-type": "application/json" },
    status: 400
  });
  const json4xx = await clientApi.postJson("/api/json-4xx", {});
  assert.equal(json4xx.ok, false);
  assert.equal(json4xx.code, "PROJECT_INPUT_INVALID");
  assert.equal(json4xx.httpStatus, 400);
  assert.equal(json4xx.retryable, false);
  assert.equal(json4xx.nextAction, "필수 입력을 채운 뒤 다시 시도하세요.");

  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    code: "SERVER_ERROR",
    message: "서버 오류",
    retryable: true,
    userSummary: "잠시 후 다시 시도해 주세요.",
    technicalDetail: "boom",
    nextAction: "다시 시도"
  }), {
    headers: { "content-type": "application/json" },
    status: 503
  });
  const json5xx = await clientApi.postJson("/api/json-5xx", {});
  assert.equal(json5xx.ok, false);
  assert.equal(json5xx.httpStatus, 503);
  assert.equal(json5xx.retryable, true);
  assert.equal(json5xx.userSummary, "잠시 후 다시 시도해 주세요.");

  globalThis.fetch = async () => new Response("", { status: 204 });
  const emptyResult = await clientApi.postJson("/api/empty", {});
  assert.equal(emptyResult.ok, false);
  assert.equal(emptyResult.code, "EMPTY_RESPONSE");
  assert.equal(emptyResult.retryable, true);
  assert.equal(emptyResult.nextAction, "요청을 다시 시도하세요.");

  globalThis.fetch = async () => new Response("<html>fail</html>", { status: 502 });
  const nonJsonResult = await clientApi.postJson("/api/non-json", {});
  assert.equal(nonJsonResult.ok, false);
  assert.equal(nonJsonResult.code, "NON_JSON_RESPONSE");
  assert.equal(nonJsonResult.httpStatus, 502);
  assert.equal(nonJsonResult.userSummary, "서버 응답을 해석하지 못했습니다.");

  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const networkResult = await clientApi.postJson("/api/network", {});
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.code, "NETWORK_ERROR");
  assert.equal(networkResult.retryable, true);
  assert.equal(networkResult.technicalDetail, "fetch failed");

  globalThis.fetch = async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  };
  const abortResult = await clientApi.postJson("/api/abort", {});
  assert.equal(abortResult.ok, false);
  assert.equal(abortResult.code, "REQUEST_ABORTED");
  assert.equal(abortResult.retryable, false);

  globalThis.fetch = async () => new Response("", { status: 204 });
  const codexSessionResult = await clientApi.readCodexSession();
  assert.equal(codexSessionResult.ok, false);
  assert.equal(codexSessionResult.code, "EMPTY_RESPONSE");
} finally {
  globalThis.fetch = originalFetch;
}
```

- [x] **Step 2: Run regression test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-regression.test.mjs
```

Expected: FAIL because `postJson()` throws on network and abort errors and does not set stable error codes.

- [x] **Step 3: Extend `ApiResult` and parser helpers**

In `apps/web/src/client/api/types.ts`, add:

```ts
export type ApiFailureCode =
  | "EMPTY_RESPONSE"
  | "NON_JSON_RESPONSE"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "REQUEST_ABORTED";
```

Update `ApiResult.code?: ApiFailureCode | string` and add optional display/debug fields:

```ts
userSummary?: string;
technicalDetail?: string;
nextAction?: string;
```

In `apps/web/src/client/api/client.ts`, make one shared `responseToApiResult()` parse path handle `postJson()` and `readCodexSession()`. For empty, nonJSON, JSON 4xx, JSON 5xx, network, and abort responses it must return `{ ok: false, code, message, error, userSummary, technicalDetail, nextAction, retryable, httpStatus }`. Wrap the `fetch()` call in `postJson()` and `readCodexSession()`:

```ts
try {
  const response = await fetch(path, options);
  return await responseToApiResult<T>(response);
} catch (error) {
  const aborted = error instanceof DOMException && error.name === "AbortError";
  return {
    ok: false,
    code: aborted ? "REQUEST_ABORTED" : "NETWORK_ERROR",
    error: aborted ? "요청이 취소되었습니다." : error instanceof Error ? error.message : String(error),
    message: aborted ? "요청이 취소되었습니다." : "네트워크 오류로 API 요청에 실패했습니다.",
    userSummary: aborted ? "요청이 취소되었습니다." : "네트워크 연결을 확인해 주세요.",
    technicalDetail: error instanceof Error ? error.message : String(error),
    nextAction: aborted ? "필요하면 다시 실행하세요." : "네트워크 상태를 확인한 뒤 다시 시도하세요.",
    retryable: !aborted
  } as T;
}
```

- [x] **Step 4: Run regression test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-regression.test.mjs
```

Expected: PASS.

### Task 4: Project Deletion Policy DTO Boundary

**Files:**
- Modify: `packages/use-cases/src/index.ts`
- Modify: `packages/project-store/src/index.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-regression.test.mjs`

- [x] **Step 1: Write failing use-case/API/CLI assertions**

Add to `tests/vn-maker-use-cases.test.mjs` after recent-project removal tests:

```js
assert.equal(removedRecentProject.deletionPolicy.mode, "recentIndexOnly");
assert.equal(removedRecentProject.deletionPolicy.reversible, true);
assert.equal(existsSync(join(projectDirectory, "project.sqlite")), true);
```

Add a temp local delete case:

```js
const deleteTargetDirectory = join(tempRoot, "DeleteProject.vnmaker");
const deleteTarget = await useCases.createProject({
  projectDirectory: deleteTargetDirectory,
  starter: { id: "delete-project", title: "삭제 대상", premise: "삭제 정책 검증" }
});
const blockedDelete = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  projectId: "delete-project",
  confirmTitle: "틀린 제목",
  deleteFiles: true
});
assert.equal(blockedDelete.ok, false);
assert.equal(blockedDelete.code, "PROJECT_INPUT_INVALID");
const deletedProject = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  projectId: deleteTarget.project.id,
  confirmTitle: deleteTarget.project.title,
  deleteFiles: true
});
assert.equal(deletedProject.ok, true);
assert.equal(deletedProject.deletionPolicy.mode, "localProjectFiles");
assert.equal(deletedProject.deletionPolicy.reversible, false);
assert.equal(existsSync(join(deleteTargetDirectory, "project.sqlite")), false);
```

Add Web API and CLI assertions to `tests/vn-maker-regression.test.mjs`:

```js
const apiDeleteDirectory = join(tempRoot, "Issue20ApiDelete.vnmaker");
const apiDeleteCreate = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/projects",
  body: { projectDirectory: apiDeleteDirectory, starter: { id: "issue20-api-delete", title: "Issue 20 API 삭제", premise: "삭제 계약" } }
});
assert.equal(apiDeleteCreate.status, 200);
const apiDeleteResult = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/projects/delete",
  body: { projectDirectory: apiDeleteDirectory, projectId: "issue20-api-delete", confirmTitle: "Issue 20 API 삭제", deleteFiles: true }
});
assert.equal(apiDeleteResult.status, 200);
assert.equal(apiDeleteResult.body.deletionPolicy.mode, "localProjectFiles");

const cliDeleteDirectory = join(tempRoot, "Issue20CliDelete.vnmaker");
const cliCreated = JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", "create-project"], {
  input: JSON.stringify({
    projectDirectory: cliDeleteDirectory,
    starter: { id: "issue20-cli-delete", title: "Issue 20 CLI 삭제", premise: "CLI 삭제 계약" }
  }),
  encoding: "utf8"
}));
assert.equal(cliCreated.ok, true);
const cliDeleted = JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", "delete-project"], {
  input: JSON.stringify({
    projectDirectory: cliDeleteDirectory,
    projectId: "issue20-cli-delete",
    confirmTitle: "Issue 20 CLI 삭제",
    deleteFiles: true
  }),
  encoding: "utf8"
}));
assert.equal(cliDeleted.ok, true);
assert.equal(cliDeleted.deletionPolicy.mode, "localProjectFiles");
```

- [x] **Step 2: Run use-case test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: FAIL because `deleteProjectWorkspace()` and deletion policy DTOs do not exist.

- [x] **Step 3: Implement the use case and transport adapters**

In `packages/use-cases/src/index.ts`, add `deleteProjectWorkspace` to `MakerActionId` and return policy DTOs:

```ts
deletionPolicy: {
  mode: "recentIndexOnly" | "localProjectFiles";
  reversible: boolean;
  impact: string[];
}
```

The local file delete path must require:

```ts
projectId === project.id
confirmTitle === project.title
deleteFiles === true
```

The use case decides whether deletion is allowed, then delegates filesystem deletion to `packages/project-store/src/index.ts`. Add a project-store function such as `deleteLocalProjectDirectory()` with these safety conditions:

```ts
const resolvedProjectDirectory = await realpath(projectDirectory);
const resolvedRoot = await realpath(dirname(projectDirectory));
if (!basename(resolvedProjectDirectory).endsWith(".vnmaker")) throw new Error("Unsafe project directory name.");
if (!resolvedProjectDirectory.startsWith(`${resolvedRoot}${sep}`)) throw new Error("Unsafe project directory scope.");
if (resolvedProjectDirectory === resolvedRoot || resolvedProjectDirectory === homedir() || resolvedProjectDirectory === sep) throw new Error("Unsafe project directory target.");
if (!existsSync(join(resolvedProjectDirectory, "project.sqlite"))) throw new Error("Project database is required before local delete.");
await rm(resolvedProjectDirectory, { recursive: true, force: false });
```

Do not call `rm()` directly from the use-case, CLI, API handler, or React client. Do not use `force: true`; delete failures must become a failure envelope so the UI can show retry guidance.

Wire CLI command `delete-project` and Web API route `/api/projects/delete` to the same use case.

- [x] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: PASS.

### Task 5: Commit and Push Issue 20

**Files:**
- All files modified in Tasks 1-4
- This plan file

- [x] **Step 1: Run required verification**

Run:

```bash
npm run typecheck
npm run test:maker
git diff --check
git status --short --branch
```

Expected: all checks pass and only #20 files plus the plan are staged.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add packages/engine-core/src/index.ts packages/use-cases/src/index.ts packages/project-store/src/index.ts packages/generation-codex/src/index.ts packages/cli/src/index.ts apps/web/src/server/handlers.ts apps/web/src/client/api/types.ts apps/web/src/client/api/client.ts tests/vn-maker-domain.test.mjs tests/vn-maker-use-cases.test.mjs tests/vn-maker-alpha-sandbox.test.mjs tests/vn-maker-regression.test.mjs docs/superpowers/plans/2026-05-22-issue-20-common-contracts.md
git commit -m "feat: define issue 20 project management contracts"
git push -u origin feature/issue-27-alpha-project-management
```

- [ ] **Step 3: Update GitHub Issue #20**

Post a comment to #20 with implemented contract changes, verification commands, commit SHA, and push status.
