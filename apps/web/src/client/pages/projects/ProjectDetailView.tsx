import { ArrowRight, CheckCircle2, Copy, ExternalLink, GitCompareArrows, Heart, Image as ImageIcon, Play, RefreshCw, Settings, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { AssetStatePanel, Button, DiagnosticDrawer, EmptyState, ReadinessPanel, StatusChip, TabList, TabStatusList } from "../../components/ui";
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
  type ProjectPreviewPreflight,
  type ProjectPreviewReadiness,
  type ProjectRepairAction,
  type ProjectRepairActionRequiredInput,
  type ProjectRepairHistoryEntry,
  type ProjectRepairPreview,
  type ProjectRuntime,
  type ProjectRuntimeScene,
  type ProjectSmokeResult,
  type ProjectTabId,
  type ProjectWorkflowSummary
} from "./projectPageTypes";
import {
  createPreviewExportResetState,
  emptyExportPlan,
  emptyPreviewReadiness,
  primaryActionDisplayLabel,
  primaryActionTabFromSummary
} from "./projectDetailState";
import {
  activeRepairHistoryEntry,
  repairActionKey,
  repairActionMetaText,
  repairInputDisplayLabel,
  repairInputValue,
  repairRequestBody,
  repairResultMessage
} from "./projectRepairFlow";
import {
  backgroundAssetDisplayLabel,
  backgroundConnectionText,
  backgroundSceneConnectionText,
  displayWorkflowStep,
  dummyFallbackDetailText,
  dummyFallbackSummaryText,
  dummyFallbackTargetText,
  dummyPackVersionText,
  fallbackReasonText,
  generationProviderText,
  imageJobKindLabel,
  isDummyAsset,
  isDummyGenerationJob,
  isVisualImageJob,
  jobStatusLabel,
  repairDiffOperationLabel,
  repairDiffValueText
} from "./projectDisplayText";
import { StudioWorkspace } from "./StudioWorkspace";

interface ProjectDetailViewProps {
  activeTab: ProjectTabId;
  currentProject: ProjectData | null;
  onProjectResult: (result: ProjectApiResult) => void;
  projectDirectory: string;
  projectExportPlan: ProjectExportPlan | null;
  projectId?: string;
  projectPreviewPreflight: ProjectPreviewPreflight | null;
  projectPreviewReadiness: ProjectPreviewReadiness | null;
  projectRepairActions: ProjectRepairAction[];
  shellProjectTitle: string;
  workflowSummary: ProjectWorkflowSummary | null;
}

type EventTabState = "blockedNoHeroine" | "ready" | "expanding" | "patchPending" | "patchInvalid" | "patchStale" | "approving";
type PendingEventPatch = ProjectApiResult & Required<Pick<ProjectApiResult, "request" | "plan">>;
type AssetState = "empty" | "planned" | "running" | "failed" | "completed" | "partialFailed";
type PreviewState = "empty" | "blocked" | "stale" | "running" | "ready" | "failed";
type ExportState = "empty" | "blocked" | "running" | "ready" | "completed" | "failed";

interface DummyFallbackTarget {
  asset?: ProjectAsset;
  fallbackReason?: string;
  job?: ProjectGenerationJob;
  key: string;
  location?: string;
  packVersion?: string;
  sourceGeneratedBy?: string;
}

const tabsWithLocalPrimaryAction = new Set<ProjectTabId>(["overview", "heroine", "background", "preview", "export"]);
const studioNavigationLabel = "제작으로 이동";

const emptyWorkflowSummary: ProjectWorkflowSummary = {
  primaryAction: "goToHeroine",
  primaryLabel: "프로젝트 제작 상태를 확인하세요.",
  blockingIssues: [],
  validationState: "unknown",
  generationState: "empty",
  previewState: "empty",
  exportState: "empty",
  steps: []
};

function stateLabel(value?: string): string {
  if (!value) {
    return "확인 필요";
  }
  if (value === "valid") return "문제 없음";
  if (value === "error") return "문제 확인 필요";
  if (value === "empty") return "비어 있음";
  if (value === "planned") return "작업 예정";
  if (value === "ready") return "준비됨";
  if (value === "waiting") return "대기";
  if (value === "completed") return "완료";
  if (value === "blocked") return "차단";
  if (value === "stale") return "다시 확인 필요";
  return value;
}

function workflowStepStateLabel(value?: string): string {
  if (value === "done") return "완료";
  if (value === "current") return "진행 필요";
  if (value === "blocked") return "차단";
  if (value === "waiting") return "대기";
  return "확인 필요";
}

function projectTabFromValue(value?: string): ProjectTabId {
  return detailTabs.some((tab) => tab.id === value) ? value as ProjectTabId : "overview";
}

