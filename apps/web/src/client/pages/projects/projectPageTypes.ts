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
  characters?: unknown[];
  routes?: unknown[];
  scenes?: unknown[];
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
  code?: string;
  project?: ProjectData;
  projectDirectory?: string;
  projectId?: string;
  projects?: RecentProject[];
  validation?: {
    ok?: boolean;
  };
  recentProject?: RecentProject;
  expectedProjectId?: string;
  actualProjectId?: string;
}

export function normalizeTab(value?: string): ProjectTabId {
  return detailTabs.some((tab) => tab.id === value) ? value as ProjectTabId : "overview";
}
