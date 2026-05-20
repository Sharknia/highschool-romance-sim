import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const core = await import("../packages/engine-core/dist/index.js");
const codexGeneration = await import("../packages/generation-codex/dist/index.js");
const projectStore = await import("../packages/project-store/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");
const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-regression-"));
const projectDirectory = join(tempRoot, "TestGame.vnmaker");
const starterOnlyProjectDirectory = join(tempRoot, "StarterOnly.vnmaker");

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

const store = await projectStore.createProjectWorkspace({ projectDirectory, project });
assert.equal(existsSync(join(projectDirectory, "project.sqlite")), true);
assert.equal(existsSync(join(projectDirectory, "assets", "generated")), true);

const exportedProject = store.exportProjectSnapshot();
assert.equal(exportedProject.id, project.id);

const secondCharacter = {
  id: "mira",
  displayName: "미라",
  role: "서브 히로인",
  profile: "방송부에서 게임 홍보를 돕는 같은 반 친구.",
  emotionTags: ["normal", "smile"],
  portraitAssetIds: []
};
store.upsertCharacter(secondCharacter);
assert.equal(store.requireProject().characters.some((character) => character.id === "mira"), true);

const revisedOpening = {
  ...store.requireProject().scenes[0],
  text: "SQLite 저장소를 통과한 첫 장면."
};
store.upsertScene(revisedOpening);
const storedValidation = store.validateAndStore();
assert.equal(storedValidation.ok, true);
assert.equal(store.readValidationIssues().length, 0);
store.close();

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

const cliOpenOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "open-project"], {
  input: JSON.stringify({ projectDirectory }),
  encoding: "utf8"
});
const cliOpen = JSON.parse(cliOpenOutput);
assert.equal(cliOpen.ok, true);
assert.equal(cliOpen.project.characters.some((character) => character.id === "mira"), true);

const cliSaveSceneOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "save-scene"], {
  input: JSON.stringify({
    projectDirectory,
    scene: {
      ...cliOpen.project.scenes[0],
      text: "CLI가 같은 SQLite 프로젝트에 저장한 장면."
    }
  }),
  encoding: "utf8"
});
const cliSaveScene = JSON.parse(cliSaveSceneOutput);
assert.equal(cliSaveScene.ok, true);
assert.match(cliSaveScene.project.scenes[0].text, /CLI가 같은 SQLite 프로젝트/);

const apiValidation = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/validate",
  body: { projectDirectory }
});
assert.equal(apiValidation.status, 200);
assert.equal(apiValidation.body.ok, true);

const apiScene = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/scenes",
  body: {
    projectDirectory,
    scene: {
      ...cliSaveScene.project.scenes[0],
      text: "Web API가 같은 SQLite 프로젝트에 저장한 장면."
    }
  }
});
assert.equal(apiScene.status, 200);
assert.equal(apiScene.body.ok, true);
assert.match(apiScene.body.project.scenes[0].text, /Web API가 같은 SQLite 프로젝트/);

const apiJob = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/generation/jobs",
  body: {
    projectDirectory,
    kind: "cg",
    targetId: "scene-opening",
    prompt: "sunset classroom confession cg",
    style: "soft visual novel cg"
  }
});
assert.equal(apiJob.status, 200);
assert.equal(apiJob.body.job.kind, "cg");

const apiStarterOnlyJob = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/generation/jobs",
  body: {
    projectDirectory: starterOnlyProjectDirectory,
    project: {
      starter: {
        id: "starter-only",
        title: "스타터 래퍼 프로젝트",
        premise: "샘플 생성 버튼 없이 생성 작업을 시작하는 흐름"
      }
    },
    kind: "cg",
    targetId: "scene-opening",
    prompt: "starter only generation job",
    style: "soft visual novel cg"
  }
});
assert.equal(apiStarterOnlyJob.status, 200);
assert.equal(apiStarterOnlyJob.body.ok, true);
assert.equal(apiStarterOnlyJob.body.project.id, "starter-only");

const sampleImageBase64 = Buffer.from("fake image").toString("base64");
const codexImageResult = await codexGeneration.createCodexImageAssetResult(
  {
    kind: "cg",
    targetId: "scene-opening",
    prompt: "sunset classroom confession cg",
    style: "soft visual novel cg"
  },
  {
    id: "codex-image-item",
    type: "imageGeneration",
    result: sampleImageBase64,
    status: "completed",
    revisedPrompt: "revised sunset classroom confession cg",
    savedPath: null
  }
);
assert.equal(codexImageResult.job.status, "completed");
assert.equal(codexImageResult.asset.source, "generated");
assert.match(codexImageResult.image.dataUrl, /^data:image\/png;base64,/);

const mockCodex = {
  async readSession() {
    return {
      connected: true,
      mode: "chatgpt",
      account: { type: "chatgpt", email: "maker@example.com", planType: "pro" },
      requiresOpenaiAuth: true,
      capabilities: { imageGeneration: true, namespaceTools: true, webSearch: true }
    };
  },
  async startLogin(flow) {
    return flow === "device"
      ? { type: "chatgptDeviceCode", loginId: "login-device", verificationUrl: "https://auth.openai.com/codex/device", userCode: "ABCD-1234" }
      : { type: "chatgpt", loginId: "login-browser", authUrl: "https://chatgpt.com/auth" };
  },
  async logout() {
    return undefined;
  },
  async generateImageAsset(input) {
    return codexGeneration.createCodexImageAssetResult(input, {
      id: "mock-image",
      type: "imageGeneration",
      result: sampleImageBase64,
      status: "completed",
      revisedPrompt: null,
      savedPath: null
    });
  }
};

const mockApi = webHandlers.createApiRequestHandler({ codex: mockCodex });
const apiSession = await mockApi({ method: "GET", path: "/api/codex/session" });
assert.equal(apiSession.status, 200);
assert.equal(apiSession.body.connected, true);
assert.equal(apiSession.body.mode, "chatgpt");

const apiLogin = await mockApi({
  method: "POST",
  path: "/api/codex/login",
  body: { flow: "device" }
});
assert.equal(apiLogin.status, 200);
assert.equal(apiLogin.body.login.userCode, "ABCD-1234");

const apiImage = await mockApi({
  method: "POST",
  path: "/api/generation/images",
  body: {
    projectDirectory,
    kind: "cg",
    targetId: "scene-opening",
    prompt: "sunset classroom confession cg",
    style: "soft visual novel cg"
  }
});
assert.equal(apiImage.status, 200);
assert.equal(apiImage.body.job.status, "completed");
assert.match(apiImage.body.image.dataUrl, /^data:image\/png;base64,/);
assert.equal(existsSync(join(projectDirectory, "assets", "generated", `${apiImage.body.asset.id}.png`)), true);

const reopenedStore = await projectStore.openProjectStore(projectDirectory);
const reopenedProject = reopenedStore.requireProject();
assert.equal(reopenedProject.assets.some((asset) => asset.id === apiImage.body.asset.id), true);
assert.equal(reopenedProject.generationJobs.some((job) => job.id === apiImage.body.job.id), true);
reopenedStore.close();

await rm(tempRoot, { recursive: true, force: true });
