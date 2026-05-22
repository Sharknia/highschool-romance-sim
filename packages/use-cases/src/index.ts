import { join } from "node:path";
import {
  DEFAULT_EMOTION_TAGS,
  analyzeRouteGraph,
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
  type VnMakerChoice,
  type VnMakerGenerationJob,
  type VnMakerProject,
  type VnMakerScene,
  type VnMakerSceneEnding
} from "@vn-maker/engine-core";
import {
  createProjectWorkspace,
  openProjectStore,
  projectWorkspaceExists,
  RecentProjectIndexStore,
  smokeTestWebExport,
  type RecentProjectIndexEntry,
  type RecentProjectValidationState,
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
  recentProjectIndexFile?: string;
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
  | { ok: false; attempts: EventTextGenerationAttempt[]; error: string; rawOutput?: unknown; validation?: EventExpansionValidationResult };

export class InputValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "InputValidationError";
    this.issues = issues;
  }
}

export class RecentProjectIndexMissError extends Error {
  readonly code = "RECENT_PROJECT_INDEX_MISS";
  readonly projectId: string;

  constructor(projectId: string) {
    super("최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.");
    this.name = "RecentProjectIndexMissError";
    this.projectId = projectId;
  }
}

export class ProjectDirectoryMissingError extends Error {
  readonly code = "PROJECT_DIRECTORY_MISSING";
  readonly projectId: string;
  readonly projectDirectory: string;
  readonly recentProject: RecentProjectIndexEntry;

  constructor(entry: RecentProjectIndexEntry) {
    super("프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.");
    this.name = "ProjectDirectoryMissingError";
    this.projectId = entry.projectId;
    this.projectDirectory = entry.projectDirectory;
    this.recentProject = entry;
  }
}

export class ProjectIdMismatchError extends Error {
  readonly code = "PROJECT_ID_MISMATCH";
  readonly expectedProjectId: string;
  readonly actualProjectId: string;
  readonly projectDirectory: string;

