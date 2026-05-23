import type { PostAuthedJson } from "../../auth/AuthProvider";
import type { ProjectApiResult, RecentProject } from "./projectPageTypes";

export function projectFailureText(result: ProjectApiResult, fallback: string): string {
  return result.message?.trim() || result.error?.trim() || fallback;
}

export function listRecentProjects(postJson: PostAuthedJson): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/recent/list", {});
}

export function openProject(postJson: PostAuthedJson, body: Record<string, unknown>): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/open", body);
}

export function reconnectProject(postJson: PostAuthedJson, body: Record<string, unknown>): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/reconnect", body);
}

export function removeRecentProject(postJson: PostAuthedJson, entry: RecentProject): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/recent/remove", {
    projectId: entry.projectId
  });
}

export function restoreRecentProject(postJson: PostAuthedJson, entry: RecentProject): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/recent/restore", {
    recentProject: entry
  });
}

export function deleteProjectFiles(postJson: PostAuthedJson, input: {
  projectDirectory: string;
  projectId: string;
  confirmTitle: string;
}): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/delete", {
    ...input,
    deleteFiles: true
  });
}
