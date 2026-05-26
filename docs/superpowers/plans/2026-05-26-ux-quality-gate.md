# UX Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a documented and tested UX quality gate that prevents repeated VN Maker Web App issues around internal terminology leakage, domain/display state mismatch, and mobile layout regressions.

**Architecture:** Keep the gate small and local to the existing web app patterns. Add one product-facing UX standard document, one source-level regression test file, and one focused display-text helper module used by `ProjectDetailView`. Do not rework routing, packaging, or unrelated feature behavior.

**Tech Stack:** Vite + React + TypeScript in `apps/web`, Node-based `.mjs` tests, existing `npm run typecheck` and `npm run test:maker` verification.

---

## File Structure

- Create `docs/ux-quality-gate.md`
  - Defines what may appear in user-facing surfaces, what must stay in diagnostics, workflow display-state rules, responsive viewport criteria, and a checklist for new screens.
- Create `tests/vn-maker-ux-quality-gate.test.mjs`
  - Source-level UX gate for recurring issue patterns in project detail and heroine portrait surfaces.
  - Verifies the new document exists and contains the required policy sections.
  - Verifies project detail display text flows through a helper module instead of raw JSX string assembly.
- Modify `package.json`
  - Adds the new UX quality gate test to `npm run test:maker`.
- Create `apps/web/src/client/pages/projects/projectDisplayText.ts`
  - Owns user-facing display helpers for workflow step display state, background asset connection text, scene connection text, provider text, and sanitized asset labels.
- Modify `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
  - Imports display helpers from `projectDisplayText.ts`.
  - Keeps raw IDs and internal field names inside `DiagnosticDrawer` or developer-detail surfaces only.
- Modify existing UX tests only if they conflict with the more general gate.

---

### Task 1: Add the UX Gate Test Shell

**Files:**
- Create: `tests/vn-maker-ux-quality-gate.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `tests/vn-maker-ux-quality-gate.test.mjs` with these checks:

```js
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();

function readText(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function blockBetween(source, startPattern, endPattern) {
  const start = source.search(startPattern);
  assert.notEqual(start, -1, `start pattern not found: ${startPattern}`);
  const rest = source.slice(start);
  const end = rest.search(endPattern);
  assert.notEqual(end, -1, `end pattern not found: ${endPattern}`);
  return rest.slice(0, end);
}

assert.ok(existsSync(join(root, "docs/ux-quality-gate.md")), "UX 품질 기준 문서가 있어야 합니다.");
const uxGateDoc = readText("docs/ux-quality-gate.md");
[
  "사용자 기본 화면",
  "진단 전용 정보",
  "Workflow Domain State와 Display State",
  "반응형 검토 기준",
  "새 화면 체크리스트"
].forEach((heading) => {
  assert.match(uxGateDoc, new RegExp(heading), `UX 품질 기준 문서에 '${heading}' 섹션이 있어야 합니다.`);
});

const displayTextPath = "apps/web/src/client/pages/projects/projectDisplayText.ts";
assert.ok(existsSync(join(root, displayTextPath)), "ProjectDetailView 사용자 표시 문구 helper 모듈이 있어야 합니다.");
const displayTextSource = readText(displayTextPath);
[
  "displayWorkflowStep",
  "backgroundConnectionText",
  "backgroundSceneConnectionText",
  "backgroundAssetDisplayLabel",
  "generationProviderText"
].forEach((exportName) => {
  assert.match(displayTextSource, new RegExp(`export function ${exportName}`), `${exportName}는 표시 helper 모듈에서 export되어야 합니다.`);
});

const projectDetailSource = readText("apps/web/src/client/pages/projects/ProjectDetailView.tsx");
assert.match(projectDetailSource, /from "\.\/projectDisplayText"/, "ProjectDetailView는 사용자 표시 문구 helper를 import해야 합니다.");
assert.doesNotMatch(projectDetailSource, /function displayWorkflowStep/, "ProjectDetailView 안에 workflow 표시 변환 로직을 다시 두면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /function backgroundConnectionText/, "ProjectDetailView 안에 배경 연결 표시 로직을 다시 두면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /function backgroundSceneConnectionText/, "ProjectDetailView 안에 장면 연결 표시 로직을 다시 두면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /function backgroundAssetDisplayLabel/, "ProjectDetailView 안에 에셋 라벨 정리 로직을 다시 두면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /function generationProviderText/, "ProjectDetailView 안에 provider 표시 로직을 다시 두면 안 됩니다.");

[
  /<h3>runtime 플레이<\/h3>/,
  /imageGeneration 가능/,
  /imageGeneration 상태/,
  /provider 확인 필요/,
  /backgroundAssetId \$\{backgroundLinkedScene/,
  /<div><dt>에셋 연결<\/dt><dd>\{currentBackgroundAsset\?\.id/,
  /결과 에셋: \{job\.outputAssetId/
].forEach((pattern) => {
  assert.doesNotMatch(projectDetailSource, pattern, `ProjectDetailView 기본 화면에 금지 패턴이 남아 있습니다: ${pattern}`);
});

const backgroundDiagnostics = blockBetween(
  projectDetailSource,
  /<DiagnosticDrawer summary="배경 생성 작업 진단">/,
  /<\/DiagnosticDrawer>/
);
assert.match(backgroundDiagnostics, /backgroundAssetId/, "backgroundAssetId는 배경 생성 작업 진단 안에만 표시되어야 합니다.");

const previewDeveloperDetail = blockBetween(
  projectDetailSource,
  /<DiagnosticDrawer summary="개발자 상세">/,
  /<\/DiagnosticDrawer>/
);
assert.match(previewDeveloperDetail, /runtime JSON/, "runtime JSON은 개발자 상세 진단 안에만 표시되어야 합니다.");

const stylesSource = readText("apps/web/src/client/styles.css");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list\s*{[\s\S]*display: flex[\s\S]*overflow-x: auto/, "390px 모바일 탭은 가로 스캔 레일이어야 합니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list-item\s*{[\s\S]*min-width: 136px/, "390px 모바일 탭 항목은 최소 폭을 가져야 합니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.detail-tab-grid\s*{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, "390px 모바일 상세 카드 흐름은 1열이어야 합니다.");

const heroinePortraitSource = readText("apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx");
assert.match(heroinePortraitSource, /이미지 생성 가능/, "히로인 포트레이트 기본 화면은 사용자용 이미지 생성 문구를 써야 합니다.");
assert.doesNotMatch(heroinePortraitSource, /imageGeneration 가능|imageGeneration 상태/, "히로인 포트레이트 기본 화면은 내부 imageGeneration 용어를 노출하면 안 됩니다.");
```

