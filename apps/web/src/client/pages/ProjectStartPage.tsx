import { AlertTriangle, CheckCircle2, Clock3, Database, FolderOpen, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import type { ApiResult } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";

const starterProject = {
  id: "web-starter",
  title: "웹 제작툴 샘플",
  premise: "Codex와 함께 미연시를 제작하는 첫 프로젝트"
};

const detailTabs = [
  { id: "overview", label: "개요" },
  { id: "heroine", label: "히로인 스냅샷" },
  { id: "event", label: "제작/이벤트" },
  { id: "assets", label: "에셋/생성" },
  { id: "preview", label: "프리뷰" },
  { id: "export", label: "내보내기" }
] as const;

type ProjectTabId = typeof detailTabs[number]["id"];

interface ProjectData {
  id?: string;
  title?: string;
  premise?: string;
  characters?: unknown[];
  routes?: unknown[];
  scenes?: unknown[];
}

interface RecentProject {
  projectId: string;
  projectDirectory: string;
  title: string;
  lastOpenedAt: string;
  lastValidatedAt?: string;
  validationState?: "unchecked" | "valid" | "invalid" | "stale";
  missing?: boolean;
}

interface ProjectApiResult extends ApiResult {
  code?: string;
  project?: ProjectData;
  projectDirectory?: string;
  projectId?: string;
  projects?: RecentProject[];
  validation?: {
    ok?: boolean;
  };
  recentProject?: RecentProject;
  expectedProjectId?: string;
  actualProjectId?: string;
}

function normalizeTab(value?: string): ProjectTabId {
  return detailTabs.some((tab) => tab.id === value) ? value as ProjectTabId : "overview";
}

function formatDate(value?: string): string {
  if (!value) {
    return "기록 없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function validationLabel(value?: RecentProject["validationState"]): string {
  if (value === "valid") {
    return "검증 통과";
  }
  if (value === "invalid") {
    return "검증 필요";
  }
  if (value === "stale") {
    return "다시 검증 필요";
  }
  return "검증 대기";
}

function validationStatusFrom(result: ProjectApiResult): string {
  if (result.validation?.ok === true) {
    return "검증 통과";
  }
  if (result.validation?.ok === false) {
    return "검증 필요";
  }
  return "검증 대기";
}

function projectErrorMessage(result: ProjectApiResult, label: string): string {
  if (result.code === "RECENT_PROJECT_INDEX_MISS") {
    return "최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.";
  }
  if (result.code === "PROJECT_DIRECTORY_MISSING") {
    return "프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.";
  }
  if (result.code === "PROJECT_ID_MISMATCH") {
    return "프로젝트 ID가 일치하지 않습니다. 자동으로 덮어쓰지 않았습니다.";
  }
  return result.error || `${label} 요청이 실패했습니다.`;
}

function statusTone(status: string): "neutral" | "waiting" | "success" | "error" {
  if (status.includes("실패") || status.includes("찾을 수 없습니다") || status.includes("일치하지 않습니다")) {
    return "error";
  }
  if (status.includes("완료") || status.includes("복원했습니다") || status.includes("열었습니다")) {
    return "success";
  }
  if (status.includes("실행 중") || status.includes("불러오는 중")) {
    return "waiting";
  }
  return "neutral";
}

export function ProjectStartPage() {
  const { postAuthedJson } = useAuth();
  const { setShellState, shellState, summarizeDirectory } = useWorkspaceShell();
  const navigate = useNavigate();
  const { projectId, tab } = useParams<{ projectId?: string; tab?: string }>();
  const activeTab = normalizeTab(tab);
  const [projectDirectoryInput, setProjectDirectoryInput] = useState(shellState.projectDirectory);
  const [status, setStatus] = useState("열린 프로젝트가 없습니다.");
  const [busy, setBusy] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [reconnectProjectId, setReconnectProjectId] = useState<string | null>(null);
  const [lastRestoredProjectId, setLastRestoredProjectId] = useState<string | null>(null);

  async function refreshRecentProjects(): Promise<RecentProject[]> {
    const result = await postAuthedJson<ProjectApiResult>("/api/projects/recent/list", {});
    if (result.ok === false) {
      throw new Error(result.error || "최근 프로젝트 목록을 불러오지 못했습니다.");
    }
    const projects = Array.isArray(result.projects) ? result.projects : [];
    setRecentProjects(projects);
    return projects;
  }

  function applyProjectResult(result: ProjectApiResult, fallbackDirectory = projectDirectoryInput): string | null {
    const nextProject = result.project || null;
    const nextDirectory = typeof result.projectDirectory === "string" ? result.projectDirectory : fallbackDirectory;
    setCurrentProject(nextProject);
    setProjectDirectoryInput(nextDirectory);
    setShellState({
      projectDirectory: nextDirectory,
      projectTitle: nextProject?.title || shellState.projectTitle,
      validationStatus: validationStatusFrom(result)
    });
    return typeof nextProject?.id === "string" ? nextProject.id : null;
  }

  function handleProjectFailure(result: ProjectApiResult, label: string): void {
    const message = projectErrorMessage(result, label);
    const nextReconnectId = result.projectId || result.expectedProjectId || result.recentProject?.projectId || projectId || null;
    setReconnectProjectId(nextReconnectId);
    setStatus(`${label} 실패: ${message}`);
    if (projectId) {
      navigate("/projects", { replace: true });
    }
  }

  async function openProject(label: string, body: Record<string, unknown>, navigateToDetail = true): Promise<void> {
    setBusy(true);
    setStatus(`${label} 실행 중`);
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/projects/open", body);
      if (result.ok === false) {
        handleProjectFailure(result, label);
        return;
      }
      const openedProjectId = applyProjectResult(result, typeof body.projectDirectory === "string" ? body.projectDirectory : projectDirectoryInput);
      await refreshRecentProjects();
      setReconnectProjectId(null);
      setStatus(`${label} 완료: 프로젝트를 열었습니다.`);
      if (navigateToDetail && openedProjectId) {
        navigate(`/projects/${openedProjectId}/overview`);
      }
    } catch (error) {
      setStatus(`${label} 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createSampleProject(): Promise<void> {
    setBusy(true);
    setStatus("샘플 프로젝트 생성 실행 중");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/project/starter", {
        projectDirectory: projectDirectoryInput || undefined,
        starter: starterProject
      });
      if (result.ok === false) {
        handleProjectFailure(result, "샘플 프로젝트 생성");
        return;
      }
      const nextProjectId = applyProjectResult(result);
      await refreshRecentProjects();
      setStatus("샘플 프로젝트 생성 완료");
      if (nextProjectId) {
        navigate(`/projects/${nextProjectId}/overview`);
      }
    } catch (error) {
      setStatus(`샘플 프로젝트 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeRecentProject(entry: RecentProject): Promise<void> {
    setBusy(true);
    setStatus("최근 목록 제거 실행 중");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/projects/recent/remove", {
        projectId: entry.projectId
      });
      if (result.ok === false) {
        throw new Error(result.error || "최근 목록에서 제거하지 못했습니다.");
      }
      setRecentProjects(Array.isArray(result.projects) ? result.projects : []);
      setStatus("최근 목록에서만 제거 완료: 실제 프로젝트 파일은 삭제하지 않았습니다.");
    } catch (error) {
      setStatus(`최근 목록 제거 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshRecentProjects().catch((error) => {
      setStatus(`최근 프로젝트 목록 실패: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLastRestoredProjectId(null);
      return;
    }
    if (!tab || normalizeTab(tab) !== tab) {
      navigate(`/projects/${projectId}/overview`, { replace: true });
      return;
    }
    if (lastRestoredProjectId === projectId) {
      return;
    }
    setLastRestoredProjectId(projectId);
    void openProject("프로젝트 복원", { projectId }, false);
  }, [projectId, tab, lastRestoredProjectId]);

  const reconnectTarget = reconnectProjectId
    ? recentProjects.find((entry) => entry.projectId === reconnectProjectId) || null
    : null;

  return (
    <section className="app-page" aria-labelledby="projectsTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Projects</p>
          <h1 id="projectsTitle">프로젝트 관리</h1>
          <p>최근 프로젝트를 열고 Alpha 제작 루프의 상세 탭으로 바로 진입합니다.</p>
        </div>
        <div className="page-primary-action">
          <span>첫 제작 기준 프로젝트가 필요합니다.</span>
          <Button disabled={busy} icon={<Sparkles size={18} />} onClick={() => void createSampleProject()} variant="primary">
            샘플 프로젝트 생성
          </Button>
        </div>
      </header>

      <StatusBanner tone={statusTone(status)}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><Database size={18} /></div>
          <h2>저장 위치</h2>
          <label className="field-row">
            <span>프로젝트 디렉터리</span>
            <input aria-label="프로젝트 디렉터리" onChange={(event) => setProjectDirectoryInput(event.target.value)} placeholder="기본 작업공간 사용" value={projectDirectoryInput} />
          </label>
          <div className="panel-actions">
            <Button disabled={busy} icon={<FolderOpen size={16} />} onClick={() => void openProject("프로젝트 열기", {
              projectDirectory: projectDirectoryInput || undefined
            })}>
              프로젝트 열기
            </Button>
            <Button disabled={busy || !reconnectProjectId} icon={<RotateCw size={16} />} onClick={() => void openProject("프로젝트 재연결", {
              projectId: reconnectProjectId || undefined,
              projectDirectory: projectDirectoryInput || undefined
            })}>
              재연결
            </Button>
          </div>
          {reconnectTarget ? (
            <p className="page-muted">{reconnectTarget.title}의 새 위치를 입력해 다시 연결합니다.</p>
          ) : null}
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><CheckCircle2 size={18} /></div>
          <h2>현재 상태</h2>
          <dl className="summary-list">
            <div><dt>프로젝트</dt><dd>{shellState.projectTitle}</dd></div>
            <div><dt>저장 위치</dt><dd>{summarizeDirectory(shellState.projectDirectory)}</dd></div>
            <div><dt>검증</dt><dd>{shellState.validationStatus}</dd></div>
          </dl>
        </article>
      </section>

      <section className="page-panel recent-project-panel" aria-labelledby="recentProjectsTitle">
        <div className="section-header">
          <div>
            <p className="eyebrow">Recent</p>
            <h2 id="recentProjectsTitle">최근 프로젝트</h2>
          </div>
          <Button disabled={busy} icon={<RotateCw size={16} />} onClick={() => void refreshRecentProjects()}>
            새로고침
          </Button>
        </div>
        {recentProjects.length === 0 ? (
          <p className="page-muted">최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.</p>
        ) : (
          <div className="recent-project-list">
            {recentProjects.map((entry) => (
              <article className={`recent-project-row${entry.missing ? " missing" : ""}`} key={entry.projectId}>
                <div className="recent-project-main">
                  <strong>{entry.title}</strong>
                  <span>{entry.projectDirectory}</span>
                  <small><Clock3 size={14} /> 마지막 열림 {formatDate(entry.lastOpenedAt)} · {validationLabel(entry.validationState)}</small>
                </div>
                <div className="recent-project-state">
                  {entry.missing ? (
                    <span className="state-chip state-warning"><AlertTriangle size={14} /> missing</span>
                  ) : (
                    <span className="state-chip">ready</span>
                  )}
                </div>
                <div className="recent-project-actions">
                  <Button disabled={busy || entry.missing} icon={<FolderOpen size={16} />} onClick={() => void openProject("최근 프로젝트 열기", {
                    projectId: entry.projectId
                  })}>
                    열기
                  </Button>
                  <Button disabled={busy} icon={<RotateCw size={16} />} onClick={() => {
                    setReconnectProjectId(entry.projectId);
                    setProjectDirectoryInput(entry.missing ? "" : entry.projectDirectory);
                    setStatus("프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.");
                  }}>
                    재연결
                  </Button>
                  <Button disabled={busy} icon={<Trash2 size={16} />} onClick={() => void removeRecentProject(entry)} variant="ghost">
                    목록에서만 제거
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {projectId || currentProject ? (
        <section className="page-panel project-detail-panel" aria-labelledby="projectDetailTitle">
          <div className="section-header">
            <div>
              <p className="eyebrow">Project Detail</p>
              <h2 id="projectDetailTitle">{currentProject?.title || shellState.projectTitle}</h2>
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
            {activeTab === "overview" ? "프로젝트 개요와 다음 행동을 확인합니다." : null}
            {activeTab === "heroine" ? "히로인 스냅샷 탭입니다. 후속 이슈에서 편집 흐름을 연결합니다." : null}
            {activeTab === "event" ? "제작/이벤트 탭입니다. 후속 이슈에서 자연어 이벤트 패치를 연결합니다." : null}
            {activeTab === "assets" ? "에셋/생성 탭입니다. 후속 이슈에서 CG 작업을 연결합니다." : null}
            {activeTab === "preview" ? "프리뷰 탭입니다. 후속 이슈에서 플레이 검증을 연결합니다." : null}
            {activeTab === "export" ? "내보내기 탭입니다. 후속 이슈에서 export와 smoke 결과를 연결합니다." : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
