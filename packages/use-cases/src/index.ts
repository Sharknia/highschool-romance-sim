import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  DEFAULT_EMOTION_TAGS,
  DEFAULT_HEROINE_PORTRAIT_STYLE,
  analyzeProjectReadiness,
  analyzeRouteGraph,
  buildProjectHtml,
  conditionEvaluationTraceForProject,
  conditionRuntimeSupportForProject,
  createAssetManifest,
  createBlankProject,
  createDeterministicEventExpansionPlan,
  createEventExpansionRequest,
  createHeroineProfile,
  createHeroinePortraitPrompt,
  createImageGenerationJob,
  createPreviewPreflight,
  createProjectRevision,
  createStudioIssueFocus,
  createStudioViewModel,
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
  upsertProjectScene,
  validateEventExpansionPlan,
  validateProject as validateProjectSnapshot,
  UX_DECISION_HELP_CHANNELS,
  UX_DECISION_EVENT_NAMES,
  type CreateImageGenerationJobInput,
  type CreateStarterProjectInput,
  type ConditionEvaluationTraceDto,
  type ConditionRuntimeSupportDto,
  type DtoParseResult,
  type EventExpansionPlan,
  type EventExpansionRequest,
  type EventExpansionValidationResult,
  type Phase0Decision,
  type Phase0DecisionReportDto,
  type Phase0DenominatorDto,
  type Phase0MetricDto,
  type Phase0ParticipantResultDto,
  type Phase0SessionEvidenceDto,
  type Phase0TaskInputMode,
  type Phase0WorkPackageStatus,
  type Phase0WorkPackageStatusDto,
  type GenerationFailureClassification,
  type GenerationResultClassification,
  type GenerationResultLogDto,
  type GenerationResultSourceType,
  type HeroineProfile,
  type PreviewPreflightDto,
  type ProjectPatchDescription,
  type ProjectActionEventDto,
  type ProjectRevisionDto,
  type StudioViewModelDto,
  type TestPromptFixtureDto,
  type TestPromptSetDto,
  type UXDecisionEventDto,
  type UXDecisionEventLogExportDto,
  type UXDecisionEventName,
  type UXDecisionHelpChannel,
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
  StaleProjectRevisionError,
  type PatchHistoryEntry,
  type RecentProjectIndexEntry,
  type RecentProjectValidationState,
  type ProjectStore,
  type ProjectRevisionInput,
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
  | "PORTRAIT_QUALITY_FAILED"
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
  fallbackReason?: "OAUTH_REQUIRED" | "IMAGE_GENERATION_UNAVAILABLE" | string;
}

export interface ProjectImageGenerationResult {
  adapter?: string;
  dummy?: boolean;
  fallbackReason?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
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
    quality?: {
      hasAlpha?: boolean;
      transparentBackground?: boolean;
      width?: number;
      height?: number;
      issues?: string[];
    };
  };
  raw?: unknown;
}

export interface ProjectImageGenerationAdapter {
  generateImageAsset(input: ProjectImageGenerationInput): Promise<ProjectImageGenerationResult>;
}

export const FIXED_PROMPT_SET_ID = "phase0-studio-fixed-prompts-v1";

const FIXED_PROMPT_SET_VERSION = "1.0.0";
export const GENERATION_FAILURE_CLASSIFICATIONS: GenerationFailureClassification[] = [
  "generation_quality",
  "validation_model",
  "repair_ux",
  "preview_runtime",
  "participant_understanding"
];
const FIXED_PROMPT_FIXTURES: TestPromptFixtureDto[] = [
  {
    promptSetId: FIXED_PROMPT_SET_ID,
    promptId: "library-hands-overlap-normal-ending",
    promptText: "도서관에서 책을 줍다가 손이 겹치고 둘 다 당황하지만, 마지막에는 서로 웃으며 노멀 엔딩으로 끝나는 짧은 이벤트를 만들어줘. 씬은 3개, 선택지는 1개, CG는 1개만 사용해줘.",
    expectedElements: ["도서관", "손이 겹침", "당황", "노멀 엔딩", "CG 1개"],
    allowedVariation: ["장면 라벨", "대사 표현", "선택지 문구", "CG 프롬프트 세부 묘사"]
  },
  {
    promptSetId: FIXED_PROMPT_SET_ID,
    promptId: "rainy-classroom-shared-umbrella",
    promptText: "비 오는 방과 후 교실에서 우산을 같이 쓰기로 약속하고, 짧은 선택 뒤 노멀 엔딩으로 끝나는 설레는 이벤트를 만들어줘. 씬은 3개, 선택지는 1개, CG는 1개만 사용해줘.",
    expectedElements: ["비 오는 방과 후", "교실", "우산 약속", "선택지 1개", "노멀 엔딩"],
    allowedVariation: ["날씨 묘사", "교실 소품", "선택지 문구", "엔딩 제목"]
  },
  {
    promptSetId: FIXED_PROMPT_SET_ID,
    promptId: "festival-cleanup-confession",
    promptText: "문화제 정리 시간에 둘만 남아 고마움을 전하고, 가벼운 고백 직전의 여운으로 노멀 엔딩에 도달하는 이벤트를 만들어줘. 씬은 3개, 선택지는 1개, CG는 1개만 사용해줘.",
    expectedElements: ["문화제 정리", "둘만 남음", "고마움", "고백 직전의 여운", "노멀 엔딩"],
    allowedVariation: ["문화제 부스 종류", "대사 톤", "감정선 속도", "CG 연출"]
  }
];

