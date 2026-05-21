import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";

const core = await import("../packages/engine-core/dist/index.js");
const codexGeneration = await import("../packages/generation-codex/dist/index.js");
const projectStore = await import("../packages/project-store/dist/index.js");
const useCasesModule = await import("../packages/use-cases/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");
const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-regression-"));
const projectDirectory = join(tempRoot, "TestGame.vnmaker");
const starterOnlyProjectDirectory = join(tempRoot, "StarterOnly.vnmaker");
const alphaDirectory = join(tempRoot, "AlphaHeroine.vnmaker");
const cliExpansionDirectory = join(tempRoot, "CliExpansion.vnmaker");
const manualCliApiDirectory = join(tempRoot, "ManualCliApi.vnmaker");
const branchEndingDirectory = join(tempRoot, "BranchEnding.vnmaker");
const branchTerminalFailureDirectory = join(tempRoot, "BranchTerminalFailure.vnmaker");
const branchCycleFailureDirectory = join(tempRoot, "BranchCycleFailure.vnmaker");
const bundledClientApiPath = join(tempRoot, "client-api.mjs");
const bundledSceneWorkbenchPath = join(tempRoot, "scene-workbench.mjs");

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
assert.equal(store.requireProject().scenes.find((scene) => scene.id === "scene-haru-smile").ending.id, "ending-default");

const exportedProject = store.exportProjectSnapshot();
assert.equal(exportedProject.id, project.id);
assert.equal(exportedProject.scenes.find((scene) => scene.id === "scene-haru-smile").ending.title, "기본 엔딩");

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
assert.equal(cliOpen.project.scenes.find((scene) => scene.id === "scene-haru-smile").ending.kind, "normal");

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

const cliSaveEndingSceneOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "save-scene"], {
  input: JSON.stringify({
    projectDirectory,
    scene: {
      ...cliOpen.project.scenes.find((scene) => scene.id === "scene-haru-smile"),
      text: "CLI가 ending metadata를 포함한 장면을 저장했다."
    }
  }),
  encoding: "utf8"
});
const cliSaveEndingScene = JSON.parse(cliSaveEndingSceneOutput);
assert.equal(cliSaveEndingScene.ok, true);
assert.equal(cliSaveEndingScene.project.scenes.find((scene) => scene.id === "scene-haru-smile").ending.id, "ending-default");

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
      ...cliSaveEndingScene.project.scenes.find((scene) => scene.id === "scene-haru-smile"),
      text: "Web API가 ending metadata를 포함한 장면을 저장했다."
    }
  }
});
assert.equal(apiScene.status, 200);
assert.equal(apiScene.body.ok, true);
assert.match(apiScene.body.project.scenes.find((scene) => scene.id === "scene-haru-smile").text, /Web API가 ending metadata/);
assert.equal(apiScene.body.project.scenes.find((scene) => scene.id === "scene-haru-smile").ending.title, "기본 엔딩");

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

const manualCliCreateOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "create-project-from-heroine"], {
  input: JSON.stringify({
    projectDirectory: manualCliApiDirectory,
    heroine: {
      id: "haru-manual",
      name: "하루",
      description: "수동 제작 테스트 히로인.",
      personality: "차분하다.",
      speechStyle: "조심스러운 말투.",
      appearance: "단정한 교복."
    },
    title: "Manual CLI API",
    premise: "CLI와 API가 같은 수동 제작 use-case를 호출한다."
  }),
  encoding: "utf8"
});
const manualCliCreate = JSON.parse(manualCliCreateOutput);
assert.equal(manualCliCreate.ok, true);
const manualCliOpeningId = manualCliCreate.project.routes[0].entrySceneId;

execFileSync(process.execPath, ["packages/cli/dist/index.js", "save-scene"], {
  input: JSON.stringify({
    projectDirectory: manualCliApiDirectory,
    scene: {
      ...manualCliCreate.project.scenes.find((scene) => scene.id === manualCliOpeningId),
      next: undefined
    }
  }),
  encoding: "utf8"
});

const manualCliInsertOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "insert-scene"], {
  input: JSON.stringify({
    projectDirectory: manualCliApiDirectory,
    sourceSceneId: manualCliOpeningId,
    link: { type: "choice", choiceId: "choice-good", choiceText: "고백한다" },
    scene: {
      id: "scene-cli-good-ending",
      label: "CLI 굿 엔딩",
      speaker: "하루",
      text: "함께 완성하자.",
      characters: [],
      choices: []
    }
  }),
  encoding: "utf8"
});
const manualCliInsert = JSON.parse(manualCliInsertOutput);
assert.equal(manualCliInsert.ok, true);
assert.equal(manualCliInsert.selectedSceneId, "scene-cli-good-ending");

const manualCliEndingOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "set-scene-ending"], {
  input: JSON.stringify({
    projectDirectory: manualCliApiDirectory,
    sceneId: "scene-cli-good-ending",
    ending: { id: "ending-cli-good", title: "CLI의 약속", kind: "good" }
  }),
  encoding: "utf8"
});
const manualCliEnding = JSON.parse(manualCliEndingOutput);
assert.equal(manualCliEnding.ok, true);
assert.equal(manualCliEnding.routeGraphAnalysis.reachableEndingIds.includes("ending-cli-good"), true);

const manualApiInsert = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/scenes/insert",
  body: {
    projectDirectory: manualCliApiDirectory,
    link: { type: "none" },
    scene: {
      id: "scene-api-normal-ending",
      label: "API 노멀 엔딩",
      speaker: "하루",
      text: "다음 작품도 만들자.",
      characters: [],
      choices: [],
      ending: { id: "ending-api-normal", title: "API의 다음 작품", kind: "normal" }
    }
  }
});
assert.equal(manualApiInsert.status, 200);
assert.equal(manualApiInsert.body.ok, true);

const manualApiLink = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/scenes/link",
  body: {
    projectDirectory: manualCliApiDirectory,
    sourceSceneId: manualCliOpeningId,
    targetSceneId: "scene-api-normal-ending",
    link: { type: "choice", choiceId: "choice-normal", choiceText: "전시를 마무리한다" }
  }
});
assert.equal(manualApiLink.status, 200);
assert.equal(manualApiLink.body.ok, true);
assert.deepEqual(manualApiLink.body.routeGraphAnalysis.uncoveredTerminalSceneIds, []);
assert.deepEqual([...manualApiLink.body.routeGraphAnalysis.reachableEndingIds].sort(), ["ending-api-normal", "ending-cli-good"]);

const manualApiMissingTarget = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/scenes/link",
  body: {
    projectDirectory: manualCliApiDirectory,
    sourceSceneId: manualCliOpeningId,
    targetSceneId: "scene-does-not-exist",
    link: { type: "choice", choiceText: "없는 장면으로 간다" }
  }
});
assert.equal(manualApiMissingTarget.status, 400);
assert.match(manualApiMissingTarget.body.error, /target scene을 찾을 수 없습니다/);

const manualApiEndingFailure = await webHandlers.handleApiRequest({
  method: "POST",
  path: "/api/project/scenes/ending",
  body: {
    projectDirectory: manualCliApiDirectory,
    sceneId: manualCliOpeningId,
    ending: { id: "ending-api-bad", title: "갑작스런 끝", kind: "bad" },
    clearOutgoing: false
  }
});
assert.equal(manualApiEndingFailure.status, 400);
assert.match(manualApiEndingFailure.body.error, /다음 장면이나 선택지를 제거해야 합니다/);

