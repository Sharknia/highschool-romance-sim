import { Plus, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, DeleteConfirmDialog, StatusBanner } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";
import { ProjectDetailView } from "./projects/ProjectDetailView";
import { RecentProjectList } from "./projects/RecentProjectList";
import {
  deleteProjectFiles as deleteProjectFilesApi,
  listRecentProjects as listRecentProjectsApi,
  openProject as openProjectApi,
  projectFailureText,
  reconnectProject as reconnectProjectApi,
  removeRecentProject as removeRecentProjectApi,
  restoreRecentProject as restoreRecentProjectApi
} from "./projects/projectApi";
import { normalizeTab, type ProjectApiResult, type ProjectData, type ProjectWorkflowSummary, type RecentProject } from "./projects/projectPageTypes";

type ProjectListState = "loading" | "empty" | "ready" | "error" | "deleting";
type ProjectFailureLike = Pick<ProjectApiResult, "code" | "error" | "httpStatus" | "message" | "nextAction" | "userSummary">;

export interface ProjectFailureViewModel {
  title: string;
  message: string;
  code: string;
  nextAction: string;
  retryLabel: string;
  content: string;
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

function statusTone(status: string): "neutral" | "waiting" | "success" | "error" {
  if (status.includes("실패") || status.includes("찾을 수 없습니다") || status.includes("일치하지 않습니다") || status.includes("불러오지 못했습니다")) {
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

function failureCode(result: ProjectFailureLike): string {
  if (typeof result.code === "string" && result.code.trim()) {
    return result.code.trim();
  }
  if (typeof result.httpStatus === "number" && result.httpStatus >= 500) {
    return "SERVER_ERROR";
  }
  return "";
}

function failureMessage(result: ProjectFailureLike, fallback: string): string {
  const message = projectFailureText(result as ProjectApiResult, fallback);
  if (message !== fallback) {
    return message;
  }
  if (typeof result.userSummary === "string" && result.userSummary.trim()) {
    return result.userSummary.trim();
  }
  const code = failureCode(result);
  if (code === "EMPTY_RESPONSE") {
    return "서버 응답이 비어 있습니다.";
  }
  if (code === "NON_JSON_RESPONSE") {
    return "서버 응답을 해석하지 못했습니다.";
  }
  if (code === "SERVER_ERROR") {
    return "서버 오류로 요청을 완료하지 못했습니다.";
  }
  return fallback;
}

function failureNextAction(result: ProjectFailureLike): string {
  if (typeof result.nextAction === "string" && result.nextAction.trim()) {
    return result.nextAction.trim();
  }
  const code = failureCode(result);
  if (code === "PROJECT_INPUT_INVALID") {
    return "입력값을 확인한 뒤 다시 시도하세요.";
  }
  if (code === "NON_JSON_RESPONSE") {
    return "API 서버 상태를 확인한 뒤 다시 시도하세요.";
  }
  if (code === "EMPTY_RESPONSE") {
    return "요청을 다시 시도하세요.";
  }
  if (code === "SERVER_ERROR") {
    return "잠시 후 다시 시도하세요.";
  }
  return "다시 시도";
}

function createFailureViewModel(title: string, result: ProjectFailureLike, fallback: string): ProjectFailureViewModel {
  const message = failureMessage(result, fallback);
  const code = failureCode(result);
  const nextAction = failureNextAction(result);
  const retryLabel = "다시 시도";
  return {
    title,
    message,
    code,
    nextAction,
    retryLabel,
    content: [title, message, code ? `오류 코드 ${code}` : "", nextAction, retryLabel].filter(Boolean).join(" ")
  };
}

export function projectListErrorViewModel(result: ProjectApiResult): ProjectFailureViewModel {
  return createFailureViewModel("프로젝트 목록을 불러오지 못했습니다", result, "프로젝트 목록을 불러오지 못했습니다.");
}

export function projectDeleteErrorViewModel(result: ProjectFailureLike): ProjectFailureViewModel {
  return createFailureViewModel("삭제 실패", result, "프로젝트 파일을 삭제하지 못했습니다.");
}

export function ProjectStartPage() {
  const { postAuthedJson } = useAuth();
  const { setShellState, shellState } = useWorkspaceShell();
  const navigate = useNavigate();
  const { projectId, tab } = useParams<{ projectId?: string; tab?: string }>();
  const activeTab = normalizeTab(tab);
  const [projectDirectoryInput, setProjectDirectoryInput] = useState(shellState.projectDirectory);
  const [status, setStatus] = useState("열린 프로젝트가 없습니다.");
  const [busy, setBusy] = useState(false);
  const [projectListState, setProjectListState] = useState<ProjectListState>("loading");
  const [projectListError, setProjectListError] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recentMeta, setRecentMeta] = useState({ count: 0, missingCount: 0, loadedAt: "", sort: "lastOpenedAtDesc" });
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [workflowSummary, setWorkflowSummary] = useState<ProjectWorkflowSummary | null>(null);
  const [reconnectProjectId, setReconnectProjectId] = useState<string | null>(null);
  const [lastRestoredProjectId, setLastRestoredProjectId] = useState<string | null>(null);
  const [removedProject, setRemovedProject] = useState<RecentProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecentProject | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteErrorSource, setDeleteErrorSource] = useState<"files" | "recent" | null>(null);
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null);

