import { ArrowRight, CheckCircle2, Heart, Image as ImageIcon, ListChecks, Play, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/ui";
import type { HeroineDraft, HeroineLibraryResult } from "../heroines/heroinePageTypes";
import {
  detailTabs,
  type ProjectApiResult,
  type ProjectData,
  type ProjectEventPlan,
  type ProjectGenerationJob,
  type ProjectIssue,
  type ProjectTabId,
  type ProjectWorkflowSummary
} from "./projectPageTypes";

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

function fallbackWorkflowSummary(project: ProjectData | null): ProjectWorkflowSummary {
  const hasProject = Boolean(project);
  const hasHeroine = Boolean(project?.characters?.length);
  const hasEvent = Boolean((project?.scenes?.length || 0) > 1);
  const blockingIssues = hasProject && !hasHeroine ? ["히로인 1명을 먼저 선택해야 합니다."] : [];
  return {
    primaryAction: !hasHeroine ? "goToHeroine" : !hasEvent ? "goToEvent" : "goToPreview",
    primaryLabel: !hasHeroine ? "히로인 스냅샷으로 이동" : !hasEvent ? "제작/이벤트로 이동" : "프리뷰 확인",
    blockingIssues,
    validationState: "unknown",
    generationState: project?.generationJobs?.some((job) => job.kind === "cg") ? "planned" : "empty",
    previewState: !hasHeroine || !hasEvent ? "blocked" : "stale",
    exportState: blockingIssues.length > 0 ? "blocked" : "ready",
    steps: [
      { id: "project", label: "프로젝트 생성", state: hasProject ? "done" : "current" },
      { id: "heroine", label: "히로인 선택", state: hasHeroine ? "done" : hasProject ? "current" : "blocked" },
      { id: "event", label: "이벤트 작성", state: hasEvent ? "done" : hasHeroine ? "current" : "blocked" },
      { id: "assets", label: "이미지 만들기", state: "waiting" },
      { id: "preview", label: "프리뷰", state: hasHeroine && hasEvent ? "current" : "blocked" },
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
  const [assetStatus, setAssetStatus] = useState("이벤트 승인 후 CG 작업을 확인합니다.");
  const [assetErrors, setAssetErrors] = useState<string[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const summary = workflowSummary || fallbackWorkflowSummary(currentProject);
  const assignedHeroine = currentProject?.characters?.[0] || null;
  const selectedHeroine = heroines.find((heroine) => heroine.id === selectedHeroineId) || heroines[0] || null;
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
  const cgJobs = useMemo(() => {
    const sourceJobs = assetJobs.length > 0 ? assetJobs : currentProject?.generationJobs || [];
    return sourceJobs.filter((job) => job.kind === "cg");
  }, [assetJobs, currentProject?.generationJobs]);
  const currentAssetState = assetState(cgJobs);
  const plannedCgJobIds = cgJobs.filter((job) => job.status === "planned" && job.id).map((job) => String(job.id));
  const failedCgJobIds = cgJobs.filter((job) => job.status === "failed" && job.id).map((job) => String(job.id));
  const eventDisplayState: EventTabState = !assignedHeroine
    ? "blockedNoHeroine"
    : pendingPatch && eventState === "ready"
      ? "patchPending"
      : eventState;
  const canExpandEvent = Boolean(assignedHeroine && currentRoute?.id && currentEventScene?.id && eventPrompt.trim() && !pendingPatch && !eventBusy);
  const canApproveEvent = Boolean(pendingPatch && pendingPatch.validation?.ok !== false && !eventBusy);

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
    if (activeTab !== "event" || !currentProject) {
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
    if (activeTab !== "event") {
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
    setAssetJobs([]);
    setAssetErrors([]);
    setAssetStatus("이벤트 승인 후 CG 작업을 확인합니다.");
  }, [currentProject?.id]);

  useEffect(() => {
    if (activeTab !== "assets" || !currentProject) {
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
      setHeroineStatus("히로인 스냅샷이 프로젝트에 배정되었습니다.");
      navigate(`/projects/${currentProject.id}/event`);
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
      setPendingPatch(null);
      setEventIssues(result.validation?.issues || []);
      setEventPrompt("");
      setEventState("ready");
      setEventStatus("제안 승인 완료. CG 작업이 있으면 에셋/생성 탭으로 이동합니다.");
      navigate(`/projects/${result.project?.id || currentProject?.id || projectId}/${eventResultHasCg(result, pendingPatch.plan) ? "assets" : "preview"}`);
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

  async function loadGenerationJobs(): Promise<void> {
    setAssetBusy(true);
    setAssetStatus("이벤트 CG 작업을 불러오는 중입니다.");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/generation/jobs/list", {
        projectDirectory
      });
      if (result.ok === false) {
        applyAssetFailure(result, "이벤트 CG 작업을 불러오지 못했습니다.");
        return;
      }
      const nextJobs = (result.jobs || []).filter((job) => job.kind === "cg");
      setAssetJobs(nextJobs);
      setAssetErrors([]);
      setAssetStatus(nextJobs.length > 0 ? "이벤트 CG 작업을 확인했습니다." : "이벤트 승인 후 CG 작업이 생성됩니다.");
    } catch (error) {
      setAssetStatus(`이벤트 CG 작업 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAssetBusy(false);
    }
  }

  async function runCgJobs(jobIds: string[], retryFailed = false): Promise<void> {
    if (jobIds.length === 0) {
      setAssetStatus(retryFailed ? "재시도할 실패 작업이 없습니다." : "실행할 예정 CG 작업이 없습니다.");
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
      const nextJobs = (result.project?.generationJobs || result.jobs || []).filter((job) => job.kind === "cg");
      if (nextJobs.length > 0) {
        setAssetJobs(nextJobs);
      }
      setAssetErrors(result.errors || result.issues?.map(issueText) || []);
      if (result.project) {
        onProjectResult(result);
      }
      if (result.ok === false) {
        applyAssetFailure(result, "일부 CG 작업이 실패했습니다.");
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

  return (
    <section className="page-panel project-detail-panel" aria-labelledby="projectDetailTitle">
      <div className="section-header">
        <div>
          <p className="eyebrow">Project Detail</p>
          <h2 id="projectDetailTitle">{currentProject?.title || shellProjectTitle}</h2>
        </div>
        <span className="state-chip">{activeTab}</span>
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
      <nav className="project-tab-list" aria-label="프로젝트 상세 탭">
        {detailTabs.map((item) => (
          <NavLink className={({ isActive }) => isActive ? "project-tab active" : "project-tab"} key={item.id} to={`/projects/${currentProject?.id || projectId}/${item.id}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
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
                {!assignedHeroine ? (
                  <Button icon={<Heart size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/heroine`)} variant="primary">
                    히로인 스냅샷으로 이동
                  </Button>
                ) : (
                  <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/event`)} variant="primary">
                    제작/이벤트로 이동
                  </Button>
                )}
              </div>
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
                    <span>히로인 선택</span>
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
                  <p>히로인 스냅샷이 프로젝트에 배정되었습니다.</p>
                  <dl className="summary-list">
                    <div><dt>이름</dt><dd>{assignedHeroine.displayName}</dd></div>
                    <div><dt>sourceHeroineId</dt><dd>{assignedHeroine.sourceHeroineId || assignedHeroine.id}</dd></div>
                    <div><dt>sourceSnapshotCreatedAt</dt><dd>{assignedHeroine.sourceSnapshotCreatedAt || "기록 없음"}</dd></div>
                  </dl>
                  <Button icon={<ArrowRight size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/event`)} variant="primary">
                    제작/이벤트로 이동
                  </Button>
                </>
              ) : null}
            </section>
            <section className="detail-card">
              <h3>상태</h3>
              <p>{heroineStatus}</p>
              <p className="page-muted">Alpha는 프로젝트당 히로인 1명만 사용합니다. 원본 히로인이 바뀌어도 기존 프로젝트 스냅샷은 자동 변경되지 않습니다.</p>
              <Button icon={<RefreshCw size={16} />} onClick={() => navigate("/heroines")} variant="ghost">
                히로인 관리 확인
              </Button>
            </section>
          </div>
        ) : null}
        {activeTab === "event" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>이벤트 제안</h3>
              <span className="state-chip">{eventStateLabel(eventDisplayState)}</span>
              {eventDisplayState === "blockedNoHeroine" ? (
                <>
                  <p>히로인 1명을 먼저 선택해야 합니다.</p>
                  <Button icon={<Heart size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/heroine`)} variant="primary">
                    히로인 스냅샷으로 이동
                  </Button>
                </>
              ) : (
                <>
                  <label className="field-row">
                    <span>루트</span>
                    <select disabled={eventBusy || Boolean(pendingPatch)} onChange={(event) => setSelectedRouteId(event.target.value)} value={currentRoute?.id || ""}>
                      {projectRoutes.map((route) => <option key={route.id} value={route.id}>{routeLabel(route)}</option>)}
                    </select>
                  </label>
                  <label className="field-row">
                    <span>삽입 기준 씬</span>
                    <select disabled={eventBusy || Boolean(pendingPatch)} onChange={(event) => setSelectedSceneId(event.target.value)} value={currentEventScene?.id || ""}>
                      {projectScenes.map((scene) => <option key={scene.id} value={scene.id}>{sceneLabel(scene)}</option>)}
                    </select>
                  </label>
                  <label className="field-row">
                    <span>자연어 이벤트</span>
                    <textarea className="event-prompt-input" disabled={eventBusy || Boolean(pendingPatch)} onChange={(event) => setEventPrompt(event.target.value)} placeholder="예: 방과 후 도서관에서 책을 고르다 손이 겹치고 서로의 속마음을 짧게 확인한다." value={eventPrompt} />
                  </label>
                  <p className="page-muted">Alpha는 작은 이벤트 삽입만 허용합니다. 씬 3개, 선택지 2개, CG 1개까지 제안합니다.</p>
                  <div className="button-row">
                    <Button disabled={!canExpandEvent} icon={<Sparkles size={16} />} onClick={() => void expandProjectEvent()} variant="primary">
                      이벤트 제안 받기
                    </Button>
                    {pendingPatch ? (
                      <Button disabled={eventBusy} icon={<XCircle size={16} />} onClick={cancelPendingEventPatch} variant="ghost">
                        제안 취소
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </section>
            <section className="detail-card">
              <h3>제안 요약</h3>
              {pendingPatch ? (
                <dl className="summary-list">
                  <div><dt>요약</dt><dd>{pendingPatch.plan.summary || "요약 없음"}</dd></div>
                  <div><dt>씬/선택지/CG</dt><dd>{pendingPatch.plan.decision?.sceneCount || 0} / {pendingPatch.plan.decision?.choiceCount || 0} / {pendingPatch.plan.decision?.cgCount || 0}</dd></div>
                  <div><dt>baseProjectHash</dt><dd>{pendingPatch.request.baseProjectHash || pendingPatch.baseProjectHash || "기록 없음"}</dd></div>
                  <div><dt>patchHistory</dt><dd>{pendingPatch.patchHistoryEntry?.id || "기록 없음"}</dd></div>
                </dl>
              ) : (
                <p className="page-muted">아직 검토할 제안이 없습니다. 자연어 이벤트를 입력해 먼저 제안을 받으세요.</p>
              )}
            </section>
            <section className="detail-card">
              <h3>바뀔 내용</h3>
              {pendingDiff ? (
                <>
                  <p>{pendingDiff.text || "변경 요약 없음"}</p>
                  <ul className="compact-list">
                    {(pendingDiff.operations || []).map((operation) => <li key={operation}>{operation}</li>)}
                  </ul>
                  <div className="button-row">
                    <Button disabled={!canApproveEvent} icon={<CheckCircle2 size={16} />} onClick={() => void approveProjectEvent()} variant="primary">
                      제안 승인
                    </Button>
                  </div>
                </>
              ) : (
                <p className="page-muted">제안을 승인하기 전까지 프로젝트 원본은 변경되지 않습니다.</p>
              )}
            </section>
            <section className="detail-card">
              <h3>문제 확인</h3>
              <div className={eventDisplayState === "patchInvalid" || eventDisplayState === "patchStale" ? "inline-status warning" : "inline-status success"}>
                {eventStatus}
              </div>
              {visibleEventIssues.length ? (
                <ul className="compact-list">
                  {visibleEventIssues.map((issue) => <li key={`${issue.path || "issue"}-${issue.message || ""}`}>{issueText(issue)}</li>)}
                </ul>
              ) : (
                <p className="page-muted">현재 표시할 문제가 없습니다.</p>
              )}
              {eventDisplayState === "patchStale" ? (
                <p className="page-muted">패치 생성 기준 프로젝트와 현재 프로젝트가 다릅니다. 제안을 취소한 뒤 최신 프로젝트 기준으로 다시 제안받으세요.</p>
              ) : null}
              <p className="page-muted">제안 단계는 프로젝트 원본을 바꾸지 않고, 승인할 때만 적용합니다.</p>
              <p className="page-muted">CG 작업이 있으면 에셋/생성 탭으로 이동합니다.</p>
              <Button icon={<ListChecks size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/overview`)} variant="ghost">
                상태 요약 보기
              </Button>
            </section>
          </div>
        ) : null}
        {activeTab === "assets" ? (
          <div className="detail-tab-grid">
            <section className="detail-card">
              <h3>이벤트 CG 작업</h3>
              <span className="state-chip">{assetStateLabel(currentAssetState)}</span>
              <p className="page-muted">이 탭은 이벤트 승인으로 생긴 CG 작업만 표시합니다. 완료된 작업은 다시 호출하지 않습니다.</p>
              <div className="button-row">
                <Button disabled={assetBusy || plannedCgJobIds.length === 0} icon={<ImageIcon size={16} />} onClick={() => void runCgJobs(plannedCgJobIds)} variant="primary">
                  이미지 만들기
                </Button>
                <Button disabled={assetBusy || failedCgJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runCgJobs(failedCgJobIds, true)}>
                  실패 작업 재시도
                </Button>
                <Button disabled={assetBusy} icon={<RefreshCw size={16} />} onClick={() => void loadGenerationJobs()} variant="ghost">
                  새로고침
                </Button>
              </div>
              <p className="page-muted">실패 작업 재시도는 retryFailed=true로만 실행하고, replaceCompleted=false로 완료된 결과를 유지합니다.</p>
            </section>
            <section className="detail-card">
              <h3>결과 에셋</h3>
              <div className={currentAssetState === "failed" || currentAssetState === "partialFailed" ? "inline-status warning" : "inline-status success"}>
                {assetStatus}
              </div>
              {assetErrors.length ? (
                <ul className="compact-list">
                  {assetErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              ) : (
                <p className="page-muted">현재 표시할 생성 오류가 없습니다.</p>
              )}
              <p className="page-muted">Codex ChatGPT OAuth 또는 imageGeneration 권한이 없으면 OAUTH_REQUIRED 상태로 차단됩니다.</p>
              <Button icon={<Play size={16} />} onClick={() => navigate(`/projects/${currentProject?.id || projectId}/preview`)} variant="ghost">
                프리뷰로 이동
              </Button>
            </section>
            <section className="detail-card detail-card-wide">
              <h3>작업 목록</h3>
              {cgJobs.length ? (
                <ul className="asset-job-list">
                  {cgJobs.map((job) => (
                    <li key={job.id || job.outputAssetId}>
                      {job.asset?.uri ? <img alt={job.asset.label || job.outputAssetId || "결과 에셋"} src={job.asset.uri} /> : <span className="asset-job-thumb"><ImageIcon size={18} /></span>}
                      <div>
                        <strong>{job.id || "CG 작업"}</strong>
                        <span>{jobStatusLabel(job.status)} · {job.provider || "provider 확인 필요"}</span>
                        <p>{job.prompt || "프롬프트 없음"}</p>
                        <small>결과 에셋: {job.outputAssetId || job.asset?.id || "대기 중"}</small>
                        {job.failureMessage ? <small>{job.failureMessage}</small> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="page-muted">이벤트를 승인하면 CG 작업이 이곳에 나타납니다.</p>
              )}
            </section>
          </div>
        ) : null}
        {activeTab === "preview" ? "프리뷰 탭입니다. 플레이 검증을 연결합니다." : null}
        {activeTab === "export" ? "내보내기 탭입니다. export와 실행 확인 결과를 연결합니다." : null}
      </div>
    </section>
  );
}
