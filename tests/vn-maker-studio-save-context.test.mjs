import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const studioSource = readFileSync(join(root, "apps/web/src/client/pages/projects/StudioWorkspace.tsx"), "utf8");
const packageSource = readFileSync(join(root, "package.json"), "utf8");

function mustInclude(pattern, message) {
  assert.match(studioSource, pattern, message);
}

function mustNotInclude(pattern, message) {
  assert.doesNotMatch(studioSource, pattern, message);
}

mustInclude(/function studioSceneSavePayload\(draft: ProjectScene\): ProjectScene/, "Studio save must clone the full draft scene payload.");
mustInclude(/const canSaveStudioDraft = Boolean\(draftScene && saveState !== "saving" && dirty\)/, "Top save must be enabled for any dirty draft, including routing-only changes.");
mustInclude(/void saveStudioDraft\(\)/, "Command save must call the unified Studio save handler.");
mustInclude(/postJson\("\/api\/project\/studio\/mutate"/, "Top save must use the Studio mutation API boundary.");
mustInclude(/operations:\s*\[\s*{\s*type: "upsertScene",\s*scene: studioSceneSavePayload\(draftScene\)\s*}\s*\]/, "Top save must persist the full draft through one upsertScene operation.");
mustInclude(/expectedProjectRevision,[\s\S]*routeId: activeRoute\?\.id,[\s\S]*sceneId: draftScene\.id/, "Studio save must send revision, route, and scene context to the use-case boundary.");
mustInclude(/applySuccessfulResult\(result, "Studio 저장 완료\.", \{ preserveContext: true, selectedSceneId: draftScene\.id \}\)/, "Successful top save must preserve the current Studio context instead of jumping to a default scene.");
mustInclude(/panel: selectedPanel,[\s\S]*route: activeRoute\?\.id \|\| "",[\s\S]*scene: selectedSceneId/, "Context preservation must keep panel, route, and selected scene in the Studio query.");
mustInclude(/STALE_PROJECT_REVISION/, "Unified save error surface must call out stale revision conflicts.");

mustNotInclude(/const canSaveDraftContent/, "Studio save guard must not remain content-only.");
mustNotInclude(/postJson\("\/api\/project\/scenes",/, "Top save must not use the legacy content-only scene API.");
mustNotInclude(/postJson\("\/api\/project\/scenes\/link"/, "Routing edits must not use an inspector-only link save API.");
mustNotInclude(/postJson\("\/api\/project\/scenes\/ending"/, "Ending edits must not use an inspector-only ending save API.");
mustNotInclude(/function linkExistingTarget\(/, "Inspector routing save helper must be removed.");
mustNotInclude(/function setEnding\(/, "Inspector ending save helper must be removed.");
mustNotInclude(/다음 연결 저장|선택지 연결 저장|엔딩 저장/, "Fragmented save button copy must be removed from the inspector.");

assert.match(packageSource, /vn-maker-studio-save-context\.test\.mjs/, "Maker test suite must include the Studio save context regression.");
