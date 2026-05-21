import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const alphaSandbox = await import("../packages/alpha-sandbox/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");
const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-alpha-sandbox-"));
const previousSandboxEnv = process.env.VN_MAKER_ALPHA_SANDBOX;

function runCli(command, input, env = {}) {
  return JSON.parse(execFileSync(process.execPath, ["packages/cli/dist/index.js", command], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  }));
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

  const apiGeneratedImage = await sandboxApi({
    method: "POST",
    path: "/api/generation/images",
    body: {
      projectDirectory: apiProjectDirectory,
      jobId: apiPlannedCgJob.id
    }
  });
  assert.equal(apiGeneratedImage.status, 200);
  assert.equal(apiGeneratedImage.body.job.provider, "mock-adapter");
  assert.equal(apiGeneratedImage.body.raw.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);
  assert.equal(apiGeneratedImage.body.asset.source, "generated");
  assert.equal(existsSync(join(apiProjectDirectory, "assets", "generated", `${apiPlannedCgJob.outputAssetId}.png`)), true);

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

  const apiExport = await sandboxApi({
    method: "POST",
    path: "/api/project/export",
    body: { projectDirectory: apiProjectDirectory }
  });
  assert.equal(apiExport.status, 200);
  assert.equal(apiExport.body.smoke.ok, true);
  assert.equal(existsSync(join(apiExport.body.export.outputDirectory, "index.html")), true);
  const apiProjectData = JSON.parse(readFileSync(join(apiExport.body.export.outputDirectory, "project-data.json"), "utf8"));
  assert.equal(apiProjectData.assets.some((asset) => String(asset.label).includes(alphaSandbox.ALPHA_SANDBOX_PROVENANCE)), true);

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

  const cliGeneratedImage = runCli("generate-image", {
    projectDirectory: cliProjectDirectory,
    jobId: cliPlannedCgJob.id
  }, cliEnv);
  assert.equal(cliGeneratedImage.ok, true);
  assert.equal(cliGeneratedImage.job.provider, "mock-adapter");
  assert.equal(cliGeneratedImage.raw.provenance, alphaSandbox.ALPHA_SANDBOX_PROVENANCE);

  const cliPreview = runCli("preview", {
    projectDirectory: cliProjectDirectory,
    startSceneId: cliAfterSceneId
  }, cliEnv);
  assert.equal(cliPreview.ok, true);
  assert.equal(cliPreview.runtime.scenes.some((scene) => scene.cgAsset?.id === cliPlannedCgJob.outputAssetId), true);

  const cliExport = runCli("export-web", {
    projectDirectory: cliProjectDirectory
  }, cliEnv);
  assert.equal(cliExport.ok, true);
  assert.equal(cliExport.smoke.ok, true);

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
