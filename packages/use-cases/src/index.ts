import { join } from "node:path";
import {
  DEFAULT_EMOTION_TAGS,
  buildProjectHtml,
  createAssetManifest,
  createDeterministicEventExpansionPlan,
  createEventExpansionRequest,
  createHeroineProfile,
  createImageGenerationJob,
  planExpressionAssetsForHeroine,
  createProjectFromHeroine,
  createStarterProject,
  parseCreateImageGenerationJobInput,
  parseEventExpansionPlan,
  parseEventExpansionRequest,
  parseHeroineProfileInput,
  parseVnMakerCharacter,
  parseVnMakerProject,
  parseVnMakerScene,
  validateEventExpansionPlan,
  validateProject as validateProjectSnapshot,
  type CreateImageGenerationJobInput,
  type CreateStarterProjectInput,
  type DtoParseResult,
  type EventExpansionPlan,
  type EventExpansionRequest,
  type EventExpansionValidationResult,
  type HeroineProfile,
  type ValidationIssue,
  type VnMakerAsset,
  type VnMakerCharacter,
  type VnMakerGenerationJob,
  type VnMakerProject,
  type VnMakerScene
} from "@vn-maker/engine-core";
import {
  createProjectWorkspace,
  openProjectStore,
  smokeTestWebExport,
  type ProjectStore
} from "@vn-maker/project-store";

type JsonRecord = Record<string, unknown>;

export interface EventTextGenerationAttempt {
  attempt: number;
  ok: boolean;
  failureKind?: "schema_invalid" | "engine_validation_failed" | "quality_rule_failed";
  issues: string[];
}

export interface EventTextGenerationAdapter {
  generateEventExpansionPlan(input: {
    project: VnMakerProject;
    request: EventExpansionRequest;
    attempt: number;
    previousAttempts: EventTextGenerationAttempt[];
  }): Promise<EventExpansionPlan | unknown>;
}

export interface ProjectImageGenerationInput {
  kind: Extract<VnMakerAsset["kind"], "portrait" | "expression" | "cg">;
  targetId: string;
  prompt: string;
  style?: string;
  jobId?: string;
  outputAssetId?: string;
  outputDirectory: string;
  publicPathPrefix: string;
  cwd: string;
}

export interface ProjectImageGenerationResult {
  adapter?: string;
  job: VnMakerGenerationJob;
  asset: VnMakerAsset;
  image?: {
    mimeType?: string;
    b64Json?: string;
    dataUrl?: string;
    fileName?: string;
    filePath?: string;
    uri?: string;
    codexSavedPath?: string | null;
    revisedPrompt?: string | null;
  };
  raw?: unknown;
}

export interface ProjectImageGenerationAdapter {
  generateImageAsset(input: ProjectImageGenerationInput): Promise<ProjectImageGenerationResult>;
}

export interface VnMakerUseCaseOptions {
  defaultProjectDirectory?: string;
  eventText?: EventTextGenerationAdapter;
  image?: ProjectImageGenerationAdapter;
}

export interface ExpandNaturalLanguageEventInput {
  project: VnMakerProject;
  request: EventExpansionRequest;
  adapter?: EventTextGenerationAdapter;
  maxAttempts?: number;
}

export type ExpandNaturalLanguageEventResult =
  | { ok: true; plan: EventExpansionPlan; validation: EventExpansionValidationResult; attempts: EventTextGenerationAttempt[]; rawOutput: unknown }
  | { ok: false; attempts: EventTextGenerationAttempt[]; error: string; rawOutput?: unknown };

export class InputValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "InputValidationError";
    this.issues = issues;
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function getDefaultProjectDirectory(): string {
  return process.env.VN_MAKER_PROJECT_DIR || join(process.cwd(), "workspace", "Default.vnmaker");
}

function projectDirectoryFrom(input: unknown, fallback: string): string {
  const record = asRecord(input);
  return typeof record.projectDirectory === "string" && record.projectDirectory.trim()
    ? record.projectDirectory
    : fallback;
}

function requireParsed<T>(result: DtoParseResult<T>, label: string): T {
  if (result.ok) {
    return result.value;
  }
  throw new InputValidationError(`${label} 입력이 올바르지 않습니다.`, result.issues);
}