  function applyRecentProjectList(result: ProjectApiResult): RecentProject[] {
    const projects = Array.isArray(result.projects) ? result.projects : [];
    setRecentProjects(projects);
    setRecentMeta((current) => ({
      count: typeof result.count === "number" ? result.count : projects.length,
      missingCount: typeof result.missingCount === "number" ? result.missingCount : projects.filter((entry) => entry.missing).length,
      loadedAt: typeof result.loadedAt === "string" ? result.loadedAt : current.loadedAt,
      sort: typeof result.sort === "string" ? result.sort : "lastOpenedAtDesc"
    }));
    setProjectListState(projects.length > 0 ? "ready" : "empty");
    setProjectListError("");
    return projects;
  }

  async function refreshRecentProjects(): Promise<RecentProject[]> {
    setProjectListState("loading");
    setStatus("프로젝트 목록을 불러오는 중입니다.");
    const result = await listRecentProjectsApi(postAuthedJson);
    if (result.ok === false) {
      const viewModel = projectListErrorViewModel(result);
      setProjectListState("error");
      setProjectListError(viewModel.content);
      setStatus(`${viewModel.title}: ${viewModel.message}`);
      return [];
    }
    const projects = applyRecentProjectList(result);
    setStatus(projects.length > 0 ? "최근 프로젝트 목록을 불러왔습니다." : "아직 최근 프로젝트가 없습니다.");
    return projects;
  }

  async function loadRecentProjects(): Promise<RecentProject[]> {
    try {
      return await refreshRecentProjects();
    } catch (error) {
      const viewModel = projectListErrorViewModel({
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      });
      setProjectListState("error");
      setProjectListError(viewModel.content);
      setStatus(`${viewModel.title}: ${viewModel.message}`);
      return [];
    }
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
    const message = projectFailureText(result, `${label} 요청이 실패했습니다.`);
    const nextReconnectId = result.projectId || result.expectedProjectId || result.recentProject?.projectId || projectId || null;
    setReconnectProjectId(nextReconnectId);
    setStatus(`${label} 실패: ${message}`);
    if (projectId) {
      navigate("/projects", { replace: true });
    }
  }

