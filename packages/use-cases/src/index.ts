import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  DEFAULT_EMOTION_TAGS,
  DEFAULT_HEROINE_PORTRAIT_STYLE,
  analyzeRouteGraph,
  buildProjectHtml,
  createAssetManifest,
  createBlankProject,
  createDeterministicEventExpansionPlan,
  createEventExpansionRequest,
  createHeroineProfile,
  createHeroinePortraitPrompt,
  createImageGenerationJob,
  planExpressionAssetsForHeroine,
  createProjectFromHeroine,
  createStarterProject,
  hashProjectSnapshot,
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
  deleteLocalProjectDirectory,
  openProjectStore,
  projectWorkspaceExists,
  RecentProjectIndexStore,
  resolveProjectWorkspacePaths,
  smokeTestWebExport,
  type RecentProjectIndexEntry,
  type RecentProjectValidationState,
  type ProjectStore,
  type StoredHeroineProfile
} from "@vn-maker/project-store";

type JsonRecord = Record<string, unknown>;
type HeroineProfileDto = StoredHeroineProfile & {
  defaultPortraitUri?: string;
  portraitAssetUris?: string[];
};

export type HeroineActionFailureCode =
  | "HEROINE_INPUT_INVALID"
  | "HEROINE_ID_RESERVED"
  | "HEROINE_NOT_FOUND"
  | "HEROINE_ID_CONFLICT"
  | "HEROINE_REVISION_CONFLICT"
  | "OAUTH_REQUIRED"
  | "IMAGE_GENERATION_UNAVAILABLE"
  | "SERVER_ERROR";

export interface HeroineActionFailureDto {
  ok: false;
  code: HeroineActionFailureCode;
  message: string;
  error: string;
  requestId?: string;
  issues?: ValidationIssue[];
  retryable: boolean;
}

export interface HeroineRevisionRef {
  kind: "heroineRevision";
  heroineId: string;
  value: string;
  updatedAt: string;
  capturedAt: string;
}

export interface HeroineLibraryRevisionRef {
  kind: "heroineLibraryRevision";
  value: string;
  updatedAt: string;
  capturedAt: string;
}

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
  kind: Extract<VnMakerAsset["kind"], "portrait" | "expression" | "cg" | "background">;
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

export type MakerActionId =
  | "createProject"
  | "createProjectFromHeroine"
  | "assignHeroineSnapshot"
  | "openProject"
  | "reconnectRecentProject"
  | "listProjects"
  | "listRecentProjects"
  | "removeProject"
  | "removeRecentProject"
  | "deleteProjectWorkspace"
  | "restoreProject"
  | "restoreRecentProject"
  | "expandEvent"
  | "approveEvent"
  | "listGenerationJobs"
  | "runGenerationJobs"
  | "previewProject"
  | "exportProject";

export type MakerValidationState = "unknown" | "valid" | "warning" | "error";
export type MakerGenerationState = "empty" | "planned" | "running" | "failed" | "completed" | "partialFailed";
export type MakerPreviewState = "empty" | "blocked" | "stale" | "running" | "ready" | "failed";
export type MakerExportState = "empty" | "blocked" | "ready" | "running" | "completed" | "failed";

export interface MakerWorkflowStep {
  id: "project" | "heroine" | "background" | "studio" | "preview" | "export";
  label: string;
  state: "done" | "current" | "blocked" | "waiting";
}

export interface MakerWorkflowSummary {
  primaryAction: MakerActionId | "goToHeroine" | "goToBackground" | "goToStudio" | "goToPreview" | "goToExport";
  primaryLabel: string;
  blockingIssues: string[];
  validationState: MakerValidationState;
  generationState: MakerGenerationState;
  previewState: MakerPreviewState;
  exportState: MakerExportState;
  steps: MakerWorkflowStep[];
}

export interface ProjectDeletionPolicyDto {
  mode: "recentIndexOnly" | "localProjectFiles";
  reversible: boolean;
  impact: string[];
}

export interface BackgroundPolicyDto {
  limit: 1;
  existingAssetId?: string;
  replacesExisting: boolean;
}

export interface ProjectPreviewReadinessDto {
  state: "blocked" | "prepared" | "running" | "failed";
  availableState: MakerPreviewState;
  canRun: boolean;
  requiredData: {
    heroine: "ready" | "missing";
    background: "ready" | "missing" | "pending" | "failed";
    scenes: "ready" | "missing" | "invalid";
    validation: "ready" | "invalid";
    generationJobs: "ready" | "pending" | "failed";
  };
  missingItems: Array<{
    id: "heroine" | "background" | "studio" | "validation" | "generationJobs";
    label: string;
    tab: "heroine" | "background" | "studio" | "preview";
  }>;
  blockingIssues: string[];
  nextActions: Array<{
    label: string;
    tab: "heroine" | "background" | "studio" | "preview";
  }>;
  failureCause: string;
  retryable: boolean;
  nextAction: string;
}