function optionalProject(input: unknown): VnMakerProject | undefined {
  const record = asRecord(input);
  if (record.project === undefined) {
    return undefined;
  }
  const projectRecord = asRecord(record.project);
  if (projectRecord.starter !== undefined && projectRecord.version === undefined) {
    return undefined;
  }
  return requireParsed(parseVnMakerProject(record.project), "project");
}

function optionalStarter(input: unknown): CreateStarterProjectInput | undefined {
  const record = asRecord(input);
  const starter = record.starter ?? asRecord(record.project).starter;
  return starter && typeof starter === "object" ? starter as CreateStarterProjectInput : undefined;
}

function requiredHeroine(input: unknown): HeroineProfile {
  const record = asRecord(input);
  return createHeroineProfile(requireParsed(parseHeroineProfileInput(record.heroine), "heroine"));
}

function requiredCharacter(input: unknown): VnMakerCharacter {
  return requireParsed(parseVnMakerCharacter(asRecord(input).character), "character");
}

function requiredScene(input: unknown): VnMakerScene {
  return requireParsed(parseVnMakerScene(asRecord(input).scene), "scene");
}

function requiredEventRequest(input: unknown): EventExpansionRequest {
  return requireParsed(parseEventExpansionRequest(asRecord(input).request), "request");
}

function requiredEventPlan(input: unknown): EventExpansionPlan {
  return requireParsed(parseEventExpansionPlan(asRecord(input).plan), "plan");
}

function generationJobInput(input: unknown): CreateImageGenerationJobInput {
  const record = asRecord(input);
  const kind = String(record.kind || "cg");
  const targetId = String(record.targetId || "scene-opening");
  const candidate = {
    id: String(record.id || `job-${kind}-${targetId}-${Date.now()}`),
    kind,
    targetId,
    prompt: String(record.prompt || ""),
    style: typeof record.style === "string" ? record.style : "visual novel production asset",
    outputAssetId: typeof record.outputAssetId === "string" ? record.outputAssetId : undefined
  };
  return requireParsed(parseCreateImageGenerationJobInput(candidate), "job");
}

function tagsFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim());
  }
  return [];
}

function cloneHeroineProfile(source: HeroineProfile, input: unknown): HeroineProfile {
  const record = asRecord(input);
  const newId = typeof record.newId === "string" && record.newId.trim()
    ? record.newId
    : `${source.id}-copy`;
  const name = typeof record.name === "string" && record.name.trim()
    ? record.name
    : `${source.name} 복제`;
  return createHeroineProfile({
    id: newId,
    name,
    description: typeof record.description === "string" ? record.description : source.description,
    personality: typeof record.personality === "string" ? record.personality : source.personality,
    speechStyle: typeof record.speechStyle === "string" ? record.speechStyle : source.speechStyle,
    appearance: typeof record.appearance === "string" ? record.appearance : source.appearance,
    defaultPortraitAssetId: typeof record.defaultPortraitAssetId === "string" ? record.defaultPortraitAssetId : `asset-${newId}-portrait`,
    portraitAssetIds: [],
    expressionAssetIds: {},
    tags: tagsFrom(record.tags).length > 0 ? tagsFrom(record.tags) : source.tags,
    reuseHistory: []
  });
}

function filterAndSortHeroines(heroines: HeroineProfile[], input: unknown): HeroineProfile[] {
  const record = asRecord(input);
  const query = typeof record.query === "string" ? record.query.trim().toLowerCase() : "";
  const tag = typeof record.tag === "string" ? record.tag.trim().toLowerCase() : "";
  const sort = typeof record.sort === "string" ? record.sort : "position";
  const filtered = heroines.filter((heroine) => {
    const matchesQuery = !query || [
      heroine.id,
      heroine.name,
      heroine.description,
      heroine.personality,
      heroine.speechStyle,
      heroine.appearance,
      ...heroine.tags
    ].some((value) => value.toLowerCase().includes(query));
    const matchesTag = !tag || heroine.tags.some((value) => value.toLowerCase() === tag);
    return matchesQuery && matchesTag;
  });

  if (sort === "name-asc") {
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  }
  if (sort === "name-desc") {
    return [...filtered].sort((left, right) => right.name.localeCompare(left.name, "ko"));
  }
  if (sort === "reuse-desc") {
    return [...filtered].sort((left, right) => right.reuseHistory.length - left.reuseHistory.length);
  }
  return filtered;
}