- [ ] **Step 2: Add it to `test:maker`**

Change the root `package.json` `test:maker` script so it ends with:

```json
"test:maker": "npm run build:maker && node tests/vn-maker-domain.test.mjs && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-beta.test.mjs && node tests/vn-maker-regression.test.mjs && node tests/vn-maker-alpha-sandbox.test.mjs && node tests/vn-maker-alpha-shell.test.mjs && node tests/vn-maker-alpha-ui-state.test.mjs && node tests/vn-maker-uxui-foundation.test.mjs && node tests/vn-maker-ux-quality-gate.test.mjs"
```

- [ ] **Step 3: Verify RED**

Run:

```bash
node tests/vn-maker-ux-quality-gate.test.mjs
```

Expected: FAIL because `docs/ux-quality-gate.md` and `projectDisplayText.ts` do not exist yet.

---

### Task 2: Add the UX Quality Gate Document

**Files:**
- Create: `docs/ux-quality-gate.md`
- Test: `tests/vn-maker-ux-quality-gate.test.mjs`

- [ ] **Step 1: Write the document**

Create `docs/ux-quality-gate.md` with these sections:

```markdown
# UX Quality Gate

VN Maker의 제작 UI는 사람이 반복해서 쓰는 로컬 데스크톱형 웹 앱이다. 기본 화면은 작업 판단과 다음 행동을 돕고, 원본 ID와 내부 상태는 진단 영역에 격리한다.

## 사용자 기본 화면

- 허용: 사용자가 이해할 수 있는 작업 상태, 연결 상태, 다음 행동, 검증 결과, 실패 원인 요약.
- 금지: raw asset id, job id, route id, scene id, DTO 필드명, provider/internal adapter 이름, 내부 API 코드.
- 금지 예시: `backgroundAssetId`, `imageGeneration 가능`, `runtime 플레이`, `availableState`, `provider 확인 필요`, `asset-...`, `job-...`.
- 버튼과 탭은 사용자가 실행할 수 있는 행동만 primary로 보여준다.

## 진단 전용 정보

- raw 저장 위치, raw ID, DTO 필드명, provider/internal adapter 이름, runtime JSON은 `DiagnosticDrawer` 또는 명시적인 개발자 상세 영역 안에서만 허용한다.
- 진단 summary는 사용자가 열기 전에도 의미를 알 수 있는 한국어로 쓴다.
- 진단 영역 밖의 본문은 raw 값을 조합하지 않고 표시 helper를 거친다.

## Workflow Domain State와 Display State

- domain state는 엔진/유스케이스의 사실을 보존한다.
- display state는 현재 화면에서 사용자가 이해해야 할 상태를 별도로 만든다.
- 미구현 기능이나 준비 중 기능은 domain state가 `done`이어도 완료 카운트에 포함하지 않는다.
- `ProjectDetailView`는 workflow 단계 렌더링 전 `displayWorkflowStep` 같은 표시 변환을 거친다.

## 반응형 검토 기준

- 390px: 탭은 가로 스캔 레일을 사용하고, 탭 항목은 최소 폭을 가진다. 상세 카드는 1열이다.
- 820px: 주요 탭은 3열 기준으로 압축되며, 카드와 버튼 텍스트가 겹치지 않는다.
- 1440px: overview, background, studio, preview, export의 주요 카드가 첫 화면에서 읽히고, 진단 영역은 접힌 상태로 유지된다.
- 버튼 텍스트는 부모 안에서 줄바꿈되거나 안정적인 최소 폭을 가져야 한다.

## 새 화면 체크리스트

- 기본 본문에 raw id, DTO 필드명, provider/internal adapter 이름이 없는가?
- raw 값이 필요하면 `DiagnosticDrawer` 안에만 있는가?
- domain state를 직접 사용자 문구로 쓰지 않고 display state/display label을 거치는가?
- 준비 중 기능이 완료 수치나 실행 가능한 primary action처럼 보이지 않는가?
- 390px, 820px, 1440px에서 탭, 카드, 버튼, 상태 문구가 겹치거나 옆으로 밀리지 않는가?
- UX 품질 게이트 테스트에 새 화면의 금지 패턴이 추가되었는가?
```

