export type VnMakerProjectVersion = "vn-maker/v1";
export type ValidationSeverity = "error" | "warning";
export type AssetKind = "background" | "portrait" | "expression" | "cg" | "audio" | "other";
export type GenerationJobKind = "character" | "route" | "scene" | "dialogue" | "portrait" | "expression" | "cg" | "background";
export type AssetSource = "generated" | "imported" | "placeholder" | "dummy" | "mock";
export const MOCK_IMAGE_PACK_ADAPTER = "mock-image-pack-adapter";
export type GenerationJobProvider = "codex-text-adapter" | "image-generation-adapter" | "mock-adapter" | typeof MOCK_IMAGE_PACK_ADAPTER;

const GENERATION_JOB_KINDS: readonly GenerationJobKind[] = ["character", "route", "scene", "dialogue", "portrait", "expression", "cg", "background"];

export const DEFAULT_EMOTION_TAGS = ["normal", "happy", "sad", "angry", "shy"] as const;

export interface HeroineReuseRecord {
  projectId: string;
  projectTitle: string;
  projectDirectory?: string;
  snapshotCharacterId: string;
  snapshotCreatedAt: string;
}

export interface VnMakerProject {
  version: VnMakerProjectVersion;
  id: string;
  title: string;
  premise: string;
  characters: VnMakerCharacter[];
  routes: VnMakerRoute[];
  scenes: VnMakerScene[];
  assets: VnMakerAsset[];
  generationJobs: VnMakerGenerationJob[];
  settings: VnMakerProjectSettings;
}

export const PROJECT_REVISION_HASH_ALGORITHM = "vn-maker-project-snapshot-fnv1a/v1";

export interface ProjectRevisionDto {
  revision: string;
  hashAlgorithm: typeof PROJECT_REVISION_HASH_ALGORITHM;
  createdAt: string;
}

export type GenerationFailureClassification =
  | "generation_quality"
  | "validation_model"
  | "repair_ux"
  | "preview_runtime"
  | "participant_understanding";
export type GenerationResultClassification = "passed" | GenerationFailureClassification;
export type GenerationResultSourceType = "mock" | "actual" | "unavailable";

export interface TestPromptFixtureDto {
  promptSetId: string;
  promptId: string;
  promptText: string;
  expectedElements: string[];
  allowedVariation: string[];
}

export interface TestPromptSetDto {
  id: string;
  version: string;
  label: string;
  fixtures: TestPromptFixtureDto[];
}

export interface GenerationResultLogDto {
  resultId: string;
  promptSetId: string;
  promptId: string;
  promptText: string;
  expectedElements: string[];
  allowedVariation: string[];
  adapter: string;
  sourceType: GenerationResultSourceType;
  generatedAt: string;
  projectRevision: ProjectRevisionDto;
  outputSummary: string;
  validationIssues: ValidationIssue[];
  classification: GenerationResultClassification;
  failureClassification?: GenerationFailureClassification;
  patchHistoryId?: string;
  skippedReason?: string;
}

export const UX_DECISION_EVENT_NAMES = [
  "started",
  "generated",
  "added_choices",
  "added_condition",
  "validation_failed",
  "repaired",
  "previewed",
  "abandoned",
  "help_opened",
  "hint_given",
  "recipe_used",
  "repair_action_used",
  "undo_used",
  "revert_used"
] as const;

export type UXDecisionEventName = typeof UX_DECISION_EVENT_NAMES[number];

export const UX_DECISION_HELP_CHANNELS = [
  "static_tutorial",
  "external_help",
  "inline_guide",
  "automatic_repair_suggestion",
  "moderator_hint"
] as const;

export type UXDecisionHelpChannel = typeof UX_DECISION_HELP_CHANNELS[number];
export type UXDecisionInputMode = "fixed_prompt" | "free_input" | "manual" | "generated" | string;
export type UXDecisionOutcome = "started" | "used" | "opened" | "given" | "success" | "failed" | "completed" | "blocked" | "abandoned" | "undone" | "reverted" | string;

export interface UXDecisionPreflightResultDto {
  canRun?: boolean;
  disabledReason?: string | null;
  blockers?: unknown[];
  warnings?: unknown[];
  [key: string]: unknown;
}

export interface ProjectActionEventDto {
  eventName: UXDecisionEventName;
  timestamp: string;
  correlationId: string;
  requestId: string;
  action: string;
  eventLogId?: string;
  projectId?: string;
  routeId?: string;
  sceneId?: string;
  promptId?: string;
  issueCode?: string;
  repairActionId?: string;
  outcome?: UXDecisionOutcome;
  projectRevision?: ProjectRevisionDto;
}

export interface UXDecisionEventDto {
  eventLogId: string;
  eventId: string;
  eventName: UXDecisionEventName;
  timestamp: string;
  sessionId: string;
  participantIdHash?: string;
  participantType?: string;
  taskId?: string;
  promptId?: string;
  inputMode?: UXDecisionInputMode;
  projectId: string;
  routeId?: string;
  sceneId?: string;
  issueCode?: string;
  issueCodesBefore?: string[];
  issueCodesAfter?: string[];
  repairActionId?: string;
  helpChannel?: UXDecisionHelpChannel;
  hintLevel?: number;
  elapsedMs?: number;
  stallDurationMs?: number;
  outcome?: UXDecisionOutcome;
  projectRevision: ProjectRevisionDto;
  revisionBefore?: ProjectRevisionDto;
  revisionAfter?: ProjectRevisionDto;
  preflightResult?: UXDecisionPreflightResultDto;
  correlationId?: string;
  action?: string;
  resultId?: string;
  metadata?: Record<string, unknown>;
}

export interface UXDecisionEventLogExportDto {
  eventLogId: string;
  sessionId: string;
  projectId: string;
  projectRevision: ProjectRevisionDto;
  exportedAt: string;
  events: UXDecisionEventDto[];
}

export type Phase0WorkPackageStatus = "Ready" | "Partial" | "Missing";
export type Phase0Decision = "Go" | "Iterate" | "Stop/Rethink";
export type Phase0TaskInputMode = "fixed_prompt" | "free_input" | "manual" | "generated" | string;

export interface Phase0WorkPackageStatusDto {
  id: string;
  label: string;
  status: Phase0WorkPackageStatus;
  evidence: string[];
  missing: string[];
}

export interface Phase0ParticipantResultDto {
  participantIdHash: string;
  sessionId: string;
  inputMode: Phase0TaskInputMode;
  taskId?: string;
  promptId?: string;
  vnToolCompletedCount?: number;
  professionalDeveloper?: boolean;
  regularScriptingWork?: boolean;
  storyCreatorLastYear?: boolean;
  noviceNonDevStoryCreator?: boolean;
  completed?: boolean;
  reachedValidPreview?: boolean;
  usedModeratorHint?: boolean;
  usedStaticTutorial?: boolean;
  abandoned?: boolean;
  blockingErrorCount?: number;
  completionMs?: number;
  wrongMentalModel?: boolean;
  dataLossAnxiety?: boolean;
  criticalIncidentCause?: string;
  actualPreview?: boolean;
  mockPreview?: boolean;
  notes?: string;
}

export interface Phase0GuidedRepairEvidenceDto {
  ready: boolean;
  issueCode?: string;
  repairActionId?: string;
  revisionBefore?: ProjectRevisionDto;
  revisionAfter?: ProjectRevisionDto;
  preflightResult?: UXDecisionPreflightResultDto;
  eventLogId?: string;
}

export interface Phase0SessionEvidenceDto {
  sessionId: string;
  eventLogId?: string;
  participantIdHash?: string;
  noviceNonDevStoryCreator: boolean;
  inputMode: Phase0TaskInputMode;
  taskId?: string;
  promptId?: string;
  eventNames: UXDecisionEventName[];
  completed: boolean;
  reachedValidPreview: boolean;
  usedModeratorHint: boolean;
  usedStaticTutorial: boolean;
  abandoned: boolean;
  stall90s: boolean;
  blockingErrorCount: number;
  completionMs?: number;
  wrongMentalModel: boolean;
  dataLossAnxiety: boolean;
  criticalIncidentCause?: string;
  actualPreview: boolean;
  mockPreview: boolean;
  previewPreflightCanRun: boolean;
  conditionPreviewStatus: ConditionRuntimePreviewStatus;
  guidedRepairEvidence?: Phase0GuidedRepairEvidenceDto;
}

export interface Phase0MetricDto {
  inputMode: Phase0TaskInputMode;
  sessionCount: number;
  completedCount: number;
  completionRate: number;
  guidedRepairCompletionRate: number;
  noviceNonDevStoryCreatorCount: number;
  majorityValidPreviewWithoutHint: boolean;
  medianCompletionMinutes: number | null;
  averageBlockingErrors: number;
  helpRecoveryRate: number;
  sameCauseCriticalIncidentCount: number;
  fakeOrMockPreviewCount: number;
}

export interface Phase0DenominatorDto {
  totalSessions: number;
  failedSessions: number;
  abandonedSessions: number;
  stall90sSessions: number;
  staticTutorialRecoverySessions: number;
  moderatorHintSessions: number;
  includedFailedAbandonedAndHelpRecovery: boolean;
}

export interface Phase0ConditionRuntimeDecisionDto {
  supportFlag: ConditionRuntimeSupportFlag;
  supported: boolean;
  strictPreviewStatus: ConditionRuntimePreviewStatus;
  conditionPreviewCountsAsStrictSuccess: boolean;
  actualPreviewCanRun: boolean;
  message: string;
}

export interface Phase0MockActualSeparationDto {
  combinedTotalsUsed: false;
  actualPreviewCount: number;
  fakeOrMockPreviewCount: number;
  mockGenerationResultCount: number;
  unavailableGenerationResultCount: number;
}

export interface Phase0DecisionReportDto {
  reportId: string;
  projectId: string;
  projectRevision: ProjectRevisionDto;
  generatedAt: string;
  decision: Phase0Decision;
  maximumDecisionDueToMissing?: Phase0Decision;
  decisionReasons: string[];
  workPackages: Phase0WorkPackageStatusDto[];
  sessions: Phase0SessionEvidenceDto[];
  denominator: Phase0DenominatorDto;
  fixedInputMetrics: Phase0MetricDto;
  freeInputFindings: Phase0MetricDto;
  conditionRuntime: Phase0ConditionRuntimeDecisionDto;
  mockActualSeparation: Phase0MockActualSeparationDto;
}

export type ConditionRuntimeSupportFlag = "support_false";
export type ConditionRuntimePreviewStatus = "not_evaluated";
export type ConditionRuntimeEditorMode = "candidate_review_only";

export interface ConditionRuntimeSupportDto {
  supportFlag: ConditionRuntimeSupportFlag;
  supported: boolean;
  choiceConditionFiltering: boolean;
  choiceEffects: boolean;
  conditionSemanticsVersion: string;
  strictPreviewStatus: ConditionRuntimePreviewStatus;
  strictPreviewSuccess: boolean;
  previewPreflightSuccess: boolean;
  editorMode: ConditionRuntimeEditorMode;
  reasonCode: "conditional-choice-runtime-unsupported";
  message: string;
}

export interface ConditionEvaluationTraceDto {
  status: ConditionRuntimePreviewStatus;
  reasonCode: "conditional-choice-runtime-unsupported";
  message: string;
  sceneIds: string[];
  choiceIds: string[];
  visibleChoiceIds: string[];
  hiddenChoiceIds: string[];
  appliedEffects: Array<{
    choiceId: string;
    flags: string[];
    affinity: Record<string, number>;
    memoryTags: Record<string, string[]>;
  }>;
}

export interface RuntimeCapabilitiesDto {
  choiceConditionFiltering: boolean;
  choiceEffects: boolean;
  conditionSemanticsVersion: string;
  conditionRuntimeSupport: ConditionRuntimeSupportDto;
}

export interface PreflightBlockerDto {
  issueCode: string;
  path: string;
  message: string;
  sceneIds?: string[];
  choiceIds?: string[];
  targetSceneId?: string;
  repairActionIds: string[];
}

export interface PreviewPreflightDto {
  canRun: boolean;
  blockers: PreflightBlockerDto[];
  warnings: PreflightBlockerDto[];
  disabledReason: string | null;
  nextAction: string;
  projectRevision: ProjectRevisionDto;
  runtimeCapabilities: RuntimeCapabilitiesDto;
  conditionRuntimeSupport: ConditionRuntimeSupportDto;
  conditionEvaluationTrace: ConditionEvaluationTraceDto;
}

export type StudioInspectorPanelId = "scene" | "choices" | "stats" | "assets" | "validation";
export type StudioRouteGraphEdgeKind = "route-entry" | "next" | "choice";
export type StudioIssueDefaultAction = "focus" | "repair" | "preview-blocker" | "none";

export interface StudioRouteGraphNodeDto {
  id: string;
  label: string;
  summary: string;
  routeId?: string;
  entry: boolean;
  reachable: boolean;
  unreachable: boolean;
  ending: boolean;
  problemSeverity?: ValidationSeverity;
}

export interface StudioRouteGraphEdgeDto {
  id: string;
  kind: StudioRouteGraphEdgeKind;
  sourceSceneId?: string;
  targetSceneId: string;
  choiceId?: string;
  label?: string;
  missingTarget: boolean;
}

export interface StudioRouteGraphViewDto {
  routeId: string;
  routeTitle: string;
  entrySceneId: string;
  selectedSceneId?: string;
  nodes: StudioRouteGraphNodeDto[];
  edges: StudioRouteGraphEdgeDto[];
  markers: {
    unreachableSceneIds: string[];
    missingTargetSceneIds: string[];
    problemSceneIds: string[];
    problemChoiceIds: string[];
    reachableEndingIds: string[];
    uncoveredTerminalSceneIds: string[];
  };
}

export interface StudioRouteSelectionDto {
  routeId: string;
  routeTitle: string;
  entrySceneId: string;
  selectedSceneId: string;
  selectedProblemId?: string;
  deepLinkQuery: {
    route: string;
    scene?: string;
    panel?: StudioInspectorPanelId;
    problem?: string;
  };
  availableRoutes: Array<{
    routeId: string;
    routeTitle: string;
    entrySceneId: string;
    heroineId: string;
  }>;
}

export interface StudioIssueFocusDto {
  issueId: string;
  severity: ValidationSeverity;
  issueCode: string;
  path: string;
  message: string;
  routeId?: string;
  sceneId?: string;
  choiceId?: string;
  field?: string;
  inspectorPanel: StudioInspectorPanelId;
  scriptBlockId?: string;
  defaultAction: StudioIssueDefaultAction;
  targetSceneId?: string;
  repairActionIds: string[];
}

export interface StudioPreviewPreflightViewDto {
  canRun: boolean;
  disabledReason: string | null;
  nextAction: string;
  projectRevision: ProjectRevisionDto;
  blockers: StudioIssueFocusDto[];
  warnings: StudioIssueFocusDto[];
  runtimeCapabilities: RuntimeCapabilitiesDto;
  conditionRuntimeSupport: ConditionRuntimeSupportDto;
  conditionEvaluationTrace: ConditionEvaluationTraceDto;
}

export interface StudioViewModelDto {
  projectId: string;
  projectRevision: ProjectRevisionDto;
  routeSelection: StudioRouteSelectionDto;
  routeGraph: StudioRouteGraphViewDto;
  issues: StudioIssueFocusDto[];
  previewPreflight: StudioPreviewPreflightViewDto;
  generatedAt: string;
}

