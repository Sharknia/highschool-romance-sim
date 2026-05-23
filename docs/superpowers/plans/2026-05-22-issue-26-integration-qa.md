# Issue 26 Integration QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove #20-#25 satisfy the Notion and #27 acceptance criteria with typecheck, tests, CLI/API happy paths, browser responsive QA, issue comments, push evidence, and honest actual-vs-mock imageGeneration reporting.

**Architecture:** Add a lightweight QA evidence artifact under `docs/qa/`, use existing maker tests for repeatable coverage, run the web app locally for browser checks, and record gaps directly in GitHub issues without counting mock generation as real Codex app-server success.

**Tech Stack:** npm scripts, Node CLI, Web API request handler, Vite dev server, browser automation, GitHub issue comments.

---

### Task 1: Acceptance Coverage Audit

**Files:**
- Create: `docs/qa/issue-27-alpha-project-management.md`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write QA source assertions**

In `tests/vn-maker-alpha-shell.test.mjs`, ensure the code has the final IA:

```js
["overview", "heroine", "background", "studio", "preview", "export"].forEach((tab) => {
  assert.match(projectPageTypesSource, new RegExp(`id: "${tab}"`), `${tab} 탭이 최종 IA에 있어야 합니다.`);
});
const finalDetailTabsBlock = projectPageTypesSource.match(/export const detailTabs = \\[[\\s\\S]*?\\] as const;/)?.[0] || "";
["event", "assets"].forEach((legacyTab) => {
  assert.doesNotMatch(finalDetailTabsBlock, new RegExp(`id: "${legacyTab}"`), `${legacyTab} 탭은 최종 IA에 없어야 합니다.`);
});
assert.match(projectStartSource, /DeleteConfirmDialog/, "프로젝트 삭제 확인은 공통 DeleteConfirmDialog로 연결되어야 합니다.");
assert.doesNotMatch(projectStartSource, /ProjectDeleteDialog/, "프로젝트 전용 삭제 모달을 새로 만들면 안 됩니다.");
assert.match(projectDetailViewSource, /TabList/, "프로젝트 상세는 중앙 탭 컴포넌트를 사용해야 합니다.");
```

- [ ] **Step 2: Run shell test**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Create QA evidence file**

Create `docs/qa/issue-27-alpha-project-management.md` with sections:

