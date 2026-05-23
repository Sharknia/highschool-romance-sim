# Issue 23 Studio Under Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/projects/:projectId/studio` visible as the Alpha 제작 tab while removing fake or legacy-complete production controls from the visible project detail IA.

**Architecture:** Keep `studio` as a real tab in the central shell, render a focused under-construction panel, and quarantine the old event proposal workflow so it is not presented as the Alpha 제작 feature.

**Tech Stack:** React, React Router, source-contract tests, existing project detail shell.

---

## Dependency

Execute this after #22 has added the central detail shell and these tabs: `overview`, `heroine`, `background`, `studio`, `preview`, `export`. This issue should not introduce a separate `/background` route assumption beyond the route established by #22.

### Task 1: Studio Tab Source Contract

**Files:**
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `apps/web/src/client/pages/projects/projectPageTypes.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [x] **Step 1: Write failing studio assertions**

In `tests/vn-maker-alpha-shell.test.mjs`, add:

```js
const projectPageTypesSource = readText("apps/web/src/client/pages/projects/projectPageTypes.ts");
assert.match(projectPageTypesSource, /id: "studio"/, "detailTabs에 제작 탭이 있어야 합니다.");
[
  "data-testid=\"studio-under-construction\"",
  "activeTab === \"studio\"",
  "제작 탭은 준비 중입니다.",
  "시나리오 작성",
  "분기 편집",
  "장면 구성",
  "실제 동작하지 않는 제작 버튼은 제공하지 않습니다."
].forEach((text) => assert.match(projectDetailViewSource, new RegExp(text), `제작 탭에 ${text} 표시가 있어야 합니다.`));
[
  "이벤트 제안 받기",
  "제안 승인",
  "가짜 진행",
  "완료율",
  "제작 시작"
].forEach((text) => {
  const studioStart = projectDetailViewSource.indexOf('data-testid="studio-under-construction"');
  const studioEnd = studioStart >= 0 ? projectDetailViewSource.indexOf('activeTab === "preview"', studioStart) : -1;
  const studioBranch = studioStart >= 0 && studioEnd > studioStart
    ? projectDetailViewSource.slice(studioStart, studioEnd)
    : "";
  assert.doesNotMatch(studioBranch, new RegExp(text), `studio 탭은 ${text}를 노출하면 안 됩니다.`);
});
```

- [x] **Step 2: Run shell test to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: FAIL because `studio` body is not implemented yet.

- [x] **Step 3: Implement studio panel**

In `apps/web/src/client/pages/projects/projectPageTypes.ts`, ensure `detailTabs` includes the #22 visible IA and removes `event/assets` from the visible tab list:

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

In `ProjectDetailView.tsx`, add:

```tsx
{activeTab === "studio" ? (
  <div className="detail-tab-grid" data-testid="studio-under-construction">
    <section className="detail-card detail-card-wide">
      <h3>제작 탭은 준비 중입니다.</h3>
      <p>Alpha에서는 시나리오 작성, 분기 편집, 장면 구성 흐름이 이 영역에 들어올 예정입니다.</p>
      <ul className="compact-list">
        <li>시나리오 작성: 프로젝트 스냅샷과 배경 에셋을 바탕으로 장면 초안을 다룹니다.</li>
        <li>분기 편집: 선택지와 엔딩 도달 상태를 시각적으로 조정합니다.</li>
        <li>장면 구성: 대사, 배경, 캐릭터 표시를 한 장면 단위로 편집합니다.</li>
      </ul>
      <div className="inline-status">실제 동작하지 않는 제작 버튼은 제공하지 않습니다.</div>
    </section>
  </div>
) : null}
```

- [x] **Step 4: Run shell test to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS.

Verification:
- RED condition: existing `/studio` branch still rendered the event proposal UI and had no `data-testid="studio-under-construction"` marker.
- GREEN: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs` passed after replacing the visible studio branch with the under-construction panel.

### Task 2: Legacy Event Flow Visibility Cleanup