- [ ] **Step 2: Run the UX gate test**

Run:

```bash
node tests/vn-maker-ux-quality-gate.test.mjs
```

Expected: FAIL because `projectDisplayText.ts` has not been created yet.

---

### Task 3: Extract Project Detail Display Helpers

**Files:**
- Create: `apps/web/src/client/pages/projects/projectDisplayText.ts`
- Modify: `apps/web/src/client/pages/projects/ProjectDetailView.tsx`
- Test: `tests/vn-maker-ux-quality-gate.test.mjs`

- [ ] **Step 1: Create `projectDisplayText.ts`**

Move the existing display helpers from `ProjectDetailView.tsx` into the new module:

```ts
import type { ProjectAsset, ProjectData, ProjectGenerationJob, ProjectWorkflowSummary } from "./projectPageTypes";

type WorkflowStep = NonNullable<ProjectWorkflowSummary["steps"]>[number];
export type DisplayWorkflowStep = WorkflowStep & { displayLabel: string; displayState: WorkflowStep["state"] };

export function displayWorkflowStep(step: WorkflowStep): DisplayWorkflowStep {
  if (step.id === "studio") {
    return { ...step, displayLabel: "제작 준비 중", displayState: "waiting" };
  }
  return { ...step, displayLabel: step.label, displayState: step.state };
}

export function imageJobKindLabel(kind?: string): string {
  if (kind === "background") {
    return "배경 화면";
  }
  if (kind === "cg") {
    return "이벤트 CG";
  }
  return "이미지";
}

export function jobStatusLabel(value?: string): string {
  if (value === "planned") return "작업 예정";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  if (value === "completed") return "완료";
  return value || "확인 필요";
}

export function generationProviderText(provider?: string): string {
  if (!provider) {
    return "생성 연결 확인 필요";
  }
  if (provider === "codex" || provider === "openai" || provider === "imageGeneration") {
    return "이미지 생성 연결";
  }
  return "연결된 생성 서비스";
}

export function backgroundConnectionText(asset: ProjectAsset | null, job: ProjectGenerationJob | null): string {
  if (asset?.id) {
    return "배경 연결됨";
  }
  if (job?.status === "completed") {
    return "생성 결과 확인 필요";
  }
  if (job) {
    return `${imageJobKindLabel(job.kind)} ${jobStatusLabel(job.status)}`;
  }
  return "생성 전";
}

export function backgroundSceneConnectionText(scene: NonNullable<ProjectData["scenes"]>[number] | null): string {
  if (!scene) {
    return "연결할 장면 없음";
  }
  if (scene.backgroundAssetId) {
    return scene.label ? `${scene.label}에 연결됨` : "기본 장면에 연결됨";
  }
  return scene.label ? `${scene.label} 연결 대기` : "기본 장면 연결 대기";
}

export function backgroundAssetDisplayLabel(asset: ProjectAsset): string {
  const label = asset.label?.trim();
  if (label && !label.includes("@") && !/fixture|sandbox/i.test(label)) {
    return label;
  }
  return "생성된 배경";
}
```