const branchHeroine = core.createHeroineProfile({
  id: "haru-branch",
  name: "하루",
  description: "분기별 엔딩 export 테스트 히로인.",
  personality: "침착하지만 선택 앞에서는 솔직하다.",
  speechStyle: "담백한 말투.",
  appearance: "단정한 교복과 연분홍 머리핀."
});
const createBranchEndingProject = (id) => {
  const branchProject = core.createProjectFromHeroine({
    id,
    title: `Branch Ending ${id}`,
    premise: "두 선택지가 각자 명시적 엔딩으로 도달한다.",
    heroine: branchHeroine
  });
  const opening = branchProject.scenes.find((scene) => scene.id === "scene-haru-branch-opening");
  const defaultEnding = branchProject.scenes.find((scene) => scene.id === "scene-haru-branch-default-ending");
  opening.next = undefined;
  opening.choices = [
    { id: "choice-good", text: "고백한다", next: "scene-good-ending" },
    { id: "choice-normal", text: "전시를 마무리한다", next: "scene-normal-ending" }
  ];
  defaultEnding.id = "scene-good-ending";
  defaultEnding.label = "굿 엔딩";
  defaultEnding.text = "문화제가 끝나도 함께 만들기로 했다.";
  defaultEnding.cgAssetId = "asset-branch-cg";
  defaultEnding.ending = { id: "ending-good", title: "문화제의 약속", kind: "good" };
  branchProject.scenes.push({
    id: "scene-normal-ending",
    label: "노멀 엔딩",
    speaker: "하루",
    text: "오늘의 전시를 조용히 마무리했다.",
    characters: [{ characterId: "haru-branch", expression: "normal", assetId: "asset-haru-branch-portrait", position: "center" }],
    choices: [],
    ending: { id: "ending-normal", title: "다음 작품으로", kind: "normal" }
  });
  branchProject.assets.push({ id: "asset-branch-cg", kind: "cg", label: "문화제 CG", source: "placeholder" });
  return branchProject;
};

const branchEndingProject = createBranchEndingProject("branch-ending-export");
const branchEndingStore = await projectStore.createProjectWorkspace({
  projectDirectory: branchEndingDirectory,
  project: branchEndingProject
});
const branchExport = await branchEndingStore.exportWebPlayer(join(tempRoot, "branch-ending-export"));
assert.equal(branchExport.smoke.ok, true);
assert.equal(branchExport.smoke.checks.branchEndingCoverage, true);
assert.equal(branchExport.smoke.checks.endingMetadata, true);
assert.deepEqual([...branchExport.smoke.reachableEndingIds].sort(), ["ending-good", "ending-normal"]);
assert.deepEqual(branchExport.smoke.uncoveredTerminalSceneIds, []);
assert.deepEqual(branchExport.smoke.cyclesWithoutEndingPath, []);
const branchRuntimeScript = readFileSync(branchExport.export.runtimeScriptPath, "utf8");
assert.match(branchRuntimeScript, /엔딩:/);
assert.match(branchRuntimeScript, /처음부터 다시/);
assert.match(branchRuntimeScript, /vn-ending/);
branchEndingStore.close();

