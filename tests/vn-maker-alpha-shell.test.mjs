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

["ProjectStartPage", "HeroineStartPage", "SettingsStartPage"].forEach((componentName) => {
  const pageSource = readText(`apps/web/src/client/pages/${componentName}.tsx`);
  assert.match(pageSource, /page-primary-action/, `${componentName}는 page-local primary action을 가져야 합니다.`);
  assert.match(pageSource, /page-status/, `${componentName}는 page-local 상태 문장을 가져야 합니다.`);
});
const projectStartSource = readText("apps/web/src/client/pages/ProjectStartPage.tsx");
assert.match(projectStartSource, /shellState/, "ProjectStartPage는 현재 프로젝트 요약을 전역 shell state에서 읽어야 합니다.");
assert.match(projectStartSource, /projectDirectory:/, "ProjectStartPage는 프로젝트 열기 성공 시 저장 위치를 전역 shell state에 반영해야 합니다.");

const heroineStartSource = readText("apps/web/src/client/pages/HeroineStartPage.tsx");
const settingsStartSource = readText("apps/web/src/client/pages/SettingsStartPage.tsx");
assert.doesNotMatch(heroineStartSource, /setShellState/, "HeroineStartPage는 현재 프로젝트 전역 요약을 초기화하면 안 됩니다.");
assert.doesNotMatch(settingsStartSource, /setShellState/, "SettingsStartPage는 현재 프로젝트 전역 요약을 초기화하면 안 됩니다.");
assert.doesNotMatch(settingsStartSource, /describeSession|session\?|logout\(/, "SettingsStartPage는 SA-108의 Codex 상세/로그아웃 범위를 선점하면 안 됩니다.");
assert.doesNotMatch(settingsStartSource, /soft visual novel|Codex imageGeneration/, "SettingsStartPage는 SA-108의 생성 기본값 상세를 하드코딩하면 안 됩니다.");

const styleSource = readText("apps/web/src/client/styles.css");
[".workspace-layout", ".workspace-nav", ".page-hero", ".page-primary-action"].forEach((selector) => {
  assert.match(styleSource, new RegExp(selector.replace(".", "\\.")), `${selector} 스타일이 있어야 합니다.`);
});
assert.match(styleSource, /@media \(max-width: 820px\)/, "태블릿 이하 breakpoint가 있어야 합니다.");
assert.match(styleSource, /@media \(max-width: 560px\)/, "모바일 breakpoint가 있어야 합니다.");
