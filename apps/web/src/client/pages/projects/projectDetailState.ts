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
  previewCanRun: boolean;
  exportState: ExportResetState;
  exportStatus: string;
}

const previewStates = new Set(["empty", "blocked", "stale", "running", "ready", "failed"]);
const exportStates = new Set(["empty", "blocked", "running", "ready", "completed", "failed"]);

function previewStateFrom(value: unknown): PreviewResetState {
  if (typeof value === "string" && previewStates.has(value)) {
    return value as PreviewResetState;
  }
  return "empty";
}

function exportStateFrom(value: unknown, blocked: boolean): ExportResetState {
  if (blocked) {
    return "blocked";
  }
  if (value === "complete") {
    return "completed";
  }
  if (typeof value === "string" && exportStates.has(value)) {
    return value as ExportResetState;
  }
  return "empty";
}

function exportBlockedReason(input: PreviewExportResetInput): string | null {
  return input.workflowSummary?.blockingIssues?.[0] || null;
}

export function createPreviewExportResetState(input: PreviewExportResetInput): PreviewExportResetState {
  const hasProject = Boolean(input.project);
  const hasWorkflowSummary = Boolean(input.workflowSummary);
  const blockedReason = hasProject ? exportBlockedReason(input) : null;
  const exportBlocked = Boolean(blockedReason || input.workflowSummary?.exportState === "blocked");
  const previewState = previewStateFrom(input.workflowSummary?.previewState);
  const exportState = exportStateFrom(input.workflowSummary?.exportState, exportBlocked);
  const previewCanRun = hasProject && (previewState === "ready" || previewState === "stale");
  return {
    previewState,
    previewCanRun,
    previewStatus: input.previewStatus || (hasProject ? "프로젝트 변경 후 프리뷰가 아직 생성되지 않았습니다." : "프리뷰 생성 전입니다."),
    exportState,
    exportStatus: !hasProject || !hasWorkflowSummary
      ? "내보내기 전입니다."
      : exportBlocked
        ? blockedReason || "내보내기 전에 차단 항목을 해결해야 합니다."
        : "내보내기를 실행할 수 있습니다."
  };
}
