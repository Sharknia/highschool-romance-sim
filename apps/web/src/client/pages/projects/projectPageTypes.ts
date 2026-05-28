import type { ApiResult } from "../../api/types";

export const detailTabs = [
  { id: "overview", label: "개요" },
  { id: "heroine", label: "히로인" },
  { id: "background", label: "배경 화면 생성" },
  { id: "studio", label: "제작" },
  { id: "preview", label: "프리뷰" },
  { id: "export", label: "내보내기" }
] as const;

export type ProjectTabId = typeof detailTabs[number]["id"];

export interface ProjectAssetProvenance {
  adapter?: string;
  fallbackReason?: string;
  packId?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
  license?: string;
  sourceUri?: string;
}

export interface ProjectAsset {
  id?: string;
  kind?: string;
  label?: string;
  uri?: string;
  source?: string;
  generationJobId?: string;
  provenance?: ProjectAssetProvenance;
}

export interface ProjectGenerationJob {
  id?: string;
  kind?: string;
  targetId?: string;
  prompt?: string;
  style?: string;
  provider?: string;
  status?: "planned" | "running" | "failed" | "completed" | string;
  outputAssetId?: string;
  failureMessage?: string;
  dummy?: boolean;
  fallbackReason?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
  asset?: ProjectAsset;
}

export interface ProjectData {
  id?: string;
  title?: string;
  premise?: string;
  characters?: Array<{
    id?: string;
    displayName?: string;
    profile?: string;
    description?: string;
    personality?: string;
    speechStyle?: string;
    appearance?: string;
    sourceHeroineId?: string;
    sourceHeroineName?: string;
    sourceSnapshotCreatedAt?: string;
  }>;
  routes?: Array<{ id?: string; title?: string; entrySceneId?: string; heroineId?: string }>;
  scenes?: Array<{
    id?: string;
    label?: string;
    speaker?: string;
    text?: string;
    backgroundAssetId?: string;
    cgAssetId?: string;
    characters?: Array<{ characterId?: string; expression?: string; assetId?: string; position?: "left" | "center" | "right" | string }>;
    choices?: Array<{ id?: string; text?: string; next?: string; condition?: Record<string, unknown>; effects?: Record<string, unknown> }>;
    next?: string;
    ending?: { id?: string; title?: string; kind?: string };
    memoryTags?: Record<string, string[]>;
  }>;
  assets?: ProjectAsset[];
  generationJobs?: ProjectGenerationJob[];
}

export interface ProjectIssue {
  severity?: string;
  path?: string;
  message?: string;
  code?: string;
  domain?: string;
  sceneIds?: string[];
  choiceIds?: string[];
  targetSceneId?: string;
}

export interface ProjectRevision {
  revision: string;
  hashAlgorithm: string;
  createdAt: string;
}

export interface ProjectPatchDescription {
  text?: string;
  sceneCount?: number;
  choiceCount?: number;
  assetCount?: number;
  generationJobCount?: number;
  operations?: string[];
}

export interface ProjectEventRequest {
  baseProjectHash?: string;
  routeId?: string;
  afterSceneId?: string;
  heroineId?: string;
  userEvent?: string;
}

export interface ProjectEventPlan {
  summary?: string;
  decision?: {
    sceneCount?: number;
    choiceCount?: number;
    cgCount?: number;
    newExpressionAssetCount?: number;
    tone?: string;
  };
  patch?: {
    operations?: Array<{ type?: string }>;
  };
}

export interface ProjectPatchHistoryEntry {
  id?: string;
  status?: string;
  summary?: string;
}

export interface TestPromptFixture {
  promptSetId?: string;
  promptId?: string;
  promptText?: string;
  expectedElements?: string[];
  allowedVariation?: string[];
}

export interface TestPromptSet {
  id?: string;
  version?: string;
  label?: string;
  fixtures?: TestPromptFixture[];
}

export interface GenerationResultLog {
  resultId?: string;
  promptSetId?: string;
  promptId?: string;
  promptText?: string;
  expectedElements?: string[];
  allowedVariation?: string[];
  adapter?: string;
  sourceType?: "mock" | "actual" | "unavailable" | string;
  generatedAt?: string;
  projectRevision?: ProjectRevision;
  outputSummary?: string;
  validationIssues?: ProjectIssue[];
  classification?: "passed" | "generation_quality" | "validation_model" | "repair_ux" | "preview_runtime" | "participant_understanding" | string;
  failureClassification?: string;
  patchHistoryId?: string;
  skippedReason?: string;
}

