import type { ProjectData, ProjectWorkflowSummary } from "./projectPageTypes";

type PreviewResetState = "empty" | "blocked" | "stale" | "running" | "ready" | "failed";
type ExportResetState = "empty" | "blocked" | "running" | "ready" | "completed" | "failed";

export interface PreviewExportResetInput {
  project?: ProjectData | null;
  workflowSummary?: ProjectWorkflowSummary | null;
  previewStatus?: string;
}

export interface PreviewExportResetState {
  previewState: PreviewResetState;
  previewStatus: string;
  exportState: ExportResetState;
  exportStatus: string;
}

const blockingGenerationStates = new Set(["planned", "failed", "partialFailed", "running"]);
const previewStates = new Set(["empty", "blocked", "stale", "running", "ready", "failed"]);
const exportStates = new Set(["empty", "blocked", "running", "ready", "completed", "failed"]);

function previewStateFrom(value: unknown, hasProject: boolean): PreviewResetState {
  if (typeof value === "string" && previewStates.has(value)) {
    return value as PreviewResetState;
  }
  return hasProject ? "stale" : "empty";
}

function exportStateFrom(value: unknown, blocked: boolean, hasProject: boolean): ExportResetState {
  if (blocked) {
    return "blocked";
  }
  if (typeof value === "string" && exportStates.has(value)) {
    return value as ExportResetState;
  }
  return hasProject ? "ready" : "empty";
}

function projectHasIncompleteCg(project?: ProjectData | null): boolean {
  return Boolean(project?.generationJobs?.some((job) => job.kind === "cg" && job.status !== "completed"));
}

function exportBlockedReason(input: PreviewExportResetInput): string | null {
  const generationState = input.workflowSummary?.generationState;
  if (typeof generationState === "string" && blockingGenerationStates.has(generationState)) {
    return "완료되지 않은 이미지 작업이 있어 내보내기가 차단되었습니다.";
  }
  if (projectHasIncompleteCg(input.project)) {
    return "완료되지 않은 이미지 작업이 있어 내보내기가 차단되었습니다.";
  }
  return input.workflowSummary?.blockingIssues?.[0] || null;
}

export function createPreviewExportResetState(input: PreviewExportResetInput): PreviewExportResetState {
  const hasProject = Boolean(input.project);
  const blockedReason = hasProject ? exportBlockedReason(input) : null;
  const exportBlocked = Boolean(blockedReason || input.workflowSummary?.exportState === "blocked");
  const previewState = previewStateFrom(input.workflowSummary?.previewState, hasProject);
  const exportState = exportStateFrom(input.workflowSummary?.exportState, exportBlocked, hasProject);
  return {
    previewState,
    previewStatus: input.previewStatus || (hasProject ? "프로젝트 변경 후 프리뷰가 아직 생성되지 않았습니다." : "프리뷰 생성 전입니다."),
    exportState,
    exportStatus: !hasProject
      ? "내보내기 전입니다."
      : exportBlocked
        ? blockedReason || "내보내기 전에 차단 항목을 해결해야 합니다."
        : "내보내기를 실행할 수 있습니다."
  };
}