  async function openProject(
    label: string,
    body: Record<string, unknown>,
    navigateToDetail = true,
    mode: "open" | "reconnect" = "open"
  ): Promise<void> {
    setBusy(true);
    setStatus(`${label} 실행 중`);
    try {
      const result = mode === "reconnect"
        ? await reconnectProjectApi(postAuthedJson, body)
        : await openProjectApi(postAuthedJson, body);
      if (result.ok === false) {
        handleProjectFailure(result, label);
        return;
      }
      const openedProjectId = applyProjectResult(result, typeof body.projectDirectory === "string" ? body.projectDirectory : projectDirectoryInput);
      await loadRecentProjects();
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

  async function removeRecentProject(entry: RecentProject, closeDeleteDialog = false): Promise<void> {
    setBusy(true);
    setProjectListState("deleting");
    if (closeDeleteDialog) {
      setDeleteError("");
      setDeleteErrorSource(null);
    }
    setStatus("최근 목록 제거 실행 중");
    try {
      const result = await removeRecentProjectApi(postAuthedJson, entry);
      if (result.ok === false) {
        throw new Error(projectFailureText(result, "최근 목록에서 제거하지 못했습니다."));
      }
      applyRecentProjectList(result);
      setRemovedProject(result.removedProject || entry);
      if (closeDeleteDialog) {
        setDeleteTarget(null);
        setDeleteError("");
        setDeleteErrorSource(null);
      }
      setStatus("최근 목록에서 제거했습니다. 실제 프로젝트 파일은 삭제하지 않았습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectListState(recentProjects.length > 0 ? "ready" : "empty");
      if (closeDeleteDialog) {
        setDeleteError(message);
        setDeleteErrorSource("recent");
      }
      setStatus(`최근 목록 제거 실패: ${message}`);
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
      const result = await restoreRecentProjectApi(postAuthedJson, removedProject);
      if (result.ok === false) {
        throw new Error(projectFailureText(result, "최근 목록을 되돌리지 못했습니다."));
      }
      applyRecentProjectList(result);
      setRemovedProject(null);
      setStatus("최근 목록 되돌리기 완료");
    } catch (error) {
      setStatus(`최근 목록 되돌리기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function prepareProjectDelete(entry: RecentProject, trigger: HTMLElement): void {
    deleteReturnFocusRef.current = trigger;
    setDeleteTarget(entry);
    setDeleteError("");
    setDeleteErrorSource(null);
    setStatus(`${entry.title} 프로젝트 삭제 방식을 선택합니다.`);
  }

  function closeDeleteConfirmation(): void {
    if (busy) {
      return;
    }
    setDeleteTarget(null);
    setDeleteError("");
    setDeleteErrorSource(null);
    window.setTimeout(() => deleteReturnFocusRef.current?.focus(), 0);
  }

  function isCurrentProjectEntry(entry: RecentProject): boolean {
    return projectId === entry.projectId
      || currentProject?.id === entry.projectId
      || shellState.projectDirectory === entry.projectDirectory;
  }

  function clearCurrentProjectIfNeeded(entry: RecentProject): void {
    if (!isCurrentProjectEntry(entry)) {
      return;
    }
    setCurrentProject(null);
    setWorkflowSummary(null);
    setProjectDirectoryInput("");
    setShellState({
      projectDirectory: "",
      projectTitle: "프로젝트 없음",
      validationStatus: "검증 미실행"
    });
    if (projectId === entry.projectId) {
      navigate("/projects", { replace: true });
    }
  }

  async function deleteProjectFiles(entry: RecentProject, confirmationTitle: string): Promise<void> {
    setBusy(true);
    setProjectListState("deleting");
    setDeleteError("");
    setDeleteErrorSource(null);
    setStatus("프로젝트 파일 삭제 실행 중");
    try {
      const result = await deleteProjectFilesApi(postAuthedJson, {
        projectDirectory: entry.projectDirectory,
        projectId: entry.projectId,
        confirmTitle: confirmationTitle.trim()
      });
      if (result.ok === false) {
        const viewModel = projectDeleteErrorViewModel(result);
        setProjectListState(recentProjects.length > 0 ? "ready" : "empty");
        setDeleteError(viewModel.content);
        setDeleteErrorSource("files");
        setStatus(`프로젝트 파일 삭제 실패: ${viewModel.message}`);
        return;
      }
      applyRecentProjectList(result);
      clearCurrentProjectIfNeeded(entry);
      setDeleteTarget(null);
      setRemovedProject(null);
      const recentIndexRemoval = result.recentIndexRemoval;
      const recentRemovalFailed = recentIndexRemoval?.ok === false;
      if (recentRemovalFailed) {
        const removalMessage = recentIndexRemoval.error || "최근 목록 정리에 실패했습니다.";
        setDeleteError(`최근 목록 정리에 실패했습니다. ${removalMessage}`);
        setDeleteErrorSource("recent");
        const partialSuccessStatus = "프로젝트 파일은 삭제했지만 최근 목록 정리에 실패했습니다. 목록 새로고침 또는 목록에서만 제거를 다시 시도하세요.";
        setStatus(partialSuccessStatus);
        void loadRecentProjects().finally(() => setStatus(partialSuccessStatus));
      } else {
        setDeleteError("");
        setDeleteErrorSource(null);
        setStatus("프로젝트 파일까지 삭제했습니다. 최근 목록도 새로고침했습니다.");
        void loadRecentProjects();
      }
    } catch (error) {
      const viewModel = projectDeleteErrorViewModel({
        message: error instanceof Error ? error.message : String(error)
      });
      setProjectListState(recentProjects.length > 0 ? "ready" : "empty");
      setDeleteError(viewModel.content);
      setDeleteErrorSource("files");
      setStatus(`프로젝트 파일 삭제 실패: ${viewModel.message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadRecentProjects();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLastRestoredProjectId(null);
      return;
    }
    if (tab && normalizeTab(tab) !== tab) {
      navigate(`/projects/${projectId}/${normalizeTab(tab)}`, { replace: true });
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
  const detailView = projectId || currentProject ? (
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
  ) : null;
  const projectStatusBanner = (
    <StatusBanner tone={statusTone(status)}>
      <span className="page-status">{status}</span>
      {deleteError && deleteErrorSource === "recent" ? (
        <span className="page-status">{deleteError}</span>
      ) : null}
      {removedProject ? (
        <Button disabled={busy} onClick={() => void restoreRecentProject()} variant="ghost">
          되돌리기
        </Button>
      ) : null}
    </StatusBanner>
  );

  return (
    <section className="app-page" aria-labelledby="projectsTitle">
      {!projectId ? (
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
      ) : null}

      {projectId ? detailView : null}
      {projectStatusBanner}

      {!projectId ? (
        <RecentProjectList
          busy={busy}
          errorText={projectListError}
          listState={projectListState}
          loadedAt={recentMeta.loadedAt}
          missingCount={recentMeta.missingCount}
          onOpen={(entry) => void openProject("최근 프로젝트 상세보기", { projectId: entry.projectId })}
          onPrepareDelete={(entry, trigger) => prepareProjectDelete(entry, trigger)}
          onPrepareReconnect={(entry) => {
            setReconnectProjectId(entry.projectId);
            setProjectDirectoryInput(entry.missing ? "" : entry.projectDirectory);
            setStatus("프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.");
          }}
          onRefresh={() => void loadRecentProjects()}
          recentProjects={recentProjects}
          totalCount={recentMeta.count}
        />
      ) : null}

      {!projectId && reconnectTarget ? (
        <section className="page-panel-grid" aria-label="프로젝트 재연결">
          <article className="page-panel">
            <h2>프로젝트 재연결</h2>
            <label className="field-row">
              <span>프로젝트 디렉터리</span>
              <input aria-label="프로젝트 디렉터리" onChange={(event) => setProjectDirectoryInput(event.target.value)} placeholder="기본 작업공간 사용" value={projectDirectoryInput} />
            </label>
            <div className="panel-actions">
              <Button disabled={busy || !reconnectProjectId} icon={<RotateCw size={16} />} onClick={() => void openProject("프로젝트 재연결", {
                projectId: reconnectProjectId || undefined,
                projectDirectory: projectDirectoryInput || undefined
              }, true, "reconnect")}>
                재연결
              </Button>
            </div>
            <p className="page-muted">{reconnectTarget.title}의 새 위치를 입력해 다시 연결합니다.</p>
          </article>
        </section>
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          busy={busy}
          confirmationHint="프로젝트 제목을 정확히 입력해야 삭제 방식을 실행할 수 있습니다."
          confirmationLabel="프로젝트 제목"
          error={deleteError}
          expectedConfirmation={deleteTarget.title}
          impactItems={[
            { label: "저장 위치", value: deleteTarget.projectDirectory },
            { label: "목록에서만 제거", value: "최근 목록에서만 사라지며 프로젝트 파일은 유지됩니다." },
            { label: "프로젝트 파일까지 삭제", value: "로컬 프로젝트 폴더를 삭제하며 되돌릴 수 없습니다." }
          ]}
          intro="프로젝트 삭제 방식을 선택합니다."
          onClose={closeDeleteConfirmation}
          primaryAction={{
            label: "프로젝트 파일까지 삭제",
            onSelect: (confirmationValue) => void deleteProjectFiles(deleteTarget, confirmationValue),
            variant: "primary"
          }}
          retryAction={deleteError && deleteErrorSource === "files" ? {
            label: "다시 시도",
            onSelect: (confirmationValue) => void deleteProjectFiles(deleteTarget, confirmationValue),
            variant: "ghost"
          } : undefined}
          secondaryActions={[{
            label: "목록에서만 제거",
            onSelect: () => void removeRecentProject(deleteTarget, true),
            variant: "ghost"
          }]}
          title="삭제할 프로젝트"
        />
      ) : null}
    </section>
  );
}