export interface VnMakerProjectSettings {
  defaultRouteId: string;
  outputFileName: string;
  language: string;
}

export interface HeroineProfile {
  id: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
  portraitAssetIds: string[];
  expressionAssetIds: Record<string, string>;
  tags: string[];
  reuseHistory: HeroineReuseRecord[];
}

export interface CreateHeroineProfileInput {
  id?: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
  portraitAssetIds?: string[];
  expressionAssetIds?: Record<string, string>;
  tags?: string[];
  reuseHistory?: HeroineReuseRecord[];
}

export const DEFAULT_HEROINE_PORTRAIT_STYLE = "soft, polished romance visual novel sprite, full-body standing pose, transparent background";

export function createHeroinePortraitPrompt(heroine: Pick<HeroineProfile, "name" | "appearance">): string {
  const name = heroine.name.trim();
  const appearance = heroine.appearance.trim() || "visual novel heroine";
  return `${name}, ${appearance}, full-body standing visual novel heroine character sprite, entire body visible from head to shoes, feet fully visible, centered with margin, transparent background, clean anime style, teen safe, not a close-up, not bust-up, not waist-up, not cropped, no body parts out of frame`;
}

export interface VnMakerCharacter {
  id: string;
  displayName: string;
  role: string;
  profile: string;
  emotionTags: string[];
  portraitAssetIds: string[];
  expressionAssetIds?: Record<string, string>;
  description?: string;
  personality?: string;
  speechStyle?: string;
  appearance?: string;
  defaultPortraitAssetId?: string;
  sourceHeroineId?: string;
  sourceHeroineName?: string;
  sourceSnapshotCreatedAt?: string;
}

export interface VnMakerRoute {
  id: string;
  title: string;
  heroineId: string;
  summary: string;
  entrySceneId: string;
  endings: VnMakerEnding[];
}

export interface VnMakerEnding {
  id: string;
  title: string;
  condition: VnMakerCondition;
}

export type VnMakerEndingKind = "good" | "normal" | "bad";

export interface VnMakerSceneEnding {
  id: string;
  title: string;
  kind: VnMakerEndingKind;
}

export interface VnMakerScene {
  id: string;
  label: string;
  speaker: string;
  text: string;
  backgroundAssetId?: string;
  cgAssetId?: string;
  characters: VnMakerSceneCharacter[];
  choices: VnMakerChoice[];
  next?: string;
  ending?: VnMakerSceneEnding;
  condition?: VnMakerCondition;
  memoryTags?: Record<string, string[]>;
}

export interface VnMakerSceneCharacter {
  characterId: string;
  expression?: string;
  assetId?: string;
  position?: "left" | "center" | "right";
}

export interface VnMakerChoice {
  id: string;
  text: string;
  next: string;
  condition?: VnMakerCondition;
  effects?: VnMakerChoiceEffects;
}

export interface VnMakerCondition {
  flags?: string[];
  notFlags?: string[];
  minAffinity?: Record<string, number>;
  memoryTags?: Record<string, string[]>;
}

export interface VnMakerChoiceEffects {
  flags?: string[];
  affinity?: Record<string, number>;
  memoryTags?: Record<string, string[]>;
}

export interface VnMakerAsset {
  id: string;
  kind: AssetKind;
  label: string;
  uri?: string;
  source?: AssetSource;
  generationJobId?: string;
  provenance?: VnMakerAssetProvenance;
}

export interface VnMakerAssetProvenance {
  adapter?: GenerationJobProvider | string;
  fallbackReason?: string;
  packId?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
  license?: string;
  sourceUri?: string;
}

export interface VnMakerGenerationJob {
  id: string;
  kind: GenerationJobKind;
  targetId: string;
  prompt: string;
  style?: string;
  provider: GenerationJobProvider;
  status: "planned" | "running" | "completed" | "failed";
  outputAssetId?: string;
  failureMessage?: string;
  dummy?: boolean;
  fallbackReason?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
}

export type ValidationIssueDomain = "schema" | "route" | "asset" | "character" | "project" | "generation";
export type ValidationIssueCode = RouteGraphIssueCode;

export interface ValidationIssue {
  severity: ValidationSeverity;
  path: string;
  message: string;
  code?: ValidationIssueCode;
  domain?: ValidationIssueDomain;
  sceneIds?: string[];
  choiceIds?: string[];
  targetSceneId?: string;
}

export type RouteGraphIssueCode =
  | "missing-target"
  | "ending-has-outgoing"
  | "mixed-outgoing"
  | "uncovered-terminal"
  | "cycle-without-ending-path"
  | "duplicate-choice-id"
  | "empty-choice-text"
  | "duplicate-ending-id"
  | "invalid-ending"
  | "orphan-scene";

export interface RouteGraphIssue {
  code: RouteGraphIssueCode;
  severity: ValidationSeverity;
  sceneIds: string[];
  choiceIds?: string[];
  targetSceneId?: string;
  message: string;
}

export interface RouteGraphAnalysis {
  routeId: string;
  entrySceneId: string;
  reachableSceneIds: string[];
  orphanSceneIds: string[];
  terminalSceneIds: string[];
  reachableEndingIds: string[];
  uncoveredTerminalSceneIds: string[];
  missingTargets: Array<{ sourceSceneId: string; targetSceneId: string; edgeType: "next" | "choice"; choiceId?: string }>;
  invalidEndingOutgoingSceneIds: string[];
  mixedOutgoingSceneIds: string[];
  cyclesWithoutEndingPath: string[][];
  issues: RouteGraphIssue[];
}

export interface AssetManifest {
  projectId: string;
  requiredAssets: VnMakerAsset[];
  missingAssetReferences: string[];
  generationJobs: VnMakerGenerationJob[];
}

export interface MockImagePackManifestAsset {
  id: string;
  kind: Extract<AssetKind, "portrait" | "expression" | "cg" | "background">;
  target: string;
  filePath: string;
  label: string;
  license?: string;
  provenance: VnMakerAssetProvenance;
}

export interface MockImagePackManifest {
  id: string;
  version: string;
  adapter: typeof MOCK_IMAGE_PACK_ADAPTER;
  sourceGeneratedBy: string;
  assets: MockImagePackManifestAsset[];
}

export interface HtmlBuildArtifact {
  fileName: string;
  html: string;
}

export interface CreateProjectFromHeroineInput {
  id?: string;
  title?: string;
  premise?: string;
  heroine: HeroineProfile;
}

export interface CreateStarterProjectInput {
  id?: string;
  title?: string;
  premise?: string;
}

export interface CreateImageGenerationJobInput {
  id: string;
  kind: Extract<GenerationJobKind, "portrait" | "expression" | "cg" | "background">;
  targetId: string;
  prompt: string;
  style?: string;
  outputAssetId?: string;
}

export interface EventExpansionRequest {
  projectDirectory: string;
  baseProjectHash: string;
  routeId: string;
  afterSceneId: string;
  heroineId: string;
  userEvent: string;
  heroineContext: {
    name: string;
    description: string;
    personality: string;
    speechStyle: string;
    appearance: string;
  };
  constraints: {
    maxScenes: number;
    maxChoices: number;
    maxCgCount: number;
    allowNewExpressionAssets: false;
    language: "ko";
    contentRating: "all" | "teen";
  };
}

export interface CreateEventExpansionRequestOptions {
  projectDirectory: string;
  routeId: string;
  afterSceneId: string;
  heroineId: string;
  userEvent: string;
  constraints?: Partial<EventExpansionRequest["constraints"]>;
}

export interface EventExpansionPlan {
  summary: string;
  decision: {
    sceneCount: number;
    choiceCount: number;
    cgCount: number;
    newExpressionAssetCount: 0 | number;
    tone?: string;
  };
  patch: VnMakerProjectPatch;
}

export type VnMakerProjectPatchOperation =
  | { type: "addScene"; scene: VnMakerScene }
  | { type: "updateScene"; scene: VnMakerScene }
  | { type: "updateSceneLink"; sceneId: string; nextSceneId?: string }
  | { type: "addChoice"; sceneId: string; choice: VnMakerChoice }
  | { type: "addAsset"; asset: VnMakerAsset }
  | { type: "addGenerationJob"; job: VnMakerGenerationJob };

export interface VnMakerProjectPatch {
  operations: VnMakerProjectPatchOperation[];
}

export interface ProjectPatchDescription {
  text: string;
  sceneCount: number;
  choiceCount: number;
  assetCount: number;
  generationJobCount: number;
  operations: string[];
}

export interface EventExpansionValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  appliedProject?: VnMakerProject;
  diff: ProjectPatchDescription;
}

export type DtoParseResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

export interface EventExpansionPolicyDescription {
  allowedOperationTypes: VnMakerProjectPatchOperation["type"][];
  forbiddenOperationSummary: string[];
  alphaTarget: {
    sceneCount: number;
    choiceCount: number;
    cgCount: number;
    newExpressionAssetCount: 0;
  };
}

export interface ApplyGenerationResultToProjectInput {
  job: VnMakerGenerationJob;
  asset: VnMakerAsset;
}

export interface PlanExpressionAssetsInput {
  heroineId: string;
  tags: string[];
}

export interface ExpressionAssetPlanResult {
  project: VnMakerProject;
  tags: string[];
  assets: VnMakerAsset[];
  jobs: VnMakerGenerationJob[];
}

export interface PlayerRuntimeData {
  projectId: string;
  title: string;
  premise: string;
  routeId: string;
  startSceneId: string;
  scenes: PlayerRuntimeScene[];
  assets: VnMakerAsset[];
  validation: {
    ok: boolean;
    issues: ValidationIssue[];
  };
  conditionRuntimeSupport: ConditionRuntimeSupportDto;
  conditionEvaluationTrace: ConditionEvaluationTraceDto;
}

export interface PlayerRuntimeChoice {
  id: string;
  text: string;
  next: string;
}

export interface PlayerRuntimeScene {
  id: string;
  label: string;
  speaker: string;
  text: string;
  characters: Array<VnMakerSceneCharacter & { asset?: VnMakerAsset }>;
  choices: PlayerRuntimeChoice[];
  next?: string;
  ending?: VnMakerSceneEnding;
  backgroundAsset?: VnMakerAsset;
  cgAsset?: VnMakerAsset;
}

export interface PlayerRuntimeOptions {
  startSceneId?: string;
  assetPathRewrites?: Record<string, string>;
  conditionPreviewPreflightSuccess?: boolean;
}

export interface BuildProjectHtmlOptions extends PlayerRuntimeOptions {
  projectDataPath?: string;
  runtimeScriptPath?: string;
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function uniqueTags(values: string[]): string[] {
  return [...new Set(values.map(normalizeTag).filter(Boolean))];
}

function cloneProject(project: VnMakerProject): VnMakerProject {
  return JSON.parse(JSON.stringify(project)) as VnMakerProject;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function addSchemaIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ severity: "error", path, message });
}

function hasString(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[], options: { nonEmpty?: boolean } = {}): boolean {
  const value = record[key];
  if (typeof value !== "string") {
    addSchemaIssue(issues, path, "문자열이어야 합니다.");
    return false;
  }
  if (options.nonEmpty && !value.trim()) {
    addSchemaIssue(issues, path, "비어 있을 수 없습니다.");
    return false;
  }
  return true;
}

function hasArray(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): boolean {
  if (!Array.isArray(record[key])) {
    addSchemaIssue(issues, path, "배열이어야 합니다.");
    return false;
  }
  return true;
}

function hasObject(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): boolean {
  if (!isRecord(record[key])) {
    addSchemaIssue(issues, path, "객체여야 합니다.");
    return false;
  }
  return true;
}

function hasNumber(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): boolean {
  if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
    addSchemaIssue(issues, path, "숫자여야 합니다.");
    return false;
  }
  return true;
}

function parseOk<T>(value: T): DtoParseResult<T> {
  return { ok: true, value, issues: [] };
}

function parseFail<T>(issues: ValidationIssue[]): DtoParseResult<T> {
  return { ok: false, issues };
}

function addNestedIssues(issues: ValidationIssue[], prefix: string, nestedIssues: ValidationIssue[]): void {
  nestedIssues.forEach((issue) => {
    issues.push({
      ...issue,
      path: issue.path === "$" ? prefix : `${prefix}.${issue.path}`
    });
  });
}

function validateStringItems(values: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(values)) {
    return;
  }
  values.forEach((item, index) => {
    if (typeof item !== "string") {
      addSchemaIssue(issues, `${path}.${index}`, "문자열이어야 합니다.");
    }
  });
}

function validateStringMap(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    return;
  }
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item !== "string") {
      addSchemaIssue(issues, `${path}.${key}`, "문자열이어야 합니다.");
    }
  });
}

function validateOptionalString(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (record[key] !== undefined && typeof record[key] !== "string") {
    addSchemaIssue(issues, path, "문자열이어야 합니다.");
  }
}

function validateOptionalBoolean(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (record[key] !== undefined && typeof record[key] !== "boolean") {
    addSchemaIssue(issues, path, "boolean이어야 합니다.");
  }
}

function validateSceneEnding(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    addSchemaIssue(issues, path, "객체여야 합니다.");
    return;
  }
  hasString(value, "id", `${path}.id`, issues, { nonEmpty: true });
  hasString(value, "title", `${path}.title`, issues, { nonEmpty: true });
  hasString(value, "kind", `${path}.kind`, issues, { nonEmpty: true });
  if (typeof value.kind === "string" && !["good", "normal", "bad"].includes(value.kind)) {
    addSchemaIssue(issues, `${path}.kind`, `지원하지 않는 엔딩 종류입니다: ${value.kind}`);
  }
}

function validateOptionalObject(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (record[key] !== undefined && !isRecord(record[key])) {
    addSchemaIssue(issues, path, "객체여야 합니다.");
  }
}

function parseVnMakerChoice(value: unknown): DtoParseResult<VnMakerChoice> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "choice 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "text", "text", issues, { nonEmpty: true });
  hasString(value, "next", "next", issues, { nonEmpty: true });
  validateOptionalObject(value, "condition", "condition", issues);
  validateOptionalObject(value, "effects", "effects", issues);
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerChoice);
}

function parseVnMakerRoute(value: unknown): DtoParseResult<VnMakerRoute> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "route 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "title", "title", issues, { nonEmpty: true });
  hasString(value, "heroineId", "heroineId", issues, { nonEmpty: true });
  hasString(value, "summary", "summary", issues);
  hasString(value, "entrySceneId", "entrySceneId", issues, { nonEmpty: true });
  if (hasArray(value, "endings", "endings", issues)) {
    (value.endings as unknown[]).forEach((ending, index) => {
      if (!isRecord(ending)) {
        addSchemaIssue(issues, `endings.${index}`, "객체여야 합니다.");
        return;
      }
      hasString(ending, "id", `endings.${index}.id`, issues, { nonEmpty: true });
      hasString(ending, "title", `endings.${index}.title`, issues, { nonEmpty: true });
      hasObject(ending, "condition", `endings.${index}.condition`, issues);
    });
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerRoute);
}

