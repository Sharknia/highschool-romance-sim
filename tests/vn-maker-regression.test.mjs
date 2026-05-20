import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const core = await import("../packages/engine-core/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");

const project = core.createStarterProject({
  id: "test-project",
  title: "테스트 미연시",
  premise: "방과 후 엔진 제작 테스트"
});

assert.equal(project.version, "vn-maker/v1");
assert.equal(project.characters.length >= 1, true);
assert.equal(project.scenes.length >= 2, true);

const validation = core.validateProject(project);
assert.deepEqual(validation.filter((issue) => issue.severity === "error"), []);

const manifest = core.createAssetManifest(project);
assert.equal(Array.isArray(manifest.requiredAssets), true);

const imageJob = core.createImageGenerationJob({
  id: "job-portrait-haru",
  kind: "portrait",
  targetId: project.characters[0].id,
  prompt: "high school visual novel heroine portrait",
  style: "clean anime key visual"
});

assert.equal(imageJob.provider, "image-generation-adapter");

const htmlArtifact = core.buildProjectHtml(project);
assert.match(htmlArtifact.html, /테스트 미연시/);
assert.match(htmlArtifact.html, /application\/json/);

const cliValidateOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "validate"], {
  input: JSON.stringify({ project }),
  encoding: "utf8"
});
const cliValidate = JSON.parse(cliValidateOutput);
assert.equal(cliValidate.ok, true);
assert.equal(cliValidate.issues.length, 0);

const cliBuildOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "build-html"], {
  input: JSON.stringify({ project }),
  encoding: "utf8"
});
const cliBuild = JSON.parse(cliBuildOutput);
assert.equal(cliBuild.ok, true);
assert.match(cliBuild.artifact.html, /테스트 미연시/);

const apiValidation = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/validate",
  body: { project }
});
assert.equal(apiValidation.status, 200);
assert.equal(apiValidation.body.ok, true);

const apiJob = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/generation/jobs",
  body: {
    kind: "cg",
    targetId: "scene-opening",
    prompt: "sunset classroom confession cg",
    style: "soft visual novel cg"
  }
});
assert.equal(apiJob.status, 200);
assert.equal(apiJob.body.job.kind, "cg");
