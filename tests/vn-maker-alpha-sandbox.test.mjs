import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const alphaSandbox = await import("../packages/alpha-sandbox/dist/index.js");
const core = await import("../packages/engine-core/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");
const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-alpha-sandbox-"));
const previousSandboxEnv = process.env.VN_MAKER_ALPHA_SANDBOX;

function runCli(command, input, env = {}) {
  return JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", command], {
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      ...env
    }
  }));
}

function runCliFailure(command, input, env = {}) {
  try {
    runCli(command, input, env);
  } catch (error) {
    if (error && typeof error === "object" && "stdout" in error) {
      return JSON.parse(String(error.stdout));
    }
    throw error;
  }
  throw new Error(`CLI command unexpectedly succeeded: ${command}`);
}

async function createFakeLoggedOutCodexBin(root) {
  const binDirectory = join(root, "fake-codex-bin");
  const codexPath = join(binDirectory, "codex");
  await mkdir(binDirectory, { recursive: true });
  await writeFile(codexPath, `#!/usr/bin/env node
process.stdin.setEncoding("utf8");
let buffer = "";
function write(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}
function handle(message) {
  if (!("id" in message)) return;
  if (message.method === "initialize") {
    write({ id: message.id, result: {} });
    return;
  }
  if (message.method === "account/read") {
    write({ id: message.id, result: { account: null, requiresOpenaiAuth: true } });
    return;
  }
  if (message.method === "modelProvider/capabilities/read") {
    write({ id: message.id, result: { imageGeneration: true, namespaceTools: false, webSearch: false } });
    return;
  }
  if (message.method === "account/login/start") {
    write({ id: message.id, result: { type: message.params?.type || "chatgpt", loginId: "fake-login", authUrl: "https://chatgpt.com/auth" } });
    return;
  }
  if (message.method === "account/logout") {
    write({ id: message.id, result: {} });
    return;
  }
  write({ id: message.id, error: { message: "fake codex only supports auth/session methods" } });
}
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\\n");
    if (line) handle(JSON.parse(line));
  }
});
`, "utf8");
  await chmod(codexPath, 0o755);
  return binDirectory;
}