function tabShellStatus(tab: ProjectTabId, summary: ProjectWorkflowSummary, project: ProjectData | null, hasBackgroundAsset: boolean): string {
  if (tab === "overview") {
    return summary.blockingIssues?.length ? "확인 필요" : "정상";
  }
  if (tab === "heroine") {
    return project?.characters?.length ? "연결됨" : "필요";
  }
  if (tab === "background") {
    return hasBackgroundAsset ? "완료" : stateLabel(summary.generationState);
  }
  if (tab === "preview") {
    return stateLabel(summary.previewState);
  }
  if (tab === "export") {
    return stateLabel(summary.exportState);
  }
  if (tab === "studio") {
    return "준비 중";
  }
  const step = summary.steps?.find((item) => item.id === tab);
  return workflowStepStateLabel(step?.state);
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

function generationErrorCategory(result: ProjectApiResult): "연결 인증" | "생성 서버" | "생성 처리" | "응답 형식" {
  if (result.code === "OAUTH_REQUIRED" || result.httpStatus === 401) return "연결 인증";
  if (result.code === "NON_JSON_RESPONSE" || result.code === "EMPTY_RESPONSE") return "응답 형식";
  const message = `${result.message || ""} ${result.error || ""} ${(result.errors || []).join(" ")}`;
  if (message.includes("OAuth 로그인이 필요")) return "연결 인증";
  if (message.includes("app-server")) return "생성 서버";
  return "생성 처리";
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

function dummyAssetKey(asset?: ProjectAsset | null): string {
  return asset?.id || asset?.uri || asset?.generationJobId || "";
}

function jobAsset(job: ProjectGenerationJob, assets: ProjectAsset[]): ProjectAsset | undefined {
  return job.asset
    || assets.find((asset) => asset.id && asset.id === job.outputAssetId)
    || assets.find((asset) => asset.generationJobId && asset.generationJobId === job.id);
}

function collectDummyImageAssets(project: ProjectData | null, exportPlan: ProjectExportPlan | null, runtime: ProjectRuntime | null): ProjectAsset[] {
  const assets = [
    ...(project?.assets || []),
    ...(exportPlan?.includedAssets || []),
    ...(runtime?.assets || [])
  ].filter(isDummyAsset);
  const seen = new Set<string>();
  return assets.filter((asset, index) => {
    const key = dummyAssetKey(asset) || `asset-${index}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildDummyFallbackTargets(jobs: ProjectGenerationJob[], assets: ProjectAsset[]): DummyFallbackTarget[] {
  const targets: DummyFallbackTarget[] = [];
  const consumedAssetKeys = new Set<string>();
  jobs.filter(isDummyGenerationJob).forEach((job, index) => {
    const asset = jobAsset(job, assets);
    const assetKey = dummyAssetKey(asset);
    if (assetKey) {
      consumedAssetKeys.add(assetKey);
    }
    targets.push({
      asset,
      fallbackReason: job.fallbackReason || asset?.provenance?.fallbackReason,
      job,
      key: `job:${job.id || job.outputAssetId || index}`,
      location: asset?.uri || job.asset?.uri,
      packVersion: job.packVersion || asset?.provenance?.packVersion,
      sourceGeneratedBy: job.sourceGeneratedBy || asset?.provenance?.sourceGeneratedBy
    });
  });
  assets.forEach((asset, index) => {
    const assetKey = dummyAssetKey(asset);
    if (assetKey && consumedAssetKeys.has(assetKey)) {
      return;
    }
    targets.push({
      asset,
      fallbackReason: asset.provenance?.fallbackReason,
      key: `asset:${assetKey || index}`,
      location: asset.uri,
      packVersion: asset.provenance?.packVersion,
      sourceGeneratedBy: asset.provenance?.sourceGeneratedBy
    });
  });
  return targets;
}

function isSafeDummyAssetLocation(location?: string): boolean {
  const value = location?.trim();
  if (!value) {
    return false;
  }
  if (value.toLowerCase().startsWith("javascript:")) {
    return false;
  }
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:";
  } catch {
    return false;
  }
}

function previewStateLabel(value: PreviewState): string {
  if (value === "empty") return "프리뷰 없음";
  if (value === "blocked") return "차단";
  if (value === "stale") return "다시 생성 필요";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  return "준비됨";
}

function previewReadinessStateLabel(value?: string): string {
  if (value === "prepared") return "준비됨";
  if (value === "ready") return "준비됨";
  if (value === "empty") return "확인 전";
  if (value === "stale") return "다시 확인 필요";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  if (value === "blocked") return "차단";
  return value || "확인 전";
}

function previewPreflightStatusText(preflight: ProjectPreviewPreflight | null): string {
  if (!preflight) {
    return "확인 전";
  }
  return preflight.canRun ? "실행 가능" : preflight.disabledReason || "차단 항목 확인 필요";
}

function previewPreflightCapabilityText(preflight: ProjectPreviewPreflight | null): string {
  if (!preflight) {
    return "확인 전";
  }
  const conditionRuntimeSupport = preflight.conditionRuntimeSupport || preflight.runtimeCapabilities?.conditionRuntimeSupport;
  if (conditionRuntimeSupport?.strictPreviewStatus === "not_evaluated") {
    const strictPreviewSuccess = conditionRuntimeSupport.strictPreviewSuccess === true;
    const status = strictPreviewSuccess ? "strict success 포함" : "strict success 제외";
    return `condition preview not evaluated · ${status}`;
  }
  const capabilities = preflight.runtimeCapabilities;
  if (capabilities?.choiceConditionFiltering && capabilities?.choiceEffects) {
    return "조건과 효과 반영";
  }
  const conditionWarning = preflight.warnings?.find((warning) => warning.issueCode === "conditional-choice-runtime-unsupported");
  return conditionWarning ? "조건/효과는 아직 미리보기 판정에 반영하지 않습니다." : "조건 미리보기 미지원";
}

function previewPreflightIssueText(issue: NonNullable<ProjectPreviewPreflight["blockers"]>[number]): string {
  if (issue.issueCode === "conditional-choice-runtime-unsupported") {
    const choiceCount = issue.choiceIds?.length ? ` · 선택지 ${issue.choiceIds.length}개` : "";
    return `조건/효과는 아직 미리보기 판정에 반영하지 않습니다.${choiceCount}`;
  }
  const code = issue.issueCode ? `[${issue.issueCode}] ` : "";
  const path = issue.path ? `${issue.path}: ` : "";
  const repairs = issue.repairActionIds?.length ? ` · 해결 경로 ${issue.repairActionIds.join(", ")}` : "";
  return `${code}${path}${issue.message || "확인이 필요합니다."}${repairs}`;
}

function requiredDataNameLabel(name: string): string {
  if (name === "heroine") return "히로인";
  if (name === "background") return "배경";
  if (name === "event") return "장면";
  if (name === "scenes") return "장면";
  if (name === "validation") return "검증";
  if (name === "generationJobs") return "이미지 작업";
  return name;
}

function requiredDataValueLabel(value?: string): string {
  if (value === "ready" || value === "valid" || value === "completed") return "준비됨";
  if (value === "missing") return "필요";
  if (value === "pending") return "진행 중";
  if (value === "invalid") return "확인 필요";
  if (value === "waiting" || value === "planned" || value === "running") return "진행 중";
  if (value === "error" || value === "failed" || value === "blocked") return "확인 필요";
  if (value === "empty" || value === "unknown") return "확인 전";
  return value || "확인 전";
}

function exportStateLabel(value: ExportState): string {
  if (value === "empty") return "내보내기 없음";
  if (value === "blocked") return "차단";
  if (value === "running") return "실행 중";
  if (value === "completed") return "완료";
  if (value === "failed") return "실패";
  return "준비됨";
}

function exportPlanStateLabel(value?: string): string {
  if (value === "ready") return "준비됨";
  if (value === "blocked") return "차단";
  if (value === "running") return "실행 중";
  if (value === "complete" || value === "completed") return "완료";
  if (value === "failed") return "실패";
  return "확인 전";
}

function exportValidationSummaryText(plan: ProjectExportPlan): string {
  const issueCount = plan.validationSummary?.issueCount ?? 0;
  const status = plan.validationSummary?.ok ? "검증 통과" : "검증 확인 필요";
  return issueCount > 0 ? `${status} · 문제 ${issueCount}건` : `${status} · 문제 없음`;
}

function assetKindSummaryLabel(kind?: string): string {
  if (kind === "portrait") return "포트레이트";
  if (kind === "background") return "배경 화면";
  if (kind === "cg") return "이벤트 CG";
  return "에셋";
}

function exportAssetSummaryText(assets?: ProjectAsset[]): string {
  if (!assets?.length) {
    return "없음";
  }
  const counts = assets.reduce<Record<string, number>>((summary, asset) => {
    const label = assetKindSummaryLabel(asset.kind);
    summary[label] = (summary[label] || 0) + 1;
    return summary;
  }, {});
  return Object.entries(counts).map(([label, count]) => `${label} ${count}개`).join(" · ");
}

function exportBlockerSummaryText(blockers?: ProjectExportPlan["blockers"]): string {
  if (!blockers?.length) {
    return "없음";
  }
  return blockers.map((blocker) => {
    if (blocker.kind === "generationJob") {
      return "필수 이미지 작업이 완료되지 않았습니다.";
    }
    return blocker.message || "확인이 필요합니다.";
  }).join(" · ");
}

function runtimeScene(runtime: ProjectRuntime | null, sceneId?: string): ProjectRuntimeScene | null {
  if (!runtime?.scenes?.length) {
    return null;
  }
  return runtime.scenes.find((scene) => scene.id === sceneId) || runtime.scenes.find((scene) => scene.id === runtime.startSceneId) || runtime.scenes[0] || null;
}

export function ProjectDetailView({
  activeTab,
  currentProject: loadedProject,
  onProjectResult,
  projectDirectory,
  projectExportPlan,
  projectId,
  projectPreviewPreflight,
  projectPreviewReadiness,
  projectRepairActions,
  shellProjectTitle,
  workflowSummary
}: ProjectDetailViewProps) {
  const { postAuthedJson } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [dummyActionStatus, setDummyActionStatus] = useState("");
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
  const [previewPreflight, setPreviewPreflight] = useState<ProjectPreviewPreflight | null>(null);
  const [repairActions, setRepairActions] = useState<ProjectRepairAction[] | null>(null);
  const [repairPreview, setRepairPreview] = useState<ProjectRepairPreview | null>(null);
  const [repairHistoryEntry, setRepairHistoryEntry] = useState<ProjectRepairHistoryEntry | null>(null);
  const [repairHistory, setRepairHistory] = useState<ProjectRepairHistoryEntry[]>([]);
  const [repairActionInputs, setRepairActionInputs] = useState<Record<string, Record<string, string>>>({});
  const [repairStatus, setRepairStatus] = useState("수리 후보를 선택해 diff를 확인하세요.");
  const [repairBusy, setRepairBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewSceneQuery = searchParams.get("scene") || "";
  const [exportState, setExportState] = useState<ExportState>("empty");
  const [exportStatus, setExportStatus] = useState("내보내기 전입니다.");
  const [exportResult, setExportResult] = useState<ProjectExportResult | null>(null);
  const [exportPlan, setExportPlan] = useState<ProjectExportPlan | null>(null);
  const [smokeResult, setSmokeResult] = useState<ProjectSmokeResult | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const lastResetProjectIdRef = useRef<string | null>(null);
  const uxSessionIdRef = useRef(`detail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const routeProjectLoaded = !projectId || loadedProject?.id === projectId;
  const currentProject = routeProjectLoaded ? loadedProject : null;
  const currentWorkflowSummary = routeProjectLoaded ? workflowSummary : null;
  const summary = currentWorkflowSummary || emptyWorkflowSummary;
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
  const visibleWorkflowSteps = (summary.steps || []).map(displayWorkflowStep);
  const doneSteps = visibleWorkflowSteps.filter((step) => step.displayState === "done").length;
  const remainingSteps = visibleWorkflowSteps.length - doneSteps;
  const projectRoutes = currentProject?.routes || [];
  const projectScenes = currentProject?.scenes || [];
  const currentRoute = useMemo(() => projectRoutes.find((route) => route.id === selectedRouteId) || projectRoutes[0] || null, [projectRoutes, selectedRouteId]);
  const currentEventScene = useMemo(() => {
    const routeEntryScene = projectScenes.find((scene) => scene.id === currentRoute?.entrySceneId);
    return projectScenes.find((scene) => scene.id === selectedSceneId) || routeEntryScene || projectScenes[0] || null;
  }, [currentRoute?.entrySceneId, projectScenes, selectedSceneId]);
  const previewSceneFromQuery = useMemo(() => {
    if (!previewSceneQuery) return null;
    return projectScenes.find((scene) => scene.id === previewSceneQuery) || null;
  }, [previewSceneQuery, projectScenes]);
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
  const detailProjectId = projectId || currentProject?.id || "";
  const primaryActionTab = primaryActionTabFromSummary(summary);
  const primaryActionLabel = summary.primaryLabel || primaryActionDisplayLabel(primaryActionTab);
  const activeTabLabel = detailTabs.find((tab) => tab.id === activeTab)?.label || activeTab;
  const showHeaderPrimaryAction = Boolean(detailProjectId) && !tabsWithLocalPrimaryAction.has(activeTab);
  const currentPreviewScene = runtimeScene(previewRuntime, previewSceneId);
  const currentPreviewReadiness = previewReadiness || projectPreviewReadiness || emptyPreviewReadiness;
  const currentPreviewPreflight = previewPreflight || projectPreviewPreflight || null;
  const currentRepairActions = repairActions ?? projectRepairActions;
  const undoRepairEntry = activeRepairHistoryEntry(repairHistoryEntry);
  const selectedRepairActionKey = repairPreview?.repairAction ? repairActionKey(repairPreview.repairAction) : "";
  const previewRunBlocked = currentPreviewReadiness.canRun !== true || currentPreviewPreflight?.canRun === false;
  const currentExportPlan = exportPlan || projectExportPlan || emptyExportPlan;
  const dummyImageAssets = collectDummyImageAssets(currentProject, currentExportPlan, previewRuntime);
  const dummyImageJobs = imageJobs.filter(isDummyGenerationJob);
  const dummyFallbackTargets = buildDummyFallbackTargets(dummyImageJobs, dummyImageAssets);
  const dummyFallbackWarning = dummyFallbackSummaryText(dummyFallbackTargets.length);
  const primaryDummyFallbackItem = dummyFallbackTargets[0]?.job || dummyFallbackTargets[0]?.asset || null;
  const dummyFallbackDetail = dummyFallbackDetailText(primaryDummyFallbackItem);
  const dummyReplacementJobIds = dummyImageJobs.filter((job) => job.id).map((job) => String(job.id));
  const previewResolutionActions = [
    ...(currentPreviewReadiness.nextActions || []).map((action) => ({
      label: action.label || "해결 탭으로 이동",
      tab: projectTabFromValue(action.tab)
    })),
    ...(currentPreviewReadiness.missingItems || []).map((item) => ({
      label: `${item.label || item.id || "누락 항목"} 해결`,
      tab: projectTabFromValue(item.tab)
    }))
  ].filter((action, index, actions) => actions.findIndex((candidate) => candidate.tab === action.tab) === index);
  const exportRunReady = Boolean(currentProject && currentExportPlan.canExport === true && exportState !== "blocked" && exportState !== "failed");

  function recordUXDecisionEvent(event: Record<string, unknown>): void {
    if (!projectDirectory) {
      return;
    }
    void postAuthedJson<ProjectApiResult>("/api/events/ux/record", {
      projectDirectory,
      sessionId: uxSessionIdRef.current,
      participantIdHash: "local-browser-session",
      participantType: "local_operator",
      taskId: "phase0-preview-repair-session",
      projectId: detailProjectId,
      routeId: currentRoute?.id,
      sceneId: currentEventScene?.id,
      projectRevision: currentPreviewPreflight?.projectRevision || undefined,
      ...event
    }).catch(() => {
      // Event capture must not interrupt repair or preview actions.
    });
  }

  function recordModeratorHintGiven(): void {
    recordUXDecisionEvent({ eventName: "hint_given", helpChannel: "moderator_hint", outcome: "given" });
  }

  useEffect(() => {
    function handleModeratorHint(): void {
      recordModeratorHintGiven();
    }
    window.addEventListener("vn-maker:moderator-hint", handleModeratorHint);
    return () => window.removeEventListener("vn-maker:moderator-hint", handleModeratorHint);
  }, [projectDirectory, detailProjectId]);
  const eventDisplayState: EventTabState = !assignedHeroine
    ? "blockedNoHeroine"
    : pendingPatch && eventState === "ready"
      ? "patchPending"
      : eventState;
  const canExpandEvent = Boolean(assignedHeroine && currentRoute?.id && currentEventScene?.id && eventPrompt.trim() && !pendingPatch && !eventBusy);
  const canApproveEvent = Boolean(pendingPatch && pendingPatch.validation?.ok !== false && !eventBusy);
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
    ? `기존 배경 교체: ${backgroundAssetDisplayLabel(currentBackgroundAsset)}`
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
    if (activeTab !== "preview" || !previewSceneFromQuery?.id || previewSceneId === previewSceneFromQuery.id) {
      return;
    }
    setPreviewSceneId(previewSceneFromQuery.id);
    setPreviewStatus(`Studio에서 선택한 씬 ${sceneLabel(previewSceneFromQuery)} 기준으로 프리뷰를 준비합니다.`);
  }, [activeTab, previewSceneFromQuery, previewSceneId]);

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

  function resetPreviewAndExportState(input: {
    exportPlan?: ProjectExportPlan | null;
    previewPreflight?: ProjectPreviewPreflight | null;
    previewReadiness?: ProjectPreviewReadiness | null;
    previewStatus?: string;
    project?: ProjectData | null;
    repairActions?: ProjectRepairAction[];
    workflowSummary?: ProjectWorkflowSummary | null;
  } = {}): void {
    const nextState = createPreviewExportResetState({
      project: input.project ?? currentProject,
      workflowSummary: input.workflowSummary ?? workflowSummary,
      previewStatus: input.previewStatus
    });
    setPreviewRuntime(null);
    setPreviewSceneId("");
    setPreviewIssues([]);
    setPreviewReadiness(input.previewReadiness || null);
    setPreviewPreflight(input.previewPreflight || null);
    setRepairActions(input.repairActions ?? null);
    setRepairPreview(null);
    setRepairHistoryEntry(null);
    setRepairHistory([]);
    setRepairActionInputs({});
    setRepairStatus("수리 후보를 선택해 diff를 확인하세요.");
    setPreviewState(nextState.previewState);
    setPreviewStatus(nextState.previewStatus);
    setExportResult(null);
    setExportPlan(input.exportPlan || null);
    setSmokeResult(null);
    setExportState(nextState.exportState);
    setExportStatus(nextState.exportStatus);
  }

  useEffect(() => {
    const nextProjectId = currentProject?.id || null;
    if (lastResetProjectIdRef.current === nextProjectId) {
      return;
    }
    lastResetProjectIdRef.current = nextProjectId;
    setAssetJobs([]);
    setAssetErrors([]);
    setAssetStatus("배경 화면 작업과 이벤트 CG 작업을 확인합니다.");
    setDummyActionStatus("");
    resetPreviewAndExportState({
      exportPlan: projectExportPlan,
      previewPreflight: projectPreviewPreflight,
      previewReadiness: projectPreviewReadiness,
      repairActions: projectRepairActions
    });
  }, [currentProject?.id]);

  useEffect(() => {
    setRepairActions(null);
  }, [projectRepairActions]);

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
      const result = await postAuthedJson<ProjectApiResult>(`/api/projects/${detailProjectId}/heroine`, {
        projectDirectory,
        heroine: selectedHeroine
      });
      if (result.ok === false) {
        setHeroineStatus(result.message || result.error || "히로인 스냅샷을 배정하지 못했습니다.");
        return;
      }
      onProjectResult(result);
      resetPreviewAndExportState({
        exportPlan: result.exportPlan || null,
        previewPreflight: result.previewPreflight || null,
        previewReadiness: result.previewReadiness || null,
        previewStatus: "히로인 변경으로 프리뷰와 내보내기를 다시 확인해야 합니다.",
        project: result.project,
        repairActions: result.repairActions || [],
        workflowSummary: result.workflowSummary
      });
      setHeroineStatus("히로인 스냅샷이 프로젝트에 배정되었습니다.");
      navigate(`/projects/${detailProjectId}/studio`);
    } catch (error) {
      setHeroineStatus(`히로인 스냅샷 배정 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyDummyAssetLocation(location?: string): Promise<void> {
    if (!location) {
      setDummyActionStatus("목 이미지 파일 위치가 아직 없습니다.");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setDummyActionStatus("목 이미지 파일 위치 복사를 브라우저가 지원하지 않습니다. 개발자 상세에서 경로를 확인하세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(location);
      setDummyActionStatus("목 이미지 파일 위치를 복사했습니다.");
    } catch (error) {
      setDummyActionStatus(`목 이미지 파일 위치 복사 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openDummyAssetLocation(location?: string): void {
    const safeLocation = location?.trim();
    if (!safeLocation) {
      setDummyActionStatus("열 목 이미지 파일 위치가 아직 없습니다.");
      return;
    }
    if (!isSafeDummyAssetLocation(safeLocation)) {
      setDummyActionStatus("안전하지 않은 목 이미지 파일 위치라 열지 않았습니다.");
      return;
    }
    window.open(safeLocation, "_blank", "noopener,noreferrer");
    setDummyActionStatus("목 이미지 파일 위치 열기를 요청했습니다.");
  }

  function applyEventFailure(result: ProjectApiResult, fallbackMessage: string): void {
    const stale = result.code === "PATCH_STALE" || result.code === "STALE_PROJECT_REVISION" || result.code === "PROJECT_REVISION_CONFLICT" || result.httpStatus === 409;
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
        expectedProjectRevision: pendingPatch.projectRevision,
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
        exportPlan: result.exportPlan || null,
        previewPreflight: result.previewPreflight || null,
        previewReadiness: result.previewReadiness || null,
        previewStatus: "프로젝트 이벤트가 변경되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
        project: result.project,
        repairActions: result.repairActions || [],
        workflowSummary: result.workflowSummary
      });
      setPendingPatch(null);
      setEventIssues(result.validation?.issues || []);
      setEventPrompt("");
      setEventState("ready");
      setEventStatus("제안 승인 완료. CG 작업이 있으면 배경 화면 생성 탭으로 이동합니다.");
      navigate(`/projects/${result.project?.id || detailProjectId}/${eventResultHasCg(result, pendingPatch.plan) ? "background" : "preview"}`);
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
      setBackgroundStatus(`생성 서버: 이미지 작업 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAssetBusy(false);
    }
  }

  async function runBackgroundGeneration(): Promise<void> {
    if (!currentProject) {
      setBackgroundStatus("프로젝트 확인: 배경을 생성할 프로젝트가 없습니다.");
      return;
    }
    const prompt = backgroundPrompt.trim();
    if (!prompt) {
      setBackgroundStatus("입력 확인: 생성할 배경 설명을 입력하세요.");
      return;
    }
    const jobId = backgroundJobId.trim() || suggestedBackgroundJobId;
    setBackgroundBusy(true);
    setBackgroundErrors([]);
    setBackgroundStatus("이미지 생성 연결로 배경 작업을 준비합니다.");
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
          exportPlan: run.exportPlan || null,
          previewPreflight: run.previewPreflight || null,
          previewReadiness: run.previewReadiness || null,
          previewStatus: "배경 화면이 생성되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
          project: run.project,
          repairActions: run.repairActions || [],
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
        ? "저장 위치/에셋 연결 상태: 배경 생성 완료. 기본 장면에 연결되었습니다."
        : "저장 위치/에셋 연결 상태: 완료된 배경 결과를 유지했습니다.");
    } catch (error) {
      setBackgroundStatus(`생성 서버: 배경 화면 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
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
          exportPlan: result.exportPlan || null,
          previewPreflight: result.previewPreflight || null,
          previewReadiness: result.previewReadiness || null,
          previewStatus: "배경 화면 작업이 추가되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
          project: result.project,
          repairActions: result.repairActions || [],
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

  async function runImageJobs(jobIds: string[], retryFailed = false, replaceCompleted = false): Promise<void> {
    if (jobIds.length === 0) {
      setAssetStatus(replaceCompleted ? "교체할 더미 이미지 작업이 없습니다." : retryFailed ? "재시도할 실패 작업이 없습니다." : "실행할 예정 이미지 작업이 없습니다.");
      return;
    }
    setAssetBusy(true);
    setAssetErrors([]);
    setAssetStatus(replaceCompleted ? "실제 이미지로 교체 실행 중입니다." : retryFailed ? "실패 작업 재시도 실행 중입니다." : "이미지 만들기 실행 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/generation/jobs/run", {
        projectDirectory,
        jobIds,
        retryFailed,
        replaceCompleted
      });
      const nextJobs = (result.project?.generationJobs || result.jobs || []).filter(isVisualImageJob);
      if (nextJobs.length > 0) {
        setAssetJobs(nextJobs);
      }
      setAssetErrors(result.errors || result.issues?.map(issueText) || []);
      if (result.project) {
        onProjectResult(result);
        resetPreviewAndExportState({
          exportPlan: result.exportPlan || null,
          previewPreflight: result.previewPreflight || null,
          previewReadiness: result.previewReadiness || null,
          previewStatus: "이미지 결과가 변경되어 프리뷰와 내보내기를 다시 확인해야 합니다.",
          project: result.project,
          repairActions: result.repairActions || [],
          workflowSummary: result.workflowSummary
        });
      }
      if (result.ok === false) {
        applyAssetFailure(result, "일부 이미지 작업이 실패했습니다.");
        return;
      }
      setAssetStatus(result.assets?.length
        ? replaceCompleted ? "실제 이미지 교체 요청이 완료되었습니다. 결과 에셋이 프로젝트에 연결되었습니다." : "이미지 생성 완료. 결과 에셋이 프로젝트에 연결되었습니다."
        : replaceCompleted ? "실제 이미지 교체 요청을 완료했으나 연결된 결과 에셋이 없습니다." : "완료된 작업은 다시 호출하지 않습니다. 결과 에셋을 유지했습니다.");
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

  function updateRepairInput(action: ProjectRepairAction, input: ProjectRepairActionRequiredInput, value: string): void {
    if (!input.name) {
      return;
    }
    setRepairActionInputs((current) => ({
      ...current,
      [repairActionKey(action)]: {
        ...(current[repairActionKey(action)] || {}),
        [input.name as string]: value
      }
    }));
    setRepairPreview(null);
    setRepairStatus("입력이 변경되었습니다. 수리 diff를 다시 확인하세요.");
  }

  function applyRepairResultState(result: ProjectApiResult, status: string): void {
    const nextResetState = createPreviewExportResetState({
      project: result.project || currentProject,
      workflowSummary: result.workflowSummary || workflowSummary,
      previewStatus: result.previewPreflight?.disabledReason || "수리 결과가 반영되었습니다. 프리뷰를 다시 생성하세요."
    });
    onProjectResult(result);
    setPreviewReadiness(result.previewReadiness || null);
    setPreviewPreflight(result.previewPreflight || null);
    setRepairActions(result.repairActions || []);
    setRepairHistoryEntry(result.repairHistoryEntry || null);
    setRepairHistory(result.repairHistory || []);
    setExportPlan(result.exportPlan || null);
    setPreviewRuntime(null);
    setPreviewSceneId("");
    setPreviewIssues(validationMessages(result));
    setPreviewState(result.previewPreflight?.canRun === false ? "blocked" : nextResetState.previewState);
    setPreviewStatus(nextResetState.previewStatus);
    setExportResult(null);
    setSmokeResult(null);
    setExportState(nextResetState.exportState);
    setExportStatus(nextResetState.exportStatus);
    setRepairStatus(status);
  }

  async function previewRepairAction(action: ProjectRepairAction): Promise<void> {
    if (!projectDirectory) {
      setRepairStatus("프로젝트 저장 위치가 필요합니다.");
      return;
    }
    setRepairBusy(true);
    setRepairStatus("수리 diff를 계산하는 중입니다.");
    recordUXDecisionEvent({
      eventName: "repair_action_used",
      issueCode: action.issueCode,
      repairActionId: action.actionId,
      outcome: "used"
    });
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/project/repair/preview", repairRequestBody(action, projectDirectory, repairActionInputs, currentPreviewPreflight?.projectRevision));
      if (result.ok === false || !result.repairPreview) {
        setRepairPreview(null);
        if (result.previewReadiness) setPreviewReadiness(result.previewReadiness);
        if (result.previewPreflight) setPreviewPreflight(result.previewPreflight);
        if (result.repairActions) setRepairActions(result.repairActions);
        if (result.exportPlan) setExportPlan(result.exportPlan);
        setRepairStatus(repairResultMessage(result, "수리 diff를 계산하지 못했습니다."));
        return;
      }
      setPreviewReadiness(result.previewReadiness || null);
      setPreviewPreflight(result.previewPreflight || null);
      setRepairActions(result.repairActions || []);
      setExportPlan(result.exportPlan || null);
      setRepairPreview(result.repairPreview);
      recordUXDecisionEvent({
        eventName: "repair_action_used",
        correlationId: result.correlationId,
        issueCode: result.repairPreview.issueCode,
        repairActionId: result.repairPreview.actionId,
        outcome: "success"
      });
      setRepairStatus("수리 diff를 확인한 뒤 변경 적용을 누르세요.");
    } catch (error) {
      setRepairPreview(null);
      setRepairStatus(`수리 diff 계산 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRepairBusy(false);
    }
  }

  async function applyRepairPreview(): Promise<void> {
    if (!repairPreview?.repairAction || !repairPreview.beforeRevision || !repairPreview.confirmToken) {
      setRepairStatus("먼저 수리 diff를 확인해야 합니다.");
      return;
    }
    const destructive = (repairPreview.destructiveWarnings || []).length > 0 || repairPreview.repairAction.destructive;
    if (destructive && !window.confirm("표시된 diff대로 수리 적용할까요?")) {
      setRepairStatus("수리 적용을 취소했습니다.");
      return;
    }
    setRepairBusy(true);
    setRepairStatus("수리를 적용하고 검증을 다시 계산하는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/project/repair/apply", {
        ...repairRequestBody(repairPreview.repairAction, projectDirectory, repairActionInputs, repairPreview.beforeRevision),
        confirmToken: repairPreview.confirmToken
      });
      if (result.ok === false) {
        setRepairPreview(null);
        if (result.previewReadiness) setPreviewReadiness(result.previewReadiness);
        if (result.previewPreflight) setPreviewPreflight(result.previewPreflight);
        if (result.repairActions) setRepairActions(result.repairActions);
        if (result.exportPlan) setExportPlan(result.exportPlan);
        setRepairStatus(`${repairResultMessage(result, "수리를 적용하지 못했습니다.")} 수리 diff를 다시 확인하세요.`);
        return;
      }
      setRepairPreview(null);
      recordUXDecisionEvent({
        eventName: "repaired",
        correlationId: result.correlationId,
        issueCode: result.repairHistoryEntry?.issueCode || repairPreview.repairAction.issueCode,
        issueCodesBefore: result.repairHistoryEntry?.issueCode ? [result.repairHistoryEntry.issueCode] : [],
        issueCodesAfter: (result.previewPreflight?.blockers || []).map((blocker) => blocker.issueCode || blocker.path || "unknown"),
        repairActionId: result.repairHistoryEntry?.actionId || repairPreview.repairAction.actionId,
        revisionBefore: result.previousRevision || repairPreview.beforeRevision,
        revisionAfter: result.projectRevision,
        outcome: "success"
      });
      applyRepairResultState(result, "수리 적용 완료. 마지막 수리는 되돌릴 수 있습니다.");
    } catch (error) {
      setRepairPreview(null);
      setRepairStatus(`수리 적용 실패: ${error instanceof Error ? error.message : String(error)} 수리 diff를 다시 확인하세요.`);
    } finally {
      setRepairBusy(false);
    }
  }

  async function undoLastRepair(): Promise<void> {
    if (!undoRepairEntry?.id) {
      setRepairStatus("되돌릴 수리 이력이 없습니다.");
      return;
    }
    if (!window.confirm("마지막 수리를 되돌리고 검증을 다시 계산할까요?")) {
      setRepairStatus("수리 되돌리기를 취소했습니다.");
      return;
    }
    setRepairBusy(true);
    setRepairStatus("마지막 수리를 되돌리고 검증을 다시 계산하는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/project/repair/undo", {
        projectDirectory,
        repairHistoryId: undoRepairEntry.id
      });
      if (result.ok === false) {
        setRepairStatus(repairResultMessage(result, "마지막 수리를 되돌리지 못했습니다."));
        return;
      }
      setRepairPreview(null);
      recordUXDecisionEvent({
        eventName: "undo_used",
        correlationId: result.correlationId,
        issueCode: result.repairHistoryEntry?.issueCode || undoRepairEntry.issueCode,
        repairActionId: result.repairHistoryEntry?.actionId || undoRepairEntry.actionId,
        revisionBefore: result.previousRevision,
        revisionAfter: result.projectRevision,
        outcome: "undone"
      });
      applyRepairResultState(result, "마지막 수리를 되돌렸습니다. 검증 결과와 사전 점검을 다시 확인하세요.");
    } catch (error) {
      setRepairStatus(`수리 되돌리기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRepairBusy(false);
    }
  }

  async function validateBeforePreview(): Promise<boolean> {
    const result = await postAuthedJson<ProjectApiResult>("/api/project/validate", { projectDirectory });
    const issues = validationIssues(result);
    const messages = issues.map(issueText);
    const nextReadiness = result.previewReadiness || (result.ok === false ? {
      ...emptyPreviewReadiness,
      state: "failed",
      availableState: "failed",
      failureCause: result.error || messages[0] || "검증 실행 중 오류가 발생했습니다.",
      retryable: result.retryable ?? false,
      nextAction: "다음 작업: 문제 확인 결과를 해결한 뒤 다시 실행하세요."
    } : currentPreviewReadiness);
    setPreviewPreflight(result.previewPreflight || null);
    setRepairActions(result.repairActions || []);
    setRepairPreview(null);
    setExportPlan(result.exportPlan || null);
    if (result.ok === false || hasBlockingPreviewErrors(issues)) {
      const blocked = result.previewPreflight?.canRun === false || hasBlockingPreviewErrors(issues);
      setPreviewState(blocked ? "blocked" : "failed");
      setPreviewRuntime(null);
      setPreviewSceneId("");
      setPreviewIssues(messages);
      setPreviewReadiness(nextReadiness);
      setPreviewStatus(result.previewPreflight?.disabledReason || result.error || "검증 실행 결과 문제가 있어 프리뷰를 생성하지 않았습니다.");
      recordUXDecisionEvent({
        eventName: "validation_failed",
        issueCodesBefore: issues.map((issue) => issue.code || issue.path || "unknown"),
        outcome: "failed",
        preflightResult: result.previewPreflight
      });
      return false;
    }
    setPreviewIssues(messages);
    setPreviewReadiness(nextReadiness);
    if (nextReadiness.canRun !== true || result.previewPreflight?.canRun === false) {
      setPreviewState("blocked");
      setPreviewStatus(result.previewPreflight?.disabledReason || nextReadiness.failureCause || "필수 데이터가 준비되지 않아 프리뷰가 차단되었습니다.");
      return false;
    }
    setPreviewState("ready");
    setPreviewStatus(result.previewPreflight?.nextAction || nextReadiness.nextAction || "프리뷰를 실행할 수 있습니다.");
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
        const blocked = result.code === "PREVIEW_BLOCKED" || result.previewReadiness?.canRun === false || result.previewPreflight?.canRun === false;
        setPreviewState(blocked ? "blocked" : "failed");
        setPreviewRuntime(null);
        setPreviewSceneId("");
        setExportPlan(result.exportPlan || null);
        setPreviewPreflight(result.previewPreflight || null);
        setRepairActions(result.repairActions || []);
        setPreviewReadiness(result.previewReadiness || {
          ...currentPreviewReadiness,
          state: blocked ? "blocked" : "failed",
          availableState: blocked ? "blocked" : "failed",
          failureCause: result.previewPreflight?.disabledReason || result.message || result.error || "프리뷰 생성에 실패했습니다.",
          retryable: result.retryable
        });
        setPreviewStatus(result.previewPreflight?.disabledReason || result.message || result.error || "프리뷰 생성에 실패했습니다.");
        setPreviewIssues(validationMessages(result));
        return;
      }
      const nextRuntime = result.runtime || null;
      setPreviewRuntime(nextRuntime);
      setPreviewSceneId(startSceneId || nextRuntime?.startSceneId || "");
      setPreviewIssues(validationMessages(result));
      const nextReadiness = result.previewReadiness || null;
      const nextPreflight = result.previewPreflight || null;
      const blocked = nextReadiness?.canRun === false || nextPreflight?.canRun === false;
      setPreviewReadiness(nextReadiness);
      setPreviewPreflight(nextPreflight);
      setRepairActions(result.repairActions || []);
      setExportPlan(result.exportPlan || null);
      setPreviewState(blocked ? "blocked" : result.validation?.ok === false || result.runtime?.validation?.ok === false ? "failed" : "ready");
      setPreviewStatus(blocked ? nextPreflight?.disabledReason || nextReadiness?.failureCause || "필수 데이터가 준비되지 않아 프리뷰가 차단되었습니다." : result.validation?.ok === false ? "검증 문제가 있어 프리뷰가 ready 상태가 아닙니다." : "프리뷰 생성 완료");
      recordUXDecisionEvent({
        eventName: "previewed",
        correlationId: result.correlationId,
        outcome: blocked ? "blocked" : result.validation?.ok === false || result.runtime?.validation?.ok === false ? "failed" : "completed",
        preflightResult: nextPreflight || undefined
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewState("failed");
      setPreviewRuntime(null);
      setPreviewSceneId("");
      setPreviewPreflight(null);
      setRepairActions([]);
      setPreviewReadiness({
        ...currentPreviewReadiness,
        state: "failed",
        availableState: "failed",
        failureCause: message,
        retryable: true,
        nextAction: "다음 작업: API 응답과 네트워크 상태를 확인한 뒤 다시 시도하세요."
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
      setRepairActions(result.repairActions || []);
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

  const studioWorkspace = (
    <StudioWorkspace
      navigationLabel={studioNavigationLabel}
      onNavigate={navigate}
      onProjectResult={onProjectResult}
      postJson={(path, body) => postAuthedJson<ProjectApiResult>(path, body)}
      previewPreflight={currentPreviewPreflight}
      project={currentProject}
      projectDirectory={projectDirectory}
      projectId={detailProjectId}
      projectRevision={currentPreviewPreflight?.projectRevision || null}
      repairActions={currentRepairActions}
    />
  );

  if (activeTab === "studio") {
    return studioWorkspace;
  }

  return (
    <section className="page-panel project-detail-panel" aria-labelledby="projectDetailTitle">
      <div className="section-header page-header">
        <div>
          <p className="eyebrow">Project Detail</p>
          <h2 id="projectDetailTitle">{currentProject?.title || (projectId ? projectId : shellProjectTitle)}</h2>
        </div>
        <StatusChip>{activeTabLabel}</StatusChip>
        {showHeaderPrimaryAction ? (
          <div className="page-primary-action">
            <span>{primaryActionLabel}</span>
            <Button icon={primaryActionTab === "heroine" ? <Heart size={16} /> : <ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/${primaryActionTab}`)} variant="primary">
              {primaryActionLabel}
            </Button>
          </div>
        ) : null}
      </div>
      <dl className="summary-list detail-summary">
        <div><dt>현재 상태</dt><dd>{currentProject ? "프로젝트 열림" : "복원 중"}</dd></div>
        <div><dt>상태 요약</dt><dd>{summary.primaryLabel || "프로젝트 제작 상태를 확인하세요."}</dd></div>
        {currentProject ? (
          <>
            <div><dt>개요</dt><dd>{currentProject.premise || "개요 없음"}</dd></div>
            <div><dt>히로인</dt><dd>{currentProject.characters?.length ?? 0}명</dd></div>
            <div><dt>루트/씬</dt><dd>{currentProject.routes?.length ?? 0}개 / {currentProject.scenes?.length ?? 0}개</dd></div>
          </>
        ) : null}
      </dl>
      {!currentProject ? (
        <p className="page-muted">상세 URL의 프로젝트를 복원하는 중입니다.</p>
      ) : null}
      <DiagnosticDrawer summary="프로젝트 정보와 진단">
        <dl className="summary-list detail-summary">
          <div><dt>저장 위치</dt><dd>{projectDirectory || "저장 위치 미연결"}</dd></div>
          <div><dt>프로젝트 ID</dt><dd>{currentProject?.id || detailProjectId || "확인 필요"}</dd></div>
          <div><dt>검증 상태</dt><dd>{stateLabel(summary.validationState)}</dd></div>
          <div><dt>이미지 작업</dt><dd>{stateLabel(summary.generationState)}</dd></div>
        </dl>
      </DiagnosticDrawer>
      <TabList
        ariaLabel="프로젝트 상세 탭"
        items={detailTabs.map((item) => ({
          id: item.id,
          label: item.label,
          to: `/projects/${detailProjectId}/${item.id}`,
          badge: item.id === "background" && currentProject?.assets?.some((asset) => asset.kind === "background") ? "1/1" : undefined,
          status: tabShellStatus(item.id, summary, currentProject, hasBackgroundAsset)
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
              <p className="page-muted">현재 권장 작업은 이 카드와 관련 탭의 기본 버튼에서 실행합니다.</p>
            </section>
            <section className="detail-card">
              <h3>해결해야 할 차단 항목</h3>
              {summary.blockingIssues?.length ? (
                <>
                  <ul className="compact-list">
                    {summary.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                  <div className="button-row">
                    <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/${primaryActionTab}`)} variant="primary">
                      {primaryActionDisplayLabel(primaryActionTab)}
                    </Button>
                  </div>
                </>
              ) : <p className="page-muted">차단된 항목이 없습니다.</p>}
            </section>
            <section className="detail-card">
              <h3>완료된 단계 / 남은 단계</h3>
              <p>완료된 단계 {doneSteps}개 · 남은 단계 {remainingSteps}개</p>
              <ol className="stepper">
                {visibleWorkflowSteps.map((step) => <li className={`step-${step.displayState}`} key={step.id}>{step.displayLabel}</li>)}
              </ol>
            </section>
            <section className="detail-card">
              <h3>상태 요약</h3>
              <TabStatusList
                items={[
                  { id: "validationState", label: "문제 확인", status: stateLabel(summary.validationState), tone: summary.validationState === "valid" ? "success" : "warning" },
                  { id: "generationState", label: "이미지 작업", status: stateLabel(summary.generationState), tone: summary.generationState === "completed" ? "success" : "warning" },
                  { id: "previewState", label: "프리뷰", status: stateLabel(summary.previewState), tone: summary.previewState === "ready" ? "success" : "neutral" },
                  { id: "exportState", label: "내보내기", status: stateLabel(summary.exportState), tone: summary.exportState === "completed" || summary.exportState === "ready" ? "success" : "neutral" }
                ]}
              />
            </section>
          </div>
        ) : null}
        {activeTab === "heroine" ? (
          <div className="detail-tab-grid snapshot-comparison-grid">
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
                    <div><dt>스냅샷 생성 시각</dt><dd>{assignedHeroine.sourceSnapshotCreatedAt || "기록 없음"}</dd></div>
                    <div><dt>저장 상태</dt><dd>{currentProject ? "프로젝트에 저장됨" : "저장 상태 확인 필요"}</dd></div>
                    <div><dt>마지막 수정 시각</dt><dd>{sourceHeroine?.updatedAt || snapshotSavedAt}</dd></div>
                  </dl>
                  <DiagnosticDrawer summary="히로인 스냅샷 진단">
                    <dl className="summary-list">
                      <div><dt>원본 히로인 ID</dt><dd>{assignedHeroine.sourceHeroineId || assignedHeroine.id}</dd></div>
                      <div><dt>프로젝트 캐릭터 ID</dt><dd>{assignedHeroine.id || "기록 없음"}</dd></div>
                    </dl>
                  </DiagnosticDrawer>
                  <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/background`)} variant="primary">
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
        {activeTab === "background" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>대상 프로젝트</h3>
              <StatusChip tone={hasBackgroundAsset ? "success" : "warning"}>배경 {hasBackgroundAsset ? "1/1" : "0/1"}</StatusChip>
              <p className="page-muted">Alpha에서는 프로젝트당 배경 1개만 생성할 수 있습니다.</p>
              <dl className="summary-list">
                <div><dt>제목</dt><dd>{currentProject?.title || shellProjectTitle}</dd></div>
                <div><dt>기존 배경 교체</dt><dd>{backgroundReplaceText}</dd></div>
                <div><dt>생성 연결</dt><dd>이미지 생성 연결</dd></div>
              </dl>
              <p className="page-muted">API key 입력 흐름은 제공하지 않습니다. 연결 인증, 생성 서버, 생성 처리, 응답 형식 오류를 구분해 표시합니다.</p>
              <DiagnosticDrawer summary="배경 대상 진단">
                <dl className="summary-list">
                  <div><dt>프로젝트 ID</dt><dd>{detailProjectId || "확인 필요"}</dd></div>
                  <div><dt>저장될 결과 위치</dt><dd>{backgroundOutputLocation}</dd></div>
                  <div><dt>생성 경로</dt><dd>Codex app-server · ChatGPT managed OAuth · imageGeneration</dd></div>
                </dl>
              </DiagnosticDrawer>
            </section>
            <section className="detail-card">
              <h3>생성할 배경 설명</h3>
              <label className="field-row">
                <span>프롬프트</span>
                <textarea className="event-prompt-input" disabled={backgroundBusy} onChange={(event) => setBackgroundPrompt(event.target.value)} placeholder={suggestedBackgroundPrompt} value={backgroundPrompt} />
              </label>
              <DiagnosticDrawer summary="배경 생성 작업 진단">
                <dl className="summary-list">
                  <div><dt>작업 ID</dt><dd>{backgroundJobId || suggestedBackgroundJobId}</dd></div>
                  <div><dt>결과 에셋 ID</dt><dd>{suggestedBackgroundAssetId}</dd></div>
                  <div><dt>backgroundAssetId</dt><dd>{backgroundLinkedScene?.backgroundAssetId || "생성 후 기본 장면에 연결"}</dd></div>
                </dl>
              </DiagnosticDrawer>
              <div className="button-row">
                {hasBackgroundAsset ? (
                  <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/preview`)} variant="primary">
                    프리뷰로 이동
                  </Button>
                ) : (
                  <Button disabled={backgroundBusy || !currentProject} icon={<ImageIcon size={16} />} onClick={() => void runBackgroundGeneration()} variant="primary">
                    배경 생성
                  </Button>
                )}
                <Button disabled={backgroundBusy || !currentProject} icon={<RefreshCw size={16} />} onClick={() => void runBackgroundGeneration()}>
                  {hasBackgroundAsset ? "배경 교체 생성" : "다시 시도"}
                </Button>
                <Button disabled={assetBusy || backgroundBusy} icon={<RefreshCw size={16} />} onClick={() => void loadGenerationJobs()} variant="ghost">
                  새로고침
                </Button>
              </div>
            </section>
            <AssetStatePanel
              title="저장 위치/에셋 연결 상태"
              tone={backgroundErrors.length ? "warning" : hasBackgroundAsset ? "success" : "neutral"}
            >
              <div className={backgroundErrors.length ? "inline-status warning" : "inline-status success"}>
                {backgroundStatus}
              </div>
              {backgroundErrors.length ? (
                <ul className="compact-list">
                  {backgroundErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              ) : (
                <p className="page-muted">현재 표시할 생성 오류가 없습니다. 실패하면 연결 인증, 생성 서버, 생성 처리, 응답 형식 중 하나로 분류됩니다.</p>
              )}
              {dummyFallbackTargets.length ? (
                <div className="inline-status warning dummy-fallback-warning">
                  <div className="dummy-badge-row">
                    <StatusChip tone="warning">목 이미지</StatusChip>
                    <strong>{dummyFallbackWarning}</strong>
                  </div>
                  <p>{dummyFallbackDetail} 실제 생성 결과가 준비되면 같은 작업 ID로 교체할 수 있습니다.</p>
                  <ul className="dummy-target-list">
                    {dummyFallbackTargets.map((target) => (
                      <li key={target.key}>
                        <span>{dummyFallbackTargetText(target.job || target.asset)}</span>
                        <small>사유 {fallbackReasonText(target.fallbackReason)} · {target.packVersion ? `packVersion ${target.packVersion}` : "packVersion 확인 필요"}</small>
                      </li>
                    ))}
                  </ul>
                  <div className="button-row">
                    <Button icon={<Settings size={16} />} onClick={() => navigate("/settings")} variant="ghost">
                      Codex 연결하러 가기
                    </Button>
                    <Button disabled={assetBusy || dummyReplacementJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runImageJobs(dummyReplacementJobIds, true, true)} variant="primary">
                      실제 이미지로 교체
                    </Button>
                    <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/preview`)} variant="ghost">
                      더미 유지하고 프리뷰로 이동
                    </Button>
                    <Button disabled={!dummyFallbackTargets[0]?.location} icon={<Copy size={16} />} onClick={() => void copyDummyAssetLocation(dummyFallbackTargets[0]?.location)} variant="ghost">
                      목 이미지 파일 위치 복사
                    </Button>
                  </div>
                  {dummyActionStatus ? <small>{dummyActionStatus}</small> : null}
                </div>
              ) : null}
              <dl className="summary-list">
                <div><dt>저장 위치</dt><dd>{currentBackgroundAsset?.uri ? "생성된 배경 경로는 진단에서 확인" : "생성 전"}</dd></div>
                <div><dt>에셋 연결</dt><dd>{backgroundConnectionText(currentBackgroundAsset, activeBackgroundJob)}</dd></div>
                <div><dt>장면 연결</dt><dd>{backgroundSceneConnectionText(backgroundLinkedScene)}</dd></div>
              </dl>
              <DiagnosticDrawer summary="배경 에셋 경로 진단">
                <dl className="summary-list">
                  <div><dt>저장 위치</dt><dd>{currentBackgroundAsset?.uri || backgroundOutputLocation}</dd></div>
                  <div><dt>에셋 ID</dt><dd>{currentBackgroundAsset?.id || activeBackgroundJob?.outputAssetId || suggestedBackgroundAssetId}</dd></div>
                  <div><dt>asset uri</dt><dd>{currentBackgroundAsset?.uri || activeBackgroundJob?.asset?.uri || "생성 후 확인"}</dd></div>
                </dl>
              </DiagnosticDrawer>
              {backgroundPreviewUri ? <img className="asset-preview-image" alt={currentBackgroundAsset?.label || "생성된 배경 미리보기"} src={backgroundPreviewUri} /> : <p className="page-muted">성공 시 생성된 배경 미리보기가 여기에 표시됩니다.</p>}
              {backgroundJobs.length ? (
                <ul className="asset-job-list">
                  {backgroundJobs.map((job) => (
                    <li key={job.id || job.outputAssetId}>
                      {job.asset?.uri ? <img alt={job.asset.label || "생성된 결과 에셋"} src={job.asset.uri} /> : <span className="asset-job-thumb"><ImageIcon size={18} /></span>}
                      <div>
                        <div className="dummy-badge-row">
                          <strong>{imageJobKindLabel(job.kind)}</strong>
                          {isDummyGenerationJob(job) ? <StatusChip tone="warning">목 이미지</StatusChip> : null}
                        </div>
                        <span>{jobStatusLabel(job.status)} · {generationProviderText(job.provider)}</span>
                        <p>{job.prompt || "프롬프트 없음"}</p>
                        <small>{job.asset?.uri ? "결과 에셋 연결됨" : "결과 에셋 대기 중"}</small>
                        {isDummyGenerationJob(job) ? (
                          <>
                            <p>{dummyFallbackDetailText(job)}</p>
                            <small>{dummyFallbackTargetText(job)} · 사유 {fallbackReasonText(job.fallbackReason || job.asset?.provenance?.fallbackReason)} · {dummyPackVersionText(job)}</small>
                            <div className="button-row">
                              <Button disabled={!job.asset?.uri} icon={<Copy size={16} />} onClick={() => void copyDummyAssetLocation(job.asset?.uri)} variant="ghost">
                                목 이미지 파일 위치 복사
                              </Button>
                              <Button disabled={!job.asset?.uri} icon={<ExternalLink size={16} />} onClick={() => openDummyAssetLocation(job.asset?.uri)} variant="ghost">
                                목 이미지 파일 위치 열기
                              </Button>
                            </div>
                            <DiagnosticDrawer summary="목 이미지 진단">
                              <dl className="summary-list">
                                <div><dt>generationJobId</dt><dd className="diagnostic-value">{job.id || "기록 없음"}</dd></div>
                                <div><dt>outputAssetId</dt><dd className="diagnostic-value">{job.outputAssetId || "기록 없음"}</dd></div>
                                <div><dt>fallbackReason</dt><dd className="diagnostic-value">{job.fallbackReason || job.asset?.provenance?.fallbackReason || "기록 없음"}</dd></div>
                                <div><dt>packVersion</dt><dd className="diagnostic-value">{job.packVersion || job.asset?.provenance?.packVersion || "기록 없음"}</dd></div>
                                <div><dt>sourceGeneratedBy</dt><dd className="diagnostic-value">{job.sourceGeneratedBy || job.asset?.provenance?.sourceGeneratedBy || "기록 없음"}</dd></div>
                                <div><dt>file path</dt><dd className="diagnostic-value">{job.asset?.uri || "기록 없음"}</dd></div>
                              </dl>
                              <pre>{JSON.stringify({ label: "raw payload", job, asset: job.asset }, null, 2)}</pre>
                            </DiagnosticDrawer>
                          </>
                        ) : null}
                        {job.failureMessage ? <small>{job.failureMessage}</small> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="page-muted">배경 생성 전에는 작업 목록이 비어 있습니다.</p>
              )}
              <div className="button-row">
                <Button disabled={assetBusy || backgroundBusy || plannedImageJobIds.length === 0} icon={<Play size={16} />} onClick={() => void runImageJobs(plannedImageJobIds)}>
                  이미지 만들기
                </Button>
                <Button disabled={assetBusy || backgroundBusy || failedImageJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runImageJobs(failedImageJobIds, true)}>
                  실패 작업 재시도
                </Button>
                <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/preview`)} variant="ghost">
                  프리뷰로 이동
                </Button>
              </div>
            </AssetStatePanel>
          </div>
        ) : null}
        {activeTab === "preview" ? (
          <div className="detail-tab-grid">
            <ReadinessPanel
              title="프리뷰 생성"
              description="필수 데이터와 검증 상태를 확인한 뒤 플레이 가능한 프리뷰로 전환합니다."
              tone={previewState === "failed" || previewState === "blocked" ? "warning" : "success"}
            >
              <span className="state-chip">{previewStateLabel(previewState)}</span>
              <div className={previewState === "failed" || previewState === "blocked" ? "inline-status warning" : "inline-status success"}>
                {previewStatus}
              </div>
              {dummyFallbackTargets.length ? (
                <div className="inline-status warning dummy-fallback-warning">
                  <div className="dummy-badge-row">
                    <StatusChip tone="warning">{dummyFallbackWarning}</StatusChip>
                    <strong>Alpha 프리뷰는 목 이미지를 포함해 실행할 수 있습니다.</strong>
                  </div>
                  <p>{dummyFallbackDetail} 프리뷰는 더미 이미지를 차단하지 않고 대상 목록을 표시합니다.</p>
                  <ul className="dummy-target-list">
                    {dummyFallbackTargets.map((target) => (
                      <li key={`preview-${target.key}`}>
                        <span>{dummyFallbackTargetText(target.job || target.asset)}</span>
                        <small>사유 {fallbackReasonText(target.fallbackReason)} · {target.packVersion ? `packVersion ${target.packVersion}` : "packVersion 확인 필요"}</small>
                      </li>
                    ))}
                  </ul>
                  <div className="button-row">
                    <Button icon={<Settings size={16} />} onClick={() => navigate("/settings")} variant="ghost">
                      Codex 연결하러 가기
                    </Button>
                    <Button disabled={assetBusy || dummyReplacementJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runImageJobs(dummyReplacementJobIds, true, true)} variant="primary">
                      실제 이미지로 교체
                    </Button>
                    <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/preview`)} variant="ghost">
                      더미 유지하고 프리뷰로 이동
                    </Button>
                    <Button disabled={!dummyFallbackTargets[0]?.location} icon={<Copy size={16} />} onClick={() => void copyDummyAssetLocation(dummyFallbackTargets[0]?.location)} variant="ghost">
                      목 이미지 파일 위치 복사
                    </Button>
                  </div>
                  {dummyActionStatus ? <small>{dummyActionStatus}</small> : null}
                </div>
              ) : null}
              <p className="page-muted">공통 헤더와 탭 바는 유지됩니다. 현재 상태: {previewReadinessStateLabel(currentPreviewReadiness.availableState || currentPreviewReadiness.state)}</p>
              <dl className="summary-list">
                <div><dt>준비 상태</dt><dd>{previewReadinessStateLabel(currentPreviewReadiness.state)}</dd></div>
                <div><dt>사전 점검</dt><dd>{previewPreflightStatusText(currentPreviewPreflight)}</dd></div>
                <div><dt>조건 처리</dt><dd>{previewPreflightCapabilityText(currentPreviewPreflight)}</dd></div>
                <div><dt>actual preview evidence</dt><dd>{currentPreviewPreflight?.canRun === true ? "preflightResult canRun true" : "preflightResult 확인 필요"}</dd></div>
                <div><dt>condition preview not_evaluated</dt><dd>{currentPreviewPreflight?.conditionRuntimeSupport?.strictPreviewStatus || "not_evaluated"}</dd></div>
                <div><dt>fake/mock preview</dt><dd>{dummyFallbackTargets.length ? `${dummyFallbackTargets.length}개 목 이미지 포함 가능` : "0"}</dd></div>
                <div><dt>필수 데이터 상태</dt><dd>{Object.entries(currentPreviewReadiness.requiredData || {}).map(([name, value]) => `${requiredDataNameLabel(name)}: ${requiredDataValueLabel(value)}`).join(" · ") || "확인 전"}</dd></div>
                <div><dt>실패 원인</dt><dd>{currentPreviewReadiness.failureCause || "없음"}</dd></div>
                <div><dt>재시도 가능 여부</dt><dd>{currentPreviewReadiness.retryable ? "가능" : "불필요"}</dd></div>
                <div><dt>다음 작업</dt><dd>{currentPreviewReadiness.nextAction || "프리뷰를 실행하세요."}</dd></div>
              </dl>
              {currentPreviewPreflight?.blockers?.length ? (
                <div>
                  <h4>사전 점검 차단 항목</h4>
                  <ul className="compact-list">
                    {currentPreviewPreflight.blockers.map((blocker, index) => <li key={`${blocker.issueCode || "blocker"}-${blocker.path || index}`}>{previewPreflightIssueText(blocker)}</li>)}
                  </ul>
                </div>
              ) : null}
              {currentPreviewPreflight?.warnings?.length ? (
                <div>
                  <h4>사전 점검 참고 항목</h4>
                  <ul className="compact-list">
                    {currentPreviewPreflight.warnings.map((warning, index) => <li key={`${warning.issueCode || "warning"}-${warning.path || index}`}>{previewPreflightIssueText(warning)}</li>)}
                  </ul>
                </div>
              ) : null}
              <p aria-live="polite" className="page-muted">{repairStatus}</p>
              {currentRepairActions.length ? (
                <div>
                  <h4>수리 후보</h4>
                  <ul className="repair-action-list">
	                    {currentRepairActions.map((action, index) => (
	                      <li aria-current={repairActionKey(action) === selectedRepairActionKey ? "true" : undefined} className={repairActionKey(action) === selectedRepairActionKey ? "selected" : ""} key={`${action.issueCode || "issue"}-${action.actionId || index}-${action.targetPath || "target"}`}>
                        <Button disabled={repairBusy || Boolean(action.disabledReason) || !projectDirectory} icon={<GitCompareArrows size={16} />} onClick={() => void previewRepairAction(action)} variant={action.destructive ? "danger" : "ghost"}>
                          {action.label || action.actionId || "수리 후보"} diff 확인
                        </Button>
                        <span>{action.description || "문제 확인 결과에 맞는 수리 후보입니다."}</span>
                        <small>{repairActionMetaText(action)}</small>
                        {action.disabledReason ? <small>비활성 사유 {action.disabledReason}</small> : null}
                        {action.requiredInputs?.length ? (
                          <div className="repair-action-inputs">
                            {action.requiredInputs.map((input) => (
                              <label key={`${repairActionKey(action)}-${input.name || input.label}`} className="repair-action-input">
                                <span>{repairInputDisplayLabel(input)}</span>
                                {input.inputType === "select" ? (
                                  <select disabled={repairBusy || Boolean(action.disabledReason)} onChange={(event) => updateRepairInput(action, input, event.target.value)} value={repairInputValue(action, input, repairActionInputs)}>
                                    {(input.options || []).map((option) => (
                                      <option key={option.value || option.label} value={option.value || ""}>{option.label || option.value || "선택"}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input disabled={repairBusy || Boolean(action.disabledReason)} onChange={(event) => updateRepairInput(action, input, event.target.value)} placeholder={repairInputDisplayLabel(input)} value={repairInputValue(action, input, repairActionInputs)} />
                                )}
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {repairPreview || undoRepairEntry ? (
                <div className="repair-diff-panel">
                  <h4>수리 diff</h4>
                  {repairPreview ? (
                    <>
                      <p className="page-muted">{repairPreview.expectedAfterSummary || "표시된 변경 사항을 확인한 뒤 적용합니다."}</p>
                      <dl className="summary-list">
                        <div><dt>수리 액션</dt><dd>{repairPreview.repairAction?.label || repairPreview.actionId || "수리 후보"}</dd></div>
                        <div><dt>대상</dt><dd>{repairPreview.targetPath || "대상 확인 필요"}</dd></div>
                        <div><dt>기준 revision</dt><dd>{repairPreview.beforeRevision?.revision || "revision 확인 필요"}</dd></div>
                        <div><dt>확인 방식</dt><dd>{repairPreview.repairAction?.requiresConfirmation || repairPreview.destructiveWarnings?.length ? "diff 확인 후 적용" : "즉시 적용 가능"}</dd></div>
                      </dl>
                      {repairPreview.destructiveWarnings?.length ? (
                        <ul className="compact-list">
                          {repairPreview.destructiveWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      ) : null}
                      <ul className="repair-diff-list">
                        {(repairPreview.diff || []).map((entry, index) => (
                          <li key={`${entry.path || "diff"}-${entry.op || "op"}-${index}`}>
                            <strong>{repairDiffOperationLabel(entry.op)} · {entry.path || "경로 확인 필요"}</strong>
                            <span>{entry.humanLabel || "프로젝트 값을 변경합니다."}</span>
                            <small>이전 {repairDiffValueText(entry.before)} → 이후 {repairDiffValueText(entry.after)}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="page-muted">마지막 수리 적용 이력이 있습니다. 필요하면 되돌릴 수 있습니다.</p>
                  )}
                  <div className="button-row">
                    {repairPreview ? (
                      <Button disabled={repairBusy} icon={<CheckCircle2 size={16} />} onClick={() => void applyRepairPreview()} variant={repairPreview.destructiveWarnings?.length || repairPreview.repairAction?.destructive ? "danger" : "primary"}>
                        변경 적용
                      </Button>
                    ) : null}
                    <Button disabled={repairBusy || !undoRepairEntry?.id} icon={<Undo2 size={16} />} onClick={() => void undoLastRepair()} variant="ghost">
                      마지막 수리 되돌리기
                    </Button>
                  </div>
                  {repairHistoryEntry?.appliedAt ? <small>마지막 적용 시각 {repairHistoryEntry.appliedAt}</small> : null}
                </div>
              ) : null}
              {currentPreviewReadiness.missingItems?.length ? (
                <div>
                  <h4>누락 항목</h4>
                  <ul className="compact-list">
                    {currentPreviewReadiness.missingItems.map((item) => <li key={`${item.id}-${item.tab}`}>{item.label || item.id}</li>)}
                  </ul>
                  <div className="button-row">
                    {previewResolutionActions.map((action) => (
                      <Button key={`${action.tab}-${action.label}`} icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/${action.tab}`)} variant="ghost">
                        {action.label}
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
            </ReadinessPanel>
            <section className="detail-card">
              <h3>실행 화면</h3>
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
                <p className="page-muted">프리뷰를 생성하면 실행 화면이 표시됩니다.</p>
              )}
              <DiagnosticDrawer summary="개발자 상세">
                <pre>{previewRuntime ? JSON.stringify({ label: "runtime JSON", runtime: previewRuntime }, null, 2) : "runtime JSON 없음"}</pre>
              </DiagnosticDrawer>
            </section>
          </div>
        ) : null}
        {activeTab === "export" ? (
          <div className="detail-tab-grid">
            <ReadinessPanel
              title="내보내기 실행"
              description="로컬 데스크톱형 웹 앱 산출물을 만들기 전 차단 항목과 검증 상태를 확인합니다."
              tone={exportState === "failed" || exportState === "blocked" ? "warning" : "success"}
            >
              <StatusChip tone={exportState === "failed" || exportState === "blocked" ? "warning" : exportState === "completed" ? "success" : "neutral"}>{exportStateLabel(exportState)}</StatusChip>
              <div className={exportState === "failed" || exportState === "blocked" ? "inline-status warning" : "inline-status success"}>
                {exportStatus}
              </div>
              <p className="page-muted">내보내기 대상: 로컬 데스크톱형 웹 앱</p>
              {dummyFallbackTargets.length ? (
                <div className="inline-status warning dummy-fallback-warning">
                  <div className="dummy-badge-row">
                    <StatusChip tone="warning">{dummyFallbackWarning}</StatusChip>
                    <strong>Alpha 검증 목적 내보내기는 더미 이미지를 차단하지 않습니다.</strong>
                  </div>
                  <p>{dummyFallbackDetail} 산출물에는 아래 목 이미지 대상이 포함될 수 있습니다.</p>
                  <ul className="dummy-target-list">
                    {dummyFallbackTargets.map((target) => (
                      <li key={`export-${target.key}`}>
                        <span>{dummyFallbackTargetText(target.job || target.asset)}</span>
                        <small>사유 {fallbackReasonText(target.fallbackReason)} · {target.packVersion ? `packVersion ${target.packVersion}` : "packVersion 확인 필요"}</small>
                      </li>
                    ))}
                  </ul>
                  <div className="button-row">
                    <Button icon={<Settings size={16} />} onClick={() => navigate("/settings")} variant="ghost">
                      Codex 연결하러 가기
                    </Button>
                    <Button disabled={assetBusy || dummyReplacementJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runImageJobs(dummyReplacementJobIds, true, true)} variant="primary">
                      실제 이미지로 교체
                    </Button>
                    <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/preview`)} variant="ghost">
                      더미 유지하고 프리뷰로 이동
                    </Button>
                    <Button disabled={!dummyFallbackTargets[0]?.location} icon={<Copy size={16} />} onClick={() => void copyDummyAssetLocation(dummyFallbackTargets[0]?.location)} variant="ghost">
                      목 이미지 파일 위치 복사
                    </Button>
                  </div>
                  <DiagnosticDrawer summary="더미 이미지 내보내기 진단">
                    <dl className="summary-list">
                      <div><dt>더미 이미지</dt><dd>{dummyFallbackWarning}</dd></div>
                      <div><dt>대상</dt><dd>{dummyFallbackTargets.map((target) => dummyFallbackTargetText(target.job || target.asset)).join(" · ")}</dd></div>
                    </dl>
                    <pre>{JSON.stringify({ label: "raw payload", targets: dummyFallbackTargets, exportPlan: currentExportPlan }, null, 2)}</pre>
                  </DiagnosticDrawer>
                  {dummyActionStatus ? <small>{dummyActionStatus}</small> : null}
                </div>
              ) : null}
              <dl className="summary-list">
                <div><dt>검증 요약</dt><dd>{exportValidationSummaryText(currentExportPlan)}</dd></div>
                <div><dt>포함될 프로젝트 데이터</dt><dd>{currentExportPlan.includedData?.join(" · ") || "확인 전"}</dd></div>
                <div><dt>포함될 에셋</dt><dd>{exportAssetSummaryText(currentExportPlan.includedAssets)}</dd></div>
                <div><dt>차단 항목</dt><dd>{exportBlockerSummaryText(currentExportPlan.blockers)}</dd></div>
                <div><dt>실패 원인</dt><dd>{currentExportPlan.failureCause || "없음"}</dd></div>
                <div><dt>재시도 가능 여부</dt><dd>{currentExportPlan.retryable ? "가능" : "불필요"}</dd></div>
                <div><dt>다음 작업</dt><dd>{currentExportPlan.nextAction || "내보내기를 실행하세요."}</dd></div>
              </dl>
              <p className="page-muted">현재 실행 상태: {exportPlanStateLabel(currentExportPlan.state)}</p>
              {incompleteImageJobs.length ? (
                <ul className="compact-list">
                  {incompleteImageJobs.map((job) => <li key={job.id || job.outputAssetId || imageJobKindLabel(job.kind)}>필수 이미지 미완료: {imageJobKindLabel(job.kind)}</li>)}
                </ul>
              ) : <p className="page-muted">필수 배경 화면/CG 작업이 완료됐거나 필요하지 않습니다.</p>}
              <div className="button-row">
                <Button disabled={exportBusy || !exportRunReady} icon={<CheckCircle2 size={16} />} onClick={() => void runExport()} variant={exportRunReady ? "primary" : "secondary"}>
                  내보내기 실행
                </Button>
                <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${detailProjectId}/preview`)} variant="ghost">
                  다음 작업: 프리뷰 확인
                </Button>
              </div>
              <p className="page-muted">검증 실패나 필수 이미지 작업이 미완료이면 내보내기가 차단됩니다.</p>
              <DiagnosticDrawer summary="내보내기 세부 진단">
                <dl className="summary-list">
                  <div><dt>대상</dt><dd>로컬 데스크톱형 웹 앱</dd></div>
                  <div><dt>계획 상태</dt><dd>{exportPlanStateLabel(currentExportPlan.state)}</dd></div>
                  <div><dt>포함 데이터</dt><dd>{currentExportPlan.includedData?.join(" · ") || "확인 전"}</dd></div>
                </dl>
              </DiagnosticDrawer>
            </ReadinessPanel>
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