async function withStore<T>(projectDirectory: string, operation: (store: ProjectStore) => Promise<T> | T): Promise<T> {
  const store = await openProjectStore(projectDirectory);
  try {
    return await operation(store);
  } finally {
    store.close();
  }
}

async function ensureProjectStore(input: unknown, fallbackDirectory: string): Promise<ProjectStore> {
  const projectDirectory = projectDirectoryFrom(input, fallbackDirectory);
  const store = await openProjectStore(projectDirectory);
  const project = optionalProject(input);
  if (project) {
    store.saveProject(project);
    return store;
  }
  if (!store.getProject()) {
    store.saveProject(createStarterProject(optionalStarter(input)));
  }
  return store;
}

function classifyValidationFailure(validation: EventExpansionValidationResult): EventTextGenerationAttempt["failureKind"] {
  return validation.issues.some((issue) => issue.path.startsWith("decision") || issue.path.includes("newExpressionAssetCount"))
    ? "quality_rule_failed"
    : "engine_validation_failed";
}

export async function expandNaturalLanguageEvent(
  input: ExpandNaturalLanguageEventInput
): Promise<ExpandNaturalLanguageEventResult> {
  const maxAttempts = input.maxAttempts ?? 3;
  const attempts: EventTextGenerationAttempt[] = [];
  let rawOutput: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = input.adapter
      ? await input.adapter.generateEventExpansionPlan({
          project: input.project,
          request: input.request,
          attempt,
          previousAttempts: attempts
        })
      : createDeterministicEventExpansionPlan(input.request);
    rawOutput = candidate;
    const parsed = parseEventExpansionPlan(candidate);

    if (!parsed.ok) {
      attempts.push({
        attempt,
        ok: false,
        failureKind: "schema_invalid",
        issues: parsed.issues.map((issue) => `${issue.path}: ${issue.message}`)
      });
      continue;
    }

    const validation = validateEventExpansionPlan(input.project, input.request, parsed.value);
    if (!validation.ok) {
      attempts.push({
        attempt,
        ok: false,
        failureKind: classifyValidationFailure(validation),
        issues: validation.issues.map((issue) => `${issue.path}: ${issue.message}`)
      });
      continue;
    }

    attempts.push({ attempt, ok: true, issues: [] });
    return {
      ok: true,
      plan: parsed.value,
      validation,
      attempts,
      rawOutput
    };
  }

  return {
    ok: false,
    attempts,
    error: attempts.at(-1)?.issues.join(", ") || "자연어 이벤트 생성에 실패했습니다.",
    rawOutput
  };
}