export interface ProjectExportPlanDto {
  state: "ready" | "blocked" | "running" | "complete" | "failed";
  canExport: boolean;
  target: "localDesktopWebApp";
  githubPagesTarget: false;
  validationSummary: {
    ok: boolean;
    issueCount: number;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  includedData: Array<"project" | "runtime" | "assetManifest">;
  includedAssets: Array<Pick<VnMakerAsset, "id" | "kind" | "label" | "uri" | "source" | "generationJobId">>;
  blockers: Array<{
    kind: "requiredData" | "validation" | "generationJob";
    id?: string;
    status?: string;
    message: string;
    tab: "heroine" | "background" | "studio" | "export";
  }>;
  warnings: string[];
  failureCause: string;
  retryable: boolean;
  nextAction: string;
}

export type ProjectActionFailureCode =
  | "PROJECT_INPUT_INVALID"
  | "PROJECT_ID_RESERVED"
  | "PROJECT_ID_CONFLICT"
  | "PROJECT_NOT_FOUND"
  | "RECENT_PROJECT_INDEX_MISS"
  | "PROJECT_DIRECTORY_MISSING"
  | "PROJECT_ID_MISMATCH"
  | "PROJECT_REVISION_CONFLICT"
  | "HEROINE_REQUIRED"
  | "HEROINE_REPLACE_BLOCKED"
  | "PATCH_STALE"
  | "JOB_ALREADY_RUNNING"
  | "PREVIEW_BLOCKED"
  | "EXPORT_BLOCKED"
  | "OAUTH_REQUIRED"
  | "SERVER_ERROR";

export interface ProjectActionFailureDto {
  ok: false;
  action?: MakerActionId;
  code: ProjectActionFailureCode;
  message: string;
  error: string;
  nextAction: string;
  requestId: string;
  projectId?: string;
  projectDirectory?: string;
  expectedProjectId?: string;
  actualProjectId?: string;
  workflowSummary?: MakerWorkflowSummary;
  previewReadiness?: ProjectPreviewReadinessDto;
  exportPlan?: ProjectExportPlanDto;
  issues?: ValidationIssue[];
  retryable: boolean;
}

export interface ProjectFailureContract {
  code: ProjectActionFailureCode;
  message: string;
  nextAction: string;
  retryable: boolean;
}

const projectFailureContracts: Record<ProjectActionFailureCode, Omit<ProjectFailureContract, "code">> = {
  PROJECT_INPUT_INVALID: {
    message: "입력 오류",
    nextAction: "입력값을 확인한 뒤 다시 시도하세요.",
    retryable: false
  },
  PROJECT_ID_RESERVED: {
    message: "예약된 프로젝트 ID입니다.",
    nextAction: "다른 프로젝트 ID를 입력하세요.",
    retryable: false
  },
  PROJECT_ID_CONFLICT: {
    message: "이미 존재하는 프로젝트 ID입니다.",
    nextAction: "기존 프로젝트 열기, 다른 위치 선택, 생성 취소 중 하나를 선택하세요.",
    retryable: false
  },
  PROJECT_NOT_FOUND: {
    message: "프로젝트를 찾을 수 없습니다.",
    nextAction: "프로젝트 저장 위치를 확인한 뒤 다시 시도하세요.",
    retryable: false
  },
  RECENT_PROJECT_INDEX_MISS: {
    message: "프로젝트 목록에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.",
    nextAction: "프로젝트 디렉터리를 다시 열어 주세요.",
    retryable: false
  },
  PROJECT_DIRECTORY_MISSING: {
    message: "프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.",
    nextAction: "새 위치를 입력해 다시 연결해 주세요.",
    retryable: true
  },
  PROJECT_ID_MISMATCH: {
    message: "프로젝트 ID가 일치하지 않습니다. 자동으로 덮어쓰지 않았습니다.",
    nextAction: "올바른 프로젝트 저장 위치를 선택하세요.",
    retryable: false
  },
  PROJECT_REVISION_CONFLICT: {
    message: "프로젝트가 다른 곳에서 변경되었습니다.",
    nextAction: "최신 프로젝트를 다시 불러온 뒤 시도하세요.",
    retryable: false
  },
  HEROINE_REQUIRED: {
    message: "히로인 1명을 먼저 선택해야 합니다.",
    nextAction: "히로인 탭에서 스냅샷을 선택하세요.",
    retryable: false
  },
  HEROINE_REPLACE_BLOCKED: {
    message: "히로인 교체가 차단되었습니다.",
    nextAction: "기존 스냅샷 상태를 확인한 뒤 다시 시도하세요.",
    retryable: false
  },
  PATCH_STALE: {
    message: "현재 프로젝트가 패치 적용 직후 상태와 달라 자동 적용을 중단했습니다.",
    nextAction: "최신 프로젝트를 다시 불러온 뒤 시도하세요.",
    retryable: false
  },
  JOB_ALREADY_RUNNING: {
    message: "이미 실행 중인 생성 작업이 있습니다.",
    nextAction: "현재 작업이 끝난 뒤 다시 시도하세요.",
    retryable: false
  },
  PREVIEW_BLOCKED: {
    message: "프리뷰를 실행할 수 없습니다.",
    nextAction: "차단 항목을 해결한 뒤 다시 실행하세요.",
    retryable: false
  },
  EXPORT_BLOCKED: {
    message: "내보내기를 실행할 수 없습니다.",
    nextAction: "차단 항목을 해결한 뒤 다시 실행하세요.",
    retryable: false
  },
  OAUTH_REQUIRED: {
    message: "Codex ChatGPT OAuth 로그인이 필요합니다.",
    nextAction: "Codex에 로그인하세요.",
    retryable: true
  },
  SERVER_ERROR: {
    message: "서버 오류",
    nextAction: "잠시 후 다시 시도하세요.",
    retryable: true
  }
};

export function projectFailureContractForCode(code: ProjectActionFailureCode): ProjectFailureContract {
  return {
    code,
    ...projectFailureContracts[code]
  };
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

export function createProjectJsonParseFailureError(): InputValidationError {
  return new InputValidationError("JSON 입력을 해석하지 못했습니다.", [
    { severity: "error", path: "$", message: "요청 본문은 유효한 JSON이어야 합니다." }
  ]);
}

export class RecentProjectIndexMissError extends Error {
  readonly code = "RECENT_PROJECT_INDEX_MISS";
  readonly projectId: string;

  constructor(projectId: string) {
    super(projectFailureContractForCode("RECENT_PROJECT_INDEX_MISS").message);
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
    super(projectFailureContractForCode("PROJECT_DIRECTORY_MISSING").message);
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
    super(projectFailureContractForCode("PROJECT_ID_MISMATCH").message);
    this.name = "ProjectIdMismatchError";
    this.expectedProjectId = input.expectedProjectId;
    this.actualProjectId = input.actualProjectId;
    this.projectDirectory = input.projectDirectory;
  }
}

export class ProjectIdReservedError extends Error {
  readonly code = "PROJECT_ID_RESERVED";
  readonly projectId: string;

  constructor(projectId: string) {
    super(`예약된 프로젝트 ID입니다: ${projectId}`);
    this.name = "ProjectIdReservedError";
    this.projectId = projectId;
  }
}

export class ProjectIdConflictError extends Error {
  readonly code = "PROJECT_ID_CONFLICT";
  readonly projectId: string;
  readonly projectDirectory: string;

  constructor(input: { projectId: string; projectDirectory: string }) {
    super("이미 VN Maker 프로젝트가 있는 위치입니다. 기존 프로젝트를 덮어쓰지 않았습니다.");
    this.name = "ProjectIdConflictError";
    this.projectId = input.projectId;
    this.projectDirectory = input.projectDirectory;
  }
}

export class HeroineReplaceBlockedError extends Error {
  readonly code = "HEROINE_REPLACE_BLOCKED";
  readonly projectId: string;
  readonly projectDirectory: string;

  constructor(input: { projectId: string; projectDirectory: string }) {
    super("이미 이벤트나 이미지 작업이 있는 프로젝트에서는 히로인을 교체할 수 없습니다. 새 프로젝트를 만들어 주세요.");
    this.name = "HeroineReplaceBlockedError";
    this.projectId = input.projectId;
    this.projectDirectory = input.projectDirectory;
  }
}

export class ExportBlockedError extends Error {
  readonly code = "EXPORT_BLOCKED";
  readonly projectId: string;
  readonly projectDirectory: string;
  readonly issues: ValidationIssue[];
  readonly exportPlan?: ProjectExportPlanDto;

  constructor(input: { projectId: string; projectDirectory: string; message: string; issues?: ValidationIssue[]; exportPlan?: ProjectExportPlanDto }) {
    super(input.message);
    this.name = "ExportBlockedError";
    this.projectId = input.projectId;
    this.projectDirectory = input.projectDirectory;
    this.issues = input.issues || [];
    this.exportPlan = input.exportPlan;
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

const reservedProjectIds = new Set(["new", "open", "settings", "delete", "create"]);

function createRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function explicitProjectId(input: unknown): string | undefined {
  const record = asRecord(input);
  const projectId = record.projectId;
  if (typeof projectId === "string" && projectId.trim()) {
    return projectId.trim();
  }
  const starterId = asRecord(record.starter).id;
  if (typeof starterId === "string" && starterId.trim()) {
    return starterId.trim();
  }
  const projectIdFromProject = asRecord(record.project).id;
  return typeof projectIdFromProject === "string" && projectIdFromProject.trim()
    ? projectIdFromProject.trim()
    : undefined;
}

function assertProjectIdCanBeCreated(input: unknown): void {
  const projectId = explicitProjectId(input);
  if (!projectId) {
    return;
  }
  const normalized = projectId.trim().toLowerCase();
  if (reservedProjectIds.has(normalized)) {
    throw new ProjectIdReservedError(normalized);
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    throw new InputValidationError("projectId 입력이 올바르지 않습니다.", [{
      severity: "error",
      path: "projectId",
      message: "프로젝트 ID는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."
    }]);
  }
}

function validationStateForWorkflow(validation?: { ok?: boolean; issues?: ValidationIssue[] }): MakerValidationState {
  if (!validation) {
    return "unknown";
  }
  if (validation.ok === false) {
    return "error";
  }
  return validation.issues?.some((issue) => issue.severity === "warning") ? "warning" : "valid";
}

function generationStateForWorkflow(project?: VnMakerProject): MakerGenerationState {
  const jobs = project?.generationJobs.filter((job) => job.kind === "background" || job.kind === "cg") || [];
  if (jobs.length === 0) {
    return "empty";
  }
  if (jobs.some((job) => job.status === "running")) {
    return "running";
  }
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  if (failedCount > 0 && completedCount > 0) {
    return "partialFailed";
  }
  if (failedCount > 0) {
    return "failed";
  }
  if (completedCount === jobs.length) {
    return "completed";
  }
  return "planned";
}

function isBlockingGenerationState(state: MakerGenerationState): boolean {
  return state === "planned" || state === "running" || state === "failed" || state === "partialFailed";
}

function createWorkflowSummary(project?: VnMakerProject, validation?: { ok?: boolean; issues?: ValidationIssue[] }): MakerWorkflowSummary {
  const hasProject = Boolean(project);
  const hasHeroine = Boolean(project?.characters.length);
  const hasBackgroundAsset = Boolean(project?.assets.some((asset) => asset.kind === "background"));
  const hasScenesMissingBackground = Boolean(project?.scenes.some((scene) => !scene.backgroundAssetId));
  const hasBackground = hasBackgroundAsset && !hasScenesMissingBackground;
  const hasEvent = Boolean(project && project.scenes.length > 1);
  const incompleteImageJobs = project?.generationJobs.filter((job) => (job.kind === "background" || job.kind === "cg") && job.status !== "completed") || [];
  const generationState = generationStateForWorkflow(project);
  const validationState = validationStateForWorkflow(validation);
  const blockingIssues = [
    hasProject && !hasHeroine ? "히로인 1명을 먼저 선택해야 합니다." : "",
    hasHeroine && !hasBackgroundAsset ? "배경 화면 생성이 필요합니다." : "",
    hasHeroine && hasBackgroundAsset && hasScenesMissingBackground ? "모든 제작 씬에 배경 화면 연결이 필요합니다." : "",
    hasHeroine && hasBackground && !hasEvent ? "제작 탭에서 이벤트와 씬을 준비해야 합니다." : "",
    validationState === "error" ? "문제 확인 결과를 먼저 해결해야 합니다." : "",
    incompleteImageJobs.length > 0 || isBlockingGenerationState(generationState)
      ? "완료되지 않은 이미지 작업이 있습니다."
      : ""
  ].filter(Boolean);
  const primaryAction: MakerWorkflowSummary["primaryAction"] = !hasProject
    ? "createProject"
    : !hasHeroine
      ? "goToHeroine"
      : !hasBackground || incompleteImageJobs.length > 0 || isBlockingGenerationState(generationState)
        ? "goToBackground"
      : !hasEvent
        ? "goToStudio"
        : "goToPreview";
  const primaryLabel = primaryAction === "createProject"
    ? "새 프로젝트 만들기"
    : primaryAction === "goToHeroine"
      ? "히로인 스냅샷으로 이동"
      : primaryAction === "goToBackground"
        ? "배경 화면 생성으로 이동"
        : primaryAction === "goToStudio"
          ? "제작으로 이동"
          : "프리뷰 확인";

  return {
    primaryAction,
    primaryLabel,
    blockingIssues,
    validationState,
    generationState,
    previewState: !hasHeroine || !hasBackground || !hasEvent || incompleteImageJobs.length > 0 || isBlockingGenerationState(generationState) ? "blocked" : "stale",
    exportState: blockingIssues.length > 0 ? "blocked" : "ready",
    steps: [
      { id: "project", label: "프로젝트 생성", state: hasProject ? "done" : "current" },
      { id: "heroine", label: "히로인 선택", state: hasHeroine ? "done" : hasProject ? "current" : "blocked" },
      {
        id: "background",
        label: "배경 화면 생성",
        state: hasBackground && !isBlockingGenerationState(generationState)
          ? "done"
          : hasHeroine
            ? "current"
            : "blocked"
      },
      {
        id: "studio",
        label: "제작",
        state: hasEvent
          ? "done"
          : hasHeroine && hasBackground
            ? "current"
            : "blocked"
      },
      { id: "preview", label: "프리뷰", state: hasHeroine && hasBackground && hasEvent ? "current" : "blocked" },
      { id: "export", label: "내보내기", state: blockingIssues.length === 0 ? "waiting" : "blocked" }
    ]
  };
}

function requiredDataBlockersFor(project: VnMakerProject): ProjectExportPlanDto["blockers"] {
  const hasHeroine = project.characters.length > 0;
  const hasBackgroundAsset = project.assets.some((asset) => asset.kind === "background");
  const hasScenesMissingBackground = project.scenes.some((scene) => !scene.backgroundAssetId);
  const hasEventScenes = project.scenes.length > 1;
  const blockers: ProjectExportPlanDto["blockers"] = [];
  if (!hasHeroine) {
    blockers.push({
      kind: "requiredData",
      id: "heroine",
      message: "히로인 1명을 먼저 선택해야 합니다.",
      tab: "heroine"
    });
  }
  if (!hasBackgroundAsset || hasScenesMissingBackground) {
    blockers.push({
      kind: "requiredData",
      id: "background",
      message: hasBackgroundAsset ? "모든 제작 씬에 배경 화면 연결이 필요합니다." : "배경 화면 생성이 필요합니다.",
      tab: "background"
    });
  }
  if (!hasEventScenes) {
    blockers.push({
      kind: "requiredData",
      id: "studio",
      message: "제작 탭에서 이벤트와 씬을 준비해야 합니다.",
      tab: "studio"
    });
  }
  return blockers;
}

function previewReadinessFor(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  options: { state?: ProjectPreviewReadinessDto["state"]; failureCause?: string; retryable?: boolean } = {}
): ProjectPreviewReadinessDto {
  const hasHeroine = project.characters.length > 0;
  const backgroundJobs = project.generationJobs.filter((job) => job.kind === "background" && job.status !== "completed");
  const incompleteImageJobs = project.generationJobs.filter((job) => (job.kind === "background" || job.kind === "cg") && job.status !== "completed");
  const failedImageJobs = incompleteImageJobs.filter((job) => job.status === "failed");
  const hasBackgroundAsset = project.assets.some((asset) => asset.kind === "background");
  const hasScenesMissingBackground = project.scenes.some((scene) => !scene.backgroundAssetId);
  const hasBackground = hasBackgroundAsset && !hasScenesMissingBackground;
  const hasEventScenes = project.scenes.length > 1;
  const validationInvalid = validation.ok === false;
  const missingItems: ProjectPreviewReadinessDto["missingItems"] = [];

  if (!hasHeroine) {
    missingItems.push({ id: "heroine", label: "히로인 1명", tab: "heroine" });
  }
  if (!hasBackground || backgroundJobs.length > 0) {
    missingItems.push({
      id: "background",
      label: backgroundJobs.length > 0
        ? "완료된 배경 화면"
        : hasBackgroundAsset && hasScenesMissingBackground
          ? "씬에 연결된 배경 화면"
          : "배경 화면",
      tab: "background"
    });
  }
  if (!hasEventScenes) {
    missingItems.push({ id: "studio", label: "제작 씬", tab: "studio" });
  }
  if (validationInvalid) {
    missingItems.push({ id: "validation", label: "문제 확인 결과", tab: "studio" });
  }
  if (incompleteImageJobs.length > 0) {
    missingItems.push({ id: "generationJobs", label: "완료되지 않은 이미지 작업", tab: "background" });
  }

  const blockingIssues = [
    !hasHeroine ? "히로인 1명을 먼저 선택해야 합니다." : "",
    !hasBackgroundAsset ? "배경 화면 생성이 필요합니다." : "",
    hasBackgroundAsset && hasScenesMissingBackground ? "모든 제작 씬에 배경 화면 연결이 필요합니다." : "",
    !hasEventScenes ? "제작 탭에서 이벤트와 씬을 준비해야 합니다." : "",
    validationInvalid ? "문제 확인 결과를 먼저 해결해야 합니다." : "",
    incompleteImageJobs.length > 0 ? `완료되지 않은 이미지 작업이 있습니다: ${incompleteImageJobs.map((job) => job.id).join(", ")}` : ""
  ].filter(Boolean);
  const blocked = blockingIssues.length > 0;
  const state = options.state || (blocked ? "blocked" : "prepared");
  const nextActions = missingItems.map((item) => ({
    tab: item.tab,
    label: `해결 탭으로 이동: ${item.label}`
  }));
  const failureCause = options.failureCause
    || blockingIssues.join(" ")
    || "필수 데이터가 준비되었습니다.";

  return {
    state,
    availableState: state === "failed"
      ? "failed"
      : state === "running"
        ? "running"
        : blocked
          ? "blocked"
          : "ready",
    canRun: !blocked && state !== "failed",
    requiredData: {
      heroine: hasHeroine ? "ready" : "missing",
      background: hasBackground && backgroundJobs.length === 0
        ? "ready"
        : failedImageJobs.some((job) => job.kind === "background")
          ? "failed"
          : backgroundJobs.length > 0
            ? "pending"
            : "missing",
      scenes: hasEventScenes ? validationInvalid ? "invalid" : "ready" : "missing",
      validation: validationInvalid ? "invalid" : "ready",
      generationJobs: failedImageJobs.length > 0 ? "failed" : incompleteImageJobs.length > 0 ? "pending" : "ready"
    },
    missingItems,
    blockingIssues,
    nextActions,
    failureCause,
    retryable: options.retryable ?? state === "failed",
    nextAction: nextActions[0]?.label || (state === "failed" ? "실패 원인을 확인한 뒤 다시 시도하세요." : "프리뷰를 실행할 수 있습니다.")
  };
}

function validationSummaryFor(validation: { ok?: boolean; issues?: ValidationIssue[] }): ProjectExportPlanDto["validationSummary"] {
  const issues = validation.issues || [];
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity !== "error");
  return {
    ok: validation.ok !== false && errors.length === 0,
    issueCount: issues.length,
    errors,
    warnings
  };
}

function exportPlanFor(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  options: { state?: ProjectExportPlanDto["state"]; failureCause?: string; retryable?: boolean } = {}
): ProjectExportPlanDto {
  const validationSummary = validationSummaryFor(validation);
  const incompleteImageJobs = project.generationJobs.filter((job) => (job.kind === "background" || job.kind === "cg") && job.status !== "completed");
  const blockers: ProjectExportPlanDto["blockers"] = [
    ...requiredDataBlockersFor(project),
    ...validationSummary.errors.map((issue) => ({
      kind: "validation" as const,
      message: issue.message,
      tab: "studio" as const
    })),
    ...incompleteImageJobs.map((job) => ({
      kind: "generationJob" as const,
      id: job.id,
      status: job.status,
      message: `완료되지 않은 이미지 작업: ${job.id}`,
      tab: "background" as const
    }))
  ];
  const defaultState = blockers.length > 0 ? "blocked" : "ready";
  const state = options.state || defaultState;
  const canExport = blockers.length === 0 && state !== "failed" && state !== "blocked";
  const failureCause = options.failureCause
    || blockers.map((blocker) => blocker.message).join(" ")
    || (state === "complete" ? "내보내기 실행 결과가 준비되었습니다." : "내보내기 전 검증을 통과했습니다.");
  const nextAction = state === "failed"
    ? "저장 위치와 권한을 확인한 뒤 다시 실행하세요."
    : blockers.some((blocker) => blocker.kind === "generationJob")
      ? "배경 화면 생성 탭에서 완료되지 않은 이미지 작업을 실행하세요."
      : blockers.some((blocker) => blocker.kind === "requiredData" && blocker.id === "heroine")
        ? "히로인 탭에서 히로인 스냅샷을 배정하세요."
        : blockers.some((blocker) => blocker.kind === "requiredData" && blocker.id === "background")
          ? "배경 화면 생성 탭에서 배경을 준비하세요."
          : blockers.some((blocker) => blocker.kind === "requiredData" && blocker.id === "studio")
            ? "제작 탭에서 이벤트와 씬을 준비하세요."
            : blockers.some((blocker) => blocker.kind === "validation")
              ? "제작 탭에서 문제 확인 결과를 해결하세요."
              : state === "complete"
                ? "내보내기 실행 결과를 확인하세요."
                : "내보내기를 실행할 수 있습니다.";

  return {
    state,
    canExport,
    target: "localDesktopWebApp",
    githubPagesTarget: false,
    validationSummary,
    includedData: ["project", "runtime", "assetManifest"],
    includedAssets: project.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      label: asset.label,
      uri: asset.uri,
      source: asset.source,
      generationJobId: asset.generationJobId
    })),
    blockers,
    warnings: validationSummary.warnings.map((issue) => issue.message),
    failureCause,
    retryable: options.retryable ?? state === "failed",
    nextAction
  };
}

