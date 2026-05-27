#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPackagedMockImageAdapter,
  sharedCodexAppServerClient
} from "@vn-maker/generation-codex";
import {
  ALPHA_SANDBOX_PROVENANCE,
  createAlphaSandboxEventTextAdapter,
  createAlphaSandboxImageAdapter,
  createAlphaSandboxSession
} from "@vn-maker/alpha-sandbox";
import {
  buildProjectHtml,
  createAssetManifest,
  createImageGenerationJob,
  createStarterProject,
  parseVnMakerProject,
  validateProject,
  type VnMakerCharacter,
  type VnMakerProject,
  type VnMakerScene
} from "@vn-maker/engine-core";
import { createProjectJsonParseFailureError, createVnMakerUseCases, projectActionFailureFromError, type MakerActionId } from "@vn-maker/use-cases";

interface CliInput {
  projectDirectory?: string;
  sourceProjectDirectory?: string;
  project?: VnMakerProject;
  outputPath?: string;
  character?: VnMakerCharacter;
  scene?: VnMakerScene;
  sourceSceneId?: string;
  targetSceneId?: string;
  sceneId?: string;
  link?: unknown;
  ending?: unknown;
  clearOutgoing?: boolean;
  heroine?: unknown;
  heroineId?: string;
  sourceHeroineId?: string;
  expectedHeroineRevision?: unknown;
  expectedProjectRevision?: unknown;
  confirmName?: string;
  confirmId?: string;
  draft?: unknown;
  requestId?: string;
  newId?: string;
  tags?: string[] | string;
  request?: unknown;
  plan?: unknown;
  patchHistoryId?: string;
  userEvent?: string;
  routeId?: string;
  afterSceneId?: string;
  startSceneId?: string;
  jobIds?: string[];
  retryFailed?: boolean;
  replaceCompleted?: boolean;
  job?: unknown;
  image?: unknown;
  recentProject?: unknown;
  projectId?: string;
  confirmTitle?: string;
  deleteFiles?: boolean;
  login?: {
    flow?: "browser" | "device";
  };
  starter?: {
    id?: string;
    title?: string;
    premise?: string;
  };
}

function readStdin(): string {
  return readFileSync(0, "utf8").trim();
}

function parseInput(): CliInput {
  const raw = readStdin();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as CliInput;
  } catch {
    throw createProjectJsonParseFailureError();
  }
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function getProject(input: CliInput): VnMakerProject {
  if (input.project === undefined) {
    return createStarterProject(input.starter);
  }
  const parsed = parseVnMakerProject(input.project);
  if (!parsed.ok) {
    throw new Error(`project 입력이 올바르지 않습니다: ${parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join(", ")}`);
  }
  return parsed.value;
}

function isAlphaSandboxEnabled(): boolean {
  return process.env.VN_MAKER_ALPHA_SANDBOX === "1";
}

const sandboxEnabled = isAlphaSandboxEnabled();
const sandboxEventText = sandboxEnabled ? createAlphaSandboxEventTextAdapter() : undefined;
const sandboxImage = sandboxEnabled ? createAlphaSandboxImageAdapter() : undefined;

const useCases = createVnMakerUseCases({
  eventText: sandboxEventText || {
    generateEventExpansionPlan: (input) => sharedCodexAppServerClient.generateEventExpansionPlan(input)
  },
  image: sandboxImage || {
    generateImageAsset: (input) => sharedCodexAppServerClient.generateImageAsset(input)
  },
  imageFallback: createPackagedMockImageAdapter()
});

function printCapabilities(): void {
  writeJson({
    ok: true,
    commands: [
      "inspect",
      "create-starter",
      "create-project",
      "create-project-from-heroine",
      "assign-heroine-snapshot",
      "open-project",
      "reconnect-project",
      "list-projects",
      "remove-project",
      "restore-project",
      "delete-project",
      "list-heroines",
      "get-heroine",
      "create-heroine",
      "update-heroine",
      "save-heroine",
      "clone-heroine",
      "delete-heroine",
      "generate-heroine-portrait",
      "save-character",
      "save-scene",
      "insert-scene",
      "link-scene",
      "set-scene-ending",
      "validate-store",
      "validate",
      "manifest",
      "build-html",
      "expand-event",
      "approve-event",
      "preview-preflight",
      "preview",
      "export-web",
      "smoke-export",
      "create-image-job",
      "plan-default-emotion-assets",
      "plan-expression-assets",
      "list-generation-jobs",
      "run-generation-jobs",
      "list-patch-history",
      "undo-patch",
      "codex-auth-status",
      "codex-login",
      "codex-logout",
      "generate-image"
    ],
    io: "stdin-json/stdout-json",
    purpose: "Codex/AI가 VN Maker Core를 안정적으로 호출하기 위한 기계용 인터페이스",
    sandbox: sandboxEnabled ? { enabled: true, provenance: ALPHA_SANDBOX_PROVENANCE } : { enabled: false }
  });
}