  constructor(input: { expectedProjectId: string; actualProjectId: string; projectDirectory: string }) {
    super("프로젝트 ID가 일치하지 않습니다. 자동으로 덮어쓰지 않았습니다.");
    this.name = "ProjectIdMismatchError";
    this.expectedProjectId = input.expectedProjectId;
    this.actualProjectId = input.actualProjectId;
    this.projectDirectory = input.projectDirectory;
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

function optionalProjectId(input: unknown): string | undefined {
  const projectId = asRecord(input).projectId;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined;
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

function slugId(value: string, fallback: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function uniqueSceneId(project: VnMakerProject, seed: string): string {
  const used = new Set(project.scenes.map((scene) => scene.id));
  const base = slugId(seed, "scene-new").startsWith("scene-")
    ? slugId(seed, "scene-new")
    : `scene-${slugId(seed, "new")}`;
  if (!used.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`scene id를 생성할 수 없습니다: ${base}`);
}

function uniqueChoiceId(scene: VnMakerScene, seed: string): string {
  const used = new Set(scene.choices.map((choice) => choice.id));
  const base = slugId(seed, "choice-new").startsWith("choice-")
    ? slugId(seed, "choice-new")
    : `choice-${scene.id}-${slugId(seed, "new")}`;
  if (!used.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`choice id를 생성할 수 없습니다: ${base}`);
}

function uniqueEndingId(project: VnMakerProject, sceneId: string): string {
  const used = new Set(project.scenes.flatMap((scene) => scene.ending?.id ? [scene.ending.id] : []));
  const base = `ending-${slugId(sceneId.replace(/^scene-/, ""), "scene")}`;
  if (!used.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`ending id를 생성할 수 없습니다: ${base}`);
}

function projectClone(project: VnMakerProject): VnMakerProject {
  return JSON.parse(JSON.stringify(project)) as VnMakerProject;
}

function manualInputError(message: string, path: string, sceneIds?: string[], choiceIds?: string[]): InputValidationError {
  return new InputValidationError(message, [{ severity: "error", path, message }].map((issue) => ({
    ...issue,
    sceneIds,
    choiceIds
  } as ValidationIssue)));
}

function sceneFromInput(project: VnMakerProject, inputScene: unknown): VnMakerScene {
  const record = asRecord(inputScene);
  const candidate = {
    ...record,
    id: typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : uniqueSceneId(project, String(record.label || record.text || "scene-new")),
    label: typeof record.label === "string" ? record.label : "새 장면",
    speaker: typeof record.speaker === "string" ? record.speaker : "",
    text: typeof record.text === "string" ? record.text : "",
    characters: Array.isArray(record.characters) ? record.characters : [],
    choices: Array.isArray(record.choices) ? record.choices : []
  };
  if (project.scenes.some((scene) => scene.id === candidate.id)) {
    candidate.id = uniqueSceneId(project, candidate.id);
  }
  return requireParsed(parseVnMakerScene(candidate), "scene");
}

function endingFromInput(project: VnMakerProject, sceneId: string, inputEnding: unknown): VnMakerSceneEnding | undefined {
  if (inputEnding === null) {
    return undefined;
  }
  const record = asRecord(inputEnding);
  const candidate = {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : uniqueEndingId(project, sceneId),
    title: typeof record.title === "string" ? record.title : "새 엔딩",
    kind: typeof record.kind === "string" ? record.kind : "normal"
  };
  const parsed = parseVnMakerScene({
    id: sceneId,
    label: "ending validation",
    speaker: "",
    text: "",
    characters: [],
    choices: [],
    ending: candidate
  });
  if (!parsed.ok) {
    throw new InputValidationError("ending 입력이 올바르지 않습니다.", parsed.issues.map((issue) => ({
      ...issue,
      path: issue.path.replace(/^ending/, "ending")
    })));
  }
  return candidate as VnMakerSceneEnding;
}

function manualMutationResult(store: ProjectStore, project: VnMakerProject, selectedSceneId: string) {
  const savedProject = store.saveProject(project);
  const validation = store.validateAndStore();
  const routeGraphAnalysis = analyzeRouteGraph(savedProject);
  return {
    ok: true,
    projectDirectory: store.paths.projectDirectory,
    project: savedProject,
    validation,
    routeGraphAnalysis,
    selectedSceneId
  };
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

function validationStateFrom(validation: { ok: boolean }): RecentProjectValidationState {
  return validation.ok ? "valid" : "invalid";
}

async function recordRecentProject(
  recentProjects: RecentProjectIndexStore,
  input: {
    project: VnMakerProject;
    projectDirectory: string;
    validation: { ok: boolean };
  }
): Promise<void> {
  try {
    await recentProjects.upsertProject({
      projectId: input.project.id,
      projectDirectory: input.projectDirectory,
      title: input.project.title,
      validationState: validationStateFrom(input.validation)
    });
  } catch {
    // Recent projects are an auxiliary index; project creation/opening must not fail because this write failed.
  }
}

async function resolveProjectDirectoryForOpen(
  recentProjects: RecentProjectIndexStore,
  input: unknown,
  fallbackDirectory: string
): Promise<string> {
  const record = asRecord(input);
  const projectId = optionalProjectId(input);
  const projectDirectory = typeof record.projectDirectory === "string" && record.projectDirectory.trim()
    ? projectDirectoryFrom(input, fallbackDirectory)
    : undefined;

  if (projectDirectory) {
    if (projectId && !(await projectWorkspaceExists(projectDirectory))) {
      const entry = await recentProjects.findProject(projectId);
      if (entry) {
        await recentProjects.markProjectMissing(projectId, true);
      }
      throw new ProjectDirectoryMissingError({
        ...(entry || {
          projectId,
          projectDirectory,
          title: projectId,
          lastOpenedAt: new Date().toISOString()
        }),
        projectDirectory,
        missing: true
      });
    }
    return projectDirectory;
  }

  if (projectId) {
    const entry = await recentProjects.findProject(projectId);
    if (!entry) {
      throw new RecentProjectIndexMissError(projectId);
    }
    if (entry.missing || !(await projectWorkspaceExists(entry.projectDirectory))) {
      await recentProjects.markProjectMissing(projectId, true);
      throw new ProjectDirectoryMissingError({ ...entry, missing: true });
    }
    return entry.projectDirectory;
  }

  return fallbackDirectory;
}

function assertProjectIdMatches(input: unknown, project: VnMakerProject, projectDirectory: string): void {
  const expectedProjectId = optionalProjectId(input);
  if (expectedProjectId && project.id !== expectedProjectId) {
    throw new ProjectIdMismatchError({
      expectedProjectId,
      actualProjectId: project.id,
      projectDirectory
    });
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

function isRecoverableEventTextSchemaError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function eventTextErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function expandNaturalLanguageEvent(
  input: ExpandNaturalLanguageEventInput
): Promise<ExpandNaturalLanguageEventResult> {
  const maxAttempts = input.maxAttempts ?? 3;
  const attempts: EventTextGenerationAttempt[] = [];
  let rawOutput: unknown;
  let lastValidation: EventExpansionValidationResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let candidate: unknown;
    try {
      candidate = input.adapter
        ? await input.adapter.generateEventExpansionPlan({
            project: input.project,
            request: input.request,
            attempt,
            previousAttempts: attempts
          })
        : createDeterministicEventExpansionPlan(input.request);
    } catch (error) {
      if (!isRecoverableEventTextSchemaError(error)) {
        throw error;
      }
      const message = eventTextErrorMessage(error);
      rawOutput = { error: message };
      attempts.push({
        attempt,
        ok: false,
        failureKind: "schema_invalid",
        issues: [`eventText: ${message}`]
      });
      continue;
    }
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
      lastValidation = validation;
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
    rawOutput,
    validation: lastValidation
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
  const recentProjects = new RecentProjectIndexStore({ indexFilePath: options.recentProjectIndexFile });

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
        const project = store.requireProject();
        await recordRecentProject(recentProjects, {
          project,
          projectDirectory: store.paths.projectDirectory,
          validation
        });
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          project,
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
        await recordRecentProject(recentProjects, {
          project,
          projectDirectory: store.paths.projectDirectory,
          validation
        });
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
      const projectDirectory = await resolveProjectDirectoryForOpen(recentProjects, input, defaultProjectDirectory);
      return withStore(projectDirectory, async (store) => {
        const project = store.requireProject();
        assertProjectIdMatches(input, project, store.paths.projectDirectory);
        const validation = store.validateAndStore();
        await recordRecentProject(recentProjects, {
          project,
          projectDirectory: store.paths.projectDirectory,
          validation
        });
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          project,
          validation
        };
      });
    },

    async listRecentProjects() {
      return { ok: true, projects: await recentProjects.listProjects() };
    },

    async removeRecentProject(input: unknown) {
      const projectId = optionalProjectId(input);
      if (!projectId) {
        throw new InputValidationError("projectId 입력이 필요합니다.", [{ severity: "error", path: "projectId", message: "비어 있을 수 없습니다." }]);
      }
      return { ok: true, projects: await recentProjects.removeProject(projectId) };
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

    async insertManualScene(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = projectClone(store.requireProject());
        const route = project.routes[0];
        if (!route) {
          throw manualInputError("프로젝트에 route가 없습니다.", "routes");
        }

        const link = asRecord(record.link);
        const linkType = typeof link.type === "string" ? link.type : "none";
        if (!["none", "next", "choice"].includes(linkType)) {
          throw manualInputError("link.type은 none, next, choice 중 하나여야 합니다.", "link.type");
        }
        if (linkType !== "none" && typeof record.sourceSceneId !== "string") {
          throw manualInputError("sourceSceneId 입력이 필요합니다.", "sourceSceneId");
        }

        const sourceScene = typeof record.sourceSceneId === "string"
          ? project.scenes.find((scene) => scene.id === record.sourceSceneId)
          : undefined;
        if (linkType !== "none" && !sourceScene) {
          throw manualInputError("연결할 source scene을 찾을 수 없습니다.", "sourceSceneId", [String(record.sourceSceneId || "")]);
        }
        if (sourceScene?.ending) {
          throw manualInputError("엔딩 장면 뒤에는 연결할 수 없습니다. 먼저 엔딩을 해제하세요.", "sourceSceneId", [sourceScene.id]);
        }

        const scene = sceneFromInput(project, record.scene);
        if (linkType === "next" && sourceScene) {
          if (sourceScene.choices.length > 0) {
            throw manualInputError("선택지가 있는 장면에는 next를 연결할 수 없습니다.", "link.type", [sourceScene.id]);
          }
          if (sourceScene.next && link.preservePreviousNext === true && !scene.ending && !scene.next) {
            scene.next = sourceScene.next;
          }
          sourceScene.next = scene.id;
        }
        if (linkType === "choice" && sourceScene) {
          if (sourceScene.next) {
            throw manualInputError("next가 있는 장면에는 선택지를 연결할 수 없습니다.", "link.type", [sourceScene.id]);
          }
          const choiceText = typeof link.choiceText === "string" ? link.choiceText.trim() : "";
          if (!choiceText) {
            throw manualInputError("choiceText 입력이 필요합니다.", "link.choiceText", [sourceScene.id]);
          }
          const choiceId = typeof link.choiceId === "string" && link.choiceId.trim()
            ? link.choiceId.trim()
            : uniqueChoiceId(sourceScene, choiceText);
          const choice: VnMakerChoice = { id: choiceId, text: choiceText, next: scene.id };
          sourceScene.choices.push(choice);
        }

        project.scenes.push(scene);
        return manualMutationResult(store, project, scene.id);
      } finally {
        store.close();
      }
    },

    async linkManualScene(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = projectClone(store.requireProject());
        const sourceSceneId = String(record.sourceSceneId || "");
        const targetSceneId = String(record.targetSceneId || "");
        const sourceScene = project.scenes.find((scene) => scene.id === sourceSceneId);
        const targetScene = project.scenes.find((scene) => scene.id === targetSceneId);
        if (!sourceScene) {
          throw manualInputError("연결할 source scene을 찾을 수 없습니다.", "sourceSceneId", [sourceSceneId]);
        }
        if (!targetScene) {
          throw manualInputError("연결할 target scene을 찾을 수 없습니다.", "targetSceneId", [targetSceneId]);
        }
        if (sourceScene.ending) {
          throw manualInputError("엔딩 장면 뒤에는 연결할 수 없습니다. 먼저 엔딩을 해제하세요.", "sourceSceneId", [sourceScene.id]);
        }

        const link = asRecord(record.link);
        const linkType = typeof link.type === "string" ? link.type : "next";
        if (linkType === "next") {
          if (sourceScene.choices.length > 0) {
            throw manualInputError("선택지가 있는 장면에는 next를 연결할 수 없습니다.", "link.type", [sourceScene.id]);
          }
          sourceScene.next = targetScene.id;
        } else if (linkType === "choice") {
          if (sourceScene.next) {
            throw manualInputError("next가 있는 장면에는 선택지를 연결할 수 없습니다.", "link.type", [sourceScene.id]);
          }
          const choiceText = typeof link.choiceText === "string" ? link.choiceText.trim() : "";
          const choiceId = typeof link.choiceId === "string" && link.choiceId.trim()
            ? link.choiceId.trim()
            : uniqueChoiceId(sourceScene, choiceText || targetScene.label);
          const existingChoice = sourceScene.choices.find((choice) => choice.id === choiceId);
          if (existingChoice) {
            existingChoice.next = targetScene.id;
            if (choiceText) {
              existingChoice.text = choiceText;
            }
          } else {
            if (!choiceText) {
              throw manualInputError("choiceText 입력이 필요합니다.", "link.choiceText", [sourceScene.id], [choiceId]);
            }
            sourceScene.choices.push({ id: choiceId, text: choiceText, next: targetScene.id });
          }
        } else {
          throw manualInputError("link.type은 next 또는 choice여야 합니다.", "link.type", [sourceScene.id]);
        }

        return manualMutationResult(store, project, targetScene.id);
      } finally {
        store.close();
      }
    },

    async setSceneEnding(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = projectClone(store.requireProject());
        const sceneId = String(record.sceneId || "");
        const scene = project.scenes.find((item) => item.id === sceneId);
        if (!scene) {
          throw manualInputError("엔딩을 설정할 scene을 찾을 수 없습니다.", "sceneId", [sceneId]);
        }

        if (record.ending === null) {
          scene.ending = undefined;
          return manualMutationResult(store, project, scene.id);
        }

        if ((scene.next || scene.choices.length > 0) && record.clearOutgoing !== true) {
          throw manualInputError("엔딩으로 지정하려면 다음 장면이나 선택지를 제거해야 합니다.", "clearOutgoing", [scene.id]);
        }
        if (record.clearOutgoing === true) {
          scene.next = undefined;
          scene.choices = [];
        }
        scene.ending = endingFromInput(project, scene.id, record.ending);
        return manualMutationResult(store, project, scene.id);
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
        const afterSceneId = typeof record.afterSceneId === "string" && record.afterSceneId ? record.afterSceneId : route.entrySceneId;
        const afterScene = project.scenes.find((scene) => scene.id === afterSceneId);
        if (afterScene?.ending) {
          throw new InputValidationError("엔딩 장면 뒤에는 이벤트를 추가할 수 없습니다.", [{
            severity: "error",
            path: "afterSceneId",
            message: "엔딩 장면 뒤에는 이벤트를 추가할 수 없습니다."
          }]);
        }
        const request = createEventExpansionRequest(project, {
          projectDirectory: store.paths.projectDirectory,
          routeId: route.id,
          afterSceneId,
          heroineId: typeof record.heroineId === "string" && record.heroineId ? record.heroineId : route.heroineId,
          userEvent: String(record.userEvent || record.prompt || ""),
          constraints: record.constraints && typeof record.constraints === "object"
            ? record.constraints as Partial<EventExpansionRequest["constraints"]>
            : undefined
        });
        const result = await expandNaturalLanguageEvent({ project, request, adapter: options.eventText });
        if (!result.ok) {
          const validation = result.validation || {
            ok: false,
            issues: [{ severity: "error" as const, path: "eventText", message: result.error }]
          };
          store.recordPatchHistory({
            status: "failed",
            summary: "자연어 이벤트 생성 실패",
            request,
            rawOutput: result.rawOutput,
            attempts: result.attempts,
            validation
          });
          return { ok: false, projectDirectory: store.paths.projectDirectory, request, attempts: result.attempts, error: result.error, validation };
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
        const project = store.requireProject();
        const runtime = store.previewProject(typeof record.startSceneId === "string" ? record.startSceneId : undefined);
        const routeGraphAnalysis = analyzeRouteGraph(project, typeof record.routeId === "string" ? record.routeId : undefined);
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          runtime,
          validation: runtime.validation,
          routeGraphAnalysis
        };
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