await esbuild({
  entryPoints: ["apps/web/src/client/components/SceneWorkbench.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundledSceneWorkbenchPath
});
const sceneWorkbench = await import(pathToFileURL(bundledSceneWorkbenchPath).href);
const branchUiSummary = sceneWorkbench.createRouteCompletionSummary(branchEndingProject, branchEndingProject.routes[0].id);
assert.equal(branchUiSummary.endingCount, 2);
assert.equal(branchUiSummary.openBranchCount, 0);
assert.deepEqual([...branchUiSummary.reachableEndingIds].sort(), ["ending-good", "ending-normal"]);
assert.equal(branchUiSummary.routeRows[0].sceneId, "scene-haru-branch-opening");
assert.equal(branchUiSummary.routeRows.some((row) => row.parentSceneId === "scene-haru-branch-opening" && row.viaChoiceId === "choice-good"), true);
assert.equal(sceneWorkbench.selectSceneOptions(branchEndingProject).some((option) => option.value === "scene-normal-ending"), true);
const blankSceneDraft = sceneWorkbench.createBlankSceneDraft(branchEndingProject, "scene-good-ending");
assert.equal(blankSceneDraft.id.startsWith("scene-good-ending-next"), true);
assert.equal(blankSceneDraft.choices.length, 0);

const branchTerminalFailureProject = createBranchEndingProject("branch-terminal-failure");
delete branchTerminalFailureProject.scenes.find((scene) => scene.id === "scene-normal-ending").ending;
const branchTerminalFailureStore = await projectStore.createProjectWorkspace({
  projectDirectory: branchTerminalFailureDirectory,
  project: branchTerminalFailureProject
});
await assert.rejects(
  () => branchTerminalFailureStore.exportWebPlayer(join(tempRoot, "branch-terminal-failure-export")),
  /엔딩 없이 끝납니다|검증 실패 프로젝트/
);
branchTerminalFailureStore.close();

const branchCycleFailureProject = createBranchEndingProject("branch-cycle-failure");
const cycleScene = branchCycleFailureProject.scenes.find((scene) => scene.id === "scene-normal-ending");
delete cycleScene.ending;
cycleScene.next = "scene-cycle-loop";
branchCycleFailureProject.scenes.push({
  id: "scene-cycle-loop",
  label: "순환 장면",
  speaker: "하루",
  text: "결말 없이 같은 고민으로 돌아온다.",
  characters: [{ characterId: "haru-branch", expression: "normal", assetId: "asset-haru-branch-portrait", position: "center" }],
  choices: [],
  next: "scene-normal-ending"
});
const branchCycleFailureStore = await projectStore.createProjectWorkspace({
  projectDirectory: branchCycleFailureDirectory,
  project: branchCycleFailureProject
});
await assert.rejects(
  () => branchCycleFailureStore.exportWebPlayer(join(tempRoot, "branch-cycle-failure-export")),
  /순환합니다|검증 실패 프로젝트/
);
branchCycleFailureStore.close();

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

let mockCodexTextCalls = 0;
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
  },
  async generateEventExpansionPlan({ request }) {
    mockCodexTextCalls += 1;
    return core.createDeterministicEventExpansionPlan(request);
  }
};

const mockApi = webHandlers.createApiRequestHandler({ codex: mockCodex });
const apiServerFailure = await mockApi({
  method: "POST",
  path: "/api/project/open",
  body: { projectDirectory: "/dev/null/Nope.vnmaker" }
});
assert.equal(apiServerFailure.status, 500);

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

const haruHeroine = core.createHeroineProfile({
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 조용한 같은 반 학생.",
  personality: "차분하지만 당황하면 솔직한 반응이 먼저 나온다.",
  speechStyle: "짧고 조심스럽게 말한다.",
  appearance: "단정한 교복, 어깨까지 오는 검은 머리, 연한 분홍색 머리핀.",
  defaultPortraitAssetId: "asset-haru-portrait"
});
const alphaProject = core.createProjectFromHeroine({
  id: "alpha-haru",
  title: "하루 Alpha",
  premise: "도서관에서 시작하는 짧은 로맨틱 코미디",
  heroine: haruHeroine
});
assert.equal(alphaProject.characters.length, 1);
assert.equal(alphaProject.routes.length, 1);
assert.equal(alphaProject.routes[0].heroineId, "haru");

const alphaStore = await projectStore.createProjectWorkspace({ projectDirectory: alphaDirectory, project: alphaProject });
alphaStore.saveHeroine(haruHeroine);
alphaStore.saveHeroine(core.createHeroineProfile({
  id: "mira-library",
  name: "미라",
  description: "방송부에서 게임 홍보를 돕는 친구.",
  personality: "명랑하고 추진력이 있다.",
  speechStyle: "활기찬 말투.",
  appearance: "짧은 갈색 머리와 밝은 표정."
}));
assert.equal(alphaStore.listHeroines().length, 2);
alphaStore.deleteHeroine("haru");
assert.equal(alphaStore.listHeroines().some((heroine) => heroine.id === "haru"), false);
assert.equal(alphaStore.requireProject().characters[0].displayName, "하루");