```md
# Issue 27 Alpha Project Management QA

## Scope
- Parent: #27
- Sub-issues: #20, #21, #22, #23, #24, #25, #26
- This file is the evidence artifact for #26 and the consolidated verification record for #27.

## Acceptance Checklist
| Requirement | Evidence | Result |
| --- | --- | --- |
| #20 safe API envelope covers JSON, empty, nonJSON, network, abort, 4xx, and 5xx | tests | not-run |
| #20 Web/API/CLI share project deletion and generation use cases | source/API/CLI | not-run |
| Existing app project menu entry is kept and no new project-management menu entry is added | source/browser | not-run |
| `/projects` opens on a project list using the central `ContentList` component | source/browser | not-run |
| Project list cards show 저장 위치, 현재 상태, 상태 요약, 최근 수정, 마지막 작업 시각 | source/browser | not-run |
| Project list delete confirmation uses shared `DeleteConfirmDialog` | source/browser | not-run |
| Delete confirmation shows impact, reversibility, and retry/failure state | source/browser/API | not-run |
| Recent-list removal is reversible and does not delete local files | use-case/API/browser | not-run |
| Local project delete is confirmed by title and is irreversible | use-case/API/browser | not-run |
| `/projects/:projectId` lands on overview | browser/source | not-run |
| Project detail has tabs overview, heroine, background, studio, preview, export | source/browser | not-run |
| Project detail uses central `TabList` | source/browser | not-run |
| Heroine tab edits project snapshot only, not library original | use-case/browser | not-run |
| Heroine tab shows snapshot/original fields and last modified/save status | source/browser | not-run |
| Background generation enforces one generated background per project | use-case/API/CLI | not-run |
| Generated background asset is linked through scene `backgroundAssetId` | use-case/API/CLI | not-run |
| `/projects/:projectId/background` direct URL, reload, and tab URL sync work | browser | not-run |
| Studio shows under-construction state without fake buttons/progress | source/browser | not-run |
| Preview happy path is prepared/ready and shows blockers when blocked | API/CLI/browser | not-run |
| Preview/export errors keep header and tab bar visible | browser/API | not-run |
| Export happy path includes target, data/assets, and validation summary | API/CLI/browser | not-run |
| Export blocked/failed states are not displayed as complete | API/CLI/browser | not-run |
| GitHub Pages, gh-pages, and single `index.html` export are excluded as current targets | source/export DTO | not-run |
| CLI happy path uses temp directory and JSON stdin with `ok: true` outputs | CLI | not-run |
| API happy path is verified through handler and local HTTP route evidence | API/HTTP | not-run |
| Browser QA compares `/projects` and `/heroines` at 390x844, 768x1024, 1440x900 | browser | not-run |
| Frontend empty, nonJSON, and 5xx API error states render retry/next action without throwing | browser/tests | not-run |
| Actual Codex app-server ChatGPT managed OAuth `imageGeneration` is verified, or #24/#27 remain partial with exact reason | actual/sandbox report | not-run |

## Completed
- [ ] #20 common contracts
- [ ] #21 project list/delete
- [ ] #22 detail tabs overview/heroine
- [ ] #23 studio under construction
- [ ] #24 background generation
- [ ] #25 preview/export

## Verification Commands
| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | not-run |  |
| `npm run test:maker` | not-run |  |
| CLI happy path | not-run |  |
| API happy path | not-run |  |
| Browser QA 390x844 | not-run |  |
| Browser QA 768x1024 | not-run |  |
| Browser QA 1440x900 | not-run |  |
| Frontend empty response state | not-run |  |
| Frontend nonJSON response state | not-run |  |
| Frontend 5xx response state | not-run |  |

## Image Generation
- Actual Codex app-server imageGeneration: not-run
- Alpha sandbox generation: not-run, counted only as 목 테스트

## Gaps
- None recorded yet.
```

Do not mark entries complete until commands have run.

### Task 2: CLI/API Happy Path Scripted Evidence

**Files:**
- Modify: `tests/vn-maker-alpha-sandbox.test.mjs`
- Modify: `docs/qa/issue-27-alpha-project-management.md`

- [ ] **Step 1: Confirm test covers happy path**

Ensure `tests/vn-maker-alpha-sandbox.test.mjs` performs:
- create project from heroine;
- assign/list/open project;
- create/run background generation job;
- preview;
- export;
- smoke export;
- CLI equivalent for background, preview, export.
- API handler happy path through `apps/web/src/server/handlers.ts`, not only direct use-case calls.
- Local HTTP/dev-server API happy path if the dev server exposes the route in the current environment.

- [ ] **Step 2: Run sandbox happy path**

Run:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run build:maker
VN_MAKER_ALPHA_SANDBOX=1 node tests/vn-maker-alpha-sandbox.test.mjs
```

Expected: PASS. Record this as `목 테스트`, not real imageGeneration.

- [ ] **Step 3: Run actual CLI commands**

Use a temp project directory and run these JSON stdin commands:

```bash
export VN_MAKER_QA_DIR="$(mktemp -d)/Issue27Cli.vnmaker"
printf '%s\n' '{"id":"qa-heroine","name":"QA Heroine","summary":"Issue 27 QA heroine","personality":"calm","visualPrompt":"school uniform heroine"}' \
  | node packages/cli/dist/index.js create-heroine
