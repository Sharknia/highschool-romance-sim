import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const studioSource = readFileSync(join(root, "apps/web/src/client/pages/projects/StudioWorkspace.tsx"), "utf8");
const projectDetailSource = readFileSync(join(root, "apps/web/src/client/pages/projects/ProjectDetailView.tsx"), "utf8");
const styleSource = readFileSync(join(root, "apps/web/src/client/styles.css"), "utf8");

[
  "studio-breadcrumb",
  "Projects",
  "프로젝트 상세로",
  "studio-route-selector",
  "route:",
  "sceneTitleInput",
  "studio-command-add",
  "Cmd/Ctrl+S",
  "Cmd/Ctrl+Enter",
  "Cmd/Ctrl+K",
  "focusRouteSearch",
  "저장 후 프리뷰를 실행하세요.",
  "previewCommandDisabledReason",
  "설정",
  "진단",
  "studio-splitter"
].forEach((requiredText) => {
  assert.match(
    studioSource,
    new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `StudioWorkspace must include ${requiredText}`
  );
});

assert.match(studioSource, /const activeRouteIdQuery = searchParams\.get\("route"\)/, "Studio route selection must read ?route=.");
assert.match(studioSource, /function selectRoute\(routeId: string\): void/, "Studio command bar must switch route through one UI handler.");
assert.match(studioSource, /canonicalStudioQuery\(searchParams,[\s\S]*route: activeRoute\?\.id/, "Canonical query must preserve route state.");
assert.match(studioSource, /addEventListener\("keydown", handleStudioShortcuts\)/, "Studio shortcuts must be installed through keydown.");
assert.match(studioSource, /if \(layout\.routeCollapsed\)[\s\S]*routeCollapsed: false[\s\S]*routeSearchRef\.current\?\.focus/, "Cmd/Ctrl+K must expand the route panel before focusing route search.");
assert.match(studioSource, /const previewCommandDisabledReason = dirty \? "저장 후 프리뷰를 실행하세요\." : previewDisabledReason/, "Preview command must be blocked while Studio draft is dirty.");
assert.match(studioSource, /role="separator"[\s\S]*aria-orientation="vertical"/, "Vertical splitters must be keyboard-addressable separators.");
assert.match(studioSource, /role="separator"[\s\S]*aria-orientation="horizontal"/, "Problems panel splitter must be a keyboard-addressable separator.");
assert.match(projectDetailSource, /useSearchParams/, "ProjectDetailView must read Studio preview handoff query params.");
assert.match(projectDetailSource, /const previewSceneQuery = searchParams\.get\("scene"\)/, "Preview tab must read ?scene= handoff.");
assert.match(projectDetailSource, /setPreviewSceneId\(previewSceneFromQuery\.id\)/, "Preview tab must apply Studio selected scene query.");
assert.match(styleSource, /\.studio-breadcrumb/, "Command bar breadcrumb styles must exist.");
assert.match(styleSource, /\.studio-scene-title-input/, "Scene title input styles must exist.");
assert.match(styleSource, /\.studio-splitter/, "Splitter affordance styles must exist.");
