# Issue 21 Project List And Delete Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/projects` open on a project list using central list patterns, with detail open, recent-entry removal, and local project deletion confirmation that matches heroine management density and state handling.

**Architecture:** Keep `ContentList` as the central list renderer, extract project API boundaries from `ProjectStartPage`, use a shared delete-confirmation UI component instead of a project-only modal, and let #20's use-case deletion policy describe the difference between recent-list removal and local file deletion.

**Tech Stack:** React, React Router, lucide-react, shared UI components, Web API `/api/projects/*`, Node source-contract tests.

---

### Task 1: Project List Source Contract

**Files:**
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Modify: `apps/web/src/client/pages/projects/RecentProjectList.tsx`
- Create: `apps/web/src/client/pages/projects/projectApi.ts`
- Modify: `apps/web/src/client/pages/ProjectStartPage.tsx`

- [x] **Step 1: Write failing source-contract tests**

In `tests/vn-maker-alpha-shell.test.mjs`, replace the old project-list assertions with:

```js
const projectApiPath = "apps/web/src/client/pages/projects/projectApi.ts";
assert.ok(existsSync(join(root, projectApiPath)), "프로젝트 API 호출은 projectApi.ts 경계로 분리해야 합니다.");
const projectApiSource = readText(projectApiPath);
[
  "/api/projects/recent/list",
  "/api/projects/recent/remove",
  "/api/projects/recent/restore",
  "/api/projects/delete",
  "/api/projects/open",
  "/api/projects/reconnect"
].forEach((apiPath) => {
  assert.match(projectApiSource, new RegExp(apiPath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")), `${apiPath} 프로젝트 API wrapper가 있어야 합니다.`);
});

assert.match(recentProjectListSource, /ContentList/, "프로젝트 목록은 중앙 ContentList를 사용해야 합니다.");
assert.match(projectStartSource, /type ProjectListState = "loading" \\| "empty" \\| "ready" \\| "error" \\| "deleting"/, "프로젝트 목록은 명시적 상태 머신을 사용해야 합니다.");
assert.doesNotMatch(projectStartSource, /샘플 프로젝트 생성/, "프로젝트 관리 첫 화면은 샘플 생성 중심이면 안 됩니다.");
assert.doesNotMatch(appSource, /to="\/project-management"|프로젝트 관리 메뉴/, "새 프로젝트 관리 메뉴 항목을 추가하면 안 됩니다.");
const workspaceLayoutSource = readText("apps/web/src/client/components/WorkspaceLayout.tsx");
assert.deepEqual([...workspaceLayoutSource.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]), ["/heroines", "/projects", "/settings"], "WorkspaceLayout nav에 새 프로젝트 관리 메뉴를 추가하면 안 됩니다.");
[
  "프로젝트 목록을 불러오는 중입니다.",
  "아직 최근 프로젝트가 없습니다.",
  "프로젝트 목록을 불러오지 못했습니다.",
  "상세보기",
  "상세보기 버튼",
  "저장 위치",
  "현재 상태",
  "상태 요약",
  "최근 수정",
  "마지막 작업 시각",
  "삭제",
  "목록에서만 제거",
  "프로젝트 파일까지 삭제",
  "다시 시도",
  "로딩",
  "빈 목록",
  "오류",
  "키보드 포커스"
].forEach((text) => assert.match(`${projectStartSource}\n${recentProjectListSource}`, new RegExp(text), `${text} 문구가 있어야 합니다.`));
```

Define `appSource` in the test from `apps/web/src/client/App.tsx`. The existing navigation may keep its current project entry, but this issue must not add a new menu/nav item separate from the existing `/projects` route.

- [x] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL because `projectApi.ts`, state enum, and local delete wording are missing.

- [x] **Step 3: Extract project API wrapper**

Create `apps/web/src/client/pages/projects/projectApi.ts`:

```ts
import type { PostAuthedJson } from "../../auth/AuthProvider";
import type { ProjectApiResult, RecentProject } from "./projectPageTypes";

export function projectFailureText(result: ProjectApiResult, fallback: string): string {
  return result.message || result.error || fallback;
}

export function listRecentProjects(postJson: PostAuthedJson): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/recent/list", {});
}

export function openProject(postJson: PostAuthedJson, body: Record<string, unknown>): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/open", body);
}

export function reconnectProject(postJson: PostAuthedJson, body: Record<string, unknown>): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/reconnect", body);
}

export function removeRecentProject(postJson: PostAuthedJson, entry: RecentProject): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/recent/remove", { projectId: entry.projectId });
}

export function restoreRecentProject(postJson: PostAuthedJson, entry: RecentProject): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/recent/restore", { recentProject: entry });
}

export function deleteProjectFiles(postJson: PostAuthedJson, input: {
  projectDirectory: string;
  projectId: string;
  confirmTitle: string;
}): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/delete", { ...input, deleteFiles: true });
}
```

- [x] **Step 4: Refactor `ProjectStartPage` to use list state**

Add:

```ts
type ProjectListState = "loading" | "empty" | "ready" | "error" | "deleting";
```

Use it for `StatusBanner` tone and render `/projects` with the recent project list as the first substantial panel. Keep manual directory open/reconnect as a secondary `details` or lower-priority panel.

Use the existing `ContentList` component as the central list pattern for this repo. Do not introduce a parallel `ResourceList` abstraction in this issue.

Render state-specific list surfaces:

```tsx
if (listState === "loading") return <StatusBanner tone="info">프로젝트 목록을 불러오는 중입니다. 로딩</StatusBanner>;
if (listState === "empty") return <ContentList emptyText="아직 최근 프로젝트가 없습니다. 빈 목록" items={[]} />;
if (listState === "error") return <StatusBanner tone="danger">프로젝트 목록을 불러오지 못했습니다. 오류 <Button onClick={loadRecentProjects}>다시 시도</Button></StatusBanner>;
```

Ensure each item has a visible primary action labelled `상세보기 버튼`; card click may call the same handler, but the explicit button remains the default action for keyboard and assistive use. Preserve focus outlines with the existing `button:focus-visible` or component class instead of suppressing outlines.

Each project list item must render these fields from `RecentProject` or a derived view model:

```tsx
<dl className="summary-list compact-summary">
  <div><dt>저장 위치</dt><dd>{entry.projectDirectory}</dd></div>
  <div><dt>현재 상태</dt><dd>{entry.exists === false ? "재연결 필요" : "열 수 있음"}</dd></div>
  <div><dt>상태 요약</dt><dd>{entry.summary || entry.title}</dd></div>
  <div><dt>최근 수정</dt><dd>{formatRecentProjectDate(entry.updatedAt)}</dd></div>
  <div><dt>마지막 작업 시각</dt><dd>{formatRecentProjectDate(entry.lastOpenedAt || entry.updatedAt)}</dd></div>
</dl>
```

If `updatedAt`/`lastOpenedAt` is absent, show `기록 없음` rather than leaving the field blank. Add `formatRecentProjectDate()` in `RecentProjectList.tsx` or a tiny local helper and cover it with source/behavior assertions.

- [x] **Step 5: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS for project list source assertions.

### Task 2: Shared Delete Confirmation Component

**Files:**
- Create: `apps/web/src/client/components/ui/DeleteConfirmDialog.tsx`
- Modify: `apps/web/src/client/components/ui/index.ts`
- Modify: `apps/web/src/client/pages/heroines/HeroineDeleteDialog.tsx`
- Modify: `apps/web/src/client/pages/projects/RecentProjectList.tsx`
- Modify: `apps/web/src/client/pages/ProjectStartPage.tsx`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [x] **Step 1: Write failing shared delete-dialog source assertions**

Add to `tests/vn-maker-alpha-shell.test.mjs`:

```js
const deleteConfirmDialogPath = "apps/web/src/client/components/ui/DeleteConfirmDialog.tsx";
assert.ok(existsSync(join(root, deleteConfirmDialogPath)), "공통 삭제 확인 dialog가 있어야 합니다.");
const deleteConfirmDialogSource = readText(deleteConfirmDialogPath);
[
  "영향 범위",
  "되돌릴 수 없음",
  "삭제 실패",
  "다시 시도",
  "confirmationValue.trim() === expectedConfirmation"
].forEach((text) => assert.match(deleteConfirmDialogSource, new RegExp(text), `DeleteConfirmDialog에 ${text} 문구가 있어야 합니다.`));
assert.match(readText("apps/web/src/client/components/ui/index.ts"), /DeleteConfirmDialog/, "중앙 UI index에서 DeleteConfirmDialog를 export해야 합니다.");
assert.match(readText("apps/web/src/client/pages/heroines/HeroineDeleteDialog.tsx"), /DeleteConfirmDialog/, "히로인 삭제 dialog도 공통 삭제 확인 컴포넌트를 사용해야 합니다.");
assert.doesNotMatch(projectStartSource, /ProjectDeleteDialog/, "프로젝트 전용 삭제 모달 파일/컴포넌트를 만들면 안 됩니다.");
```

- [x] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL because `DeleteConfirmDialog.tsx` does not exist and heroine/project delete flows do not use it.

- [x] **Step 3: Implement shared dialog**

Create `apps/web/src/client/components/ui/DeleteConfirmDialog.tsx` with props:

```ts
export interface DeleteConfirmAction {
  label: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  onSelect: (confirmationValue: string) => void;
}

export interface DeleteConfirmDialogProps {
  busy: boolean;
  error?: string;
  expectedConfirmation: string;
  impactItems: Array<{ label: string; value: string }>;
  intro: string;
  title: string;
  confirmationLabel: string;
  confirmationHint: string;
  primaryAction: DeleteConfirmAction;
  secondaryActions?: DeleteConfirmAction[];
  retryAction?: DeleteConfirmAction;
  onClose: () => void;
}
```

Render:

```tsx
<section aria-modal="true" className="delete-dialog" role="dialog">
  <h2>{title}</h2>
  <p>{intro}</p>
  <dl className="summary-list detail-summary">
    {impactItems.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>
  <p>영향 범위</p>
  <p>되돌릴 수 없음</p>
  <input onChange={(event) => setConfirmationValue(event.target.value)} value={confirmationValue} />
  <p>{confirmationHint}</p>
  {error ? <div className="inline-status warning">삭제 실패: {error}{retryAction ? <Button onClick={() => retryAction.onSelect(confirmationValue)}>다시 시도</Button> : null}</div> : null}
  <Button disabled={busy || confirmationValue.trim() !== expectedConfirmation || primaryAction.disabled} onClick={() => primaryAction.onSelect(confirmationValue.trim())}>
    {primaryAction.label}
  </Button>
</section>
```

Export it from `apps/web/src/client/components/ui/index.ts`.

- [x] **Step 4: Refactor heroine and wire project delete**

Refactor `HeroineDeleteDialog.tsx` to render `DeleteConfirmDialog` with the existing heroine-specific title/copy. Do not change heroine deletion behavior.

In `ProjectStartPage.tsx`, render the shared dialog directly when `deleteTarget` is set:

```tsx
<DeleteConfirmDialog
  busy={busy}
  error={deleteError}
  expectedConfirmation={deleteTarget.title}
  title="삭제할 프로젝트"
  intro="프로젝트 삭제 방식을 선택합니다."
  confirmationLabel="프로젝트 제목"
  confirmationHint="프로젝트 제목을 입력해야 합니다."
  impactItems={[
    { label: "저장 위치", value: deleteTarget.projectDirectory },
    { label: "목록에서만 제거", value: "최근 목록에서만 사라지며 프로젝트 파일은 유지됩니다." },
    { label: "프로젝트 파일까지 삭제", value: "로컬 프로젝트 폴더를 삭제하며 되돌릴 수 없습니다." }
  ]}
  primaryAction={{ label: "프로젝트 파일까지 삭제", onSelect: (confirmTitle) => void deleteProjectFiles(deleteTarget, confirmTitle) }}
  secondaryActions={[{ label: "목록에서만 제거", onSelect: () => void removeRecent(deleteTarget) }]}
  retryAction={deleteError ? { label: "다시 시도", onSelect: (confirmTitle) => void deleteProjectFiles(deleteTarget, confirmTitle) } : undefined}
  onClose={() => setDeleteTarget(null)}
/>
```