try {
  const pack = alphaSandbox.createAlphaSandboxPack();
  assert.equal(pack.provenance, "alpha-sandbox-pack@0.1.0");
  assert.equal(pack.assets.filter((asset) => asset.kind === "expression").length, 2);
  assert.equal(pack.assets.some((asset) => asset.kind === "background"), true);
  assert.equal(pack.assets.some((asset) => asset.kind === "cg"), true);

  const authRequiredApi = webHandlers.createApiRequestHandler({
    codex: {
      async readSession() {
        return {
          connected: false,
          mode: null,
          account: null,
          requiresOpenaiAuth: true,
          capabilities: null
        };
      },
      async startLogin() {
        return {
          type: "chatgpt",
          loginId: "login-required",
          authUrl: "https://chatgpt.com/auth"
        };
      },
      async logout() {
        return undefined;
      },
      async generateImageAsset() {
        throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
      },
      async generateEventExpansionPlan() {
        throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
      }
    }
  });

  const sandboxOffDirectory = join(tempRoot, "SandboxOff.vnmaker");
  const sandboxOffExpansion = await authRequiredApi({
    method: "POST",
    path: "/api/events/expand",
    body: {
      projectDirectory: sandboxOffDirectory,
      starter: {
        id: "sandbox-off",
        title: "Sandbox Off",
        premise: "일반 경로는 Codex OAuth 요구를 유지한다."
      },
      userEvent: "샌드박스가 꺼졌을 때 deterministic fallback으로 성공하면 안 된다."
    }
  });
  assert.equal(sandboxOffExpansion.status, 401);
  assert.match(String(sandboxOffExpansion.body.error), /OAuth 로그인이 필요/);
  assert.equal(sandboxOffExpansion.body.action, "expandEvent");

  const fakeCodexBin = await createFakeLoggedOutCodexBin(tempRoot);
  const fakeCodexPath = `${fakeCodexBin}:${process.env.PATH || ""}`;
  const cliSandboxOffExpansion = runCliFailure("expand-event", {
    projectDirectory: join(tempRoot, "CliSandboxOff.vnmaker"),
    starter: {
      id: "cli-sandbox-off",
      title: "CLI Sandbox Off",
      premise: "CLI 일반 경로는 Codex OAuth 요구를 유지한다."
    },
    userEvent: "샌드박스가 꺼진 CLI 경로는 fixture fallback으로 성공하면 안 된다."
  }, {
    PATH: fakeCodexPath,
    VN_MAKER_ALPHA_SANDBOX: ""
  });
  assert.equal(cliSandboxOffExpansion.ok, false);
  assert.match(String(cliSandboxOffExpansion.error), /OAuth 로그인이 필요/);

  const imageOnlyApi = webHandlers.createApiRequestHandler({
    codex: {
      async readSession() {
        return {
          connected: false,
          mode: null,
          account: null,
          requiresOpenaiAuth: true,
          capabilities: null
        };
      },
      async startLogin() {
        return {
          type: "chatgpt",
          loginId: "image-only-login",
          authUrl: "https://chatgpt.com/auth"
        };
      },
      async logout() {
        return undefined;
      },
      async generateImageAsset() {
        throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
      }
    }
  });
  const missingTextAdapterExpansion = await imageOnlyApi({
    method: "POST",
    path: "/api/events/expand",
    body: {
      projectDirectory: join(tempRoot, "MissingTextAdapter.vnmaker"),
      starter: {
        id: "missing-text-adapter",
        title: "Missing Text Adapter",
        premise: "텍스트 adapter 누락 시 deterministic fallback을 막는다."
      },
      userEvent: "텍스트 adapter가 없으면 성공하면 안 된다."
    }
  });
  assert.equal(missingTextAdapterExpansion.status, 401);
  assert.match(String(missingTextAdapterExpansion.body.error), /OAuth 로그인이 필요/);

  const imageFailureProjectDirectory = join(tempRoot, "ImageFailureProject.vnmaker");
  const imageFailureApi = webHandlers.createApiRequestHandler({
    codex: {
      async readSession() {
        return {
          connected: false,
          mode: null,
          account: null,
          requiresOpenaiAuth: true,
          capabilities: null
        };
      },
      async startLogin() {
        return {
          type: "chatgpt",
          loginId: "image-failure-login",
          authUrl: "https://chatgpt.com/auth"
        };
      },
      async logout() {
        return undefined;
      },
      async generateImageAsset() {
        throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
      },
      async generateEventExpansionPlan() {
        throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
      }
    }
  });
  const imageFailureProject = await imageFailureApi({
    method: "POST",
    path: "/api/projects",
    body: {
      projectDirectory: imageFailureProjectDirectory,
      starter: {
        id: "image-failure-project",
        title: "Image Failure Project",
        premise: "이미지 생성 실패 분류를 검증한다."
      }
    }
  });
  assert.equal(imageFailureProject.status, 200);
  const imageFailureJob = await imageFailureApi({
    method: "POST",
    path: "/api/generation/jobs",
    body: {
      projectDirectory: imageFailureProjectDirectory,
      id: "job-image-failure-background",
      kind: "background",
      targetId: "image-failure-project",
      prompt: "failure background",
      outputAssetId: "asset-image-failure-background"
    }
  });
  assert.equal(imageFailureJob.status, 200);
  const imageFailureRun = await imageFailureApi({
    method: "POST",
    path: "/api/generation/jobs/run",
    body: {
      projectDirectory: imageFailureProjectDirectory,
      jobIds: ["job-image-failure-background"],
      replaceCompleted: true
    }
  });
  assert.equal(imageFailureRun.status, 401);
  assert.equal(imageFailureRun.body.ok, false);
  assert.equal(imageFailureRun.body.code, "OAUTH_REQUIRED");
  assert.match(String(imageFailureRun.body.message), /OAuth 로그인이 필요/);
  assert.equal(imageFailureRun.body.retryable, true);

  process.env.VN_MAKER_ALPHA_SANDBOX = "1";
  const sandboxApi = webHandlers.createApiRequestHandler();
  const sandboxSession = await sandboxApi({ method: "GET", path: "/api/codex/session" });
  assert.equal(sandboxSession.status, 200);
  assert.equal(sandboxSession.body.connected, true);
  assert.equal(sandboxSession.body.mode, "alpha-sandbox");
  assert.equal(sandboxSession.body.sandbox.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);
  assert.doesNotMatch(String(sandboxSession.body.note), /OAuth 로그인처럼/);

  const apiProjectDirectory = join(tempRoot, "ApiSandbox.vnmaker");
  const apiProject = await sandboxApi({
    method: "POST",
    path: "/api/projects/from-heroine",
    body: {
      projectDirectory: apiProjectDirectory,
      heroine: alphaSandbox.createAlphaSandboxHeroine(),
      title: "API Alpha Sandbox",
      premise: "API가 OAuth 없이 전체 제작 경로를 검증한다."
    }
  });
  assert.equal(apiProject.status, 200);
  assert.equal(apiProject.body.project.characters.length, 1);
  assert.equal(apiProject.body.project.routes.length, 1);

  const apiDuplicateProject = await sandboxApi({
    method: "POST",
    path: "/api/projects/from-heroine",
    body: {
      projectDirectory: apiProjectDirectory,
      projectId: "api-second-project",
      heroine: alphaSandbox.createAlphaSandboxHeroine(),
      title: "API Second Project",
      premise: "기존 프로젝트를 덮어쓰면 안 된다."
    }
  });
  assert.equal(apiDuplicateProject.status, 409);
  assert.equal(apiDuplicateProject.body.action, "createProjectFromHeroine");
  assert.equal(apiDuplicateProject.body.code, "PROJECT_ID_MISMATCH");
  const apiProjectAfterDuplicate = await sandboxApi({
    method: "POST",
    path: "/api/project/open",
    body: { projectDirectory: apiProjectDirectory }
  });
  assert.equal(apiProjectAfterDuplicate.body.project.id, apiProject.body.project.id);

  const staleProjectDirectory = join(tempRoot, "ApiStaleSandbox.vnmaker");
  const staleProject = await sandboxApi({
    method: "POST",
    path: "/api/projects/from-heroine",
    body: {
      projectDirectory: staleProjectDirectory,
      heroine: alphaSandbox.createAlphaSandboxHeroine(),
      title: "API Stale Sandbox",
      premise: "패치 기준 프로젝트 변경을 검증한다."
    }
  });
  assert.equal(staleProject.status, 200);
  const staleRoute = staleProject.body.project.routes[0];
  const staleAfterScene = staleProject.body.project.scenes[0];
  const staleExpansion = await sandboxApi({
    method: "POST",
    path: "/api/events/expand",
    body: {
      projectDirectory: staleProjectDirectory,
      routeId: staleRoute.id,
      afterSceneId: staleAfterScene.id,
      heroineId: staleRoute.heroineId,
      userEvent: "하루와 방과 후 도서관에서 손이 겹치는 이벤트를 만들어줘."
    }
  });
  assert.equal(staleExpansion.status, 200);
  const staleMutation = await sandboxApi({
    method: "POST",
    path: "/api/project/scenes",
    body: {
      projectDirectory: staleProjectDirectory,
      scene: {
        ...staleAfterScene,
        text: `${staleAfterScene.text} 기준 프로젝트를 바꾼다.`
      }
    }
  });
  assert.equal(staleMutation.status, 200);
  const staleApproval = await sandboxApi({
    method: "POST",
    path: "/api/events/approve",
    body: {
      projectDirectory: staleProjectDirectory,
      request: staleExpansion.body.request,
      plan: staleExpansion.body.plan,
      patchHistoryId: staleExpansion.body.patchHistoryEntry.id
    }
  });
  assert.equal(staleApproval.status, 409);
  assert.equal(staleApproval.body.action, "approveEvent");
  assert.equal(staleApproval.body.code, "PATCH_STALE");
  assert.equal(staleApproval.body.retryable, false);
  assert.equal(staleApproval.body.workflowSummary.previewState, "blocked");
  assert.equal(staleApproval.body.workflowSummary.primaryAction, "goToBackground");

  const apiRoute = apiProject.body.project.routes[0];
  const apiAfterSceneId = apiProject.body.project.scenes[0].id;
  const apiExpansion = await sandboxApi({
    method: "POST",
    path: "/api/events/expand",
    body: {
      projectDirectory: apiProjectDirectory,
      routeId: apiRoute.id,
      afterSceneId: apiAfterSceneId,
      heroineId: apiRoute.heroineId,
      userEvent: "하루와 도서관에서 책을 줍다가 손이 겹치는 짧은 러브코미디 이벤트를 만들어줘."
    }
  });
  assert.equal(apiExpansion.status, 200);
  assert.equal(apiExpansion.body.plan.decision.sceneCount, 3);
  assert.equal(apiExpansion.body.rawOutput.metadata.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);

  const apiApproval = await sandboxApi({
    method: "POST",
    path: "/api/events/approve",
    body: {
      projectDirectory: apiProjectDirectory,
      request: apiExpansion.body.request,
      plan: apiExpansion.body.plan,
      patchHistoryId: apiExpansion.body.patchHistoryEntry.id
    }
  });
  assert.equal(apiApproval.status, 200);
  assert.equal(apiApproval.body.validation.ok, true);
  const apiPlannedCgJob = apiApproval.body.project.generationJobs.find((job) => job.kind === "cg" && job.status === "planned");
  assert.equal(Boolean(apiPlannedCgJob), true);

  const apiBlockedExport = await sandboxApi({
    method: "POST",
    path: "/api/project/export",
    body: { projectDirectory: apiProjectDirectory }
  });
  assert.equal(apiBlockedExport.status, 409);
  assert.equal(apiBlockedExport.body.action, "exportProject");
  assert.equal(apiBlockedExport.body.code, "EXPORT_BLOCKED");
  assert.equal(apiBlockedExport.body.workflowSummary.generationState, "planned");
  assert.equal(apiBlockedExport.body.exportPlan.state, "blocked");
  assert.equal(apiBlockedExport.body.exportPlan.canExport, false);
  assert.equal(apiBlockedExport.body.exportPlan.target, "localDesktopWebApp");
  assert.equal(apiBlockedExport.body.exportPlan.githubPagesTarget, false);
  assert.equal(apiBlockedExport.body.exportPlan.blockers.some((blocker) => blocker.kind === "generationJob"), true);

  const apiGeneratedImage = await sandboxApi({
    method: "POST",
    path: "/api/generation/images",
    body: {
      projectDirectory: apiProjectDirectory,
      jobId: apiPlannedCgJob.id
    }
  });
  assert.equal(apiGeneratedImage.status, 200);
  assert.equal(apiGeneratedImage.body.job.provider, core.MOCK_IMAGE_PACK_ADAPTER);
  assert.equal(apiGeneratedImage.body.job.dummy, true);
  assert.equal(apiGeneratedImage.body.job.fallbackReason, "alpha-sandbox");
  assert.equal(apiGeneratedImage.body.job.packVersion, alphaSandbox.ALPHA_SANDBOX_PACK_VERSION);
  assert.equal(apiGeneratedImage.body.dummy, true);
  assert.equal(apiGeneratedImage.body.fallbackReason, "alpha-sandbox");
  assert.equal(apiGeneratedImage.body.packVersion, alphaSandbox.ALPHA_SANDBOX_PACK_VERSION);
  assert.equal(apiGeneratedImage.body.raw.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);
  assert.equal(apiGeneratedImage.body.raw.adapter, core.MOCK_IMAGE_PACK_ADAPTER);
  assert.equal(apiGeneratedImage.body.asset.source, "mock");
  assert.equal(apiGeneratedImage.body.asset.provenance.adapter, core.MOCK_IMAGE_PACK_ADAPTER);
  assert.equal(apiGeneratedImage.body.asset.provenance.packVersion, alphaSandbox.ALPHA_SANDBOX_PACK_VERSION);
  assert.equal(existsSync(join(apiProjectDirectory, "assets", "generated", `${apiPlannedCgJob.outputAssetId}.png`)), true);

  const apiBackgroundImage = await sandboxApi({
    method: "POST",
    path: "/api/generation/images",
    body: {
      projectDirectory: apiProjectDirectory,
      kind: "background",
      targetId: apiProject.body.project.id,
      prompt: "shared API background",
      outputAssetId: "asset-api-direct-background"
    }
  });
  assert.equal(apiBackgroundImage.status, 200);
  assert.equal(apiBackgroundImage.body.asset.kind, "background");
  assert.equal(apiBackgroundImage.body.job.kind, "background");
  assert.equal(
    apiBackgroundImage.body.project.scenes.some((scene) => scene.backgroundAssetId === "asset-api-direct-background"),
    true
  );

  const apiBackgroundJob = await sandboxApi({
    method: "POST",
    path: "/api/generation/jobs",
    body: {
      projectDirectory: apiProjectDirectory,
      id: "job-api-background",
      kind: "background",
      targetId: apiProject.body.project.id,
      prompt: "alpha sandbox classroom background",
      outputAssetId: "asset-api-background"
    }
  });
  assert.equal(apiBackgroundJob.status, 200);
  assert.equal(apiBackgroundJob.body.job.kind, "background");
  assert.equal(apiBackgroundJob.body.backgroundPolicy.limit, 1);
  assert.equal(apiBackgroundJob.body.backgroundPolicy.replacesExisting, true);
  const apiBackgroundRun = await sandboxApi({
    method: "POST",
    path: "/api/generation/jobs/run",
    body: { projectDirectory: apiProjectDirectory, jobIds: ["job-api-background"], replaceCompleted: true }
  });
  assert.equal(apiBackgroundRun.status, 200);
  assert.equal(apiBackgroundRun.body.assets[0].kind, "background");
  assert.equal(apiBackgroundRun.body.backgroundPolicy.limit, 1);
  assert.equal(apiBackgroundRun.body.project.assets.filter((asset) => asset.kind === "background").length, 1);
  assert.equal(
    apiBackgroundRun.body.project.scenes.some((scene) => scene.backgroundAssetId === "asset-api-background"),
    true
  );

  const apiPreview = await sandboxApi({
    method: "POST",
    path: "/api/project/preview",
    body: {
      projectDirectory: apiProjectDirectory,
      startSceneId: apiAfterSceneId
    }
  });
  assert.equal(apiPreview.status, 200);
  assert.equal(apiPreview.body.runtime.scenes.some((scene) => scene.cgAsset?.id === apiPlannedCgJob.outputAssetId), true);
  assert.equal(apiPreview.body.runtime.scenes.some((scene) => scene.cgAsset?.source === "mock"), true);
  assert.equal(apiPreview.body.runtime.scenes.some((scene) => scene.cgAsset?.provenance?.packVersion === alphaSandbox.ALPHA_SANDBOX_PACK_VERSION), true);
  assert.equal(apiPreview.body.previewReadiness.state, "prepared");
  assert.equal(apiPreview.body.previewReadiness.canRun, true);
  assert.equal(apiPreview.body.previewReadiness.requiredData.background, "ready");

  const apiExport = await sandboxApi({
    method: "POST",
    path: "/api/project/export",
    body: { projectDirectory: apiProjectDirectory }
  });
  assert.equal(apiExport.status, 200);
  assert.equal(apiExport.body.smoke.ok, true);
  assert.equal(apiExport.body.exportPlan.state, "complete");
  assert.equal(apiExport.body.exportPlan.target, "localDesktopWebApp");
  assert.equal(apiExport.body.exportPlan.githubPagesTarget, false);
  assert.equal(apiExport.body.exportPlan.includedData.includes("assetManifest"), true);
  assert.equal(apiExport.body.exportPlan.includedAssets.some((asset) => asset.kind === "background"), true);
  assert.equal(apiExport.body.exportPlan.includedAssets.some((asset) => asset.source === "mock" && asset.provenance?.adapter === core.MOCK_IMAGE_PACK_ADAPTER), true);
  assert.equal(existsSync(join(apiExport.body.export.outputDirectory, "index.html")), true);
  const apiProjectData = JSON.parse(readFileSync(join(apiExport.body.export.outputDirectory, "project-data.json"), "utf8"));
  assert.equal(apiProjectData.assets.some((asset) => String(asset.label).includes(alphaSandbox.ALPHA_SANDBOX_PROVENANCE)), true);
  assert.equal(apiProjectData.assets.some((asset) => asset.source === "mock" && asset.provenance?.packVersion === alphaSandbox.ALPHA_SANDBOX_PACK_VERSION), true);

  const apiHistory = await sandboxApi({
    method: "POST",
    path: "/api/events/history",
    body: { projectDirectory: apiProjectDirectory }
  });
  assert.equal(apiHistory.status, 200);
  assert.equal(apiHistory.body.entries.some((entry) => entry.rawOutput?.metadata?.provenance === alphaSandbox.ALPHA_SANDBOX_PROVENANCE), true);

  const cliEnv = { VN_MAKER_ALPHA_SANDBOX: "1" };
  const cliProjectDirectory = join(tempRoot, "CliSandbox.vnmaker");
  const cliInspect = runCli("inspect", {}, cliEnv);
  assert.equal(cliInspect.sandbox.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);
  const cliSandboxAuth = runCli("codex-auth-status", {}, { ...cliEnv, PATH: fakeCodexPath });
  assert.equal(cliSandboxAuth.session.mode, "alpha-sandbox");
  assert.equal(cliSandboxAuth.session.sandbox.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);
  const cliSandboxLogin = runCli("codex-login", { login: { flow: "device" } }, { ...cliEnv, PATH: fakeCodexPath });
  assert.equal(cliSandboxLogin.login.type, "alphaSandbox");
  assert.equal(cliSandboxLogin.login.loginId, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);
  const cliSandboxLogout = runCli("codex-logout", {}, { ...cliEnv, PATH: fakeCodexPath });
  assert.equal(cliSandboxLogout.session.mode, "alpha-sandbox");

  const cliProject = runCli("create-project-from-heroine", {
    projectDirectory: cliProjectDirectory,
    heroine: alphaSandbox.createAlphaSandboxHeroine(),
    title: "CLI Alpha Sandbox",
    premise: "CLI가 OAuth 없이 전체 제작 경로를 검증한다."
  }, cliEnv);
  assert.equal(cliProject.ok, true);
  const cliRoute = cliProject.project.routes[0];
  const cliAfterSceneId = cliProject.project.scenes[0].id;

  const cliExpansion = runCli("expand-event", {
    projectDirectory: cliProjectDirectory,
    routeId: cliRoute.id,
    afterSceneId: cliAfterSceneId,
    heroineId: cliRoute.heroineId,
    userEvent: "하루와 도서관에서 손이 겹치는 샌드박스 이벤트"
  }, cliEnv);
  assert.equal(cliExpansion.ok, true);
  assert.equal(cliExpansion.rawOutput.metadata.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);

  const cliApproval = runCli("approve-event", {
    projectDirectory: cliProjectDirectory,
    request: cliExpansion.request,
    plan: cliExpansion.plan,
    patchHistoryId: cliExpansion.patchHistoryEntry.id
  }, cliEnv);
  assert.equal(cliApproval.validation.ok, true);
  const cliPlannedCgJob = cliApproval.project.generationJobs.find((job) => job.kind === "cg" && job.status === "planned");
  assert.equal(Boolean(cliPlannedCgJob), true);

  const cliBlockedExport = runCliFailure("export-web", {
    projectDirectory: cliProjectDirectory
  }, cliEnv);
  assert.equal(cliBlockedExport.action, "exportProject");
  assert.equal(cliBlockedExport.code, "EXPORT_BLOCKED");
  assert.equal(cliBlockedExport.workflowSummary.generationState, "planned");
  assert.equal(cliBlockedExport.exportPlan.state, "blocked");
  assert.equal(cliBlockedExport.exportPlan.canExport, false);
  assert.equal(cliBlockedExport.exportPlan.target, "localDesktopWebApp");
  assert.equal(cliBlockedExport.exportPlan.blockers.some((blocker) => blocker.kind === "generationJob"), true);

  const cliGeneratedImage = runCli("generate-image", {
    projectDirectory: cliProjectDirectory,
    jobId: cliPlannedCgJob.id
  }, cliEnv);
  assert.equal(cliGeneratedImage.ok, true);
  assert.equal(cliGeneratedImage.job.provider, core.MOCK_IMAGE_PACK_ADAPTER);
  assert.equal(cliGeneratedImage.job.dummy, true);
  assert.equal(cliGeneratedImage.asset.source, "mock");
  assert.equal(cliGeneratedImage.asset.provenance.adapter, core.MOCK_IMAGE_PACK_ADAPTER);
  assert.equal(cliGeneratedImage.dummy, true);
  assert.equal(cliGeneratedImage.raw.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);

  const cliGenerateBackground = runCli("generate-image", {
    projectDirectory: cliProjectDirectory,
    kind: "background",
    targetId: cliProject.project.id,
    prompt: "shared CLI background",
    outputAssetId: "asset-cli-direct-background"
  }, cliEnv);
  assert.equal(cliGenerateBackground.ok, true);
  assert.equal(cliGenerateBackground.asset.kind, "background");
  assert.equal(cliGenerateBackground.job.kind, "background");
  assert.equal(
    cliGenerateBackground.project.scenes.some((scene) => scene.backgroundAssetId === "asset-cli-direct-background"),
    true
  );

  const cliBackgroundJob = runCli("create-image-job", {
    projectDirectory: cliProjectDirectory,
    id: "job-cli-background",
    kind: "background",
    targetId: cliProject.project.id,
    prompt: "alpha sandbox cli background",
    outputAssetId: "asset-cli-background"
  }, cliEnv);
  assert.equal(cliBackgroundJob.job.kind, "background");
  assert.equal(cliBackgroundJob.backgroundPolicy.limit, 1);
  assert.equal(cliBackgroundJob.backgroundPolicy.replacesExisting, true);
  const cliBackgroundRun = runCli("run-generation-jobs", {
    projectDirectory: cliProjectDirectory,
    jobIds: ["job-cli-background"],
    replaceCompleted: true
  }, cliEnv);
  assert.equal(cliBackgroundRun.ok, true);
  assert.equal(cliBackgroundRun.assets[0].kind, "background");
  assert.equal(cliBackgroundRun.backgroundPolicy.limit, 1);
  assert.equal(cliBackgroundRun.project.assets.filter((asset) => asset.kind === "background").length, 1);
  assert.equal(
    cliBackgroundRun.project.scenes.some((scene) => scene.backgroundAssetId === "asset-cli-background"),
    true
  );

  const cliPreview = runCli("preview", {
    projectDirectory: cliProjectDirectory,
    startSceneId: cliAfterSceneId
  }, cliEnv);
  assert.equal(cliPreview.ok, true);
  assert.equal(cliPreview.runtime.scenes.some((scene) => scene.cgAsset?.id === cliPlannedCgJob.outputAssetId), true);
  assert.equal(cliPreview.runtime.scenes.some((scene) => scene.cgAsset?.source === "mock"), true);
  assert.equal(cliPreview.previewReadiness.state, "prepared");
  assert.equal(cliPreview.previewReadiness.canRun, true);
  assert.equal(cliPreview.previewReadiness.requiredData.background, "ready");

  const cliExport = runCli("export-web", {
    projectDirectory: cliProjectDirectory
  }, cliEnv);
  assert.equal(cliExport.ok, true);
  assert.equal(cliExport.smoke.ok, true);
  assert.equal(cliExport.exportPlan.state, "complete");
  assert.equal(cliExport.exportPlan.target, "localDesktopWebApp");
  assert.equal(cliExport.exportPlan.githubPagesTarget, false);
  assert.equal(cliExport.exportPlan.includedData.includes("runtime"), true);
  assert.equal(cliExport.exportPlan.includedAssets.some((asset) => asset.source === "mock" && asset.provenance?.packVersion === alphaSandbox.ALPHA_SANDBOX_PACK_VERSION), true);

  const cliSmoke = runCli("smoke-export", {
    outputPath: cliExport.export.outputDirectory
  }, cliEnv);
  assert.equal(cliSmoke.ok, true);
  assert.equal(cliSmoke.smoke.ok, true);
} finally {
  if (previousSandboxEnv === undefined) {
    delete process.env.VN_MAKER_ALPHA_SANDBOX;
  } else {
    process.env.VN_MAKER_ALPHA_SANDBOX = previousSandboxEnv;
  }
  await rm(tempRoot, { recursive: true, force: true });
}