printf '%s\n' "{\"projectDirectory\":\"$VN_MAKER_QA_DIR\",\"heroineId\":\"qa-heroine\",\"starter\":{\"id\":\"issue-27-cli\",\"title\":\"Issue 27 CLI\",\"premise\":\"QA\"}}" \
  | node packages/cli/dist/index.js create-project-from-heroine
printf '%s\n' "{\"projectDirectory\":\"$VN_MAKER_QA_DIR\",\"id\":\"job-issue-27-cli-background\",\"kind\":\"background\",\"targetId\":\"issue-27-cli\",\"prompt\":\"bright classroom background\",\"outputAssetId\":\"asset-issue-27-cli-background\"}" \
  | node packages/cli/dist/index.js create-image-job
printf '%s\n' "{\"projectDirectory\":\"$VN_MAKER_QA_DIR\",\"jobIds\":[\"job-issue-27-cli-background\"],\"replaceCompleted\":true}" \
  | VN_MAKER_ALPHA_SANDBOX=1 node packages/cli/dist/index.js run-generation-jobs
printf '%s\n' "{\"projectDirectory\":\"$VN_MAKER_QA_DIR\"}" \
  | node packages/cli/dist/index.js preview
printf '%s\n' "{\"projectDirectory\":\"$VN_MAKER_QA_DIR\"}" \
  | node packages/cli/dist/index.js export-web