Show project-specific copy through props, not through a project-specific modal component:

```tsx
<p>최근 목록에서만 사라지며 프로젝트 파일은 유지됩니다.</p>
<p>로컬 프로젝트 폴더를 삭제하며 되돌릴 수 없습니다.</p>
```

The retry action must re-use the same selected project and confirmation title. It must not remove the list entry after a failed local delete.

- [x] **Step 5: Wire list actions**

In `RecentProjectList.tsx`, expose a low-priority delete action that opens the dialog:

```tsx
<button aria-label={`${entry.title} 삭제`} className="icon-button icon-button-danger" type="button" onClick={() => onRequestDelete(entry)}>
  <Trash2 size={17} aria-hidden="true" />
</button>
```

Keep `상세보기` as the primary action and `삭제` as the danger action.

- [x] **Step 6: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

### Task 3: Delete Flow Behavior And Failure Recovery

**Files:**
- Modify: `apps/web/src/client/pages/ProjectStartPage.tsx`
- Modify: `tests/vn-maker-regression.test.mjs`

- [x] **Step 1: Write failing API behavior assertions**

In `tests/vn-maker-regression.test.mjs`, add an API delete case using the #20 route:

```js
const apiDeleteDirectory = join(tempRoot, "ApiDelete.vnmaker");
const apiDeleteCreate = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/projects",
  body: { projectDirectory: apiDeleteDirectory, starter: { id: "api-delete", title: "API 삭제", premise: "삭제 API 검증" } }
});
assert.equal(apiDeleteCreate.status, 200);
const apiDeleteBlocked = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/projects/delete",
  body: { projectDirectory: apiDeleteDirectory, projectId: "api-delete", confirmTitle: "틀림", deleteFiles: true }
});
assert.equal(apiDeleteBlocked.status, 400);
assert.equal(apiDeleteBlocked.body.ok, false);
const apiDeleteOk = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/projects/delete",
  body: { projectDirectory: apiDeleteDirectory, projectId: "api-delete", confirmTitle: "API 삭제", deleteFiles: true }
});
assert.equal(apiDeleteOk.status, 200);
assert.equal(apiDeleteOk.body.ok, true);
assert.equal(apiDeleteOk.body.deletionPolicy.mode, "localProjectFiles");
```

- [x] **Step 2: Run regression test to verify RED or #20 dependency**

Run:

```bash
npm run build:maker && node tests/vn-maker-regression.test.mjs
```

Expected: if #20 is complete this passes after UI wiring; if #20 is not complete it fails at missing `/api/projects/delete`.

- [x] **Step 3: Implement page behavior**

In `ProjectStartPage.tsx`:
- keep the deleted item in state only for recent-list restoration, because recent removal is reversible in the recent index and does not touch local files;
- after local project delete, refresh recent projects and clear current project if it matches;
- on delete failure, keep the entry and show the failure plus retry action in the shared `DeleteConfirmDialog`;
- never call local delete from `RecentProjectList` directly.

- [x] **Step 4: Add actual frontend failure rendering test**

Add a lightweight bundled React test in `tests/vn-maker-regression.test.mjs` or a focused `tests/vn-maker-project-list-ui.test.mjs` that mounts `/projects` with mocked `postAuthedJson` returning #20 failure envelopes:

```js
for (const failure of [
  { ok: false, code: "EMPTY_RESPONSE", message: "빈 응답", retryable: true, nextAction: "다시 시도" },
  { ok: false, code: "NON_JSON_RESPONSE", message: "응답 파싱 실패", retryable: true, nextAction: "다시 시도" },
  { ok: false, code: "SERVER_ERROR", message: "서버 오류", httpStatus: 500, retryable: true, nextAction: "다시 시도" }
]) {
  const html = renderProjectStartPageWithRecentListResult(failure);
  assert.match(html, /프로젝트 목록을 불러오지 못했습니다/);
  assert.match(html, new RegExp(failure.code));
  assert.match(html, /다시 시도/);
}
```

