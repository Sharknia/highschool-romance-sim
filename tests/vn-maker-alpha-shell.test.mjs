import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function readText(path) {
  return readFileSync(join(root, path), "utf8");
}

const appSource = readText("apps/web/src/client/App.tsx");
const apiClientSource = readText("apps/web/src/client/api/client.ts");

[
  "EMPTY_RESPONSE",
  "NON_JSON_RESPONSE",
  "NETWORK_ERROR",
  "httpStatus >= 500",
  "nextAction",
  "retryable"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(apiClientSource, pattern, `프론트 API 클라이언트는 빈 응답/nonJSON/5xx/네트워크 실패를 안전하게 표시해야 합니다: ${requiredText}`);
});

assert.match(
  appSource,
  /<Route path="\/" element={<RootRedirect \/?>} \/>/,
  "`/`는 전용 RootRedirect로 인증 상태에 따라 분기해야 합니다."
);
assert.match(appSource, /<Navigate to="\/heroines" replace \/>/, "`/` 인증 후 기본 화면은 히로인 관리여야 합니다.");
["/projects", "/heroines", "/settings"].forEach((path) => {
  assert.match(appSource, new RegExp(`<Route path="${path}"`), `${path} 인증 앱 라우트가 있어야 합니다.`);
});
["/projects/new", "/projects/:projectId", "/projects/:projectId/:tab"].forEach((path) => {
  assert.match(appSource, new RegExp(`<Route path="${path}"`), `${path} 프로젝트 상세 deep link 라우트가 있어야 합니다.`);
});
assert.ok(
  appSource.indexOf('path="/projects/new"') < appSource.indexOf('path="/projects/:projectId"'),
  "`/projects/new`는 `/projects/:projectId`보다 먼저 선언해야 합니다."
);
assert.match(appSource, /<Route path="\/heroines\/:heroineId"/, "`/heroines/:heroineId` 히로인 상세 라우트가 있어야 합니다.");
assert.match(appSource, /<Route path="\/heroines\/new"/, "`/heroines/new` 히로인 생성 라우트가 있어야 합니다.");
assert.match(appSource, /<Route path="\/heroines\/:heroineId\/edit"/, "`/heroines/:heroineId/edit` 히로인 수정 라우트가 있어야 합니다.");
assert.match(appSource, /HeroineListPage/, "`/heroines`는 HeroineListPage를 렌더링해야 합니다.");
assert.match(appSource, /HeroineCreatePage/, "`/heroines/new`는 HeroineCreatePage를 렌더링해야 합니다.");
assert.match(appSource, /HeroineDetailPage/, "`/heroines/:heroineId`는 HeroineDetailPage를 렌더링해야 합니다.");
assert.match(appSource, /HeroineEditPage/, "`/heroines/:heroineId/edit`는 HeroineEditPage를 렌더링해야 합니다.");
assert.doesNotMatch(
  appSource,
  /<Route path="\/" element={<WorkspacePage \/?>} \/>/,
  "`/`는 단일 WorkspacePage를 직접 렌더링하면 안 됩니다."
);
assert.doesNotMatch(appSource, /to="\/project-management"/, "프로젝트 관리는 /projects 라우트를 사용해야 합니다.");
assert.doesNotMatch(appSource, /프로젝트 관리 메뉴/, "App.tsx에 별도 프로젝트 관리 메뉴를 추가하면 안 됩니다.");