export interface ConditionRuntimeSupport {
  supportFlag?: "support_false" | string;
  supported?: boolean;
  choiceConditionFiltering?: boolean;
  choiceEffects?: boolean;
  conditionSemanticsVersion?: string;
  strictPreviewStatus?: "not_evaluated" | string;
  strictPreviewSuccess?: boolean;
  previewPreflightSuccess?: boolean;
  editorMode?: "candidate_review_only" | string;
  reasonCode?: "conditional-choice-runtime-unsupported" | string;
  message?: string;
}

export interface ConditionEvaluationTrace {
  status?: "not_evaluated" | string;
  reasonCode?: "conditional-choice-runtime-unsupported" | string;
  message?: string;
  sceneIds?: string[];
  choiceIds?: string[];
  visibleChoiceIds?: string[];
  hiddenChoiceIds?: string[];
  appliedEffects?: Array<{
    choiceId?: string;
    flags?: string[];
    affinity?: Record<string, number>;
    memoryTags?: Record<string, string[]>;
  }>;
}

export interface ProjectRuntimeScene {
  id?: string;
  label?: string;
  speaker?: string;
  text?: string;
  next?: string;
  choices?: Array<{ id?: string; text?: string; next?: string }>;
  ending?: { id?: string; title?: string; kind?: string };
  cgAsset?: ProjectAsset;
  backgroundAsset?: ProjectAsset;
  characters?: Array<{ characterId?: string; asset?: ProjectAsset }>;
}

export interface ProjectRuntime {
  projectId?: string;
  title?: string;
  startSceneId?: string;
  routeId?: string;
  scenes?: ProjectRuntimeScene[];
  assets?: ProjectAsset[];
  validation?: {
    ok?: boolean;
    issues?: ProjectIssue[];
  };
  conditionRuntimeSupport?: ConditionRuntimeSupport;
  conditionEvaluationTrace?: ConditionEvaluationTrace;
}

export interface ProjectExportResult {
  outputDirectory?: string;
  indexPath?: string;
  projectDataPath?: string;
  runtimeScriptPath?: string;
}

export interface ProjectPreviewReadiness {
  state?: "blocked" | "prepared" | "running" | "failed" | string;
  availableState?: string;
  canRun?: boolean;
  requiredData?: Record<string, string>;
  missingItems?: Array<{
    id?: string;
    label?: string;
    tab?: ProjectTabId | string;
  }>;
  blockingIssues?: string[];
  nextActions?: Array<{
    label?: string;
    tab?: ProjectTabId | string;
  }>;
  failureCause?: string;
  retryable?: boolean;
  nextAction?: string;
}

export interface ProjectPreviewPreflightIssue {
  issueCode?: string;
  path?: string;
  message?: string;
  sceneIds?: string[];
  choiceIds?: string[];
  targetSceneId?: string;
  repairActionIds?: string[];
}

export interface ProjectPreviewPreflight {
  canRun?: boolean;
  blockers?: ProjectPreviewPreflightIssue[];
  warnings?: ProjectPreviewPreflightIssue[];
  disabledReason?: string | null;
  nextAction?: string;
  projectRevision?: ProjectRevision;
  runtimeCapabilities?: {
    choiceConditionFiltering?: boolean;
    choiceEffects?: boolean;
    conditionSemanticsVersion?: string;
    conditionRuntimeSupport?: ConditionRuntimeSupport;
  };
  conditionRuntimeSupport?: ConditionRuntimeSupport;
  conditionEvaluationTrace?: ConditionEvaluationTrace;
}

export type StudioInspectorPanelId = "scene" | "choices" | "stats" | "assets" | "validation" | string;

export interface StudioIssueFocus {
  issueId?: string;
  severity?: string;
  issueCode?: string;
  path?: string;
  message?: string;
  routeId?: string;
  sceneId?: string;
  choiceId?: string;
  field?: string;
  inspectorPanel?: StudioInspectorPanelId;
  scriptBlockId?: string;
  defaultAction?: "focus" | "repair" | "preview-blocker" | "none" | string;
  targetSceneId?: string;
  repairActionIds?: string[];
}

export interface StudioRouteGraphNode {
  id?: string;
  label?: string;
  summary?: string;
  routeId?: string;
  entry?: boolean;
  reachable?: boolean;
  unreachable?: boolean;
  ending?: boolean;
  problemSeverity?: string;
}

export interface StudioRouteGraphEdge {
  id?: string;
  kind?: "route-entry" | "next" | "choice" | string;
  sourceSceneId?: string;
  targetSceneId?: string;
  choiceId?: string;
  label?: string;
  missingTarget?: boolean;
}

