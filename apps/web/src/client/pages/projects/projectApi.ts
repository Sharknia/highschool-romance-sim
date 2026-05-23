import type { PostAuthedJson } from "../../auth/AuthProvider";
import type { ProjectApiResult, RecentProject } from "./projectPageTypes";

export function projectFailureText(result: ProjectApiResult, fallback: string): string {
  return result.message?.trim() || result.error?.trim() || fallback;
}

export function listProjects(postJson: PostAuthedJson): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/list", {});
}

export function openProject(postJson: PostAuthedJson, body: Record<string, unknown>): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/open", body);
}

export function reconnectProject(postJson: PostAuthedJson, body: Record<string, unknown>): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/reconnect", body);
}

export function removeProject(postJson: PostAuthedJson, entry: RecentProject): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/remove", {
    projectId: entry.projectId
  });
}

export function restoreProject(postJson: PostAuthedJson, entry: RecentProject): Promise<ProjectApiResult> {
  return postJson<ProjectApiResult>("/api/projects/restore", {
    projectListEntry: entry
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