const workspaceLayoutPath = "apps/web/src/client/components/WorkspaceLayout.tsx";
assert.ok(existsSync(join(root, workspaceLayoutPath)), "인증 후 WorkspaceLayout 컴포넌트가 있어야 합니다.");
const workspaceLayoutSource = readText(workspaceLayoutPath);
assert.match(workspaceLayoutSource, /projectDirectory: string;/, "WorkspaceLayout은 현재 프로젝트 저장 위치를 전역 상태로 소유해야 합니다.");
const navLabels = [...workspaceLayoutSource.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
const navPaths = [...workspaceLayoutSource.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(navLabels, ["히로인 관리", "프로젝트 관리", "설정"], "히로인 관리는 프로젝트 관리보다 먼저 보여야 합니다.");
assert.deepEqual(navPaths, ["/heroines", "/projects", "/settings"], "인증 후 앱 네비게이션 path는 /heroines, /projects, /settings 순서여야 합니다.");
assert.doesNotMatch(workspaceLayoutSource, /\/login/, "`/login`은 앱 네비게이션에 포함되면 안 됩니다.");
assert.doesNotMatch(workspaceLayoutSource, /상태 갱신|로그아웃|refreshSession|logout/, "상단 상태 갱신/로그아웃 버튼은 앱 shell에서 제거해야 합니다.");

const appShellSource = readText("apps/web/src/client/components/ui/AppShell.tsx");
["projectTitle", "storageSummary", "validationStatus", "codexStatus", "topbar-meta"].forEach((removedText) => {
  assert.doesNotMatch(appShellSource, new RegExp(removedText), `AppShell 상단 상태바에서 ${removedText}는 제거되어야 합니다.`);
});
["저장 위치", "검증", "Codex ChatGPT OAuth"].forEach((label) => {
  assert.doesNotMatch(appShellSource, new RegExp(label), `AppShell은 '${label}' 전역 상태를 표시하면 안 됩니다.`);
});

const notFoundSource = readText("apps/web/src/client/pages/NotFoundPage.tsx");
assert.match(notFoundSource, /to="\/heroines"/, "인증 후 Not Found 복귀 링크는 /heroines여야 합니다.");

[
  "apps/web/src/client/pages/ProjectStartPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineListPage.tsx"
].forEach((pagePath) => {
  const pageSource = readText(pagePath);
  assert.match(pageSource, /page-primary-action/, `${pagePath}는 page-local primary action을 가져야 합니다.`);
  assert.match(pageSource, /page-status/, `${pagePath}는 page-local 상태 문장을 가져야 합니다.`);
});
const settingsStartSource = readText("apps/web/src/client/pages/SettingsStartPage.tsx");
assert.match(settingsStartSource, /page-status/, "SettingsStartPage는 page-local 상태 문장을 가져야 합니다.");
assert.doesNotMatch(settingsStartSource, /상태 갱신|로그아웃|refreshSession/, "SettingsStartPage는 수동 상태 갱신/로그아웃 버튼을 노출하면 안 됩니다.");
const projectStartSource = readText("apps/web/src/client/pages/ProjectStartPage.tsx");
assert.match(projectStartSource, /shellState/, "ProjectStartPage는 현재 프로젝트 요약을 전역 shell state에서 읽어야 합니다.");
assert.match(projectStartSource, /projectDirectory:/, "ProjectStartPage는 프로젝트 열기 성공 시 저장 위치를 전역 shell state에 반영해야 합니다.");
assert.match(projectStartSource, /approveEvent/, "ProjectStartPage는 이벤트 승인 action 결과를 구분해 상태 문구를 표시해야 합니다.");
assert.match(projectStartSource, /이벤트 제안 승인 완료/, "ProjectStartPage는 이벤트 승인 후 히로인 배정 완료 문구를 재사용하면 안 됩니다.");
const deleteConfirmDialogPath = "apps/web/src/client/components/ui/DeleteConfirmDialog.tsx";
assert.ok(existsSync(join(root, deleteConfirmDialogPath)), "공유 DeleteConfirmDialog 컴포넌트가 있어야 합니다.");
const deleteConfirmDialogSource = readText(deleteConfirmDialogPath);
[
  "영향 범위",
  "되돌릴 수 없음",
  "삭제 실패",
  "다시 시도",
  "confirmationValue.trim() === expectedConfirmation",
  "requiresConfirmation?: boolean",
  "inputRef.current?.focus()",
  "event.key === \"Escape\"",
  "trapDialogFocus"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(deleteConfirmDialogSource, pattern, `DeleteConfirmDialog 소스에 '${requiredText}' 문구 또는 로직이 있어야 합니다.`);
});
assert.match(deleteConfirmDialogSource, /retryAction\.onSelect\(confirmationValue\.trim\(\)\)/, "DeleteConfirmDialog retry는 현재 확인 입력값의 trim 결과를 전달해야 합니다.");
assert.match(deleteConfirmDialogSource, /primaryAction\.onSelect\(confirmationValue\.trim\(\)\)/, "DeleteConfirmDialog primary action은 trim된 확인 입력값을 전달해야 합니다.");
const sharedUiIndexSource = readText("apps/web/src/client/components/ui/index.ts");
assert.match(sharedUiIndexSource, /DeleteConfirmDialog/, "공통 UI index는 DeleteConfirmDialog를 export해야 합니다.");
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
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(tabListSource, pattern, `TabList에 '${requiredText}' 처리가 있어야 합니다.`);
});
[
  "const location = useLocation()",
  "onBeforeNavigate?.(item) === false",
  "aria-selected={isActiveTab(item)}",
  "item.status",
  "useRef",
  "tabRefs",
  "enabledItems.length <= 1",
  "tabIndex={isActive ? 0 : -1}",
  "tabRefs.current.get(next.id)?.focus()",
  "if (isActiveTab(item))"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(tabListSource, pattern, `TabList 구현에 '${requiredText}'가 있어야 합니다.`);
});
assert.match(sharedUiIndexSource, /TabList/, "중앙 UI index에서 TabList를 export해야 합니다.");
const heroineDeleteDialogSource = readText("apps/web/src/client/pages/heroines/HeroineDeleteDialog.tsx");
assert.match(heroineDeleteDialogSource, /DeleteConfirmDialog/, "HeroineDeleteDialog는 공유 DeleteConfirmDialog를 사용해야 합니다.");
assert.match(heroineDeleteDialogSource, /requiresConfirmation:\s*false/, "히로인 conflict reload는 확인 이름 입력 전에도 실행할 수 있어야 합니다.");
assert.doesNotMatch(projectStartSource, /ProjectDeleteDialog/, "ProjectStartPage는 별도 ProjectDeleteDialog를 만들면 안 됩니다.");
const recentProjectListPath = "apps/web/src/client/pages/projects/RecentProjectList.tsx";
const projectDetailViewPath = "apps/web/src/client/pages/projects/ProjectDetailView.tsx";
const projectNewPagePath = "apps/web/src/client/pages/projects/ProjectNewPage.tsx";
const projectApiPath = "apps/web/src/client/pages/projects/projectApi.ts";
assert.ok(existsSync(join(root, recentProjectListPath)), "최근 프로젝트 목록은 별도 RecentProjectList 컴포넌트로 분리해야 합니다.");
assert.ok(existsSync(join(root, projectDetailViewPath)), "프로젝트 상세 탭은 별도 ProjectDetailView 컴포넌트로 분리해야 합니다.");
assert.ok(existsSync(join(root, projectNewPagePath)), "새 프로젝트 생성 화면은 별도 ProjectNewPage 컴포넌트로 분리해야 합니다.");
assert.ok(existsSync(join(root, projectApiPath)), "프로젝트 목록 API wrapper는 projectApi.ts로 분리해야 합니다.");
const recentProjectListSource = readText(recentProjectListPath);
const projectDetailViewSource = readText(projectDetailViewPath);
const projectPageTypesSource = readText("apps/web/src/client/pages/projects/projectPageTypes.ts");
const projectNewPageSource = readText(projectNewPagePath);
const projectApiSource = readText(projectApiPath);
const clientStylesSource = readText("apps/web/src/client/styles.css");
const detailTabsBlock = projectPageTypesSource.match(/export const detailTabs = \[[\s\S]*?\] as const;/)?.[0] || "";
const visibleShellStart = projectDetailViewSource.indexOf("<TabList");
const visibleShellEnd = projectDetailViewSource.indexOf('activeTab === "preview"', visibleShellStart);
const visibleShellBlock = visibleShellStart >= 0 && visibleShellEnd > visibleShellStart
  ? projectDetailViewSource.slice(visibleShellStart, visibleShellEnd)
  : projectDetailViewSource;