export interface StudioRouteGraphView {
  routeId?: string;
  routeTitle?: string;
  entrySceneId?: string;
  selectedSceneId?: string;
  nodes?: StudioRouteGraphNode[];
  edges?: StudioRouteGraphEdge[];
  markers?: {
    unreachableSceneIds?: string[];
    missingTargetSceneIds?: string[];
    problemSceneIds?: string[];
    problemChoiceIds?: string[];
    reachableEndingIds?: string[];
    uncoveredTerminalSceneIds?: string[];
  };
}

export interface StudioRouteSelection {
  routeId?: string;
  routeTitle?: string;
  entrySceneId?: string;
  selectedSceneId?: string;
  selectedProblemId?: string;
  deepLinkQuery?: {
    route?: string;
    scene?: string;
    panel?: StudioInspectorPanelId;
    problem?: string;
  };
  availableRoutes?: Array<{
    routeId?: string;
    routeTitle?: string;
    entrySceneId?: string;
    heroineId?: string;
  }>;
}

export interface StudioPreviewPreflightView {
  canRun?: boolean;
  disabledReason?: string | null;
  nextAction?: string;
  projectRevision?: ProjectRevision;
  blockers?: StudioIssueFocus[];
  warnings?: StudioIssueFocus[];
  runtimeCapabilities?: ProjectPreviewPreflight["runtimeCapabilities"];
  conditionRuntimeSupport?: ConditionRuntimeSupport;
  conditionEvaluationTrace?: ConditionEvaluationTrace;
}

export interface StudioViewModel {
  projectId?: string;
  projectRevision?: ProjectRevision;
  routeSelection?: StudioRouteSelection;
  routeGraph?: StudioRouteGraphView;
  issues?: StudioIssueFocus[];
  previewPreflight?: StudioPreviewPreflightView;
  generatedAt?: string;
}

export interface StudioProblemAction {
  actionId?: string;
  issueId?: string;
  issueCode?: string;
  targetPath?: string;
  label?: string;
  disabledReason?: string | null;
  destructive?: boolean;
  requiresPreflight?: boolean;
  expectedProjectRevision?: ProjectRevision;
}

export interface ProjectRepairActionRequiredInput {
  name?: string;
  label?: string;
  inputType?: "text" | "select" | string;
  options?: Array<{
    value?: string;
    label?: string;
  }>;
}

export interface ProjectRepairAction {
  actionId?: string;
  issueCode?: string;
  targetPath?: string;
  label?: string;
  description?: string;
  destructive?: boolean;
  requiresConfirmation?: boolean;
  requiredInputs?: ProjectRepairActionRequiredInput[];
  disabledReason?: string | null;
  expectedTarget?: {
    targetPath?: string;
    sceneIds?: string[];
    choiceIds?: string[];
    targetSceneId?: string;
  };
  preflightBlocker?: ProjectPreviewPreflightIssue;
}

export interface ProjectRepairDiffEntry {
  op?: "add" | "remove" | "replace" | string;
  path?: string;
  before?: unknown;
  after?: unknown;
  humanLabel?: string;
}

export interface ProjectRepairPreview {
  actionId?: string;
  issueCode?: string;
  targetPath?: string;
  beforeRevision?: ProjectRevision;
  confirmToken?: string;
  expectedAfterSummary?: string;
  diff?: ProjectRepairDiffEntry[];
  destructiveWarnings?: string[];
  repairAction?: ProjectRepairAction;
}

export interface ProjectRepairHistoryEntry {
  id?: string;
  actionId?: string;
  issueCode?: string;
  beforeRevision?: ProjectRevision;
  afterRevision?: ProjectRevision;
  appliedAt?: string;
  revertedAt?: string;
}

export interface ProjectExportPlan {
  state?: "ready" | "blocked" | "running" | "complete" | "failed" | string;
  canExport?: boolean;
  target?: "localDesktopWebApp" | string;
  githubPagesTarget?: boolean;
  conditionRuntimeSupport?: ConditionRuntimeSupport;
  conditionEvaluationTrace?: ConditionEvaluationTrace;
  validationSummary?: {
    ok?: boolean;
    issueCount?: number;
    errors?: ProjectIssue[];
    warnings?: ProjectIssue[];
  };
  includedData?: string[];
  includedAssets?: ProjectAsset[];
  blockers?: Array<{
    kind?: string;
    id?: string;
    status?: string;
    message?: string;
    tab?: ProjectTabId | string;
  }>;
  warnings?: string[];
  failureCause?: string;
  retryable?: boolean;
  nextAction?: string;
}

