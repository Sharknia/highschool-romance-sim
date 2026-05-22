import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function readText(path) {
  return readFileSync(join(root, path), "utf8");
}

const appSource = readText("apps/web/src/client/App.tsx");

assert.match(
  appSource,
  /<Route path="\/" element={<RootRedirect \/?>} \/>/,
  "`/`는 전용 RootRedirect로 인증 상태에 따라 분기해야 합니다."
);
["/projects", "/heroines", "/settings"].forEach((path) => {
  assert.match(appSource, new RegExp(`<Route path="${path}"`), `${path} 인증 앱 라우트가 있어야 합니다.`);
});
["/projects/:projectId", "/projects/:projectId/:tab"].forEach((path) => {
  assert.match(appSource, new RegExp(`<Route path="${path}"`), `${path} 프로젝트 상세 deep link 라우트가 있어야 합니다.`);
});
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

const workspaceLayoutPath = "apps/web/src/client/components/WorkspaceLayout.tsx";
assert.ok(existsSync(join(root, workspaceLayoutPath)), "인증 후 WorkspaceLayout 컴포넌트가 있어야 합니다.");
const workspaceLayoutSource = readText(workspaceLayoutPath);
assert.match(workspaceLayoutSource, /projectDirectory: string;/, "WorkspaceLayout은 현재 프로젝트 저장 위치를 전역 상태로 소유해야 합니다.");
const navLabels = [...workspaceLayoutSource.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
const navPaths = [...workspaceLayoutSource.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(navLabels, ["프로젝트 관리", "히로인 관리", "설정"], "인증 후 앱 네비게이션은 3개 항목만 보여야 합니다.");
assert.deepEqual(navPaths, ["/projects", "/heroines", "/settings"], "인증 후 앱 네비게이션 path는 /projects, /heroines, /settings만 허용합니다.");
assert.doesNotMatch(workspaceLayoutSource, /\/login/, "`/login`은 앱 네비게이션에 포함되면 안 됩니다.");

const appShellSource = readText("apps/web/src/client/components/ui/AppShell.tsx");
["projectTitle", "storageSummary", "validationStatus", "codexStatus"].forEach((propName) => {
  assert.match(appShellSource, new RegExp(propName), `AppShell은 ${propName} 전역 상태를 받아야 합니다.`);
});
["프로젝트 없음", "저장 위치", "검증", "Codex ChatGPT OAuth"].forEach((label) => {
  assert.match(appShellSource, new RegExp(label), `AppShell은 '${label}' 전역 상태를 표시해야 합니다.`);
});

const notFoundSource = readText("apps/web/src/client/pages/NotFoundPage.tsx");
assert.match(notFoundSource, /to="\/projects"/, "인증 후 Not Found 복귀 링크는 /projects여야 합니다.");

[
  "apps/web/src/client/pages/ProjectStartPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineListPage.tsx",
  "apps/web/src/client/pages/SettingsStartPage.tsx"
].forEach((pagePath) => {
  const pageSource = readText(pagePath);
  assert.match(pageSource, /page-primary-action/, `${pagePath}는 page-local primary action을 가져야 합니다.`);
  assert.match(pageSource, /page-status/, `${pagePath}는 page-local 상태 문장을 가져야 합니다.`);
});
const projectStartSource = readText("apps/web/src/client/pages/ProjectStartPage.tsx");
assert.match(projectStartSource, /shellState/, "ProjectStartPage는 현재 프로젝트 요약을 전역 shell state에서 읽어야 합니다.");
assert.match(projectStartSource, /projectDirectory:/, "ProjectStartPage는 프로젝트 열기 성공 시 저장 위치를 전역 shell state에 반영해야 합니다.");
const recentProjectListPath = "apps/web/src/client/pages/projects/RecentProjectList.tsx";
const projectDetailViewPath = "apps/web/src/client/pages/projects/ProjectDetailView.tsx";
assert.ok(existsSync(join(root, recentProjectListPath)), "최근 프로젝트 목록은 별도 RecentProjectList 컴포넌트로 분리해야 합니다.");
assert.ok(existsSync(join(root, projectDetailViewPath)), "프로젝트 상세 탭은 별도 ProjectDetailView 컴포넌트로 분리해야 합니다.");
const recentProjectListSource = readText(recentProjectListPath);
const projectDetailViewSource = readText(projectDetailViewPath);
["overview", "heroine", "event", "assets", "preview", "export"].forEach((tab) => {
  assert.match(projectDetailViewSource, new RegExp(tab), `ProjectDetailView는 ${tab} 상세 탭 deep link를 다뤄야 합니다.`);
});
[
  "/api/projects/recent/list",
  "/api/projects/recent/remove",
  "최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.",
  "프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.",
  "프로젝트 ID가 일치하지 않습니다. 자동으로 덮어쓰지 않았습니다.",
  "목록에서만 제거"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(`${projectStartSource}\n${recentProjectListSource}\n${projectDetailViewSource}`, pattern, `프로젝트 페이지 소스에 '${requiredText}' 문구 또는 API 호출이 있어야 합니다.`);
});

const heroineComponentPaths = [
  "apps/web/src/client/pages/heroines/HeroineListPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineCreatePage.tsx",
  "apps/web/src/client/pages/heroines/HeroineDetailPage.tsx",
  "apps/web/src/client/pages/heroines/HeroineEditPage.tsx",
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
const settingsStartSource = readText("apps/web/src/client/pages/SettingsStartPage.tsx");
assert.doesNotMatch(heroineRouteSource, /setShellState/, "히로인 route는 현재 프로젝트 전역 요약을 초기화하면 안 됩니다.");
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
assert.match(heroineRouteSource, /readOnly=\{mode === "edit"\}/, "저장된 히로인을 편집할 때 ID 필드는 읽기 전용이어야 합니다.");
assert.match(heroineRouteSource, /suggestHeroineId/, "생성 화면은 이름 기반 ID 제안값을 제공해야 합니다.");
assert.match(heroineRouteSource, /reservedHeroineIds/, "신규 히로인 생성 시 예약어 ID는 저장 전에 차단해야 합니다.");
assert.match(heroineRouteSource, /beforeunload/, "dirty draft 이탈 확인이 있어야 합니다.");
assert.doesNotMatch(heroineRouteSource, /useBlocker/, "BrowserRouter route에서 data-router blocker를 쓰면 런타임 오류가 납니다.");
assert.match(heroineRouteSource, /confirmHeroineName/, "삭제 dialog는 히로인 이름 확인 입력을 받아야 합니다.");
assert.match(heroineRouteSource, /confirmHeroineId/, "삭제 dialog는 히로인 ID 확인 입력을 받아야 합니다.");
assert.match(heroineRouteSource, /삭제 확인값을 입력해야 합니다/, "삭제 확인값이 맞기 전에는 삭제를 막아야 합니다.");
assert.match(heroineRouteSource, /저장하지 않은 변경 사항이 있어 기본 포트레이트 생성 전에 저장해야 합니다/, "dirty edit 상태에서 포트레이트 생성으로 텍스트 변경을 잃으면 안 됩니다.");
assert.match(heroineRouteSource, /heroine-action-bar/, "생성/수정 화면은 sticky action bar를 가져야 합니다.");
assert.match(heroineRouteSource, /HEROINE_REVISION_CONFLICT/, "revision 충돌은 별도 코드로 처리해야 합니다.");
assert.doesNotMatch(heroineRouteSource, /generatedAssetPreviewUri/, "기본 포트레이트 프리뷰는 존재 여부를 모르는 경로를 추정 렌더링하면 안 됩니다.");
assert.doesNotMatch(heroineRouteSource, /API key|API 키/, "API key 흐름을 Codex OAuth 로그인처럼 표현하면 안 됩니다.");
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
  "히로인 ID",
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
assert.match(styleSource, /@media \(max-width: 820px\)/, "태블릿 이하 breakpoint가 있어야 합니다.");
assert.match(styleSource, /@media \(max-width: 560px\)/, "모바일 breakpoint가 있어야 합니다.");
