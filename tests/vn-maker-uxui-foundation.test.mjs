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

const heroineCreateSource = readText("apps/web/src/client/pages/heroines/HeroineCreatePage.tsx");
assert.match(heroineCreateSource, /필수 입력 대기/, "새 히로인 최초 진입 sticky summary는 즉시 오류처럼 보이지 않는 중립 상태여야 합니다.");
assert.match(heroineCreateSource, /validationFailureSummary/, "새 히로인 저장 시도 후에만 실제 누락 필드 요약을 상태 메시지로 보여야 합니다.");

const projectStartSource = readText("apps/web/src/client/pages/ProjectStartPage.tsx");
assert.match(projectStartSource, /StatusRegion/, "프로젝트 시작 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");

const projectNewSource = readText("apps/web/src/client/pages/projects/ProjectNewPage.tsx");
assert.match(projectNewSource, /StatusRegion/, "새 프로젝트 생성 상태 메시지는 공통 StatusRegion 안에 있어야 합니다.");

const recentProjectListSource = readText("apps/web/src/client/pages/projects/RecentProjectList.tsx");
assert.match(recentProjectListSource, /<Button[\s\S]*aria-label=\{`\$\{entry\.title\} 삭제`\}[\s\S]*iconOnly[\s\S]*variant="danger"[\s\S]*\/>/, "프로젝트 목록 삭제는 공통 iconOnly danger Button을 사용해야 합니다.");
assert.match(recentProjectListSource, /경로 복사/, "프로젝트 목록 긴 저장 경로는 모바일에서 title tooltip에만 의존하지 않고 복사 흐름을 제공해야 합니다.");