export interface ProjectSmokeResult {
  ok?: boolean;
  checks?: Record<string, boolean>;
  issues?: string[];
  reachableEndingIds?: string[];
  uncoveredTerminalSceneIds?: string[];
  cyclesWithoutEndingPath?: string[][];
}

export interface ProjectWorkflowSummary {
  primaryAction?: string;
  primaryLabel?: string;
  blockingIssues?: string[];
  validationState?: string;
  generationState?: string;
  previewState?: string;
  exportState?: string;
  steps?: Array<{
    id: string;
    label: string;
    state: "done" | "current" | "blocked" | "waiting";
  }>;
}

export interface ProjectActionEvent {
  eventName?: string;
  timestamp?: string;
  correlationId?: string;
  requestId?: string;
  action?: string;
  eventLogId?: string;
  projectId?: string;
  routeId?: string;
  sceneId?: string;
  promptId?: string;
  issueCode?: string;
  repairActionId?: string;
  outcome?: string;
  projectRevision?: ProjectRevision;
}

export interface UXDecisionEvent {
  eventLogId?: string;
  eventId?: string;
  eventName?: string;
  timestamp?: string;
  sessionId?: string;
  participantIdHash?: string;
  participantType?: string;
  taskId?: string;
  promptId?: string;
  inputMode?: string;
  projectId?: string;
  routeId?: string;
  sceneId?: string;
  issueCode?: string;
  issueCodesBefore?: string[];
  issueCodesAfter?: string[];
  repairActionId?: string;
  helpChannel?: "static_tutorial" | "external_help" | "inline_guide" | "automatic_repair_suggestion" | "moderator_hint" | string;
  hintLevel?: number;
  elapsedMs?: number;
  stallDurationMs?: number;
  outcome?: string;
  projectRevision?: ProjectRevision;
  revisionBefore?: ProjectRevision;
  revisionAfter?: ProjectRevision;
  preflightResult?: Record<string, unknown>;
  correlationId?: string;
  action?: string;
  resultId?: string;
  metadata?: Record<string, unknown>;
}

export interface UXDecisionEventLog {
  eventLogId?: string;
  sessionId?: string;
  projectId?: string;
  projectRevision?: ProjectRevision;
  exportedAt?: string;
  events?: UXDecisionEvent[];
}

export type Phase0WorkPackageStatus = "Ready" | "Partial" | "Missing" | string;
export type Phase0Decision = "Go" | "Iterate" | "Stop/Rethink" | string;

export interface Phase0WorkPackage {
  id?: string;
  label?: string;
  status?: Phase0WorkPackageStatus;
  evidence?: string[];
  missing?: string[];
}

export interface Phase0Metric {
  inputMode?: string;
  sessionCount?: number;
  completedCount?: number;
  completionRate?: number;
  guidedRepairCompletionRate?: number;
  noviceNonDevStoryCreatorCount?: number;
  majorityValidPreviewWithoutHint?: boolean;
  medianCompletionMinutes?: number | null;
  averageBlockingErrors?: number;
  helpRecoveryRate?: number;
  sameCauseCriticalIncidentCount?: number;
  fakeOrMockPreviewCount?: number;
}

export interface Phase0SessionEvidence {
  sessionId?: string;
  eventLogId?: string;
  participantIdHash?: string;
  noviceNonDevStoryCreator?: boolean;
  inputMode?: string;
  taskId?: string;
  promptId?: string;
  eventNames?: string[];
  completed?: boolean;
  reachedValidPreview?: boolean;
  usedModeratorHint?: boolean;
  usedStaticTutorial?: boolean;
  abandoned?: boolean;
  stall90s?: boolean;
  blockingErrorCount?: number;
  completionMs?: number;
  actualPreview?: boolean;
  mockPreview?: boolean;
  previewPreflightCanRun?: boolean;
  conditionPreviewStatus?: string;
  guidedRepairEvidence?: {
    ready?: boolean;
    issueCode?: string;
    repairActionId?: string;
    revisionBefore?: ProjectRevision;
    revisionAfter?: ProjectRevision;
    preflightResult?: Record<string, unknown>;
    eventLogId?: string;
  };
}