function parseVnMakerAsset(value: unknown): DtoParseResult<VnMakerAsset> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "asset 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "kind", "kind", issues, { nonEmpty: true });
  hasString(value, "label", "label", issues, { nonEmpty: true });
  validateOptionalString(value, "uri", "uri", issues);
  validateOptionalString(value, "source", "source", issues);
  validateOptionalString(value, "generationJobId", "generationJobId", issues);
  validateAssetProvenanceShape(value.provenance, "provenance", issues);
  if (typeof value.kind === "string" && !["background", "portrait", "expression", "cg", "audio", "other"].includes(value.kind)) {
    addSchemaIssue(issues, "kind", `지원하지 않는 에셋 종류입니다: ${value.kind}`);
  }
  if (typeof value.source === "string" && !["generated", "imported", "placeholder", "dummy", "mock"].includes(value.source)) {
    addSchemaIssue(issues, "source", `지원하지 않는 에셋 출처입니다: ${value.source}`);
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerAsset);
}

function validateAssetProvenanceShape(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    addSchemaIssue(issues, path, "객체여야 합니다.");
    return;
  }
  ["adapter", "fallbackReason", "packId", "packVersion", "sourceGeneratedBy", "license", "sourceUri"].forEach((key) => {
    validateOptionalString(value, key, `${path}.${key}`, issues);
  });
}

function parseVnMakerGenerationJob(value: unknown): DtoParseResult<VnMakerGenerationJob> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "generationJob 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "kind", "kind", issues, { nonEmpty: true });
  hasString(value, "targetId", "targetId", issues, { nonEmpty: true });
  hasString(value, "prompt", "prompt", issues, { nonEmpty: true });
  hasString(value, "provider", "provider", issues, { nonEmpty: true });
  hasString(value, "status", "status", issues, { nonEmpty: true });
  validateOptionalString(value, "style", "style", issues);
  validateOptionalString(value, "outputAssetId", "outputAssetId", issues);
  validateOptionalString(value, "failureMessage", "failureMessage", issues);
  validateOptionalBoolean(value, "dummy", "dummy", issues);
  validateOptionalString(value, "fallbackReason", "fallbackReason", issues);
  validateOptionalString(value, "packVersion", "packVersion", issues);
  validateOptionalString(value, "sourceGeneratedBy", "sourceGeneratedBy", issues);
  if (typeof value.kind === "string" && !GENERATION_JOB_KINDS.includes(value.kind as GenerationJobKind)) {
    addSchemaIssue(issues, "kind", `지원하지 않는 생성 작업 종류입니다: ${value.kind}`);
  }
  if (typeof value.provider === "string" && !["codex-text-adapter", "image-generation-adapter", "mock-adapter", MOCK_IMAGE_PACK_ADAPTER].includes(value.provider)) {
    addSchemaIssue(issues, "provider", `지원하지 않는 생성 provider입니다: ${value.provider}`);
  }
  if (typeof value.status === "string" && !["planned", "running", "completed", "failed"].includes(value.status)) {
    addSchemaIssue(issues, "status", `지원하지 않는 생성 상태입니다: ${value.status}`);
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerGenerationJob);
}

export function parseMockImagePackManifest(value: unknown): DtoParseResult<MockImagePackManifest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "mock image pack manifest는 객체여야 합니다." }]);
  }

  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "version", "version", issues, { nonEmpty: true });
  hasString(value, "adapter", "adapter", issues, { nonEmpty: true });
  hasString(value, "sourceGeneratedBy", "sourceGeneratedBy", issues, { nonEmpty: true });
  if (typeof value.adapter === "string" && value.adapter !== MOCK_IMAGE_PACK_ADAPTER) {
    addSchemaIssue(issues, "adapter", `mock image pack adapter는 ${MOCK_IMAGE_PACK_ADAPTER}여야 합니다.`);
  }
  if (hasArray(value, "assets", "assets", issues)) {
    (value.assets as unknown[]).forEach((asset, index) => {
      const path = `assets.${index}`;
      if (!isRecord(asset)) {
        addSchemaIssue(issues, path, "객체여야 합니다.");
        return;
      }
      hasString(asset, "id", `${path}.id`, issues, { nonEmpty: true });
      hasString(asset, "kind", `${path}.kind`, issues, { nonEmpty: true });
      hasString(asset, "target", `${path}.target`, issues, { nonEmpty: true });
      hasString(asset, "filePath", `${path}.filePath`, issues, { nonEmpty: true });
      hasString(asset, "label", `${path}.label`, issues, { nonEmpty: true });
      validateOptionalString(asset, "license", `${path}.license`, issues);
      validateAssetProvenanceShape(asset.provenance, `${path}.provenance`, issues);
      if (asset.provenance === undefined) {
        addSchemaIssue(issues, `${path}.provenance`, "목 이미지 pack asset은 provenance가 필요합니다.");
      }
      if (typeof asset.kind === "string" && !["portrait", "expression", "cg", "background"].includes(asset.kind)) {
        addSchemaIssue(issues, `${path}.kind`, `지원하지 않는 목 이미지 종류입니다: ${asset.kind}`);
      }
    });
  }

  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as MockImagePackManifest);
}

function parseVnMakerProjectSettings(value: unknown): DtoParseResult<VnMakerProjectSettings> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "settings 입력은 객체여야 합니다." }]);
  }
  hasString(value, "defaultRouteId", "defaultRouteId", issues);
  hasString(value, "outputFileName", "outputFileName", issues, { nonEmpty: true });
  hasString(value, "language", "language", issues, { nonEmpty: true });
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerProjectSettings);
}

function validateProjectNestedShape(value: Record<string, unknown>, issues: ValidationIssue[]): void {
  (value.characters as unknown[]).forEach((character, index) => addNestedIssues(issues, `characters.${index}`, parseVnMakerCharacter(character).issues));
  (value.routes as unknown[]).forEach((route, index) => addNestedIssues(issues, `routes.${index}`, parseVnMakerRoute(route).issues));
  (value.scenes as unknown[]).forEach((scene, index) => addNestedIssues(issues, `scenes.${index}`, parseVnMakerScene(scene).issues));
  (value.assets as unknown[]).forEach((asset, index) => addNestedIssues(issues, `assets.${index}`, parseVnMakerAsset(asset).issues));
  (value.generationJobs as unknown[]).forEach((job, index) => addNestedIssues(issues, `generationJobs.${index}`, parseVnMakerGenerationJob(job).issues));
  addNestedIssues(issues, "settings", parseVnMakerProjectSettings(value.settings).issues);
}

export function parseVnMakerProject(value: unknown): DtoParseResult<VnMakerProject> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "프로젝트는 객체여야 합니다." }]);
  }

  if (value.version !== "vn-maker/v1") {
    addSchemaIssue(issues, "version", "지원하지 않는 프로젝트 버전입니다.");
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "title", "title", issues, { nonEmpty: true });
  hasString(value, "premise", "premise", issues);
  hasArray(value, "characters", "characters", issues);
  hasArray(value, "routes", "routes", issues);
  hasArray(value, "scenes", "scenes", issues);
  hasArray(value, "assets", "assets", issues);
  hasArray(value, "generationJobs", "generationJobs", issues);
  hasObject(value, "settings", "settings", issues);

  if (issues.length > 0) {
    return parseFail(issues);
  }

  validateProjectNestedShape(value, issues);
  if (issues.length > 0) {
    return parseFail(issues);
  }

  const project = value as unknown as VnMakerProject;
  return parseOk(project);
}

export function parseHeroineProfileInput(value: unknown): DtoParseResult<CreateHeroineProfileInput> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "heroine 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "name", "name", issues, { nonEmpty: true });
  hasString(value, "description", "description", issues, { nonEmpty: true });
  hasString(value, "personality", "personality", issues, { nonEmpty: true });
  hasString(value, "speechStyle", "speechStyle", issues, { nonEmpty: true });
  hasString(value, "appearance", "appearance", issues, { nonEmpty: true });
  if (value.defaultPortraitAssetId !== undefined && typeof value.defaultPortraitAssetId !== "string") {
    addSchemaIssue(issues, "defaultPortraitAssetId", "문자열이어야 합니다.");
  }
  if (value.portraitAssetIds !== undefined && !Array.isArray(value.portraitAssetIds)) {
    addSchemaIssue(issues, "portraitAssetIds", "배열이어야 합니다.");
  }
  if (value.expressionAssetIds !== undefined && !isRecord(value.expressionAssetIds)) {
    addSchemaIssue(issues, "expressionAssetIds", "객체여야 합니다.");
  }
  if (value.tags !== undefined && !Array.isArray(value.tags)) {
    addSchemaIssue(issues, "tags", "배열이어야 합니다.");
  }
  if (value.reuseHistory !== undefined && !Array.isArray(value.reuseHistory)) {
    addSchemaIssue(issues, "reuseHistory", "배열이어야 합니다.");
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as CreateHeroineProfileInput);
}

export function parseVnMakerCharacter(value: unknown): DtoParseResult<VnMakerCharacter> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "character 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "displayName", "displayName", issues, { nonEmpty: true });
  hasString(value, "role", "role", issues);
  hasString(value, "profile", "profile", issues);
  hasArray(value, "emotionTags", "emotionTags", issues);
  hasArray(value, "portraitAssetIds", "portraitAssetIds", issues);
  validateStringItems(value.emotionTags, "emotionTags", issues);
  validateStringItems(value.portraitAssetIds, "portraitAssetIds", issues);
  if (value.expressionAssetIds !== undefined && !isRecord(value.expressionAssetIds)) {
    addSchemaIssue(issues, "expressionAssetIds", "객체여야 합니다.");
  }
  validateStringMap(value.expressionAssetIds, "expressionAssetIds", issues);
  validateOptionalString(value, "description", "description", issues);
  validateOptionalString(value, "personality", "personality", issues);
  validateOptionalString(value, "speechStyle", "speechStyle", issues);
  validateOptionalString(value, "appearance", "appearance", issues);
  validateOptionalString(value, "defaultPortraitAssetId", "defaultPortraitAssetId", issues);
  validateOptionalString(value, "sourceHeroineId", "sourceHeroineId", issues);
  validateOptionalString(value, "sourceHeroineName", "sourceHeroineName", issues);
  validateOptionalString(value, "sourceSnapshotCreatedAt", "sourceSnapshotCreatedAt", issues);
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerCharacter);
}

export function parseVnMakerScene(value: unknown): DtoParseResult<VnMakerScene> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "scene 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "label", "label", issues, { nonEmpty: true });
  hasString(value, "speaker", "speaker", issues);
  hasString(value, "text", "text", issues);
  hasArray(value, "characters", "characters", issues);
  hasArray(value, "choices", "choices", issues);
  validateOptionalString(value, "backgroundAssetId", "backgroundAssetId", issues);
  validateOptionalString(value, "cgAssetId", "cgAssetId", issues);
  validateOptionalString(value, "next", "next", issues);
  validateSceneEnding(value.ending, "ending", issues);
  if (Array.isArray(value.characters)) {
    value.characters.forEach((character, index) => {
      if (!isRecord(character)) {
        addSchemaIssue(issues, `characters.${index}`, "객체여야 합니다.");
        return;
      }
      hasString(character, "characterId", `characters.${index}.characterId`, issues, { nonEmpty: true });
      validateOptionalString(character, "expression", `characters.${index}.expression`, issues);
      validateOptionalString(character, "assetId", `characters.${index}.assetId`, issues);
      validateOptionalString(character, "position", `characters.${index}.position`, issues);
    });
  }
  if (Array.isArray(value.choices)) {
    value.choices.forEach((choice, index) => {
      addNestedIssues(issues, `choices.${index}`, parseVnMakerChoice(choice).issues);
    });
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as VnMakerScene);
}

export function parseCreateImageGenerationJobInput(value: unknown): DtoParseResult<CreateImageGenerationJobInput> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "job 입력은 객체여야 합니다." }]);
  }
  hasString(value, "id", "id", issues, { nonEmpty: true });
  hasString(value, "kind", "kind", issues, { nonEmpty: true });
  hasString(value, "targetId", "targetId", issues, { nonEmpty: true });
  hasString(value, "prompt", "prompt", issues, { nonEmpty: true });
  if (typeof value.kind === "string" && !["portrait", "expression", "cg", "background"].includes(value.kind)) {
    addSchemaIssue(issues, "kind", `지원하지 않는 이미지 생성 작업 종류입니다: ${value.kind}`);
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as CreateImageGenerationJobInput);
}

export function parseEventExpansionRequest(value: unknown): DtoParseResult<EventExpansionRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "request 입력은 객체여야 합니다." }]);
  }
  ["projectDirectory", "baseProjectHash", "routeId", "afterSceneId", "heroineId", "userEvent"].forEach((key) => {
    hasString(value, key, key, issues, { nonEmpty: key !== "userEvent" });
  });
  hasObject(value, "heroineContext", "heroineContext", issues);
  hasObject(value, "constraints", "constraints", issues);
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as EventExpansionRequest);
}

function validatePatchOperation(operation: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(operation)) {
    addSchemaIssue(issues, path, "패치 연산은 객체여야 합니다.");
    return;
  }
  const type = operation.type;
  if (typeof type !== "string") {
    addSchemaIssue(issues, `${path}.type`, "문자열이어야 합니다.");
    return;
  }
  if (!describeEventExpansionPolicy().allowedOperationTypes.includes(type as VnMakerProjectPatchOperation["type"])) {
    addSchemaIssue(issues, `${path}.type`, `허용되지 않은 패치 연산입니다: ${type}`);
    return;
  }
  if (type === "addScene" || type === "updateScene") {
    const result = parseVnMakerScene(operation.scene);
    result.issues.forEach((issue) => addSchemaIssue(issues, `${path}.scene.${issue.path}`, issue.message));
  }
  if (type === "updateSceneLink") {
    hasString(operation, "sceneId", `${path}.sceneId`, issues, { nonEmpty: true });
    validateOptionalString(operation, "nextSceneId", `${path}.nextSceneId`, issues);
  }
  if (type === "addChoice") {
    hasString(operation, "sceneId", `${path}.sceneId`, issues, { nonEmpty: true });
    addNestedIssues(issues, `${path}.choice`, parseVnMakerChoice(operation.choice).issues);
  }
  if (type === "addAsset") {
    addNestedIssues(issues, `${path}.asset`, parseVnMakerAsset(operation.asset).issues);
  }
  if (type === "addGenerationJob") {
    addNestedIssues(issues, `${path}.job`, parseVnMakerGenerationJob(operation.job).issues);
  }
}

export function parseEventExpansionPlan(value: unknown): DtoParseResult<EventExpansionPlan> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return parseFail([{ severity: "error", path: "$", message: "EventExpansionPlan은 객체여야 합니다." }]);
  }
  hasString(value, "summary", "summary", issues);
  if (hasObject(value, "decision", "decision", issues)) {
    const decision = value.decision as Record<string, unknown>;
    hasNumber(decision, "sceneCount", "decision.sceneCount", issues);
    hasNumber(decision, "choiceCount", "decision.choiceCount", issues);
    hasNumber(decision, "cgCount", "decision.cgCount", issues);
    hasNumber(decision, "newExpressionAssetCount", "decision.newExpressionAssetCount", issues);
  }
  if (hasObject(value, "patch", "patch", issues)) {
    const patch = value.patch as Record<string, unknown>;
    if (hasArray(patch, "operations", "patch.operations", issues)) {
      (patch.operations as unknown[]).forEach((operation, index) => validatePatchOperation(operation, `patch.operations.${index}`, issues));
    }
  }
  return issues.length > 0 ? parseFail(issues) : parseOk(value as unknown as EventExpansionPlan);
}