function selectGenerationInput(project: VnMakerProject, store: ProjectStore, input: unknown): ProjectImageGenerationInput {
  const record = asRecord(input);
  const jobId = typeof record.jobId === "string" ? record.jobId : undefined;
  const requestedKind = typeof record.kind === "string" ? record.kind : undefined;
  const plannedJob = jobId
    ? project.generationJobs.find((job) => job.id === jobId)
    : requestedKind === "cg"
      ? project.generationJobs.find((job) => job.kind === "cg" && job.status === "planned")
      : undefined;
  const heroine = record.heroine && typeof record.heroine === "object"
    ? createHeroineProfile(requireParsed(parseHeroineProfileInput(record.heroine), "heroine"))
    : undefined;
  const kind = (plannedJob?.kind || record.kind || "cg") as ProjectImageGenerationInput["kind"];
  const targetId = plannedJob?.targetId
    || (typeof record.targetId === "string" && record.targetId)
    || heroine?.id
    || project.scenes[0]?.id
    || "scene-opening";
  const outputAssetId = plannedJob?.outputAssetId
    || (typeof record.outputAssetId === "string" ? record.outputAssetId : undefined)
    || (heroine && kind === "portrait" ? heroine.defaultPortraitAssetId || `asset-${heroine.id}-portrait` : undefined);
  const prompt = plannedJob?.prompt
    || (typeof record.prompt === "string" ? record.prompt : undefined)
    || (heroine ? `${heroine.name}, ${heroine.appearance}, clean visual novel heroine portrait` : "");

  if (!["portrait", "expression", "cg"].includes(kind)) {
    throw new InputValidationError("image.kind 입력이 올바르지 않습니다.", [{ severity: "error", path: "kind", message: `지원하지 않는 이미지 종류입니다: ${String(kind)}` }]);
  }
  if (!prompt.trim()) {
    throw new InputValidationError("image.prompt 입력이 필요합니다.", [{ severity: "error", path: "prompt", message: "비어 있을 수 없습니다." }]);
  }

  return {
    kind,
    targetId,
    prompt,
    style: plannedJob?.style || (typeof record.style === "string" ? record.style : heroine ? "soft, polished, romance visual novel portrait" : "soft visual novel, clean anime, production-ready"),
    jobId: plannedJob?.id || (typeof record.jobId === "string" ? record.jobId : undefined),
    outputAssetId,
    outputDirectory: store.paths.generatedAssetsDirectory,
    publicPathPrefix: "/generated-assets",
    cwd: store.paths.projectDirectory
  };
}

function withWorkspacePreviewUri(result: ProjectImageGenerationResult): ProjectImageGenerationResult {
  const previewUri = result.image?.dataUrl || result.image?.uri || result.asset.uri;
  if (!previewUri) {
    return result;
  }
  return {
    ...result,
    asset: {
      ...result.asset,
      uri: previewUri
    },
    image: result.image
      ? {
          ...result.image,
          uri: result.image.uri || previewUri
        }
      : result.image
  };
}