const eventRequest = core.createEventExpansionRequest(alphaStore.requireProject(), {
  projectDirectory: alphaDirectory,
  routeId: alphaStore.requireProject().routes[0].id,
  afterSceneId: alphaStore.requireProject().scenes[0].id,
  heroineId: "haru",
  userEvent: "하루와 도서관에서 있던 일이야. 하루가 책을 떨어트리고, 내가 책을 주워주려다가 두 사람의 손이 겹쳐. 둘 다 당황해서 어색해지는 짧은 러브코미디 이벤트로 만들고 노멀 엔딩으로 끝내줘. 씬은 3개, CG는 1개만 만들어줘.",
  constraints: {
    maxScenes: 3,
    maxChoices: 1,
    maxCgCount: 1,
    allowNewExpressionAssets: false,
    language: "ko",
    contentRating: "teen"
  }
});
const badEventPlan = {
  ...core.createDeterministicEventExpansionPlan(eventRequest),
  decision: {
    sceneCount: 3,
    choiceCount: 1,
    cgCount: 1,
    newExpressionAssetCount: 1
  }
};
const badPatchValidation = core.validateEventExpansionPlan(alphaStore.requireProject(), eventRequest, badEventPlan);
assert.equal(badPatchValidation.ok, false);
assert.equal(alphaStore.requireProject().scenes.length, 2);

assert.equal("expandNaturalLanguageEvent" in codexGeneration, false);
const generatedEvent = await useCasesModule.expandNaturalLanguageEvent({
  project: alphaStore.requireProject(),
  request: eventRequest,
  maxAttempts: 2,
  adapter: {
    async generateEventExpansionPlan({ attempt }) {
      return attempt === 1
        ? badEventPlan
        : core.createDeterministicEventExpansionPlan(eventRequest);
    }
  }
});
assert.equal(generatedEvent.ok, true);
assert.equal(generatedEvent.attempts.length, 2);
assert.equal(generatedEvent.plan.decision.sceneCount, 3);
assert.equal(generatedEvent.plan.decision.choiceCount, 1);
assert.equal(generatedEvent.plan.decision.cgCount, 1);
assert.match(core.describeProjectPatch(generatedEvent.plan.patch).text, /CG 작업/);

const apiExpand = await mockApi({
  method: "POST",
  path: "/api/events/expand",
  body: {
    projectDirectory: alphaDirectory,
    userEvent: eventRequest.userEvent,
    routeId: eventRequest.routeId,
    afterSceneId: eventRequest.afterSceneId,
    heroineId: eventRequest.heroineId
  }
});
assert.equal(apiExpand.status, 200);
assert.equal(apiExpand.body.plan.decision.sceneCount, 3);
assert.equal(apiExpand.body.validation.ok, true);
assert.equal(alphaStore.requireProject().scenes.length, 2);
assert.equal(mockCodexTextCalls, 0);

const apiApprove = await mockApi({
  method: "POST",
  path: "/api/events/approve",
  body: {
    projectDirectory: alphaDirectory,
    request: apiExpand.body.request,
    plan: apiExpand.body.plan
  }
});
assert.equal(apiApprove.status, 200);
assert.equal(apiApprove.body.validation.ok, true);
assert.equal(apiApprove.body.project.scenes.length, 5);

const approvedProject = apiApprove.body.project;
const plannedCgJob = approvedProject.generationJobs.find((job) => job.kind === "cg" && job.status === "planned");
assert.equal(Boolean(plannedCgJob), true);
const generatedCg = await mockApi({
  method: "POST",
  path: "/api/generation/images",
  body: {
    projectDirectory: alphaDirectory,
    kind: "cg",
    targetId: plannedCgJob.targetId,
    jobId: plannedCgJob.id,
    outputAssetId: plannedCgJob.outputAssetId,
    prompt: plannedCgJob.prompt,
    style: plannedCgJob.style
  }
});
assert.equal(generatedCg.status, 200);
assert.equal(generatedCg.body.asset.id, plannedCgJob.outputAssetId);
assert.equal(generatedCg.body.job.status, "completed");
assert.equal(existsSync(join(alphaDirectory, "assets", "generated", `${plannedCgJob.outputAssetId}.png`)), true);