const studioStart = projectDetailViewSource.indexOf('data-testid="studio-under-construction"');
const studioEndCandidate = studioStart >= 0 ? projectDetailViewSource.indexOf('activeTab === "background"', studioStart) : -1;
const studioBranch = studioStart >= 0 && studioEndCandidate > studioStart
  ? projectDetailViewSource.slice(studioStart, studioEndCandidate)
  : "";
assert.match(recentProjectListSource, /ContentList/, "RecentProjectList는 중앙 ContentList 패턴을 사용해야 합니다.");
assert.ok(
  projectStartSource.includes('type ProjectListState = "loading" | "empty" | "ready" | "error" | "deleting";'),
  "ProjectStartPage는 프로젝트 목록 상태 union 타입을 가져야 합니다."
);
assert.match(projectStartSource, /function loadRecentProjects\(/, "프로젝트 목록 새로고침 실패는 catch 포함 loader에서 처리해야 합니다.");
assert.match(projectStartSource, /onRefresh=\{\(\) => void loadRecentProjects\(\)\}/, "수동 새로고침은 unhandled rejection 없이 loader를 사용해야 합니다.");
assert.match(projectStartSource, /if\s*\(tab && normalizeTab\(tab\) !== tab\)/, "명시된 legacy project detail tab alias만 정규화하고 /projects/:projectId/overview 복원은 막으면 안 됩니다.");
assert.match(projectStartSource, /navigate\(`\/projects\/\$\{projectId\}\/\$\{normalizeTab\(tab\)\}`/, "legacy project detail tab alias는 overview가 아니라 normalizeTab 결과로 정규화해야 합니다.");
assert.match(recentProjectListSource, /recent-project-menu-actions/, "최근 프로젝트 삭제 메뉴는 여러 액션이 겹치지 않는 컨테이너를 가져야 합니다.");
assert.match(clientStylesSource, /\.recent-project-field\s*\{[\s\S]*display:\s*block/, "최근 프로젝트 필드는 저장 위치/상태/수정 시각이 이어붙지 않도록 줄 단위로 표시해야 합니다.");
assert.match(recentProjectListSource, /onPrepareDelete:\s*\(entry:\s*RecentProject,\s*trigger:\s*HTMLElement\)\s*=>\s*void/, "최근 프로젝트 삭제 준비는 포커스 복귀용 트리거 버튼을 전달해야 합니다.");
assert.match(recentProjectListSource, /onPrepareDelete\(entry,\s*event\.currentTarget\)/, "삭제 버튼 클릭 시 현재 버튼을 포커스 복귀 대상으로 전달해야 합니다.");
assert.match(projectStartSource, /deleteReturnFocusRef/, "ProjectStartPage는 삭제 dialog 닫힘 후 돌아갈 포커스 대상을 저장해야 합니다.");
assert.match(projectStartSource, /deleteReturnFocusRef\.current\?\.focus\(\)/, "삭제 dialog 닫힘 후 삭제 트리거 버튼으로 포커스를 복귀해야 합니다.");
assert.match(clientStylesSource, /\.button\s*\{[\s\S]*min-height:\s*40px/, "기본 버튼은 모바일 터치 기준을 위해 최소 40px 높이를 가져야 합니다.");
[
  ["projectFailureText", ""],
  ["listRecentProjects", "/api/projects/recent/list"],
  ["removeRecentProject", "/api/projects/recent/remove"],
  ["restoreRecentProject", "/api/projects/recent/restore"],
  ["deleteProjectFiles", "/api/projects/delete"],
  ["openProject", "/api/projects/open"],
  ["reconnectProject", "/api/projects/reconnect"]
].forEach(([wrapperName, apiPath]) => {
  assert.match(projectApiSource, new RegExp(`function\\s+${wrapperName}\\b`), `projectApi.ts는 ${wrapperName} wrapper를 export해야 합니다.`);
  if (apiPath) {
    assert.match(
      projectApiSource,
      new RegExp(apiPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `projectApi.ts는 ${apiPath} 호출 경계를 소유해야 합니다.`
    );
  }
});
assert.match(projectApiSource, /confirmTitle:\s*string/, "deleteProjectFiles wrapper는 confirmTitle 입력 계약을 타입으로 강제해야 합니다.");
assert.match(projectApiSource, /confirmTitle/, "deleteProjectFiles wrapper는 /api/projects/delete에 confirmTitle을 전달해야 합니다.");
assert.match(projectStartSource, /confirmTitle:\s*confirmationTitle\.trim\(\)/, "프로젝트 삭제 호출은 확인 제목을 confirmTitle로 전달해야 합니다.");
assert.match(projectStartSource, /retryAction=\{deleteError && deleteErrorSource === "files" \? \{[\s\S]*onSelect: \(confirmationValue\) => void deleteProjectFiles\(deleteTarget, confirmationValue\)/, "프로젝트 삭제 retry는 dialog의 현재 확인 입력값을 재사용해야 합니다.");
assert.match(projectStartSource, /applyRecentProjectList\(result\)/, "프로젝트 삭제 성공 후에는 delete API 응답 projects를 먼저 반영해야 합니다.");
assert.match(projectStartSource, /void loadRecentProjects\(\)/, "프로젝트 삭제 성공 후 목록 재조회 실패는 삭제 실패와 분리해야 합니다.");
assert.doesNotMatch(projectStartSource, /confirmationTitle:\s*confirmationTitle\.trim\(\)/, "프로젝트 삭제 호출은 #20 계약에 없는 confirmationTitle 필드를 보내면 안 됩니다.");
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
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(`${projectStartSource}\n${recentProjectListSource}`, pattern, `프로젝트 목록 화면 소스에 '${requiredText}' 문구가 있어야 합니다.`);
});
["overview", "heroine", "background", "studio", "preview", "export"].forEach((tab) => {
  assert.match(projectPageTypesSource, new RegExp(`id: "${tab}"`), `${tab} 탭 정의가 있어야 합니다.`);
  assert.match(projectDetailViewSource, new RegExp(`activeTab === "${tab}"`), `${tab} 탭 body가 있어야 합니다.`);
});
["event", "assets"].forEach((legacyTab) => {
  assert.doesNotMatch(detailTabsBlock, new RegExp(`id: "${legacyTab}"`), `${legacyTab}는 Alpha visible IA 탭이면 안 됩니다.`);
});
assert.doesNotMatch(projectDetailViewSource, /project-tab-list/, "ProjectDetailView는 로컬 project-tab-list를 렌더링하면 안 됩니다.");
assert.match(projectDetailViewSource, /<TabList/, "ProjectDetailView는 중앙 TabList를 사용해야 합니다.");
assert.match(appSource, /Navigate/, "`/projects/:projectId`는 overview로 정규화되어야 합니다.");
assert.match(appSource, /\/projects\/:projectId\/overview/, "`/projects/:projectId` 기본 라우트가 overview 링크 또는 리다이렉트를 제공해야 합니다.");
[
  "저장 위치",
  "현재 상태",
  "상태 요약",
  "다음 행동",
  "해결해야 할 차단 항목",
  "배경 화면 생성으로 이동"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `개요 탭에 '${requiredText}' 표시가 있어야 합니다.`);
});
[
  "프로젝트 스냅샷",
  "라이브러리 원본",
  "원본 수정 아님",
  "원본과 다른 필드",
  "스냅샷 선택",
  "프로젝트에 저장된 표시 이름",
  "라이브러리 원본 이름",
  "원본 히로인 ID",
  "스냅샷 생성 시각",
  "저장 상태",
  "마지막 수정 시각",
  "히로인 관리로 이동",
  "프로젝트 캐릭터 ID"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `히로인 탭에 '${requiredText}' 문구가 있어야 합니다.`);
});
[
  'activeTab === "background"',
  "/projects/${currentProject?.id || projectId}/background",
  "대상 프로젝트",
  "Alpha에서는 프로젝트당 배경 1개만 생성할 수 있습니다.",
  "생성할 배경 설명",
  "저장될 결과 위치",
  "기존 배경 교체",
  "kind: \"background\"",
  "/api/generation/jobs",
  "/api/generation/jobs/run",
  "OAuth",
  "app-server",
  "adapter",
  "응답 파싱",
  "다시 시도",
  "backgroundAssetId",
  "저장 위치/에셋 연결 상태",
  "isVisualImageJob",
  "generationErrorCategory"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `배경 화면 생성 탭에 '${requiredText}' 처리가 있어야 합니다.`);
});
[
  'data-testid="studio-under-construction"',
  'activeTab === "studio"',
  "제작 탭은 준비 중입니다.",
  "시나리오 작성",
  "분기 편집",
  "장면 구성",
  "실제 동작하지 않는 제작 버튼은 제공하지 않습니다."
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `제작 탭에 '${requiredText}' 표시가 있어야 합니다.`);
});
[
  "이벤트 제안 받기",
  "제안 승인",
  "가짜 진행",
  "완료율",
  "제작 시작"
].forEach((blockedText) => {
  const pattern = new RegExp(blockedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.doesNotMatch(studioBranch, pattern, `studio 탭은 '${blockedText}'를 노출하면 안 됩니다.`);
});
[
  "detail-tab-grid",
  "detail-card",
  "detail-card-wide",
  "summary-list",
  "state-chip",
  "page-header",
  "page-primary-action",
  "Button"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `Project detail shell must reuse ${requiredText}.`);
});
[
  ".detail-tab-grid",
  ".detail-card",
  ".detail-card-wide",
  ".state-chip",
  ".tab-list",
  ".page-header",
  ".page-primary-action",
  ".panel-actions"
].forEach((selector) => {
  const pattern = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(clientStylesSource, pattern, `${selector} style must exist.`);
});
assert.match(
  clientStylesSource,
  /\.content-list,\s*\.recent-project-list,\s*\.project-tab-list,\s*\.tab-list\s*{[\s\S]*display: grid/,
  "tab-list는 기존 탭/리스트 grid 기본 스타일을 공유해야 합니다."
);
assert.match(
  clientStylesSource,
  /\.project-tab-list,\s*\.tab-list\s*{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  "tab-list는 태블릿 폭에서 project-tab-list와 같은 3열 반응형을 가져야 합니다."
);
assert.match(
  clientStylesSource,
  /\.project-tab-list,\s*\.tab-list\s*{[\s\S]*grid-template-columns: 1fr 1fr/,
  "tab-list는 모바일 폭에서 project-tab-list와 같은 2열 반응형을 가져야 합니다."
);
const heroineDetailSource = readText("apps/web/src/client/pages/heroines/HeroineDetailPage.tsx");
assert.match(heroineDetailSource, /detail-card|summary-list|state-chip/, "Project detail density should align with heroine detail patterns.");
assert.match(projectDetailViewSource, /variant="primary"|variant=\{"primary"\}/, "Overview/detail primary action must use shared Button primary hierarchy.");
assert.match(projectDetailViewSource, /<Button/, "Project detail actions must use the shared Button component.");
[
  "/api/projects/recent/list",
  "/api/projects/recent/remove",
  "/api/projects/recent/restore",
  "/api/projects/reconnect",
  "workflowSummary",
  "최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.",
  "프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.",
  "프로젝트 ID가 일치하지 않습니다. 자동으로 덮어쓰지 않았습니다.",
  "목록에서만 제거",
  "되돌리기",
  "필터 결과",
  "재연결이 필요한 프로젝트"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(`${projectStartSource}\n${recentProjectListSource}\n${projectDetailViewSource}\n${projectApiSource}`, pattern, `프로젝트 페이지 소스에 '${requiredText}' 문구 또는 API 호출이 있어야 합니다.`);
});
[
  "/api/heroines/list",
  "/api/projects/${",
  "/heroine",
  "히로인 1명을 먼저 선택해야 합니다.",
  "선택한 히로인 배정",
  "스냅샷 선택",
  "제작으로 이동",
  "sourceHeroineId",
  "sourceSnapshotCreatedAt",
  "완료된 단계",
  "남은 단계",
  "blockingIssues",
  "validationState",
  "generationState",
  "previewState",
  "exportState"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `ProjectDetailView에 '${requiredText}' 문구 또는 상태 표시가 있어야 합니다.`);
});
assert.doesNotMatch(projectDetailViewSource, /후속 이슈에서 편집 흐름을 연결합니다/, "히로인 탭은 placeholder가 아니라 실제 배정 흐름이어야 합니다.");
[
  "/event",
  "/assets",
  "goToEvent",
  "goToAssets",
  "제작/이벤트로 이동",
  "이벤트 제안 받기",
  "제안 승인",
  "CG 작업이 있으면 에셋/생성 탭으로 이동합니다."
].forEach((legacyVisibleText) => {
  const pattern = new RegExp(legacyVisibleText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.doesNotMatch(visibleShellBlock, pattern, `visible ProjectDetailView에 '${legacyVisibleText}'가 남으면 안 됩니다.`);
});
assert.doesNotMatch(projectDetailViewSource, /제작\/이벤트 탭입니다\. 자연어 이벤트 패치를 연결합니다\./, "이벤트 탭은 placeholder가 아니라 실제 제안-검토-승인 흐름이어야 합니다.");
[
  "/api/generation/jobs/list",
  "/api/generation/jobs/run",
  "assetState",
  "partialFailed",
  "planned",
  "running",
  "failed",
  "completed",
  "retryFailed",
  "replaceCompleted",
  "OAUTH_REQUIRED",
  "Codex ChatGPT OAuth",
  "이벤트 CG 작업",
  "이미지 만들기",
  "실패 작업 재시도",
  "완료된 작업은 다시 호출하지 않습니다.",
  "결과 에셋",
  "프리뷰로 이동"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `ProjectDetailView 배경 화면 생성 탭에 '${requiredText}' 흐름이 있어야 합니다.`);
});
assert.doesNotMatch(projectDetailViewSource, /에셋\/생성 탭입니다\. CG 작업을 연결합니다\./, "배경 화면 생성 탭은 placeholder가 아니라 실제 CG 작업 실행 흐름이어야 합니다.");
[
  "/api/project/preview",
  "/api/project/validate",
  "/api/project/export",
  "previewState",
  "exportState",
  "resetPreviewAndExportState",
  "hasBlockingPreviewErrors",
  "previewRuntime",
  "exportResult",
  "smokeResult",
  "EXPORT_BLOCKED",
  "프리뷰 생성",
  "처음부터 플레이",
  "현재 씬",
  "검증 실행",
  "내보내기 실행",
  "산출물 위치",
  "실행 확인 결과",
  "필수 이미지 미완료",
  "다음 action",
  "개발자 상세",
  "runtime JSON",
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
  "공통 헤더와 탭 바는 유지됩니다",
  "exportPlan",
  "validationSummary",
  "로컬 데스크톱형 웹 앱",
  "GitHub Pages는 레거시 대상이며 이번 내보내기 대상이 아닙니다.",
  "githubPagesTarget",
  "포함될 프로젝트 데이터",
  "포함될 에셋",
  "차단 항목",
  "실패 상태가 완료 상태로 오인되지 않습니다"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectDetailViewSource, pattern, `ProjectDetailView 프리뷰/내보내기 탭에 '${requiredText}' 흐름이 있어야 합니다.`);
});
assert.match(projectDetailViewSource, /severity === "error"/, "프리뷰 검증은 warning이 아니라 error severity만 차단해야 합니다.");
assert.doesNotMatch(projectDetailViewSource, /프리뷰 탭입니다\. 플레이 검증을 연결합니다\./, "프리뷰 탭은 placeholder가 아니라 실제 runtime 확인 흐름이어야 합니다.");
assert.doesNotMatch(projectDetailViewSource, /내보내기 탭입니다\. export와 실행 확인 결과를 연결합니다\./, "내보내기 탭은 placeholder가 아니라 실제 export/smoke 흐름이어야 합니다.");
[
  "/api/projects",
  "/api/projects/from-heroine",
  "프로젝트 제목",
  "프로젝트 ID",
  "저장 후 프로젝트 ID는 변경할 수 없습니다.",
  "빈 프로젝트로 시작",
  "히로인 스냅샷을 선택해 시작",
  "기존 프로젝트 열기",
  "다른 위치 선택",
  "생성 취소",
  "저장 위치가 이미 존재합니다.",
  "저장 실패 시 입력값은 유지됩니다.",
  "beforeunload"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(projectNewPageSource, pattern, `ProjectNewPage에 '${requiredText}' 문구 또는 호출이 있어야 합니다.`);
});
assert.match(projectNewPageSource, /mode === "heroine" && selectedHeroineId/, "히로인 목록 로드만으로 빈 프로젝트 모드 dirty 상태가 되면 안 됩니다.");
assert.match(projectNewPageSource, /sourceProjectDirectory:\s*mode === "heroine"/, "히로인 기반 프로젝트 생성은 원본 라이브러리 디렉터리를 서버에 전달해야 합니다.");
assert.doesNotMatch(projectNewPageSource, /heroine:\s*mode === "heroine"/, "히로인 기반 프로젝트 생성은 Web UI가 스냅샷 객체를 복사하지 말고 use-case가 heroineId로 원본을 읽어야 합니다.");
assert.doesNotMatch(projectNewPageSource, /version:\s*"vn-maker\/v1"/, "빈 프로젝트 기본 스키마 조립 책임은 Web UI가 아니라 core/use-case 경계에 있어야 합니다.");
assert.doesNotMatch(projectStartSource, /샘플 프로젝트 생성/, "프로젝트 관리 primary action은 sample 생성이 아니라 새 프로젝트 생성이어야 합니다.");
assert.match(projectStartSource, /\/projects\/new/, "프로젝트 관리 primary action은 /projects/new로 이동해야 합니다.");

