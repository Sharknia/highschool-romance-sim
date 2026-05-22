import { CheckCircle2, Database, FolderOpen, Plus, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";
import { ProjectDetailView } from "./projects/ProjectDetailView";
import { RecentProjectList } from "./projects/RecentProjectList";
import { normalizeTab, type ProjectApiResult, type ProjectData, type ProjectWorkflowSummary, type RecentProject } from "./projects/projectPageTypes";

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

function projectResultStatus(result: ProjectApiResult): string {
  if (result.action === "approveEvent") {
    return "이벤트 제안 승인 완료";
  }
  if (result.action === "assignHeroineSnapshot") {
    return "히로인 스냅샷 배정 완료";
  }
  return "프로젝트 업데이트 완료";
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
  const [recentMeta, setRecentMeta] = useState({ count: 0, missingCount: 0, loadedAt: "", sort: "lastOpenedAtDesc" });
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [workflowSummary, setWorkflowSummary] = useState<ProjectWorkflowSummary | null>(null);
  const [reconnectProjectId, setReconnectProjectId] = useState<string | null>(null);
  const [lastRestoredProjectId, setLastRestoredProjectId] = useState<string | null>(null);
  const [removedProject, setRemovedProject] = useState<RecentProject | null>(null);

  async function refreshRecentProjects(): Promise<RecentProject[]> {
    const result = await postAuthedJson<ProjectApiResult>("/api/projects/recent/list", {});
    if (result.ok === false) {
      throw new Error(result.error || "최근 프로젝트 목록을 불러오지 못했습니다.");
    }
    const projects = Array.isArray(result.projects) ? result.projects : [];
    setRecentProjects(projects);
    setRecentMeta({
      count: typeof result.count === "number" ? result.count : projects.length,
      missingCount: typeof result.missingCount === "number" ? result.missingCount : projects.filter((entry) => entry.missing).length,
      loadedAt: typeof result.loadedAt === "string" ? result.loadedAt : "",
      sort: typeof result.sort === "string" ? result.sort : "lastOpenedAtDesc"
    });
    return projects;
  }

  function applyProjectResult(result: ProjectApiResult, fallbackDirectory = projectDirectoryInput): string | null {
    const nextProject = result.project || null;
    const nextDirectory = typeof result.projectDirectory === "string" ? result.projectDirectory : fallbackDirectory;
    setCurrentProject(nextProject);
    setWorkflowSummary(result.workflowSummary || null);
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
      const endpoint = label.includes("재연결") ? "/api/projects/reconnect" : "/api/projects/open";
      const result = await postAuthedJson<ProjectApiResult>(endpoint, body);
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
      setRemovedProject(result.removedProject || entry);
      setStatus("최근 목록에서 제거했습니다. 실제 프로젝트 파일은 삭제하지 않았습니다.");
    } catch (error) {
      setStatus(`최근 목록 제거 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function restoreRecentProject(): Promise<void> {
    if (!removedProject) {
      return;
    }
    setBusy(true);
    setStatus("최근 목록 되돌리기 실행 중");
    try {
      const result = await postAuthedJson<ProjectApiResult>("/api/projects/recent/restore", {
        recentProject: removedProject
      });
      if (result.ok === false) {
        throw new Error(result.error || "최근 목록을 되돌리지 못했습니다.");
      }
      setRecentProjects(Array.isArray(result.projects) ? result.projects : []);
      setRemovedProject(null);
      setStatus("최근 목록 되돌리기 완료");
    } catch (error) {
      setStatus(`최근 목록 되돌리기 실패: ${error instanceof Error ? error.message : String(error)}`);
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
          <span>새 제작 프로젝트가 필요하면 생성 흐름으로 이동합니다.</span>
          <Button disabled={busy} icon={<Plus size={18} />} onClick={() => navigate("/projects/new")} variant="primary">
            새 프로젝트 만들기
          </Button>
        </div>
      </header>

      <StatusBanner tone={statusTone(status)}>
        <span className="page-status">{status}</span>
        {removedProject ? (
          <Button disabled={busy} onClick={() => void restoreRecentProject()} variant="ghost">
            되돌리기
          </Button>
        ) : null}
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

      <RecentProjectList
        busy={busy}
        loadedAt={recentMeta.loadedAt}
        missingCount={recentMeta.missingCount}
        onOpen={(entry) => void openProject("최근 프로젝트 열기", { projectId: entry.projectId })}
        onPrepareReconnect={(entry) => {
          setReconnectProjectId(entry.projectId);
          setProjectDirectoryInput(entry.missing ? "" : entry.projectDirectory);
          setStatus("프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.");
        }}
        onRefresh={() => void refreshRecentProjects()}
        onRemove={(entry) => void removeRecentProject(entry)}
        recentProjects={recentProjects}
        totalCount={recentMeta.count}
      />

      {projectId || currentProject ? (
        <ProjectDetailView
          activeTab={activeTab}
          currentProject={currentProject}
          onProjectResult={(result) => {
            applyProjectResult(result);
            setStatus(projectResultStatus(result));
          }}
          projectId={projectId}
          projectDirectory={shellState.projectDirectory}
          shellProjectTitle={shellState.projectTitle}
          workflowSummary={workflowSummary}
        />
      ) : null}
    </section>
  );
}
