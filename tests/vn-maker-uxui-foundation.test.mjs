import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function readText(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertFile(path) {
  assert.ok(existsSync(join(root, path)), `${path} 파일이 있어야 합니다.`);
  return readText(path);
}

const uiIndexSource = readText("apps/web/src/client/components/ui/index.ts");
const stylesSource = readText("apps/web/src/client/styles.css");

[
  "EntitySummaryHeader",
  "ActionPanel",
  "ReadinessPanel",
  "AssetStatePanel",
  "FieldGroup",
  "StickyActionBar",
  "TabStatusList",
  "EmptyState",
  "DiagnosticDrawer",
  "StatusChip",
  "StatusRegion",
  "PageHeader"
].forEach((exportName) => {
  assert.match(uiIndexSource, new RegExp(`\\b${exportName}\\b`), `공통 UI index는 ${exportName}를 export해야 합니다.`);
});

const buttonSource = assertFile("apps/web/src/client/components/ui/Button.tsx");
[
  '"danger"',
  '"quiet"',
  "iconOnly",
  "aria-label",
  "button-icon-only"
].forEach((requiredText) => {
  assert.match(buttonSource, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Button은 ${requiredText} 계약을 포함해야 합니다.`);
});
assert.match(buttonSource, /title=\{title \|\| \(iconOnly \? accessibleLabel : undefined\)\}/, "iconOnly Button은 accessible label을 tooltip title로도 노출하되 일반 텍스트 버튼의 접근 이름을 title로 덮지 않아야 합니다.");
assert.match(buttonSource, /iconOnly: true; "aria-label": string/, "iconOnly Button은 aria-label 또는 title을 타입 계약으로 요구해야 합니다.");
assert.match(buttonSource, /iconOnly: true; "aria-label"\?: string; title: string/, "iconOnly Button은 title 기반 접근 이름도 타입 계약으로 허용해야 합니다.");

const statusBannerSource = assertFile("apps/web/src/client/components/ui/StatusBanner.tsx");
assert.match(statusBannerSource, /role=\{tone === "error" \? "alert" : "status"\}/, "StatusBanner error tone은 alert role을 사용해야 합니다.");

[
  "--color-surface",
  "--color-surface-muted",
  "--color-border",
  "--color-primary",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--space-3",
  "--radius-panel"
].forEach((tokenName) => {
  assert.match(stylesSource, new RegExp(tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `styles.css는 ${tokenName} 디자인 토큰을 가져야 합니다.`);
});

[
  ".entity-summary-header",
  ".action-panel",
  ".readiness-panel",
  ".asset-state-panel",
  ".field-group",
  ".sticky-action-bar",
  ".tab-status-list",
  ".empty-state",
  ".diagnostic-drawer",
  ".status-region"
].forEach((className) => {
  assert.match(stylesSource, new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `styles.css는 ${className} 공통 UI 스타일을 가져야 합니다.`);
});
assert.match(stylesSource, /@media \(max-width: 820px\)[\s\S]*\.entity-summary-header[\s\S]*grid-template-columns:\s*1fr/, "EntitySummaryHeader는 모바일 폭에서 액션과 본문이 겹치지 않도록 단일 컬럼이어야 합니다.");
assert.match(stylesSource, /@media \(max-width: 820px\)[\s\S]*\.entity-summary-actions[\s\S]*justify-content:\s*flex-start/, "EntitySummaryHeader 액션은 모바일 폭에서 본문 흐름 안에 정렬되어야 합니다.");
assert.match(stylesSource, /@media \(max-width: 820px\)[\s\S]*\.snapshot-comparison-grid[\s\S]*grid-template-columns:\s*1fr/, "히로인 스냅샷 비교 그리드는 모바일 폭에서 가로 overflow 없이 1컬럼이어야 합니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.button\.button-icon-only[\s\S]*flex:\s*0 0 44px/, "iconOnly Button은 모바일 일반 버튼 flex 규칙에 의해 전체 폭으로 늘어나면 안 됩니다.");

const heroineListSource = readText("apps/web/src/client/pages/heroines/HeroineListPage.tsx");
assert.match(heroineListSource, /StatusChip/, "히로인 목록은 공통 StatusChip을 사용해야 합니다.");
assert.match(heroineListSource, /상세보기/, "히로인 목록은 카드 클릭에 숨지 않는 상세보기 액션을 보여야 합니다.");
assert.match(heroineListSource, /iconOnly/, "히로인 목록 삭제 액션은 공통 iconOnly Button을 사용해야 합니다.");
assert.match(heroineListSource, /StatusRegion/, "히로인 목록 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");

const heroineDetailSource = readText("apps/web/src/client/pages/heroines/HeroineDetailPage.tsx");
assert.match(heroineDetailSource, /EntitySummaryHeader/, "히로인 상세는 핵심 identity/status/next action을 EntitySummaryHeader로 먼저 보여야 합니다.");
assert.match(heroineDetailSource, /ActionPanel/, "히로인 상세 작업 영역은 공통 ActionPanel로 액션 위계를 분리해야 합니다.");
assert.match(heroineDetailSource, /DiagnosticDrawer/, "히로인 상세의 내부 ID와 진단 정보는 접힘형 DiagnosticDrawer에 둬야 합니다.");
assert.match(heroineDetailSource, /primaryAction=\{\([\s\S]*히로인 기반 프로젝트 생성[\s\S]*\)\}/, "히로인 상세의 유일한 주 액션은 프로젝트 생성이어야 합니다.");
assert.match(heroineDetailSource, /title="위험 작업"[\s\S]*tone="danger"[\s\S]*variant="danger"/, "히로인 삭제는 일반 이동 액션과 분리된 danger ActionPanel에 있어야 합니다.");
assert.match(heroineDetailSource, /StatusRegion/, "히로인 상세 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");

const heroineFormSource = readText("apps/web/src/client/pages/heroines/HeroineFormPanel.tsx");
assert.match(heroineFormSource, /FieldGroup/, "히로인 생성/수정 폼은 공통 FieldGroup으로 입력을 묶어야 합니다.");
assert.match(heroineFormSource, /기본 정체성/, "히로인 폼은 기본 정체성 그룹을 가져야 합니다.");
assert.match(heroineFormSource, /필수/, "히로인 폼은 필수 입력 안내를 필드 근처에 보여야 합니다.");
assert.match(heroineFormSource, /touchedFields/, "히로인 폼은 최초 렌더부터 빈 필드를 오류로 칠하지 않고 사용자가 방문한 필드만 검증해야 합니다.");
assert.match(heroineFormSource, /onBlur=\{\(\) => markTouched\("name"\)\}/, "히로인 폼 필수 검증은 필드 blur 후에 시작되어야 합니다.");
assert.match(heroineFormSource, /showAllValidationErrors/, "히로인 폼은 저장 시도 후 누락 필드를 필드 단위 오류로 표시해야 합니다.");
assert.doesNotMatch(heroineFormSource, /aria-invalid=\{isRequiredEmpty\(draft,/, "히로인 폼은 빈 create 초안을 즉시 aria-invalid로 표시하면 안 됩니다.");

const heroineActionBarSource = readText("apps/web/src/client/pages/heroines/HeroineActionBar.tsx");
assert.match(heroineActionBarSource, /StickyActionBar/, "히로인 저장 작업은 공통 StickyActionBar를 사용해야 합니다.");
assert.match(heroineActionBarSource, /disabled=\{saving\}/, "히로인 저장 버튼은 검증 시도를 막지 않도록 저장 가능 여부만으로 비활성화하면 안 됩니다.");

const heroineEditorSource = readText("apps/web/src/client/pages/heroines/HeroineEditorScreen.tsx");
assert.match(heroineEditorSource, /StatusRegion/, "히로인 편집 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");
assert.match(heroineEditorSource, /validationSubmitted/, "히로인 편집 화면은 제출 시도 상태를 폼에 전달해야 합니다.");

const projectStartSource = readText("apps/web/src/client/pages/ProjectStartPage.tsx");
assert.match(projectStartSource, /StatusRegion/, "프로젝트 시작 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");

const projectNewSource = readText("apps/web/src/client/pages/projects/ProjectNewPage.tsx");
assert.match(projectNewSource, /StatusRegion/, "새 프로젝트 생성 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");

const recentProjectListSource = readText("apps/web/src/client/pages/projects/RecentProjectList.tsx");
assert.match(recentProjectListSource, /<Button[\s\S]*aria-label=\{`\$\{entry\.title\} 삭제`\}[\s\S]*iconOnly[\s\S]*variant="danger"[\s\S]*\/>/, "프로젝트 목록 삭제는 공통 iconOnly danger Button을 사용해야 합니다.");
assert.match(recentProjectListSource, /경로 복사/, "프로젝트 목록 긴 저장 경로는 모바일에서 title tooltip에만 의존하지 않고 복사 흐름을 제공해야 합니다.");

const projectDetailSource = readText("apps/web/src/client/pages/projects/ProjectDetailView.tsx");
assert.match(projectDetailSource, /DiagnosticDrawer/, "프로젝트 상세는 raw 저장 위치와 ID를 공통 DiagnosticDrawer로 접어야 합니다.");
assert.match(projectDetailSource, /ReadinessPanel/, "프로젝트 상세 프리뷰/내보내기는 공통 ReadinessPanel을 사용해야 합니다.");
assert.match(projectDetailSource, /tabShellStatus/, "프로젝트 상세 탭 라벨은 탭별 완료/필요/차단 상태를 표시해야 합니다.");
assert.match(projectDetailSource, /TabStatusList/, "프로젝트 개요 상태 요약은 공통 TabStatusList를 사용해야 합니다.");
assert.match(projectDetailSource, /AssetStatePanel/, "프로젝트 배경/이미지 작업 상태는 공통 AssetStatePanel을 사용해야 합니다.");
assert.match(projectDetailSource, /snapshot-comparison-grid/, "프로젝트 히로인 탭은 스냅샷과 라이브러리 원본 비교 레이아웃을 명시해야 합니다.");
assert.match(projectDetailSource, /배경 대상 진단/, "배경 탭의 raw 대상 정보는 진단 drawer에 있어야 합니다.");
assert.match(projectDetailSource, /배경 생성 작업 진단/, "배경 탭의 job/asset/backgroundAssetId는 진단 drawer에 있어야 합니다.");
assert.match(projectDetailSource, /생성된 배경 경로는 진단에서 확인/, "배경 탭의 긴 에셋 URI는 기본 본문이 아니라 진단 drawer에서 확인되어야 합니다.");
assert.match(projectDetailSource, /배경 교체 생성/, "기존 배경이 있는 상태의 생성 버튼은 교체 동작을 명확히 말해야 합니다.");
assert.match(projectDetailSource, /previewResolutionActions/, "프리뷰 누락 항목은 nextActions가 없어도 missingItems의 tab으로 해결 이동 버튼을 만들어야 합니다.");
assert.match(projectDetailSource, /fallbackPreviewCanRun/, "프리뷰 실행 버튼은 previewReadiness DTO가 없어도 workflow summary ready 상태를 fallback으로 반영해야 합니다.");
assert.match(projectDetailSource, /setPreviewReadiness\(\{[\s\S]*state: "prepared"[\s\S]*canRun: true[\s\S]*nextAction: "프리뷰를 실행할 수 있습니다\."/m, "프리뷰 검증 성공은 이전 blocked readiness DTO를 실행 가능 상태로 갱신해야 합니다.");
assert.match(projectDetailSource, /exportRunReady/, "내보내기 실행 primary는 readiness가 준비된 상태에서만 활성화되어야 합니다.");
assert.doesNotMatch(projectDetailSource, /이미지 만들기[\s\S]{0,160}variant="primary"/, "배경 탭에서 이미지 만들기는 배경 생성/프리뷰 primary와 경쟁하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /githubPagesTarget: \{String\(currentExportPlan\.githubPagesTarget\)\}/, "GitHub Pages 진단값은 기본 내보내기 본문에 항상 노출되면 안 됩니다.");