- [ ] **Step 2: Update `ProjectDetailView.tsx` imports**

Import the display helpers:

```ts
import {
  backgroundAssetDisplayLabel,
  backgroundConnectionText,
  backgroundSceneConnectionText,
  displayWorkflowStep,
  generationProviderText,
  imageJobKindLabel,
  jobStatusLabel
} from "./projectDisplayText";
```

Delete the local helper definitions that now live in `projectDisplayText.ts`.

- [ ] **Step 3: Run the UX gate test**

Run:

```bash
node tests/vn-maker-ux-quality-gate.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Run existing UX tests**

Run:

```bash
node tests/vn-maker-uxui-foundation.test.mjs
node tests/vn-maker-alpha-shell.test.mjs
```

Expected: both PASS.

---

### Task 4: Verify Full Gate and Browser Behavior

**Files:**
- No required file edits unless verification exposes a real defect.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run maker test suite**

Run:

```bash
npm run test:maker
```

Expected: exit 0 and includes `node tests/vn-maker-ux-quality-gate.test.mjs`.

- [ ] **Step 3: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output, exit 0.

- [ ] **Step 4: Browser check**

Start the dev server:

```bash
VN_MAKER_ALPHA_SANDBOX=1 VITE_PORT=6273 API_PORT=6274 npm run dev -w @vn-maker/web
```

Create or reuse a local alpha-sandbox project through the API. Capture screenshots for:

```bash
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/overview /tmp/vn-maker-ux-gate-overview-desktop.png
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/background /tmp/vn-maker-ux-gate-background-desktop.png
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/studio /tmp/vn-maker-ux-gate-studio-desktop.png
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/preview /tmp/vn-maker-ux-gate-preview-desktop.png
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/export /tmp/vn-maker-ux-gate-export-desktop.png
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 390,900 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/overview /tmp/vn-maker-ux-gate-overview-mobile.png
npx -y playwright@1.56.1 screenshot --browser chromium --viewport-size 820,1000 --wait-for-selector .detail-tab-body --wait-for-timeout 1500 http://127.0.0.1:6273/projects/<project-id>/background /tmp/vn-maker-ux-gate-background-tablet.png
```

Expected: all screenshots are captured; visible default surfaces do not show raw IDs or internal terms; mobile overview uses horizontal tab rail and 1-column cards.

---

### Task 5: Commit, Push, and Report

**Files:**
- All changed files.

- [ ] **Step 1: Check status**

Run:

```bash
git status -sb
```

Expected: only intended docs, test, package, and display helper changes are present.

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/ux-quality-gate.md docs/superpowers/plans/2026-05-26-ux-quality-gate.md tests/vn-maker-ux-quality-gate.test.mjs package.json apps/web/src/client/pages/projects/projectDisplayText.ts apps/web/src/client/pages/projects/ProjectDetailView.tsx
git commit -m "UX 품질 게이트 추가"
```

Expected: commit created on `feature/issue-65-uxui-review`.

- [ ] **Step 3: Push**

Run:

```bash
git push
```

Expected: `feature/issue-65-uxui-review` pushes to origin.

- [ ] **Step 4: Report**

Add a Korean PR/Issue comment with:

- done
- partial implementation
- not done
- verification commands
- commit/push status

Send a Korean work report email to `zel@kakao.com` through the configured Gmail/report path if available.

---

## Self-Review

- Spec coverage: document, test gate, display helper extraction, browser check, verification, commit/push/report are covered by Tasks 1-5.
- Placeholder scan: no `TBD`, `TODO`, or unspecified test steps remain.
- Type consistency: helper names in tests match helper names in implementation steps and imports.