function exportBlockedMessage(validation: { ok?: boolean; issues?: ValidationIssue[] }, plan: ProjectExportPlanDto): string {
  const generationBlockers = plan.blockers.filter((blocker) => blocker.kind === "generationJob");
  if (generationBlockers.length > 0) {
    return `완료되지 않은 이미지 작업이 있습니다: ${generationBlockers.map((blocker) => blocker.id).filter(Boolean).join(", ")}`;
  }
  const requiredDataBlockers = plan.blockers.filter((blocker) => blocker.kind === "requiredData");
  if (requiredDataBlockers.length > 0) {
    return `내보내기 전에 필수 데이터를 준비해야 합니다: ${requiredDataBlockers.map((blocker) => blocker.message).join(", ")}`;
  }
  if (validation.ok === false) {
    return `검증 실패 프로젝트는 export할 수 없습니다: ${(validation.issues || []).map((issue) => issue.message).join(", ")}`;
  }
  return "내보내기 전에 차단 항목을 해결해야 합니다.";
}

function attachProjectFailureContext(
  error: unknown,
  input: {
    projectDirectory: string;
    project?: VnMakerProject;
    validation?: { ok?: boolean; issues?: ValidationIssue[] };
    previewReadiness?: ProjectPreviewReadinessDto;
    exportPlan?: ProjectExportPlanDto;
  }
): unknown {
  if (!error || typeof error !== "object") {
    return error;
  }
  const target = error as JsonRecord;
  target.projectDirectory = input.projectDirectory;
  if (input.project) {
    target.projectId = input.project.id;
    target.workflowSummary = createWorkflowSummary(input.project, input.validation);
  }
  if (input.previewReadiness) {
    target.previewReadiness = input.previewReadiness;
  }
  if (input.exportPlan) {
    target.exportPlan = input.exportPlan;
  }
  return error;
}