export interface Phase0DecisionReport {
  reportId?: string;
  projectId?: string;
  projectRevision?: ProjectRevision;
  generatedAt?: string;
  decision?: Phase0Decision;
  maximumDecisionDueToMissing?: Phase0Decision;
  decisionReasons?: string[];
  workPackages?: Phase0WorkPackage[];
  sessions?: Phase0SessionEvidence[];
  denominator?: {
    totalSessions?: number;
    failedSessions?: number;
    abandonedSessions?: number;
    stall90sSessions?: number;
    staticTutorialRecoverySessions?: number;
    moderatorHintSessions?: number;
    includedFailedAbandonedAndHelpRecovery?: boolean;
  };
  fixedInputMetrics?: Phase0Metric;
  freeInputFindings?: Phase0Metric;
  conditionRuntime?: {
    supportFlag?: string;
    supported?: boolean;
    strictPreviewStatus?: string;
    conditionPreviewCountsAsStrictSuccess?: boolean;
    actualPreviewCanRun?: boolean;
    message?: string;
  };
  mockActualSeparation?: {
    combinedTotalsUsed?: boolean;
    actualPreviewCount?: number;
    fakeOrMockPreviewCount?: number;
    mockGenerationResultCount?: number;
    unavailableGenerationResultCount?: number;
  };
}

export interface RecentProject {
  projectId: string;
  projectDirectory: string;
  title: string;
  lastOpenedAt: string;
  lastValidatedAt?: string;
  validationState?: "unchecked" | "valid" | "invalid" | "stale";
  missing?: boolean;
}

export interface ProjectApiResult extends ApiResult {
  action?: string;
  correlationId?: string;
  actionEvent?: ProjectActionEvent;
  baseProjectHash?: string;
  code?: string;
  message?: string;
  project?: ProjectData;
  projectDirectory?: string;
  projectId?: string;
  expectedRevision?: string;
  actualRevision?: ProjectRevision;
  previousRevision?: ProjectRevision;
  projectRevision?: ProjectRevision;
  previewPreflight?: ProjectPreviewPreflight;
  projects?: RecentProject[];
  count?: number;
  missingCount?: number;
  loadedAt?: string;
  sort?: "lastOpenedAtDesc";
  validation?: {
    ok?: boolean;
    issues?: ProjectIssue[];
    diff?: ProjectPatchDescription;
  };
  assets?: ProjectAsset[];
  diff?: ProjectPatchDescription;
  errors?: string[];
  issues?: ProjectIssue[];
  job?: ProjectGenerationJob;
  jobs?: ProjectGenerationJob[];
  dummy?: boolean;
  fallbackReason?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
  generationJobId?: string;
  outputAssetId?: string;
  asset?: ProjectAsset;
  backgroundPolicy?: {
    limit?: number;
    existingAssetId?: string;
    replacesExisting?: boolean;
  };
  patchHistoryEntry?: ProjectPatchHistoryEntry;
  plan?: ProjectEventPlan;
  export?: ProjectExportResult;
  previewReadiness?: ProjectPreviewReadiness;
  repairActions?: ProjectRepairAction[];
  studio?: StudioViewModel;
  problemActions?: StudioProblemAction[];
  appliedOperations?: string[];
  selectedRouteId?: string;
  selectedSceneId?: string;
  repairPreview?: ProjectRepairPreview;
  repairHistoryEntry?: ProjectRepairHistoryEntry | null;
  repairHistory?: ProjectRepairHistoryEntry[];
  exportPlan?: ProjectExportPlan;
  fixedPromptSetId?: string;
  fixedPromptSet?: TestPromptSet;
  fixtures?: TestPromptFixture[];
  fixedPrompt?: TestPromptFixture;
  generationResultId?: string;
  generationResultLog?: GenerationResultLog;
  generationResultLogs?: GenerationResultLog[];
  eventLogId?: string;
  event?: UXDecisionEvent;
  uxDecisionEvent?: UXDecisionEvent;
  uxDecisionEvents?: UXDecisionEvent[];
  events?: UXDecisionEvent[];
  eventLog?: UXDecisionEventLog;
  phase0DecisionReport?: Phase0DecisionReport;
  recentProject?: RecentProject;
  removedProject?: RecentProject;
  recentIndexRemoval?: {
    ok?: boolean;
    error?: string;
  };
  request?: ProjectEventRequest;
  routeGraphAnalysis?: {
    issues?: ProjectIssue[];
    missingTargets?: unknown[];
    reachableEndingIds?: string[];
    uncoveredTerminalSceneIds?: string[];
  };
  raw?: unknown;
  rawOutput?: unknown;
  runtime?: ProjectRuntime;
  smoke?: ProjectSmokeResult;
  expectedProjectId?: string;
  actualProjectId?: string;
  workflowSummary?: ProjectWorkflowSummary;
}

export function normalizeTab(value?: string): ProjectTabId {
  if (value === "event") {
    return "studio";
  }
  if (value === "assets") {
    return "background";
  }
  return detailTabs.some((tab) => tab.id === value) ? value as ProjectTabId : "overview";
}
