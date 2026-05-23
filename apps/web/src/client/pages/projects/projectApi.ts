import type { PostAuthedJson } from "../../auth/AuthProvider";
import type { ProjectApiResult, RecentProject } from "./projectPageTypes";

export function projectFailureText(result: ProjectApiResult, fallback: string): string {
  if (result.code === "RECENT_PROJECT_INDEX_MISS") {
    return "최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.";
  }
  if (result.code === "PROJECT_DIRECTORY_MISSING") {
    return "프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.";
  }
  if (result.code === "PROJECT_ID_MISMATCH") {
    return "프로젝트 ID가 일치하지 않습니다. 자동으로 덮어쓰지 않았습니다.";
  }
  return result.message || result.error || fallback;
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