If a full React mount helper does not exist, extract a pure `projectListErrorViewModel(result)` from `ProjectStartPage.tsx` and assert the component renders that view model. This test must execute code, not only source strings.

- [x] **Step 5: Run focused checks**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: PASS.

- [x] **Step 6: Verify safe frontend API failures**

Extend the executable failure-rendering test from Step 4 so it covers list load and delete failure envelopes. Do not add source-only assertions for this requirement.

```js
const deleteFailureHtml = renderDeleteConfirmDialogWithResult({
  ok: false,
  code: "PROJECT_INPUT_INVALID",
  message: "프로젝트 제목이 일치하지 않습니다.",
  retryable: false,
  nextAction: "프로젝트 제목을 확인하세요."
});
assert.match(deleteFailureHtml, /삭제 실패/);
assert.match(deleteFailureHtml, /PROJECT_INPUT_INVALID|프로젝트 제목이 일치하지 않습니다/);
assert.match(deleteFailureHtml, /프로젝트 제목을 확인하세요/);
```

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs && node tests/vn-maker-regression.test.mjs
```

Expected: PASS and `/projects` renders a stable error state for empty, nonJSON, and 5xx envelopes rather than throwing.

### Task 4: Responsive And Heroine List Consistency Check

**Files:**
- Modify: `docs/qa/issue-21-project-list-delete.md`

- [x] **Step 1: Create focused QA notes**

Create `docs/qa/issue-21-project-list-delete.md` with:

```md
# Issue 21 Project List QA

## Viewports
| Width | `/projects` | `/heroines` comparison | Result |
| --- | --- | --- | --- |
| 390x844 | not-run | not-run | not-run |
| 768x1024 | not-run | not-run | not-run |
| 1440x900 | not-run | not-run | not-run |

## Required Checks
- Project list cards use `ContentList` density like heroine list.
- Loading, empty, error, and success states are visible and do not reflow awkwardly.
- Every project card shows 저장 위치, 현재 상태, 상태 요약, 최근 수정, and 마지막 작업 시각.
- `상세보기 버튼` is the primary visible action.
- Delete icon/button is visually lower priority and reachable by keyboard.
- Touch targets are at least 40px high on mobile.
- Long titles and project directories wrap or truncate without overflowing card bounds.
- Focus moves into the delete dialog and returns to the triggering delete control after close.
```

- [x] **Step 2: Browser check before the #21 commit**

Start the local app in this issue and fill this file before Task 5:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

At `390x844`, `768x1024`, and `1440x900`, compare `/projects` and `/heroines` at the same width. Record loading/empty/error/success states, action hierarchy, keyboard focus, touch target height, text overflow, and console errors.

### Task 5: Commit and Push Issue 21

**Files:**
- All files modified in Tasks 1-3
- This plan file

- [x] **Step 1: Run required verification**

Run:

```bash
npm run typecheck
npm run test:maker
git diff --check
git status --short --branch
```

Confirm `docs/qa/issue-21-project-list-delete.md` contains PASS/FAIL entries for `390x844`, `768x1024`, and `1440x900`. Do not commit #21 with all viewport rows still `not-run`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add apps/web/src/client/auth/AuthProvider.tsx apps/web/src/client/components/ui/DeleteConfirmDialog.tsx apps/web/src/client/components/ui/index.ts apps/web/src/client/pages/heroines/HeroineDeleteDialog.tsx apps/web/src/client/pages/ProjectStartPage.tsx apps/web/src/client/pages/projects/RecentProjectList.tsx apps/web/src/client/pages/projects/projectApi.ts apps/web/src/client/styles.css tests/vn-maker-alpha-shell.test.mjs tests/vn-maker-regression.test.mjs docs/qa/issue-21-project-list-delete.md docs/superpowers/plans/2026-05-22-issue-21-project-list-delete.md
git commit -m "feat: implement issue 21 project list deletion flow"
git push
```

- [ ] **Step 3: Update GitHub Issue #21**

Post done/partial/not done, verification commands, commit SHA, and push status to #21.