**Files:**
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Modify: `apps/web/src/client/pages/projects/projectPageTypes.ts`
- Modify: `packages/use-cases/src/index.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Modify: `tests/vn-maker-use-cases.test.mjs`

- [x] **Step 1: Rewrite old legacy IA assertions**

In `tests/vn-maker-alpha-shell.test.mjs`, replace old assertions that require these visible legacy strings:

```js
[
  "event",
  "assets",
  "제작/이벤트로 이동",
  "/api/events/expand",
  "/api/events/approve",
  "이벤트 제안 받기",
  "제안 승인",
  "CG 작업이 있으면 에셋/생성 탭으로 이동합니다.",
  "/api/generation/jobs/list",
  "에셋/생성 탭"
].forEach((legacyVisibleText) => {
  assert.doesNotMatch(projectDetailViewSource, new RegExp(legacyVisibleText.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")), `${legacyVisibleText}는 Alpha visible IA 요구값이면 안 됩니다.`);
});
```

with assertions scoped to visible tabs and visible shell blocks:

```js
const detailTabsBlock = projectPageTypesSource.match(/export const detailTabs = \\[[\\s\\S]*?\\] as const;/)?.[0] || "";
const visibleShellBlock = projectDetailViewSource.match(/<TabList[\\s\\S]*?activeTab === "preview"/)?.[0] || projectDetailViewSource;
assert.doesNotMatch(detailTabsBlock, /id: "event"/, "event는 Alpha visible IA 탭 정의에 남으면 안 됩니다.");
assert.doesNotMatch(detailTabsBlock, /id: "assets"/, "assets는 Alpha visible IA 탭 정의에 남으면 안 됩니다.");
assert.doesNotMatch(visibleShellBlock, /\\/event[`"')]/, "visible action이 event 탭으로 이동하면 안 됩니다.");
assert.doesNotMatch(visibleShellBlock, /\\/assets[`"')]/, "visible action이 assets 탭으로 이동하면 안 됩니다.");
[
  "goToEvent",
  "제작/이벤트로 이동",
  "이벤트 제안 받기",
  "제안 승인",
  "goToAssets",
  "CG 작업이 있으면 에셋/생성 탭으로 이동합니다."
].forEach((text) => assert.doesNotMatch(visibleShellBlock, new RegExp(text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")), `visible ProjectDetailView에 ${text}가 남으면 안 됩니다.`));
```

In `tests/vn-maker-use-cases.test.mjs`, rewrite every assertion that expects visible event/assets workflow steps or action ids, including `assignedSnapshot`, planned-CG export blocking, and post-approval workflow summaries:

```js
assert.deepEqual(
  assignedSnapshot.workflowSummary.steps.map((step) => step.id),
  ["project", "heroine", "background", "studio", "preview", "export"]
);
assert.notEqual(assignedSnapshot.workflowSummary.primaryAction, "goToEvent");
assert.notEqual(blockedExportWithPlannedCg.workflowSummary.primaryAction, "goToAssets");
assert.deepEqual(
  blockedExportWithPlannedCg.workflowSummary.steps.map((step) => step.id),
  ["project", "heroine", "background", "studio", "preview", "export"]
);
assert.notEqual(blockedExportWithRunningCg.workflowSummary.primaryAction, "goToAssets");
assert.equal(blockedExportWithRunningCg.workflowSummary.primaryAction, "goToPreview");
assert.deepEqual(
  blockedExportWithRunningCg.workflowSummary.steps.map((step) => step.id),
  ["project", "heroine", "background", "studio", "preview", "export"]
);
assert.deepEqual(
  approved.workflowSummary.steps.map((step) => step.id),
  ["project", "heroine", "background", "studio", "preview", "export"]
);
assert.equal(approved.workflowSummary.primaryAction, "goToPreview");
assert.notEqual(approved.workflowSummary.primaryAction, "goToAssets");
assert.notEqual(approved.workflowSummary.primaryAction, "goToEvent");
```

- [x] **Step 2: Run shell/use-case tests to verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs && node tests/vn-maker-use-cases.test.mjs
```

Expected: FAIL if old visible navigation, old source-contract assertions, or old workflow action ids remain.

- [x] **Step 3: Remove event/assets from visible branches**

In `ProjectDetailView.tsx`:
- remove `activeTab === "event"` and `activeTab === "assets"` branches from normal rendering;
- update overview/heroine actions to go to `/background`, `/studio`, `/preview`;
- change old visible labels such as `제작/이벤트로 이동`, event proposal buttons, approve buttons, event step labels, and assets step labels to the new IA or remove them from the visible detail shell;
- update `fallbackWorkflowSummary`, overview action mapping, `assignHeroineSnapshot()` follow-up route, and proposal approval follow-up route so they land on `background`, `studio`, or `preview`, not `event` or `assets`;
- keep old event functions only if directly needed by tests or internal generation logic, but do not route to them from `detailTabs`.

- [x] **Step 4: Run shell/use-case tests to verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs && node tests/vn-maker-use-cases.test.mjs
```

Expected: PASS and no visible event/assets IA remains.

Verification:
- RED condition: existing visible shell still contained `이벤트 제안 받기` and `제안 승인` inside `activeTab === "studio"`.
- GREEN: `npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs` passed with visible-shell scoped legacy assertions.

### Task 3: Visual Density Check

**Files:**
- Modify: `apps/web/src/client/styles.css`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Create: `docs/qa/issue-23-studio.md`

- [x] **Step 1: Write source assertions for shared density classes**

Add:

```js
assert.match(projectDetailViewSource, /detail-card detail-card-wide/, "studio 공사중 상태는 기존 detail-card 밀도를 사용해야 합니다.");
assert.match(readText("apps/web/src/client/styles.css"), /detail-card-wide/, "공통 상세 카드 폭 스타일이 있어야 합니다.");
```

- [x] **Step 2: Run shell test to verify RED/GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: PASS if existing classes are reused; otherwise fail until style/class names are aligned.

- [x] **Step 3: Create QA file**

Create `docs/qa/issue-23-studio.md`:

```md
# Issue 23 Studio QA

| Viewport | `/projects/:projectId/studio` loads | Header/tab visible | No fake button/progress | Text fits | Console |
| --- | --- | --- | --- | --- | --- |
| 390x844 | not-run | not-run | not-run | not-run | not-run |
| 768x1024 | not-run | not-run | not-run | not-run | not-run |
| 1440x900 | not-run | not-run | not-run | not-run | not-run |
```

- [x] **Step 4: Browser density check before the #23 commit**

Start the local app for this issue:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

Open `/projects/:projectId/studio` at `390x844`, `768x1024`, and `1440x900`. Verify the header and tab bar remain visible, the under-construction text does not overlap adjacent content, and no fake production button or progress indicator appears. Fill `docs/qa/issue-23-studio.md` before committing.

Verification:
- Browser QA ran at `390x900`, `768x900`, and `1440x950` with Chromium CDP.
- Final URL stayed `/projects/issue-22-qa-20260522191716/studio`, the `제작` tab was active, and the header/tab bar remained visible.
- Studio body showed the under-construction guidance and did not show fake production controls or progress.
- Screenshots recorded in `/tmp/vn-maker-issue23-studio/studio-*.png`.
- Console errors, runtime page errors, and non-favicon HTTP errors: none.

### Task 4: Issue Progress Comment

**Files:**
- GitHub Issue: #23

- [x] **Step 1: Comment before implementation**

Post to #23 that the implementation is starting after #22, with branch name, dependency note, and planned visible IA cleanup scope.

- [ ] **Step 2: Comment after verification**

Post done/partial/not done, verification commands, commit SHA, push status, and browser QA status to #23.

### Task 5: Commit and Push Issue 23

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

Confirm `docs/qa/issue-23-studio.md` has non-`not-run` entries for all viewport rows.

Verification:
- `npm run typecheck && npm run test:maker && git diff --check && git status --short --branch` exited 0.
- `docs/qa/issue-23-studio.md` has pass records for `390x900`, `768x900`, and `1440x950`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add apps/web/src/client/pages/projects/ProjectDetailView.tsx apps/web/src/client/pages/projects/projectPageTypes.ts apps/web/src/client/styles.css packages/use-cases/src/index.ts tests/vn-maker-alpha-shell.test.mjs tests/vn-maker-use-cases.test.mjs docs/qa/issue-23-studio.md docs/superpowers/plans/2026-05-22-issue-23-studio-under-construction.md
git commit -m "feat: implement issue 23 studio placeholder"
git push
```

- [ ] **Step 3: Update GitHub Issue #23**

Post done/partial/not done, verification commands, commit SHA, and push status to #23.