```

Expected: every command returns JSON with `ok: true`. Record the output file paths or selected JSON fields: project id, background asset id, `previewReadiness.canRun`, `exportPlan.target`, and `exportPlan.validationSummary.ok`. Use `VN_MAKER_ALPHA_SANDBOX=1` for `run-generation-jobs` only if real Codex app-server generation is unavailable, and record it as `목 테스트`.

- [ ] **Step 4: Run actual API handler commands**

Add or run a small Node script against `apps/web/src/server/handlers.ts` that calls:

```js
await webHandlers.handleApiRequest({ method: "POST", path: "/api/projects/from-heroine", body: { projectDirectory, heroineId, starter } });
await webHandlers.handleApiRequest({ method: "POST", path: "/api/generation/jobs", body: { projectDirectory, id: "job-api-background", kind: "background", targetId: starter.id, prompt, outputAssetId: "asset-api-background" } });
await webHandlers.handleApiRequest({ method: "POST", path: "/api/generation/jobs/run", body: { projectDirectory, jobIds: ["job-api-background"], replaceCompleted: true } });
await webHandlers.handleApiRequest({ method: "POST", path: "/api/project/preview", body: { projectDirectory } });
await webHandlers.handleApiRequest({ method: "POST", path: "/api/project/export", body: { projectDirectory } });
```

Expected: each handler response has HTTP status 200 and body `ok: true`. Record this separately from CLI evidence.

- [ ] **Step 5: Run local HTTP API happy path**

With the dev server running, exercise the same route family through HTTP, not only direct handler calls:

```bash
curl -sS -X POST "$VN_MAKER_WEB_URL/api/projects/from-heroine" -H 'content-type: application/json' -d "{\"projectDirectory\":\"$VN_MAKER_API_DIR\",\"heroineId\":\"qa-heroine\",\"starter\":{\"id\":\"issue-27-api\",\"title\":\"Issue 27 API\",\"premise\":\"QA\"}}"
curl -sS -X POST "$VN_MAKER_WEB_URL/api/generation/jobs" -H 'content-type: application/json' -d "{\"projectDirectory\":\"$VN_MAKER_API_DIR\",\"id\":\"job-issue-27-api-background\",\"kind\":\"background\",\"targetId\":\"issue-27-api\",\"prompt\":\"bright classroom background\",\"outputAssetId\":\"asset-issue-27-api-background\"}"
curl -sS -X POST "$VN_MAKER_WEB_URL/api/generation/jobs/run" -H 'content-type: application/json' -d "{\"projectDirectory\":\"$VN_MAKER_API_DIR\",\"jobIds\":[\"job-issue-27-api-background\"],\"replaceCompleted\":true}"
curl -sS -X POST "$VN_MAKER_WEB_URL/api/project/preview" -H 'content-type: application/json' -d "{\"projectDirectory\":\"$VN_MAKER_API_DIR\"}"
curl -sS -X POST "$VN_MAKER_WEB_URL/api/project/export" -H 'content-type: application/json' -d "{\"projectDirectory\":\"$VN_MAKER_API_DIR\"}"
```

Expected: each response parses as JSON with `ok: true`; preview includes `previewReadiness.canRun === true`; export includes `exportPlan.target === "localDesktopWebApp"` and `exportPlan.validationSummary.ok === true`. Record the URL, command status, and selected JSON fields in the QA file.

- [ ] **Step 6: Update QA file**

Record exact commands and PASS/FAIL status in `docs/qa/issue-27-alpha-project-management.md`.

### Task 3: Browser Responsive QA

**Files:**
- Modify: `docs/qa/issue-27-alpha-project-management.md`

- [ ] **Step 1: Start local web app**

Run:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

Keep the session running until browser QA completes. Use the shown local URL.

- [ ] **Step 2: Verify desktop/tablet/mobile flows**

At `390x844`, `768x1024`, and `1440x900`, verify:
- `/projects` opens on the project list;
- project detail opens;
- delete confirmation shows impact/reversibility;
- tabs `overview`, `heroine`, `background`, `studio`, `preview`, `export` switch without losing header/tab bar;
- `/heroines` and `/projects` list density, button hierarchy, empty/error/loading patterns match visibly.
- screenshot or note `/heroines` and `/projects` at the same viewport width before moving to the next width.
- intentionally trigger frontend API empty, nonJSON, and 5xx states for project list or preview/export and verify the UI shows an error banner with retry/next action while retaining the header and tab bar.

- [ ] **Step 3: Capture evidence**

Record viewport, URL, result, and any console errors in `docs/qa/issue-27-alpha-project-management.md`. If screenshots are captured by the browser tool, include screenshot paths or tool references in the notes, with paired `/heroines` and `/projects` evidence at each width.

### Task 4: Full Verification And Issue Comments

**Files:**
- Modify: `docs/qa/issue-27-alpha-project-management.md`
- GitHub Issues: #20-#27

- [ ] **Step 1: Run required commands**

Run:

```bash
npm run typecheck
npm run test:maker
git diff --check
git status --short --branch
```

Expected: PASS.

- [ ] **Step 2: Check actual Codex imageGeneration**

If a real Codex app-server OAuth session is available, run a real background generation happy path through Web/API or CLI and record it as actual. If not available, record:

```md
Actual Codex app-server imageGeneration: not completed because <environment reason>.
Alpha sandbox generation: passed, 목 테스트 only.
```

Do not close #24/#27 as fully complete if actual imageGeneration remains unverified.

- [ ] **Step 3: Post issue comments**

For each sub-issue #20-#26, post:
- done;
- partial implementation;
- not done;
- verification commands;
- commit SHA;
- push status.

For #27 before PR creation, post the consolidated QA summary without a PR link. After the PR is created, add a separate #27 comment with the PR URL and review-request status.

### Task 5: Commit and Push Issue 26

**Files:**
- `docs/qa/issue-27-alpha-project-management.md`
- Any test updates from Tasks 1-2
- This plan file

- [ ] **Step 1: Commit and push**

Run:

```bash
git add docs/qa/issue-27-alpha-project-management.md tests/vn-maker-alpha-shell.test.mjs tests/vn-maker-alpha-sandbox.test.mjs docs/superpowers/plans/2026-05-22-issue-26-integration-qa.md
git commit -m "test: verify issue 26 project management QA"
git push
```

- [ ] **Step 2: Request final code review**

Use `superpowers:requesting-code-review` with base `origin/main` and current HEAD. Fix Critical/Important findings under `superpowers:receiving-code-review`, commit, push, then create the PR.