function actionForCommand(command: string): MakerActionId | undefined {
  const actions: Partial<Record<string, MakerActionId>> = {
    "create-project": "createProject",
    "create-project-from-heroine": "createProjectFromHeroine",
    "assign-heroine-snapshot": "assignHeroineSnapshot",
    "open-project": "openProject",
    "reconnect-project": "reconnectRecentProject",
    "list-projects": "listProjects",
    "remove-project": "removeProject",
    "restore-project": "restoreProject",
    "list-recent-projects": "listRecentProjects",
    "remove-recent-project": "removeRecentProject",
    "restore-recent-project": "restoreRecentProject",
    "delete-project": "deleteProjectWorkspace",
    "expand-event": "expandEvent",
    "approve-event": "approveEvent",
    "preview-preflight": "previewPreflightProject",
    "preview": "previewProject",
    "export-web": "exportProject",
    "list-generation-jobs": "listGenerationJobs",
    "run-generation-jobs": "runGenerationJobs"
  };
  return actions[command];
}

async function run(): Promise<void> {
  const command = process.argv[2] || "inspect";

  if (command === "inspect") {
    printCapabilities();
    return;
  }

  const input = parseInput();

  if (command === "create-starter") {
    writeJson({ ok: true, project: createStarterProject(input.starter) });
    return;
  }

  if (command === "create-project") {
    writeJson(await useCases.createProject(input));
    return;
  }

  if (command === "create-project-from-heroine") {
    writeJson(await useCases.createProjectFromHeroine(input));
    return;
  }

  if (command === "assign-heroine-snapshot") {
    writeJson(await useCases.assignHeroineSnapshot(input));
    return;
  }

  if (command === "open-project") {
    writeJson(await useCases.openProject(input));
    return;
  }

  if (command === "reconnect-project") {
    writeJson(await useCases.reconnectRecentProject(input));
    return;
  }

  if (command === "list-projects") {
    writeJson(await useCases.listProjects());
    return;
  }

  if (command === "remove-project") {
    writeJson(await useCases.removeProject(input));
    return;
  }

  if (command === "restore-project") {
    writeJson(await useCases.restoreProject(input));
    return;
  }

  if (command === "list-recent-projects") {
    writeJson(await useCases.listRecentProjects());
    return;
  }

  if (command === "remove-recent-project") {
    writeJson(await useCases.removeRecentProject(input));
    return;
  }

  if (command === "restore-recent-project") {
    writeJson(await useCases.restoreRecentProject(input));
    return;
  }

  if (command === "delete-project") {
    writeJson(await useCases.deleteProjectWorkspace(input));
    return;
  }

  if (command === "list-heroines") {
    writeJson(await useCases.listHeroines(input));
    return;
  }

  if (command === "get-heroine") {
    writeJson(await useCases.getHeroine(input));
    return;
  }

  if (command === "create-heroine") {
    writeJson(await useCases.createHeroine(input));
    return;
  }

  if (command === "update-heroine") {
    writeJson(await useCases.updateHeroine(input));
    return;
  }

  if (command === "save-heroine") {
    writeJson(await useCases.saveHeroine(input));
    return;
  }

  if (command === "clone-heroine") {
    writeJson(await useCases.cloneHeroine(input));
    return;
  }

  if (command === "delete-heroine") {
    writeJson(await useCases.deleteHeroine(input));
    return;
  }

  if (command === "generate-heroine-portrait") {
    writeJson(await useCases.generateHeroinePortrait(input));
    return;
  }

  if (command === "save-character") {
    writeJson(await useCases.saveCharacter(input));
    return;
  }

  if (command === "save-scene") {
    writeJson(await useCases.saveScene(input));
    return;
  }

  if (command === "insert-scene") {
    writeJson(await useCases.insertManualScene(input));
    return;
  }

  if (command === "link-scene") {
    writeJson(await useCases.linkManualScene(input));
    return;
  }

  if (command === "set-scene-ending") {
    writeJson(await useCases.setSceneEnding(input));
    return;
  }

  if (command === "validate-store") {
    writeJson(await useCases.validateProject(input));
    return;
  }

  if (command === "validate") {
    if (input.projectDirectory) {
      writeJson(await useCases.validateProject(input));
      return;
    }
    const issues = validateProject(getProject(input));
    writeJson({ ok: issues.every((issue) => issue.severity !== "error"), issues });
    return;
  }

  if (command === "manifest") {
    if (input.projectDirectory) {
      writeJson(await useCases.createManifest(input));
      return;
    }
    writeJson({ ok: true, manifest: createAssetManifest(getProject(input)) });
    return;
  }

  if (command === "build-html") {
    const result = input.projectDirectory
      ? await useCases.buildProject(input)
      : { ok: true, artifact: buildProjectHtml(getProject(input)) };
    if (input.outputPath) {
      const artifact = (result as { artifact?: { html?: string } }).artifact;
      if (artifact?.html) {
        writeFileSync(input.outputPath, artifact.html, "utf8");
      }
    }
    writeJson(result);
    return;
  }

  if (command === "expand-event") {
    writeJson(await useCases.expandEvent(input));
    return;
  }

  if (command === "approve-event") {
    writeJson(await useCases.approveEvent(input));
    return;
  }

  if (command === "preview-preflight") {
    writeJson(await useCases.previewPreflightProject(input));
    return;
  }

  if (command === "preview") {
    writeJson(await useCases.previewProject(input));
    return;
  }

  if (command === "export-web") {
    writeJson(await useCases.exportProject({ ...input, outputDirectory: input.outputPath }));
    return;
  }

  if (command === "smoke-export") {
    writeJson(await useCases.smokeExport(input));
    return;
  }

  if (command === "create-image-job") {
    if (!input.projectDirectory) {
      if (!input.job || typeof input.job !== "object") {
        throw new Error("job 입력이 필요합니다.");
      }
      writeJson({ ok: true, job: createImageGenerationJob(input.job as Parameters<typeof createImageGenerationJob>[0]) });
      return;
    }
    writeJson(await useCases.createGenerationJob({ ...input, ...(input.job && typeof input.job === "object" ? input.job : {}) }));
    return;
  }

  if (command === "plan-default-emotion-assets") {
    writeJson(await useCases.planDefaultEmotionAssets(input));
    return;
  }

  if (command === "plan-expression-assets") {
    writeJson(await useCases.planExpressionAssets(input));
    return;
  }

  if (command === "list-generation-jobs") {
    writeJson(await useCases.listGenerationJobs(input));
    return;
  }

  if (command === "run-generation-jobs") {
    writeJson(await useCases.runGenerationJobs(input));
    return;
  }

  if (command === "list-patch-history") {
    writeJson(await useCases.listPatchHistory(input));
    return;
  }

  if (command === "undo-patch") {
    writeJson(await useCases.undoPatch(input));
    return;
  }

  if (command === "codex-auth-status") {
    if (sandboxEnabled) {
      writeJson({ ok: true, session: createAlphaSandboxSession() });
      return;
    }
    writeJson({ ok: true, session: await sharedCodexAppServerClient.readSession(false) });
    return;
  }

  if (command === "codex-login") {
    if (sandboxEnabled) {
      writeJson({
        ok: true,
        login: {
          type: "alphaSandbox",
          loginId: ALPHA_SANDBOX_PROVENANCE
        },
        session: createAlphaSandboxSession(),
        note: "Alpha Sandbox fixture generation이 활성화되어 있다. Codex OAuth 로그인으로 표현하지 않는다."
      });
      return;
    }
    writeJson({ ok: true, login: await sharedCodexAppServerClient.startLogin(input.login?.flow || "browser") });
    return;
  }

  if (command === "codex-logout") {
    if (sandboxEnabled) {
      writeJson({ ok: true, session: createAlphaSandboxSession() });
      return;
    }
    await sharedCodexAppServerClient.logout();
    writeJson({ ok: true });
    return;
  }

  if (command === "generate-image") {
    writeJson(await useCases.generateImage({
      ...input,
      ...(input.image && typeof input.image === "object" ? input.image : {})
    }));
    return;
  }

  throw new Error(`알 수 없는 명령입니다: ${command}`);
}

run().catch((error: unknown) => {
  writeJson(projectActionFailureFromError(error, actionForCommand(process.argv[2] || "inspect")));
  process.exitCode = 1;
}).finally(() => {
  sharedCodexAppServerClient.close();
});
