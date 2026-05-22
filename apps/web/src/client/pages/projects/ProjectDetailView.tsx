import { ArrowRight, CheckCircle2, Heart, Image as ImageIcon, Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { Button, TabList } from "../../components/ui";
import type { HeroineDraft, HeroineLibraryResult } from "../heroines/heroinePageTypes";
import {
  detailTabs,
  type ProjectApiResult,
  type ProjectAsset,
  type ProjectData,
  type ProjectEventPlan,
  type ProjectExportPlan,
  type ProjectExportResult,
  type ProjectGenerationJob,
  type ProjectIssue,
  type ProjectPreviewReadiness,
  type ProjectRuntime,
  type ProjectRuntimeScene,
  type ProjectSmokeResult,
  type ProjectTabId,
  type ProjectWorkflowSummary
} from "./projectPageTypes";
import { createPreviewExportResetState } from "./projectDetailState";

interface ProjectDetailViewProps {
  activeTab: ProjectTabId;
  currentProject: ProjectData | null;
  onProjectResult: (result: ProjectApiResult) => void;
  projectDirectory: string;
  projectId?: string;
  shellProjectTitle: string;
  workflowSummary: ProjectWorkflowSummary | null;
}

type EventTabState = "blockedNoHeroine" | "ready" | "expanding" | "patchPending" | "patchInvalid" | "patchStale" | "approving";
type PendingEventPatch = ProjectApiResult & Required<Pick<ProjectApiResult, "request" | "plan">>;
type AssetState = "empty" | "planned" | "running" | "failed" | "completed" | "partialFailed";
type PreviewState = "empty" | "blocked" | "stale" | "running" | "ready" | "failed";
type ExportState = "empty" | "blocked" | "running" | "ready" | "completed" | "failed";

function fallbackWorkflowSummary(project: ProjectData | null): ProjectWorkflowSummary {
  const hasProject = Boolean(project);
  const hasHeroine = Boolean(project?.characters?.length);
  const hasBackground = Boolean(project?.assets?.some((asset) => asset.kind === "background"));
  const hasEvent = Boolean((project?.scenes?.length || 0) > 1);
  const incompleteImageJobs = project?.generationJobs?.filter((job) => isVisualImageJob(job) && job.status !== "completed") || [];
  const blockingIssues = [
    hasProject && !hasHeroine ? "히로인 1명을 먼저 선택해야 합니다." : "",
    hasHeroine && !hasBackground ? "배경 화면 생성이 필요합니다." : "",
    incompleteImageJobs.length > 0 ? "완료되지 않은 이미지 작업이 있습니다." : "",
    hasHeroine && hasBackground && !hasEvent ? "제작 탭에서 이벤트와 씬을 준비해야 합니다." : ""
  ].filter(Boolean);
  return {
    primaryAction: !hasHeroine ? "goToHeroine" : !hasBackground || incompleteImageJobs.length > 0 ? "goToBackground" : !hasEvent ? "goToStudio" : "goToPreview",
    primaryLabel: !hasHeroine ? "히로인 스냅샷으로 이동" : !hasBackground || incompleteImageJobs.length > 0 ? "배경 화면 생성으로 이동" : !hasEvent ? "제작으로 이동" : "프리뷰 확인",
    blockingIssues,
    validationState: "unknown",
    generationState: project?.generationJobs?.some(isVisualImageJob) ? "planned" : "empty",
    previewState: !hasHeroine || !hasBackground || !hasEvent || incompleteImageJobs.length > 0 ? "blocked" : "stale",
    exportState: blockingIssues.length > 0 ? "blocked" : "ready",
    steps: [
      { id: "project", label: "프로젝트 생성", state: hasProject ? "done" : "current" },
      { id: "heroine", label: "히로인 선택", state: hasHeroine ? "done" : hasProject ? "current" : "blocked" },
      { id: "background", label: "배경 화면 생성", state: hasBackground ? "done" : hasHeroine ? "current" : "blocked" },
      { id: "studio", label: "제작", state: hasEvent ? "done" : hasHeroine && hasBackground ? "current" : "blocked" },
      { id: "preview", label: "프리뷰", state: hasHeroine && hasBackground && hasEvent ? "current" : "blocked" },
      { id: "export", label: "내보내기", state: blockingIssues.length > 0 ? "blocked" : "waiting" }
    ]
  };
}

function stateLabel(value?: string): string {
  if (!value) {
    return "확인 필요";
  }
  if (value === "valid") return "문제 없음";
  if (value === "error") return "문제 확인 필요";
  if (value === "planned") return "작업 예정";
  if (value === "completed") return "완료";
  if (value === "blocked") return "차단";
  if (value === "stale") return "다시 확인 필요";
  return value;
}

function eventStateLabel(value: EventTabState): string {
  if (value === "blockedNoHeroine") return "히로인 필요";
  if (value === "expanding") return "제안 생성 중";
  if (value === "patchPending") return "제안 검토 중";
  if (value === "patchInvalid") return "문제 확인 필요";
  if (value === "patchStale") return "다시 제안 필요";
  if (value === "approving") return "승인 중";
  return "제안 가능";
}

function issueText(issue: ProjectIssue): string {
  const message = issue.message || "확인이 필요합니다.";
  return issue.path ? `${issue.path}: ${message}` : message;
}

function routeLabel(route: NonNullable<ProjectData["routes"]>[number]): string {
  return `${route.title || route.id || "루트"}${route.heroineId ? ` · ${route.heroineId}` : ""}`;
}

function sceneLabel(scene: NonNullable<ProjectData["scenes"]>[number]): string {
  const ending = scene.ending?.title ? ` · 엔딩 ${scene.ending.title}` : "";
  return `${scene.label || scene.id || "씬"}${ending}`;
}

function eventResultHasCg(result: ProjectApiResult, plan?: ProjectEventPlan): boolean {
  return Boolean(
    result.project?.generationJobs?.some((job) => job.kind === "cg" && job.status !== "completed")
    || (plan?.decision?.cgCount || 0) > 0
  );
}

function isVisualImageJob(job: ProjectGenerationJob): boolean {
  return job.kind === "background" || job.kind === "cg";
}

function imageJobKindLabel(kind?: string): string {
  if (kind === "background") {
    return "배경 화면";
  }
  if (kind === "cg") {
    return "이벤트 CG";
  }
  return "이미지";
}

function assetState(jobs: ProjectGenerationJob[]): AssetState {
  if (jobs.length === 0) return "empty";
  if (jobs.some((job) => job.status === "running")) return "running";
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  if (failedCount > 0 && completedCount > 0) return "partialFailed";
  if (failedCount > 0) return "failed";
  if (completedCount === jobs.length) return "completed";
  return "planned";
}

function assetStateLabel(value: AssetState): string {
  if (value === "empty") return "작업 없음";
  if (value === "planned") return "작업 예정";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  if (value === "partialFailed") return "일부 실패";
  return "완료";
}

function jobStatusLabel(value?: string): string {
  if (value === "planned") return "작업 예정";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  if (value === "completed") return "완료";
  return value || "확인 필요";
}

function generationErrorCategory(result: ProjectApiResult): "OAuth" | "app-server" | "adapter" | "응답 파싱" {
  if (result.code === "OAUTH_REQUIRED" || result.httpStatus === 401) return "OAuth";
  if (result.code === "NON_JSON_RESPONSE" || result.code === "EMPTY_RESPONSE") return "응답 파싱";
  const message = `${result.message || ""} ${result.error || ""} ${(result.errors || []).join(" ")}`;
  if (message.includes("OAuth 로그인이 필요")) return "OAuth";
  if (message.includes("app-server")) return "app-server";
  return "adapter";
}

function backgroundAsset(project: ProjectData | null): ProjectAsset | null {
  const backgroundAssets = project?.assets?.filter((asset) => asset.kind === "background") || [];
  const linkedBackgroundIds = new Set((project?.scenes || []).map((scene) => scene.backgroundAssetId).filter(Boolean));
  return backgroundAssets.find((asset) => asset.source === "generated" && asset.id && linkedBackgroundIds.has(asset.id))
    || backgroundAssets.find((asset) => asset.source === "generated")
    || backgroundAssets.find((asset) => asset.id && linkedBackgroundIds.has(asset.id))
    || backgroundAssets[0]
    || null;
}

function previewStateLabel(value: PreviewState): string {
  if (value === "empty") return "프리뷰 없음";
  if (value === "blocked") return "차단";
  if (value === "stale") return "다시 생성 필요";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  return "준비됨";
}

function exportStateLabel(value: ExportState): string {
  if (value === "empty") return "내보내기 없음";
  if (value === "blocked") return "차단";
  if (value === "running") return "실행 중";
  if (value === "completed") return "완료";
  if (value === "failed") return "실패";
  return "준비됨";
}

function tabFromAction(action?: string): ProjectTabId {
  if (action === "goToHeroine") return "heroine";
  if (action === "goToBackground") return "background";
  if (action === "goToStudio") return "studio";
  if (action === "goToExport") return "export";
  return "preview";
}

function fallbackPreviewReadiness(project: ProjectData | null, summary: ProjectWorkflowSummary): ProjectPreviewReadiness {
  const hasHeroine = Boolean(project?.characters?.length);
  const hasBackground = Boolean(project?.assets?.some((asset) => asset.kind === "background"));
  const hasEventScenes = Boolean((project?.scenes?.length || 0) > 1);
  const canRun = Boolean(project && summary.previewState !== "blocked" && summary.previewState !== "failed");
  const missingItems = [
    !hasHeroine ? { id: "heroine", label: "히로인 1명", tab: "heroine" } : null,
    !hasBackground ? { id: "background", label: "배경 화면", tab: "background" } : null,
    !hasEventScenes ? { id: "studio", label: "제작 씬", tab: "studio" } : null
  ].filter(Boolean) as NonNullable<ProjectPreviewReadiness["missingItems"]>;

  return {
    state: canRun ? "prepared" : "blocked",
    availableState: summary.previewState || "blocked",
    canRun,
    requiredData: {
      heroine: hasHeroine ? "ready" : "missing",
      background: hasBackground ? "ready" : "missing",
      scenes: hasEventScenes ? "ready" : "missing",
      validation: summary.validationState === "error" ? "invalid" : "ready",
      generationJobs: summary.generationState === "failed" || summary.generationState === "partialFailed" ? "failed" : summary.generationState === "planned" || summary.generationState === "running" ? "pending" : "ready"
    },
    missingItems,
    blockingIssues: summary.blockingIssues || [],
    nextActions: missingItems.map((item) => ({
      tab: item.tab,
      label: `해결 탭으로 이동: ${item.label}`
    })),
    failureCause: (summary.blockingIssues || []).join(" ") || "프리뷰 실행 전 준비 상태를 확인합니다.",
    retryable: false,
    nextAction: missingItems[0] ? `해결 탭으로 이동: ${missingItems[0].label}` : "프리뷰를 실행하세요."
  };
}

function fallbackExportPlan(project: ProjectData | null, summary: ProjectWorkflowSummary): ProjectExportPlan {
  const blockers = (summary.blockingIssues || []).map((message) => ({
    kind: message.includes("이미지") || message.includes("배경") ? "generationJob" : "validation",
    message,
    tab: message.includes("이미지") || message.includes("배경") ? "background" : "studio"
  }));
  const blocked = blockers.length > 0 || summary.exportState === "blocked";
  return {
    state: blocked ? "blocked" : "ready",
    canExport: !blocked && Boolean(project),
    target: "localDesktopWebApp",
    githubPagesTarget: false,
    validationSummary: {
      ok: summary.validationState !== "error",
      issueCount: blockers.length,
      errors: blockers.map((blocker) => ({ severity: "error", path: String(blocker.tab), message: blocker.message })),
      warnings: []
    },
    includedData: ["project", "runtime", "assetManifest"],
    includedAssets: project?.assets || [],
    blockers,
    warnings: [],
    failureCause: blockers.map((blocker) => blocker.message).join(" ") || "내보내기 전 검증 요약을 확인합니다.",
    retryable: false,
    nextAction: blockers[0] ? "차단 항목을 해결한 뒤 다시 실행하세요." : "내보내기를 실행할 수 있습니다."
  };
}

function runtimeScene(runtime: ProjectRuntime | null, sceneId?: string): ProjectRuntimeScene | null {
  if (!runtime?.scenes?.length) {
    return null;
  }
  return runtime.scenes.find((scene) => scene.id === sceneId) || runtime.scenes.find((scene) => scene.id === runtime.startSceneId) || runtime.scenes[0] || null;
}

export function ProjectDetailView({
  activeTab,
  currentProject,
  onProjectResult,
  projectDirectory,
  projectId,
  shellProjectTitle,
  workflowSummary
}: ProjectDetailViewProps) {
  const { postAuthedJson } = useAuth();
  const navigate = useNavigate();
  const [heroines, setHeroines] = useState<HeroineDraft[]>([]);
  const [selectedHeroineId, setSelectedHeroineId] = useState("");
  const [heroineStatus, setHeroineStatus] = useState("히로인 라이브러리를 불러오는 중입니다.");
  const [busy, setBusy] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [eventPrompt, setEventPrompt] = useState("");
  const [eventState, setEventState] = useState<EventTabState>("ready");
  const [eventStatus, setEventStatus] = useState("히로인 스냅샷 이후 이벤트를 제안할 수 있습니다.");
  const [eventIssues, setEventIssues] = useState<ProjectIssue[]>([]);
  const [eventBusy, setEventBusy] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<PendingEventPatch | null>(null);
  const [assetJobs, setAssetJobs] = useState<ProjectGenerationJob[]>([]);
  const [assetStatus, setAssetStatus] = useState("배경 화면 작업과 이벤트 CG 작업을 확인합니다.");
  const [assetErrors, setAssetErrors] = useState<string[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [backgroundStatus, setBackgroundStatus] = useState("배경 생성 전 확인 정보를 검토하세요.");
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundJobId, setBackgroundJobId] = useState("");
  const [backgroundErrors, setBackgroundErrors] = useState<string[]>([]);
  const [previewState, setPreviewState] = useState<PreviewState>("empty");
  const [previewStatus, setPreviewStatus] = useState("프리뷰 생성 전입니다.");
  const [previewRuntime, setPreviewRuntime] = useState<ProjectRuntime | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState("");
  const [previewIssues, setPreviewIssues] = useState<string[]>([]);
  const [previewReadiness, setPreviewReadiness] = useState<ProjectPreviewReadiness | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [exportState, setExportState] = useState<ExportState>("empty");
  const [exportStatus, setExportStatus] = useState("내보내기 전입니다.");
  const [exportResult, setExportResult] = useState<ProjectExportResult | null>(null);
  const [exportPlan, setExportPlan] = useState<ProjectExportPlan | null>(null);
  const [smokeResult, setSmokeResult] = useState<ProjectSmokeResult | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const summary = workflowSummary || fallbackWorkflowSummary(currentProject);
  const hasUnsavedProjectDraft = false;
  const assignedHeroine = currentProject?.characters?.[0] || null;
  const selectedHeroine = heroines.find((heroine) => heroine.id === selectedHeroineId) || heroines[0] || null;
  const sourceHeroine = assignedHeroine?.sourceHeroineId
    ? heroines.find((heroine) => heroine.id === assignedHeroine.sourceHeroineId) || null
    : null;
  const snapshotDifferences = assignedHeroine ? [
    assignedHeroine.displayName !== (sourceHeroine?.name || assignedHeroine.sourceHeroineName || assignedHeroine.displayName) ? "표시 이름" : "",
    assignedHeroine.personality && sourceHeroine?.personality && assignedHeroine.personality !== sourceHeroine.personality ? "성격" : "",
    assignedHeroine.speechStyle && sourceHeroine?.speechStyle && assignedHeroine.speechStyle !== sourceHeroine.speechStyle ? "말투" : "",
    assignedHeroine.appearance && sourceHeroine?.appearance && assignedHeroine.appearance !== sourceHeroine.appearance ? "외형" : ""
  ].filter(Boolean) : [];
  const snapshotSavedAt = assignedHeroine?.sourceSnapshotCreatedAt || "마지막 수정 시각 정보 없음";
  const doneSteps = summary.steps?.filter((step) => step.state === "done").length || 0;
  const remainingSteps = (summary.steps?.length || 0) - doneSteps;
  const projectRoutes = currentProject?.routes || [];
  const projectScenes = currentProject?.scenes || [];
  const currentRoute = useMemo(() => projectRoutes.find((route) => route.id === selectedRouteId) || projectRoutes[0] || null, [projectRoutes, selectedRouteId]);
  const currentEventScene = useMemo(() => {
    const routeEntryScene = projectScenes.find((scene) => scene.id === currentRoute?.entrySceneId);
    return projectScenes.find((scene) => scene.id === selectedSceneId) || routeEntryScene || projectScenes[0] || null;
  }, [currentRoute?.entrySceneId, projectScenes, selectedSceneId]);
  const pendingDiff = pendingPatch?.validation?.diff || pendingPatch?.diff;
  const visibleEventIssues = eventIssues.length > 0 ? eventIssues : pendingPatch?.validation?.issues || [];
  const imageJobs = useMemo(() => {
    const sourceJobs = assetJobs.length > 0 ? assetJobs : currentProject?.generationJobs || [];
    return sourceJobs.filter(isVisualImageJob);
  }, [assetJobs, currentProject?.generationJobs]);
  const currentAssetState = assetState(imageJobs);
  const plannedImageJobIds = imageJobs.filter((job) => job.status === "planned" && job.id).map((job) => String(job.id));
  const failedImageJobIds = imageJobs.filter((job) => job.status === "failed" && job.id).map((job) => String(job.id));
  const incompleteImageJobs = (currentProject?.generationJobs || []).filter((job) => isVisualImageJob(job) && job.status !== "completed");
  const currentBackgroundAsset = backgroundAsset(currentProject);
  const backgroundJobs = imageJobs.filter((job) => job.kind === "background");
  const activeBackgroundJob = backgroundJobs.find((job) => job.status !== "completed") || backgroundJobs[0] || null;
  const hasBackgroundAsset = Boolean(currentBackgroundAsset);
  const hasBackgroundJob = backgroundJobs.length > 0;
  const currentPreviewScene = runtimeScene(previewRuntime, previewSceneId);
  const currentPreviewReadiness = previewReadiness || fallbackPreviewReadiness(currentProject, summary);
  const previewRunBlocked = currentPreviewReadiness.canRun === false;
  const currentExportPlan = exportPlan || fallbackExportPlan(currentProject, summary);
  const eventDisplayState: EventTabState = !assignedHeroine
    ? "blockedNoHeroine"
    : pendingPatch && eventState === "ready"
      ? "patchPending"
      : eventState;
  const canExpandEvent = Boolean(assignedHeroine && currentRoute?.id && currentEventScene?.id && eventPrompt.trim() && !pendingPatch && !eventBusy);
  const canApproveEvent = Boolean(pendingPatch && pendingPatch.validation?.ok !== false && !eventBusy);
  const detailProjectId = currentProject?.id || projectId;
  const primaryActionTab: ProjectTabId = summary.primaryAction === "goToHeroine"
    ? "heroine"
    : summary.primaryAction === "goToBackground"
      ? "background"
      : summary.primaryAction === "goToStudio"
        ? "studio"
        : summary.primaryAction === "goToExport"
          ? "export"
          : "preview";
  const primaryActionLabel = summary.primaryLabel || (primaryActionTab === "background" ? "배경 화면 생성으로 이동" : "프리뷰 확인");
  const activeTabLabel = detailTabs.find((tab) => tab.id === activeTab)?.label || activeTab;
  const suggestedBackgroundJobId = currentProject?.id ? `job-background-${currentProject.id}` : "job-background";
  const suggestedBackgroundAssetId = currentProject?.id ? `asset-background-${currentProject.id}` : "asset-background";
  const suggestedBackgroundPrompt = [
    currentProject?.title || "비주얼 노벨",
    currentProject?.premise || "",
    "주요 장면에 사용할 학교 배경 화면, polished anime visual novel background"
  ].filter(Boolean).join(", ");
  const backgroundOutputLocation = projectDirectory
    ? `${projectDirectory}/assets/generated/${suggestedBackgroundAssetId}.png`
    : `/generated-assets/${suggestedBackgroundAssetId}.png`;
  const backgroundLinkedScene = currentProject?.scenes?.find((scene) => scene.backgroundAssetId === currentBackgroundAsset?.id)
    || currentProject?.scenes?.find((scene) => scene.backgroundAssetId)
    || currentProject?.scenes?.[0]
    || null;
  const backgroundPreviewUri = currentBackgroundAsset?.uri || activeBackgroundJob?.asset?.uri;
  const backgroundReplaceText = currentBackgroundAsset
    ? `기존 배경 교체: ${currentBackgroundAsset.id}`
    : "기존 배경 교체: 생성된 배경이 아직 없습니다.";

  const heroineState = useMemo(() => {
    if (!currentProject) return "loading";
    if (assignedHeroine) return "assigned";
    if (heroines.length === 0) return "blocked";
    return "ready";
  }, [assignedHeroine, currentProject, heroines.length]);

  useEffect(() => {
    if (activeTab !== "heroine") {
      return;
    }
    setHeroineStatus("히로인 라이브러리를 불러오는 중입니다.");
    void postAuthedJson<HeroineLibraryResult>("/api/heroines/list", {}).then((result) => {
      if (result.ok === false) {
        setHeroineStatus(`히로인 라이브러리를 불러오지 못했습니다. ${result.error || "히로인 관리에서 먼저 준비하세요."}`);
        return;
      }
      const nextHeroines = Array.isArray(result.heroines) ? result.heroines : [];
      setHeroines(nextHeroines);
      setSelectedHeroineId(nextHeroines[0]?.id || "");
      setHeroineStatus(nextHeroines.length > 0 ? "프로젝트에 사용할 히로인을 선택하세요." : "히로인 라이브러리를 먼저 준비해야 합니다.");
    }).catch((error) => {
      setHeroineStatus(`히로인 라이브러리를 불러오지 못했습니다. ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [activeTab, postAuthedJson]);

  useEffect(() => {
    if (activeTab !== "studio" || !currentProject) {
      return;
    }
    const nextRoute = projectRoutes.find((route) => route.id === selectedRouteId) || projectRoutes[0] || null;
    if (nextRoute?.id && selectedRouteId !== nextRoute.id) {
      setSelectedRouteId(nextRoute.id);
    }

    const routeEntryScene = projectScenes.find((scene) => scene.id === nextRoute?.entrySceneId);
    const nextScene = projectScenes.find((scene) => scene.id === selectedSceneId) || routeEntryScene || projectScenes[0] || null;
    if (nextScene?.id && selectedSceneId !== nextScene.id) {
      setSelectedSceneId(nextScene.id);
    }
  }, [activeTab, currentProject, projectRoutes, projectScenes, selectedRouteId, selectedSceneId]);

  useEffect(() => {
    if (activeTab !== "studio") {
      return;
    }
    if (!assignedHeroine) {
      setEventState("blockedNoHeroine");
      setEventStatus("히로인 1명을 먼저 선택해야 합니다.");
      return;
    }
    if (eventState === "blockedNoHeroine") {
      setEventState("ready");
      setEventStatus("루트와 기준 씬을 고르고 이벤트를 제안하세요.");
    }
  }, [activeTab, assignedHeroine, eventState]);

  useEffect(() => {
    if (activeTab !== "background" || !currentProject) {
      return;
    }
    if (!backgroundJobId || backgroundJobId === "job-background") {
      setBackgroundJobId(suggestedBackgroundJobId);
    }
    if (!backgroundPrompt.trim()) {
      setBackgroundPrompt(suggestedBackgroundPrompt);
    }
  }, [activeTab, backgroundJobId, backgroundPrompt, currentProject, suggestedBackgroundJobId, suggestedBackgroundPrompt]);

  function resetPreviewAndExportState(input: { previewStatus?: string; project?: ProjectData | null; workflowSummary?: ProjectWorkflowSummary | null } = {}): void {
    const nextState = createPreviewExportResetState({
      project: input.project ?? currentProject,
      workflowSummary: input.workflowSummary ?? workflowSummary,
      previewStatus: input.previewStatus
    });
    setPreviewRuntime(null);
    setPreviewSceneId("");
    setPreviewIssues([]);
    setPreviewReadiness(null);
    setPreviewState(nextState.previewState);
    setPreviewStatus(nextState.previewStatus);
    setExportResult(null);
    setExportPlan(null);
    setSmokeResult(null);
    setExportState(nextState.exportState);
    setExportStatus(nextState.exportStatus);
  }

  useEffect(() => {
    setAssetJobs([]);
    setAssetErrors([]);
    setAssetStatus("배경 화면 작업과 이벤트 CG 작업을 확인합니다.");
    resetPreviewAndExportState();
  }, [currentProject?.id]);

  useEffect(() => {
    if (activeTab !== "background" || !currentProject) {
      return;
    }
    void loadGenerationJobs();
  }, [activeTab, currentProject?.id, projectDirectory]);

  async function assignHeroineSnapshot(): Promise<void> {
    if (!currentProject?.id || !selectedHeroine) {
      setHeroineStatus("히로인 1명을 먼저 선택해야 합니다.");
      return;
    }
    setBusy(true);
    setHeroineStatus("히로인 스냅샷을 배정하는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>(`/api/projects/${currentProject.id}/heroine`, {
        projectDirectory,
        heroine: selectedHeroine
      });
      if (result.ok === false) {
        setHeroineStatus(result.message || result.error || "히로인 스냅샷을 배정하지 못했습니다.");
        return;
      }
      onProjectResult(result);
      resetPreviewAndExportState({
        previewStatus: "히로인 변경으로 프리뷰와 내보내기를 다시 확인해야 합니다.",
        project: result.project,
        workflowSummary: result.workflowSummary
      });
      setHeroineStatus("히로인 스냅샷이 프로젝트에 배정되었습니다.");
      navigate(`/projects/${currentProject.id}/studio`);
    } catch (error) {
      setHeroineStatus(`히로인 스냅샷 배정 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function applyEventFailure(result: ProjectApiResult, fallbackMessage: string): void {
    const stale = result.code === "PATCH_STALE" || result.code === "PROJECT_REVISION_CONFLICT" || result.httpStatus === 409;
    setEventState(stale ? "patchStale" : "patchInvalid");
    setEventStatus(result.message || result.error || fallbackMessage);
    setEventIssues(result.issues || result.validation?.issues || []);
  }

  async function expandProjectEvent(): Promise<void> {
    if (!assignedHeroine) {
      setEventState("blockedNoHeroine");
      setEventStatus("히로인 1명을 먼저 선택해야 합니다.");
      return;
    }
    if (pendingPatch) {
      setEventState("patchPending");
      setEventStatus("대기 중인 제안을 먼저 승인하거나 취소하세요.");
      return;
    }
    if (!eventPrompt.trim() || !currentRoute?.id || !currentEventScene?.id) {
      setEventState("patchInvalid");
      setEventStatus("루트, 기준 씬, 자연어 이벤트를 모두 입력해야 합니다.");
      return;
    }

    setEventBusy(true);
    setEventState("expanding");
    setEventIssues([]);
    setEventStatus("이벤트 제안을 요청하는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/events/expand", {
        projectDirectory,
        userEvent: eventPrompt.trim(),
        routeId: currentRoute.id,
        heroineId: currentRoute.heroineId || assignedHeroine.id,
        afterSceneId: currentEventScene.id
      });
      if (result.ok === false) {
        applyEventFailure(result, "이벤트 제안을 만들지 못했습니다.");
        return;
      }
      if (!result.request || !result.plan) {
        applyEventFailure({ ...result, ok: false, message: "이벤트 제안 응답에 request 또는 plan이 없습니다." }, "이벤트 제안 응답이 올바르지 않습니다.");
        return;
      }
      setPendingPatch(result as PendingEventPatch);
      setEventIssues(result.validation?.issues || []);
      setEventState("patchPending");
      setEventStatus("제안이 준비되었습니다. 바뀔 내용과 문제 확인 결과를 검토하세요.");
    } catch (error) {
      setEventState("patchInvalid");
      setEventStatus(`이벤트 제안 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEventBusy(false);
    }
  }

  async function approveProjectEvent(): Promise<void> {
    if (!pendingPatch) {
      return;
    }

    setEventBusy(true);
    setEventState("approving");
    setEventStatus("제안을 승인하는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/events/approve", {
        projectDirectory,
        request: pendingPatch.request,
        plan: pendingPatch.plan,
        patchHistoryId: pendingPatch.patchHistoryEntry?.id
      });
      if (result.ok === false) {
        applyEventFailure(result, "제안 승인에 실패했습니다.");
        return;
      }
      onProjectResult(result);
      resetPreviewAndExportState({
        previewStatus: "프로젝트 이벤트가 변경되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
        project: result.project,
        workflowSummary: result.workflowSummary
      });
      setPendingPatch(null);
      setEventIssues(result.validation?.issues || []);
      setEventPrompt("");
      setEventState("ready");
      setEventStatus("제안 승인 완료. CG 작업이 있으면 배경 화면 생성 탭으로 이동합니다.");
      navigate(`/projects/${result.project?.id || currentProject?.id || projectId}/${eventResultHasCg(result, pendingPatch.plan) ? "background" : "preview"}`);
    } catch (error) {
      setEventState("patchInvalid");
      setEventStatus(`제안 승인 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEventBusy(false);
    }
  }

  function cancelPendingEventPatch(): void {
    setPendingPatch(null);
    setEventIssues([]);
    setEventState("ready");
    setEventStatus("제안을 취소했습니다. 새 이벤트를 다시 입력할 수 있습니다.");
  }

  function applyAssetFailure(result: ProjectApiResult, fallbackMessage: string): void {
    if (result.code === "OAUTH_REQUIRED" || result.httpStatus === 401) {
      setAssetStatus("Codex ChatGPT OAuth 연결이 필요합니다. 설정에서 연결 상태를 확인하세요.");
    } else {
      setAssetStatus(result.message || result.error || fallbackMessage);
    }
    setAssetErrors(result.errors || result.issues?.map(issueText) || []);
  }

  function applyBackgroundFailure(result: ProjectApiResult, fallbackMessage: string): void {
    const category = generationErrorCategory(result);
    const detail = result.message || result.error || fallbackMessage;
    setBackgroundStatus(`${category}: ${detail}`);
    setBackgroundErrors(result.errors || result.issues?.map(issueText) || [detail]);
  }

  async function loadGenerationJobs(): Promise<void> {
    setAssetBusy(true);
    setAssetStatus("배경 화면과 이벤트 CG 작업을 불러오는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/generation/jobs/list", {
        projectDirectory
      });
      if (result.ok === false) {
        applyAssetFailure(result, "배경 화면 또는 이벤트 CG 작업을 불러오지 못했습니다.");
        return;
      }
      const nextJobs = (result.jobs || []).filter(isVisualImageJob);
      setAssetJobs(nextJobs);
      setAssetErrors([]);
      setAssetStatus(nextJobs.length > 0 ? "배경 화면과 이벤트 CG 작업을 확인했습니다." : "배경 작업을 준비하거나 이벤트를 승인하면 이미지 작업이 생성됩니다.");
      setBackgroundStatus(nextJobs.some((job) => job.kind === "background") ? "배경 작업 상태를 불러왔습니다." : "배경 생성 전 확인 정보를 검토하세요.");
    } catch (error) {
      setAssetStatus(`이미지 작업 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
      setBackgroundStatus(`app-server: 이미지 작업 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAssetBusy(false);
    }
  }

  async function runBackgroundGeneration(): Promise<void> {
    if (!currentProject) {
      setBackgroundStatus("adapter: 배경을 생성할 프로젝트가 없습니다.");
      return;
    }
    const prompt = backgroundPrompt.trim();
    if (!prompt) {
      setBackgroundStatus("adapter: 생성할 배경 설명을 입력하세요.");
      return;
    }
    const jobId = backgroundJobId.trim() || suggestedBackgroundJobId;
    setBackgroundBusy(true);
    setBackgroundErrors([]);
    setBackgroundStatus("Codex app-server의 ChatGPT managed OAuth와 imageGeneration 경로로 배경 작업을 준비합니다.");
    try {
      const created = await postAuthedJson<ProjectApiResult>("/api/generation/jobs", {
        projectDirectory,
        id: jobId,
        kind: "background",
        targetId: currentProject.id || suggestedBackgroundJobId,
        prompt,
        outputAssetId: suggestedBackgroundAssetId
      });
      if (created.ok === false) {
        applyBackgroundFailure(created, "배경 화면 작업을 준비하지 못했습니다.");
        return;
      }
      const run = await postAuthedJson<ProjectApiResult>("/api/generation/jobs/run", {
        projectDirectory,
        jobIds: [created.job?.id || jobId],
        replaceCompleted: true,
        retryFailed: true
      });
      const nextJobs = (run.project?.generationJobs || run.jobs || created.project?.generationJobs || []).filter(isVisualImageJob);
      if (nextJobs.length > 0) {
        setAssetJobs(nextJobs);
      }
      if (run.project) {
        onProjectResult(run);
        resetPreviewAndExportState({
          previewStatus: "배경 화면이 생성되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
          project: run.project,
          workflowSummary: run.workflowSummary
        });
      }
      setBackgroundErrors(run.errors || run.issues?.map(issueText) || []);
      if (run.ok === false) {
        applyBackgroundFailure(run, "배경 화면 생성에 실패했습니다.");
        return;
      }
      const resultAsset = run.assets?.find((asset) => asset.kind === "background");
      setBackgroundStatus(resultAsset
        ? `저장 위치/에셋 연결 상태: ${resultAsset.id} 생성 완료. backgroundAssetId가 장면에 연결되었습니다.`
        : "저장 위치/에셋 연결 상태: 완료된 배경 결과를 유지했습니다.");
    } catch (error) {
      setBackgroundStatus(`app-server: 배경 화면 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
      setBackgroundErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setBackgroundBusy(false);
    }
  }

  async function createBackgroundJob(): Promise<void> {
    if (!currentProject) {
      setAssetStatus("배경 작업을 준비할 프로젝트가 없습니다.");
      return;
    }
    setAssetBusy(true);
    setAssetErrors([]);
    setAssetStatus("기본 배경 화면 작업을 준비하는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/generation/jobs", {
        projectDirectory,
        id: suggestedBackgroundJobId,
        kind: "background",
        targetId: currentProject.id || suggestedBackgroundJobId,
        prompt: suggestedBackgroundPrompt,
        outputAssetId: suggestedBackgroundAssetId
      });
      if (result.ok === false) {
        applyAssetFailure(result, "배경 화면 작업을 준비하지 못했습니다.");
        return;
      }
      const nextJobs = (result.project?.generationJobs || result.jobs || (result.job ? [result.job] : [])).filter(isVisualImageJob);
      setAssetJobs(nextJobs);
      setAssetErrors([]);
      if (result.project) {
        onProjectResult(result);
        resetPreviewAndExportState({
          previewStatus: "배경 화면 작업이 추가되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
          project: result.project,
          workflowSummary: result.workflowSummary
        });
      }
      setAssetStatus("배경 화면 작업을 준비했습니다. 이미지 만들기를 실행하세요.");
    } catch (error) {
      setAssetStatus(`배경 화면 작업 준비 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAssetBusy(false);
    }
  }

  async function runImageJobs(jobIds: string[], retryFailed = false): Promise<void> {
    if (jobIds.length === 0) {
      setAssetStatus(retryFailed ? "재시도할 실패 작업이 없습니다." : "실행할 예정 이미지 작업이 없습니다.");
      return;
    }
    setAssetBusy(true);
    setAssetErrors([]);
    setAssetStatus(retryFailed ? "실패 작업 재시도 실행 중입니다." : "이미지 만들기 실행 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/generation/jobs/run", {
        projectDirectory,
        jobIds,
        retryFailed,
        replaceCompleted: false
      });
      const nextJobs = (result.project?.generationJobs || result.jobs || []).filter(isVisualImageJob);
      if (nextJobs.length > 0) {
        setAssetJobs(nextJobs);
      }
      setAssetErrors(result.errors || result.issues?.map(issueText) || []);
      if (result.project) {
        onProjectResult(result);
        resetPreviewAndExportState({
          previewStatus: "이미지 결과가 변경되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
          project: result.project,
          workflowSummary: result.workflowSummary
        });
      }
      if (result.ok === false) {
        applyAssetFailure(result, "일부 이미지 작업이 실패했습니다.");
        return;
      }
      setAssetStatus(result.assets?.length
        ? "이미지 생성 완료. 결과 에셋이 프로젝트에 연결되었습니다."
        : "완료된 작업은 다시 호출하지 않습니다. 결과 에셋을 유지했습니다.");
    } catch (error) {
      setAssetStatus(`이미지 만들기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAssetBusy(false);
    }
  }

  function validationIssues(result: ProjectApiResult): ProjectIssue[] {
    return result.issues
      || result.validation?.issues
      || result.runtime?.validation?.issues
      || [];
  }

  function hasBlockingPreviewErrors(issues: ProjectIssue[]): boolean {
    return issues.some((issue) => issue.severity === "error");
  }

  function validationMessages(result: ProjectApiResult): string[] {
    return validationIssues(result).map(issueText);
  }

  async function validateBeforePreview(): Promise<boolean> {
    const result = await postAuthedJson<ProjectApiResult>("/api/project/validate", { projectDirectory });
    const issues = validationIssues(result);
    const messages = issues.map(issueText);
    if (result.ok === false || hasBlockingPreviewErrors(issues)) {
      setPreviewState("failed");
      setPreviewRuntime(null);
      setPreviewSceneId("");
      setPreviewIssues(messages);
      setPreviewReadiness({
        ...currentPreviewReadiness,
        state: "failed",
        availableState: "failed",
        failureCause: result.error || messages[0] || "검증 실행 결과 문제가 있어 프리뷰를 생성하지 않았습니다.",
        retryable: false,
        nextAction: "다음 행동: 문제 확인 결과를 해결한 뒤 다시 실행하세요."
      });
      setPreviewStatus(result.error || "검증 실행 결과 문제가 있어 프리뷰를 생성하지 않았습니다.");
      return false;
    }
    setPreviewIssues(messages);
    return true;
  }

  async function runPreview(startSceneId?: string): Promise<void> {
    setPreviewBusy(true);
    setPreviewState("running");
    setPreviewReadiness({ ...currentPreviewReadiness, state: "running", availableState: "running" });
    setPreviewStatus("검증 실행 후 프리뷰 생성 중입니다.");
    try {
      const valid = await validateBeforePreview();
      if (!valid) {
        return;
      }
      const result = await postAuthedJson<ProjectApiResult>("/api/project/preview", {
        projectDirectory,
        startSceneId
      });
      if (result.ok === false) {
        const blocked = result.code === "PREVIEW_BLOCKED" || result.previewReadiness?.canRun === false;
        setPreviewState(blocked ? "blocked" : "failed");
        setPreviewRuntime(null);
        setPreviewSceneId("");
        setPreviewReadiness(result.previewReadiness || {
          ...currentPreviewReadiness,
          state: blocked ? "blocked" : "failed",
          availableState: blocked ? "blocked" : "failed",
          failureCause: result.message || result.error || "프리뷰 생성에 실패했습니다.",
          retryable: result.retryable
        });
        setPreviewStatus(result.message || result.error || "프리뷰 생성에 실패했습니다.");
        setPreviewIssues(validationMessages(result));
        return;
      }
      const nextRuntime = result.runtime || null;
      setPreviewRuntime(nextRuntime);
      setPreviewSceneId(startSceneId || nextRuntime?.startSceneId || "");
      setPreviewIssues(validationMessages(result));
      const nextReadiness = result.previewReadiness || null;
      const blocked = nextReadiness?.canRun === false;
      setPreviewReadiness(nextReadiness);
      setPreviewState(blocked ? "blocked" : result.validation?.ok === false || result.runtime?.validation?.ok === false ? "failed" : "ready");
      setPreviewStatus(blocked ? nextReadiness?.failureCause || "필수 데이터가 준비되지 않아 프리뷰가 차단되었습니다." : result.validation?.ok === false ? "검증 문제가 있어 프리뷰가 ready 상태가 아닙니다." : "프리뷰 생성 완료");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewState("failed");
      setPreviewRuntime(null);
      setPreviewSceneId("");
      setPreviewReadiness({
        ...currentPreviewReadiness,
        state: "failed",
        availableState: "failed",
        failureCause: message,
        retryable: true,
        nextAction: "다음 행동: API 응답과 네트워크 상태를 확인한 뒤 다시 시도하세요."
      });
      setPreviewStatus(`프리뷰 생성 실패: ${message}`);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function runExport(): Promise<void> {
    setExportBusy(true);
    setExportState("running");
    setExportPlan({ ...currentExportPlan, state: "running" });
    setExportStatus("검증 실행 후 내보내기 실행 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/project/export", {
        projectDirectory
      });
      setExportResult(result.export || null);
      setExportPlan(result.exportPlan || null);
      setSmokeResult(result.smoke || null);
      if (result.ok === false) {
        setExportState(result.code === "EXPORT_BLOCKED" ? "blocked" : "failed");
        setExportStatus(result.message || result.error || "내보내기 실행에 실패했습니다.");
        return;
      }
      if (result.smoke?.ok === false) {
        setExportState("failed");
        setExportStatus("실행 확인 결과 실패했습니다. 산출물과 smoke issue를 확인하세요.");
        return;
      }
      setExportState("completed");
      setExportStatus("내보내기와 실행 확인이 완료되었습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportState("failed");
      setExportPlan({
        ...currentExportPlan,
        state: "failed",
        canExport: false,
        failureCause: message,
        retryable: true,
        nextAction: "저장 위치와 API 응답을 확인한 뒤 다시 실행하세요."
      });
      setExportStatus(`내보내기 실패: ${message}`);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section className="page-panel project-detail-panel" aria-labelledby="projectDetailTitle">
      <div className="section-header page-header">
        <div>
          <p className="eyebrow">Project Detail</p>
          <h2 id="projectDetailTitle">{currentProject?.title || shellProjectTitle}</h2>
        </div>
        <span className="state-chip">{activeTabLabel}</span>
        <div className="page-primary-action">
          <span>{primaryActionLabel}</span>
          <Button icon={primaryActionTab === "heroine" ? <Heart size={16} /> : <ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/${primaryActionTab}`)} variant="primary">
            {primaryActionLabel}
          </Button>
        </div>
      </div>
      {currentProject ? (
        <dl className="summary-list detail-summary">
          <div><dt>ID</dt><dd>{currentProject.id}</dd></div>
          <div><dt>개요</dt><dd>{currentProject.premise || "개요 없음"}</dd></div>
          <div><dt>히로인</dt><dd>{currentProject.characters?.length ?? 0}명</dd></div>
          <div><dt>루트/씬</dt><dd>{currentProject.routes?.length ?? 0}개 / {currentProject.scenes?.length ?? 0}개</dd></div>
        </dl>
      ) : (
        <p className="page-muted">상세 URL의 프로젝트를 복원하는 중입니다.</p>
      )}
      <TabList
        ariaLabel="프로젝트 상세 탭"
        items={detailTabs.map((item) => ({
          id: item.id,
          label: item.label,
          to: `/projects/${detailProjectId}/${item.id}`,
          badge: item.id === "background" && currentProject?.assets?.some((asset) => asset.kind === "background") ? "1/1" : undefined,
          status: item.id === "heroine" && currentProject?.characters?.length ? "연결됨" : undefined
        }))}
        onBeforeNavigate={(item) => hasUnsavedProjectDraft ? window.confirm(`${item.label} 탭으로 이동할까요? 저장하지 않은 변경은 유지되지 않습니다.`) : true}
      />
      <div className="detail-tab-body">
        {activeTab === "overview" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>다음 행동</h3>
              <p>{summary.primaryLabel || "프로젝트 제작 상태를 확인하세요."}</p>
              {summary.blockingIssues?.length ? (
                <ul className="compact-list">
                  {summary.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : <p className="page-muted">차단된 항목이 없습니다.</p>}
              <div className="button-row">
                <Button icon={primaryActionTab === "heroine" ? <Heart size={16} /> : <ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/${primaryActionTab}`)} variant="primary">
                  {primaryActionLabel}
                </Button>
              </div>
            </section>
            <section className="detail-card">
              <h3>현재 상태</h3>
              <dl className="summary-list">
                <div><dt>저장 위치</dt><dd>{projectDirectory || "저장 위치 미연결"}</dd></div>
                <div><dt>현재 상태</dt><dd>{currentProject ? "프로젝트 열림" : "복원 중"}</dd></div>
                <div><dt>상태 요약</dt><dd>{summary.primaryLabel || "프로젝트 제작 상태를 확인하세요."}</dd></div>
              </dl>
            </section>
            <section className="detail-card">
              <h3>해결해야 할 차단 항목</h3>
              {summary.blockingIssues?.length ? (
                <ul className="compact-list">
                  {summary.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : <p className="page-muted">차단된 항목이 없습니다.</p>}
            </section>
            <section className="detail-card">
              <h3>완료된 단계 / 남은 단계</h3>
              <p>완료된 단계 {doneSteps}개 · 남은 단계 {remainingSteps}개</p>
              <ol className="stepper">
                {summary.steps?.map((step) => <li className={`step-${step.state}`} key={step.id}>{step.label}</li>)}
              </ol>
            </section>
            <section className="detail-card">
              <h3>상태 요약</h3>
              <dl className="summary-list">
                <div><dt aria-label="validationState">문제 확인</dt><dd>{stateLabel(summary.validationState)}</dd></div>
                <div><dt aria-label="generationState">이미지 작업</dt><dd>{stateLabel(summary.generationState)}</dd></div>
                <div><dt aria-label="previewState">프리뷰</dt><dd>{stateLabel(summary.previewState)}</dd></div>
                <div><dt aria-label="exportState">내보내기</dt><dd>{stateLabel(summary.exportState)}</dd></div>
              </dl>
            </section>
          </div>
        ) : null}
        {activeTab === "heroine" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>히로인 스냅샷</h3>
              {heroineState === "loading" ? <p>히로인 라이브러리를 불러오는 중입니다.</p> : null}
              {heroineState === "blocked" ? (
                <>
                  <p>히로인 라이브러리를 먼저 준비해야 합니다.</p>
                  <Button icon={<ArrowRight size={16} />} onClick={() => navigate("/heroines")}>히로인 관리로 이동</Button>
                </>
              ) : null}
              {heroineState === "ready" ? (
                <>
                  <p>프로젝트에 사용할 히로인을 선택하세요.</p>
                  <label className="field-row">
                    <span>스냅샷 선택</span>
                    <select onChange={(event) => setSelectedHeroineId(event.target.value)} value={selectedHeroineId}>
                      {heroines.map((heroine) => <option key={heroine.id} value={heroine.id}>{heroine.name}</option>)}
                    </select>
                  </label>
                  <Button disabled={busy} icon={<CheckCircle2 size={16} />} onClick={() => void assignHeroineSnapshot()} variant="primary">
                    선택한 히로인 배정
                  </Button>
                </>
              ) : null}
              {heroineState === "assigned" && assignedHeroine ? (
                <>
                  <p>프로젝트 스냅샷은 원본 수정 아님 상태로 저장되어, 라이브러리 원본을 바꿔도 자동 변경되지 않습니다.</p>
                  <dl className="summary-list">
                    <div><dt>프로젝트에 저장된 표시 이름</dt><dd>{assignedHeroine.displayName || "이름 없음"}</dd></div>
                    <div><dt>라이브러리 원본 이름</dt><dd>{sourceHeroine?.name || assignedHeroine.sourceHeroineName || "원본 이름 정보 없음"}</dd></div>
                    <div><dt>원본 히로인 ID</dt><dd>{assignedHeroine.sourceHeroineId || assignedHeroine.id}</dd></div>
                    <div><dt>스냅샷 생성 시각</dt><dd>{assignedHeroine.sourceSnapshotCreatedAt || "기록 없음"}</dd></div>
                    <div><dt>저장 상태</dt><dd>{currentProject ? "프로젝트에 저장됨" : "저장 상태 확인 필요"}</dd></div>
                    <div><dt>마지막 수정 시각</dt><dd>{sourceHeroine?.updatedAt || snapshotSavedAt}</dd></div>
                  </dl>
                  <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/background`)} variant="primary">
                    배경 화면 생성으로 이동
                  </Button>
                </>
              ) : null}
            </section>
            <section className="detail-card">
              <h3>라이브러리 원본</h3>
              <p>{heroineStatus}</p>
              {assignedHeroine ? (
                <>
                  <dl className="summary-list">
                    <div><dt>원본과 다른 필드</dt><dd>{snapshotDifferences.length ? snapshotDifferences.join(", ") : "현재 감지된 차이 없음"}</dd></div>
                    <div><dt>원본 설명</dt><dd>{sourceHeroine?.summary || sourceHeroine?.description || assignedHeroine.description || "원본 설명 정보 없음"}</dd></div>
                    <div><dt>프로젝트 캐릭터 ID</dt><dd>{assignedHeroine.id || "기록 없음"}</dd></div>
                  </dl>
                  <p className="page-muted">Alpha는 프로젝트당 히로인 1명만 사용합니다. 라이브러리 원본이 바뀌어도 기존 프로젝트 스냅샷은 자동 변경되지 않습니다.</p>
                  <div className="button-row">
                    <Button icon={<RefreshCw size={16} />} onClick={() => navigate("/heroines")} variant="ghost">
                      히로인 관리로 이동
                    </Button>
                    {assignedHeroine.sourceHeroineId ? (
                      <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/heroines/${assignedHeroine.sourceHeroineId}/edit`)} variant="ghost">
                        라이브러리 원본 수정
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="page-muted">아직 프로젝트 스냅샷이 없습니다. 스냅샷 선택 후 프로젝트에 저장합니다.</p>
                  <Button icon={<RefreshCw size={16} />} onClick={() => navigate("/heroines")} variant="ghost">
                    히로인 관리로 이동
                  </Button>
                </>
              )}
            </section>
          </div>
        ) : null}
        {activeTab === "studio" ? (
          <div className="detail-tab-grid" data-testid="studio-under-construction">
            <section className="detail-card detail-card-wide">
              <h3>제작 탭은 준비 중입니다.</h3>
              <p>Alpha에서는 시나리오 작성, 분기 편집, 장면 구성 흐름이 이 영역에 들어올 예정입니다.</p>
              <ul className="compact-list">
                <li>시나리오 작성: 프로젝트 스냅샷과 배경 에셋을 바탕으로 장면 초안을 다룹니다.</li>
                <li>분기 편집: 선택지와 엔딩 도달 상태를 시각적으로 조정합니다.</li>
                <li>장면 구성: 대사, 배경, 캐릭터 표시를 한 장면 단위로 편집합니다.</li>
              </ul>
              <div className="inline-status">실제 동작하지 않는 제작 버튼은 제공하지 않습니다.</div>
            </section>
          </div>
        ) : null}
        {activeTab === "background" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>대상 프로젝트</h3>
              <span className="state-chip">배경 {hasBackgroundAsset ? "1/1" : "0/1"}</span>
              <p className="page-muted">Alpha에서는 프로젝트당 배경 1개만 생성할 수 있습니다.</p>
              <dl className="summary-list">
                <div><dt>제목</dt><dd>{currentProject?.title || shellProjectTitle}</dd></div>
                <div><dt>프로젝트 ID</dt><dd>{currentProject?.id || projectId || "확인 필요"}</dd></div>
                <div><dt>저장될 결과 위치</dt><dd>{backgroundOutputLocation}</dd></div>
                <div><dt>기존 배경 교체</dt><dd>{backgroundReplaceText}</dd></div>
                <div><dt>생성 경로</dt><dd>Codex app-server · ChatGPT managed OAuth · imageGeneration</dd></div>
              </dl>
              <p className="page-muted">API key 입력 흐름은 제공하지 않습니다. OAuth, app-server, adapter, 응답 파싱 오류를 구분해 표시합니다.</p>
            </section>
            <section className="detail-card">
              <h3>생성할 배경 설명</h3>
              <label className="field-row">
                <span>프롬프트</span>
                <textarea className="event-prompt-input" disabled={backgroundBusy} onChange={(event) => setBackgroundPrompt(event.target.value)} placeholder={suggestedBackgroundPrompt} value={backgroundPrompt} />
              </label>
              <dl className="summary-list">
                <div><dt>작업 ID</dt><dd>{backgroundJobId || suggestedBackgroundJobId}</dd></div>
                <div><dt>결과 에셋 ID</dt><dd>{suggestedBackgroundAssetId}</dd></div>
                <div><dt>backgroundAssetId</dt><dd>{backgroundLinkedScene?.backgroundAssetId || "생성 후 기본 장면에 연결"}</dd></div>
              </dl>
              <div className="button-row">
                <Button disabled={backgroundBusy || !currentProject} icon={<ImageIcon size={16} />} onClick={() => void runBackgroundGeneration()} variant="primary">
                  배경 생성
                </Button>
                <Button disabled={backgroundBusy || !currentProject} icon={<RefreshCw size={16} />} onClick={() => void runBackgroundGeneration()}>
                  다시 시도
                </Button>
                <Button disabled={assetBusy || backgroundBusy} icon={<RefreshCw size={16} />} onClick={() => void loadGenerationJobs()} variant="ghost">
                  새로고침
                </Button>
              </div>
            </section>
            <section className="detail-card detail-card-wide">
              <h3>저장 위치/에셋 연결 상태</h3>
              <div className={backgroundErrors.length ? "inline-status warning" : "inline-status success"}>
                {backgroundStatus}
              </div>
              {backgroundErrors.length ? (
                <ul className="compact-list">
                  {backgroundErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              ) : (
                <p className="page-muted">현재 표시할 생성 오류가 없습니다. 실패하면 OAuth, app-server, adapter, 응답 파싱 중 하나로 분류됩니다.</p>
              )}
              <dl className="summary-list">
                <div><dt>저장 위치</dt><dd>{currentBackgroundAsset?.uri || backgroundOutputLocation}</dd></div>
                <div><dt>에셋 연결</dt><dd>{currentBackgroundAsset?.id || activeBackgroundJob?.outputAssetId || suggestedBackgroundAssetId}</dd></div>
                <div><dt>장면 연결</dt><dd>{backgroundLinkedScene ? `${backgroundLinkedScene.label || backgroundLinkedScene.id} · backgroundAssetId ${backgroundLinkedScene.backgroundAssetId || "대기 중"}` : "연결할 장면 없음"}</dd></div>
              </dl>
              {backgroundPreviewUri ? <img className="asset-preview-image" alt={currentBackgroundAsset?.label || "생성된 배경 미리보기"} src={backgroundPreviewUri} /> : <p className="page-muted">성공 시 생성된 배경 미리보기가 여기에 표시됩니다.</p>}
              {backgroundJobs.length ? (
                <ul className="asset-job-list">
                  {backgroundJobs.map((job) => (
                    <li key={job.id || job.outputAssetId}>
                      {job.asset?.uri ? <img alt={job.asset.label || job.outputAssetId || "결과 에셋"} src={job.asset.uri} /> : <span className="asset-job-thumb"><ImageIcon size={18} /></span>}
                      <div>
                        <strong>{job.id || imageJobKindLabel(job.kind)}</strong>
                        <span>{imageJobKindLabel(job.kind)} · {jobStatusLabel(job.status)} · {job.provider || "provider 확인 필요"}</span>
                        <p>{job.prompt || "프롬프트 없음"}</p>
                        <small>결과 에셋: {job.outputAssetId || job.asset?.id || "대기 중"}</small>
                        {job.failureMessage ? <small>{job.failureMessage}</small> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="page-muted">배경 생성 전에는 작업 목록이 비어 있습니다.</p>
              )}
              <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/preview`)} variant="ghost">
                프리뷰로 이동
              </Button>
            </section>
          </div>
        ) : null}
        {activeTab === "preview" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>프리뷰 생성</h3>
              <span className="state-chip">{previewStateLabel(previewState)}</span>
              <div className={previewState === "failed" || previewState === "blocked" ? "inline-status warning" : "inline-status success"}>
                {previewStatus}
              </div>
              <p className="page-muted">공통 헤더와 탭 바는 유지됩니다. availableState: {currentPreviewReadiness.availableState || "unknown"}</p>
              <dl className="summary-list">
                <div><dt>필수 데이터 상태</dt><dd>{Object.entries(currentPreviewReadiness.requiredData || {}).map(([name, value]) => `${name}: ${value}`).join(" · ") || "확인 전"}</dd></div>
                <div><dt>실패 원인</dt><dd>{currentPreviewReadiness.failureCause || "없음"}</dd></div>
                <div><dt>재시도 가능 여부</dt><dd>{currentPreviewReadiness.retryable ? "가능" : "불필요"}</dd></div>
                <div><dt>다음 행동</dt><dd>{currentPreviewReadiness.nextAction || "프리뷰를 실행하세요."}</dd></div>
              </dl>
              {currentPreviewReadiness.missingItems?.length ? (
                <div>
                  <h4>누락 항목</h4>
                  <ul className="compact-list">
                    {currentPreviewReadiness.missingItems.map((item) => <li key={`${item.id}-${item.tab}`}>{item.label || item.id}</li>)}
                  </ul>
                  <div className="button-row">
                    {(currentPreviewReadiness.nextActions || []).map((action) => (
                      <Button key={`${action.tab}-${action.label}`} icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/${action.tab || tabFromAction(summary.primaryAction)}`)} variant="ghost">
                        해결 탭으로 이동
                      </Button>
                    ))}
                  </div>
                </div>
              ) : <p className="page-muted">누락 항목 없음</p>}
              <label className="field-row">
                <span>시작 씬</span>
                <select disabled={previewBusy} onChange={(event) => setPreviewSceneId(event.target.value)} value={previewSceneId || currentProject?.scenes?.[0]?.id || ""}>
                  {(currentProject?.scenes || []).map((scene) => <option key={scene.id} value={scene.id}>{sceneLabel(scene)}</option>)}
                </select>
              </label>
              <div className="button-row">
                <Button disabled={previewBusy || !currentProject || previewRunBlocked} icon={<Play size={16} />} onClick={() => void runPreview()} variant="primary">
                  처음부터 플레이
                </Button>
                <Button disabled={previewBusy || !currentProject || previewRunBlocked} icon={<Play size={16} />} onClick={() => void runPreview(previewSceneId || currentProject?.scenes?.[0]?.id)}>
                  현재 씬
                </Button>
                <Button disabled={previewBusy || !currentProject} icon={<CheckCircle2 size={16} />} onClick={() => void validateBeforePreview()}>
                  검증 실행
                </Button>
              </div>
              {previewIssues.length ? (
                <ul className="compact-list">
                  {previewIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : <p className="page-muted">검증 문제 없음</p>}
            </section>
            <section className="detail-card">
              <h3>runtime 플레이</h3>
              {currentPreviewScene ? (
                <div className="runtime-preview">
                  {currentPreviewScene.cgAsset?.uri ? <img alt={currentPreviewScene.cgAsset.label || "CG"} src={currentPreviewScene.cgAsset.uri} /> : null}
                  <span>{currentPreviewScene.label || currentPreviewScene.id}</span>
                  <strong>{currentPreviewScene.speaker || "나레이션"}</strong>
                  <p>{currentPreviewScene.text || "본문 없음"}</p>
                  {currentPreviewScene.choices?.length ? (
                    <ul className="compact-list">
                      {currentPreviewScene.choices.map((choice) => <li key={choice.id || choice.text}>{choice.text}</li>)}
                    </ul>
                  ) : null}
                  {currentPreviewScene.ending ? <small>엔딩: {currentPreviewScene.ending.title}</small> : null}
                </div>
              ) : (
                <p className="page-muted">프리뷰를 생성하면 runtime 플레이 화면이 표시됩니다.</p>
              )}
              <details className="developer-drawer">
                <summary>개발자 상세</summary>
                <pre>{previewRuntime ? JSON.stringify({ label: "runtime JSON", runtime: previewRuntime }, null, 2) : "runtime JSON 없음"}</pre>
              </details>
            </section>
          </div>
        ) : null}
        {activeTab === "export" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>내보내기 실행</h3>
              <span className="state-chip">{exportStateLabel(exportState)}</span>
              <div className={exportState === "failed" || exportState === "blocked" ? "inline-status warning" : "inline-status success"}>
                {exportStatus}
              </div>
              <p className="page-muted">내보내기 대상: 로컬 데스크톱형 웹 앱 · githubPagesTarget: {String(currentExportPlan.githubPagesTarget)}</p>
              <p className="page-muted">GitHub Pages는 레거시 대상이며 이번 내보내기 대상이 아닙니다.</p>
              <dl className="summary-list">
                <div><dt>검증 요약</dt><dd>validationSummary {currentExportPlan.validationSummary?.ok ? "통과" : "차단"} · issues {currentExportPlan.validationSummary?.issueCount ?? 0}</dd></div>
                <div><dt>포함될 프로젝트 데이터</dt><dd>{currentExportPlan.includedData?.join(" · ") || "확인 전"}</dd></div>
                <div><dt>포함될 에셋</dt><dd>{currentExportPlan.includedAssets?.length ? currentExportPlan.includedAssets.map((asset) => `${asset.kind}:${asset.id}`).join(" · ") : "없음"}</dd></div>
                <div><dt>차단 항목</dt><dd>{currentExportPlan.blockers?.length ? currentExportPlan.blockers.map((blocker) => blocker.message || blocker.id || blocker.kind).join(" · ") : "없음"}</dd></div>
                <div><dt>실패 원인</dt><dd>{currentExportPlan.failureCause || "없음"}</dd></div>
                <div><dt>재시도 가능 여부</dt><dd>{currentExportPlan.retryable ? "가능" : "불필요"}</dd></div>
                <div><dt>다음 행동</dt><dd>{currentExportPlan.nextAction || "내보내기를 실행하세요."}</dd></div>
              </dl>
              <p className="page-muted">실패 상태가 완료 상태로 오인되지 않습니다: {currentExportPlan.state === "failed" || currentExportPlan.state === "blocked" ? "완료 아님" : currentExportPlan.state || "확인 전"}</p>
              {incompleteImageJobs.length ? (
                <ul className="compact-list">
                  {incompleteImageJobs.map((job) => <li key={job.id}>필수 이미지 미완료: {imageJobKindLabel(job.kind)} · {job.id}</li>)}
                </ul>
              ) : <p className="page-muted">필수 배경 화면/CG 작업이 완료됐거나 필요하지 않습니다.</p>}
              <div className="button-row">
                <Button disabled={exportBusy || !currentProject} icon={<CheckCircle2 size={16} />} onClick={() => void runExport()} variant="primary">
                  내보내기 실행
                </Button>
                <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/preview`)} variant="ghost">
                  다음 action: 프리뷰 확인
                </Button>
              </div>
              <p className="page-muted">EXPORT_BLOCKED 상태는 검증 실패나 필수 이미지 작업 미완료일 때 표시됩니다.</p>
            </section>
            <section className="detail-card">
              <h3>산출물 위치</h3>
              {exportResult ? (
                <dl className="summary-list">
                  <div><dt>폴더</dt><dd>{exportResult.outputDirectory || "기록 없음"}</dd></div>
                  <div><dt>index</dt><dd>{exportResult.indexPath || "기록 없음"}</dd></div>
                  <div><dt>data</dt><dd>{exportResult.projectDataPath || "기록 없음"}</dd></div>
                </dl>
              ) : (
                <p className="page-muted">내보내기를 실행하면 산출물 위치가 표시됩니다.</p>
              )}
            </section>
            <section className="detail-card detail-card-wide">
              <h3>실행 확인 결과</h3>
              {smokeResult ? (
                <>
                  <div className={smokeResult.ok ? "inline-status success" : "inline-status warning"}>
                    smoke {smokeResult.ok ? "통과" : "실패"}
                  </div>
                  <dl className="summary-list">
                    {Object.entries(smokeResult.checks || {}).map(([name, ok]) => <div key={name}><dt>{name}</dt><dd>{ok ? "통과" : "실패"}</dd></div>)}
                  </dl>
                  {smokeResult.issues?.length ? (
                    <ul className="compact-list">
                      {smokeResult.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="page-muted">아직 실행 확인 결과가 없습니다.</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
