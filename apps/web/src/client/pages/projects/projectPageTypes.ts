import type { ApiResult } from "../../api/types";

export const detailTabs = [
  { id: "overview", label: "개요" },
  { id: "heroine", label: "히로인 스냅샷" },
  { id: "event", label: "제작/이벤트" },
  { id: "assets", label: "에셋/생성" },
  { id: "preview", label: "프리뷰" },
  { id: "export", label: "내보내기" }
] as const;

export type ProjectTabId = typeof detailTabs[number]["id"];

export interface ProjectData {
  id?: string;
  title?: string;
  premise?: string;
  characters?: Array<{
    id?: string;
    displayName?: string;
    sourceHeroineId?: string;
    sourceHeroineName?: string;
    sourceSnapshotCreatedAt?: string;
  }>;
  routes?: Array<{ id?: string; title?: string; entrySceneId?: string; heroineId?: string }>;
  scenes?: Array<{ id?: string; label?: string; speaker?: string; text?: string; ending?: { title?: string; kind?: string } }>;
  generationJobs?: Array<{ id?: string; status?: string; kind?: string }>;
}

export interface ProjectIssue {
  severity?: string;
  path?: string;
  message?: string;
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
  projectRevision?: string;
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
  diff?: ProjectPatchDescription;
  issues?: ProjectIssue[];
  patchHistoryEntry?: ProjectPatchHistoryEntry;
  plan?: ProjectEventPlan;
  recentProject?: RecentProject;
  removedProject?: RecentProject;
  request?: ProjectEventRequest;
  expectedProjectId?: string;
  actualProjectId?: string;
  workflowSummary?: ProjectWorkflowSummary;
}

export function normalizeTab(value?: string): ProjectTabId {
  return detailTabs.some((tab) => tab.id === value) ? value as ProjectTabId : "overview";
}