export function describeEventExpansionPolicy(): EventExpansionPolicyDescription {
  return {
    allowedOperationTypes: ["addScene", "updateScene", "updateSceneLink", "addChoice", "addAsset", "addGenerationJob"],
    forbiddenOperationSummary: [
      "프로젝트 전체 재작성",
      "히로인 추가",
      "루트 추가",
      "씬 삭제",
      "Alpha 표정 에셋 추가"
    ],
    alphaTarget: {
      sceneCount: 3,
      choiceCount: 1,
      cgCount: 1,
      newExpressionAssetCount: 0
    }
  };
}

export function upsertProjectCharacter(project: VnMakerProject, character: VnMakerCharacter): VnMakerProject {
  const nextProject = cloneProject(project);
  const index = nextProject.characters.findIndex((item) => item.id === character.id);
  const nextCharacter = JSON.parse(JSON.stringify(character)) as VnMakerCharacter;
  if (index >= 0) {
    nextProject.characters[index] = nextCharacter;
  } else {
    nextProject.characters.push(nextCharacter);
  }
  return nextProject;
}

export function upsertProjectScene(project: VnMakerProject, scene: VnMakerScene): VnMakerProject {
  const nextProject = cloneProject(project);
  const index = nextProject.scenes.findIndex((item) => item.id === scene.id);
  const nextScene = JSON.parse(JSON.stringify(scene)) as VnMakerScene;
  if (index >= 0) {
    nextProject.scenes[index] = nextScene;
  } else {
    nextProject.scenes.push(nextScene);
  }
  return nextProject;
}

export function applyGenerationResultToProject(
  project: VnMakerProject,
  input: ApplyGenerationResultToProjectInput
): VnMakerProject {
  const nextProject = cloneProject(project);
  const assetIndex = nextProject.assets.findIndex((asset) => asset.id === input.asset.id);
  const jobIndex = nextProject.generationJobs.findIndex((job) => job.id === input.job.id);
  const asset = JSON.parse(JSON.stringify(input.asset)) as VnMakerAsset;
  const job = JSON.parse(JSON.stringify(input.job)) as VnMakerGenerationJob;

  if (assetIndex >= 0) {
    nextProject.assets[assetIndex] = asset;
  } else {
    nextProject.assets.push(asset);
  }

  if (jobIndex >= 0) {
    nextProject.generationJobs[jobIndex] = job;
  } else {
    nextProject.generationJobs.push(job);
  }

  return nextProject;
}

