# Issue 22 Detail Shell Tabs Overview Heroine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild project detail on a shared tab shell using `overview`, `heroine`, `background`, `studio`, `preview`, and `export`, with overview and heroine tabs aligned to the Notion Alpha contract.

**Architecture:** Extract a domain-neutral `TabList` UI component, keep tab definitions as data in `projectPageTypes.ts`, and keep project-specific tab content inside `ProjectDetailView` without local tab navigation markup.

**Tech Stack:** React Router `NavLink`, TypeScript, React keyboard events, source-contract tests, existing shared `Button`/`StatusBanner` UI.

---

### Task 1: Central Tab Component Contract

**Files:**
- Create: `apps/web/src/client/components/ui/TabList.tsx`
- Modify: `apps/web/src/client/components/ui/index.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing source assertions**

In `tests/vn-maker-alpha-shell.test.mjs`, add:

```js
const tabListPath = "apps/web/src/client/components/ui/TabList.tsx";
assert.ok(existsSync(join(root, tabListPath)), "중앙 TabList 컴포넌트가 있어야 합니다.");
const tabListSource = readText(tabListPath);
[
  "role=\"tablist\"",
  "role=\"tab\"",
  "aria-selected",
  "ArrowLeft",
  "ArrowRight",
  "onBeforeNavigate",
  "badge",
  "status",
  "useLocation"
].forEach((text) => assert.match(tabListSource, new RegExp(text), `TabList에 ${text} 처리가 있어야 합니다.`));
assert.match(readText("apps/web/src/client/components/ui/index.ts"), /TabList/, "중앙 UI index에서 TabList를 export해야 합니다.");
```

Also assert the cancellation and active-state details:

```js
[
  "const location = useLocation()",
  "onBeforeNavigate?.(item) === false",
  "aria-selected={isActiveTab(item)}",
  "item.status"
].forEach((text) => assert.match(tabListSource, new RegExp(text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")), `TabList 구현에 ${text}가 있어야 합니다.`));
```

- [ ] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL because `TabList.tsx` does not exist.

- [ ] **Step 3: Implement `TabList`**

Create `TabList.tsx`. `onBeforeNavigate` is an unsaved-change confirmation hook; returning `false` cancels mouse click and keyboard navigation:

```tsx
import type { KeyboardEvent, ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

export interface TabListItem {
  id: string;
  label: ReactNode;
  to: string;
  badge?: ReactNode;
  status?: ReactNode;
  disabled?: boolean;
}

interface TabListProps {
  ariaLabel: string;
  items: TabListItem[];
  onBeforeNavigate?: (item: TabListItem) => boolean;
}

export function TabList({ ariaLabel, items, onBeforeNavigate }: TabListProps) {
  const location = useLocation();
  const navigate = useNavigate();
  function navigateTo(item: TabListItem): void {
    if (item.disabled) return;
    if (onBeforeNavigate?.(item) === false) return;
    navigate(item.to);
  }
  function handleKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const enabled = items.filter((item) => !item.disabled);
    const activeIndex = enabled.findIndex((item) => isActiveTab(item));
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = enabled[(activeIndex + delta + enabled.length) % enabled.length];
    if (next) {
      event.preventDefault();
      navigateTo(next);
    }
  }
  function isActiveTab(item: TabListItem): boolean {
    return location.pathname === item.to || location.pathname.endsWith(`/${item.id}`);
  }
  return (
    <nav aria-label={ariaLabel}>
      <div className="tab-list" role="tablist" onKeyDown={handleKey}>
        {items.map((item) => {
          const isActive = isActiveTab(item);
          return (
          <NavLink
            aria-disabled={item.disabled || undefined}
            aria-selected={isActiveTab(item)}
            className={isActive ? "tab-list-item active" : "tab-list-item"}
            key={item.id}
            onClick={(event) => {
              if (item.disabled || onBeforeNavigate?.(item) === false) {
                event.preventDefault();
              }
            }}
            role="tab"
            to={item.to}
          >
            <span>{item.label}</span>
            {item.badge ? <small>{item.badge}</small> : null}
            {item.status ? <small>{item.status}</small> : null}
          </NavLink>
        );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Export the component**

Add:

```ts
export { TabList } from "./TabList";
```

to `apps/web/src/client/components/ui/index.ts`.

- [ ] **Step 5: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS for TabList contract.

### Task 2: Project Tab IA Migration

**Files:**
- Modify: `apps/web/src/client/pages/projects/projectPageTypes.ts`
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing IA assertions**

Update tab assertions in `tests/vn-maker-alpha-shell.test.mjs`:

```js
const projectPageTypesSource = readText("apps/web/src/client/pages/projects/projectPageTypes.ts");
["overview", "heroine", "background", "studio", "preview", "export"].forEach((tab) => {
  assert.match(projectPageTypesSource, new RegExp(`id: "${tab}"`), `${tab} 탭 정의가 있어야 합니다.`);
  assert.match(projectDetailViewSource, new RegExp(`activeTab === "${tab}"`), `${tab} 탭 body가 있어야 합니다.`);
});
["event", "assets"].forEach((legacyTab) => {
  assert.doesNotMatch(projectPageTypesSource, new RegExp(`id: "${legacyTab}"`), `${legacyTab}는 Alpha visible IA 탭이면 안 됩니다.`);
});
assert.doesNotMatch(projectDetailViewSource, /project-tab-list/, "ProjectDetailView는 로컬 project-tab-list를 렌더링하면 안 됩니다.");
assert.match(projectDetailViewSource, /<TabList/, "ProjectDetailView는 중앙 TabList를 사용해야 합니다.");
const appSource = readText("apps/web/src/client/App.tsx");
assert.match(appSource, /Navigate/, "`/projects/:projectId`는 overview로 정규화되어야 합니다.");
assert.match(appSource, /\/projects\/:projectId\/overview/, "`/projects/:projectId` 기본 라우트가 overview 링크 또는 리다이렉트를 제공해야 합니다.");
```

The route `/projects/:projectId` must land on the overview tab. It must not keep a blank tab or silently render a legacy `event`/`assets` tab.

- [ ] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL because current tabs are `event/assets` and local `project-tab-list`.

- [ ] **Step 3: Update tab definitions**

Change `detailTabs`:

```ts
export const detailTabs = [
  { id: "overview", label: "개요" },
  { id: "heroine", label: "히로인" },
  { id: "background", label: "배경 화면 생성" },
  { id: "studio", label: "제작" },
  { id: "preview", label: "프리뷰" },
  { id: "export", label: "내보내기" }
] as const;
```

Keep `normalizeTab()` defaulting to `overview`.

- [ ] **Step 4: Replace local navigation**

In `ProjectDetailView.tsx`, import `TabList` and replace the local `<nav className="project-tab-list">` block with:

```tsx
<TabList
  ariaLabel="프로젝트 상세 탭"
  items={detailTabs.map((item) => ({
    id: item.id,
    label: item.label,
    to: `/projects/${currentProject?.id || projectId}/${item.id}`,
    badge: item.id === "background" && currentProject?.assets?.some((asset) => asset.kind === "background") ? "1/1" : undefined,
    status: item.id === "heroine" && currentProject?.characters?.length ? "연결됨" : undefined
  }))}
  onBeforeNavigate={(item) => hasUnsavedProjectDraft ? window.confirm(`${item.label} 탭으로 이동할까요? 저장하지 않은 변경은 유지되지 않습니다.`) : true}
/>
```

If there is no unsaved draft state yet, define `const hasUnsavedProjectDraft = false;` near the other local state and leave the hook wired. This tests the shared tab boundary without adding new edit behavior.

In `apps/web/src/client/App.tsx`, make `/projects/:projectId` redirect to `/projects/:projectId/overview` or pass `overview` explicitly so direct project links always open the overview tab.

- [ ] **Step 5: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS for route IA migration.

### Task 3: Overview Tab State Summary

**Files:**
- Modify: `packages/use-cases/src/index.ts`
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing workflow summary assertions**

In `tests/vn-maker-use-cases.test.mjs`, after assigning heroine snapshot, assert new step IDs:

```js
assert.deepEqual(
  assignedSnapshot.workflowSummary.steps.map((step) => step.id),
  ["project", "heroine", "background", "studio", "preview", "export"]
);
assert.equal(assignedSnapshot.workflowSummary.primaryAction, "goToBackground");
```

In `tests/vn-maker-alpha-shell.test.mjs`, assert overview text:

```js
[
  "저장 위치",
  "현재 상태",
  "상태 요약",
  "다음 행동",
  "해결해야 할 차단 항목",
  "배경 화면 생성으로 이동"
].forEach((text) => assert.match(projectDetailViewSource, new RegExp(text), `개요 탭에 ${text} 표시가 있어야 합니다.`));
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL because workflow still uses `event/assets`.

- [ ] **Step 3: Update workflow summary**

In `packages/use-cases/src/index.ts`, change `MakerWorkflowStep.id` to:

```ts
id: "project" | "heroine" | "background" | "studio" | "preview" | "export";
```

Add `goToBackground`, `goToStudio`, `goToPreview`, and `goToExport` to `MakerWorkflowSummary.primaryAction`. Remove visible workflow action ids that point to `event` or `assets`, including old `goToEvent` and `goToAssets`. In `createWorkflowSummary()`, compute:

```ts
const hasBackground = Boolean(project?.assets?.some((asset) => asset.kind === "background"));
const incompleteImageJobs = project?.generationJobs?.filter((job) => ["background", "cg"].includes(job.kind) && job.status !== "completed") || [];
```

Use `background` as the next action after heroine selection and before preview/export.

- [ ] **Step 4: Update overview UI**

In `ProjectDetailView.tsx`, update overview cards to include storage path, current state, sentence summary, blockers, and actions to `heroine`, `background`, `studio`, `preview`, or `export` based on `summary.primaryAction`.

Remove or reroute old visible strings and routes:

```tsx
`/projects/${projectId}/event`
`/projects/${projectId}/assets`
```

Direct links to `/projects/:projectId/event` or `/projects/:projectId/assets` should normalize to `overview` or `studio` through `normalizeTab()` so legacy URLs do not render removed visible tabs.

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

### Task 4: Heroine Snapshot Tab Contract

**Files:**
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing heroine tab assertions**

Add source assertions:

```js
[
  "프로젝트 스냅샷",
  "라이브러리 원본",
  "원본 수정 아님",
  "원본과 다른 필드",
  "스냅샷 선택",
  "프로젝트에 저장된 표시 이름",
  "라이브러리 원본 이름",
  "저장 상태",
  "마지막 수정 시각",
  "히로인 관리로 이동"
].forEach((text) => assert.match(projectDetailViewSource, new RegExp(text), `히로인 탭에 ${text} 문구가 있어야 합니다.`));
```

In `tests/vn-maker-use-cases.test.mjs`, keep the existing snapshot immutability assertion and extend it:

```js
assert.equal(openedAssignedSnapshot.project.characters[0].sourceHeroineId, heroine.id);
assert.equal(openedAssignedSnapshot.project.characters[0].displayName, heroine.name);
assert.notEqual(openedAssignedSnapshot.project.characters[0].displayName, changedSourceHeroine.name);
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: source test fails until UI explains original vs snapshot.

- [ ] **Step 3: Update heroine tab UI**

In the `activeTab === "heroine"` block:
- show a concrete selection UI for the currently assigned project heroine snapshot and the linked library heroine;
- render basic fields: project display name, library original name, source heroine id, snapshot creation timestamp, and project character id;
- label the project copy as `원본 수정 아님`;
- show `sourceHeroineId`, `sourceHeroineName`, `sourceSnapshotCreatedAt`;
- show fields that differ between selected library original and assigned snapshot;
- show save status from the current project load result or mutation result as `저장 상태`;
- show last modified data from project metadata if available; otherwise show `마지막 수정 시각 정보 없음`;
- route original editing to `/heroines/:heroineId/edit`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

### Task 5: Shell Density And Browser Happy Path

**Files:**
- Create: `docs/qa/issue-22-detail-tabs.md`
- Modify: `apps/web/src/client/styles.css`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Add density/alignment assertions**

In `tests/vn-maker-alpha-shell.test.mjs`, add source assertions that tie the project shell to existing heroine/detail density rather than only recording a note:

```js
const stylesSource = readText("apps/web/src/client/styles.css");
[
  "detail-tab-grid",
  "detail-card",
  "detail-card-wide",
  "summary-list",
  "state-chip",
  "page-header",
  "page-primary-action",
  "Button"
].forEach((className) => assert.match(projectDetailViewSource, new RegExp(className), `Project detail shell must reuse ${className}.`));
[
  ".detail-tab-grid",
  ".detail-card",
  ".detail-card-wide",
  ".state-chip",
  ".tab-list",
  ".page-header",
  ".page-primary-action",
  ".panel-actions"
].forEach((className) => assert.match(stylesSource, new RegExp(className.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")), `${className} style must exist.`));
assert.match(readText("apps/web/src/client/pages/heroines/HeroineDetailPage.tsx"), /detail-card|summary-list|state-chip/, "Project detail density should align with heroine detail patterns.");
assert.match(projectDetailViewSource, /variant="primary"|variant=\{"primary"\}/, "Overview/detail primary action must use shared Button primary hierarchy.");
assert.match(projectDetailViewSource, /<Button/, "Project detail actions must use the shared Button component.");
```

- [ ] **Step 2: Run shell test**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS after shared classes and alignment are present.

- [ ] **Step 3: Create QA note file**

Create `docs/qa/issue-22-detail-tabs.md`:

```md
# Issue 22 Detail Tabs QA

## Browser Flow
| Viewport | `/projects/:projectId` redirects to overview | Tab switch retains header | Heroine tab fields visible | Result |
| --- | --- | --- | --- | --- |
| 390x844 | not-run | not-run | not-run | not-run |
| 768x1024 | not-run | not-run | not-run | not-run |
| 1440x900 | not-run | not-run | not-run | not-run |

## Visual Checks
- Header density matches heroine detail page spacing.
- Tab labels, badges, and status text align without wrapping over neighboring tabs.
- Primary overview buttons use the shared `Button` hierarchy.
- Status badges use existing detail/status classes rather than one-off styles.
```

- [ ] **Step 4: Run browser happy path before the #22 commit**

Start the local app for this issue:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

At `390x844`, `768x1024`, and `1440x900`, record the happy path in `docs/qa/issue-22-detail-tabs.md`: open project detail, confirm `/projects/:projectId` lands on overview, refresh/directly open `/projects/:projectId/overview`, arrow-key through tabs, open heroine tab, verify project snapshot fields, and return to overview. Record console errors and any tab/header overlap.

### Task 6: Commit and Push Issue 22

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

Confirm `docs/qa/issue-22-detail-tabs.md` has non-`not-run` results for all three viewport rows before committing #22.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add apps/web/src/client/components/ui/TabList.tsx apps/web/src/client/components/ui/index.ts apps/web/src/client/App.tsx apps/web/src/client/pages/projects/projectPageTypes.ts apps/web/src/client/pages/projects/ProjectDetailView.tsx apps/web/src/client/styles.css packages/use-cases/src/index.ts tests/vn-maker-use-cases.test.mjs tests/vn-maker-alpha-shell.test.mjs docs/qa/issue-22-detail-tabs.md docs/superpowers/plans/2026-05-22-issue-22-detail-tabs-overview-heroine.md
git commit -m "feat: implement issue 22 project detail tabs"
git push
```

- [ ] **Step 3: Update GitHub Issue #22**

Post done/partial/not done, verification commands, commit SHA, and push status to #22.