export const PHASE0_WORK_PACKAGES: Array<{ id: string; label: string }> = [
  { id: "alpha-input", label: "Alpha input" },
  { id: "generation-summary", label: "generation summary" },
  { id: "studio-guided-recipe", label: "Studio guided recipe" },
  { id: "problems-repair", label: "Problems repair" },
  { id: "preview-preflight", label: "Preview preflight" },
  { id: "event-log-export", label: "Event log export" },
  { id: "participant-protocol", label: "participant screening protocol" },
  { id: "fixed-free-separation", label: "fixed/free input separation" },
  { id: "decision-thresholds", label: "Go/Iterate/Stop threshold report" }
];

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
  | "validateProject"
  | "getStudioContext"
  | "applyStudioMutation"
  | "expandEvent"
  | "approveEvent"
  | "listFixedPrompts"
  | "replayFixedPrompt"
  | "listGenerationResultLogs"
  | "recordUXDecisionEvent"
  | "listUXDecisionEvents"
  | "exportUXDecisionEventLog"
  | "createPhase0DecisionReport"
  | "listGenerationJobs"
  | "runGenerationJobs"
  | "previewPreflightProject"
  | "previewProject"
  | "previewRepair"
  | "applyRepair"
  | "undoRepair"
  | "undoPatch"
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
  conditionRuntimeSupport: ConditionRuntimeSupportDto;
  conditionEvaluationTrace: ConditionEvaluationTraceDto;
  validationSummary: {
    ok: boolean;
    issueCount: number;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  includedData: Array<"project" | "runtime" | "assetManifest">;
  includedAssets: Array<Pick<VnMakerAsset, "id" | "kind" | "label" | "uri" | "source" | "generationJobId" | "provenance">>;
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

export interface RepairActionRequiredInputDto {
  name: string;
  label: string;
  inputType: "text" | "select";
  options?: Array<{ value: string; label: string }>;
}

export interface RepairActionExpectedTargetDto {
  targetPath: string;
  sceneIds?: string[];
  choiceIds?: string[];
  targetSceneId?: string;
}

export interface RepairActionPreflightBlockerDto {
  issueCode: string;
  path: string;
  sceneIds?: string[];
  choiceIds?: string[];
  targetSceneId?: string;
  repairActionIds: string[];
}

export interface RepairActionDto {
  actionId: "create-target-scene" | "connect-existing-scene" | "set-scene-ending" | "remove-next";
  issueCode: string;
  targetPath: string;
  label: string;
  description: string;
  destructive: boolean;
  requiresConfirmation: boolean;
  requiredInputs: RepairActionRequiredInputDto[];
  disabledReason: string | null;
  expectedTarget: RepairActionExpectedTargetDto;
  preflightBlocker: RepairActionPreflightBlockerDto;
}

export interface RepairDiffEntryDto {
  op: "add" | "remove" | "replace";
  path: string;
  before: unknown;
  after: unknown;
  humanLabel: string;
}

export interface RepairPreviewDto {
  actionId: RepairActionDto["actionId"];
  issueCode: string;
  targetPath: string;
  beforeRevision: ProjectRevisionDto;
  expectedAfterSummary: string;
  diff: RepairDiffEntryDto[];
  destructiveWarnings: string[];
  confirmToken: string;
  repairAction: RepairActionDto;
}

export interface RepairHistoryEntryDto {
  id: string;
  actionId: string;
  issueCode: string;
  beforeRevision: ProjectRevisionDto;
  afterRevision: ProjectRevisionDto;
  appliedAt: string;
  revertedAt?: string;
}

export interface StudioProblemActionDto {
  actionId: string;
  issueId: string;
  issueCode: string;
  targetPath: string;
  label: string;
  disabledReason: string | null;
  destructive: boolean;
  requiresPreflight: boolean;
  expectedProjectRevision: ProjectRevisionDto;
}

export type StudioMutationOperation =
  | { type: "upsertScene"; scene: VnMakerScene }
  | { type: "deleteScene"; sceneId: string; mode?: "failIfReferenced" | "unlinkReferences" }
  | { type: "duplicateScene"; sourceSceneId: string; newSceneId?: string; label?: string }
  | { type: "deleteChoice"; sceneId: string; choiceId: string }
  | { type: "duplicateChoice"; sceneId: string; choiceId: string; newChoiceId?: string; text?: string }
  | { type: "reorderChoice"; sceneId: string; choiceId: string; toIndex: number }
  | { type: "clearChoiceTarget"; sceneId: string; choiceId: string }
  | { type: "unlinkSceneTarget"; sourceSceneId: string; targetSceneId: string; edgeType?: "next" | "choice" | "all" }
  | { type: "setRouteEntry"; routeId: string; sceneId: string };

export interface StudioDraftSaveInput {
  projectDirectory?: string;
  expectedProjectRevision: ProjectRevisionInput;
  routeId?: string;
  sceneId?: string;
  operations: StudioMutationOperation[];
}

export interface StudioMutationResultDto {
  ok: true;
  projectDirectory: string;
  project: VnMakerProject;
  previousRevision: ProjectRevisionDto;
  projectRevision: ProjectRevisionDto;
  validation: {
    ok: boolean;
    issues: ValidationIssue[];
  };
  studio: StudioViewModelDto;
  selectedRouteId?: string;
  selectedSceneId?: string;
  appliedOperations: string[];
}

export interface UndoRepairInput {
  repairHistoryId?: string;
  undoToken?: string;
}

export type ProjectActionFailureCode =
  | "PROJECT_INPUT_INVALID"
  | "PROJECT_ID_RESERVED"
  | "PROJECT_ID_CONFLICT"
  | "PROJECT_NOT_FOUND"
  | "RECENT_PROJECT_INDEX_MISS"
  | "PROJECT_DIRECTORY_MISSING"
  | "PROJECT_ID_MISMATCH"
  | "STALE_PROJECT_REVISION"
  | "PROJECT_REVISION_CONFLICT"
  | "HEROINE_REQUIRED"
  | "HEROINE_REPLACE_BLOCKED"
  | "PATCH_STALE"
  | "JOB_ALREADY_RUNNING"
  | "PREVIEW_BLOCKED"
  | "EXPORT_BLOCKED"
  | "OAUTH_REQUIRED"
  | "IMAGE_GENERATION_UNAVAILABLE"
  | "SERVER_ERROR";

export interface ProjectActionFailureDto {
  ok: false;
  action?: MakerActionId;
  code: ProjectActionFailureCode;
  message: string;
  error: string;
  nextAction: string;
  requestId: string;
  correlationId?: string;
  projectId?: string;
  projectDirectory?: string;
  expectedProjectId?: string;
  actualProjectId?: string;
  expectedRevision?: string;
  actualRevision?: ProjectRevisionDto;
  workflowSummary?: MakerWorkflowSummary;
  previewReadiness?: ProjectPreviewReadinessDto;
  previewPreflight?: PreviewPreflightDto;
  repairActions?: RepairActionDto[];
  exportPlan?: ProjectExportPlanDto;
  actionEvent?: ProjectActionEventDto;
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
  STALE_PROJECT_REVISION: {
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
  IMAGE_GENERATION_UNAVAILABLE: {
    message: "현재 Codex app-server가 이미지 생성 기능을 제공하지 않습니다.",
    nextAction: "설정에서 Codex 연결과 이미지 생성 가능 상태를 확인하세요.",
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
  imageFallback?: ProjectImageGenerationAdapter;
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

function createCorrelationId(action: MakerActionId): string {
  return `corr-${action}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function createUXDecisionEventId(): string {
  return `uxevent-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function createUXDecisionEventLogId(projectId: string, sessionId: string): string {
  return `uxlog-${projectId}-${sessionId}`.replace(/[^A-Za-z0-9._:-]/g, "-");
}

function cloneFixedPromptFixture(fixture: TestPromptFixtureDto): TestPromptFixtureDto {
  return {
    ...fixture,
    expectedElements: [...fixture.expectedElements],
    allowedVariation: [...fixture.allowedVariation]
  };
}

function fixedPromptSetDto(): TestPromptSetDto {
  return {
    id: FIXED_PROMPT_SET_ID,
    version: FIXED_PROMPT_SET_VERSION,
    label: "Studio Phase 0 fixed prompt set",
    fixtures: FIXED_PROMPT_FIXTURES.map(cloneFixedPromptFixture)
  };
}

function fixedPromptById(promptId: unknown): TestPromptFixtureDto {
  const id = typeof promptId === "string" && promptId.trim()
    ? promptId.trim()
    : FIXED_PROMPT_FIXTURES[0].promptId;
  const fixture = FIXED_PROMPT_FIXTURES.find((item) => item.promptId === id);
  if (!fixture) {
    throw new InputValidationError("fixed prompt를 찾을 수 없습니다.", [{
      severity: "error",
      path: "promptId",
      message: `지원하지 않는 fixed prompt입니다: ${id}`
    }]);
  }
  return cloneFixedPromptFixture(fixture);
}

function fixedPromptAdapterMode(input: unknown): "mock" | "actual" {
  const mode = asRecord(input).adapterMode;
  return mode === "actual" ? "actual" : "mock";
}

function createGenerationResultId(): string {
  return `generation-result-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
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

function readinessBlockersFor(project: VnMakerProject, target: "preview" | "export"): ProjectExportPlanDto["blockers"] {
  return analyzeProjectReadiness(project, target).issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => ({
      kind: "requiredData" as const,
      id: issue.assetId,
      message: issue.message,
      tab: issue.tab === "export" ? "export" : issue.tab === "preview" ? "studio" : issue.tab
    }));
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
    ...readinessBlockersFor(project, "export"),
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
  const conditionRuntimeSupport = conditionRuntimeSupportForProject(project, {
    previewPreflightSuccess: blockers.length === 0
  });
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
    conditionRuntimeSupport,
    conditionEvaluationTrace: conditionEvaluationTraceForProject(project),
    validationSummary,
    includedData: ["project", "runtime", "assetManifest"],
    includedAssets: project.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      label: asset.label,
      uri: asset.uri,
      source: asset.source,
      generationJobId: asset.generationJobId,
      provenance: asset.provenance
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

function validationForProjectState(project: VnMakerProject, validation?: { ok?: boolean; issues?: ValidationIssue[] }): { ok: boolean; issues: ValidationIssue[] } {
  if (validation) {
    const issues = validation.issues || [];
    return {
      ok: validation.ok !== false && issues.every((issue) => issue.severity !== "error"),
      issues
    };
  }
  const issues = validateProjectSnapshot(project);
  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

function sceneLabelForRepair(project: VnMakerProject, sceneId: string): string {
  const scene = project.scenes.find((item) => item.id === sceneId);
  return scene?.label || scene?.id || sceneId;
}

function sceneForIssue(project: VnMakerProject, issue: ValidationIssue): VnMakerScene | undefined {
  const sceneId = issue.sceneIds?.[0];
  return sceneId ? project.scenes.find((scene) => scene.id === sceneId) : undefined;
}

function repairExpectedTarget(issue: ValidationIssue): RepairActionExpectedTargetDto {
  return {
    targetPath: issue.path,
    sceneIds: issue.sceneIds ? [...issue.sceneIds] : undefined,
    choiceIds: issue.choiceIds ? [...issue.choiceIds] : undefined,
    targetSceneId: issue.targetSceneId
  };
}

function repairPreflightBlockerFor(issue: ValidationIssue, preflight?: PreviewPreflightDto): RepairActionPreflightBlockerDto {
  const matchedBlocker = preflight?.blockers.find((blocker) => blocker.issueCode === issue.code && blocker.path === issue.path);
  return {
    issueCode: matchedBlocker?.issueCode || issue.code || "validation-issue",
    path: matchedBlocker?.path || issue.path,
    sceneIds: matchedBlocker?.sceneIds ? [...matchedBlocker.sceneIds] : issue.sceneIds ? [...issue.sceneIds] : undefined,
    choiceIds: matchedBlocker?.choiceIds ? [...matchedBlocker.choiceIds] : issue.choiceIds ? [...issue.choiceIds] : undefined,
    targetSceneId: matchedBlocker?.targetSceneId || issue.targetSceneId,
    repairActionIds: matchedBlocker?.repairActionIds ? [...matchedBlocker.repairActionIds] : []
  };
}

function createTargetSceneRepairAction(issue: ValidationIssue, preflight?: PreviewPreflightDto): RepairActionDto {
  return {
    actionId: "create-target-scene",
    issueCode: issue.code || "missing-target",
    targetPath: issue.path,
    label: "타깃 씬 만들기",
    description: `${issue.targetSceneId || "누락된 타깃"}으로 연결할 새 씬을 만듭니다.`,
    destructive: false,
    requiresConfirmation: false,
    requiredInputs: [{ name: "sceneLabel", label: "새 씬 이름", inputType: "text" }],
    disabledReason: null,
    expectedTarget: repairExpectedTarget(issue),
    preflightBlocker: repairPreflightBlockerFor(issue, preflight)
  };
}

function connectExistingSceneRepairAction(project: VnMakerProject, issue: ValidationIssue, preflight?: PreviewPreflightDto): RepairActionDto {
  const sourceSceneIds = new Set(issue.sceneIds || []);
  const options = project.scenes
    .filter((scene) => !sourceSceneIds.has(scene.id))
    .map((scene) => ({ value: scene.id, label: sceneLabelForRepair(project, scene.id) }));
  return {
    actionId: "connect-existing-scene",
    issueCode: issue.code || "missing-target",
    targetPath: issue.path,
    label: "기존 씬에 연결",
    description: "없는 타깃 대신 프로젝트의 기존 씬을 선택지 또는 다음 장면에 연결합니다.",
    destructive: false,
    requiresConfirmation: false,
    requiredInputs: [{ name: "existingSceneId", label: "연결할 기존 씬", inputType: "select", options }],
    disabledReason: options.length > 0 ? null : "연결할 기존 씬이 없습니다.",
    expectedTarget: repairExpectedTarget(issue),
    preflightBlocker: repairPreflightBlockerFor(issue, preflight)
  };
}

function setSceneEndingRepairAction(issue: ValidationIssue, preflight?: PreviewPreflightDto): RepairActionDto {
  return {
    actionId: "set-scene-ending",
    issueCode: issue.code || "uncovered-terminal",
    targetPath: issue.path,
    label: "엔딩 지정",
    description: "엔딩 없이 끝나는 씬에 엔딩 정보를 추가합니다.",
    destructive: false,
    requiresConfirmation: false,
    requiredInputs: [
      { name: "endingTitle", label: "엔딩 제목", inputType: "text" },
      {
        name: "endingKind",
        label: "엔딩 종류",
        inputType: "select",
        options: [
          { value: "normal", label: "일반 엔딩" },
          { value: "good", label: "굿 엔딩" },
          { value: "bad", label: "배드 엔딩" }
        ]
      }
    ],
    disabledReason: null,
    expectedTarget: repairExpectedTarget(issue),
    preflightBlocker: repairPreflightBlockerFor(issue, preflight)
  };
}

function removeNextRepairAction(project: VnMakerProject, issue: ValidationIssue, preflight?: PreviewPreflightDto): RepairActionDto {
  const scene = sceneForIssue(project, issue);
  return {
    actionId: "remove-next",
    issueCode: issue.code || "validation-issue",
    targetPath: issue.path,
    label: "next 연결 제거",
    description: "충돌을 만드는 다음 장면 연결을 제거합니다.",
    destructive: true,
    requiresConfirmation: true,
    requiredInputs: [],
    disabledReason: scene?.next ? null : "제거할 next 연결이 없습니다.",
    expectedTarget: repairExpectedTarget(issue),
    preflightBlocker: repairPreflightBlockerFor(issue, preflight)
  };
}

function repairActionsForValidation(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  preflight?: PreviewPreflightDto
): RepairActionDto[] {
  const actions: RepairActionDto[] = [];
  (validation.issues || []).forEach((issue) => {
    if (issue.severity !== "error") {
      return;
    }
    if (issue.code === "missing-target") {
      actions.push(createTargetSceneRepairAction(issue, preflight));
      actions.push(connectExistingSceneRepairAction(project, issue, preflight));
      return;
    }
    if (issue.code === "uncovered-terminal") {
      actions.push(setSceneEndingRepairAction(issue, preflight));
      return;
    }
    if (issue.code === "mixed-outgoing" || issue.code === "ending-has-outgoing") {
      actions.push(removeNextRepairAction(project, issue, preflight));
    }
  });
  return actions;
}

function studioProblemActionsFor(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  preflight: PreviewPreflightDto,
  projectRevision: ProjectRevisionDto
): StudioProblemActionDto[] {
  return repairActionsForValidation(project, validation, preflight).map((action) => {
    const sourceIssue = (validation.issues || []).find((issue) =>
      issue.severity === "error" && issue.code === action.issueCode && issue.path === action.targetPath
    );
    const focus = sourceIssue
      ? createStudioIssueFocus(project, sourceIssue)
      : createStudioIssueFocus(project, {
        issueCode: action.issueCode,
        path: action.targetPath,
        message: action.description,
        sceneIds: action.expectedTarget.sceneIds,
        choiceIds: action.expectedTarget.choiceIds,
        targetSceneId: action.expectedTarget.targetSceneId,
        repairActionIds: [action.actionId]
      }, { severity: "error" });
    return {
      actionId: action.actionId,
      issueId: focus.issueId,
      issueCode: action.issueCode,
      targetPath: action.targetPath,
      label: action.label,
      disabledReason: action.disabledReason,
      destructive: action.destructive,
      requiresPreflight: true,
      expectedProjectRevision: projectRevision
    };
  });
}

interface RepairActionRequest {
  actionId: RepairActionDto["actionId"];
  issueCode: string;
  targetPath: string;
  inputs: JsonRecord;
}

interface RepairMutationPreview {
  project: VnMakerProject;
  diff: RepairDiffEntryDto[];
  expectedAfterSummary: string;
  destructiveWarnings: string[];
}

function cloneProject(project: VnMakerProject): VnMakerProject {
  return JSON.parse(JSON.stringify(project)) as VnMakerProject;
}

function validationSnapshotForProject(project: VnMakerProject): { ok: boolean; issues: ValidationIssue[] } {
  const issues = validateProjectSnapshot(project);
  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

function repairActionRequestFrom(input: unknown): RepairActionRequest {
  const record = asRecord(input);
  const actionRecord = asRecord(record.repairAction);
  const actionId = String(actionRecord.actionId || record.actionId || "");
  const issueCode = String(actionRecord.issueCode || record.issueCode || "");
  const targetPath = String(actionRecord.targetPath || record.targetPath || "");
  const inputs = asRecord(actionRecord.inputs || record.inputs);
  if (!["create-target-scene", "connect-existing-scene", "set-scene-ending", "remove-next"].includes(actionId)) {
    throw new InputValidationError("지원하지 않는 repair action입니다.", [{ severity: "error", path: "repairAction.actionId", message: "지원하지 않는 repair action입니다." }]);
  }
  if (!issueCode) {
    throw new InputValidationError("repair action issueCode 입력이 필요합니다.", [{ severity: "error", path: "repairAction.issueCode", message: "비어 있을 수 없습니다." }]);
  }
  if (!targetPath) {
    throw new InputValidationError("repair action targetPath 입력이 필요합니다.", [{ severity: "error", path: "repairAction.targetPath", message: "비어 있을 수 없습니다." }]);
  }
  return {
    actionId: actionId as RepairActionDto["actionId"],
    issueCode,
    targetPath,
    inputs
  };
}

function repairIssueForRequest(validation: { issues?: ValidationIssue[] }, request: RepairActionRequest): ValidationIssue {
  const issue = (validation.issues || []).find((candidate) =>
    candidate.code === request.issueCode && candidate.path === request.targetPath && candidate.severity === "error"
  );
  if (!issue) {
    throw new InputValidationError("repair action에 연결된 validation issue를 찾을 수 없습니다.", [{
      severity: "error",
      path: "repairAction",
      message: "현재 검증 결과와 repair action이 일치하지 않습니다."
    }]);
  }
  return issue;
}

function repairActionCandidateForRequest(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  preflight: PreviewPreflightDto,
  request: RepairActionRequest
): RepairActionDto {
  const action = repairActionsForValidation(project, validation, preflight).find((candidate) =>
    candidate.actionId === request.actionId && candidate.issueCode === request.issueCode && candidate.targetPath === request.targetPath
  );
  if (!action) {
    throw new InputValidationError("현재 issue에는 적용 가능한 repair action 후보가 없습니다.", [{
      severity: "error",
      path: "repairAction",
      message: "지원하지 않는 issue이거나 최신 검증 결과와 다릅니다."
    }]);
  }
  if (action.disabledReason) {
    throw new InputValidationError(action.disabledReason, [{
      severity: "error",
      path: "repairAction.disabledReason",
      message: action.disabledReason
    }]);
  }
  return action;
}

function sceneForRepairRequest(project: VnMakerProject, issue: ValidationIssue): VnMakerScene {
  const scene = sceneForIssue(project, issue);
  if (!scene) {
    throw new InputValidationError("repair 대상 scene을 찾을 수 없습니다.", [{
      severity: "error",
      path: issue.path,
      message: "repair 대상 scene을 찾을 수 없습니다.",
      sceneIds: issue.sceneIds
    }]);
  }
  return scene;
}

function repairInputString(inputs: JsonRecord, name: string): string {
  const value = inputs[name];
  return typeof value === "string" ? value.trim() : "";
}

function assertExpectedProjectRevision(store: ProjectStore, expectedProjectRevision: ProjectRevisionInput): ProjectRevisionDto {
  const actualRevision = store.getProjectRevision();
  const expectedRevision = typeof expectedProjectRevision === "string" ? expectedProjectRevision : expectedProjectRevision.revision;
  if (expectedRevision !== actualRevision.revision) {
    throw new StaleProjectRevisionError({ expectedRevision, actualRevision });
  }
  return actualRevision;
}

function routeEntryForMissingTarget(project: VnMakerProject, issue: ValidationIssue): { route: VnMakerProject["routes"][number]; routeIndex: number } | null {
  const routeIndex = project.routes.findIndex((route) => route.entrySceneId === issue.targetSceneId);
  if (routeIndex < 0) {
    return null;
  }
  return { route: project.routes[routeIndex], routeIndex };
}

function applyRepairMutationToProject(project: VnMakerProject, request: RepairActionRequest, issue: ValidationIssue): RepairMutationPreview {
  const nextProject = cloneProject(project);

  if (request.actionId === "remove-next") {
    const scene = sceneForRepairRequest(nextProject, issue);
    const before = scene.next || null;
    scene.next = undefined;
    return {
      project: nextProject,
      diff: [{
        op: "remove",
        path: `${issue.path}.next`,
        before,
        after: null,
        humanLabel: `${sceneLabelForRepair(project, scene.id)}의 next 연결 제거`
      }],
      expectedAfterSummary: "충돌을 만드는 next 연결을 제거하고 검증을 다시 계산합니다.",
      destructiveWarnings: ["다음 장면 자동 연결이 제거됩니다."]
    };
  }

  if (request.actionId === "set-scene-ending") {
    const scene = sceneForRepairRequest(nextProject, issue);
    const endingTitle = repairInputString(request.inputs, "endingTitle") || "새 엔딩";
    const endingKind = repairInputString(request.inputs, "endingKind") || "normal";
    const before = scene.ending || null;
    const ending = endingFromInput(nextProject, scene.id, {
      title: endingTitle,
      kind: endingKind
    });
    scene.ending = ending;
    return {
      project: nextProject,
      diff: [{
        op: before ? "replace" : "add",
        path: `${issue.path}.ending`,
        before,
        after: ending || null,
        humanLabel: `${sceneLabelForRepair(project, scene.id)}에 엔딩 지정`
      }],
      expectedAfterSummary: "엔딩 없이 끝나는 씬에 엔딩 정보를 추가하고 검증을 다시 계산합니다.",
      destructiveWarnings: []
    };
  }

  if (request.actionId === "connect-existing-scene") {
    const existingSceneId = repairInputString(request.inputs, "existingSceneId");
    const targetScene = nextProject.scenes.find((candidate) => candidate.id === existingSceneId);
    if (!targetScene) {
      throw new InputValidationError("연결할 기존 씬을 찾을 수 없습니다.", [{
        severity: "error",
        path: "inputs.existingSceneId",
        message: "연결할 기존 씬을 찾을 수 없습니다."
      }]);
    }
    const scene = sceneForIssue(nextProject, issue);
    if (!scene) {
      const routeEntry = routeEntryForMissingTarget(nextProject, issue);
      if (!routeEntry) {
        throw new InputValidationError("repair 대상 route entry를 찾을 수 없습니다.", [{
          severity: "error",
          path: issue.path,
          message: "repair 대상 route entry를 찾을 수 없습니다.",
          targetSceneId: issue.targetSceneId
        }]);
      }
      const before = routeEntry.route.entrySceneId || null;
      routeEntry.route.entrySceneId = targetScene.id;
      return {
        project: nextProject,
        diff: [{
          op: "replace",
          path: `routes.${routeEntry.routeIndex}.entrySceneId`,
          before,
          after: targetScene.id,
          humanLabel: `${routeEntry.route.title || routeEntry.route.id} 시작 씬을 기존 씬에 연결`
        }],
        expectedAfterSummary: "없는 route entry target 대신 기존 씬을 연결하고 검증을 다시 계산합니다.",
        destructiveWarnings: []
      };
    }
    const choiceId = issue.choiceIds?.[0];
    const choice = choiceId ? scene.choices.find((candidate) => candidate.id === choiceId) : undefined;
    if (choice) {
      const before = choice.next || null;
      choice.next = targetScene.id;
      return {
        project: nextProject,
        diff: [{
          op: "replace",
          path: `${issue.path}.next`,
          before,
          after: targetScene.id,
          humanLabel: `${choice.text || choice.id} 선택지를 기존 씬에 연결`
        }],
        expectedAfterSummary: "없는 target 대신 기존 씬을 연결하고 검증을 다시 계산합니다.",
        destructiveWarnings: []
      };
    }
    const before = scene.next || null;
    scene.next = targetScene.id;
    return {
      project: nextProject,
      diff: [{
        op: "replace",
        path: `${issue.path}.next`,
        before,
        after: targetScene.id,
        humanLabel: `${sceneLabelForRepair(project, scene.id)}의 next를 기존 씬에 연결`
      }],
      expectedAfterSummary: "없는 target 대신 기존 씬을 연결하고 검증을 다시 계산합니다.",
      destructiveWarnings: []
    };
  }

  const targetSceneId = issue.targetSceneId || repairInputString(request.inputs, "sceneId");
  if (!targetSceneId) {
    throw new InputValidationError("생성할 target scene id를 결정할 수 없습니다.", [{
      severity: "error",
      path: "repairAction.targetSceneId",
      message: "생성할 target scene id를 결정할 수 없습니다."
    }]);
  }
  const sceneLabel = repairInputString(request.inputs, "sceneLabel") || targetSceneId;
  const newScene = requireParsed(parseVnMakerScene({
    id: targetSceneId,
    label: sceneLabel,
    speaker: "",
    text: "",
    characters: [],
    choices: []
  }), "scene");
  nextProject.scenes.push(newScene);
  return {
    project: nextProject,
    diff: [{
      op: "add",
      path: `scenes.${nextProject.scenes.length - 1}`,
      before: null,
      after: newScene,
      humanLabel: `${sceneLabel} 씬 생성`
    }],
    expectedAfterSummary: "누락된 target 씬을 생성하고 검증을 다시 계산합니다.",
    destructiveWarnings: []
  };
}

function repairConfirmToken(input: {
  actionId: string;
  issueCode: string;
  targetPath: string;
  beforeRevision: ProjectRevisionDto;
  diff: RepairDiffEntryDto[];
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
}

function repairPreviewFor(
  project: VnMakerProject,
  projectRevision: ProjectRevisionDto,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  request: RepairActionRequest
): RepairPreviewDto {
  const preflight = createPreviewPreflight(project, validation, projectRevision);
  const issue = repairIssueForRequest(validation, request);
  const repairAction = repairActionCandidateForRequest(project, validation, preflight, request);
  const mutation = applyRepairMutationToProject(project, request, issue);
  const previewBase = {
    actionId: repairAction.actionId,
    issueCode: repairAction.issueCode,
    targetPath: repairAction.targetPath,
    beforeRevision: projectRevision,
    expectedAfterSummary: mutation.expectedAfterSummary,
    diff: mutation.diff,
    destructiveWarnings: mutation.destructiveWarnings,
    repairAction
  };
  return {
    ...previewBase,
    confirmToken: repairConfirmToken(previewBase)
  };
}

function patchHistoryRepairMetadata(entry: PatchHistoryEntry): { preview?: RepairPreviewDto; afterRevision?: ProjectRevisionDto } {
  const repair = asRecord(asRecord(entry.rawOutput).repair);
  return {
    preview: repair.preview as RepairPreviewDto | undefined,
    afterRevision: repair.afterRevision as ProjectRevisionDto | undefined
  };
}

function repairHistoryEntryFromPatch(entry: PatchHistoryEntry): RepairHistoryEntryDto | null {
  const metadata = patchHistoryRepairMetadata(entry);
  if (!metadata.preview || !metadata.afterRevision) {
    return null;
  }
  return {
    id: entry.id,
    actionId: metadata.preview.actionId,
    issueCode: metadata.preview.issueCode,
    beforeRevision: metadata.preview.beforeRevision,
    afterRevision: metadata.afterRevision,
    appliedAt: entry.createdAt,
    ...(entry.revertedAt ? { revertedAt: entry.revertedAt } : {})
  };
}

function latestUnrevertedRepairPatchEntry(store: ProjectStore): PatchHistoryEntry | null {
  return store.listPatchHistory().find((entry) => Boolean(repairHistoryEntryFromPatch(entry)) && !entry.revertedAt) || null;
}

function patchDescriptionForRepair(preview: RepairPreviewDto): ProjectPatchDescription {
  return {
    text: preview.expectedAfterSummary,
    sceneCount: preview.actionId === "create-target-scene" ? 1 : 0,
    choiceCount: 0,
    assetCount: 0,
    generationJobCount: 0,
    operations: preview.diff.map((entry) => `${entry.op} ${entry.path}: ${entry.humanLabel}`)
  };
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

function stringField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArrayField(record: JsonRecord, key: string): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  return items.length ? items : [];
}

function projectRevisionField(record: JsonRecord, key: string): ProjectRevisionDto | undefined {
  const value = asRecord(record[key]);
  return typeof value.revision === "string" && typeof value.hashAlgorithm === "string" && typeof value.createdAt === "string"
    ? value as unknown as ProjectRevisionDto
    : undefined;
}

function isUXDecisionEventName(value: unknown): value is UXDecisionEventName {
  return typeof value === "string" && (UX_DECISION_EVENT_NAMES as readonly string[]).includes(value);
}

function actionEventNameFor(action: MakerActionId, body: JsonRecord): UXDecisionEventName | null {
  if (action === "recordUXDecisionEvent") {
    const event = asRecord(body.event || body.uxDecisionEvent);
    return isUXDecisionEventName(event.eventName) ? event.eventName : null;
  }
  if (action === "replayFixedPrompt" || action === "expandEvent" || action === "approveEvent") {
    return "generated";
  }
  if (action === "previewRepair") {
    return "repair_action_used";
  }
  if (action === "applyRepair") {
    return "repaired";
  }
  if (action === "undoRepair" || action === "undoPatch") {
    return "undo_used";
  }
  if (action === "previewProject") {
    return "previewed";
  }
  if (action === "validateProject" && asRecord(body.validation).ok === false) {
    return "validation_failed";
  }
  return null;
}

function actionEventContextRecord(body: JsonRecord): JsonRecord {
  return {
    ...asRecord(body.request),
    ...asRecord(body.fixedPrompt),
    ...asRecord(body.repairPreview),
    ...asRecord(body.repairHistoryEntry),
    ...asRecord(body.event),
    ...asRecord(body.uxDecisionEvent),
    ...body
  };
}

function createProjectActionEvent(
  action: MakerActionId,
  body: JsonRecord,
  input: {
    correlationId: string;
    requestId: string;
    project?: VnMakerProject;
    projectRevision?: ProjectRevisionDto;
  }
): ProjectActionEventDto | undefined {
  const eventName = actionEventNameFor(action, body);
  if (!eventName) {
    return undefined;
  }
  const record = actionEventContextRecord(body);
  return {
    eventName,
    timestamp: new Date().toISOString(),
    correlationId: input.correlationId,
    requestId: input.requestId,
    action,
    ...(stringField(record, "eventLogId") ? { eventLogId: stringField(record, "eventLogId") } : {}),
    ...(input.project?.id || stringField(record, "projectId") ? { projectId: input.project?.id || stringField(record, "projectId") } : {}),
    ...(stringField(record, "routeId") ? { routeId: stringField(record, "routeId") } : {}),
    ...(stringField(record, "sceneId") ? { sceneId: stringField(record, "sceneId") } : {}),
    ...(stringField(record, "promptId") ? { promptId: stringField(record, "promptId") } : {}),
    ...(stringField(record, "issueCode") ? { issueCode: stringField(record, "issueCode") } : {}),
    ...(stringField(record, "repairActionId") || stringField(record, "actionId") ? { repairActionId: stringField(record, "repairActionId") || stringField(record, "actionId") } : {}),
    outcome: body.ok === false ? "failed" : stringField(record, "outcome") || "success",
    ...(input.projectRevision ? { projectRevision: input.projectRevision } : {})
  };
}

function uxDecisionHelpChannel(value: unknown): UXDecisionHelpChannel | undefined {
  return typeof value === "string" && (UX_DECISION_HELP_CHANNELS as readonly string[]).includes(value)
    ? value as UXDecisionHelpChannel
    : undefined;
}

function uxDecisionEventNameFrom(input: JsonRecord): UXDecisionEventName {
  const value = input.eventName;
  if (!isUXDecisionEventName(value)) {
    throw new InputValidationError("지원하지 않는 UX decision eventName입니다.", [{
      severity: "error",
      path: "eventName",
      message: `필수 eventName 중 하나여야 합니다: ${UX_DECISION_EVENT_NAMES.join(", ")}`
    }]);
  }
  return value;
}

function uxDecisionRecordFrom(input: unknown): JsonRecord {
  const record = asRecord(input);
  return {
    ...asRecord(record.event),
    ...record
  };
}

function createUXDecisionEvent(
  input: unknown,
  project: VnMakerProject,
  projectRevision: ProjectRevisionDto
): UXDecisionEventDto {
  const record = uxDecisionRecordFrom(input);
  const sessionId = stringField(record, "sessionId");
  if (!sessionId) {
    throw new InputValidationError("UX decision event sessionId 입력이 필요합니다.", [{
      severity: "error",
      path: "sessionId",
      message: "비어 있을 수 없습니다."
    }]);
  }
  const timestamp = stringField(record, "timestamp") || new Date().toISOString();
  const eventLogId = stringField(record, "eventLogId") || createUXDecisionEventLogId(project.id, sessionId);
  return {
    eventLogId,
    eventId: stringField(record, "eventId") || createUXDecisionEventId(),
    eventName: uxDecisionEventNameFrom(record),
    timestamp,
    sessionId,
    ...(stringField(record, "participantIdHash") ? { participantIdHash: stringField(record, "participantIdHash") } : {}),
    ...(stringField(record, "participantType") ? { participantType: stringField(record, "participantType") } : {}),
    ...(stringField(record, "taskId") ? { taskId: stringField(record, "taskId") } : {}),
    ...(stringField(record, "promptId") ? { promptId: stringField(record, "promptId") } : {}),
    ...(stringField(record, "inputMode") ? { inputMode: stringField(record, "inputMode") } : {}),
    projectId: stringField(record, "projectId") || project.id,
    ...(stringField(record, "routeId") ? { routeId: stringField(record, "routeId") } : {}),
    ...(stringField(record, "sceneId") ? { sceneId: stringField(record, "sceneId") } : {}),
    ...(stringField(record, "issueCode") ? { issueCode: stringField(record, "issueCode") } : {}),
    ...(stringArrayField(record, "issueCodesBefore") ? { issueCodesBefore: stringArrayField(record, "issueCodesBefore") } : {}),
    ...(stringArrayField(record, "issueCodesAfter") ? { issueCodesAfter: stringArrayField(record, "issueCodesAfter") } : {}),
    ...(stringField(record, "repairActionId") ? { repairActionId: stringField(record, "repairActionId") } : {}),
    ...(uxDecisionHelpChannel(record.helpChannel) ? { helpChannel: uxDecisionHelpChannel(record.helpChannel) } : {}),
    ...(numberField(record, "hintLevel") !== undefined ? { hintLevel: numberField(record, "hintLevel") } : {}),
    ...(numberField(record, "elapsedMs") !== undefined ? { elapsedMs: numberField(record, "elapsedMs") } : {}),
    ...(numberField(record, "stallDurationMs") !== undefined ? { stallDurationMs: numberField(record, "stallDurationMs") } : {}),
    ...(stringField(record, "outcome") ? { outcome: stringField(record, "outcome") } : {}),
    projectRevision,
    ...(projectRevisionField(record, "revisionBefore") ? { revisionBefore: projectRevisionField(record, "revisionBefore") } : {}),
    ...(projectRevisionField(record, "revisionAfter") ? { revisionAfter: projectRevisionField(record, "revisionAfter") } : {}),
    ...(asRecord(record.preflightResult) === record.preflightResult ? { preflightResult: record.preflightResult as UXDecisionEventDto["preflightResult"] } : {}),
    ...(stringField(record, "correlationId") ? { correlationId: stringField(record, "correlationId") } : {}),
    ...(stringField(record, "action") ? { action: stringField(record, "action") } : {}),
    ...(stringField(record, "resultId") ? { resultId: stringField(record, "resultId") } : {}),
    ...(asRecord(record.metadata) === record.metadata ? { metadata: record.metadata as Record<string, unknown> } : {})
  };
}

function booleanField(record: JsonRecord, key: string): boolean | undefined {
  return typeof record[key] === "boolean" ? record[key] as boolean : undefined;
}

function phase0StringList(input: unknown): string[] {
  if (typeof input === "string" && input.trim()) {
    return [input.trim()];
  }
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
}

function phase0InputMode(value: unknown): Phase0TaskInputMode {
  return typeof value === "string" && value.trim() ? value.trim() : "manual";
}

function phase0ParticipantResultFrom(value: unknown): Phase0ParticipantResultDto | null {
  const record = asRecord(value);
  const sessionId = stringField(record, "sessionId");
  const participantIdHash = stringField(record, "participantIdHash");
  if (!sessionId || !participantIdHash) {
    return null;
  }
  return {
    participantIdHash,
    sessionId,
    inputMode: phase0InputMode(record.inputMode),
    ...(stringField(record, "taskId") ? { taskId: stringField(record, "taskId") } : {}),
    ...(stringField(record, "promptId") ? { promptId: stringField(record, "promptId") } : {}),
    ...(numberField(record, "vnToolCompletedCount") !== undefined ? { vnToolCompletedCount: numberField(record, "vnToolCompletedCount") } : {}),
    ...(booleanField(record, "professionalDeveloper") !== undefined ? { professionalDeveloper: booleanField(record, "professionalDeveloper") } : {}),
    ...(booleanField(record, "regularScriptingWork") !== undefined ? { regularScriptingWork: booleanField(record, "regularScriptingWork") } : {}),
    ...(booleanField(record, "storyCreatorLastYear") !== undefined ? { storyCreatorLastYear: booleanField(record, "storyCreatorLastYear") } : {}),
    ...(booleanField(record, "noviceNonDevStoryCreator") !== undefined ? { noviceNonDevStoryCreator: booleanField(record, "noviceNonDevStoryCreator") } : {}),
    ...(booleanField(record, "completed") !== undefined ? { completed: booleanField(record, "completed") } : {}),
    ...(booleanField(record, "reachedValidPreview") !== undefined ? { reachedValidPreview: booleanField(record, "reachedValidPreview") } : {}),
    ...(booleanField(record, "usedModeratorHint") !== undefined ? { usedModeratorHint: booleanField(record, "usedModeratorHint") } : {}),
    ...(booleanField(record, "usedStaticTutorial") !== undefined ? { usedStaticTutorial: booleanField(record, "usedStaticTutorial") } : {}),
    ...(booleanField(record, "abandoned") !== undefined ? { abandoned: booleanField(record, "abandoned") } : {}),
    ...(numberField(record, "blockingErrorCount") !== undefined ? { blockingErrorCount: numberField(record, "blockingErrorCount") } : {}),
    ...(numberField(record, "completionMs") !== undefined ? { completionMs: numberField(record, "completionMs") } : {}),
    ...(booleanField(record, "wrongMentalModel") !== undefined ? { wrongMentalModel: booleanField(record, "wrongMentalModel") } : {}),
    ...(booleanField(record, "dataLossAnxiety") !== undefined ? { dataLossAnxiety: booleanField(record, "dataLossAnxiety") } : {}),
    ...(stringField(record, "criticalIncidentCause") ? { criticalIncidentCause: stringField(record, "criticalIncidentCause") } : {}),
    ...(booleanField(record, "actualPreview") !== undefined ? { actualPreview: booleanField(record, "actualPreview") } : {}),
    ...(booleanField(record, "mockPreview") !== undefined ? { mockPreview: booleanField(record, "mockPreview") } : {}),
    ...(stringField(record, "notes") ? { notes: stringField(record, "notes") } : {})
  };
}

function phase0ParticipantResultsFrom(input: unknown): Phase0ParticipantResultDto[] {
  const value = asRecord(input).participantResults;
  return Array.isArray(value)
    ? value.map(phase0ParticipantResultFrom).filter((item): item is Phase0ParticipantResultDto => Boolean(item))
    : [];
}

function phase0ParticipantIsNoviceNonDevStoryCreator(participant?: Phase0ParticipantResultDto, events: UXDecisionEventDto[] = []): boolean {
  if (participant?.noviceNonDevStoryCreator !== undefined) {
    return participant.noviceNonDevStoryCreator;
  }
  if (participant) {
    return (participant.vnToolCompletedCount ?? Number.POSITIVE_INFINITY) <= 1
      && participant.professionalDeveloper !== true
      && participant.regularScriptingWork !== true
      && participant.storyCreatorLastYear === true;
  }
  return events.some((event) => event.participantType === "novice_non_dev_story_creator");
}

function latestPhase0Preflight(events: UXDecisionEventDto[]): UXDecisionEventDto["preflightResult"] | undefined {
  return [...events].reverse().find((event) => event.preflightResult)?.preflightResult;
}

function phase0EventNames(events: UXDecisionEventDto[]): UXDecisionEventName[] {
  return [...new Set(events.map((event) => event.eventName))];
}

function phase0MaxElapsedMs(events: UXDecisionEventDto[]): number | undefined {
  const elapsedValues = events.map((event) => event.elapsedMs).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return elapsedValues.length ? Math.max(...elapsedValues) : undefined;
}

function phase0GuidedRepairEvidence(events: UXDecisionEventDto[]): Phase0SessionEvidenceDto["guidedRepairEvidence"] {
  const repairUsed = events.find((event) => event.eventName === "repair_action_used");
  const repaired = [...events].reverse().find((event) => event.eventName === "repaired");
  const preflightResult = latestPhase0Preflight(events);
  const issueCode = repaired?.issueCode || repairUsed?.issueCode;
  const repairActionId = repaired?.repairActionId || repairUsed?.repairActionId;
  const revisionBefore = repaired?.revisionBefore;
  const revisionAfter = repaired?.revisionAfter;
  const eventLogId = repaired?.eventLogId || repairUsed?.eventLogId || events[0]?.eventLogId;
  const ready = Boolean(issueCode && repairActionId && revisionBefore && revisionAfter && preflightResult && eventLogId);
  return {
    ready,
    ...(issueCode ? { issueCode } : {}),
    ...(repairActionId ? { repairActionId } : {}),
    ...(revisionBefore ? { revisionBefore } : {}),
    ...(revisionAfter ? { revisionAfter } : {}),
    ...(preflightResult ? { preflightResult } : {}),
    ...(eventLogId ? { eventLogId } : {})
  };
}

function phase0SessionEvidence(
  sessionId: string,
  events: UXDecisionEventDto[],
  participant?: Phase0ParticipantResultDto
): Phase0SessionEvidenceDto {
  const orderedEvents = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const eventNames = phase0EventNames(orderedEvents);
  const latestPreflight = latestPhase0Preflight(orderedEvents);
  const previewPreflightCanRun = latestPreflight?.canRun === true;
  const abandoned = participant?.abandoned ?? eventNames.includes("abandoned");
  const reachedValidPreview = participant?.reachedValidPreview ?? orderedEvents.some((event) =>
    event.eventName === "previewed" && event.outcome === "completed" && event.preflightResult?.canRun === true
  );
  const completed = participant?.completed ?? (reachedValidPreview && !abandoned);
  const usedModeratorHint = participant?.usedModeratorHint ?? orderedEvents.some((event) => event.eventName === "hint_given" || event.helpChannel === "moderator_hint");
  const usedStaticTutorial = participant?.usedStaticTutorial ?? orderedEvents.some((event) => event.helpChannel === "static_tutorial");
  const stall90s = orderedEvents.some((event) => typeof event.stallDurationMs === "number" && event.stallDurationMs >= 90000);
  const blockingErrorCount = participant?.blockingErrorCount
    ?? orderedEvents.filter((event) => event.eventName === "validation_failed" || event.outcome === "blocked").length;
  const completionMs = participant?.completionMs ?? phase0MaxElapsedMs(orderedEvents);
  const inputMode = phase0InputMode(participant?.inputMode || orderedEvents.find((event) => event.inputMode)?.inputMode);
  const mockPreview = participant?.mockPreview === true
    || orderedEvents.some((event) => ["mock", "fake"].includes(String(asRecord(event.metadata).previewKind || "")));
  const actualPreview = participant?.actualPreview ?? (previewPreflightCanRun && !mockPreview);
  const guidedRepairEvidence = phase0GuidedRepairEvidence(orderedEvents);
  return {
    sessionId,
    ...(orderedEvents[0]?.eventLogId ? { eventLogId: orderedEvents[0].eventLogId } : {}),
    ...(participant?.participantIdHash || orderedEvents[0]?.participantIdHash ? { participantIdHash: participant?.participantIdHash || orderedEvents[0]?.participantIdHash } : {}),
    noviceNonDevStoryCreator: phase0ParticipantIsNoviceNonDevStoryCreator(participant, orderedEvents),
    inputMode,
    ...(participant?.taskId || orderedEvents.find((event) => event.taskId)?.taskId ? { taskId: participant?.taskId || orderedEvents.find((event) => event.taskId)?.taskId } : {}),
    ...(participant?.promptId || orderedEvents.find((event) => event.promptId)?.promptId ? { promptId: participant?.promptId || orderedEvents.find((event) => event.promptId)?.promptId } : {}),
    eventNames,
    completed,
    reachedValidPreview,
    usedModeratorHint,
    usedStaticTutorial,
    abandoned,
    stall90s,
    blockingErrorCount,
    ...(completionMs !== undefined ? { completionMs } : {}),
    wrongMentalModel: participant?.wrongMentalModel === true,
    dataLossAnxiety: participant?.dataLossAnxiety === true,
    ...(participant?.criticalIncidentCause ? { criticalIncidentCause: participant.criticalIncidentCause } : {}),
    actualPreview,
    mockPreview,
    previewPreflightCanRun,
    conditionPreviewStatus: "not_evaluated",
    guidedRepairEvidence
  };
}

function phase0MedianMinutes(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const ms = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return Math.round((ms / 60000) * 10) / 10;
}

function phase0Rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : 0;
}

function phase0SameCauseCriticalIncidentCount(sessions: Phase0SessionEvidenceDto[]): number {
  const counts = new Map<string, number>();
  sessions.forEach((session) => {
    if (session.criticalIncidentCause) {
      counts.set(session.criticalIncidentCause, (counts.get(session.criticalIncidentCause) || 0) + 1);
    }
  });
  return Math.max(0, ...counts.values());
}

function phase0Metrics(inputMode: Phase0TaskInputMode, sessions: Phase0SessionEvidenceDto[]): Phase0MetricDto {
  const completedCount = sessions.filter((session) => session.completed).length;
  const guidedRepairSessions = sessions.filter((session) => session.eventNames.includes("repair_action_used") || session.eventNames.includes("repaired"));
  const guidedRepairReadyCount = guidedRepairSessions.filter((session) => session.guidedRepairEvidence?.ready).length;
  const noviceSessions = sessions.filter((session) => session.noviceNonDevStoryCreator);
  const validPreviewWithoutHintCount = noviceSessions.filter((session) => session.reachedValidPreview && !session.usedModeratorHint).length;
  const completionValues = sessions.map((session) => session.completionMs).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const blockingErrorTotal = sessions.reduce((sum, session) => sum + session.blockingErrorCount, 0);
  const helpSessions = sessions.filter((session) => session.usedStaticTutorial || session.usedModeratorHint);
  const helpRecoveredCount = helpSessions.filter((session) => session.completed || session.reachedValidPreview).length;
  return {
    inputMode,
    sessionCount: sessions.length,
    completedCount,
    completionRate: phase0Rate(completedCount, sessions.length),
    guidedRepairCompletionRate: phase0Rate(guidedRepairReadyCount, guidedRepairSessions.length || sessions.length),
    noviceNonDevStoryCreatorCount: noviceSessions.length,
    majorityValidPreviewWithoutHint: noviceSessions.length > 0 && validPreviewWithoutHintCount > noviceSessions.length / 2,
    medianCompletionMinutes: phase0MedianMinutes(completionValues),
    averageBlockingErrors: sessions.length ? Math.round((blockingErrorTotal / sessions.length) * 10) / 10 : 0,
    helpRecoveryRate: helpSessions.length ? phase0Rate(helpRecoveredCount, helpSessions.length) : 1,
    sameCauseCriticalIncidentCount: phase0SameCauseCriticalIncidentCount(sessions),
    fakeOrMockPreviewCount: sessions.filter((session) => session.mockPreview).length
  };
}

function phase0Denominator(sessions: Phase0SessionEvidenceDto[]): Phase0DenominatorDto {
  return {
    totalSessions: sessions.length,
    failedSessions: sessions.filter((session) => !session.completed).length,
    abandonedSessions: sessions.filter((session) => session.abandoned).length,
    stall90sSessions: sessions.filter((session) => session.stall90s).length,
    staticTutorialRecoverySessions: sessions.filter((session) => session.usedStaticTutorial && (session.completed || session.reachedValidPreview)).length,
    moderatorHintSessions: sessions.filter((session) => session.usedModeratorHint).length,
    includedFailedAbandonedAndHelpRecovery: true
  };
}

function phase0Package(
  id: string,
  label: string,
  status: Phase0WorkPackageStatus,
  evidence: string[],
  missing: string[]
): Phase0WorkPackageStatusDto {
  return {
    id,
    label,
    status,
    evidence,
    missing
  };
}

function phase0WorkPackageStatus(input: {
  sessions: Phase0SessionEvidenceDto[];
  events: UXDecisionEventDto[];
  generationLogs: GenerationResultLogDto[];
  participantResults: Phase0ParticipantResultDto[];
  previewPreflight: PreviewPreflightDto;
}): Phase0WorkPackageStatusDto[] {
  const eventNames = new Set(input.events.map((event) => event.eventName));
  const fixedSessions = input.sessions.filter((session) => session.inputMode === "fixed_prompt");
  const freeSessions = input.sessions.filter((session) => session.inputMode === "free_input");
  const guidedRepairReady = input.sessions.some((session) => session.guidedRepairEvidence?.ready);
  const previewCanRun = input.sessions.some((session) => session.previewPreflightCanRun) || input.previewPreflight.canRun === true;
  const noviceCount = input.sessions.filter((session) => session.noviceNonDevStoryCreator).length;
  const packagesById: Record<string, Phase0WorkPackageStatusDto> = {
    "alpha-input": phase0Package("alpha-input", "Alpha input", input.sessions.length ? "Ready" : "Missing", input.sessions.length ? ["started event or participant session present"] : [], input.sessions.length ? [] : ["started event"]),
    "generation-summary": phase0Package("generation-summary", "generation summary", input.generationLogs.length || eventNames.has("generated") ? "Ready" : eventNames.has("recipe_used") ? "Partial" : "Missing", input.generationLogs.length ? [`generationResultLogs ${input.generationLogs.length}`] : eventNames.has("generated") ? ["generated event"] : [], input.generationLogs.length || eventNames.has("generated") ? [] : ["generation result log"]),
    "studio-guided-recipe": phase0Package("studio-guided-recipe", "Studio guided recipe", eventNames.has("recipe_used") && fixedSessions.length ? "Ready" : eventNames.has("recipe_used") ? "Partial" : "Missing", eventNames.has("recipe_used") ? ["recipe_used fixed prompt event"] : [], eventNames.has("recipe_used") && fixedSessions.length ? [] : ["fixed prompt recipe event"]),
    "problems-repair": phase0Package("problems-repair", "Problems repair", guidedRepairReady ? "Ready" : eventNames.has("repair_action_used") ? "Partial" : "Missing", guidedRepairReady ? ["issueCode, repairActionId, before/after revision, preflightResult, eventLogId"] : eventNames.has("repair_action_used") ? ["repair_action_used event"] : [], guidedRepairReady ? [] : ["complete guided repair evidence"]),
    "preview-preflight": phase0Package("preview-preflight", "Preview preflight", previewCanRun ? "Ready" : eventNames.has("previewed") ? "Partial" : "Missing", previewCanRun ? ["preflightResult.canRun actual preview evidence"] : eventNames.has("previewed") ? ["previewed event"] : [], previewCanRun ? [] : ["actual preview preflight canRun"]),
    "event-log-export": phase0Package("event-log-export", "Event log export", input.events.some((event) => event.eventLogId) ? "Ready" : input.events.length ? "Partial" : "Missing", input.events.some((event) => event.eventLogId) ? ["eventLogId present in exported UX events"] : [], input.events.some((event) => event.eventLogId) ? [] : ["eventLogId"]),
    "participant-protocol": phase0Package("participant-protocol", "participant screening protocol", noviceCount >= 6 ? "Ready" : input.participantResults.length ? "Partial" : "Missing", input.participantResults.length ? [`novice non-dev story creators ${noviceCount}`] : [], noviceCount >= 6 ? [] : ["validation sample novice non-dev story creators >= 6"]),
    "fixed-free-separation": phase0Package("fixed-free-separation", "fixed/free input separation", fixedSessions.length && freeSessions.length ? "Ready" : fixedSessions.length || freeSessions.length ? "Partial" : "Missing", [`fixed ${fixedSessions.length}`, `free ${freeSessions.length}`, "combined totals disabled"], fixedSessions.length && freeSessions.length ? [] : ["fixed and free input evidence"]),
    "decision-thresholds": phase0Package("decision-thresholds", "Go/Iterate/Stop threshold report", "Ready", ["Go, Iterate, Stop/Rethink criteria calculated"], [])
  };
  return PHASE0_WORK_PACKAGES.map((item) => packagesById[item.id]);
}

export function phase0DecisionForMetrics(input: {
  workPackages: Phase0WorkPackageStatusDto[];
  fixedInputMetrics: Phase0MetricDto;
  sessions: Phase0SessionEvidenceDto[];
  mockActualSeparation: Phase0DecisionReportDto["mockActualSeparation"];
}): { decision: Phase0Decision; maximumDecisionDueToMissing?: Phase0Decision; decisionReasons: string[] } {
  const reasons: string[] = [];
  const missingOrMockReplacement = input.workPackages.some((item) => item.status === "Missing")
    || input.mockActualSeparation.fakeOrMockPreviewCount > 0
    || input.mockActualSeparation.mockGenerationResultCount > 0
    || input.mockActualSeparation.unavailableGenerationResultCount > 0;
  const fixed = input.fixedInputMetrics;
  const repeatedCriticalIncident = Math.max(fixed.sameCauseCriticalIncidentCount, phase0SameCauseCriticalIncidentCount(input.sessions)) >= 2;
  const repeatedDataLossAnxiety = input.sessions.filter((session) => session.dataLossAnxiety).length >= 2;
  const completionRate = fixed.sessionCount ? fixed.completionRate : phase0Metrics("all", input.sessions).completionRate;
  if (completionRate < 0.5 && input.sessions.length > 0) {
    reasons.push("completion rate below 50%");
    return { decision: "Stop/Rethink", decisionReasons: reasons };
  }
  if (repeatedCriticalIncident || repeatedDataLossAnxiety) {
    reasons.push(repeatedDataLossAnxiety ? "repeated data-loss anxiety" : "same-cause critical incident repeated");
    return { decision: "Stop/Rethink", decisionReasons: reasons };
  }
  if (missingOrMockReplacement) {
    reasons.push("Missing work package or fake/mock replacement caps Phase 0 at Iterate");
  }
  const goCriteria = [
    fixed.guidedRepairCompletionRate >= 0.7,
    fixed.noviceNonDevStoryCreatorCount >= 6,
    fixed.majorityValidPreviewWithoutHint,
    fixed.medianCompletionMinutes !== null && fixed.medianCompletionMinutes <= 20,
    fixed.averageBlockingErrors <= 2,
    fixed.helpRecoveryRate >= 0.8,
    input.mockActualSeparation.fakeOrMockPreviewCount === 0,
    fixed.sameCauseCriticalIncidentCount < 2
  ];
  if (!missingOrMockReplacement && goCriteria.every(Boolean)) {
    reasons.push("all Go criteria passed");
    return { decision: "Go", decisionReasons: reasons };
  }
  if (completionRate >= 0.5 && completionRate < 0.7) {
    reasons.push("completion rate between 50% and 69%");
  }
  if (!goCriteria.every(Boolean)) {
    reasons.push("one or more Go criteria require iteration");
  }
  return {
    decision: "Iterate",
    ...(missingOrMockReplacement ? { maximumDecisionDueToMissing: "Iterate" as const } : {}),
    decisionReasons: reasons
  };
}

function createPhase0DecisionReportDto(input: {
  project: VnMakerProject;
  projectRevision: ProjectRevisionDto;
  previewPreflight: PreviewPreflightDto;
  events: UXDecisionEventDto[];
  generationLogs: GenerationResultLogDto[];
  participantResults: Phase0ParticipantResultDto[];
  generatedAt: string;
}): Phase0DecisionReportDto {
  const eventsBySession = new Map<string, UXDecisionEventDto[]>();
  input.events.forEach((event) => {
    const list = eventsBySession.get(event.sessionId) || [];
    list.push(event);
    eventsBySession.set(event.sessionId, list);
  });
  const participantsBySession = new Map(input.participantResults.map((participant) => [participant.sessionId, participant]));
  const sessionIds = new Set<string>([
    ...eventsBySession.keys(),
    ...participantsBySession.keys()
  ]);
  const sessions = [...sessionIds]
    .map((sessionId) => phase0SessionEvidence(sessionId, eventsBySession.get(sessionId) || [], participantsBySession.get(sessionId)))
    .sort((left, right) => left.sessionId.localeCompare(right.sessionId));
  const fixedSessions = sessions.filter((session) => session.inputMode === "fixed_prompt");
  const freeSessions = sessions.filter((session) => session.inputMode === "free_input");
  const workPackages = phase0WorkPackageStatus({
    sessions,
    events: input.events,
    generationLogs: input.generationLogs,
    participantResults: input.participantResults,
    previewPreflight: input.previewPreflight
  });
  const fixedInputMetrics = phase0Metrics("fixed_prompt", fixedSessions);
  const freeInputFindings = phase0Metrics("free_input", freeSessions);
  const mockActualSeparation: Phase0DecisionReportDto["mockActualSeparation"] = {
    combinedTotalsUsed: false,
    actualPreviewCount: sessions.filter((session) => session.actualPreview).length,
    fakeOrMockPreviewCount: sessions.filter((session) => session.mockPreview).length,
    mockGenerationResultCount: input.generationLogs.filter((log) => log.sourceType === "mock").length,
    unavailableGenerationResultCount: input.generationLogs.filter((log) => log.sourceType === "unavailable").length
  };
  const decision = phase0DecisionForMetrics({
    workPackages,
    fixedInputMetrics,
    sessions,
    mockActualSeparation
  });
  return {
    reportId: `phase0-report-${input.project.id}-${input.generatedAt}`.replace(/[^A-Za-z0-9._:-]/g, "-"),
    projectId: input.project.id,
    projectRevision: input.projectRevision,
    generatedAt: input.generatedAt,
    decision: decision.decision,
    ...(decision.maximumDecisionDueToMissing ? { maximumDecisionDueToMissing: decision.maximumDecisionDueToMissing } : {}),
    decisionReasons: decision.decisionReasons,
    workPackages,
    sessions,
    denominator: phase0Denominator(sessions),
    fixedInputMetrics,
    freeInputFindings,
    conditionRuntime: {
      supportFlag: input.previewPreflight.conditionRuntimeSupport.supportFlag,
      supported: input.previewPreflight.conditionRuntimeSupport.supported,
      strictPreviewStatus: input.previewPreflight.conditionRuntimeSupport.strictPreviewStatus,
      conditionPreviewCountsAsStrictSuccess: false,
      actualPreviewCanRun: input.previewPreflight.canRun === true || sessions.some((session) => session.previewPreflightCanRun),
      message: input.previewPreflight.conditionRuntimeSupport.message
    },
    mockActualSeparation
  };
}

function withActionState<T extends JsonRecord>(
  action: MakerActionId,
  body: T,
  options: { project?: VnMakerProject; validation?: { ok?: boolean; issues?: ValidationIssue[] }; projectRevision?: ProjectRevisionDto } = {}
): T & {
  ok: boolean;
  requestId: string;
  correlationId: string;
  action: MakerActionId;
  actionEvent?: ProjectActionEventDto;
  baseProjectHash?: string;
  projectRevision?: ProjectRevisionDto;
  previewPreflight?: PreviewPreflightDto;
  repairActions?: RepairActionDto[];
  workflowSummary: MakerWorkflowSummary;
  previewReadiness?: ProjectPreviewReadinessDto;
  exportPlan?: ProjectExportPlanDto;
} {
  const project = options.project || (asRecord(body).project as VnMakerProject | undefined);
  const validation = options.validation || (asRecord(body).validation as { ok?: boolean; issues?: ValidationIssue[] } | undefined);
  const explicitPreviewReadiness = asRecord(body).previewReadiness as ProjectPreviewReadinessDto | undefined;
  const explicitPreviewPreflight = asRecord(body).previewPreflight as PreviewPreflightDto | undefined;
  const explicitRepairActions = asRecord(body).repairActions as RepairActionDto[] | undefined;
  const explicitExportPlan = asRecord(body).exportPlan as ProjectExportPlanDto | undefined;
  const explicitProjectRevision = options.projectRevision || (asRecord(body).projectRevision as ProjectRevisionDto | undefined);
  const stateValidation = project ? validationForProjectState(project, validation) : validation;
  const projectHash = project ? hashProjectSnapshot(project) : undefined;
  const projectRevision = explicitProjectRevision || (project ? createProjectRevision(project, new Date().toISOString()) : undefined);
  const previewReadiness = project
    ? explicitPreviewReadiness || previewReadinessFor(project, stateValidation || { ok: true, issues: [] })
    : explicitPreviewReadiness;
  const previewPreflight = project && projectRevision
    ? explicitPreviewPreflight || createPreviewPreflight(project, stateValidation || { ok: true, issues: [] }, projectRevision)
    : explicitPreviewPreflight;
  const repairActions = project
    ? explicitRepairActions || repairActionsForValidation(project, stateValidation || { ok: true, issues: [] }, previewPreflight)
    : explicitRepairActions;
  const exportPlan = project
    ? explicitExportPlan || exportPlanFor(project, stateValidation || { ok: true, issues: [] })
    : explicitExportPlan;
  const requestId = createRequestId();
  const correlationId = createCorrelationId(action);
  const actionEvent = createProjectActionEvent(action, body, {
    correlationId,
    requestId,
    project,
    projectRevision
  });
  return {
    ...body,
    ok: body.ok !== false,
    requestId,
    correlationId,
    action,
    ...(actionEvent ? { actionEvent } : {}),
    baseProjectHash: projectHash,
    projectRevision,
    workflowSummary: createWorkflowSummary(project, stateValidation),
    ...(previewReadiness ? { previewReadiness } : {}),
    ...(previewPreflight ? { previewPreflight } : {}),
    ...(repairActions ? { repairActions } : {}),
    ...(exportPlan ? { exportPlan } : {})
  };
}

function withStoreActionState<T extends JsonRecord>(
  action: MakerActionId,
  store: ProjectStore,
  body: T,
  options: { project?: VnMakerProject; validation?: { ok?: boolean; issues?: ValidationIssue[] }; projectRevision?: ProjectRevisionDto } = {}
) {
  const projectRevision = store.getProjectRevision();
  return withActionState(action, {
    ...body,
    projectRevision
  }, {
    ...options,
    projectRevision
  });
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
    || code === "STALE_PROJECT_REVISION"
    || code === "PROJECT_REVISION_CONFLICT"
    || code === "HEROINE_REQUIRED"
    || code === "HEROINE_REPLACE_BLOCKED"
    || code === "PATCH_STALE"
    || code === "JOB_ALREADY_RUNNING"
    || code === "PREVIEW_BLOCKED"
    || code === "EXPORT_BLOCKED"
    || code === "OAUTH_REQUIRED"
    || code === "IMAGE_GENERATION_UNAVAILABLE"
  ) {
    return code;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OAuth 로그인이 필요")) {
    return "OAUTH_REQUIRED";
  }
  if (message.includes("imageGeneration")) {
    return "IMAGE_GENERATION_UNAVAILABLE";
  }
  if (message.includes("현재 프로젝트가 패치 적용 직후 상태와 달라")) {
    return "PATCH_STALE";
  }
  return "SERVER_ERROR";
}

function imageGenerationFailureFromMessages(messages: string[]): Pick<ProjectActionFailureDto, "code" | "message" | "error" | "retryable"> {
  const message = messages.find((item) => item.trim()) || "이미지 생성 작업이 실패했습니다.";
  const code = message.includes("OAuth 로그인이 필요")
    ? "OAUTH_REQUIRED"
    : message.includes("imageGeneration")
      ? "IMAGE_GENERATION_UNAVAILABLE"
      : "SERVER_ERROR";
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
  const requestId = createRequestId();
  const correlationId = action ? createCorrelationId(action) : undefined;
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
  const actualRevision = errorRecord.actualRevision && typeof errorRecord.actualRevision === "object" ? errorRecord.actualRevision as ProjectRevisionDto : undefined;
  const actionEvent = action && correlationId
    ? createProjectActionEvent(action, {
        ok: false,
        ...errorRecord,
        validation: errorRecord.validation || (issues ? { ok: false, issues } : undefined)
      }, { correlationId, requestId, projectRevision: actualRevision })
    : undefined;
  return {
    ok: false,
    action,
    code,
    message,
    error: message,
    nextAction: typeof errorRecord.nextAction === "string" && errorRecord.nextAction.trim() ? errorRecord.nextAction.trim() : contract.nextAction,
    requestId,
    ...(correlationId ? { correlationId } : {}),
    projectId: typeof errorRecord.projectId === "string" ? errorRecord.projectId : expectedProjectId,
    projectDirectory: typeof errorRecord.projectDirectory === "string" ? errorRecord.projectDirectory : undefined,
    expectedProjectId,
    actualProjectId: typeof errorRecord.actualProjectId === "string" ? errorRecord.actualProjectId : undefined,
    expectedRevision: typeof errorRecord.expectedRevision === "string" ? errorRecord.expectedRevision : undefined,
    actualRevision,
    workflowSummary,
    previewReadiness,
    exportPlan,
    ...(actionEvent ? { actionEvent } : {}),
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

function heroineAssetIds(heroine: HeroineProfile): string[] {
  return [...new Set([
    heroine.defaultPortraitAssetId || "",
    ...heroine.portraitAssetIds,
    ...Object.values(heroine.expressionAssetIds || {})
  ].filter(Boolean))];
}

function mergeHeroineSnapshotAssets(project: VnMakerProject, sourceProject: VnMakerProject | null, heroine: HeroineProfile): VnMakerProject {
  if (!sourceProject) {
    return project;
  }
  const sourceAssetsById = new Map(sourceProject.assets.map((asset) => [asset.id, asset]));
  const snapshotAssetIds = new Set(heroineAssetIds(heroine));
  if (snapshotAssetIds.size === 0) {
    return project;
  }
  return {
    ...project,
    assets: project.assets.map((asset) => snapshotAssetIds.has(asset.id) && sourceAssetsById.has(asset.id)
      ? { ...sourceAssetsById.get(asset.id)! }
      : asset)
  };
}

async function copyHeroineSnapshotAssets(targetStore: ProjectStore, sourceStore: ProjectStore | null, heroine: HeroineProfile): Promise<void> {
  if (!sourceStore || sourceStore.paths.projectDirectory === targetStore.paths.projectDirectory) {
    return;
  }
  for (const assetId of heroineAssetIds(heroine)) {
    await targetStore.importAssetFrom(sourceStore, assetId);
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

function expectedProjectRevisionFrom(input: unknown): ProjectRevisionInput {
  const value = asRecord(input).expectedProjectRevision;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === "object") {
    const revision = asRecord(value).revision;
    if (typeof revision === "string" && revision.trim()) {
      return value as ProjectRevisionDto;
    }
  }
  throw new InputValidationError("expectedProjectRevision 입력이 필요합니다.", [{
    severity: "error",
    path: "expectedProjectRevision",
    message: "최신 projectRevision 기준으로만 변경할 수 있습니다."
  }]);
}

function manualInputError(message: string, path: string, sceneIds?: string[], choiceIds?: string[]): InputValidationError {
  return new InputValidationError(message, [{ severity: "error", path, message }].map((issue) => ({
    ...issue,
    sceneIds,
    choiceIds
  } as ValidationIssue)));
}

function studioInputError(message: string, path: string, sceneIds?: string[], choiceIds?: string[]): InputValidationError {
  return new InputValidationError(message, [{ severity: "error", path, message, sceneIds, choiceIds } as ValidationIssue]);
}

function requiredStudioString(record: JsonRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw studioInputError(`${path} 입력이 필요합니다.`, path);
  }
  return value.trim();
}

function optionalStudioString(record: JsonRecord, key: string, path: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw studioInputError(`${path} 입력은 문자열이어야 합니다.`, path);
  }
  return value.trim() || undefined;
}

function requiredStudioNumber(record: JsonRecord, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw studioInputError(`${path} 입력은 숫자여야 합니다.`, path);
  }
  return value;
}

function optionalStudioEnum<T extends string>(record: JsonRecord, key: string, path: string, allowed: readonly T[]): T | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw studioInputError(`${path} 입력은 ${allowed.join(", ")} 중 하나여야 합니다.`, path);
  }
  return value as T;
}

function studioOperationsFrom(input: unknown): StudioMutationOperation[] {
  const operations = asRecord(input).operations;
  if (!Array.isArray(operations) || operations.length === 0) {
    throw studioInputError("Studio mutation operations 입력이 필요합니다.", "operations");
  }
  return operations.map((operation, index) => {
    const record = asRecord(operation);
    const path = `operations.${index}`;
    const type = requiredStudioString(record, "type", `${path}.type`);
    if (type === "upsertScene") {
      return {
        type,
        scene: requireParsed(parseVnMakerScene(record.scene), `${path}.scene`)
      };
    }
    if (type === "deleteScene") {
      return {
        type,
        sceneId: requiredStudioString(record, "sceneId", `${path}.sceneId`),
        mode: optionalStudioEnum(record, "mode", `${path}.mode`, ["failIfReferenced", "unlinkReferences"] as const)
      };
    }
    if (type === "duplicateScene") {
      return {
        type,
        sourceSceneId: requiredStudioString(record, "sourceSceneId", `${path}.sourceSceneId`),
        newSceneId: optionalStudioString(record, "newSceneId", `${path}.newSceneId`),
        label: optionalStudioString(record, "label", `${path}.label`)
      };
    }
    if (type === "deleteChoice") {
      return {
        type,
        sceneId: requiredStudioString(record, "sceneId", `${path}.sceneId`),
        choiceId: requiredStudioString(record, "choiceId", `${path}.choiceId`)
      };
    }
    if (type === "duplicateChoice") {
      return {
        type,
        sceneId: requiredStudioString(record, "sceneId", `${path}.sceneId`),
        choiceId: requiredStudioString(record, "choiceId", `${path}.choiceId`),
        newChoiceId: optionalStudioString(record, "newChoiceId", `${path}.newChoiceId`),
        text: optionalStudioString(record, "text", `${path}.text`)
      };
    }
    if (type === "reorderChoice") {
      return {
        type,
        sceneId: requiredStudioString(record, "sceneId", `${path}.sceneId`),
        choiceId: requiredStudioString(record, "choiceId", `${path}.choiceId`),
        toIndex: requiredStudioNumber(record, "toIndex", `${path}.toIndex`)
      };
    }
    if (type === "clearChoiceTarget") {
      return {
        type,
        sceneId: requiredStudioString(record, "sceneId", `${path}.sceneId`),
        choiceId: requiredStudioString(record, "choiceId", `${path}.choiceId`)
      };
    }
    if (type === "unlinkSceneTarget") {
      return {
        type,
        sourceSceneId: requiredStudioString(record, "sourceSceneId", `${path}.sourceSceneId`),
        targetSceneId: requiredStudioString(record, "targetSceneId", `${path}.targetSceneId`),
        edgeType: optionalStudioEnum(record, "edgeType", `${path}.edgeType`, ["next", "choice", "all"] as const)
      };
    }
    if (type === "setRouteEntry") {
      return {
        type,
        routeId: requiredStudioString(record, "routeId", `${path}.routeId`),
        sceneId: requiredStudioString(record, "sceneId", `${path}.sceneId`)
      };
    }
    throw studioInputError("지원하지 않는 Studio mutation operation입니다.", `${path}.type`);
  });
}

function requireStudioScene(project: VnMakerProject, sceneId: string, path: string): VnMakerScene {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    throw studioInputError("Studio mutation 대상 scene을 찾을 수 없습니다.", path, [sceneId]);
  }
  return scene;
}

function requireStudioChoice(scene: VnMakerScene, choiceId: string, path: string): VnMakerChoice {
  const choice = scene.choices.find((item) => item.id === choiceId);
  if (!choice) {
    throw studioInputError("Studio mutation 대상 choice를 찾을 수 없습니다.", path, [scene.id], [choiceId]);
  }
  return choice;
}

function studioReferencedSceneIds(project: VnMakerProject, sceneId: string): string[] {
  const refs: string[] = [];
  project.routes.forEach((route) => {
    if (route.entrySceneId === sceneId) {
      refs.push(`route:${route.id}`);
    }
  });
  project.scenes.forEach((scene) => {
    if (scene.next === sceneId) {
      refs.push(`scene:${scene.id}:next`);
    }
    scene.choices.forEach((choice) => {
      if (choice.next === sceneId) {
        refs.push(`scene:${scene.id}:choice:${choice.id}`);
      }
    });
  });
  return refs;
}

function replacementRouteEntrySceneId(project: VnMakerProject, scene: VnMakerScene): string | undefined {
  if (scene.next && project.scenes.some((candidate) => candidate.id === scene.next && candidate.id !== scene.id)) {
    return scene.next;
  }
  return project.scenes.find((candidate) => candidate.id !== scene.id)?.id;
}

function unlinkSceneReferences(project: VnMakerProject, deletedScene: VnMakerScene): void {
  const replacementEntrySceneId = replacementRouteEntrySceneId(project, deletedScene);
  project.routes.forEach((route) => {
    if (route.entrySceneId === deletedScene.id) {
      if (!replacementEntrySceneId) {
        throw studioInputError("route entry scene을 삭제하려면 대체 scene이 필요합니다.", "operations.deleteScene.sceneId", [deletedScene.id]);
      }
      route.entrySceneId = replacementEntrySceneId;
    }
  });
  project.scenes.forEach((scene) => {
    if (scene.next === deletedScene.id) {
      scene.next = undefined;
    }
    scene.choices.forEach((choice) => {
      if (choice.next === deletedScene.id) {
        choice.next = `studio-unlinked-target-${choice.id}`;
      }
    });
  });
}

function applyStudioOperation(project: VnMakerProject, operation: StudioMutationOperation): { project: VnMakerProject; selectedSceneId?: string } {
  if (operation.type === "upsertScene") {
    return {
      project: upsertProjectScene(project, operation.scene),
      selectedSceneId: operation.scene.id
    };
  }

  if (operation.type === "deleteScene") {
    const scene = requireStudioScene(project, operation.sceneId, "operations.deleteScene.sceneId");
    const references = studioReferencedSceneIds(project, scene.id);
    if (references.length > 0 && operation.mode !== "unlinkReferences") {
      throw studioInputError(`scene 삭제 전에 참조를 해제해야 합니다: ${references.join(", ")}`, "operations.deleteScene.mode", [scene.id]);
    }
    unlinkSceneReferences(project, scene);
    project.scenes = project.scenes.filter((item) => item.id !== scene.id);
    return { project, selectedSceneId: project.scenes[0]?.id };
  }

  if (operation.type === "duplicateScene") {
    const source = requireStudioScene(project, operation.sourceSceneId, "operations.duplicateScene.sourceSceneId");
    const newSceneId = operation.newSceneId?.trim() || uniqueSceneId(project, `${source.id}-copy`);
    if (project.scenes.some((scene) => scene.id === newSceneId)) {
      throw studioInputError("duplicateScene newSceneId가 이미 존재합니다.", "operations.duplicateScene.newSceneId", [newSceneId]);
    }
    const duplicate = requireParsed(parseVnMakerScene({
      ...source,
      id: newSceneId,
      label: operation.label?.trim() || `${source.label} 복제`,
      ending: source.ending ? {
        ...source.ending,
        id: uniqueEndingId(project, newSceneId)
      } : undefined,
      choices: source.choices.map((choice) => ({
        ...choice,
        id: uniqueChoiceId({ ...source, id: newSceneId, choices: [] }, choice.id)
      }))
    }), "scene");
    project.scenes.push(duplicate);
    return { project, selectedSceneId: duplicate.id };
  }

  if (operation.type === "deleteChoice") {
    const scene = requireStudioScene(project, operation.sceneId, "operations.deleteChoice.sceneId");
    requireStudioChoice(scene, operation.choiceId, "operations.deleteChoice.choiceId");
    scene.choices = scene.choices.filter((choice) => choice.id !== operation.choiceId);
    return { project, selectedSceneId: scene.id };
  }

  if (operation.type === "duplicateChoice") {
    const scene = requireStudioScene(project, operation.sceneId, "operations.duplicateChoice.sceneId");
    const source = requireStudioChoice(scene, operation.choiceId, "operations.duplicateChoice.choiceId");
    const newChoiceId = operation.newChoiceId?.trim() || uniqueChoiceId(scene, `${source.id}-copy`);
    if (scene.choices.some((choice) => choice.id === newChoiceId)) {
      throw studioInputError("duplicateChoice newChoiceId가 이미 존재합니다.", "operations.duplicateChoice.newChoiceId", [scene.id], [newChoiceId]);
    }
    scene.choices.push({
      ...source,
      id: newChoiceId,
      text: operation.text?.trim() || `${source.text} 복제`
    });
    return { project, selectedSceneId: scene.id };
  }

  if (operation.type === "reorderChoice") {
    const scene = requireStudioScene(project, operation.sceneId, "operations.reorderChoice.sceneId");
    const index = scene.choices.findIndex((choice) => choice.id === operation.choiceId);
    if (index < 0) {
      throw studioInputError("Studio mutation 대상 choice를 찾을 수 없습니다.", "operations.reorderChoice.choiceId", [scene.id], [operation.choiceId]);
    }
    const [choice] = scene.choices.splice(index, 1);
    const toIndex = Math.min(scene.choices.length, Math.max(0, Math.round(operation.toIndex)));
    scene.choices.splice(toIndex, 0, choice);
    return { project, selectedSceneId: scene.id };
  }

  if (operation.type === "clearChoiceTarget") {
    const scene = requireStudioScene(project, operation.sceneId, "operations.clearChoiceTarget.sceneId");
    const choice = requireStudioChoice(scene, operation.choiceId, "operations.clearChoiceTarget.choiceId");
    choice.next = `studio-unlinked-target-${choice.id}`;
    return { project, selectedSceneId: scene.id };
  }

  if (operation.type === "unlinkSceneTarget") {
    const source = requireStudioScene(project, operation.sourceSceneId, "operations.unlinkSceneTarget.sourceSceneId");
    const edgeType = operation.edgeType || "all";
    if ((edgeType === "next" || edgeType === "all") && source.next === operation.targetSceneId) {
      source.next = undefined;
    }
    if (edgeType === "choice" || edgeType === "all") {
      source.choices.forEach((choice) => {
        if (choice.next === operation.targetSceneId) {
          choice.next = `studio-unlinked-target-${choice.id}`;
        }
      });
    }
    return { project, selectedSceneId: source.id };
  }

  if (operation.type === "setRouteEntry") {
    const route = project.routes.find((item) => item.id === operation.routeId);
    if (!route) {
      throw studioInputError("Studio mutation 대상 route를 찾을 수 없습니다.", "operations.setRouteEntry.routeId");
    }
    requireStudioScene(project, operation.sceneId, "operations.setRouteEntry.sceneId");
    route.entrySceneId = operation.sceneId;
    return { project, selectedSceneId: operation.sceneId };
  }

  throw studioInputError("지원하지 않는 Studio mutation operation입니다.", "operations.type");
}

function applyStudioOperations(project: VnMakerProject, operations: StudioMutationOperation[]): { project: VnMakerProject; selectedSceneId?: string; appliedOperations: string[] } {
  let nextProject = project;
  let selectedSceneId: string | undefined;
  const appliedOperations: string[] = [];
  operations.forEach((operation) => {
    const result = applyStudioOperation(nextProject, operation);
    nextProject = result.project;
    selectedSceneId = result.selectedSceneId || selectedSceneId;
    appliedOperations.push(operation.type);
  });
  return { project: nextProject, selectedSceneId, appliedOperations };
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

function manualTransactionalMutationResult(
  store: ProjectStore,
  input: unknown,
  mutate: (project: VnMakerProject) => { project: VnMakerProject; selectedSceneId: string }
) {
  let selectedSceneId = "";
  const result = store.applyProjectMutation({
    expectedProjectRevision: expectedProjectRevisionFrom(input),
    mutate: (project) => {
      const outcome = mutate(project);
      if (!outcome.selectedSceneId) {
        throw new Error("selectedSceneId를 결정할 수 없습니다.");
      }
      selectedSceneId = outcome.selectedSceneId;
      return outcome.project;
    }
  });
  const routeGraphAnalysis = analyzeRouteGraph(result.project);
  return {
    ok: true,
    projectDirectory: store.paths.projectDirectory,
    project: result.project,
    previousRevision: result.previousRevision,
    projectRevision: result.projectRevision,
    validation: result.validation,
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

function eventTextFailureClassification(attempts: EventTextGenerationAttempt[]): GenerationFailureClassification {
  if (attempts.some((attempt) => attempt.failureKind === "quality_rule_failed")) {
    return "generation_quality";
  }
  if (attempts.some((attempt) => attempt.failureKind === "schema_invalid" || attempt.failureKind === "engine_validation_failed")) {
    return "validation_model";
  }
  return "generation_quality";
}

function eventTextResultClassification(result: ExpandNaturalLanguageEventResult): GenerationResultClassification {
  return result.ok ? "passed" : eventTextFailureClassification(result.attempts);
}

function rawOutputMetadata(rawOutput: unknown): JsonRecord {
  return asRecord(asRecord(rawOutput).metadata);
}

function generationSourceFromRawOutput(
  rawOutput: unknown,
  fallbackSourceType: GenerationResultSourceType,
  fallbackAdapter: string
): { adapter: string; sourceType: GenerationResultSourceType } {
  const metadata = rawOutputMetadata(rawOutput);
  const adapter = typeof metadata.adapter === "string" && metadata.adapter.trim()
    ? metadata.adapter.trim()
    : fallbackAdapter;
  const provenance = typeof metadata.provenance === "string" ? metadata.provenance : "";
  const sourceType = adapter.includes("mock") || provenance.includes("alpha-sandbox")
    ? "mock"
    : fallbackSourceType;
  return { adapter, sourceType };
}

function fixedPromptEventRequest(project: VnMakerProject, store: ProjectStore, input: unknown, fixture: TestPromptFixtureDto): EventExpansionRequest {
  const record = asRecord(input);
  const route = project.routes.find((item) => item.id === record.routeId) || project.routes[0];
  if (!route) {
    throw new Error("fixed prompt replay를 실행할 루트가 없습니다.");
  }
  const afterSceneId = typeof record.afterSceneId === "string" && record.afterSceneId ? record.afterSceneId : route.entrySceneId;
  const heroineId = typeof record.heroineId === "string" && record.heroineId ? record.heroineId : route.heroineId;
  return createEventExpansionRequest(project, {
    projectDirectory: store.paths.projectDirectory,
    routeId: route.id,
    afterSceneId,
    heroineId,
    userEvent: fixture.promptText,
    constraints: record.constraints && typeof record.constraints === "object"
      ? record.constraints as Partial<EventExpansionRequest["constraints"]>
      : undefined
  });
}

function validationIssuesForGenerationResult(result: ExpandNaturalLanguageEventResult): ValidationIssue[] {
  if (result.validation) {
    return result.validation.issues;
  }
  if (!result.ok) {
    return [{ severity: "error", path: "eventText", message: result.error }];
  }
  return [];
}

function generationOutputSummary(result: ExpandNaturalLanguageEventResult): string {
  return result.ok ? result.plan.summary : result.error;
}

function createGenerationResultLog(input: {
  resultId: string;
  fixture: TestPromptFixtureDto;
  adapter: string;
  sourceType: GenerationResultSourceType;
  generatedAt: string;
  projectRevision: ProjectRevisionDto;
  outputSummary: string;
  validationIssues: ValidationIssue[];
  classification: GenerationResultClassification;
  patchHistoryId?: string;
  skippedReason?: string;
}): GenerationResultLogDto {
  const failureClassification = input.classification === "passed" ? undefined : input.classification;
  return {
    resultId: input.resultId,
    promptSetId: input.fixture.promptSetId,
    promptId: input.fixture.promptId,
    promptText: input.fixture.promptText,
    expectedElements: [...input.fixture.expectedElements],
    allowedVariation: [...input.fixture.allowedVariation],
    adapter: input.adapter,
    sourceType: input.sourceType,
    generatedAt: input.generatedAt,
    projectRevision: input.projectRevision,
    outputSummary: input.outputSummary,
    validationIssues: input.validationIssues,
    classification: input.classification,
    ...(failureClassification ? { failureClassification } : {}),
    ...(input.patchHistoryId ? { patchHistoryId: input.patchHistoryId } : {}),
    ...(input.skippedReason ? { skippedReason: input.skippedReason } : {})
  };
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

function imageFallbackReasonFromError(error: unknown): "OAUTH_REQUIRED" | "IMAGE_GENERATION_UNAVAILABLE" | null {
  const code = failureCodeFromError(error);
  if (code === "OAUTH_REQUIRED" || code === "IMAGE_GENERATION_UNAVAILABLE") {
    return code;
  }
  return null;
}

function generatedImageQuality(result: ProjectImageGenerationResult): NonNullable<ProjectImageGenerationResult["image"]>["quality"] | undefined {
  return result.image?.quality;
}

function portraitQualityIssues(result: ProjectImageGenerationResult): string[] {
  if (result.dummy || result.asset.source === "mock" || result.asset.source === "dummy") {
    return [];
  }
  if (result.asset.kind !== "portrait" && result.asset.kind !== "expression") {
    return [];
  }
  const quality = generatedImageQuality(result);
  const issues = [...(quality?.issues || [])];
  if (quality?.hasAlpha === false) {
    issues.push("알파 채널이 없어 스테이지에서 불투명 배경으로 보일 수 있습니다.");
  }
  if (quality?.transparentBackground === false) {
    issues.push("투명 배경이 확인되지 않았습니다.");
  }
  return [...new Set(issues)];
}

function withPortraitQualityProvenance(result: ProjectImageGenerationResult, issues: string[]): ProjectImageGenerationResult {
  if (result.asset.kind !== "portrait" && result.asset.kind !== "expression") {
    return result;
  }
  const quality = generatedImageQuality(result);
  return {
    ...result,
    asset: {
      ...result.asset,
      provenance: {
        ...(result.asset.provenance || {}),
        qualityStatus: issues.length > 0 ? "failed" : quality ? "passed" : "unchecked",
        ...(issues.length > 0 ? { qualityIssues: issues } : {}),
        ...(quality?.hasAlpha !== undefined ? { hasAlpha: quality.hasAlpha } : {}),
        ...(quality?.transparentBackground !== undefined ? { transparentBackground: quality.transparentBackground } : {}),
        ...(quality?.width !== undefined ? { width: quality.width } : {}),
        ...(quality?.height !== undefined ? { height: quality.height } : {})
      }
    }
  };
}

async function generateImageWithFallback(
  image: ProjectImageGenerationAdapter,
  imageFallback: ProjectImageGenerationAdapter | undefined,
  input: ProjectImageGenerationInput
): Promise<ProjectImageGenerationResult> {
  try {
    return await image.generateImageAsset(input);
  } catch (error) {
    const fallbackReason = imageFallbackReasonFromError(error);
    if (!fallbackReason || !imageFallback) {
      throw error;
    }
    return imageFallback.generateImageAsset({ ...input, fallbackReason });
  }
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
        return withStoreActionState("createProject", store, {
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
      let sourceStore: ProjectStore | null = null;
      let heroine: HeroineProfile | undefined;
      if (record.heroine) {
        heroine = requiredHeroine(input);
      } else {
        const sourceDirectory = sourceProjectDirectoryFrom(input, defaultProjectDirectory);
        sourceStore = await openProjectStore(sourceDirectory);
        heroine = sourceStore.listHeroines().find((item) => item.id === record.heroineId);
      }
      if (!heroine) {
        if (sourceStore) {
          sourceStore.close();
        }
        throw new InputValidationError("heroine 입력이 필요합니다.", [{ severity: "error", path: "heroineId", message: "히로인 라이브러리에서 찾을 수 없습니다." }]);
      }
      const project = mergeHeroineSnapshotAssets(createProjectFromHeroine({
        id: typeof record.projectId === "string" ? record.projectId : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        premise: typeof record.premise === "string" ? record.premise : undefined,
        heroine
      }), sourceStore ? sourceStore.requireProject() : null, heroine);
      await assertProjectCreationTargetAvailable(projectDirectory, project);
      const store = await createProjectWorkspace({
        projectDirectory,
        project
      });
      try {
        store.saveHeroine(heroine);
        await copyHeroineSnapshotAssets(store, sourceStore, heroine);
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
        return withStoreActionState("createProjectFromHeroine", store, {
          projectDirectory: store.paths.projectDirectory,
          paths: store.paths,
          heroine,
          project: savedProject,
          projectId: savedProject.id,
          targetRoute: `/projects/${savedProject.id}/overview`,
          validation
        }, { project: savedProject, validation });
      } finally {
        if (sourceStore) {
          sourceStore.close();
        }
        store.close();
      }
    },

    async assignHeroineSnapshot(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      let sourceStore: ProjectStore | null = null;
      try {
        const project = store.requireProject();
        let heroine = optionalHeroine(input)
          || store.listHeroines().find((item) => item.id === record.heroineId);
        if (!heroine && typeof record.heroineId === "string" && record.heroineId.trim()) {
          sourceStore = await openProjectStore(sourceProjectDirectoryFrom(input, defaultProjectDirectory));
          heroine = sourceStore.listHeroines().find((item) => item.id === record.heroineId);
        }
        if (!heroine) {
          throw new InputValidationError("heroine 입력이 필요합니다.", [{ severity: "error", path: "heroineId", message: "히로인 라이브러리에서 찾을 수 없습니다." }]);
        }
        assertCanAssignHeroineSnapshot(project, store.paths.projectDirectory);
        const nextProject = mergeHeroineSnapshotAssets(createProjectFromHeroine({
          id: project.id,
          title: project.title,
          premise: project.premise,
          heroine
        }), sourceStore?.requireProject() || null, heroine);
        const savedProject = store.saveProject(nextProject);
        await copyHeroineSnapshotAssets(store, sourceStore, heroine);
        store.recordHeroineReuse(heroine.id, savedProject);
        const validation = store.validateAndStore();
        return withStoreActionState("assignHeroineSnapshot", store, {
          projectDirectory: store.paths.projectDirectory,
          heroine,
          project: savedProject,
          validation
        }, { project: savedProject, validation });
      } finally {
        sourceStore?.close();
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
        return withStoreActionState(action, store, {
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
        const scene = requiredScene(input);
        const result = store.applyProjectMutation({
          expectedProjectRevision: expectedProjectRevisionFrom(input),
          mutate: (project) => upsertProjectScene(project, scene)
        });
        return {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          project: result.project,
          previousRevision: result.previousRevision,
          projectRevision: result.projectRevision,
          validation: result.validation
        };
      } finally {
        store.close();
      }
    },

    async insertManualScene(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return manualTransactionalMutationResult(store, input, (project) => {
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
          let route = project.routes[0];
          if (!route && linkType === "none" && project.characters[0]?.id) {
            route = {
              id: "route-main",
              title: "기본 루트",
              heroineId: project.characters[0].id,
              summary: "",
              entrySceneId: scene.id,
              endings: []
            };
            project.routes.push(route);
          }
          if (linkType === "none" && project.scenes.length === 0) {
            if (route) {
              route.entrySceneId = scene.id;
            }
            if (route && !project.settings.defaultRouteId) {
              project.settings.defaultRouteId = route.id;
            }
          }
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
          return { project, selectedSceneId: scene.id };
        });
      } finally {
        store.close();
      }
    },

    async linkManualScene(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return manualTransactionalMutationResult(store, input, (project) => {
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

          return { project, selectedSceneId: targetScene.id };
        });
      } finally {
        store.close();
      }
    },

    async setSceneEnding(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        return manualTransactionalMutationResult(store, input, (project) => {
          const sceneId = String(record.sceneId || "");
          const scene = project.scenes.find((item) => item.id === sceneId);
          if (!scene) {
            throw manualInputError("엔딩을 설정할 scene을 찾을 수 없습니다.", "sceneId", [sceneId]);
          }

          if (record.ending === null) {
            scene.ending = undefined;
            return { project, selectedSceneId: scene.id };
          }

          if ((scene.next || scene.choices.length > 0) && record.clearOutgoing !== true) {
            throw manualInputError("엔딩으로 지정하려면 다음 장면이나 선택지를 제거해야 합니다.", "clearOutgoing", [scene.id]);
          }
          if (record.clearOutgoing === true) {
            scene.next = undefined;
            scene.choices = [];
          }
          scene.ending = endingFromInput(project, scene.id, record.ending);
          return { project, selectedSceneId: scene.id };
        });
      } finally {
        store.close();
      }
    },

    async getStudioContext(input: unknown) {
      try {
        const record = asRecord(input);
        const store = await ensureProjectStore(input, defaultProjectDirectory);
        try {
          const project = store.requireProject();
          const validation = store.validateAndStore();
          const projectRevision = store.getProjectRevision();
          const previewPreflight = createPreviewPreflight(project, validation, projectRevision);
          const routeId = stringField(record, "routeId");
          const sceneId = stringField(record, "sceneId");
          const studio = createStudioViewModel(project, validation, previewPreflight, projectRevision, {
            routeId,
            selectedSceneId: sceneId,
            selectedProblemId: stringField(record, "problemId")
          });
          const problemActions = studioProblemActionsFor(project, validation, previewPreflight, projectRevision);
          return withStoreActionState("getStudioContext", store, {
            ok: true,
            projectDirectory: store.paths.projectDirectory,
            project,
            validation,
            previewPreflight,
            repairActions: repairActionsForValidation(project, validation, previewPreflight),
            problemActions,
            studio
          }, { project, validation, projectRevision });
        } finally {
          store.close();
        }
      } catch (error) {
        return projectActionFailureFromError(error, "getStudioContext");
      }
    },

    async applyStudioMutation(input: unknown) {
      try {
        const record = asRecord(input);
        const operations = studioOperationsFrom(input);
        const expectedProjectRevision = expectedProjectRevisionFrom(input);
        const store = await ensureProjectStore(input, defaultProjectDirectory);
        try {
          let selectedSceneId = stringField(record, "sceneId");
          let appliedOperations: string[] = [];
          const result = store.applyProjectMutation({
            expectedProjectRevision,
            mutate: (project) => {
              const outcome = applyStudioOperations(project, operations);
              selectedSceneId = outcome.selectedSceneId || selectedSceneId;
              appliedOperations = outcome.appliedOperations;
              return outcome.project;
            }
          });
          const routeId = stringField(record, "routeId") || result.project.routes[0]?.id;
          selectedSceneId = selectedSceneId || result.project.routes.find((route) => route.id === routeId)?.entrySceneId || result.project.scenes[0]?.id;
          const previewPreflight = createPreviewPreflight(result.project, result.validation, result.projectRevision);
          const studio = createStudioViewModel(result.project, result.validation, previewPreflight, result.projectRevision, {
            routeId,
            selectedSceneId,
            selectedProblemId: stringField(record, "problemId")
          });
          return withStoreActionState("applyStudioMutation", store, {
            ok: true,
            projectDirectory: store.paths.projectDirectory,
            project: result.project,
            previousRevision: result.previousRevision,
            projectRevision: result.projectRevision,
            validation: result.validation,
            previewPreflight,
            repairActions: repairActionsForValidation(result.project, result.validation, previewPreflight),
            problemActions: studioProblemActionsFor(result.project, result.validation, previewPreflight, result.projectRevision),
            studio,
            selectedRouteId: routeId,
            selectedSceneId,
            appliedOperations
          } satisfies StudioMutationResultDto & JsonRecord, {
            project: result.project,
            validation: result.validation,
            projectRevision: result.projectRevision
          });
        } finally {
          store.close();
        }
      } catch (error) {
        return projectActionFailureFromError(error, "applyStudioMutation");
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
        const project = store.requireProject();
        return withStoreActionState("validateProject", store, {
          ok: validation.ok,
          projectDirectory: store.paths.projectDirectory,
          issues: validation.issues,
          project,
          validation
        }, { project, validation });
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

    async listFixedPrompts(_input: unknown = {}) {
      const fixedPromptSet = fixedPromptSetDto();
      return {
        ok: true,
        fixedPromptSetId: fixedPromptSet.id,
        fixedPromptSet,
        fixtures: fixedPromptSet.fixtures
      };
    },

    async replayFixedPrompt(input: unknown) {
      const record = asRecord(input);
      const fixture = fixedPromptById(record.promptId);
      const adapterMode = fixedPromptAdapterMode(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const projectRevision = store.getProjectRevision();
        const request = fixedPromptEventRequest(project, store, input, fixture);
        const generatedAt = new Date().toISOString();
        const resultId = createGenerationResultId();
        const fixedPromptSet = fixedPromptSetDto();

        if (adapterMode === "actual" && !options.eventText) {
          const skippedReason = "actual event text adapter unavailable";
          const validationIssues: ValidationIssue[] = [{
            severity: "error",
            path: "adapterMode",
            message: skippedReason
          }];
          const generationResultLog = store.recordGenerationResultLog(createGenerationResultLog({
            resultId,
            fixture,
            adapter: "codex-event-text-adapter",
            sourceType: "unavailable",
            generatedAt,
            projectRevision,
            outputSummary: skippedReason,
            validationIssues,
            classification: "generation_quality",
            skippedReason
          }));
          return withStoreActionState("replayFixedPrompt", store, {
            ok: false,
            projectDirectory: store.paths.projectDirectory,
            project,
            fixedPromptSetId: fixedPromptSet.id,
            fixedPromptSet,
            fixedPrompt: fixture,
            generationResultId: resultId,
            generationResultLog,
            request,
            error: skippedReason,
            validation: { ok: false, issues: validationIssues }
          }, { project, validation: { ok: false, issues: validationIssues }, projectRevision });
        }

        let result: ExpandNaturalLanguageEventResult;
        try {
          result = await expandNaturalLanguageEvent({
            project,
            request,
            adapter: adapterMode === "actual" ? options.eventText : undefined
          });
        } catch (error) {
          const skippedReason = eventTextErrorMessage(error);
          const validationIssues: ValidationIssue[] = [{
            severity: "error",
            path: "eventText",
            message: skippedReason
          }];
          const source = adapterMode === "actual"
            ? { adapter: "codex-event-text-adapter", sourceType: "unavailable" as const }
            : { adapter: "deterministic-fixture-adapter", sourceType: "mock" as const };
          const generationResultLog = store.recordGenerationResultLog(createGenerationResultLog({
            resultId,
            fixture,
            adapter: source.adapter,
            sourceType: source.sourceType,
            generatedAt,
            projectRevision,
            outputSummary: skippedReason,
            validationIssues,
            classification: "generation_quality",
            skippedReason
          }));
          return withStoreActionState("replayFixedPrompt", store, {
            ok: false,
            projectDirectory: store.paths.projectDirectory,
            project,
            fixedPromptSetId: fixedPromptSet.id,
            fixedPromptSet,
            fixedPrompt: fixture,
            generationResultId: resultId,
            generationResultLog,
            request,
            error: skippedReason,
            validation: { ok: false, issues: validationIssues }
          }, { project, validation: { ok: false, issues: validationIssues }, projectRevision });
        }
        const validation = result.ok
          ? result.validation
          : result.validation || {
              ok: false,
              issues: [{ severity: "error" as const, path: "eventText", message: result.error }]
            };
        const patchHistoryEntry = result.ok
          ? store.recordPatchHistory({
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
            })
          : store.recordPatchHistory({
              status: "failed",
              summary: "fixed prompt replay 실패",
              request,
              rawOutput: result.rawOutput,
              attempts: result.attempts,
              validation
            });
        const source = adapterMode === "actual"
          ? generationSourceFromRawOutput(result.rawOutput, "actual", "codex-event-text-adapter")
          : { adapter: "deterministic-fixture-adapter", sourceType: "mock" as const };
        const generationResultLog = store.recordGenerationResultLog(createGenerationResultLog({
          resultId,
          fixture,
          adapter: source.adapter,
          sourceType: source.sourceType,
          generatedAt,
          projectRevision,
          outputSummary: generationOutputSummary(result),
          validationIssues: validationIssuesForGenerationResult(result),
          classification: eventTextResultClassification(result),
          patchHistoryId: patchHistoryEntry.id
        }));

        if (!result.ok) {
          return withStoreActionState("replayFixedPrompt", store, {
            ok: false,
            projectDirectory: store.paths.projectDirectory,
            project,
            fixedPromptSetId: fixedPromptSet.id,
            fixedPromptSet,
            fixedPrompt: fixture,
            generationResultId: resultId,
            generationResultLog,
            request,
            attempts: result.attempts,
            rawOutput: result.rawOutput,
            error: result.error,
            validation,
            patchHistoryEntry
          }, { project, validation });
        }

        return withStoreActionState("replayFixedPrompt", store, {
          projectDirectory: store.paths.projectDirectory,
          project,
          fixedPromptSetId: fixedPromptSet.id,
          fixedPromptSet,
          fixedPrompt: fixture,
          generationResultId: resultId,
          generationResultLog,
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

    async listGenerationResultLogs(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const generationResultLogs = store.listGenerationResultLogs();
        return withStoreActionState("listGenerationResultLogs", store, {
          projectDirectory: store.paths.projectDirectory,
          generationResultLogs,
          count: generationResultLogs.length
        }, { project });
      } finally {
        store.close();
      }
    },

    async recordUXDecisionEvent(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const projectRevision = store.getProjectRevision();
        const event = store.recordUXDecisionEvent(createUXDecisionEvent(input, project, projectRevision));
        return withStoreActionState("recordUXDecisionEvent", store, {
          projectDirectory: store.paths.projectDirectory,
          project,
          eventLogId: event.eventLogId,
          event,
          uxDecisionEvent: event
        }, { project, projectRevision });
      } finally {
        store.close();
      }
    },

    async listUXDecisionEvents(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const uxDecisionEvents = store.listUXDecisionEvents({
          sessionId: stringField(record, "sessionId"),
          eventLogId: stringField(record, "eventLogId")
        });
        return withStoreActionState("listUXDecisionEvents", store, {
          projectDirectory: store.paths.projectDirectory,
          uxDecisionEvents,
          events: uxDecisionEvents,
          count: uxDecisionEvents.length
        }, { project });
      } finally {
        store.close();
      }
    },

    async exportUXDecisionEventLog(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const eventLog: UXDecisionEventLogExportDto = store.exportUXDecisionEventLog({
          sessionId: stringField(record, "sessionId"),
          eventLogId: stringField(record, "eventLogId")
        });
        return withStoreActionState("exportUXDecisionEventLog", store, {
          projectDirectory: store.paths.projectDirectory,
          eventLogId: eventLog.eventLogId,
          eventLog,
          uxDecisionEvents: eventLog.events,
          events: eventLog.events
        }, { project, projectRevision: eventLog.projectRevision });
      } finally {
        store.close();
      }
    },

    async createPhase0DecisionReport(input: unknown) {
      const record = asRecord(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const projectRevision = store.getProjectRevision();
        const validationIssues = validateProjectSnapshot(project);
        const validation = {
          ok: validationIssues.every((issue) => issue.severity !== "error"),
          issues: validationIssues
        };
        const previewPreflight = createPreviewPreflight(project, validation, projectRevision);
        const sessionIds = new Set([
          ...phase0StringList(record.sessionId),
          ...phase0StringList(record.sessionIds)
        ]);
        const eventLogIds = new Set([
          ...phase0StringList(record.eventLogId),
          ...phase0StringList(record.eventLogIds)
        ]);
        const hasEventFilters = sessionIds.size > 0 || eventLogIds.size > 0;
        const events = store.listUXDecisionEvents().filter((event) =>
          !hasEventFilters || sessionIds.has(event.sessionId) || eventLogIds.has(event.eventLogId)
        );
        const participantResults = phase0ParticipantResultsFrom(input).filter((participant) =>
          sessionIds.size === 0 || sessionIds.has(participant.sessionId)
        );
        const phase0DecisionReport = createPhase0DecisionReportDto({
          project,
          projectRevision,
          previewPreflight,
          events,
          generationLogs: store.listGenerationResultLogs(),
          participantResults,
          generatedAt: stringField(record, "generatedAt") || new Date().toISOString()
        });
        return withStoreActionState("createPhase0DecisionReport", store, {
          projectDirectory: store.paths.projectDirectory,
          project,
          phase0DecisionReport,
          decision: phase0DecisionReport.decision,
          workPackages: phase0DecisionReport.workPackages,
          denominator: phase0DecisionReport.denominator,
          sessions: phase0DecisionReport.sessions
        }, { project, validation, projectRevision });
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
          return withStoreActionState("expandEvent", store, {
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
        return withStoreActionState("expandEvent", store, {
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
        const result = store.applyEventExpansionPlan({
          expectedProjectRevision: expectedProjectRevisionFrom(input),
          request: requiredEventRequest(input),
          plan: requiredEventPlan(input),
          sourcePatchHistoryId
        });
        return withStoreActionState("approveEvent", store, { projectDirectory: store.paths.projectDirectory, ...result }, {
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
        const initialPreflight = createPreviewPreflight(project, validation, store.getProjectRevision());
        if (!initialPreflight.canRun || !initialReadiness.canRun) {
          return withStoreActionState("previewProject", store, {
            ok: false,
            code: "PREVIEW_BLOCKED",
            message: initialPreflight.disabledReason || initialReadiness.failureCause,
            error: initialPreflight.disabledReason || initialReadiness.failureCause,
            projectDirectory: store.paths.projectDirectory,
            validation,
            previewReadiness: initialReadiness,
            previewPreflight: initialPreflight
          }, { project, validation });
        }
        let runtime;
        let routeGraphAnalysis;
        try {
          runtime = store.previewProject(typeof record.startSceneId === "string" ? record.startSceneId : undefined, {
            conditionPreviewPreflightSuccess: initialPreflight.canRun
          });
          routeGraphAnalysis = analyzeRouteGraph(project, typeof record.routeId === "string" ? record.routeId : undefined);
        } catch (error) {
          const validation = store.validateAndStore();
          const previewReadiness = previewReadinessFor(project, validation, {
            state: "failed",
            failureCause: messageFromError(error),
            retryable: true
          });
          return withStoreActionState("previewProject", store, {
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
          return withStoreActionState("previewProject", store, {
            ok: false,
            code: "PREVIEW_BLOCKED",
            message: previewReadiness.failureCause,
            error: previewReadiness.failureCause,
            projectDirectory: store.paths.projectDirectory,
            validation: runtime.validation,
            previewReadiness
          }, { project, validation: runtime.validation });
        }
        return withStoreActionState("previewProject", store, {
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

    async previewPreflightProject(input: unknown) {
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const validation = store.validateAndStore();
        const previewReadiness = previewReadinessFor(project, validation);
        const previewPreflight = createPreviewPreflight(project, validation, store.getProjectRevision());
        return withStoreActionState("previewPreflightProject", store, {
          projectDirectory: store.paths.projectDirectory,
          validation,
          previewReadiness,
          previewPreflight
        }, { project, validation });
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
        return withStoreActionState("exportProject", store, {
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
        return withStoreActionState("listGenerationJobs", store, { projectDirectory: store.paths.projectDirectory, jobs, backgroundPolicy: backgroundPolicy(project) }, { project });
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
            const result = withWorkspacePreviewUri(await generateImageWithFallback(options.image, options.imageFallback, generationInput));
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
        return withStoreActionState("runGenerationJobs", store, {
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
          result = withWorkspacePreviewUri(await generateImageWithFallback(options.image, options.imageFallback, generationInput));
        } catch (error) {
          return heroineImageGenerationFailure(input, error);
        }
        const qualityIssues = portraitQualityIssues(result);
        result = withPortraitQualityProvenance(result, qualityIssues);
        if (qualityIssues.length > 0) {
          return heroineFailure(input, "PORTRAIT_QUALITY_FAILED", `포트레이트 품질 확인에 실패했습니다: ${qualityIssues.join(" ")}`, {
            issues: qualityIssues.map((message) => ({
              severity: "error",
              path: "portrait.quality",
              message,
              domain: "asset"
            }))
          });
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
            job: result.job,
            dummy: result.dummy,
            fallbackReason: result.fallbackReason,
            packVersion: result.packVersion,
            sourceGeneratedBy: result.sourceGeneratedBy,
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
          job: result.job,
          dummy: result.dummy,
          fallbackReason: result.fallbackReason,
          packVersion: result.packVersion,
          sourceGeneratedBy: result.sourceGeneratedBy,
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
          const result = withWorkspacePreviewUri(await generateImageWithFallback(options.image, options.imageFallback, generationInput));
          const savedProject = await store.storeGenerationResult(result);
          return {
            ok: true,
            projectDirectory: store.paths.projectDirectory,
            project: savedProject,
            generationJobId: result.job.id,
            outputAssetId: result.asset.id,
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

    async previewRepair(input: unknown) {
      const request = repairActionRequestFrom(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const projectRevision = store.getProjectRevision();
        const validation = validationSnapshotForProject(project);
        const repairPreview = repairPreviewFor(project, projectRevision, validation, request);
        return withStoreActionState("previewRepair", store, {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          project,
          issues: validation.issues,
          validation,
          repairPreview
        }, { project, validation, projectRevision });
      } finally {
        store.close();
      }
    },

    async applyRepair(input: unknown) {
      const request = repairActionRequestFrom(input);
      const expectedProjectRevision = expectedProjectRevisionFrom(input);
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const project = store.requireProject();
        const projectRevision = assertExpectedProjectRevision(store, expectedProjectRevision);
        const validation = validationSnapshotForProject(project);
        const repairPreview = repairPreviewFor(project, projectRevision, validation, request);
        const confirmToken = String(asRecord(input).confirmToken || "");
        if (repairPreview.repairAction.destructive && confirmToken !== repairPreview.confirmToken) {
          throw new InputValidationError("destructive repair에는 올바른 confirmToken이 필요합니다.", [{
            severity: "error",
            path: "confirmToken",
            message: "수리 미리보기에서 받은 confirmToken과 일치해야 합니다."
          }]);
        }
        const result = store.applyRepairMutation({
          expectedProjectRevision,
          summary: repairPreview.expectedAfterSummary,
          diff: patchDescriptionForRepair(repairPreview),
          rawOutput: (afterRevision) => ({
            repair: {
              preview: repairPreview,
              afterRevision
            }
          }),
          mutate: (currentProject) => {
            const currentValidation = validationSnapshotForProject(currentProject);
            const currentIssue = repairIssueForRequest(currentValidation, request);
            return applyRepairMutationToProject(currentProject, request, currentIssue).project;
          }
        });
        const repairHistoryEntry = repairHistoryEntryFromPatch(result.repairHistoryEntry);
        return withStoreActionState("applyRepair", store, {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          project: result.project,
          previousRevision: result.previousRevision,
          projectRevision: result.projectRevision,
          issues: result.validation.issues,
          validation: result.validation,
          repairPreview,
          repairHistoryEntry,
          patchHistoryEntry: result.repairHistoryEntry
        }, { project: result.project, validation: result.validation, projectRevision: result.projectRevision });
      } finally {
        store.close();
      }
    },

    async undoRepair(input: unknown) {
      const record = asRecord(input);
      const repairHistoryId = String(record.repairHistoryId || record.undoToken || "");
      const store = await ensureProjectStore(input, defaultProjectDirectory);
      try {
        const latestEntry = latestUnrevertedRepairPatchEntry(store);
        if (!latestEntry) {
          throw new InputValidationError("수리 이력을 찾을 수 없습니다.", [{ severity: "error", path: "repairHistoryId", message: "수리 이력을 찾을 수 없습니다." }]);
        }
        if (repairHistoryId && repairHistoryId !== latestEntry.id) {
          throw new InputValidationError("마지막 수리만 되돌릴 수 있습니다.", [{
            severity: "error",
            path: "repairHistoryId",
            message: "마지막 수리만 되돌릴 수 있습니다."
          }]);
        }
        const previousRevision = store.getProjectRevision();
        const project = store.undoPatchHistory(latestEntry.id);
        const validation = store.validateAndStore();
        const projectRevision = store.getProjectRevision();
        const revertedEntry = store.getPatchHistoryEntry(latestEntry.id);
        return withStoreActionState("undoRepair", store, {
          ok: true,
          projectDirectory: store.paths.projectDirectory,
          project,
          previousRevision,
          projectRevision,
          issues: validation.issues,
          validation,
          repairHistoryEntry: revertedEntry ? repairHistoryEntryFromPatch(revertedEntry) : null,
          repairHistory: []
        }, { project, validation, projectRevision });
      } finally {
        store.close();
      }
    },

    validateProjectSnapshot(project: VnMakerProject) {
      const issues = validateProjectSnapshot(project);
      const validation = { ok: issues.every((issue) => issue.severity !== "error"), issues };
      return withActionState("validateProject", {
        ok: validation.ok,
        issues,
        project,
        validation
      }, { project, validation });
    }
  };
}