const heroineComponentPaths = [
  "apps/web/src/client/pages/heroines/HeroineListPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineCreatePage.tsx",
  "apps/web/src/client/pages/heroines/HeroineDetailPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineEditPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineEditorScreen.tsx",
  "apps/web/src/client/pages/heroines/HeroineFormPanel.tsx",
  "apps/web/src/client/pages/heroines/HeroineActionBar.tsx",
  "apps/web/src/client/pages/heroines/HeroineDeleteDialog.tsx",
  "apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx",
  "apps/web/src/client/pages/heroines/useUnsavedHeroineNavigationGuard.ts",
  "apps/web/src/client/pages/heroines/heroineApi.ts"
];
heroineComponentPaths.forEach((path) => {
  assert.ok(existsSync(join(root, path)), `${path} 파일이 있어야 합니다.`);
});
const heroineRouteSource = heroineComponentPaths.map((path) => readText(path)).join("\n");
assert.doesNotMatch(heroineRouteSource, /setShellState/, "히로인 route는 현재 프로젝트 전역 요약을 초기화하면 안 됩니다.");
assert.doesNotMatch(heroineRouteSource, /상태 갱신|onRefreshSession/, "히로인 화면은 수동 상태 갱신 버튼을 노출하면 안 됩니다.");
[
  "/api/heroines/list",
  "/api/heroines/get",
  "/api/heroines/create",
  "/api/heroines/update",
  "/api/heroines/delete",
  "/api/heroines/portrait/generate",
  "/api/projects/from-heroine"
].forEach((apiPath) => {
  assert.match(heroineRouteSource, new RegExp(apiPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${apiPath} 호출 경계가 있어야 합니다.`);
});
assert.match(heroineRouteSource, /session/, "HeroinePortraitPanel은 Codex 연결 세션을 읽어야 합니다.");
assert.match(heroineRouteSource, /capabilities/, "HeroinePortraitPanel은 Codex capability를 표시해야 합니다.");
assert.match(heroineRouteSource, /imageGeneration/, "HeroinePortraitPanel은 imageGeneration 가능 여부를 표시해야 합니다.");
assert.doesNotMatch(heroineRouteSource, /htmlFor="heroineId"|id="heroineId"|히로인 ID/, "히로인 ID는 생성/수정/상세 UI에서 노출하지 않아야 합니다.");
assert.match(heroineRouteSource, /suggestUniqueHeroineId/, "생성 화면은 이름 기반 고유 ID를 자동 부여해야 합니다.");
assert.match(heroineRouteSource, /reservedHeroineIds/, "신규 히로인 생성 시 예약어 ID는 저장 전에 차단해야 합니다.");
assert.match(heroineRouteSource, /beforeunload/, "dirty draft 이탈 확인이 있어야 합니다.");
assert.doesNotMatch(heroineRouteSource, /useBlocker/, "BrowserRouter route에서 data-router blocker를 쓰면 런타임 오류가 납니다.");
assert.match(heroineRouteSource, /confirmHeroineName/, "삭제 dialog는 히로인 이름 확인 입력을 받아야 합니다.");
assert.doesNotMatch(heroineRouteSource, /confirmHeroineId|삭제 확인 ID/, "삭제 dialog도 숨긴 히로인 ID 입력을 요구하면 안 됩니다.");
assert.match(heroineRouteSource, /삭제 확인 이름을 입력해야 합니다/, "삭제 확인 이름이 맞기 전에는 삭제를 막아야 합니다.");
assert.match(heroineRouteSource, /저장하지 않은 변경 사항이 있어 기본 포트레이트 생성 전에 저장해야 합니다/, "dirty edit 상태에서 포트레이트 생성으로 텍스트 변경을 잃으면 안 됩니다.");
assert.match(heroineRouteSource, /setStagedPortraitRef\(undefined\)/, "생성 화면에서 저장용 식별자가 바뀌면 staged portrait 참조를 해제해야 합니다.");
assert.match(heroineRouteSource, /저장용 식별자가 바뀌어 준비한 포트레이트 연결을 해제했습니다/, "생성 화면은 staged portrait 참조 해제 상태를 알려야 합니다.");
assert.match(heroineRouteSource, /const requestDraft = draftRef\.current/, "포트레이트 생성은 요청 시작 시점의 draft ID를 보관해야 합니다.");
assert.match(heroineRouteSource, /currentDraft\.id !== requestDraft\.id/, "포트레이트 생성 완료 시 현재 draft ID가 달라졌으면 staged ref를 붙이면 안 됩니다.");
assert.match(heroineRouteSource, /refreshedDeleteTarget/, "삭제 conflict reload는 dialog의 deleteTarget도 최신 revision으로 교체해야 합니다.");
assert.match(heroineRouteSource, /heroine-action-bar/, "생성/수정 화면은 sticky action bar를 가져야 합니다.");
assert.match(heroineRouteSource, /HeroineEditorScreen/, "생성/수정 화면은 같은 편집 화면 컴포넌트를 사용해야 합니다.");
assert.match(heroineRouteSource, /loading\?: boolean/, "공통 편집 화면은 로딩 중 폼 렌더링을 막는 loading prop을 가져야 합니다.");
assert.match(heroineRouteSource, /const showEditor = !loading && !notFound && !error/, "로딩 중에는 빈 draft 편집 폼을 렌더링하면 안 됩니다.");
assert.match(heroineRouteSource, /loading=\{state === "loading"\}/, "수정 화면은 데이터 로딩 중 공통 편집 폼을 숨겨야 합니다.");
assert.match(heroineRouteSource, /const displayStatus = state === "loading" \|\| \(state === "ready" && status === readyStatus\)\s*\? ""\s*: status/, "수정 화면은 로딩 중 또는 준비 완료 기본 안내를 상단 상태 배너에 표시하지 않아야 합니다.");
assert.match(heroineRouteSource, /status=\{displayStatus\}/, "수정 화면은 필터링된 상태 문구만 공통 편집 화면에 전달해야 합니다.");
assert.match(heroineRouteSource, /status \? \(/, "공통 편집 화면은 상태 문구가 있을 때만 상태 배너를 렌더링해야 합니다.");
assert.match(heroineRouteSource, /onSaveAndExit/, "생성/수정 화면은 취소/저장/저장 후 상세보기 3단 액션을 제공해야 합니다.");
assert.match(heroineRouteSource, /field-row-invalid/, "미입력 필드는 red border 상태로 표시해야 합니다.");
assert.doesNotMatch(heroineRouteSource, />미입력</, "미입력 안내 글자는 필드 안에 표시하지 않아야 합니다.");
assert.doesNotMatch(heroineRouteSource, /portraitStatus\s*\|\|\s*"missing"/, "히로인 목록은 missing 상태 텍스트를 노출하면 안 됩니다.");
assert.doesNotMatch(heroineRouteSource, /MoreVertical/, "히로인 리스트 삭제 버튼은 더보기 아이콘 없이 휴지통만 보여야 합니다.");
assert.match(heroineRouteSource, /HEROINE_REVISION_CONFLICT/, "revision 충돌은 별도 코드로 처리해야 합니다.");
assert.doesNotMatch(heroineRouteSource, /generatedAssetPreviewUri/, "기본 포트레이트 프리뷰는 존재 여부를 모르는 경로를 추정 렌더링하면 안 됩니다.");
assert.doesNotMatch(heroineRouteSource, /API key|API 키/, "API key 흐름을 Codex OAuth 로그인처럼 표현하면 안 됩니다.");
const sharedListSource = readText("apps/web/src/client/components/ui/ContentList.tsx");
assert.match(heroineRouteSource, /ContentList/, "히로인 리스트는 공통 리스트 컴포넌트를 사용해야 합니다.");
assert.match(sharedListSource, /content-list-item/, "공통 리스트 컴포넌트는 동일한 row UI class를 소유해야 합니다.");
[
  "아직 히로인이 없습니다.",
  "히로인 목록을 불러오는 중입니다.",
  "히로인 목록을 불러오지 못했습니다.",
  "최근 수정한 히로인부터 표시합니다.",
  "총 히로인",
  "새 히로인 만들기",
  "히로인 정보를 불러오는 중입니다.",
  "히로인을 찾을 수 없습니다.",
  "목록으로 돌아가기",
  "필수값을 모두 입력해야 저장할 수 있습니다.",
  "변경된 내용이 없습니다.",
  "변경됨",
  "말투",
  "외형 설명",
  "Codex 연결",
  "imageGeneration 가능",
  "기본 포트레이트 생성",
  "생성 불가",
  "이미 만든 프로젝트의 스냅샷은 유지되지만, 라이브러리에서는 제거됩니다.",
  "이 작업은 Alpha에서 되돌릴 수 없습니다.",
  "최신 정보를 다시 불러오기",
  "이미 만든 프로젝트에 복사된 히로인 스냅샷은 자동으로 바뀌지 않습니다.",
  "히로인 기반 프로젝트 생성"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(heroineRouteSource, pattern, `히로인 route 소스에 '${requiredText}' 문구가 있어야 합니다.`);
});
assert.doesNotMatch(
  heroineRouteSource,
  /히로인 검색|태그 필터|히로인 정렬|복제|기본 감정|추가 태그/,
  "Alpha 히로인 화면은 Beta 기능을 전면 노출하면 안 됩니다."
);
const workspacePageSource = readText("apps/web/src/client/pages/WorkspacePage.tsx");
assert.doesNotMatch(
  workspacePageSource,
  /Heroine Library|히로인 검색|태그 필터|히로인 정렬|히로인 복제/,
  "WorkspacePage는 Alpha 히로인 관리 기능을 기본 노출하면 안 됩니다."
);
assert.doesNotMatch(
  workspacePageSource,
  /createProjectFromSelectedHeroine|\/api\/projects\/from-heroine/,
  "WorkspacePage는 히로인 기반 프로젝트 생성 실행 책임을 소유하면 안 됩니다."
);
assert.doesNotMatch(settingsStartSource, /setShellState/, "SettingsStartPage는 현재 프로젝트 전역 요약을 초기화하면 안 됩니다.");
assert.doesNotMatch(settingsStartSource, /describeSession|session\?|logout\(/, "SettingsStartPage는 SA-108의 Codex 상세/로그아웃 범위를 선점하면 안 됩니다.");
assert.doesNotMatch(settingsStartSource, /생성 기본값|soft visual novel|Codex imageGeneration/, "SettingsStartPage는 SA-108의 생성 기본값 범위를 선점하면 안 됩니다.");

const styleSource = readText("apps/web/src/client/styles.css");
[".workspace-layout", ".workspace-nav", ".page-hero", ".page-primary-action"].forEach((selector) => {
  assert.match(styleSource, new RegExp(selector.replace(".", "\\.")), `${selector} 스타일이 있어야 합니다.`);
});
assert.match(styleSource, /\.recent-project-menu-actions/, "최근 프로젝트 메뉴 액션은 겹치지 않도록 별도 컨테이너 스타일을 가져야 합니다.");
assert.match(styleSource, /@media \(max-width: 820px\)/, "태블릿 이하 breakpoint가 있어야 합니다.");
assert.match(styleSource, /@media \(max-width: 560px\)/, "모바일 breakpoint가 있어야 합니다.");
