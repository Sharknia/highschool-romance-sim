#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  expandNaturalLanguageEvent,
  sharedCodexAppServerClient,
  type CodexImageGenerationInput
} from "@vn-maker/generation-codex";
import {
  buildProjectHtml,
  createAssetManifest,
  createEventExpansionRequest,
  createHeroineProfile,
  createImageGenerationJob,
  createProjectFromHeroine,
  createStarterProject,
  validateProject,
  type EventExpansionPlan,
  type EventExpansionRequest,
  type CreateImageGenerationJobInput,
  type CreateHeroineProfileInput,
  type VnMakerCharacter,
  type VnMakerProject,
  type VnMakerScene
} from "@vn-maker/engine-core";
import {
  createProjectWorkspace,
  openProjectStore,
  smokeTestWebExport,
  type ProjectStore
} from "@vn-maker/project-store";

interface CliInput {
  projectDirectory?: string;
  project?: VnMakerProject;
  outputPath?: string;
  character?: VnMakerCharacter;
  scene?: VnMakerScene;
  heroine?: CreateHeroineProfileInput;
  heroineId?: string;
  request?: EventExpansionRequest;
  plan?: EventExpansionPlan;
  userEvent?: string;
  routeId?: string;
  afterSceneId?: string;
  startSceneId?: string;
  job?: CreateImageGenerationJobInput;
  image?: CodexImageGenerationInput;
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
  return raw ? JSON.parse(raw) as CliInput : {};
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isVnMakerProject(value: unknown): value is VnMakerProject {
  const record = asRecord(value);
  return record.version === "vn-maker/v1"
    && typeof record.id === "string"
    && typeof record.title === "string"
    && Array.isArray(record.characters)
    && Array.isArray(record.routes)
    && Array.isArray(record.scenes)
    && Array.isArray(record.assets)
    && Array.isArray(record.generationJobs)
    && Boolean(record.settings);
}

function getProject(input: CliInput): VnMakerProject {
  return isVnMakerProject(input.project) ? input.project : createStarterProject(input.starter);
}

function requireProjectDirectory(input: CliInput): string {
  if (!input.projectDirectory) {
    throw new Error("projectDirectory 입력이 필요합니다.");
  }
  return input.projectDirectory;
}

async function withProjectStore<T>(input: CliInput, operation: (store: ProjectStore) => Promise<T> | T): Promise<T> {
  const store = await openProjectStore(requireProjectDirectory(input));
  try {
    return await operation(store);
  } finally {
    store.close();
  }
}

async function ensureProjectStore(input: CliInput): Promise<ProjectStore> {
  const store = await openProjectStore(requireProjectDirectory(input));
  if (isVnMakerProject(input.project)) {
    store.saveProject(input.project);
    return store;
  }
  if (!store.getProject()) {
    store.saveProject(createStarterProject(input.starter));
  }
  return store;
}

function printCapabilities(): void {
  writeJson({
    ok: true,
    commands: [
      "inspect",
      "create-starter",
      "create-project",
      "create-project-from-heroine",
      "open-project",
      "list-heroines",
      "save-heroine",
      "delete-heroine",
      "save-character",
      "save-scene",
      "validate-store",
      "validate",
      "manifest",
      "build-html",
      "expand-event",
      "approve-event",
      "preview",
      "export-web",
      "smoke-export",
      "create-image-job",
      "codex-auth-status",
      "codex-login",
      "codex-logout",
      "generate-image"
    ],
    io: "stdin-json/stdout-json",
    purpose: "Codex/AI가 VN Maker Core를 안정적으로 호출하기 위한 기계용 인터페이스"
  });
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
    const store = await createProjectWorkspace({
      projectDirectory: requireProjectDirectory(input),
      starter: input.starter,
      project: isVnMakerProject(input.project) ? input.project : undefined
    });
    try {
      writeJson({
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        paths: store.paths,
        project: store.requireProject(),
        validation: store.validateAndStore()
      });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "create-project-from-heroine") {
    if (!input.heroine) {
      throw new Error("heroine 입력이 필요합니다.");
    }
    const heroine = createHeroineProfile(input.heroine);
    const store = await createProjectWorkspace({
      projectDirectory: requireProjectDirectory(input),
      project: createProjectFromHeroine({
        id: input.starter?.id,
        title: input.starter?.title,
        premise: input.starter?.premise,
        heroine
      })
    });
    try {
      store.saveHeroine(heroine);
      writeJson({
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        paths: store.paths,
        heroine,
        project: store.requireProject(),
        validation: store.validateAndStore()
      });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "open-project") {
    await withProjectStore(input, (store) => {
      writeJson({
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        paths: store.paths,
        project: store.requireProject(),
        validation: store.validateAndStore()
      });
    });
    return;
  }

  if (command === "list-heroines") {
    await withProjectStore(input, (store) => {
      writeJson({ ok: true, projectDirectory: store.paths.projectDirectory, heroines: store.listHeroines() });
    });
    return;
  }

  if (command === "save-heroine") {
    if (!input.heroine) {
      throw new Error("heroine 입력이 필요합니다.");
    }
    const store = await ensureProjectStore(input);
    try {
      const heroine = store.saveHeroine(createHeroineProfile(input.heroine));
      writeJson({ ok: true, projectDirectory: store.paths.projectDirectory, heroine, heroines: store.listHeroines() });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "delete-heroine") {
    if (!input.heroineId) {
      throw new Error("heroineId 입력이 필요합니다.");
    }
    await withProjectStore(input, (store) => {
      store.deleteHeroine(input.heroineId!);
      writeJson({
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        heroines: store.listHeroines(),
        project: store.requireProject()
      });
    });
    return;
  }

  if (command === "save-character") {
    if (!input.character) {
      throw new Error("character 입력이 필요합니다.");
    }
    const store = await ensureProjectStore(input);
    try {
      const project = store.upsertCharacter(input.character);
      writeJson({
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        project,
        validation: store.validateAndStore()
      });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "save-scene") {
    if (!input.scene) {
      throw new Error("scene 입력이 필요합니다.");
    }
    const store = await ensureProjectStore(input);
    try {
      const project = store.upsertScene(input.scene);
      writeJson({
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        project,
        validation: store.validateAndStore()
      });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "validate-store") {
    await withProjectStore(input, (store) => {
      const validation = store.validateAndStore();
      writeJson({
        ok: validation.ok,
        projectDirectory: store.paths.projectDirectory,
        issues: validation.issues,
        project: store.requireProject()
      });
    });
    return;
  }

  if (command === "validate") {
    if (input.projectDirectory) {
      await withProjectStore(input, (store) => {
        const validation = store.validateAndStore();
        writeJson({ ok: validation.ok, issues: validation.issues, project: store.requireProject() });
      });
      return;
    }
    const issues = validateProject(getProject(input));
    writeJson({ ok: issues.every((issue) => issue.severity !== "error"), issues });
    return;
  }

  if (command === "manifest") {
    if (input.projectDirectory) {
      await withProjectStore(input, (store) => {
        writeJson({ ok: true, manifest: createAssetManifest(store.requireProject()) });
      });
      return;
    }
    writeJson({ ok: true, manifest: createAssetManifest(getProject(input)) });
    return;
  }

  if (command === "build-html") {
    const project = input.projectDirectory
      ? await withProjectStore(input, (store) => store.requireProject())
      : getProject(input);
    const artifact = buildProjectHtml(project);
    if (input.outputPath) {
      writeFileSync(input.outputPath, artifact.html, "utf8");
    }
    writeJson({ ok: true, artifact });
    return;
  }

  if (command === "expand-event") {
    const store = await ensureProjectStore(input);
    try {
      const project = store.requireProject();
      const route = project.routes.find((item) => item.id === input.routeId) || project.routes[0];
      if (!route) {
        throw new Error("이벤트를 추가할 루트가 없습니다.");
      }
      const request = input.request || createEventExpansionRequest(project, {
        projectDirectory: store.paths.projectDirectory,
        routeId: route.id,
        afterSceneId: input.afterSceneId || route.entrySceneId,
        heroineId: input.heroineId || route.heroineId,
        userEvent: input.userEvent || ""
      });
      const result = await expandNaturalLanguageEvent({ project, request });
      writeJson({ projectDirectory: store.paths.projectDirectory, request, ...result });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "approve-event") {
    if (!input.request || !input.plan) {
      throw new Error("request와 plan 입력이 필요합니다.");
    }
    const store = await ensureProjectStore(input);
    try {
      const result = store.applyEventExpansionPlan(input.request, input.plan);
      writeJson({ ok: true, projectDirectory: store.paths.projectDirectory, ...result });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "preview") {
    await withProjectStore(input, (store) => {
      writeJson({ ok: true, projectDirectory: store.paths.projectDirectory, runtime: store.previewProject(input.startSceneId) });
    });
    return;
  }

  if (command === "export-web") {
    const store = await ensureProjectStore(input);
    try {
      writeJson({ ok: true, projectDirectory: store.paths.projectDirectory, ...(await store.exportWebPlayer(input.outputPath)) });
    } finally {
      store.close();
    }
    return;
  }

  if (command === "smoke-export") {
    if (!input.outputPath) {
      throw new Error("outputPath 입력이 필요합니다.");
    }
    writeJson({ ok: true, smoke: await smokeTestWebExport(input.outputPath) });
    return;
  }

  if (command === "create-image-job") {
    if (!input.job) {
      throw new Error("job 입력이 필요합니다.");
    }
    const job = createImageGenerationJob(input.job);
    if (input.projectDirectory) {
      const store = await ensureProjectStore(input);
      try {
        const project = store.requireProject();
        const index = project.generationJobs.findIndex((item) => item.id === job.id);
        if (index >= 0) {
          project.generationJobs[index] = job;
        } else {
          project.generationJobs.push(job);
        }
        writeJson({ ok: true, job, project: store.saveProject(project) });
      } finally {
        store.close();
      }
      return;
    }
    writeJson({ ok: true, job });
    return;
  }

  if (command === "codex-auth-status") {
    writeJson({ ok: true, session: await sharedCodexAppServerClient.readSession(false) });
    return;
  }

  if (command === "codex-login") {
    writeJson({ ok: true, login: await sharedCodexAppServerClient.startLogin(input.login?.flow || "browser") });
    return;
  }

  if (command === "codex-logout") {
    await sharedCodexAppServerClient.logout();
    writeJson({ ok: true });
    return;
  }

  if (command === "generate-image") {
    if (!input.image) {
      throw new Error("image 입력이 필요합니다.");
    }

    if (input.projectDirectory) {
      const store = await ensureProjectStore(input);
      try {
        const result = await sharedCodexAppServerClient.generateImageAsset({
          ...input.image,
          outputDirectory: input.image.outputDirectory || store.paths.generatedAssetsDirectory,
          publicPathPrefix: input.image.publicPathPrefix || "/generated-assets",
          cwd: input.image.cwd || store.paths.projectDirectory
        });
        const project = await store.storeGenerationResult(result);
        writeJson({ ok: true, result, project });
      } finally {
        store.close();
      }
      return;
    }

    const result = await sharedCodexAppServerClient.generateImageAsset(input.image);
    writeJson({ ok: true, result });
    return;
  }

  throw new Error(`알 수 없는 명령입니다: ${command}`);
}

run().catch((error: unknown) => {
  writeJson({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}).finally(() => {
  sharedCodexAppServerClient.close();
});