function withActionState<T extends JsonRecord>(
  action: MakerActionId,
  body: T,
  options: { project?: VnMakerProject; validation?: { ok?: boolean; issues?: ValidationIssue[] } } = {}
): T & {
  ok: boolean;
  requestId: string;
  action: MakerActionId;
  baseProjectHash?: string;
  projectRevision?: string;
  workflowSummary: MakerWorkflowSummary;
} {
  const project = options.project || (asRecord(body).project as VnMakerProject | undefined);
  const validation = options.validation || (asRecord(body).validation as { ok?: boolean; issues?: ValidationIssue[] } | undefined);
  const projectHash = project ? hashProjectSnapshot(project) : undefined;
  return {
    ...body,
    ok: body.ok !== false,
    requestId: createRequestId(),
    action,
    baseProjectHash: projectHash,
    projectRevision: projectHash,
    workflowSummary: createWorkflowSummary(project, validation)
  };
}

function backgroundPolicy(project: VnMakerProject): BackgroundPolicyDto {
  const linkedBackgroundIds = new Set(project.scenes.map((scene) => scene.backgroundAssetId).filter(Boolean));
  const backgroundAssets = project.assets.filter((asset) => asset.kind === "background");
  const existingBackground = backgroundAssets.find((asset) => asset.source === "generated" && linkedBackgroundIds.has(asset.id))
    || backgroundAssets.find((asset) => asset.source === "generated")
    || backgroundAssets.find((asset) => linkedBackgroundIds.has(asset.id))
    || backgroundAssets[0];
  return {
    limit: 1,
    existingAssetId: existingBackground?.id,
    replacesExisting: Boolean(existingBackground)
  };
}

function retryableFailureCode(code: ProjectActionFailureCode): boolean {
  return projectFailureContractForCode(code).retryable;
}

function failureCodeFromError(error: unknown): ProjectActionFailureCode {
  if (error instanceof InputValidationError) {
    return "PROJECT_INPUT_INVALID";
  }
  const errorRecord = asRecord(error);
  const code = typeof errorRecord.code === "string" ? errorRecord.code : "";
  if (
    code === "PROJECT_INPUT_INVALID"
    || code === "PROJECT_ID_RESERVED"
    || code === "PROJECT_ID_CONFLICT"
    || code === "PROJECT_NOT_FOUND"
    || code === "RECENT_PROJECT_INDEX_MISS"
    || code === "PROJECT_DIRECTORY_MISSING"
    || code === "PROJECT_ID_MISMATCH"
    || code === "PROJECT_REVISION_CONFLICT"
    || code === "HEROINE_REQUIRED"
    || code === "HEROINE_REPLACE_BLOCKED"
    || code === "PATCH_STALE"
    || code === "JOB_ALREADY_RUNNING"
    || code === "PREVIEW_BLOCKED"
    || code === "EXPORT_BLOCKED"
    || code === "OAUTH_REQUIRED"
  ) {
    return code;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OAuth 로그인이 필요")) {
    return "OAUTH_REQUIRED";
  }
  if (message.includes("현재 프로젝트가 패치 적용 직후 상태와 달라")) {
    return "PATCH_STALE";
  }
  return "SERVER_ERROR";
}

function imageGenerationFailureFromMessages(messages: string[]): Pick<ProjectActionFailureDto, "code" | "message" | "error" | "retryable"> {
  const message = messages.find((item) => item.trim()) || "이미지 생성 작업이 실패했습니다.";
  const code = message.includes("OAuth 로그인이 필요") ? "OAUTH_REQUIRED" : "SERVER_ERROR";
  return {
    code,
    message,
    error: message,
    retryable: retryableFailureCode(code)
  };
}

function projectFailureMessageFromError(error: unknown, contract: ProjectFailureContract): string {
  const errorRecord = asRecord(error);
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof errorRecord.message === "string" && errorRecord.message.trim()) {
    return errorRecord.message.trim();
  }
  if (typeof errorRecord.error === "string" && errorRecord.error.trim()) {
    return errorRecord.error.trim();
  }
  return typeof error === "string" && error.trim() ? error.trim() : contract.message;
}

