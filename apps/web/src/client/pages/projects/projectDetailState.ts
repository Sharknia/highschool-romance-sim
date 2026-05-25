import type {
  ProjectData,
  ProjectExportPlan,
  ProjectGenerationJob,
  ProjectPreviewReadiness,
  ProjectTabId,
  ProjectWorkflowSummary
} from "./projectPageTypes";

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

export const emptyPreviewReadiness: ProjectPreviewReadiness = {
  state: "blocked",
  availableState: "empty",
  canRun: false,
  requiredData: {
    heroine: "unknown",
    background: "unknown",
    event: "unknown",
    validation: "unknown",
    generationJobs: "unknown"
  },
  missingItems: [],
  blockingIssues: [],
  nextActions: [],
  failureCause: "",
  retryable: false,
  nextAction: "프로젝트를 먼저 열어 주세요."
};

export const emptyExportPlan: ProjectExportPlan = {
  state: "blocked",
  canExport: false,
  target: "localDesktopWebApp",
  githubPagesTarget: false,
  validationSummary: {
    ok: false,
    issueCount: 0,
    errors: [],
    warnings: []
  },
  includedData: [],
  includedAssets: [],
  blockers: [],
  warnings: [],
  failureCause: "",
  retryable: false,
  nextAction: "프로젝트를 먼저 열어 주세요."
};

function imageJobKindLabel(kind?: string): string {
  if (kind === "background") {
    return "배경 화면";
  }
  if (kind === "cg") {
    return "이벤트 CG";
  }
  return "이미지";
}

export function tabFromAction(action?: string): ProjectTabId {
  if (action === "goToHeroine") return "heroine";
  if (action === "goToBackground") return "background";
  if (action === "goToStudio") return "studio";
  if (action === "goToExport") return "export";
  return "preview";
}

export function primaryActionDisplayLabel(tab: ProjectTabId): string {
  if (tab === "heroine") return "히로인 스냅샷으로 이동";
  if (tab === "background") return "배경 화면 생성으로 이동";
  if (tab === "studio") return "제작으로 이동";
  if (tab === "export") return "내보내기로 이동";
  return "프리뷰 확인";
}

export function primaryActionTabFromSummary(summary: ProjectWorkflowSummary): ProjectTabId {
  return tabFromAction(summary.primaryAction);
}

export function createPreviewReadinessFallback(
  project: ProjectData | null,
  summary: ProjectWorkflowSummary,
  hasBackgroundAsset: boolean,
  incompleteImageJobs: ProjectGenerationJob[],
  primaryActionTab: ProjectTabId,
  emptyState: ProjectPreviewReadiness = emptyPreviewReadiness
): ProjectPreviewReadiness {
  const hasProject = Boolean(project);
  const hasHeroine = Boolean(project?.characters?.length);
  const hasScene = Boolean(project?.scenes?.length);
  const hasBackground = hasBackgroundAsset || summary.generationState === "completed";
  const imageJobsReady = hasProject && incompleteImageJobs.length === 0;
  const missingItems: NonNullable<ProjectPreviewReadiness["missingItems"]> = [];

  if (!hasProject) {
    return emptyState;
  }
  if (!hasHeroine) {
    missingItems.push({ id: "heroine", label: "히로인 스냅샷", tab: "heroine" });
  }
  if (!hasBackground) {
    missingItems.push({ id: "background", label: "배경 화면", tab: "background" });
  }
  if (!hasScene) {
    missingItems.push({ id: "event", label: "장면 구성", tab: "studio" });
  }
  if (!imageJobsReady) {
    missingItems.push({ id: "generationJobs", label: "필수 이미지 작업 완료", tab: "background" });
  }

  const blockingIssues = summary.blockingIssues || [];
  const workflowReady = summary.previewState === "ready" || summary.previewState === "stale";
  const hasBlocker = missingItems.length > 0 || blockingIssues.length > 0 || summary.previewState === "blocked";
  const canRun = Boolean(workflowReady && !hasBlocker);
  const availableState = summary.previewState || "empty";
  const state = canRun
    ? "prepared"
    : hasBlocker
      ? "blocked"
      : availableState;
  const failureCause = hasBlocker
    ? [...blockingIssues, ...missingItems.map((item) => item.label).filter(Boolean)].join(" · ")
    : "";
  const nextAction = canRun
    ? "프리뷰를 실행할 수 있습니다."
    : summary.primaryLabel || primaryActionDisplayLabel(primaryActionTab);

  return {
    state,
    availableState,
    canRun,
    requiredData: {
      heroine: hasHeroine ? "ready" : "missing",
      background: hasBackground ? "ready" : "missing",
      event: hasScene ? "ready" : "missing",
      validation: summary.validationState || "unknown",
      generationJobs: imageJobsReady ? "ready" : "waiting"
    },
    missingItems,
    blockingIssues,
    nextActions: canRun ? [] : [{ label: nextAction, tab: primaryActionTab }],
    failureCause,
    retryable: false,
    nextAction
  };
}