export function updateGenerationJobStatus(
  project: VnMakerProject,
  jobId: string,
  status: VnMakerGenerationJob["status"],
  failureMessage?: string
): VnMakerProject {
  const nextProject = cloneProject(project);
  const job = nextProject.generationJobs.find((item) => item.id === jobId);
  if (!job) {
    throw new Error(`생성 작업을 찾을 수 없습니다: ${jobId}`);
  }
  job.status = status;
  job.failureMessage = status === "failed" ? failureMessage || "생성 작업이 실패했습니다." : undefined;
  return nextProject;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashProjectSnapshot(project: VnMakerProject): string {
  return hashString(JSON.stringify(project));
}

export function createProjectRevision(project: VnMakerProject, createdAt: string): ProjectRevisionDto {
  return {
    revision: hashProjectSnapshot(project),
    hashAlgorithm: PROJECT_REVISION_HASH_ALGORITHM,
    createdAt
  };
}

const PREVIEW_REPAIR_ACTION_IDS: Record<string, string[]> = {
  "heroine-required": ["assign-heroine-snapshot"],
  "background-required": ["generate-background"],
  "route-required": ["open-studio"],
  "event-scenes-required": ["open-studio"],
  "image-generation-incomplete": ["run-generation-jobs"],
  "missing-target": ["create-target-scene", "connect-existing-scene"],
  "ending-has-outgoing": ["remove-next"],
  "mixed-outgoing": ["remove-next"],
  "uncovered-terminal": ["set-scene-ending"]
};

function previewRepairActionIds(issueCode: string | undefined): string[] {
  return issueCode ? [...(PREVIEW_REPAIR_ACTION_IDS[issueCode] || [])] : [];
}

function preflightIssueFromValidationIssue(issue: ValidationIssue): PreflightBlockerDto {
  return {
    issueCode: issue.code || "validation-issue",
    path: issue.path,
    message: issue.message,
    sceneIds: issue.sceneIds ? [...issue.sceneIds] : undefined,
    choiceIds: issue.choiceIds ? [...issue.choiceIds] : undefined,
    targetSceneId: issue.targetSceneId,
    repairActionIds: previewRepairActionIds(issue.code)
  };
}

function previewRequiredDataBlockers(project: VnMakerProject): PreflightBlockerDto[] {
  const blockers: PreflightBlockerDto[] = [];
  const hasHeroine = project.characters.length > 0;
  const backgroundJobs = project.generationJobs.filter((job) => job.kind === "background" && job.status !== "completed");
  const incompletePreviewImageJobs = project.generationJobs.filter((job) => (job.kind === "background" || job.kind === "cg") && job.status !== "completed");
  const incompleteNonBackgroundJobs = incompletePreviewImageJobs.filter((job) => job.kind !== "background");
  const hasBackgroundAsset = project.assets.some((asset) => asset.kind === "background");
  const scenesMissingBackground = project.scenes.filter((scene) => !scene.backgroundAssetId);
  const hasRoute = project.routes.length > 0;
  const hasEventScenes = project.scenes.length > 1;

  if (!hasHeroine) {
    blockers.push({
      issueCode: "heroine-required",
      path: "characters",
      message: "히로인 1명을 먼저 선택해야 프리뷰를 실행할 수 있습니다.",
      repairActionIds: previewRepairActionIds("heroine-required")
    });
  }
  if (!hasBackgroundAsset || scenesMissingBackground.length > 0 || backgroundJobs.length > 0) {
    blockers.push({
      issueCode: "background-required",
      path: !hasBackgroundAsset ? "assets" : scenesMissingBackground.length > 0 ? "scenes" : "generationJobs",
      message: backgroundJobs.length > 0
        ? `완료되지 않은 배경 화면 작업이 있습니다: ${backgroundJobs.map((job) => job.id).join(", ")}`
        : hasBackgroundAsset && scenesMissingBackground.length > 0
          ? "모든 제작 씬에 배경 화면 연결이 필요합니다."
          : "배경 화면 생성이 필요합니다.",
      sceneIds: scenesMissingBackground.length > 0 ? scenesMissingBackground.map((scene) => scene.id) : undefined,
      repairActionIds: previewRepairActionIds("background-required")
    });
  }
  if (!hasRoute) {
    blockers.push({
      issueCode: "route-required",
      path: "routes",
      message: "프리뷰 시작 루트가 필요합니다.",
      repairActionIds: previewRepairActionIds("route-required")
    });
  }
  if (!hasEventScenes) {
    blockers.push({
      issueCode: "event-scenes-required",
      path: "scenes",
      message: "제작 탭에서 이벤트와 씬을 준비해야 합니다.",
      repairActionIds: previewRepairActionIds("event-scenes-required")
    });
  }
  if (incompleteNonBackgroundJobs.length > 0) {
    blockers.push({
      issueCode: "image-generation-incomplete",
      path: "generationJobs",
      message: `완료되지 않은 이미지 작업이 있습니다: ${incompleteNonBackgroundJobs.map((job) => job.id).join(", ")}`,
      repairActionIds: previewRepairActionIds("image-generation-incomplete")
    });
  }

  return blockers;
}

const CONDITION_RUNTIME_UNSUPPORTED_REASON_CODE = "conditional-choice-runtime-unsupported" as const;
const CONDITION_RUNTIME_UNSUPPORTED_MESSAGE = "condition preview not evaluated: 조건/효과 runtime semantics는 아직 strict preview 성공으로 계산하지 않습니다.";

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function conditionalChoiceRuntimeRefs(project: VnMakerProject): { sceneIds: string[]; choiceIds: string[] } {
  const sceneIds: string[] = [];
  const choiceIds: string[] = [];
  project.scenes.forEach((scene) => {
    scene.choices.forEach((choice) => {
      if (choice.condition || choice.effects) {
        sceneIds.push(scene.id);
        choiceIds.push(choice.id);
      }
    });
  });
  return {
    sceneIds: uniqueValues(sceneIds),
    choiceIds: uniqueValues(choiceIds)
  };
}

function conditionalChoiceRuntimeWarning(project: VnMakerProject): PreflightBlockerDto | null {
  const refs = conditionalChoiceRuntimeRefs(project);
  if (refs.choiceIds.length === 0) {
    return null;
  }
  return {
    issueCode: CONDITION_RUNTIME_UNSUPPORTED_REASON_CODE,
    path: "runtimeCapabilities",
    message: CONDITION_RUNTIME_UNSUPPORTED_MESSAGE,
    sceneIds: refs.sceneIds,
    choiceIds: refs.choiceIds,
    repairActionIds: []
  };
}

export function conditionRuntimeSupportForProject(
  project: VnMakerProject,
  options: { previewPreflightSuccess?: boolean } = {}
): ConditionRuntimeSupportDto {
  return {
    supportFlag: "support_false",
    supported: false,
    choiceConditionFiltering: false,
    choiceEffects: false,
    conditionSemanticsVersion: "unsupported",
    strictPreviewStatus: "not_evaluated",
    strictPreviewSuccess: false,
    previewPreflightSuccess: options.previewPreflightSuccess ?? false,
    editorMode: "candidate_review_only",
    reasonCode: CONDITION_RUNTIME_UNSUPPORTED_REASON_CODE,
    message: conditionalChoiceRuntimeRefs(project).choiceIds.length > 0
      ? CONDITION_RUNTIME_UNSUPPORTED_MESSAGE
      : "condition preview not evaluated: Phase 0 condition runtime support is disabled, so strict preview success excludes condition evaluation."
  };
}

export function conditionEvaluationTraceForProject(project: VnMakerProject): ConditionEvaluationTraceDto {
  const refs = conditionalChoiceRuntimeRefs(project);
  return {
    status: "not_evaluated",
    reasonCode: CONDITION_RUNTIME_UNSUPPORTED_REASON_CODE,
    message: conditionRuntimeSupportForProject(project).message,
    sceneIds: refs.sceneIds,
    choiceIds: refs.choiceIds,
    visibleChoiceIds: [],
    hiddenChoiceIds: [],
    appliedEffects: []
  };
}

export function runtimeCapabilitiesForProject(
  project: VnMakerProject,
  options: { previewPreflightSuccess?: boolean } = {}
): RuntimeCapabilitiesDto {
  const conditionRuntimeSupport = conditionRuntimeSupportForProject(project, options);
  return {
    choiceConditionFiltering: conditionRuntimeSupport.choiceConditionFiltering,
    choiceEffects: conditionRuntimeSupport.choiceEffects,
    conditionSemanticsVersion: conditionRuntimeSupport.conditionSemanticsVersion,
    conditionRuntimeSupport
  };
}

function previewDisabledReason(blocker: PreflightBlockerDto | undefined): string | null {
  if (!blocker) {
    return null;
  }
  if (blocker.issueCode.endsWith("-required") || blocker.issueCode === "image-generation-incomplete") {
    return blocker.message;
  }
  return `문제 확인 결과를 먼저 해결해야 합니다. ${blocker.message}`;
}

function previewNextAction(blocker: PreflightBlockerDto | undefined): string {
  if (!blocker) {
    return "프리뷰를 실행할 수 있습니다.";
  }
  if (blocker.issueCode === "heroine-required") {
    return "히로인 탭에서 히로인 스냅샷을 배정하세요.";
  }
  if (blocker.issueCode === "background-required") {
    return "배경 화면 생성 탭에서 배경을 준비하세요.";
  }
  if (blocker.issueCode === "route-required") {
    return "제작 탭에서 프리뷰 시작 루트를 준비하세요.";
  }
  if (blocker.issueCode === "event-scenes-required") {
    return "제작 탭에서 이벤트와 씬을 준비하세요.";
  }
  if (blocker.issueCode === "image-generation-incomplete") {
    return "배경 화면 생성 탭에서 남은 이미지 작업을 완료하세요.";
  }
  return blocker.repairActionIds.length > 0
    ? `문제 패널에서 ${blocker.repairActionIds[0]} repair path를 선택하세요.`
    : "문제 패널에서 blocker를 확인하세요.";
}

export function createPreviewPreflight(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  projectRevision: ProjectRevisionDto
): PreviewPreflightDto {
  const validationBlockers = (validation.issues || [])
    .filter((issue) => issue.severity === "error")
    .map(preflightIssueFromValidationIssue);
  const blockers = [
    ...previewRequiredDataBlockers(project),
    ...validationBlockers
  ];
  const validationWarnings = (validation.issues || [])
    .filter((issue) => issue.severity !== "error")
    .map(preflightIssueFromValidationIssue);
  const conditionWarning = conditionalChoiceRuntimeWarning(project);
  const warnings = conditionWarning ? [...validationWarnings, conditionWarning] : validationWarnings;
  const canRun = blockers.length === 0;
  const conditionRuntimeSupport = conditionRuntimeSupportForProject(project, { previewPreflightSuccess: canRun });
  return {
    canRun,
    blockers,
    warnings,
    disabledReason: previewDisabledReason(blockers[0]),
    nextAction: previewNextAction(blockers[0]),
    projectRevision,
    runtimeCapabilities: runtimeCapabilitiesForProject(project, { previewPreflightSuccess: canRun }),
    conditionRuntimeSupport,
    conditionEvaluationTrace: conditionEvaluationTraceForProject(project)
  };
}

function studioIssueId(issue: Pick<ValidationIssue, "severity" | "code" | "path" | "message">): string {
  return `${issue.severity}:${issue.code || "validation-issue"}:${issue.path}:${issue.message}`;
}

function fieldFromIssuePath(path: string): string | undefined {
  const normalized = path.replace(/\]/g, "");
  const parts = normalized.split(/[.[\]]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : undefined;
}

function sceneIdFromIssuePath(project: VnMakerProject, path: string): string | undefined {
  const indexMatch = path.match(/^scenes(?:\.|\[)(\d+)(?:\]|\.)?/);
  if (indexMatch) {
    return project.scenes[Number(indexMatch[1])]?.id;
  }
  const idMatch = path.match(/^scenes(?:\.|\[)([A-Za-z0-9_-]+)(?:\]|\.)?/);
  return idMatch ? idMatch[1] : undefined;
}

function choiceIdFromIssuePath(project: VnMakerProject, sceneId: string | undefined, path: string): string | undefined {
  if (!sceneId) {
    return undefined;
  }
  const scene = project.scenes.find((item) => item.id === sceneId);
  const indexMatch = path.match(/choices(?:\.|\[)(\d+)(?:\]|\.)?/);
  if (indexMatch) {
    return scene?.choices[Number(indexMatch[1])]?.id;
  }
  const idMatch = path.match(/choices(?:\.|\[)([A-Za-z0-9_-]+)(?:\]|\.)?/);
  return idMatch ? idMatch[1] : undefined;
}

function studioPanelForIssue(issue: Pick<ValidationIssue, "path" | "choiceIds"> & { code?: string }): StudioInspectorPanelId {
  const path = issue.path || "";
  if (issue.code === CONDITION_RUNTIME_UNSUPPORTED_REASON_CODE || path.includes("condition") || path.includes("effects")) {
    return "stats";
  }
  if (path.includes("choices") || (issue.choiceIds || []).length > 0) {
    return "choices";
  }
  if (path.includes("background") || path.includes("cgAssetId") || path.includes("characters")) {
    return "assets";
  }
  if (path.includes("ending") || path.includes("next")) {
    return "choices";
  }
  return "scene";
}

function issueRepairActionIds(issue: ValidationIssue | PreflightBlockerDto): string[] {
  return "repairActionIds" in issue ? [...issue.repairActionIds] : [];
}

function issueCode(issue: ValidationIssue | PreflightBlockerDto): string {
  return ("issueCode" in issue ? issue.issueCode : issue.code) || "validation-issue";
}

export function createStudioIssueFocus(
  project: VnMakerProject,
  issue: ValidationIssue | PreflightBlockerDto,
  options: { routeId?: string; severity?: ValidationSeverity } = {}
): StudioIssueFocusDto {
  const severity = "severity" in issue ? issue.severity : options.severity || "error";
  const code = issueCode(issue);
  const pathSceneId = sceneIdFromIssuePath(project, issue.path);
  const sceneId = issue.sceneIds?.[0] || pathSceneId;
  const focusSceneId = sceneId;
  const choiceId = issue.choiceIds?.[0] || choiceIdFromIssuePath(project, focusSceneId, issue.path);
  const repairActionIds = issueRepairActionIds(issue);
  const defaultAction: StudioIssueDefaultAction = repairActionIds.length > 0
    ? "repair"
    : severity === "error"
      ? "preview-blocker"
      : code === "validation-issue"
        ? "none"
        : "focus";

  return {
    issueId: studioIssueId({ severity, code: code as ValidationIssueCode, path: issue.path, message: issue.message }),
    severity,
    issueCode: code,
    path: issue.path,
    message: issue.message,
    ...(options.routeId ? { routeId: options.routeId } : {}),
    ...(sceneId ? { sceneId } : {}),
    ...(choiceId ? { choiceId } : {}),
    ...(fieldFromIssuePath(issue.path) ? { field: fieldFromIssuePath(issue.path) } : {}),
    inspectorPanel: studioPanelForIssue({ path: issue.path, code, choiceIds: issue.choiceIds }),
    ...(sceneId ? { scriptBlockId: `scene:${sceneId}` } : {}),
    defaultAction,
    ...(issue.targetSceneId ? { targetSceneId: issue.targetSceneId } : {}),
    repairActionIds
  };
}

function selectedRouteForStudio(project: VnMakerProject, routeId?: string): VnMakerRoute | undefined {
  return project.routes.find((route) => route.id === routeId)
    || project.routes.find((route) => route.id === project.settings.defaultRouteId)
    || project.routes[0];
}

function studioSceneSummary(scene: VnMakerScene): string {
  const speaker = scene.speaker.trim();
  const text = scene.text.trim().replace(/\s+/g, " ");
  if (speaker && text) {
    return `${speaker} · ${text.slice(0, 48)}${text.length > 48 ? "..." : ""}`;
  }
  if (text) {
    return text.slice(0, 56) + (text.length > 56 ? "..." : "");
  }
  if (scene.choices.length > 0) {
    return `선택지 ${scene.choices.length}개`;
  }
  if (scene.ending) {
    return `엔딩: ${scene.ending.title}`;
  }
  return "요약 없음";
}

function issueProblemSeverity(issues: StudioIssueFocusDto[], sceneId: string): ValidationSeverity | undefined {
  const matching = issues.filter((issue) => issue.sceneId === sceneId || issue.targetSceneId === sceneId);
  if (matching.some((issue) => issue.severity === "error")) {
    return "error";
  }
  return matching.some((issue) => issue.severity === "warning") ? "warning" : undefined;
}

function edgeTargetExists(project: VnMakerProject, targetSceneId: string): boolean {
  return project.scenes.some((scene) => scene.id === targetSceneId);
}

export function createStudioRouteGraphView(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  options: { routeId?: string; selectedSceneId?: string } = {}
): StudioRouteGraphViewDto {
  const route = selectedRouteForStudio(project, options.routeId);
  const routeId = route?.id || "";
  const analysis = route ? analyzeRouteGraph(project, route.id) : null;
  const issueFocuses = (validation.issues || []).map((issue) => createStudioIssueFocus(project, issue, { routeId }));
  const reachableSceneIds = new Set(analysis?.reachableSceneIds || []);
  const entrySceneId = route?.entrySceneId || "";
  const nodes = project.scenes.map((scene) => {
    const reachable = reachableSceneIds.has(scene.id);
    const problemSeverity = issueProblemSeverity(issueFocuses, scene.id);
    return {
      id: scene.id,
      label: scene.label || scene.id,
      summary: studioSceneSummary(scene),
      ...(routeId && reachable ? { routeId } : {}),
      entry: entrySceneId === scene.id,
      reachable,
      unreachable: !reachable,
      ending: Boolean(scene.ending),
      ...(problemSeverity ? { problemSeverity } : {})
    };
  });
  const edges: StudioRouteGraphEdgeDto[] = [];
  if (entrySceneId) {
    edges.push({
      id: `route:${routeId}:entry:${entrySceneId}`,
      kind: "route-entry",
      targetSceneId: entrySceneId,
      label: route?.title || routeId,
      missingTarget: !edgeTargetExists(project, entrySceneId)
    });
  }
  project.scenes.forEach((scene) => {
    if (scene.next) {
      edges.push({
        id: `scene:${scene.id}:next:${scene.next}`,
        kind: "next",
        sourceSceneId: scene.id,
        targetSceneId: scene.next,
        label: "next",
        missingTarget: !edgeTargetExists(project, scene.next)
      });
    }
    scene.choices.forEach((choice) => {
      edges.push({
        id: `scene:${scene.id}:choice:${choice.id}:${choice.next}`,
        kind: "choice",
        sourceSceneId: scene.id,
        targetSceneId: choice.next,
        choiceId: choice.id,
        label: choice.text,
        missingTarget: !edgeTargetExists(project, choice.next)
      });
    });
  });
  const missingTargetSceneIds = uniqueValues([
    ...(analysis?.missingTargets || []).map((target) => target.targetSceneId),
    ...edges.filter((edge) => edge.missingTarget).map((edge) => edge.targetSceneId)
  ]);
  const problemSceneIds = uniqueValues(issueFocuses.flatMap((issue) => [issue.sceneId || "", issue.targetSceneId || ""]));
  const problemChoiceIds = uniqueValues(issueFocuses.map((issue) => issue.choiceId || ""));

  return {
    routeId,
    routeTitle: route?.title || routeId || "루트 없음",
    entrySceneId,
    ...(options.selectedSceneId ? { selectedSceneId: options.selectedSceneId } : {}),
    nodes,
    edges,
    markers: {
      unreachableSceneIds: analysis?.orphanSceneIds || project.scenes.filter((scene) => !reachableSceneIds.has(scene.id)).map((scene) => scene.id),
      missingTargetSceneIds,
      problemSceneIds,
      problemChoiceIds,
      reachableEndingIds: analysis?.reachableEndingIds || [],
      uncoveredTerminalSceneIds: analysis?.uncoveredTerminalSceneIds || []
    }
  };
}

export function createStudioViewModel(
  project: VnMakerProject,
  validation: { ok?: boolean; issues?: ValidationIssue[] },
  previewPreflight: PreviewPreflightDto,
  projectRevision: ProjectRevisionDto,
  options: { routeId?: string; selectedSceneId?: string; selectedProblemId?: string; panel?: StudioInspectorPanelId } = {}
): StudioViewModelDto {
  const route = selectedRouteForStudio(project, options.routeId);
  const routeId = route?.id || "";
  const selectedSceneId = options.selectedSceneId
    || route?.entrySceneId
    || project.scenes[0]?.id
    || "";
  const issueFocuses = (validation.issues || []).map((issue) => createStudioIssueFocus(project, issue, { routeId }));
  return {
    projectId: project.id,
    projectRevision,
    routeSelection: {
      routeId,
      routeTitle: route?.title || routeId || "루트 없음",
      entrySceneId: route?.entrySceneId || "",
      selectedSceneId,
      ...(options.selectedProblemId ? { selectedProblemId: options.selectedProblemId } : {}),
      deepLinkQuery: {
        route: routeId,
        ...(selectedSceneId ? { scene: selectedSceneId } : {}),
        ...(options.panel ? { panel: options.panel } : {}),
        ...(options.selectedProblemId ? { problem: options.selectedProblemId } : {})
      },
      availableRoutes: project.routes.map((item) => ({
        routeId: item.id,
        routeTitle: item.title,
        entrySceneId: item.entrySceneId,
        heroineId: item.heroineId
      }))
    },
    routeGraph: createStudioRouteGraphView(project, validation, {
      routeId,
      selectedSceneId
    }),
    issues: issueFocuses,
    previewPreflight: {
      canRun: previewPreflight.canRun,
      disabledReason: previewPreflight.disabledReason,
      nextAction: previewPreflight.nextAction,
      projectRevision: previewPreflight.projectRevision,
      blockers: previewPreflight.blockers.map((issue) => createStudioIssueFocus(project, issue, { routeId, severity: "error" })),
      warnings: previewPreflight.warnings.map((issue) => createStudioIssueFocus(project, issue, { routeId, severity: "warning" })),
      runtimeCapabilities: previewPreflight.runtimeCapabilities,
      conditionRuntimeSupport: previewPreflight.conditionRuntimeSupport,
      conditionEvaluationTrace: previewPreflight.conditionEvaluationTrace
    },
    generatedAt: projectRevision.createdAt
  };
}

function uniqueById<T extends { id: string }>(items: T[], path: string, issues: ValidationIssue[]): Set<string> {
  const ids = new Set<string>();

  items.forEach((item, index) => {
    if (!item.id.trim()) {
      issues.push({ severity: "error", path: `${path}.${index}.id`, message: "id가 비어 있습니다." });
      return;
    }

    if (ids.has(item.id)) {
      issues.push({ severity: "error", path: `${path}.${index}.id`, message: `중복 id입니다: ${item.id}` });
      return;
    }

    ids.add(item.id);
  });

  return ids;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replaceAll("</", "<\\/");
}

export function createHeroineProfile(input: CreateHeroineProfileInput): HeroineProfile {
  const id = normalizeId(input.id || input.name);
  const defaultPortraitAssetId = input.defaultPortraitAssetId || `asset-${id}-portrait`;
  const portraitAssetIds = uniqueStrings([
    defaultPortraitAssetId,
    ...(input.portraitAssetIds || [])
  ]);
  const expressionAssetIds = Object.fromEntries(
    Object.entries(input.expressionAssetIds || {})
      .map(([tag, assetId]) => [normalizeTag(tag), assetId.trim()])
      .filter(([tag, assetId]) => tag && assetId)
  );

  return {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    personality: input.personality.trim(),
    speechStyle: input.speechStyle.trim(),
    appearance: input.appearance.trim(),
    defaultPortraitAssetId,
    portraitAssetIds,
    expressionAssetIds,
    tags: uniqueTags(input.tags || []),
    reuseHistory: input.reuseHistory || []
  };
}

function heroineToCharacter(heroine: HeroineProfile): VnMakerCharacter {
  return {
    id: heroine.id,
    displayName: heroine.name,
    role: "메인 히로인",
    profile: heroine.description,
    emotionTags: uniqueTags(["normal", ...Object.keys(heroine.expressionAssetIds)]),
    portraitAssetIds: heroine.portraitAssetIds,
    expressionAssetIds: { ...heroine.expressionAssetIds },
    description: heroine.description,
    personality: heroine.personality,
    speechStyle: heroine.speechStyle,
    appearance: heroine.appearance,
    defaultPortraitAssetId: heroine.defaultPortraitAssetId,
    sourceHeroineId: heroine.id,
    sourceHeroineName: heroine.name,
    sourceSnapshotCreatedAt: new Date().toISOString()
  };
}

function characterToHeroineContext(character: VnMakerCharacter): EventExpansionRequest["heroineContext"] {
  return {
    name: character.displayName,
    description: character.description || character.profile,
    personality: character.personality || "차분한 성격",
    speechStyle: character.speechStyle || "조심스러운 말투",
    appearance: character.appearance || "교복 차림의 비주얼 노벨 히로인"
  };
}

export function createProjectFromHeroine(input: CreateProjectFromHeroineInput): VnMakerProject {
  const title = input.title || `${input.heroine.name} 프로젝트`;
  const id = input.id || normalizeId(title);
  const routeId = `${input.heroine.id}-route`;
  const openingSceneId = `scene-${input.heroine.id}-opening`;
  const defaultEndingSceneId = `scene-${input.heroine.id}-default-ending`;
  const portraitAssetId = input.heroine.defaultPortraitAssetId || input.heroine.portraitAssetIds[0] || `asset-${input.heroine.id}-portrait`;

  return {
    version: "vn-maker/v1",
    id,
    title,
    premise: input.premise || `${input.heroine.name}의 단일 루트를 제작하는 Alpha 프로젝트`,
    characters: [heroineToCharacter(input.heroine)],
    routes: [
      {
        id: routeId,
        title: `${input.heroine.name} 루트`,
        heroineId: input.heroine.id,
        summary: `${input.heroine.name}와 가까워지는 단일 Alpha 루트.`,
        entrySceneId: openingSceneId,
        endings: []
      }
    ],
    scenes: [
      {
        id: openingSceneId,
        label: `${input.heroine.name} 루트 시작`,
        speaker: "나",
        text: `${input.heroine.name}와의 이야기가 시작되려 한다.`,
        characters: [{ characterId: input.heroine.id, expression: "normal", assetId: portraitAssetId, position: "center" }],
        choices: [],
        next: defaultEndingSceneId
      },
      {
        id: defaultEndingSceneId,
        label: "기본 엔딩",
        speaker: input.heroine.name,
        text: "오늘의 이야기는 여기서 잠시 마무리된다.",
        characters: [{ characterId: input.heroine.id, expression: "normal", assetId: portraitAssetId, position: "center" }],
        choices: [],
        ending: {
          id: "ending-default",
          title: "기본 엔딩",
          kind: "normal"
        }
      }
    ],
    assets: [
      {
        id: portraitAssetId,
        kind: "portrait",
        label: `${input.heroine.name} 기본 포트레이트`,
        source: "placeholder"
      }
    ],
    generationJobs: [
      createImageGenerationJob({
        id: `job-${input.heroine.id}-portrait`,
        kind: "portrait",
        targetId: input.heroine.id,
        prompt: createHeroinePortraitPrompt(input.heroine),
        style: DEFAULT_HEROINE_PORTRAIT_STYLE,
        outputAssetId: portraitAssetId
      })
    ],
    settings: {
      defaultRouteId: routeId,
      outputFileName: "index.html",
      language: "ko"
    }
  };
}

export function createEventExpansionRequest(
  project: VnMakerProject,
  options: CreateEventExpansionRequestOptions
): EventExpansionRequest {
  const heroine = project.characters.find((character) => character.id === options.heroineId);
  if (!heroine) {
    throw new Error(`프로젝트에 히로인 스냅샷이 없습니다: ${options.heroineId}`);
  }

  return {
    projectDirectory: options.projectDirectory,
    baseProjectHash: hashProjectSnapshot(project),
    routeId: options.routeId,
    afterSceneId: options.afterSceneId,
    heroineId: options.heroineId,
    userEvent: options.userEvent,
    heroineContext: characterToHeroineContext(heroine),
    constraints: {
      maxScenes: options.constraints?.maxScenes ?? 3,
      maxChoices: options.constraints?.maxChoices ?? 1,
      maxCgCount: options.constraints?.maxCgCount ?? 1,
      allowNewExpressionAssets: false,
      language: "ko",
      contentRating: options.constraints?.contentRating ?? "teen"
    }
  };
}

export function createBlankProject(input: CreateStarterProjectInput = {}): VnMakerProject {
  const title = input.title || "새 미연시 프로젝트";
  const id = input.id || normalizeId(title);

  return {
    version: "vn-maker/v1",
    id,
    title,
    premise: input.premise || "",
    characters: [],
    routes: [],
    scenes: [],
    assets: [],
    generationJobs: [],
    settings: {
      defaultRouteId: "",
      outputFileName: "index.html",
      language: "ko"
    }
  };
}

export function createStarterProject(input: CreateStarterProjectInput = {}): VnMakerProject {
  const title = input.title || "새 미연시 프로젝트";
  const id = input.id || normalizeId(title);

  return {
    version: "vn-maker/v1",
    id,
    title,
    premise: input.premise || "Codex와 함께 만드는 고등학교 미연시",
    characters: [
      {
        id: "haru",
        displayName: "하루",
        role: "메인 히로인",
        profile: "조용하지만 게임 제작에는 누구보다 진심인 같은 반 학생.",
        emotionTags: ["normal", "happy", "shy", "worried"],
        portraitAssetIds: ["asset-haru-portrait"]
      }
    ],
    routes: [
      {
        id: "haru-route",
        title: "하루 루트",
        heroineId: "haru",
        summary: "방과 후 게임 제작을 통해 가까워지는 달달한 하루 루트.",
        entrySceneId: "scene-opening",
        endings: [
          {
            id: "good-ending",
            title: "문화제의 약속",
            condition: { flags: ["trusted-haru"] }
          }
        ]
      }
    ],
    scenes: [
      {
        id: "scene-opening",
        label: "방과 후 교실",
        speaker: "나",
        text: "텅 빈 교실에서 노트북 팬 소리만 작게 울렸다.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "normal", assetId: "asset-haru-portrait", position: "center" }],
        choices: [
          {
            id: "choice-help",
            text: "하루의 작업을 도와준다.",
            next: "scene-haru-smile",
            effects: { flags: ["trusted-haru"], affinity: { haru: 1 } }
          }
        ]
      },
      {
        id: "scene-haru-smile",
        label: "첫 번째 미소",
        speaker: "하루",
        text: "고마워. 너랑 같이 만들면, 왠지 완성할 수 있을 것 같아.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "happy", assetId: "asset-haru-portrait", position: "center" }],
        choices: [],
        ending: {
          id: "ending-default",
          title: "기본 엔딩",
          kind: "normal"
        }
      }
    ],
    assets: [
      { id: "asset-classroom-bg", kind: "background", label: "방과 후 교실", source: "placeholder" },
      { id: "asset-haru-portrait", kind: "portrait", label: "하루 기본 포트레이트", source: "placeholder" }
    ],
    generationJobs: [
      createImageGenerationJob({
        id: "job-haru-portrait",
        kind: "portrait",
        targetId: "haru",
        prompt: createHeroinePortraitPrompt({ name: "하루", appearance: "교복 차림의 고등학생 히로인" }),
        style: DEFAULT_HEROINE_PORTRAIT_STYLE,
        outputAssetId: "asset-haru-portrait"
      })
    ],
    settings: {
      defaultRouteId: "haru-route",
      outputFileName: "vn-maker-build.html",
      language: "ko"
    }
  };
}

export function createImageGenerationJob(input: CreateImageGenerationJobInput): VnMakerGenerationJob {
  return {
    id: input.id,
    kind: input.kind,
    targetId: input.targetId,
    prompt: input.prompt,
    style: input.style,
    provider: "image-generation-adapter",
    status: "planned",
    outputAssetId: input.outputAssetId
  };
}

export function planExpressionAssetsForHeroine(
  project: VnMakerProject,
  input: PlanExpressionAssetsInput
): ExpressionAssetPlanResult {
  const nextProject = cloneProject(project);
  const character = nextProject.characters.find((item) => item.id === input.heroineId);
  if (!character) {
    throw new Error(`프로젝트에 히로인 스냅샷이 없습니다: ${input.heroineId}`);
  }

  const tags = uniqueTags(input.tags);
  character.expressionAssetIds = { ...(character.expressionAssetIds || {}) };
  character.emotionTags = uniqueTags([...(character.emotionTags || []), ...tags]);

  const assets: VnMakerAsset[] = [];
  const jobs: VnMakerGenerationJob[] = [];
  const appearance = character.appearance || character.profile || character.displayName;

  for (const tag of tags) {
    const assetId = `asset-${character.id}-expression-${tag}`;
    const jobId = `job-${character.id}-expression-${tag}`;
    character.expressionAssetIds[tag] = assetId;

    const existingAsset = nextProject.assets.find((asset) => asset.id === assetId);
    const asset: VnMakerAsset = existingAsset || {
      id: assetId,
      kind: "expression",
      label: `${character.displayName} ${tag} 표정`,
      source: "placeholder",
      generationJobId: jobId
    };
    if (!existingAsset) {
      nextProject.assets.push(asset);
    }
    assets.push(asset);

    const existingJob = nextProject.generationJobs.find((job) => job.id === jobId);
    const job = existingJob || createImageGenerationJob({
      id: jobId,
      kind: "expression",
      targetId: `${character.id}:${tag}`,
      outputAssetId: assetId,
      prompt: `${character.displayName}, ${appearance}, ${tag} expression portrait, clean visual novel heroine asset, teen safe`,
      style: "consistent visual novel expression sheet, transparent background, polished anime portrait"
    });
    if (!existingJob) {
      nextProject.generationJobs.push(job);
    }
    jobs.push(job);
  }

  return {
    project: nextProject,
    tags,
    assets,
    jobs
  };
}

function createEventId(seed: string, suffix: string): string {
  return normalizeId(`${seed}-${suffix}`).slice(0, 80);
}

function requestsExplicitSceneEnding(text: string): boolean {
  return /(엔딩|굿\s*엔딩|노멀\s*엔딩|배드\s*엔딩|끝내\s*줘|결말|마지막\s*장면)/.test(text);
}

export function createDeterministicEventExpansionPlan(request: EventExpansionRequest): EventExpansionPlan {
  const seed = createEventId(`${request.heroineId}-${hashString(request.userEvent)}`, "library");
  const sceneOneId = `scene-${seed}-1`;
  const sceneTwoId = `scene-${seed}-2`;
  const sceneThreeId = `scene-${seed}-3`;
  const choiceId = `choice-${seed}-ask`;
  const cgAssetId = `asset-cg-${seed}`;
  const cgJobId = `job-cg-${seed}`;
  const heroineName = request.heroineContext.name;
  const portraitAssetId = `asset-${request.heroineId}-portrait`;
  const explicitEndingRequested = requestsExplicitSceneEnding(request.userEvent);

  return {
    summary: `${heroineName}와 도서관에서 책을 줍다가 손이 겹치는 3씬 러브코미디 이벤트를 추가합니다.`,
    decision: {
      sceneCount: 3,
      choiceCount: 1,
      cgCount: 1,
      newExpressionAssetCount: 0,
      tone: "romantic_comedy"
    },
    patch: {
      operations: [
        { type: "updateSceneLink", sceneId: request.afterSceneId, nextSceneId: sceneOneId },
        {
          type: "addScene",
          scene: {
            id: sceneOneId,
            label: "도서관의 작은 사고",
            speaker: "나",
            text: `${heroineName}가 안고 있던 책더미가 흔들리더니, 조용한 도서관 바닥에 책이 흩어졌다.`,
            characters: [{ characterId: request.heroineId, expression: "normal", assetId: portraitAssetId, position: "center" }],
            choices: [],
            next: sceneTwoId
          }
        },
        {
          type: "addScene",
          scene: {
            id: sceneTwoId,
            label: "겹쳐진 손",
            speaker: heroineName,
            text: "아, 괜찮아. 내가 주우면 되는데... 잠깐, 손이...",
            cgAssetId,
            characters: [{ characterId: request.heroineId, expression: "shy", assetId: portraitAssetId, position: "center" }],
            choices: []
          }
        },
        {
          type: "addChoice",
          sceneId: sceneTwoId,
          choice: {
            id: choiceId,
            text: "괜찮은지 조심스럽게 묻는다.",
            next: sceneThreeId,
            effects: { flags: ["library-haru-kindness"], affinity: { [request.heroineId]: 1 } }
          }
        },
        {
          type: "addScene",
          scene: {
            id: sceneThreeId,
            label: "어색한 침묵",
            speaker: heroineName,
            text: "괜찮아. 그런데... 방금 건 아무한테도 말하지 말아줘.",
            characters: [{ characterId: request.heroineId, expression: "shy", assetId: portraitAssetId, position: "center" }],
            choices: [],
            ending: explicitEndingRequested
              ? {
                  id: `ending-${seed}`,
                  title: `${heroineName}와의 작은 비밀`,
                  kind: "normal"
                }
              : undefined
          }
        },
        {
          type: "addAsset",
          asset: {
            id: cgAssetId,
            kind: "cg",
            label: `${heroineName}와 도서관에서 손이 겹치는 CG`,
            source: "placeholder",
            generationJobId: cgJobId
          }
        },
        {
          type: "addGenerationJob",
          job: createImageGenerationJob({
            id: cgJobId,
            kind: "cg",
            targetId: sceneTwoId,
            outputAssetId: cgAssetId,
            prompt: `${heroineName} and protagonist reaching for fallen books in a quiet school library, hands accidentally touching, romantic comedy visual novel CG, teen safe, ${request.heroineContext.appearance}`,
            style: "soft visual novel cg, warm library light, non-explicit, school romance"
          })
        }
      ]
    }
  };
}

export function describeProjectPatch(patch: VnMakerProjectPatch): ProjectPatchDescription {
  const sceneCount = patch.operations.filter((operation) => operation.type === "addScene").length;
  const choiceCount = patch.operations.filter((operation) => operation.type === "addChoice").length;
  const assetCount = patch.operations.filter((operation) => operation.type === "addAsset").length;
  const generationJobCount = patch.operations.filter((operation) => operation.type === "addGenerationJob").length;
  const operations = patch.operations.map((operation) => {
    if (operation.type === "addScene") {
      return `씬 추가: ${operation.scene.label} (${operation.scene.id})`;
    }
    if (operation.type === "updateScene") {
      return `씬 수정: ${operation.scene.label} (${operation.scene.id})`;
    }
    if (operation.type === "updateSceneLink") {
      return `씬 연결 수정: ${operation.sceneId} -> ${operation.nextSceneId || "끝"}`;
    }
    if (operation.type === "addChoice") {
      return `선택지 추가: ${operation.choice.text} (${operation.sceneId})`;
    }
    if (operation.type === "addAsset") {
      return `에셋 추가: ${operation.asset.label} (${operation.asset.kind})`;
    }
    return `CG 작업 추가: ${operation.job.prompt}`;
  });

  return {
    text: `씬 ${sceneCount}개, 선택지 ${choiceCount}개, 에셋 ${assetCount}개, CG 작업 ${generationJobCount}개 변경`,
    sceneCount,
    choiceCount,
    assetCount,
    generationJobCount,
    operations
  };
}

export function applyProjectPatch(project: VnMakerProject, patch: VnMakerProjectPatch): VnMakerProject {
  const nextProject = cloneProject(project);

  for (const operation of patch.operations) {
    if (operation.type === "addScene") {
      if (nextProject.scenes.some((scene) => scene.id === operation.scene.id)) {
        throw new Error(`이미 존재하는 씬입니다: ${operation.scene.id}`);
      }
      nextProject.scenes.push(JSON.parse(JSON.stringify(operation.scene)) as VnMakerScene);
    } else if (operation.type === "updateScene") {
      const sceneIndex = nextProject.scenes.findIndex((scene) => scene.id === operation.scene.id);
      if (sceneIndex < 0) {
        throw new Error(`수정할 씬을 찾을 수 없습니다: ${operation.scene.id}`);
      }
      nextProject.scenes[sceneIndex] = JSON.parse(JSON.stringify(operation.scene)) as VnMakerScene;
    } else if (operation.type === "updateSceneLink") {
      const scene = nextProject.scenes.find((item) => item.id === operation.sceneId);
      if (!scene) {
        throw new Error(`연결할 씬을 찾을 수 없습니다: ${operation.sceneId}`);
      }
      scene.next = operation.nextSceneId;
    } else if (operation.type === "addChoice") {
      const scene = nextProject.scenes.find((item) => item.id === operation.sceneId);
      if (!scene) {
        throw new Error(`선택지를 추가할 씬을 찾을 수 없습니다: ${operation.sceneId}`);
      }
      if (scene.choices.some((choice) => choice.id === operation.choice.id)) {
        throw new Error(`이미 존재하는 선택지입니다: ${operation.choice.id}`);
      }
      scene.choices.push(JSON.parse(JSON.stringify(operation.choice)) as VnMakerChoice);
    } else if (operation.type === "addAsset") {
      if (nextProject.assets.some((asset) => asset.id === operation.asset.id)) {
        throw new Error(`이미 존재하는 에셋입니다: ${operation.asset.id}`);
      }
      nextProject.assets.push(JSON.parse(JSON.stringify(operation.asset)) as VnMakerAsset);
    } else if (operation.type === "addGenerationJob") {
      if (nextProject.generationJobs.some((job) => job.id === operation.job.id)) {
        throw new Error(`이미 존재하는 생성 작업입니다: ${operation.job.id}`);
      }
      nextProject.generationJobs.push(JSON.parse(JSON.stringify(operation.job)) as VnMakerGenerationJob);
    } else {
      const unknown = operation as { type?: string };
      throw new Error(`허용되지 않은 패치 연산입니다: ${unknown.type || "unknown"}`);
    }
  }

  return nextProject;
}

function addIssue(issues: ValidationIssue[], path: string, message: string, severity: ValidationSeverity = "error"): void {
  issues.push({ severity, path, message });
}

function addRouteGraphIssue(
  issues: RouteGraphIssue[],
  issue: RouteGraphIssue
): void {
  issues.push(issue);
}

function isSceneEnding(value: unknown): value is VnMakerSceneEnding {
  return isRecord(value)
    && typeof value.id === "string"
    && Boolean(value.id.trim())
    && typeof value.title === "string"
    && Boolean(value.title.trim())
    && typeof value.kind === "string"
    && ["good", "normal", "bad"].includes(value.kind);
}

function routeGraphIssuePath(project: VnMakerProject, issue: RouteGraphIssue): string {
  const sceneId = issue.sceneIds[0];
  const sceneIndex = project.scenes.findIndex((scene) => scene.id === sceneId);
  if (sceneIndex < 0) {
    return "routes";
  }
  if (issue.choiceIds?.[0]) {
    const choiceIndex = project.scenes[sceneIndex].choices.findIndex((choice) => choice.id === issue.choiceIds?.[0]);
    return choiceIndex >= 0 ? `scenes.${sceneIndex}.choices.${choiceIndex}` : `scenes.${sceneIndex}.choices`;
  }
  if (issue.code === "invalid-ending" || issue.code === "duplicate-ending-id" || issue.code === "ending-has-outgoing") {
    return `scenes.${sceneIndex}.ending`;
  }
  if (issue.code === "mixed-outgoing") {
    return `scenes.${sceneIndex}`;
  }
  return `scenes.${sceneIndex}`;
}

function routeGraphIssueToValidationIssue(project: VnMakerProject, issue: RouteGraphIssue): ValidationIssue {
  return {
    code: issue.code,
    domain: "route",
    severity: issue.severity,
    path: routeGraphIssuePath(project, issue),
    message: issue.message,
    sceneIds: [...issue.sceneIds],
    choiceIds: issue.choiceIds ? [...issue.choiceIds] : undefined,
    targetSceneId: issue.targetSceneId
  };
}

export function analyzeRouteGraph(project: VnMakerProject, routeId?: string): RouteGraphAnalysis {
  const route = routeId
    ? project.routes.find((item) => item.id === routeId)
    : project.routes.find((item) => item.id === project.settings.defaultRouteId) || project.routes[0];
  const routeIdValue = route?.id || routeId || "";
  const entrySceneId = route?.entrySceneId || "";
  const sceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const issues: RouteGraphIssue[] = [];
  const reachableSceneIds: string[] = [];
  const reachableSet = new Set<string>();
  const terminalSceneIds: string[] = [];
  const terminalSet = new Set<string>();
  const reachableEndingIds: string[] = [];
  const uncoveredTerminalSceneIds: string[] = [];
  const missingTargets: RouteGraphAnalysis["missingTargets"] = [];
  const invalidEndingOutgoingSceneIds: string[] = [];
  const mixedOutgoingSceneIds: string[] = [];
  const graphEdges = new Map<string, string[]>();
  const endingSceneById = new Map<string, string>();

  function markTerminal(sceneId: string): void {
    if (!terminalSet.has(sceneId)) {
      terminalSet.add(sceneId);
      terminalSceneIds.push(sceneId);
    }
  }

  function inspectScene(scene: VnMakerScene): Array<{ targetSceneId: string; edgeType: "next" | "choice"; choiceId?: string }> {
    const edges: Array<{ targetSceneId: string; edgeType: "next" | "choice"; choiceId?: string }> = [];
    const choiceIds = new Set<string>();
    const duplicateChoiceIds = new Set<string>();

    scene.choices.forEach((choice) => {
      if (!choice.id.trim() || choiceIds.has(choice.id)) {
        duplicateChoiceIds.add(choice.id);
      }
      choiceIds.add(choice.id);
      if (!choice.text.trim()) {
        addRouteGraphIssue(issues, {
          code: "empty-choice-text",
          severity: "error",
          sceneIds: [scene.id],
          choiceIds: [choice.id],
          message: "선택지 문구가 비어 있습니다."
        });
      }
    });

    duplicateChoiceIds.forEach((choiceId) => {
      addRouteGraphIssue(issues, {
        code: "duplicate-choice-id",
        severity: "error",
        sceneIds: [scene.id],
        choiceIds: choiceId ? [choiceId] : undefined,
        message: `같은 장면 안에 중복 선택지 id가 있습니다: ${choiceId || "(empty)"}`
      });
    });

    if (scene.ending !== undefined && !isSceneEnding(scene.ending)) {
      addRouteGraphIssue(issues, {
        code: "invalid-ending",
        severity: "error",
        sceneIds: [scene.id],
        message: "엔딩 정보가 올바르지 않습니다."
      });
    }

    if (isSceneEnding(scene.ending)) {
      markTerminal(scene.id);
      reachableEndingIds.push(scene.ending.id);
      const duplicateSceneId = endingSceneById.get(scene.ending.id);
      if (duplicateSceneId) {
        addRouteGraphIssue(issues, {
          code: "duplicate-ending-id",
          severity: "error",
          sceneIds: [duplicateSceneId, scene.id],
          message: `같은 route 안에 중복 엔딩 id가 있습니다: ${scene.ending.id}`
        });
      } else {
        endingSceneById.set(scene.ending.id, scene.id);
      }
      if (scene.next || scene.choices.length > 0) {
        invalidEndingOutgoingSceneIds.push(scene.id);
        addRouteGraphIssue(issues, {
          code: "ending-has-outgoing",
          severity: "error",
          sceneIds: [scene.id],
          message: "엔딩 장면에는 다음 장면이나 선택지가 있을 수 없습니다."
        });
      }
      return [];
    }

    if (scene.choices.length > 0) {
      if (scene.next) {
        mixedOutgoingSceneIds.push(scene.id);
        addRouteGraphIssue(issues, {
          code: "mixed-outgoing",
          severity: "error",
          sceneIds: [scene.id],
          message: "같은 장면에 next와 choices를 동시에 둘 수 없습니다."
        });
      }
      scene.choices.forEach((choice) => {
        edges.push({ targetSceneId: choice.next, edgeType: "choice", choiceId: choice.id });
      });
      return edges;
    }

    if (scene.next) {
      edges.push({ targetSceneId: scene.next, edgeType: "next" });
      return edges;
    }

    markTerminal(scene.id);
    uncoveredTerminalSceneIds.push(scene.id);
    addRouteGraphIssue(issues, {
      code: "uncovered-terminal",
      severity: "error",
      sceneIds: [scene.id],
      message: "이 분기는 엔딩 없이 끝납니다."
    });
    return [];
  }

  function visit(sceneId: string): void {
    if (reachableSet.has(sceneId)) {
      return;
    }
    const scene = sceneMap.get(sceneId);
    if (!scene) {
      return;
    }
    reachableSet.add(sceneId);
    reachableSceneIds.push(sceneId);

    const outgoing = inspectScene(scene);
    const validTargets: string[] = [];
    outgoing.forEach((edge) => {
      if (!sceneMap.has(edge.targetSceneId)) {
        missingTargets.push({
          sourceSceneId: scene.id,
          targetSceneId: edge.targetSceneId,
          edgeType: edge.edgeType,
          choiceId: edge.choiceId
        });
        addRouteGraphIssue(issues, {
          code: "missing-target",
          severity: "error",
          sceneIds: [scene.id],
          choiceIds: edge.choiceId ? [edge.choiceId] : undefined,
          targetSceneId: edge.targetSceneId,
          message: `${edge.edgeType === "choice" ? "선택지" : "다음 장면"}가 존재하지 않는 장면으로 이동합니다: ${edge.targetSceneId}`
        });
        return;
      }
      validTargets.push(edge.targetSceneId);
    });
    graphEdges.set(sceneId, validTargets);
    validTargets.forEach((targetSceneId) => visit(targetSceneId));
  }

  if (entrySceneId) {
    if (sceneMap.has(entrySceneId)) {
      visit(entrySceneId);
    } else {
      missingTargets.push({ sourceSceneId: routeIdValue, targetSceneId: entrySceneId, edgeType: "next" });
      addRouteGraphIssue(issues, {
        code: "missing-target",
        severity: "error",
        sceneIds: [],
        targetSceneId: entrySceneId,
        message: `route entrySceneId가 존재하지 않는 장면을 가리킵니다: ${entrySceneId}`
      });
    }
  }

  const orphanSceneIds = project.scenes
    .map((scene) => scene.id)
    .filter((sceneId) => !reachableSet.has(sceneId));
  orphanSceneIds.forEach((sceneId) => {
    addRouteGraphIssue(issues, {
      code: "orphan-scene",
      severity: "warning",
      sceneIds: [sceneId],
      message: `route entry에서 도달할 수 없는 장면입니다: ${sceneId}`
    });
  });

  const canReachEndingMemo = new Map<string, boolean>();
  function canReachEnding(sceneId: string, visiting = new Set<string>()): boolean {
    if (canReachEndingMemo.has(sceneId)) {
      return canReachEndingMemo.get(sceneId) || false;
    }
    const scene = sceneMap.get(sceneId);
    if (!scene) {
      canReachEndingMemo.set(sceneId, false);
      return false;
    }
    if (isSceneEnding(scene.ending)) {
      canReachEndingMemo.set(sceneId, true);
      return true;
    }
    if (visiting.has(sceneId)) {
      return false;
    }
    visiting.add(sceneId);
    const reaches = (graphEdges.get(sceneId) || []).some((targetSceneId) => canReachEnding(targetSceneId, visiting));
    visiting.delete(sceneId);
    canReachEndingMemo.set(sceneId, reaches);
    return reaches;
  }

  const indexByScene = new Map<string, number>();
  const lowlinkByScene = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclesWithoutEndingPath: string[][] = [];
  let nextIndex = 0;

  function strongConnect(sceneId: string): void {
    indexByScene.set(sceneId, nextIndex);
    lowlinkByScene.set(sceneId, nextIndex);
    nextIndex += 1;
    stack.push(sceneId);
    onStack.add(sceneId);

    (graphEdges.get(sceneId) || []).forEach((targetSceneId) => {
      if (!reachableSet.has(targetSceneId)) {
        return;
      }
      if (!indexByScene.has(targetSceneId)) {
        strongConnect(targetSceneId);
        lowlinkByScene.set(sceneId, Math.min(lowlinkByScene.get(sceneId) || 0, lowlinkByScene.get(targetSceneId) || 0));
      } else if (onStack.has(targetSceneId)) {
        lowlinkByScene.set(sceneId, Math.min(lowlinkByScene.get(sceneId) || 0, indexByScene.get(targetSceneId) || 0));
      }
    });

    if (lowlinkByScene.get(sceneId) !== indexByScene.get(sceneId)) {
      return;
    }

    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (!current) {
        break;
      }
      onStack.delete(current);
      component.push(current);
    } while (current !== sceneId);

    const hasSelfLoop = component.length === 1 && (graphEdges.get(component[0]) || []).includes(component[0]);
    const isCycle = component.length > 1 || hasSelfLoop;
    if (isCycle && !component.some((componentSceneId) => canReachEnding(componentSceneId))) {
      const orderedComponent = component.sort((left, right) => reachableSceneIds.indexOf(left) - reachableSceneIds.indexOf(right));
      cyclesWithoutEndingPath.push(orderedComponent);
      addRouteGraphIssue(issues, {
        code: "cycle-without-ending-path",
        severity: "error",
        sceneIds: orderedComponent,
        message: "선택지 분기가 엔딩에 도달하지 못하고 순환합니다."
      });
    }
  }

  reachableSceneIds.forEach((sceneId) => {
    if (!indexByScene.has(sceneId)) {
      strongConnect(sceneId);
    }
  });

  return {
    routeId: routeIdValue,
    entrySceneId,
    reachableSceneIds,
    orphanSceneIds,
    terminalSceneIds,
    reachableEndingIds,
    uncoveredTerminalSceneIds,
    missingTargets,
    invalidEndingOutgoingSceneIds,
    mixedOutgoingSceneIds,
    cyclesWithoutEndingPath,
    issues
  };
}