const apiPreview = await mockApi({
  method: "POST",
  path: "/api/project/preview",
  body: {
    projectDirectory: alphaDirectory,
    startSceneId: eventRequest.afterSceneId
  }
});
assert.equal(apiPreview.status, 200);
assert.equal(apiPreview.body.runtime.startSceneId, eventRequest.afterSceneId);
assert.equal(apiPreview.body.runtime.scenes.some((scene) => scene.cgAsset?.id === plannedCgJob.outputAssetId), true);
assert.equal(apiPreview.body.runtime.scenes.some((scene) => scene.choices.length === 1), true);

const apiExport = await mockApi({
  method: "POST",
  path: "/api/project/export",
  body: { projectDirectory: alphaDirectory }
});
assert.equal(apiExport.status, 200);
assert.equal(apiExport.body.smoke.ok, true);
assert.equal(existsSync(join(apiExport.body.export.outputDirectory, "index.html")), true);
assert.equal(existsSync(join(apiExport.body.export.outputDirectory, "project-data.json")), true);
assert.equal(existsSync(join(apiExport.body.export.outputDirectory, "runtime", "player.js")), true);

const cliPreviewOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "preview"], {
  input: JSON.stringify({ projectDirectory: alphaDirectory, startSceneId: eventRequest.afterSceneId }),
  encoding: "utf8"
});
const cliPreview = JSON.parse(cliPreviewOutput);
assert.equal(cliPreview.ok, true);
assert.equal(cliPreview.runtime.scenes.some((scene) => scene.cgAsset?.id === plannedCgJob.outputAssetId), true);

const cliBundle = readFileSync("packages/cli/dist/index.js", "utf8");
assert.match(cliBundle, /createVnMakerUseCases/);
assert.match(cliBundle, /useCases\.expandEvent/);
assert.doesNotMatch(cliBundle, /expandNaturalLanguageEvent/);

const cliExpandOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "expand-event"], {
  input: JSON.stringify({
    projectDirectory: cliExpansionDirectory,
    project: core.createProjectFromHeroine({
      id: "cli-expansion",
      title: "CLI Expansion",
      premise: "CLI가 공통 expansion use case를 호출하는 회귀 테스트",
      heroine: haruHeroine
    }),
    routeId: "haru-route",
    afterSceneId: "scene-haru-opening",
    heroineId: "haru",
    userEvent: "방과 후 복도에서 우연히 마주치고 노멀 엔딩으로 끝나는 짧은 이벤트"
  }),
  encoding: "utf8"
});
const cliExpand = JSON.parse(cliExpandOutput);
assert.equal(cliExpand.ok, true);
assert.equal(cliExpand.validation.ok, true);
assert.equal(cliExpand.attempts.length, 1);
assert.equal(cliExpand.patchHistoryEntry.status, "proposed");

const cliSmokeOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "smoke-export"], {
  input: JSON.stringify({ outputPath: apiExport.body.export.outputDirectory }),
  encoding: "utf8"
});
const cliSmoke = JSON.parse(cliSmokeOutput);
assert.equal(cliSmoke.ok, true);
assert.equal(cliSmoke.smoke.ok, true);

alphaStore.close();

await esbuild({
  entryPoints: ["apps/web/src/client/api/client.ts"],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: bundledClientApiPath
});
const clientApi = await import(pathToFileURL(bundledClientApiPath).href);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("", {
  status: 500,
  headers: { "Content-Type": "text/plain" }
});
const emptyLoginResponse = await clientApi.postJson("/api/codex/login", { flow: "browser" });
assert.equal(emptyLoginResponse.ok, false);
assert.equal(emptyLoginResponse.httpStatus, 500);
assert.match(emptyLoginResponse.error, /응답이 비어 있습니다|JSON/);
globalThis.fetch = originalFetch;

const webPackage = JSON.parse(readFileSync("apps/web/package.json", "utf8"));
assert.equal(webPackage.scripts.dev, "node scripts/dev.mjs");
assert.equal(existsSync("apps/web/scripts/dev.mjs"), true);

await rm(tempRoot, { recursive: true, force: true });
