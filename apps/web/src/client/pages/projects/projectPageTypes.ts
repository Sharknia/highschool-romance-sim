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
  };
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
  repairPreview?: ProjectRepairPreview;
  repairHistoryEntry?: ProjectRepairHistoryEntry | null;
  repairHistory?: ProjectRepairHistoryEntry[];
  exportPlan?: ProjectExportPlan;
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