export function validateEventExpansionPlan(
  project: VnMakerProject,
  request: EventExpansionRequest,
  plan: EventExpansionPlan
): EventExpansionValidationResult {
  const issues: ValidationIssue[] = [];
  const parsedPlan = parseEventExpansionPlan(plan);
  const diff = parsedPlan.ok
    ? describeProjectPatch(parsedPlan.value.patch)
    : {
        text: "패치 schema 검증 실패",
        sceneCount: 0,
        choiceCount: 0,
        assetCount: 0,
        generationJobCount: 0,
        operations: []
      };

  if (!parsedPlan.ok) {
    return { ok: false, issues: parsedPlan.issues, diff };
  }

  const eventPlan = parsedPlan.value;

  if (project.characters.length !== 1) {
    addIssue(issues, "characters", "Alpha 프로젝트는 히로인 1명만 포함해야 합니다.");
  }
  if (project.routes.length !== 1) {
    addIssue(issues, "routes", "Alpha 프로젝트는 루트 1개만 포함해야 합니다.");
  }
  if (!project.routes.some((route) => route.id === request.routeId && route.heroineId === request.heroineId)) {
    addIssue(issues, "request.routeId", "요청한 루트와 히로인이 프로젝트와 일치하지 않습니다.");
  }
  if (!project.scenes.some((scene) => scene.id === request.afterSceneId)) {
    addIssue(issues, "request.afterSceneId", "삽입 기준 씬이 프로젝트에 없습니다.");
  }
  const afterScene = project.scenes.find((scene) => scene.id === request.afterSceneId);
  if (afterScene?.ending) {
    addIssue(issues, "request.afterSceneId", "엔딩 장면 뒤에는 이벤트를 추가할 수 없습니다.");
  }
  if (request.baseProjectHash !== hashProjectSnapshot(project)) {
    addIssue(issues, "request.baseProjectHash", "패치 생성 기준 프로젝트와 현재 프로젝트가 다릅니다.");
  }
  if (eventPlan.decision.newExpressionAssetCount !== 0 || request.constraints.allowNewExpressionAssets !== false) {
    addIssue(issues, "decision.newExpressionAssetCount", "Alpha에서는 새 표정 에셋을 생성하지 않습니다.");
  }
  if (diff.sceneCount !== eventPlan.decision.sceneCount || diff.sceneCount > request.constraints.maxScenes) {
    addIssue(issues, "decision.sceneCount", "패치의 씬 추가 수가 선언 또는 제약과 일치하지 않습니다.");
  }
  if (diff.choiceCount !== eventPlan.decision.choiceCount || diff.choiceCount > request.constraints.maxChoices) {
    addIssue(issues, "decision.choiceCount", "패치의 선택지 추가 수가 선언 또는 제약과 일치하지 않습니다.");
  }
  const cgAssetCount = eventPlan.patch.operations.filter((operation) => operation.type === "addAsset" && operation.asset.kind === "cg").length;
  if (cgAssetCount !== eventPlan.decision.cgCount || cgAssetCount > request.constraints.maxCgCount) {
    addIssue(issues, "decision.cgCount", "패치의 CG 추가 수가 선언 또는 제약과 일치하지 않습니다.");
  }
  if (eventPlan.patch.operations.some((operation) => operation.type === "addAsset" && operation.asset.kind === "expression")) {
    addIssue(issues, "patch.operations", "Alpha에서는 표정 에셋 추가 연산을 허용하지 않습니다.");
  }

  let appliedProject: VnMakerProject | undefined;
  if (issues.length === 0) {
    try {
      appliedProject = applyProjectPatch(project, eventPlan.patch);
    } catch (error) {
      addIssue(issues, "patch.operations", error instanceof Error ? error.message : String(error));
    }
  }

  if (appliedProject) {
    validateProject(appliedProject).forEach((issue) => {
      if (issue.severity === "error") {
        addIssue(issues, issue.path, issue.message, issue.severity);
      }
    });

    const assetMap = new Map(appliedProject.assets.map((asset) => [asset.id, asset]));
    const jobMap = new Map(appliedProject.generationJobs.map((job) => [job.id, job]));
    const heroineIds = new Set(appliedProject.characters.map((character) => character.id));

    appliedProject.scenes.forEach((scene, sceneIndex) => {
      scene.characters.forEach((character, characterIndex) => {
        if (character.characterId !== request.heroineId || !heroineIds.has(character.characterId)) {
          addIssue(issues, `scenes.${sceneIndex}.characters.${characterIndex}.characterId`, "씬 캐릭터는 프로젝트 단일 히로인과 일치해야 합니다.");
        }
      });

      if (scene.cgAssetId) {
        const asset = assetMap.get(scene.cgAssetId);
        if (!asset || asset.kind !== "cg") {
          addIssue(issues, `scenes.${sceneIndex}.cgAssetId`, "CG 씬은 등록된 CG 에셋을 참조해야 합니다.");
        } else {
          const job = asset.generationJobId ? jobMap.get(asset.generationJobId) : undefined;
          if (!job || job.outputAssetId !== asset.id) {
            addIssue(issues, `assets.${asset.id}.generationJobId`, "CG asset은 outputAssetId가 연결된 generation job을 가져야 합니다.");
          }
        }
      }
    });

    appliedProject.generationJobs.forEach((job, jobIndex) => {
      if (job.kind === "cg") {
        const outputAsset = job.outputAssetId ? assetMap.get(job.outputAssetId) : undefined;
        if (!outputAsset || outputAsset.kind !== "cg" || outputAsset.generationJobId !== job.id) {
          addIssue(issues, `generationJobs.${jobIndex}.outputAssetId`, "CG generation job의 outputAssetId는 연결된 CG asset이어야 합니다.");
        }
      }
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
    appliedProject: issues.every((issue) => issue.severity !== "error") ? appliedProject : undefined,
    diff
  };
}

export function validateProject(project: VnMakerProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (project.version !== "vn-maker/v1") {
    issues.push({ severity: "error", path: "version", message: "지원하지 않는 프로젝트 버전입니다." });
  }

  if (!project.title.trim()) {
    issues.push({ severity: "error", path: "title", message: "프로젝트 제목이 비어 있습니다." });
  }

  const characterIds = uniqueById(project.characters, "characters", issues);
  const routeIds = uniqueById(project.routes, "routes", issues);
  const sceneIds = uniqueById(project.scenes, "scenes", issues);
  const assetIds = uniqueById(project.assets, "assets", issues);
  uniqueById(project.generationJobs, "generationJobs", issues);

  if (!routeIds.has(project.settings.defaultRouteId)) {
    issues.push({ severity: "warning", path: "settings.defaultRouteId", message: "기본 루트가 routes에 없습니다." });
  }

  project.assets.forEach((asset, assetIndex) => {
    if ((asset.source === "dummy" || asset.source === "mock") && !asset.provenance) {
      issues.push({ severity: "error", path: `assets.${assetIndex}.provenance`, message: "dummy/mock 에셋은 provenance가 필요합니다." });
    }
  });

  project.characters.forEach((character, characterIndex) => {
    character.portraitAssetIds.forEach((assetId, assetIndex) => {
      if (!assetIds.has(assetId)) {
        issues.push({ severity: "warning", path: `characters.${characterIndex}.portraitAssetIds.${assetIndex}`, message: `등록되지 않은 에셋입니다: ${assetId}` });
      }
    });
  });

  project.routes.forEach((route, routeIndex) => {
    if (!characterIds.has(route.heroineId)) {
      issues.push({ severity: "error", path: `routes.${routeIndex}.heroineId`, message: `등록되지 않은 캐릭터입니다: ${route.heroineId}` });
    }
    if (!sceneIds.has(route.entrySceneId)) {
      issues.push({ severity: "error", path: `routes.${routeIndex}.entrySceneId`, message: `등록되지 않은 시작 장면입니다: ${route.entrySceneId}` });
    }
  });

  project.routes.forEach((route) => {
    analyzeRouteGraph(project, route.id).issues.forEach((issue) => {
      issues.push(routeGraphIssueToValidationIssue(project, issue));
    });
  });

  project.scenes.forEach((scene, sceneIndex) => {
    [scene.backgroundAssetId, scene.cgAssetId].filter(Boolean).forEach((assetId) => {
      if (!assetIds.has(assetId!)) {
        issues.push({ severity: "warning", path: `scenes.${sceneIndex}.assets`, message: `등록되지 않은 에셋입니다: ${assetId}` });
      }
    });

    if (scene.next && !sceneIds.has(scene.next)) {
      issues.push({ severity: "error", path: `scenes.${sceneIndex}.next`, message: `등록되지 않은 다음 장면입니다: ${scene.next}` });
    }

    scene.characters.forEach((character, characterIndex) => {
      if (!characterIds.has(character.characterId)) {
        issues.push({ severity: "error", path: `scenes.${sceneIndex}.characters.${characterIndex}.characterId`, message: `등록되지 않은 캐릭터입니다: ${character.characterId}` });
      }
      if (character.assetId && !assetIds.has(character.assetId)) {
        issues.push({ severity: "warning", path: `scenes.${sceneIndex}.characters.${characterIndex}.assetId`, message: `등록되지 않은 캐릭터 에셋입니다: ${character.assetId}` });
      }
    });

    scene.choices.forEach((choice, choiceIndex) => {
      if (!sceneIds.has(choice.next)) {
        issues.push({ severity: "error", path: `scenes.${sceneIndex}.choices.${choiceIndex}.next`, message: `등록되지 않은 선택지 이동 장면입니다: ${choice.next}` });
      }
    });
  });

  return issues;
}

export function createAssetManifest(project: VnMakerProject): AssetManifest {
  const requiredIds = new Set<string>();
  const missingAssetReferences: string[] = [];
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));

  project.characters.forEach((character) => character.portraitAssetIds.forEach((assetId) => requiredIds.add(assetId)));
  project.characters.forEach((character) => {
    Object.values(character.expressionAssetIds || {}).forEach((assetId) => requiredIds.add(assetId));
  });
  project.scenes.forEach((scene) => {
    [scene.backgroundAssetId, scene.cgAssetId].filter(Boolean).forEach((assetId) => requiredIds.add(assetId!));
    scene.characters.forEach((character) => character.assetId && requiredIds.add(character.assetId));
  });

  const requiredAssets = [...requiredIds].flatMap((assetId) => {
    const asset = assetMap.get(assetId);
    if (!asset) {
      missingAssetReferences.push(assetId);
      return [];
    }
    return [asset];
  });

  return {
    projectId: project.id,
    requiredAssets,
    missingAssetReferences,
    generationJobs: project.generationJobs
  };
}

