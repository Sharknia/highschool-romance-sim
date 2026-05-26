import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function readText(path) {
  return readFileSync(join(root, path), "utf8");
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

const rootPackageSource = readText("package.json");
assert.match(rootPackageSource, /node tests\/vn-maker-ux-quality-gate\.test\.mjs/, "test:maker는 UX 품질 게이트 테스트를 실행해야 합니다.");

const displayTextPath = "apps/web/src/client/pages/projects/projectDisplayText.ts";
assert.ok(existsSync(join(root, displayTextPath)), "ProjectDetailView 사용자 표시 문구 helper 모듈이 있어야 합니다.");
const displayTextSource = readText(displayTextPath);
[
  "displayWorkflowStep",
  "backgroundConnectionText",
  "backgroundSceneConnectionText",
  "backgroundAssetDisplayLabel",
  "generationProviderText",
  "imageJobKindLabel",
  "jobStatusLabel"
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
assert.doesNotMatch(projectDetailSource, /function imageJobKindLabel/, "ProjectDetailView 안에 이미지 작업 종류 표시 로직을 다시 두면 안 됩니다.");
assert.doesNotMatch(projectDetailSource, /function jobStatusLabel/, "ProjectDetailView 안에 작업 상태 표시 로직을 다시 두면 안 됩니다.");

[
  /<h3>runtime 플레이<\/h3>/,
  /imageGeneration 가능/,
  /imageGeneration 상태/,
  /Codex 이미지 생성 연결/,
  /provider 확인 필요/,
  /생성 어댑터/,
  /어댑터, 응답 형식/,
  /setBackgroundStatus\("adapter:/,
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
assert.match(stylesSource, /\.project-detail-panel\s*{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, "프로젝트 상세 패널은 탭 레일의 최대 콘텐츠 폭을 본문 폭으로 전파하면 안 됩니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list\s*{[\s\S]*display: flex[\s\S]*overflow-x: auto/, "390px 모바일 탭은 가로 스캔 레일이어야 합니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list\s*{[\s\S]*width: 100%[\s\S]*max-width: 100%/, "390px 모바일 탭 레일은 부모 폭을 키우면 안 됩니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.tab-list-item\s*{[\s\S]*min-width: 136px/, "390px 모바일 탭 항목은 최소 폭을 가져야 합니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.project-detail-panel,\s*\.detail-tab-body\s*{[\s\S]*overflow-x: hidden/, "390px 모바일 상세 본문은 탭 레일 때문에 옆으로 밀리면 안 됩니다.");
assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.detail-tab-grid\s*{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, "390px 모바일 상세 카드 흐름은 1열이어야 합니다.");

const heroinePortraitSource = readText("apps/web/src/client/pages/heroines/HeroinePortraitPanel.tsx");
assert.match(heroinePortraitSource, /이미지 생성 가능/, "히로인 포트레이트 기본 화면은 사용자용 이미지 생성 문구를 써야 합니다.");
assert.doesNotMatch(heroinePortraitSource, /imageGeneration 가능|imageGeneration 상태/, "히로인 포트레이트 기본 화면은 내부 imageGeneration 용어를 노출하면 안 됩니다.");

const projectNewSource = readText("apps/web/src/client/pages/projects/ProjectNewPage.tsx");
assert.doesNotMatch(projectNewSource, />프로젝트 ID</, "새 프로젝트 기본 화면은 raw ID 용어 대신 사용자용 저장 식별자 문구를 써야 합니다.");
assert.doesNotMatch(projectNewSource, /프로젝트 ID는 변경할 수 없습니다/, "새 프로젝트 안내 문구는 raw ID 용어를 기본 본문에 노출하면 안 됩니다.");
assert.doesNotMatch(projectNewSource, /url-safe-project-id/, "새 프로젝트 기본 화면 placeholder는 내부 slug 형식을 직접 노출하면 안 됩니다.");
assert.doesNotMatch(projectNewSource, />premise</, "새 프로젝트 기본 화면은 DTO 필드명 premise를 노출하면 안 됩니다.");

const recentProjectListSource = readText("apps/web/src/client/pages/projects/RecentProjectList.tsx");
assert.doesNotMatch(recentProjectListSource, /placeholder="[^"]*projectId[^"]*"/, "프로젝트 목록 필터 placeholder는 projectId 내부 이름을 노출하면 안 됩니다.");
assert.doesNotMatch(recentProjectListSource, /· \{entry\.projectId\}/, "프로젝트 목록 기본 메타는 raw project id 값을 노출하면 안 됩니다.");
assert.doesNotMatch(recentProjectListSource, />missing</, "프로젝트 목록 상태 chip은 raw missing 상태값을 노출하면 안 됩니다.");
assert.doesNotMatch(recentProjectListSource, />ready</, "프로젝트 목록 상태 chip은 raw ready 상태값을 노출하면 안 됩니다.");