const projectDetailSource = readText("apps/web/src/client/pages/projects/ProjectDetailView.tsx");
const projectDetailStateSource = readText("apps/web/src/client/pages/projects/projectDetailState.ts");
assert.match(projectDetailSource, /DiagnosticDrawer/, "프로젝트 상세는 raw 저장 위치와 ID를 공통 DiagnosticDrawer로 접어야 합니다.");
assert.match(projectDetailSource, /ReadinessPanel/, "프로젝트 상세 프리뷰/내보내기는 공통 ReadinessPanel을 사용해야 합니다.");
assert.match(projectDetailSource, /tabShellStatus/, "프로젝트 상세 탭 라벨은 탭별 완료/필요/차단 상태를 표시해야 합니다.");
assert.match(projectDetailSource, /tab === "studio"[\s\S]*return "준비 중"/, "준비 중인 제작 탭은 워크플로 단계 완료 상태를 그대로 표시하지 않아야 합니다.");
assert.match(projectDetailSource, /displayWorkflowStep/, "프로젝트 개요는 raw workflow 단계 대신 표시용 단계 상태를 사용해야 합니다.");
assert.match(projectDetailSource, /visibleWorkflowSteps/, "프로젝트 개요 단계 요약은 표시용 workflow steps로 집계해야 합니다.");
assert.doesNotMatch(projectDetailSource, /summary\.steps\?\.filter\(\(step\) => step\.state === "done"\)/, "프로젝트 개요 완료 집계는 raw workflow step state를 그대로 세면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /summary\.steps\?\.map\(\(step\)/, "프로젝트 개요 stepper는 raw workflow steps를 그대로 렌더링하면 안 됩니다.");
assert.match(projectDetailSource, /TabStatusList/, "프로젝트 개요 상태 요약은 공통 TabStatusList를 사용해야 합니다.");
assert.match(projectDetailSource, /AssetStatePanel/, "프로젝트 배경/이미지 작업 상태는 공통 AssetStatePanel을 사용해야 합니다.");
assert.match(projectDetailSource, /snapshot-comparison-grid/, "프로젝트 히로인 탭은 스냅샷과 라이브러리 원본 비교 레이아웃을 명시해야 합니다.");
assert.match(projectDetailSource, /배경 대상 진단/, "배경 탭의 raw 대상 정보는 진단 drawer에 있어야 합니다.");
assert.match(projectDetailSource, /배경 생성 작업 진단/, "배경 탭의 job/asset/backgroundAssetId는 진단 drawer에 있어야 합니다.");
assert.match(projectDetailSource, /생성된 배경 경로는 진단에서 확인/, "배경 탭의 긴 에셋 URI는 기본 본문이 아니라 진단 drawer에서 확인되어야 합니다.");
assert.match(projectDetailSource, /backgroundConnectionText/, "배경 기본 본문은 raw asset id 대신 사용자용 연결 상태를 보여야 합니다.");
assert.match(projectDetailSource, /backgroundSceneConnectionText/, "배경 기본 본문은 backgroundAssetId 대신 사용자용 장면 연결 상태를 보여야 합니다.");
assert.match(projectDetailSource, /backgroundAssetDisplayLabel/, "배경 기본 본문은 생성 provenance가 섞인 에셋 라벨을 사용자용 라벨로 정리해야 합니다.");
assert.doesNotMatch(projectDetailSource, /backgroundAssetId \$\{backgroundLinkedScene/, "배경 기본 본문은 backgroundAssetId를 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /<div><dt>에셋 연결<\/dt><dd>\{currentBackgroundAsset\?\.id/, "배경 기본 본문은 에셋 ID를 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /기존 배경 교체: \$\{currentBackgroundAsset\.id\}/, "배경 기본 본문은 교체 대상에 raw asset id를 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /실패하면 OAuth, app-server, adapter, 응답 파싱/, "배경 기본 본문은 오류 분류를 내부 시스템 용어 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /생성 어댑터|setBackgroundStatus\("adapter:/, "배경 기본 본문은 adapter 계열 내부 용어를 노출하면 안 됩니다.");
assert.match(projectDetailSource, /배경 교체 생성/, "기존 배경이 있는 상태의 생성 버튼은 교체 동작을 명확히 말해야 합니다.");
assert.match(projectDetailSource, /previewResolutionActions/, "프리뷰 누락 항목은 nextActions가 없어도 missingItems의 tab으로 해결 이동 버튼을 만들어야 합니다.");
assert.match(projectDetailSource, /fallbackPreviewCanRun/, "프리뷰 실행 버튼은 previewReadiness DTO가 없어도 workflow summary ready 상태를 fallback으로 반영해야 합니다.");
assert.match(projectDetailSource, /createPreviewReadinessFallback/, "프로젝트 상세는 중앙 상태 모듈의 preview readiness fallback을 사용해야 합니다.");
assert.match(projectDetailStateSource, /createPreviewReadinessFallback/, "프리뷰 readiness DTO가 없을 때 화면에 모순된 empty DTO 대신 프로젝트와 workflow summary 기반 fallback을 중앙 상태 모듈에서 만들어야 합니다.");
assert.match(projectDetailSource, /createExportPlanFallback/, "프로젝트 상세는 중앙 상태 모듈의 export plan fallback을 사용해야 합니다.");
assert.match(projectDetailStateSource, /createExportPlanFallback/, "내보내기 plan DTO가 없을 때 화면에 모순된 empty DTO 대신 프로젝트와 workflow summary 기반 fallback을 중앙 상태 모듈에서 만들어야 합니다.");
assert.doesNotMatch(projectDetailSource, /프로젝트 상태 DTO를 기다리는 중입니다/, "프로젝트 상세는 내부 DTO 대기 문구를 사용자 화면 fallback으로 노출하면 안 됩니다.");
assert.match(projectDetailSource, /tabsWithLocalPrimaryAction/, "프로젝트 상세 헤더 CTA는 탭 본문 primary action과 경쟁하지 않도록 로컬 CTA 탭에서 숨겨야 합니다.");
assert.match(projectDetailSource, /showHeaderPrimaryAction/, "프로젝트 상세는 헤더 CTA 노출 조건을 명시해야 합니다.");
assert.match(projectDetailSource, /준비 상태/, "프리뷰 readiness 라벨은 내부 DTO 이름 대신 사용자용 문구여야 합니다.");
assert.doesNotMatch(projectDetailSource, /<dt>previewReadiness<\/dt>/, "프리뷰 본문은 previewReadiness 같은 내부 DTO 이름을 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /availableState: \{currentPreviewReadiness/, "프리뷰 본문은 availableState 같은 내부 필드명을 그대로 노출하면 안 됩니다.");
assert.match(projectDetailSource, /setPreviewReadiness\(\{[\s\S]*state: "prepared"[\s\S]*canRun: true[\s\S]*nextAction: "프리뷰를 실행할 수 있습니다\."/m, "프리뷰 검증 성공은 이전 blocked readiness DTO를 실행 가능 상태로 갱신해야 합니다.");
assert.match(projectDetailSource, /exportRunReady/, "내보내기 실행 primary는 readiness가 준비된 상태에서만 활성화되어야 합니다.");
assert.match(projectDetailSource, /다음 작업: 프리뷰 확인/, "내보내기 보조 이동 버튼은 다음 action 대신 한국어 작업 용어를 사용해야 합니다.");
assert.match(projectDetailSource, /exportValidationSummaryText/, "내보내기 검증 요약은 validationSummary 원문 대신 사용자용 문구로 변환해야 합니다.");
assert.match(projectDetailSource, /exportAssetSummaryText/, "내보내기 포함 에셋은 raw kind:id 대신 사용자용 개수 요약으로 변환해야 합니다.");
assert.doesNotMatch(projectDetailSource, />validationSummary/, "내보내기 본문은 validationSummary 같은 내부 필드명을 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /issues \{currentExportPlan/, "내보내기 본문은 issues 같은 내부 필드명을 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /\$\{asset\.kind\}:\$\{asset\.id\}/, "내보내기 포함 에셋은 raw kind:id 조합을 기본 본문에 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /EXPORT_BLOCKED 상태/, "내보내기 본문은 EXPORT_BLOCKED 같은 내부 코드를 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /githubPagesTarget/, "내보내기 화면은 GitHub Pages 관련 내부 타깃 값을 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /GitHub Pages/, "내보내기 화면은 주인님이 요구하지 않은 GitHub Pages 문구를 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /plan state/, "내보내기 진단은 plan state 같은 내부 라벨을 그대로 노출하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /이미지 만들기[\s\S]{0,160}variant="primary"/, "배경 탭에서 이미지 만들기는 배경 생성/프리뷰 primary와 경쟁하면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /githubPagesTarget: \{String\(currentExportPlan\.githubPagesTarget\)\}/, "GitHub Pages 진단값은 기본 내보내기 본문에 항상 노출되면 안 됩니다.");
assert.match(projectDetailSource, /<h3>실행 화면<\/h3>/, "프리뷰 기본 본문은 runtime 플레이 대신 실행 화면으로 보여야 합니다.");

const heroinePortraitPanelSource = readText("apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx");
assert.match(heroinePortraitPanelSource, /이미지 생성 가능/, "히로인 포트레이트 기본 화면은 imageGeneration 내부 용어 대신 사용자용 문구를 보여야 합니다.");
assert.doesNotMatch(heroinePortraitPanelSource, /imageGeneration 가능|imageGeneration 상태/, "히로인 포트레이트 기본 화면은 imageGeneration 내부 용어를 노출하면 안 됩니다.");

const clientStylesSource = readText("apps/web/src/client/styles.css");
assert.match(clientStylesSource, /\.project-detail-panel\s*{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, "프로젝트 상세 패널은 탭 레일의 최대 콘텐츠 폭을 본문 폭으로 전파하면 안 됩니다.");
assert.match(clientStylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list\s*{[\s\S]*overflow-x: auto/, "모바일 탭은 2열 압축 대신 가로 스캔 가능한 레일이어야 합니다.");
assert.match(clientStylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list\s*{[\s\S]*width: 100%[\s\S]*max-width: 100%/, "모바일 탭 레일은 페이지 전체 폭을 밀면 안 됩니다.");
assert.match(clientStylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list-item\s*{[\s\S]*min-width: 136px/, "모바일 탭은 과도한 줄바꿈을 막는 최소 폭을 가져야 합니다.");
assert.match(clientStylesSource, /@media \(max-width: 560px\)[\s\S]*\.project-detail-panel,\s*\.detail-tab-body\s*{[\s\S]*overflow-x: hidden/, "모바일 상세 본문은 탭 레일 때문에 옆으로 밀리면 안 됩니다.");
assert.match(clientStylesSource, /@media \(max-width: 560px\)[\s\S]*\.detail-tab-grid\s*{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, "모바일 상세 탭 본문은 카드가 옆으로 남지 않도록 1열이어야 합니다.");