export function projectActionFailureFromError(error: unknown, action?: MakerActionId): ProjectActionFailureDto {
  const errorRecord = asRecord(error);
  const code = failureCodeFromError(error);
  const contract = projectFailureContractForCode(code);
  const message = projectFailureMessageFromError(error, contract);
  const expectedProjectId = typeof errorRecord.expectedProjectId === "string" ? errorRecord.expectedProjectId : undefined;
  const issues = error instanceof InputValidationError
    ? error.issues
    : Array.isArray(errorRecord.issues)
      ? errorRecord.issues as ValidationIssue[]
      : undefined;
  const workflowSummary = errorRecord.workflowSummary && typeof errorRecord.workflowSummary === "object"
    ? errorRecord.workflowSummary as MakerWorkflowSummary
    : undefined;
  const previewReadiness = errorRecord.previewReadiness && typeof errorRecord.previewReadiness === "object"
    ? errorRecord.previewReadiness as ProjectPreviewReadinessDto
    : undefined;
  const exportPlan = errorRecord.exportPlan && typeof errorRecord.exportPlan === "object"
    ? errorRecord.exportPlan as ProjectExportPlanDto
    : undefined;
  return {
    ok: false,
    action,
    code,
    message,
    error: message,
    nextAction: typeof errorRecord.nextAction === "string" && errorRecord.nextAction.trim() ? errorRecord.nextAction.trim() : contract.nextAction,
    requestId: createRequestId(),
    projectId: typeof errorRecord.projectId === "string" ? errorRecord.projectId : expectedProjectId,
    projectDirectory: typeof errorRecord.projectDirectory === "string" ? errorRecord.projectDirectory : undefined,
    expectedProjectId,
    actualProjectId: typeof errorRecord.actualProjectId === "string" ? errorRecord.actualProjectId : undefined,
    workflowSummary,
    previewReadiness,
    exportPlan,
    issues,
    retryable: contract.retryable
  };
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

function requiredProjectDirectoryForDelete(input: unknown): string {
  const projectDirectory = asRecord(input).projectDirectory;
  if (typeof projectDirectory !== "string" || !projectDirectory.trim()) {
    throw projectDeleteInputError("projectDirectory", "삭제할 프로젝트 저장 위치가 필요합니다.");
  }
  return projectDirectory.trim();
}

function sourceProjectDirectoryFrom(input: unknown, fallback: string): string {
  const record = asRecord(input);
  return typeof record.sourceProjectDirectory === "string" && record.sourceProjectDirectory.trim()
    ? record.sourceProjectDirectory
    : projectDirectoryFrom(input, fallback);
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

function optionalHeroine(input: unknown): HeroineProfile | undefined {
  const record = asRecord(input);
  return record.heroine ? requiredHeroine(input) : undefined;
}

async function heroineFromLibrary(input: unknown, fallbackDirectory: string): Promise<HeroineProfile | undefined> {
  const record = asRecord(input);
  if (typeof record.heroineId !== "string" || !record.heroineId.trim()) {
    return undefined;
  }
  const sourceDirectory = sourceProjectDirectoryFrom(input, fallbackDirectory);
  const store = await openProjectStore(sourceDirectory);
  try {
    return store.listHeroines().find((item) => item.id === record.heroineId);
  } finally {
    store.close();
  }
}

async function recordSourceHeroineReuse(
  input: unknown,
  project: VnMakerProject,
  options: { fallbackDirectory: string; targetProjectDirectory: string }
): Promise<void> {
  const record = asRecord(input);
  if (record.heroine || typeof record.heroineId !== "string" || !record.heroineId.trim()) {
    return;
  }
  const sourceDirectory = resolveProjectWorkspacePaths(sourceProjectDirectoryFrom(input, options.fallbackDirectory)).projectDirectory;
  if (sourceDirectory === options.targetProjectDirectory) {
    return;
  }
  const store = await openProjectStore(sourceDirectory);
  try {
    store.recordHeroineReuse(record.heroineId, project, options.targetProjectDirectory);
  } finally {
    store.close();
  }
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

function addHeroineAssetUris(heroines: StoredHeroineProfile[], project: VnMakerProject): HeroineProfileDto[] {
  const assetUriById = new Map(project.assets
    .filter((asset) => Boolean(asset.uri))
    .map((asset) => [asset.id, asset.uri!] as const));
  return heroines.map((heroine) => {
    const defaultPortraitUri = heroine.defaultPortraitAssetId ? assetUriById.get(heroine.defaultPortraitAssetId) : undefined;
    const portraitAssetUris = heroine.portraitAssetIds
      .map((assetId) => assetUriById.get(assetId))
      .filter((uri): uri is string => Boolean(uri));
    return {
      ...heroine,
      ...(defaultPortraitUri ? { defaultPortraitUri } : {}),
      ...(portraitAssetUris.length > 0 ? { portraitAssetUris } : {})
    };
  });
}

function listHeroinesForResponse(store: ProjectStore, input: unknown = {}): HeroineProfileDto[] {
  const filtered = filterAndSortHeroines(store.listHeroineEntries(), input) as StoredHeroineProfile[];
  return addHeroineAssetUris(filtered, store.requireProject());
}

function heroineForResponse(store: ProjectStore, heroine: StoredHeroineProfile): HeroineProfileDto {
  return addHeroineAssetUris([heroine], store.requireProject())[0];
}

function requestIdFrom(input: unknown): string | undefined {
  const requestId = asRecord(input).requestId;
  return typeof requestId === "string" && requestId.trim() ? requestId.trim() : undefined;
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function heroineRevisionFor(heroine: StoredHeroineProfile, capturedAt = new Date().toISOString()): HeroineRevisionRef {
  return {
    kind: "heroineRevision",
    heroineId: heroine.id,
    value: hashStable({
      id: heroine.id,
      name: heroine.name,
      description: heroine.description,
      personality: heroine.personality,
      speechStyle: heroine.speechStyle,
      appearance: heroine.appearance,
      defaultPortraitAssetId: heroine.defaultPortraitAssetId,
      portraitAssetIds: heroine.portraitAssetIds,
      expressionAssetIds: heroine.expressionAssetIds,
      tags: heroine.tags,
      reuseHistory: heroine.reuseHistory,
      updatedAt: heroine.updatedAt
    }),
    updatedAt: heroine.updatedAt,
    capturedAt
  };
}

function libraryRevisionFor(heroines: StoredHeroineProfile[], capturedAt = new Date().toISOString()): HeroineLibraryRevisionRef {
  const heroineRevisions = heroines.map((heroine) => heroineRevisionFor(heroine, capturedAt));
  const updatedAt = heroines
    .map((heroine) => heroine.updatedAt)
    .sort()
    .at(-1) || capturedAt;
  return {
    kind: "heroineLibraryRevision",
    value: hashStable(heroineRevisions.map((revision) => ({
      heroineId: revision.heroineId,
      value: revision.value,
      updatedAt: revision.updatedAt
    }))),
    updatedAt,
    capturedAt
  };
}

function heroineFailure(
  input: unknown,
  code: HeroineActionFailureCode,
  message: string,
  options: { issues?: ValidationIssue[]; retryable?: boolean } = {}
): HeroineActionFailureDto {
  const requestId = requestIdFrom(input);
  return {
    ok: false,
    code,
    message,
    error: message,
    ...(requestId ? { requestId } : {}),
    ...(options.issues ? { issues: options.issues } : {}),
    retryable: options.retryable ?? false
  };
}

export function heroineFailureStatus(code: HeroineActionFailureCode): number {
  if (code === "OAUTH_REQUIRED") {
    return 401;
  }
  if (code === "IMAGE_GENERATION_UNAVAILABLE") {
    return 503;
  }
  if (code === "HEROINE_NOT_FOUND") {
    return 404;
  }
  if (code === "HEROINE_ID_CONFLICT" || code === "HEROINE_REVISION_CONFLICT") {
    return 409;
  }
  if (code === "SERVER_ERROR") {
    return 500;
  }
  return 400;
}

export function isHeroineActionFailure(value: unknown): value is HeroineActionFailureDto {
  return Boolean(
    value
      && typeof value === "object"
      && (value as { ok?: unknown }).ok === false
      && typeof (value as { code?: unknown }).code === "string"
      && typeof (value as { message?: unknown }).message === "string"
  );
}

function heroineIdIssue(heroineId: string): ValidationIssue | null {
  if (!/^[a-z0-9_-]+$/.test(heroineId)) {
    return {
      severity: "error",
      path: "id",
      message: "히로인 ID는 소문자 영문, 숫자, 하이픈, 언더스코어만 사용할 수 있습니다."
    };
  }
  return null;
}

function isReservedHeroineId(heroineId: string): boolean {
  return ["new", "edit", "settings", "delete", "create"].includes(heroineId);
}

function parseHeroineForAction(input: unknown): HeroineProfile | HeroineActionFailureDto {
  const record = asRecord(input);
  const heroineRecord = asRecord(record.heroine);
  const rawId = typeof heroineRecord.id === "string" ? heroineRecord.id.trim() : "";
  const parsed = parseHeroineProfileInput(record.heroine);
  if (!parsed.ok) {
    return heroineFailure(input, "HEROINE_INPUT_INVALID", "히로인 입력값이 올바르지 않습니다.", { issues: parsed.issues });
  }
  if (isReservedHeroineId(rawId)) {
    return heroineFailure(input, "HEROINE_ID_RESERVED", "예약어는 히로인 ID로 사용할 수 없습니다.", {
      issues: [{ severity: "error", path: "id", message: `${rawId}는 예약어입니다.` }]
    });
  }
  const idIssue = heroineIdIssue(rawId);
  if (idIssue) {
    return heroineFailure(input, "HEROINE_INPUT_INVALID", "히로인 ID 형식이 올바르지 않습니다.", { issues: [idIssue] });
  }
  return createHeroineProfile(parsed.value);
}

function heroineIdFromAction(input: unknown): string | HeroineActionFailureDto {
  const heroineId = String(asRecord(input).heroineId || "").trim();
  if (!heroineId) {
    return heroineFailure(input, "HEROINE_INPUT_INVALID", "heroineId 입력이 필요합니다.", {
      issues: [{ severity: "error", path: "heroineId", message: "비어 있을 수 없습니다." }]
    });
  }
  return heroineId;
}

function expectedRevisionValue(input: unknown): string | undefined {
  const expected = asRecord(input).expectedHeroineRevision;
  return typeof expected === "object" && expected !== null && typeof (expected as { value?: unknown }).value === "string"
    ? (expected as { value: string }).value
    : undefined;
}

function requireExpectedRevisionValue(input: unknown): string | HeroineActionFailureDto {
  const expected = expectedRevisionValue(input);
  if (!expected) {
    return heroineFailure(input, "HEROINE_INPUT_INVALID", "expectedHeroineRevision 입력이 필요합니다.", {
      issues: [{ severity: "error", path: "expectedHeroineRevision", message: "최신 revision 기준으로만 변경할 수 있습니다." }]
    });
  }
  return expected;
}

function withHeroineContract(
  store: ProjectStore,
  heroine: HeroineProfileDto
): {
  heroine: HeroineProfileDto;
  portraitAsset?: VnMakerAsset;
  heroineRevision: HeroineRevisionRef;
  libraryRevision: HeroineLibraryRevisionRef;
} {
  const project = store.requireProject();
  const portraitAsset = heroine.defaultPortraitAssetId
    ? project.assets.find((asset) => asset.id === heroine.defaultPortraitAssetId)
    : undefined;
  return {
    heroine,
    ...(portraitAsset ? { portraitAsset } : {}),
    heroineRevision: heroineRevisionFor(heroine),
    libraryRevision: libraryRevisionFor(store.listHeroineEntries())
  };
}

function heroinePortraitStatus(heroine: HeroineProfileDto): "none" | "placeholder" | "generated" | "imported" | "missing" {
  const previewUri = heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0];
  if (previewUri) {
    return "generated";
  }
  if (heroine.defaultPortraitAssetId || heroine.portraitAssetIds.length > 0) {
    return "missing";
  }
  return "none";
}

function heroineListItem(heroine: HeroineProfileDto): HeroineProfileDto & {
  summary: string;
  personalitySummary?: string;
  portraitStatus: "none" | "placeholder" | "generated" | "imported" | "missing";
  heroineRevision: HeroineRevisionRef;
} {
  return {
    ...heroine,
    summary: heroine.description,
    personalitySummary: heroine.personality,
    portraitStatus: heroinePortraitStatus(heroine),
    heroineRevision: heroineRevisionFor(heroine)
  };
}

function stagedPortraitReferenceFailure(input: unknown, message: string): HeroineActionFailureDto {
  return heroineFailure(input, "HEROINE_INPUT_INVALID", message, {
    issues: [{ severity: "error", path: "stagedPortraitRef", message }]
  });
}

function stagedPortraitAssetId(
  input: unknown,
  store: ProjectStore
): { assetId: string; stagedPortraitId: string; heroineId?: string } | HeroineActionFailureDto | undefined {
  const stagedPortraitRef = asRecord(input).stagedPortraitRef;
  if (!stagedPortraitRef || typeof stagedPortraitRef !== "object") {
    return undefined;
  }
  const stagedId = (stagedPortraitRef as { id?: unknown }).id;
  if (typeof stagedId !== "string" || !stagedId.startsWith("staged-")) {
    return stagedPortraitReferenceFailure(input, "staged portrait 참조 형식이 올바르지 않습니다.");
  }
  const staged = store.getStagedPortrait(stagedId);
  if (!staged || staged.consumedAt) {
    return stagedPortraitReferenceFailure(input, "staged portrait 참조를 찾을 수 없거나 이미 사용되었습니다.");
  }
  if (Date.parse(staged.expiresAt) <= Date.now()) {
    return stagedPortraitReferenceFailure(input, "staged portrait 참조가 만료되었습니다.");
  }
  const assetExists = store.requireProject().assets.some((asset) => asset.id === staged.assetId && asset.kind === "portrait");
  if (!assetExists) {
    return stagedPortraitReferenceFailure(input, "staged portrait 에셋을 찾을 수 없습니다.");
  }
  return { assetId: staged.assetId, stagedPortraitId: staged.id, heroineId: staged.heroineId };
}

function attachStagedPortrait(
  heroine: HeroineProfile,
  input: unknown,
  store: ProjectStore
): { heroine: HeroineProfile; stagedPortraitId?: string } | HeroineActionFailureDto {
  const stagedPortrait = stagedPortraitAssetId(input, store);
  if (!stagedPortrait) {
    return { heroine };
  }
  if (isHeroineActionFailure(stagedPortrait)) {
    return stagedPortrait;
  }
  if (stagedPortrait.heroineId && stagedPortrait.heroineId !== heroine.id) {
    return stagedPortraitReferenceFailure(input, "staged portrait 참조가 현재 히로인 ID와 일치하지 않습니다.");
  }
  return {
    heroine: {
      ...heroine,
      defaultPortraitAssetId: stagedPortrait.assetId,
      portraitAssetIds: [...new Set([stagedPortrait.assetId, ...heroine.portraitAssetIds])]
    },
    stagedPortraitId: stagedPortrait.stagedPortraitId
  };
}

function heroineImageGenerationFailure(input: unknown, error: unknown): HeroineActionFailureDto {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OAuth 로그인이 필요")) {
    return heroineFailure(input, "OAUTH_REQUIRED", "Codex ChatGPT OAuth 로그인이 필요합니다.", { retryable: true });
  }
  if (message.includes("imageGeneration")) {
    return heroineFailure(input, "IMAGE_GENERATION_UNAVAILABLE", "현재 Codex app-server가 imageGeneration 기능을 제공하지 않습니다.", { retryable: true });
  }
  return heroineFailure(input, "SERVER_ERROR", `이미지 생성 중 오류가 발생했습니다. ${message}`, { retryable: true });
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

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function removeRecentProjectAfterLocalDelete(
  recentProjects: RecentProjectIndexStore,
  projectId: string
): Promise<{
  projects: RecentProjectIndexEntry[];
  recentIndexRemoval: { ok: true } | { ok: false; error: string };
}> {
  try {
    return {
      projects: await recentProjects.removeProject(projectId),
      recentIndexRemoval: { ok: true }
    };
  } catch (error) {
    let projects: RecentProjectIndexEntry[] = [];
    try {
      projects = await recentProjects.listProjects();
    } catch {
      projects = [];
    }
    return {
      projects,
      recentIndexRemoval: {
        ok: false,
        error: messageFromError(error)
      }
    };
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

function projectDeleteInputError(path: string, message: string): InputValidationError {
  return new InputValidationError("프로젝트 삭제 입력이 올바르지 않습니다.", [{ severity: "error", path, message }]);
}

function assertProjectDeleteConfirmed(input: unknown, project: VnMakerProject): void {
  const record = asRecord(input);
  const projectId = typeof record.projectId === "string" ? record.projectId.trim() : "";
  if (!projectId) {
    throw projectDeleteInputError("projectId", "프로젝트 ID 확인이 필요합니다.");
  }
  if (projectId !== project.id) {
    throw new ProjectIdMismatchError({
      expectedProjectId: projectId,
      actualProjectId: project.id,
      projectDirectory: projectDirectoryFrom(input, "")
    });
  }
  if (record.deleteFiles !== true) {
    throw projectDeleteInputError("deleteFiles", "로컬 프로젝트 파일 삭제 확인이 필요합니다.");
  }
  const confirmTitle = typeof record.confirmTitle === "string" ? record.confirmTitle.trim() : "";
  if (confirmTitle !== project.title) {
    throw projectDeleteInputError("confirmTitle", "프로젝트 제목 확인값이 일치해야 합니다.");
  }
}

async function readExistingProject(projectDirectory: string): Promise<VnMakerProject | null> {
  if (!(await projectWorkspaceExists(projectDirectory))) {
    return null;
  }
  const store = await openProjectStore(projectDirectory);
  try {
    return store.getProject();
  } finally {
    store.close();
  }
}

async function assertProjectCreationTargetAvailable(projectDirectory: string, candidateProject: VnMakerProject): Promise<void> {
  const existingProject = await readExistingProject(projectDirectory);
  if (!existingProject) {
    return;
  }
  if (existingProject.id !== candidateProject.id) {
    throw new ProjectIdMismatchError({
      expectedProjectId: existingProject.id,
      actualProjectId: candidateProject.id,
      projectDirectory
    });
  }
  throw new ProjectIdConflictError({
    projectId: existingProject.id,
    projectDirectory
  });
}

function assertCanAssignHeroineSnapshot(project: VnMakerProject, projectDirectory: string): void {
  const hasExistingProductionState = project.characters.length > 0
    || project.routes.length > 0
    || project.scenes.length > 0
    || project.generationJobs.length > 0
    || project.assets.some((asset) => asset.kind === "cg");
  if (hasExistingProductionState) {
    throw new HeroineReplaceBlockedError({
      projectId: project.id,
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
    || (heroine ? createHeroinePortraitPrompt(heroine) : "");

  if (!["portrait", "expression", "cg", "background"].includes(kind)) {
    throw new InputValidationError("image.kind 입력이 올바르지 않습니다.", [{ severity: "error", path: "kind", message: `지원하지 않는 이미지 종류입니다: ${String(kind)}` }]);
  }
  if (!prompt.trim()) {
    throw new InputValidationError("image.prompt 입력이 필요합니다.", [{ severity: "error", path: "prompt", message: "비어 있을 수 없습니다." }]);
  }

  return {
    kind,
    targetId,
    prompt,
    style: plannedJob?.style || (typeof record.style === "string" ? record.style : heroine ? DEFAULT_HEROINE_PORTRAIT_STYLE : "soft visual novel, clean anime, production-ready"),
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
      assertProjectIdCanBeCreated(input);
      const record = asRecord(input);
      const project = optionalProject(input)
        || (record.blank === true ? createBlankProject(optionalStarter(input)) : createStarterProject(optionalStarter(input)));
      await assertProjectCreationTargetAvailable(projectDirectory, project);
      const store = await createProjectWorkspace({
        projectDirectory,
        project
      });
      try {
        const validation = store.validateAndStore();
        const savedProject = store.requireProject();
        await recordRecentProject(recentProjects, {
          project: savedProject,
          projectDirectory: store.paths.projectDirectory,
          validation
        });
        return withActionState("createProject", {
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          project: savedProject,
          validation
        }, { project: savedProject, validation });
      } finally {
        store.close();
      }
    },

    async createProjectFromHeroine(input: unknown) {
      const record = asRecord(input);
      const projectDirectory = projectDirectoryFrom(input, defaultProjectDirectory);
      assertProjectIdCanBeCreated(input);
      const heroine = record.heroine
        ? requiredHeroine(input)
        : await heroineFromLibrary(input, defaultProjectDirectory);
      if (!heroine) {
        throw new InputValidationError("heroine 입력이 필요합니다.", [{ severity: "error", path: "heroineId", message: "히로인 라이브러리에서 찾을 수 없습니다." }]);
      }
      const project = createProjectFromHeroine({
        id: typeof record.projectId === "string" ? record.projectId : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        premise: typeof record.premise === "string" ? record.premise : undefined,
        heroine
      });
      await assertProjectCreationTargetAvailable(projectDirectory, project);
      const store = await createProjectWorkspace({
        projectDirectory,
        project
      });
      try {
        store.saveHeroine(heroine);
        const savedProject = store.requireProject();
        store.recordHeroineReuse(heroine.id, savedProject);
        const validation = store.validateAndStore();
        await recordSourceHeroineReuse(input, savedProject, {
          fallbackDirectory: defaultProjectDirectory,
          targetProjectDirectory: store.paths.projectDirectory
        });
        await recordRecentProject(recentProjects, {
          project: savedProject,
          projectDirectory: store.paths.projectDirectory,
          validation
        });
        return withActionState("createProjectFromHeroine", {
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          heroine,
          project: savedProject,
          projectId: savedProject.id,
          targetRoute: `/projects/${savedProject.id}/overview`,
          validation
        }, { project: savedProject, validation });
      } finally {
        store.close();
      }
    },

    async assignHeroineSnapshot(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const heroine = optionalHeroine(input)
          || store.listHeroines().find((item) => item.id === record.heroineId);
        if (!heroine) {
          throw new InputValidationError("heroine 입력이 필요합니다.", [{ severity: "error", path: "heroineId", message: "히로인 라이브러리에서 찾을 수 없습니다." }]);
        }
        assertCanAssignHeroineSnapshot(project, store.paths.projectDirectory);
        const nextProject = createProjectFromHeroine({
          id: project.id,
          title: project.title,
          premise: project.premise,
          heroine
        });
        const savedProject = store.saveProject(nextProject);
        store.recordHeroineReuse(heroine.id, savedProject);
        const validation = store.validateAndStore();
        return withActionState("assignHeroineSnapshot", {
          projectDirectory: store.paths.projectDirectory,
          heroine,
          project: savedProject,
          validation
        }, { project: savedProject, validation });
      } finally {
        store.close();
      }
    },

    async openProjectForAction(action: Extract<MakerActionId, "openProject" | "reconnectRecentProject">, input: unknown) {
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
        return withActionState(action, {
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          project,
          validation
        }, { project, validation });
      });
    },

    async openProject(input: unknown) {
      return this.openProjectForAction("openProject", input);
    },

    async reconnectRecentProject(input: unknown) {
      return this.openProjectForAction("reconnectRecentProject", input);
    },

    async listRecentProjects() {
      const projects = await recentProjects.listProjects();
      return withActionState("listRecentProjects", {
        projects,
        count: projects.length,
        missingCount: projects.filter((project) => project.missing).length,
        loadedAt: new Date().toISOString(),
        sort: "lastOpenedAtDesc"
      });
    },

    async listProjects() {
      const projects = await recentProjects.listProjects();
      return withActionState("listProjects", {
        projects,
        count: projects.length,
        missingCount: projects.filter((project) => project.missing).length,
        loadedAt: new Date().toISOString(),
        sort: "lastOpenedAtDesc"
      });
    },

    async removeRecentProject(input: unknown) {
      const projectId = optionalProjectId(input);
      if (!projectId) {
        throw new InputValidationError("projectId 입력이 필요합니다.", [{ severity: "error", path: "projectId", message: "비어 있을 수 없습니다." }]);
      }
      const removedProject = await recentProjects.findProject(projectId);
      return withActionState("removeRecentProject", {
        projects: await recentProjects.removeProject(projectId),
        removedProject,
        deletionPolicy: {
          mode: "recentIndexOnly",
          reversible: true,
          impact: ["recentProjectIndex"]
        } satisfies ProjectDeletionPolicyDto
      });
    },

    async removeProject(input: unknown) {
      const projectId = optionalProjectId(input);
      if (!projectId) {
        throw new InputValidationError("projectId 입력이 필요합니다.", [{ severity: "error", path: "projectId", message: "비어 있을 수 없습니다." }]);
      }
      const removedProject = await recentProjects.findProject(projectId);
      return withActionState("removeProject", {
        projects: await recentProjects.removeProject(projectId),
        removedProject,
        deletionPolicy: {
          mode: "recentIndexOnly",
          reversible: true,
          impact: ["projectList", "recentProjectIndex"]
        } satisfies ProjectDeletionPolicyDto
      });
    },

    async deleteProjectWorkspace(input: unknown) {
      const action: Extract<MakerActionId, "deleteProjectWorkspace"> = "deleteProjectWorkspace";
      let projectDirectory = projectDirectoryFrom(input, "");
      let project: VnMakerProject | undefined;
      let resolvedProjectDirectory = projectDirectory;
      try {
        projectDirectory = requiredProjectDirectoryForDelete(input);
        resolvedProjectDirectory = projectDirectory;
        if (!(await projectWorkspaceExists(projectDirectory))) {
          const error = new Error("프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.");
          Object.assign(error, { code: "PROJECT_DIRECTORY_MISSING", projectDirectory });
          throw error;
        }
        const store = await openProjectStore(projectDirectory);
        try {
          project = store.requireProject();
          resolvedProjectDirectory = store.paths.projectDirectory;
          assertProjectDeleteConfirmed(input, project);
        } finally {
          store.close();
        }

        await deleteLocalProjectDirectory(resolvedProjectDirectory);
        const { projects, recentIndexRemoval } = await removeRecentProjectAfterLocalDelete(recentProjects, project.id);
        return withActionState(action, {
          projectDirectory: resolvedProjectDirectory,
          projectId: project.id,
          deletedProject: {
            id: project.id,
            title: project.title
          },
          projects,
          recentIndexRemoval,
          deletionPolicy: {
            mode: "localProjectFiles",
            reversible: false,
            impact: ["projectDirectory", "project.sqlite", "assets", "exports", "cache", "recentProjectIndex"]
          } satisfies ProjectDeletionPolicyDto
        }, { project });
      } catch (error) {
        const enrichedError = attachProjectFailureContext(error, {
          projectDirectory: resolvedProjectDirectory,
          project
        });
        return projectActionFailureFromError(enrichedError, action);
      }
    },

    async restoreRecentProject(input: unknown) {
      const record = asRecord(input);
      const recentProject = asRecord(record.recentProject);
      if (
        typeof recentProject.projectId !== "string"
        || typeof recentProject.projectDirectory !== "string"
        || typeof recentProject.title !== "string"
        || typeof recentProject.lastOpenedAt !== "string"
      ) {
        throw new InputValidationError("recentProject 입력이 필요합니다.", [{ severity: "error", path: "recentProject", message: "복원할 최근 프로젝트 정보가 필요합니다." }]);
      }
      return withActionState("restoreRecentProject", {
        projects: await recentProjects.restoreProject(recentProject as unknown as RecentProjectIndexEntry)
      });
    },

    async restoreProject(input: unknown) {
      const record = asRecord(input);
      const projectListEntry = asRecord(record.projectListEntry || record.recentProject);
      if (
        typeof projectListEntry.projectId !== "string"
        || typeof projectListEntry.projectDirectory !== "string"
        || typeof projectListEntry.title !== "string"
        || typeof projectListEntry.lastOpenedAt !== "string"
      ) {
        throw new InputValidationError("projectListEntry 입력이 필요합니다.", [{ severity: "error", path: "projectListEntry", message: "복원할 프로젝트 목록 항목이 필요합니다." }]);
      }
      return withActionState("restoreProject", {
        projects: await recentProjects.restoreProject(projectListEntry as unknown as RecentProjectIndexEntry)
      });
    },

    async listHeroines(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const capturedAt = new Date().toISOString();
        const heroines = listHeroinesForResponse(store, input).map(heroineListItem);
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          heroines,
          count: heroines.length,
          empty: heroines.length === 0,
          loadedAt: capturedAt,
          sort: "updatedAtDesc",
          libraryRevision: libraryRevisionFor(store.listHeroineEntries(), capturedAt)
        };
      } finally {
        store.close();
      }
    },

    async getHeroine(input: unknown) {
      const heroineId = heroineIdFromAction(input);
      if (typeof heroineId !== "string") {
        return heroineId;
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const heroine = store.getHeroine(heroineId);
        if (!heroine) {
          return heroineFailure(input, "HEROINE_NOT_FOUND", "히로인을 찾을 수 없습니다.");
        }
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          ...withHeroineContract(store, heroineForResponse(store, heroine))
        };
      } finally {
        store.close();
      }
    },

    async createHeroine(input: unknown) {
      const parsed = parseHeroineForAction(input);
      if (isHeroineActionFailure(parsed)) {
        return parsed;
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        if (store.getHeroine(parsed.id)) {
          return heroineFailure(input, "HEROINE_ID_CONFLICT", "이미 같은 히로인 ID가 있습니다.");
        }
        const staged = attachStagedPortrait(parsed, input, store);
        if (isHeroineActionFailure(staged)) {
          return staged;
        }
        const heroine = store.saveHeroine(staged.heroine);
        if (staged.stagedPortraitId) {
          store.consumeStagedPortrait(staged.stagedPortraitId);
        }
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          ...withHeroineContract(store, heroineForResponse(store, heroine))
        };
      } finally {
        store.close();
      }
    },

    async updateHeroine(input: unknown) {
      const parsed = parseHeroineForAction(input);
      if (isHeroineActionFailure(parsed)) {
        return parsed;
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const current = store.getHeroine(parsed.id);
        if (!current) {
          return heroineFailure(input, "HEROINE_NOT_FOUND", "히로인을 찾을 수 없습니다.");
        }
        const expected = requireExpectedRevisionValue(input);
        if (isHeroineActionFailure(expected)) {
          return expected;
        }
        if (expected !== heroineRevisionFor(current).value) {
          return heroineFailure(input, "HEROINE_REVISION_CONFLICT", "다른 변경과 충돌했습니다. 최신 정보를 다시 불러오세요.", { retryable: true });
        }
        const heroine = store.saveHeroine({ ...parsed, id: current.id });
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          ...withHeroineContract(store, heroineForResponse(store, heroine))
        };
      } finally {
        store.close();
      }
    },

    async saveHeroine(input: unknown) {
      const mode = asRecord(input).mode;
      if (mode === "create") {
        return this.createHeroine(input);
      }
      if (mode === "update") {
        return this.updateHeroine(input);
      }
      const parsed = parseHeroineForAction(input);
      if (isHeroineActionFailure(parsed)) {
        return parsed;
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const current = store.getHeroine(parsed.id);
        if (current) {
          const expected = requireExpectedRevisionValue(input);
          if (isHeroineActionFailure(expected)) {
            return expected;
          }
          if (expected !== heroineRevisionFor(current).value) {
            return heroineFailure(input, "HEROINE_REVISION_CONFLICT", "다른 변경과 충돌했습니다. 최신 정보를 다시 불러오세요.", { retryable: true });
          }
        }
        const heroine = store.saveHeroine(current ? { ...parsed, id: current.id } : parsed);
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          ...withHeroineContract(store, heroineForResponse(store, heroine)),
          heroines: listHeroinesForResponse(store).map(heroineListItem)
        };
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
        return { ok: true, projectDirectory: store.paths.projectDirectory, heroine: heroineForResponse(store, heroine), heroines: listHeroinesForResponse(store) };
      } finally {
        store.close();
      }
    },

    async deleteHeroine(input: unknown) {
      const heroineId = heroineIdFromAction(input);
      if (typeof heroineId !== "string") {
        return heroineId;
      }
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const current = store.getHeroine(heroineId);
        if (!current) {
          return heroineFailure(input, "HEROINE_NOT_FOUND", "히로인을 찾을 수 없습니다.");
        }
        const expected = requireExpectedRevisionValue(input);
        if (isHeroineActionFailure(expected)) {
          return expected;
        }
        if (expected !== heroineRevisionFor(current).value) {
          return heroineFailure(input, "HEROINE_REVISION_CONFLICT", "다른 변경과 충돌했습니다. 최신 정보를 다시 불러오세요.", { retryable: true });
        }
        const record = asRecord(input);
        const confirmName = typeof record.confirmName === "string" ? record.confirmName.trim() : "";
        const confirmId = typeof record.confirmId === "string" ? record.confirmId.trim() : "";
        if (confirmName !== current.name || confirmId !== current.id) {
          return heroineFailure(input, "HEROINE_INPUT_INVALID", "삭제 확인값이 히로인과 일치하지 않습니다.", {
            issues: [
              { severity: "error", path: "confirmName", message: "히로인 이름 확인값이 일치해야 합니다." },
              { severity: "error", path: "confirmId", message: "히로인 ID 확인값이 일치해야 합니다." }
            ]
          });
        }
        store.deleteHeroine(heroineId);
        const heroines = listHeroinesForResponse(store).map(heroineListItem);
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          deletedHeroineId: heroineId,
          heroines,
          libraryRevision: libraryRevisionFor(store.listHeroineEntries()),
          snapshotPolicy: "projectSnapshotsPreserved" as const
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
          return withActionState("expandEvent", {
            ok: false,
            projectDirectory: store.paths.projectDirectory,
            request,
            attempts: result.attempts,
            error: result.error,
            validation
          }, { project, validation });
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
        return withActionState("expandEvent", {
          projectDirectory: store.paths.projectDirectory,
          request,
          plan: result.plan,
          validation: result.validation,
          diff: result.validation.diff,
          attempts: result.attempts,
          rawOutput: result.rawOutput,
          patchHistoryEntry
        }, { project, validation: result.validation });
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
        return withActionState("approveEvent", { projectDirectory: store.paths.projectDirectory, ...result }, {
          project: result.project,
          validation: result.validation
        });
      } catch (error) {
        throw attachProjectFailureContext(error, {
          projectDirectory: store.paths.projectDirectory,
          project: store.requireProject()
        });
      } finally {
        store.close();
      }
    },

    async previewProject(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const validation = store.validateAndStore();
        const initialReadiness = previewReadinessFor(project, validation);
        if (!initialReadiness.canRun) {
          return withActionState("previewProject", {
            ok: false,
            code: "PREVIEW_BLOCKED",
            message: initialReadiness.failureCause,
            error: initialReadiness.failureCause,
            projectDirectory: store.paths.projectDirectory,
            validation,
            previewReadiness: initialReadiness
          }, { project, validation });
        }
        let runtime;
        let routeGraphAnalysis;
        try {
          runtime = store.previewProject(typeof record.startSceneId === "string" ? record.startSceneId : undefined);
          routeGraphAnalysis = analyzeRouteGraph(project, typeof record.routeId === "string" ? record.routeId : undefined);
        } catch (error) {
          const validation = store.validateAndStore();
          const previewReadiness = previewReadinessFor(project, validation, {
            state: "failed",
            failureCause: messageFromError(error),
            retryable: true
          });
          return withActionState("previewProject", {
            ok: false,
            code: "SERVER_ERROR",
            message: messageFromError(error),
            error: messageFromError(error),
            projectDirectory: store.paths.projectDirectory,
            validation,
            previewReadiness
          }, { project, validation });
        }
        const previewReadiness = previewReadinessFor(project, runtime.validation);
        if (!previewReadiness.canRun) {
          return withActionState("previewProject", {
            ok: false,
            code: "PREVIEW_BLOCKED",
            message: previewReadiness.failureCause,
            error: previewReadiness.failureCause,
            projectDirectory: store.paths.projectDirectory,
            validation: runtime.validation,
            previewReadiness
          }, { project, validation: runtime.validation });
        }
        return withActionState("previewProject", {
          projectDirectory: store.paths.projectDirectory,
          runtime,
          validation: runtime.validation,
          routeGraphAnalysis,
          previewReadiness
        }, { project, validation: runtime.validation });
      } finally {
        store.close();
      }
    },

    async exportProject(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const validation = store.validateAndStore();
        const blockedPlan = exportPlanFor(project, validation);
        if (blockedPlan.blockers.length > 0) {
          throw attachProjectFailureContext(new ExportBlockedError({
            projectId: project.id,
            projectDirectory: store.paths.projectDirectory,
            message: exportBlockedMessage(validation, blockedPlan),
            issues: validation.issues,
            exportPlan: blockedPlan
          }), { projectDirectory: store.paths.projectDirectory, project, validation, exportPlan: blockedPlan });
        }
        let result;
        try {
          result = await store.exportWebPlayer(typeof record.outputDirectory === "string" ? record.outputDirectory : undefined);
        } catch (error) {
          const failedPlan = exportPlanFor(project, validation, {
            state: "failed",
            failureCause: messageFromError(error),
            retryable: true
          });
          throw attachProjectFailureContext(error, {
            projectDirectory: store.paths.projectDirectory,
            project,
            validation,
            exportPlan: failedPlan
          });
        }
        const exportPlan = exportPlanFor(project, result.smoke.ok ? { ok: true, issues: [] } : { ok: false, issues: [] }, {
          state: result.smoke.ok ? "complete" : "failed",
          failureCause: result.smoke.ok ? undefined : "실행 확인 결과 실패했습니다.",
          retryable: !result.smoke.ok
        });
        return withActionState("exportProject", {
          projectDirectory: store.paths.projectDirectory,
          ...result,
          ok: result.smoke.ok,
          code: result.smoke.ok ? undefined : "SERVER_ERROR",
          message: result.smoke.ok ? undefined : "내보내기 후 실행 확인 결과 실패했습니다.",
          error: result.smoke.ok ? undefined : "내보내기 후 실행 확인 결과 실패했습니다.",
          exportPlan
        }, {
          project,
          validation: result.smoke.ok ? { ok: true, issues: [] } : { ok: false, issues: [] }
        });
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
        const policy = job.kind === "background" ? backgroundPolicy(project) : undefined;
        if (job.kind === "background") {
          project.generationJobs = project.generationJobs.filter((item) => item.kind !== "background" || item.id === job.id);
        }
        const index = project.generationJobs.findIndex((item) => item.id === job.id);
        if (index >= 0) {
          project.generationJobs[index] = job;
        } else {
          project.generationJobs.push(job);
        }
        const savedProject = store.saveProject(project);
        return { ok: true, projectDirectory: store.paths.projectDirectory, job, project: savedProject, ...(policy ? { backgroundPolicy: policy } : {}) };
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
        return withActionState("listGenerationJobs", { projectDirectory: store.paths.projectDirectory, jobs, backgroundPolicy: backgroundPolicy(project) }, { project });
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
        const failure = errors.length > 0 ? imageGenerationFailureFromMessages(errors) : null;
        return withActionState("runGenerationJobs", {
          ok: errors.length === 0,
          ...(failure || {}),
          projectDirectory: store.paths.projectDirectory,
          jobs,
          assets,
          errors,
          project: store.requireProject(),
          backgroundPolicy: backgroundPolicy(store.requireProject())
        }, { project: store.requireProject() });
      } finally {
        store.close();
      }
    },

    async generateHeroinePortrait(input: unknown) {
      if (!options.image) {
        return heroineFailure(input, "IMAGE_GENERATION_UNAVAILABLE", "이미지 생성 adapter가 설정되지 않았습니다.", { retryable: true });
      }
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const requestedHeroineId = typeof record.heroineId === "string" && record.heroineId.trim()
          ? record.heroineId.trim()
          : "";
        const existingHeroine = requestedHeroineId ? store.getHeroine(requestedHeroineId) : null;
        if (requestedHeroineId && !existingHeroine) {
          return heroineFailure(input, "HEROINE_NOT_FOUND", "히로인을 찾을 수 없습니다.");
        }
        const draftInput = record.draft || record.heroine;
        const parsedDraft = existingHeroine
          ? existingHeroine
          : draftInput
            ? parseHeroineForAction({ ...asRecord(input), heroine: draftInput })
            : heroineFailure(input, "HEROINE_INPUT_INVALID", "포트레이트를 생성할 히로인 정보가 필요합니다.", {
                issues: [{ severity: "error", path: "draft", message: "heroineId 또는 draft 입력이 필요합니다." }]
              });
        if (isHeroineActionFailure(parsedDraft)) {
          return parsedDraft;
        }

        const expected = existingHeroine ? requireExpectedRevisionValue(input) : undefined;
        if (isHeroineActionFailure(expected)) {
          return expected;
        }
        if (existingHeroine && expected !== heroineRevisionFor(existingHeroine).value) {
          return heroineFailure(input, "HEROINE_REVISION_CONFLICT", "다른 변경과 충돌했습니다. 최신 정보를 다시 불러오세요.", { retryable: true });
        }

        const generationInput = selectGenerationInput(project, store, {
          ...record,
          kind: "portrait",
          heroine: parsedDraft
        });
        let result: ProjectImageGenerationResult;
        try {
          result = withWorkspacePreviewUri(await options.image.generateImageAsset(generationInput));
        } catch (error) {
          return heroineImageGenerationFailure(input, error);
        }
        await store.storeGenerationResult(result);

        if (existingHeroine) {
          const portraitAssetIds = [...new Set([result.asset.id, ...existingHeroine.portraitAssetIds])];
          const heroine = store.saveHeroine({
            ...existingHeroine,
            defaultPortraitAssetId: result.asset.id,
            portraitAssetIds
          });
          return {
            ok: true,
            projectDirectory: store.paths.projectDirectory,
            ...withHeroineContract(store, heroineForResponse(store, heroine)),
            asset: result.asset,
            generationState: "completed" as const
          };
        }

        const stagedPortrait = store.saveStagedPortrait({
          id: `staged-${randomUUID()}`,
          assetId: result.asset.id,
          heroineId: parsedDraft.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        });

        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          asset: result.asset,
          stagedPortraitRef: {
            id: stagedPortrait.id,
            expiresAt: stagedPortrait.expiresAt,
            previewUri: result.image?.dataUrl || result.image?.uri || result.asset.uri
          },
          generationState: "completed" as const
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
          return {
            ok: true,
            projectDirectory: store.paths.projectDirectory,
            project: savedProject,
            ...result,
            ...(result.asset.kind === "background" ? { backgroundPolicy: backgroundPolicy(savedProject) } : {})
          };
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
