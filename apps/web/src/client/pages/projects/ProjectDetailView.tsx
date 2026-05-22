import { ArrowRight, CheckCircle2, Heart, ListChecks, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/ui";
import type { HeroineDraft, HeroineLibraryResult } from "../heroines/heroinePageTypes";
import { detailTabs, type ProjectApiResult, type ProjectData, type ProjectTabId, type ProjectWorkflowSummary } from "./projectPageTypes";

interface ProjectDetailViewProps {
  activeTab: ProjectTabId;
  currentProject: ProjectData | null;
  onProjectResult: (result: ProjectApiResult) => void;
  projectDirectory: string;
  projectId?: string;
  shellProjectTitle: string;
  workflowSummary: ProjectWorkflowSummary | null;
}

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
  const summary = workflowSummary || fallbackWorkflowSummary(currentProject);
  const assignedHeroine = currentProject?.characters?.[0] || null;
  const selectedHeroine = heroines.find((heroine) => heroine.id === selectedHeroineId) || heroines[0] || null;
  const doneSteps = summary.steps?.filter((step) => step.state === "done").length || 0;
  const remainingSteps = (summary.steps?.length || 0) - doneSteps;

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
        {activeTab === "event" ? "제작/이벤트 탭입니다. 자연어 이벤트 패치를 연결합니다." : null}
        {activeTab === "assets" ? "에셋/생성 탭입니다. CG 작업을 연결합니다." : null}
        {activeTab === "preview" ? "프리뷰 탭입니다. 플레이 검증을 연결합니다." : null}
        {activeTab === "export" ? "내보내기 탭입니다. export와 실행 확인 결과를 연결합니다." : null}
      </div>
    </section>
  );
}