export function createVnMakerUseCases(options: VnMakerUseCaseOptions = {}) {
  const defaultProjectDirectory = options.defaultProjectDirectory || getDefaultProjectDirectory();

  return {
    async createProject(input: unknown) {
      const projectDirectory = projectDirectoryFrom(input, defaultProjectDirectory);
      const store = await createProjectWorkspace({
        projectDirectory,
        starter: optionalStarter(input),
        project: optionalProject(input)
      });
      try {
        const validation = store.validateAndStore();
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          project: store.requireProject(),
          validation
        };
      } finally {
        store.close();
      }
    },

    async createProjectFromHeroine(input: unknown) {
      const record = asRecord(input);
      const projectDirectory = projectDirectoryFrom(input, defaultProjectDirectory);
      const existingStore = await ensureProjectStore(input, defaultProjectDirectory);
      const heroine = record.heroine
        ? requiredHeroine(input)
        : existingStore.listHeroines().find((item) => item.id === record.heroineId);
      existingStore.close();
      if (!heroine) {
        throw new InputValidationError("heroine 입력이 필요합니다.", [{ severity: "error", path: "heroineId", message: "히로인 라이브러리에서 찾을 수 없습니다." }]);
      }
      const store = await createProjectWorkspace({
        projectDirectory,
        project: createProjectFromHeroine({
          id: typeof record.projectId === "string" ? record.projectId : undefined,
          title: typeof record.title === "string" ? record.title : undefined,
          premise: typeof record.premise === "string" ? record.premise : undefined,
          heroine
        })
      });
      try {
        store.saveHeroine(heroine);
        const project = store.requireProject();
        store.recordHeroineReuse(heroine.id, project);
        const validation = store.validateAndStore();
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          heroine,
          project,
          validation
        };
      } finally {
        store.close();
      }
    },

    async openProject(input: unknown) {
      const projectDirectory = projectDirectoryFrom(input, defaultProjectDirectory);
      return withStore(projectDirectory, (store) => {
        const project = store.requireProject();
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          project,
          validation: store.validateAndStore()
        };
      });
    },

    async listHeroines(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return { ok: true, projectDirectory: store.paths.projectDirectory, heroines: filterAndSortHeroines(store.listHeroines(), input) };
      } finally {
        store.close();
      }
    },

    async saveHeroine(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const heroine = store.saveHeroine(requiredHeroine(input));
        return { ok: true, projectDirectory: store.paths.projectDirectory, heroine, heroines: store.listHeroines() };
      } finally {
        store.close();
      }
    },

    async cloneHeroine(input: unknown) {
      const record = asRecord(input);
      const sourceHeroineId = String(record.sourceHeroineId || "");
      if (!sourceHeroineId) {
        throw new InputValidationError("sourceHeroineId 입력이 필요합니다.", [{ severity: "error", path: "sourceHeroineId", message: "비어 있을 수 없습니다." }]);
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const source = store.listHeroines().find((heroine) => heroine.id === sourceHeroineId);
        if (!source) {
          throw new InputValidationError("복제할 히로인을 찾을 수 없습니다.", [{ severity: "error", path: "sourceHeroineId", message: "라이브러리에 존재하지 않습니다." }]);
        }
        const heroine = store.saveHeroine(cloneHeroineProfile(source, input));
        return { ok: true, projectDirectory: store.paths.projectDirectory, heroine, heroines: store.listHeroines() };
      } finally {
        store.close();
      }
    },

    async deleteHeroine(input: unknown) {
      const record = asRecord(input);
      const heroineId = String(record.heroineId || "");
      if (!heroineId) {
        throw new InputValidationError("heroineId 입력이 필요합니다.", [{ severity: "error", path: "heroineId", message: "비어 있을 수 없습니다." }]);
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        store.deleteHeroine(heroineId);
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          heroines: store.listHeroines(),
          project: store.requireProject()
        };
      } finally {
        store.close();
      }
    },

    async saveCharacter(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.upsertCharacter(requiredCharacter(input));
        const validation = store.validateAndStore();
        return { ok: true, projectDirectory: store.paths.projectDirectory, project, validation };
      } finally {
        store.close();
      }
    },

    async saveScene(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.upsertScene(requiredScene(input));
        const validation = store.validateAndStore();
        return { ok: true, projectDirectory: store.paths.projectDirectory, project, validation };
      } finally {
        store.close();
      }
    },

    async validateProject(input: unknown) {
      const projectInput = asRecord(input).project;
      if (projectInput !== undefined) {
        const parsed = parseVnMakerProject(projectInput);
        if (!parsed.ok) {
          return {
            ok: false,
            projectDirectory: projectDirectoryFrom(input, defaultProjectDirectory),
            issues: parsed.issues
          };
        }
      }

      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const validation = store.validateAndStore();
        return {
          ok: validation.ok,
          projectDirectory: store.paths.projectDirectory,
          issues: validation.issues,
          project: store.requireProject()
        };
      } finally {
        store.close();
      }
    },

    async createManifest(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          manifest: createAssetManifest(store.requireProject())
        };
      } finally {
        store.close();
      }
    },

    async buildProject(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          artifact: buildProjectHtml(store.requireProject())
        };
      } finally {
        store.close();
      }
    },

    async expandEvent(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const route = project.routes.find((item) => item.id === record.routeId) || project.routes[0];
        if (!route) {
          throw new Error("이벤트를 추가할 루트가 없습니다.");
        }
        const request = createEventExpansionRequest(project, {
          projectDirectory: store.paths.projectDirectory,
          routeId: route.id,
          afterSceneId: typeof record.afterSceneId === "string" && record.afterSceneId ? record.afterSceneId : route.entrySceneId,
          heroineId: typeof record.heroineId === "string" && record.heroineId ? record.heroineId : route.heroineId,
          userEvent: String(record.userEvent || record.prompt || ""),
          constraints: record.constraints && typeof record.constraints === "object"
            ? record.constraints as Partial<EventExpansionRequest["constraints"]>
            : undefined
        });
        const result = await expandNaturalLanguageEvent({ project, request, adapter: options.eventText });
        if (!result.ok) {
          store.recordPatchHistory({
            status: "failed",
            summary: "자연어 이벤트 생성 실패",
            request,
            rawOutput: result.rawOutput,
            attempts: result.attempts,
            validation: { ok: false, issues: [{ severity: "error", path: "eventText", message: result.error }] }
          });
          return { ok: false, projectDirectory: store.paths.projectDirectory, request, attempts: result.attempts, error: result.error };
        }
        const patchHistoryEntry = store.recordPatchHistory({
          status: "proposed",
          summary: result.plan.summary,
          request,
          plan: result.plan,
          rawOutput: result.rawOutput,
          attempts: result.attempts,
          validation: result.validation,
          diff: result.validation.diff,
          beforeProject: project,
          afterProject: result.validation.appliedProject
        });
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          request,
          plan: result.plan,
          validation: result.validation,
          diff: result.validation.diff,
          attempts: result.attempts,
          rawOutput: result.rawOutput,
          patchHistoryEntry
        };
      } finally {
        store.close();
      }
    },

    async approveEvent(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const sourcePatchHistoryId = typeof record.patchHistoryId === "string" ? record.patchHistoryId : undefined;
        const result = store.applyEventExpansionPlan(requiredEventRequest(input), requiredEventPlan(input), sourcePatchHistoryId);
        return { ok: true, projectDirectory: store.paths.projectDirectory, ...result };
      } finally {
        store.close();
      }
    },

    async previewProject(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const runtime = store.previewProject(typeof record.startSceneId === "string" ? record.startSceneId : undefined);
        return { ok: true, projectDirectory: store.paths.projectDirectory, runtime };
      } finally {
        store.close();
      }
    },

    async exportProject(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const result = await store.exportWebPlayer(typeof record.outputDirectory === "string" ? record.outputDirectory : undefined);
        return { ok: true, projectDirectory: store.paths.projectDirectory, ...result };
      } finally {
        store.close();
      }
    },

    async smokeExport(input: unknown) {
      const outputPath = asRecord(input).outputPath;
      if (typeof outputPath !== "string" || !outputPath.trim()) {
        throw new InputValidationError("outputPath 입력이 필요합니다.", [{ severity: "error", path: "outputPath", message: "비어 있을 수 없습니다." }]);
      }
      return { ok: true, smoke: await smokeTestWebExport(outputPath) };
    },

    async createGenerationJob(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const job = createImageGenerationJob(generationJobInput(input));
        const project = store.requireProject();
        const index = project.generationJobs.findIndex((item) => item.id === job.id);
        if (index >= 0) {
          project.generationJobs[index] = job;
        } else {
          project.generationJobs.push(job);
        }
        const savedProject = store.saveProject(project);
        return { ok: true, projectDirectory: store.paths.projectDirectory, job, project: savedProject };
      } finally {
        store.close();
      }
    },

    async planDefaultEmotionAssets(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const heroineId = String(asRecord(input).heroineId || project.routes[0]?.heroineId || project.characters[0]?.id || "");
        const result = planExpressionAssetsForHeroine(project, { heroineId, tags: [...DEFAULT_EMOTION_TAGS] });
        const savedProject = store.saveProject(result.project);
        return { ok: true, projectDirectory: store.paths.projectDirectory, ...result, project: savedProject };
      } finally {
        store.close();
      }
    },

    async planExpressionAssets(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const record = asRecord(input);
        const heroineId = String(record.heroineId || project.routes[0]?.heroineId || project.characters[0]?.id || "");
        const tags = tagsFrom(record.tags);
        if (tags.length === 0) {
          throw new InputValidationError("tags 입력이 필요합니다.", [{ severity: "error", path: "tags", message: "하나 이상의 태그가 필요합니다." }]);
        }
        const result = planExpressionAssetsForHeroine(project, { heroineId, tags });
        const savedProject = store.saveProject(result.project);
        return { ok: true, projectDirectory: store.paths.projectDirectory, ...result, project: savedProject };
      } finally {
        store.close();
      }
    },

    async listGenerationJobs(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const status = typeof record.status === "string" ? record.status : "";
        const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));
        const jobs = project.generationJobs
          .filter((job) => !status || job.status === status)
          .map((job) => ({
            ...job,
            asset: job.outputAssetId ? assetMap.get(job.outputAssetId) : undefined
          }));
        return { ok: true, projectDirectory: store.paths.projectDirectory, jobs };
      } finally {
        store.close();
      }
    },

    async runGenerationJobs(input: unknown) {
      if (!options.image) {
        throw new Error("이미지 생성 adapter가 설정되지 않았습니다.");
      }
      const record = asRecord(input);
      const jobIds = Array.isArray(record.jobIds) ? record.jobIds.map((item) => String(item)) : [];
      const retryFailed = Boolean(record.retryFailed);
      const replaceCompleted = Boolean(record.replaceCompleted);
      if (jobIds.length === 0) {
        throw new InputValidationError("jobIds 입력이 필요합니다.", [{ severity: "error", path: "jobIds", message: "하나 이상의 생성 작업이 필요합니다." }]);
      }

      const store = await ensureProjectStore(input, defaultProjectDirectory);
      const jobs: VnMakerGenerationJob[] = [];
      const assets: VnMakerAsset[] = [];
      const errors: string[] = [];
      try {
        for (const jobId of jobIds) {
          const currentProject = store.requireProject();
          const currentJob = currentProject.generationJobs.find((job) => job.id === jobId);
          if (!currentJob) {
            errors.push(`생성 작업을 찾을 수 없습니다: ${jobId}`);
            continue;
          }
          if (currentJob.status === "completed" && !replaceCompleted) {
            jobs.push(currentJob);
            continue;
          }
          if (currentJob.status === "failed" && !retryFailed) {
            jobs.push(currentJob);
            continue;
          }

          try {
            store.markGenerationJobStatus(jobId, "running");
            const generationInput = selectGenerationInput(store.requireProject(), store, { ...record, jobId });
            const result = withWorkspacePreviewUri(await options.image.generateImageAsset(generationInput));
            const savedProject = await store.storeGenerationResult(result);
            const savedJob = savedProject.generationJobs.find((job) => job.id === result.job.id) || result.job;
            jobs.push(savedJob);
            assets.push(result.asset);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const failedProject = store.markGenerationJobStatus(jobId, "failed", message);
            const failedJob = failedProject.generationJobs.find((job) => job.id === jobId);
            if (failedJob) {
              jobs.push(failedJob);
            }
            errors.push(message);
          }
        }
        return {
          ok: errors.length === 0,
          projectDirectory: store.paths.projectDirectory,
          jobs,
          assets,
          errors,
          project: store.requireProject()
        };
      } finally {
        store.close();
      }
    },

    async generateImage(input: unknown) {
      if (!options.image) {
        throw new Error("이미지 생성 adapter가 설정되지 않았습니다.");
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const generationInput = selectGenerationInput(project, store, input);
        try {
          if (generationInput.jobId) {
            store.markGenerationJobStatus(generationInput.jobId, "running");
          }
          const result = withWorkspacePreviewUri(await options.image.generateImageAsset(generationInput));
          const savedProject = await store.storeGenerationResult(result);
          return { ok: true, projectDirectory: store.paths.projectDirectory, project: savedProject, ...result };
        } catch (error) {
          if (generationInput.jobId) {
            store.markGenerationJobStatus(generationInput.jobId, "failed", error instanceof Error ? error.message : String(error));
          }
          throw error;
        }
      } finally {
        store.close();
      }
    },

    async listPatchHistory(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return { ok: true, projectDirectory: store.paths.projectDirectory, entries: store.listPatchHistory() };
      } finally {
        store.close();
      }
    },

    async undoPatch(input: unknown) {
      const patchHistoryId = String(asRecord(input).patchHistoryId || "");
      if (!patchHistoryId) {
        throw new InputValidationError("patchHistoryId 입력이 필요합니다.", [{ severity: "error", path: "patchHistoryId", message: "비어 있을 수 없습니다." }]);
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.undoPatchHistory(patchHistoryId);
        const validation = store.validateAndStore();
        return { ok: true, projectDirectory: store.paths.projectDirectory, project, validation, entries: store.listPatchHistory() };
      } finally {
        store.close();
      }
    },

    validateProjectSnapshot(project: VnMakerProject) {
      const issues = validateProjectSnapshot(project);
      return { ok: issues.every((issue) => issue.severity !== "error"), issues };
    }
  };
}