export function createExportPlanFallback(
  project: ProjectData | null,
  summary: ProjectWorkflowSummary,
  hasBackgroundAsset: boolean,
  incompleteImageJobs: ProjectGenerationJob[],
  primaryActionTab: ProjectTabId,
  emptyState: ProjectExportPlan = emptyExportPlan
): ProjectExportPlan {
  const hasProject = Boolean(project);
  const hasHeroine = Boolean(project?.characters?.length);
  const hasScene = Boolean(project?.scenes?.length);
  const hasBackground = hasBackgroundAsset || summary.generationState === "completed";
  const blockers: NonNullable<ProjectExportPlan["blockers"]> = [];

  if (!hasProject) {
    return emptyState;
  }
  if (!hasHeroine) {
    blockers.push({ kind: "requiredData", id: "heroine", message: "히로인 스냅샷이 필요합니다.", tab: "heroine" });
  }
  if (!hasBackground) {
    blockers.push({ kind: "requiredData", id: "background", message: "배경 화면이 필요합니다.", tab: "background" });
  }
  if (!hasScene) {
    blockers.push({ kind: "requiredData", id: "event", message: "내보낼 장면 구성이 필요합니다.", tab: "studio" });
  }
  incompleteImageJobs.forEach((job) => {
    blockers.push({
      kind: "generationJob",
      id: job.id || job.outputAssetId || imageJobKindLabel(job.kind),
      message: `${imageJobKindLabel(job.kind)} 작업이 완료되지 않았습니다.`,
      status: job.status,
      tab: "background"
    });
  });
  (summary.blockingIssues || []).forEach((message, index) => {
    blockers.push({ kind: "workflow", id: `workflow-${index}`, message, tab: primaryActionTab });
  });

  const summaryComplete = summary.exportState === "complete" || summary.exportState === "completed";
  const hasBlocker = blockers.length > 0 || summary.exportState === "blocked";
  const canExport = Boolean(!hasBlocker && (summary.exportState === "ready" || summaryComplete));
  const state = hasBlocker
    ? "blocked"
    : summaryComplete
      ? "complete"
      : summary.exportState || "empty";

  return {
    state,
    canExport,
    target: "localDesktopWebApp",
    githubPagesTarget: false,
    validationSummary: {
      ok: blockers.length === 0 && summary.validationState === "valid",
      issueCount: blockers.length,
      errors: blockers.map((blocker) => ({ severity: "error", path: blocker.kind, message: blocker.message || blocker.id || "확인이 필요합니다." })),
      warnings: []
    },
    includedData: ["프로젝트 데이터", "런타임 데이터", "워크플로 요약"],
    includedAssets: project?.assets || [],
    blockers,
    warnings: summary.validationState && summary.validationState !== "valid" ? ["프로젝트 검증 상태를 다시 확인하세요."] : [],
    failureCause: hasBlocker ? blockers.map((blocker) => blocker.message || blocker.id || blocker.kind).join(" · ") : "",
    retryable: false,
    nextAction: canExport ? "내보내기를 실행할 수 있습니다." : summary.primaryLabel || primaryActionDisplayLabel(primaryActionTab)
  };
}

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