function placeholderAssetUri(asset: VnMakerAsset): string {
  const label = escapeHtml(asset.label || asset.id);
  const fill = asset.kind === "portrait" ? "#f9a8d4" : asset.kind === "cg" ? "#93c5fd" : "#64748b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${fill}"/><text x="480" y="270" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="40" fill="#111827">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function rewriteAsset(asset: VnMakerAsset | undefined, rewrites: Record<string, string> = {}): VnMakerAsset | undefined {
  if (!asset) {
    return undefined;
  }
  return {
    ...asset,
    uri: rewrites[asset.id] || asset.uri || placeholderAssetUri(asset)
  };
}

function playerRuntimeChoice(choice: VnMakerChoice): PlayerRuntimeChoice {
  return {
    id: choice.id,
    text: choice.text,
    next: choice.next
  };
}

export function createPlayerRuntimeData(project: VnMakerProject, options: PlayerRuntimeOptions = {}): PlayerRuntimeData {
  const route = project.routes.find((item) => item.id === project.settings.defaultRouteId) || project.routes[0];
  const assets = project.assets
    .map((asset) => rewriteAsset(asset, options.assetPathRewrites))
    .filter((asset): asset is VnMakerAsset => Boolean(asset));
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const characterMap = new Map(project.characters.map((character) => [character.id, character]));
  const issues = validateProject(project);

  return {
    projectId: project.id,
    title: project.title,
    premise: project.premise,
    routeId: route?.id || "",
    startSceneId: options.startSceneId || route?.entrySceneId || project.scenes[0]?.id || "",
    scenes: project.scenes.map((scene): PlayerRuntimeScene => ({
      id: scene.id,
      label: scene.label,
      speaker: scene.speaker,
      text: scene.text,
      characters: scene.characters.map((character) => {
        const projectCharacter = characterMap.get(character.characterId);
        const expressionAssetId = character.expression
          ? projectCharacter?.expressionAssetIds?.[normalizeTag(character.expression)]
          : undefined;
        const fallbackAssetId = projectCharacter?.defaultPortraitAssetId || projectCharacter?.portraitAssetIds[0];
        const assetId = expressionAssetId || character.assetId || fallbackAssetId;
        return {
          ...character,
          asset: assetId ? assetMap.get(assetId) : undefined
        };
      }),
      choices: scene.choices.map(playerRuntimeChoice),
      next: scene.next,
      ending: scene.ending,
      backgroundAsset: scene.backgroundAssetId ? assetMap.get(scene.backgroundAssetId) : undefined,
      cgAsset: scene.cgAssetId ? assetMap.get(scene.cgAssetId) : undefined
    })),
    assets,
    validation: {
      ok: issues.every((issue) => issue.severity !== "error"),
      issues
    },
    conditionRuntimeSupport: conditionRuntimeSupportForProject(project, {
      previewPreflightSuccess: options.conditionPreviewPreflightSuccess ?? false
    }),
    conditionEvaluationTrace: conditionEvaluationTraceForProject(project)
  };
}

export function buildPlayerRuntimeScript(): string {
  return `
(function () {
  function readRuntime() {
    if (window.VN_MAKER_RUNTIME) return window.VN_MAKER_RUNTIME;
    var node = document.getElementById("vn-maker-project");
    return node ? JSON.parse(node.textContent || "{}") : null;
  }

  function start(runtime) {
    var root = document.getElementById("vn-player");
    if (!root || !runtime) return;
    var sceneMap = new Map((runtime.scenes || []).map(function (scene) { return [scene.id, scene]; }));
    var currentSceneId = runtime.startSceneId;

    function imageNode(asset, alt) {
      if (!asset || !asset.uri) return "";
      return '<img src="' + escapeText(asset.uri) + '" alt="' + escapeText(alt) + '">';
    }

    function escapeText(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
      });
    }

    function render(sceneId) {
      var scene = sceneMap.get(sceneId);
      if (!scene) {
        root.innerHTML = '<section class="vn-stage"><p>장면을 찾을 수 없습니다.</p></section>';
        return;
      }
      currentSceneId = scene.id;
      var images = "";
      if (scene.backgroundAsset) images += imageNode(scene.backgroundAsset, scene.backgroundAsset.label || "background");
      (scene.characters || []).forEach(function (character) {
        images += imageNode(character.asset, character.characterId || "character");
      });
      if (scene.cgAsset) images += imageNode(scene.cgAsset, scene.cgAsset.label || "cg");
      var isEnding = Boolean(scene.ending);
      var ending = "";
      if (isEnding) {
        ending = '<div class="vn-ending"><span class="vn-ending-title">엔딩: ' + escapeText(scene.ending.title) + '</span><span class="vn-ending-kind">' + escapeText(scene.ending.kind) + '</span></div>';
      }
      var choices = "";
      if (isEnding) {
        choices = '<button class="vn-choice vn-restart" data-restart="true">처음부터 다시</button>';
      } else {
        choices = (scene.choices || []).map(function (choice) {
          return '<button class="vn-choice" data-next="' + escapeText(choice.next) + '">' + escapeText(choice.text) + '</button>';
        }).join("");
        if (!choices && scene.next) {
          choices = '<button class="vn-choice" data-next="' + escapeText(scene.next) + '">다음</button>';
        }
      }
      root.innerHTML =
        '<section class="vn-stage">' +
        '<div class="vn-images">' + images + '</div>' +
        '<div class="vn-dialogue"><p class="vn-label">' + escapeText(scene.label) + '</p><h2>' + escapeText(scene.speaker) + '</h2><p>' + escapeText(scene.text) + '</p>' + ending + '</div>' +
        '<div class="vn-choices">' + choices + '</div>' +
        '</section>';
      root.querySelectorAll("[data-next]").forEach(function (button) {
        button.addEventListener("click", function () { render(button.getAttribute("data-next")); });
      });
      root.querySelectorAll("[data-restart]").forEach(function (button) {
        button.addEventListener("click", function () { render(runtime.startSceneId); });
      });
    }

    render(currentSceneId);
  }

  if (window.VN_MAKER_RUNTIME) {
    start(window.VN_MAKER_RUNTIME);
  } else if (document.currentScript && document.currentScript.dataset.project) {
    fetch(document.currentScript.dataset.project).then(function (response) {
      return response.json();
    }).then(function (runtime) {
      window.VN_MAKER_RUNTIME = runtime;
      start(runtime);
    });
  } else {
    start(readRuntime());
  }
}());
`.trim();
}

export function buildProjectHtml(project: VnMakerProject, options: BuildProjectHtmlOptions = {}): HtmlBuildArtifact {
  const runtime = createPlayerRuntimeData(project, options);
  const inlineRuntime = !options.projectDataPath && !options.runtimeScriptPath;
  const runtimeScript = inlineRuntime ? `<script>${buildPlayerRuntimeScript()}</script>` : `<script src="${escapeHtml(options.runtimeScriptPath || "./runtime/player.js")}" data-project="${escapeHtml(options.projectDataPath || "./project-data.json")}"></script>`;
  const runtimeData = inlineRuntime
    ? `<script type="application/json" id="vn-maker-project">${escapeJsonForHtml(runtime)}</script>`
    : "";

  return {
    fileName: project.settings.outputFileName,
    html: `<!doctype html>
<html lang="${escapeHtml(project.settings.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(project.title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #111827; color: #f8fafc; }
    main { width: min(960px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0; }
    .vn-stage { min-height: 680px; display: grid; grid-template-rows: 1fr auto auto; gap: 16px; }
    .vn-images { min-height: 400px; display: flex; align-items: end; justify-content: center; gap: 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .vn-images img { max-height: 390px; max-width: 100%; object-fit: contain; }
    .vn-dialogue { border: 1px solid #334155; border-radius: 8px; padding: 18px; background: rgba(15, 23, 42, 0.94); }
    .vn-label { color: #93c5fd; margin: 0 0 8px; }
    .vn-dialogue h2 { margin: 0 0 10px; font-size: 20px; }
    .vn-dialogue p { line-height: 1.7; }
    .vn-choices { display: flex; flex-direction: column; gap: 10px; }
    .vn-choice { border: 1px solid #60a5fa; border-radius: 8px; background: #1e3a8a; color: white; padding: 12px 14px; font: inherit; cursor: pointer; }
    .vn-choice:hover { background: #1d4ed8; }
    .vn-ending { margin-top: 16px; display: flex; align-items: center; gap: 8px; color: #f8fafc; }
    .vn-ending-title { font-weight: 700; }
    .vn-ending-kind { border: 1px solid #64748b; border-radius: 6px; padding: 2px 8px; color: #cbd5e1; font-size: 12px; text-transform: uppercase; }
    .vn-restart { border-color: #94a3b8; background: #334155; }
  </style>
</head>
<body>
  <main>
    <div id="vn-player" aria-live="polite"></div>
  </main>
  ${runtimeData}
  ${runtimeScript}
</body>
</html>`
  };
}
