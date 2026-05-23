import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-alpha-ui-state-"));
const bundledStatePath = join(tempRoot, "project-detail-state.mjs");

try {
  await esbuild({
    entryPoints: ["apps/web/src/client/pages/projects/projectDetailState.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundledStatePath
  });

  const { createPreviewExportResetState } = await import(pathToFileURL(bundledStatePath).href);
  const plannedCgProject = {
    id: "ui-state",
    characters: [{ id: "haru" }],
    routes: [{ id: "haru-route", entrySceneId: "scene-opening", heroineId: "haru" }],
    scenes: [{ id: "scene-opening" }, { id: "scene-cg" }],
    generationJobs: [{ id: "job-cg", kind: "cg", status: "planned" }]
  };

  const blocked = createPreviewExportResetState({
    project: plannedCgProject,
    workflowSummary: {
      previewState: "stale",
      exportState: "blocked",
      generationState: "planned",
      blockingIssues: ["완료되지 않은 이미지 작업이 있습니다."]
    },
    previewStatus: "프로젝트 이벤트가 변경되어 프리뷰와 내보내기를 다시 확인해야 합니다."
  });
  assert.equal(blocked.previewState, "stale");
  assert.equal(blocked.previewStatus, "프로젝트 이벤트가 변경되어 프리뷰와 내보내기를 다시 확인해야 합니다.");
  assert.equal(blocked.exportState, "blocked");
  assert.match(blocked.exportStatus, /완료되지 않은 이미지 작업/);

  const ready = createPreviewExportResetState({
    project: { ...plannedCgProject, generationJobs: [{ id: "job-cg", kind: "cg", status: "completed" }] },
    workflowSummary: {
      previewState: "stale",
      exportState: "ready",
      generationState: "completed",
      blockingIssues: []
    }
  });
  assert.equal(ready.exportState, "ready");
  assert.match(ready.exportStatus, /내보내기를 실행할 수 있습니다/);

  const blockedBackground = createPreviewExportResetState({
    project: { ...plannedCgProject, generationJobs: [{ id: "job-bg", kind: "background", status: "planned" }] },
    workflowSummary: null
  });
  assert.equal(blockedBackground.exportState, "blocked");
  assert.match(blockedBackground.exportStatus, /완료되지 않은 이미지 작업/);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
