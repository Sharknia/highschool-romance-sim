import { Plus, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, DeleteConfirmDialog, StatusBanner, StatusRegion } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";
import { ProjectDetailView } from "./projects/ProjectDetailView";
import { ProjectList } from "./projects/RecentProjectList";
import {
  deleteProjectFiles as deleteProjectFilesApi,
  listProjects as listProjectsApi,
  openProject as openProjectApi,
  projectFailureText,
  reconnectProject as reconnectProjectApi,
  removeProject as removeProjectApi,
  restoreProject as restoreProjectApi
} from "./projects/projectApi";
import {
  normalizeTab,
  type ProjectApiResult,
  type ProjectData,
  type ProjectExportPlan,
  type ProjectPreviewReadiness,
  type ProjectWorkflowSummary,
  type RecentProject
} from "./projects/projectPageTypes";

type ProjectListState = "loading" | "empty" | "ready" | "error" | "deleting";
type DeleteDialogMode = "list" | "files";
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
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [projectListMeta, setProjectListMeta] = useState({ count: 0, missingCount: 0, loadedAt: "", sort: "lastOpenedAtDesc" });
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [workflowSummary, setWorkflowSummary] = useState<ProjectWorkflowSummary | null>(null);
  const [previewReadiness, setPreviewReadiness] = useState<ProjectPreviewReadiness | null>(null);
  const [exportPlan, setExportPlan] = useState<ProjectExportPlan | null>(null);
  const [reconnectProjectId, setReconnectProjectId] = useState<string | null>(null);
  const [lastRestoredProjectId, setLastRestoredProjectId] = useState<string | null>(null);
  const [removedProject, setRemovedProject] = useState<RecentProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecentProject | null>(null);
  const [deleteDialogMode, setDeleteDialogMode] = useState<DeleteDialogMode>("list");
  const [deleteError, setDeleteError] = useState("");
  const [deleteErrorSource, setDeleteErrorSource] = useState<"files" | "list" | null>(null);
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null);

  function applyProjectList(result: ProjectApiResult): RecentProject[] {
    const nextProjects = Array.isArray(result.projects) ? result.projects : [];
    setProjects(nextProjects);
    setProjectListMeta((current) => ({
      count: typeof result.count === "number" ? result.count : nextProjects.length,
      missingCount: typeof result.missingCount === "number" ? result.missingCount : nextProjects.filter((entry) => entry.missing).length,
      loadedAt: typeof result.loadedAt === "string" ? result.loadedAt : current.loadedAt,
      sort: typeof result.sort === "string" ? result.sort : "lastOpenedAtDesc"
    }));
    setProjectListState(nextProjects.length > 0 ? "ready" : "empty");
    setProjectListError("");
    return nextProjects;
  }

  async function refreshProjects(): Promise<RecentProject[]> {
    setProjectListState("loading");
    setStatus("프로젝트 목록을 불러오는 중입니다.");
    const result = await listProjectsApi(postAuthedJson);
    if (result.ok === false) {
      const viewModel = projectListErrorViewModel(result);
      setProjectListState("error");
      setProjectListError(viewModel.content);
      setStatus(`${viewModel.title}: ${viewModel.message}`);
      return [];
    }
    const nextProjects = applyProjectList(result);
    setStatus(nextProjects.length > 0 ? "프로젝트 목록을 불러왔습니다." : "아직 프로젝트가 없습니다.");
    return nextProjects;
  }

  async function loadProjects(): Promise<RecentProject[]> {
    try {
      return await refreshProjects();
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
    setPreviewReadiness(result.previewReadiness || null);
    setExportPlan(result.exportPlan || null);
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
    setPreviewReadiness(result.previewReadiness || null);
    setExportPlan(result.exportPlan || null);
    if (projectId) {
      setCurrentProject(null);
      setWorkflowSummary(null);
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
      await loadProjects();
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

  async function removeProjectFromList(entry: RecentProject, closeDeleteDialog = false): Promise<void> {
    setBusy(true);
    setProjectListState("deleting");
    if (closeDeleteDialog) {
      setDeleteError("");
      setDeleteErrorSource(null);
    }
    setStatus("프로젝트 목록 제거 실행 중");
    try {
      const result = await removeProjectApi(postAuthedJson, entry);
      if (result.ok === false) {
        throw new Error(projectFailureText(result, "프로젝트 목록에서 제거하지 못했습니다."));
      }
      applyProjectList(result);
      setRemovedProject(result.removedProject || entry);
      if (closeDeleteDialog) {
        setDeleteTarget(null);
        setDeleteDialogMode("list");
        setDeleteError("");
        setDeleteErrorSource(null);
      }
      setStatus("프로젝트 목록에서 제거했습니다. 실제 프로젝트 파일은 삭제하지 않았습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectListState(projects.length > 0 ? "ready" : "empty");
      if (closeDeleteDialog) {
        setDeleteError(message);
        setDeleteErrorSource("list");
      }
      setStatus(`프로젝트 목록 제거 실패: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function restoreProjectListEntry(): Promise<void> {
    if (!removedProject) {
      return;
    }
    setBusy(true);
    setStatus("프로젝트 목록 되돌리기 실행 중");
    try {
      const result = await restoreProjectApi(postAuthedJson, removedProject);
      if (result.ok === false) {
        throw new Error(projectFailureText(result, "프로젝트 목록을 되돌리지 못했습니다."));
      }
      applyProjectList(result);
      setRemovedProject(null);
      setStatus("프로젝트 목록 되돌리기 완료");
    } catch (error) {
      setStatus(`프로젝트 목록 되돌리기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function prepareProjectDelete(entry: RecentProject, trigger: HTMLElement): void {
    deleteReturnFocusRef.current = trigger;
    setDeleteTarget(entry);
    setDeleteDialogMode("list");
    setDeleteError("");
    setDeleteErrorSource(null);
    setStatus(`${entry.title} 프로젝트 삭제 방식을 선택합니다.`);
  }

  function closeDeleteConfirmation(): void {
    if (busy) {
      return;
    }
    setDeleteTarget(null);
    setDeleteDialogMode("list");
    setDeleteError("");
    setDeleteErrorSource(null);
    window.setTimeout(() => deleteReturnFocusRef.current?.focus(), 0);
  }

  function showFileDeleteConfirmation(entry: RecentProject): void {
    setDeleteDialogMode("files");
    setDeleteError("");
    setDeleteErrorSource(null);
    setStatus(`${entry.title} 프로젝트 파일 삭제 확인이 필요합니다.`);
  }

  function showProjectListRemoveConfirmation(entry: RecentProject): void {
    setDeleteDialogMode("list");
    setDeleteError("");
    setDeleteErrorSource(null);
    setStatus(`${entry.title} 프로젝트를 목록에서만 제거할 수 있습니다.`);
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
        setProjectListState(projects.length > 0 ? "ready" : "empty");
        setDeleteError(viewModel.content);
        setDeleteErrorSource("files");
        setStatus(`프로젝트 파일 삭제 실패: ${viewModel.message}`);
        return;
      }
      applyProjectList(result);
      clearCurrentProjectIfNeeded(entry);
      setDeleteTarget(null);
      setDeleteDialogMode("list");
      setRemovedProject(null);
      const recentIndexRemoval = result.recentIndexRemoval;
      const recentRemovalFailed = recentIndexRemoval?.ok === false;
      if (recentRemovalFailed) {
        const removalMessage = recentIndexRemoval.error || "프로젝트 목록 정리에 실패했습니다.";
        setDeleteError(`프로젝트 목록 정리에 실패했습니다. ${removalMessage}`);
        setDeleteErrorSource("list");
        const partialSuccessStatus = "프로젝트 파일은 삭제했지만 프로젝트 목록 정리에 실패했습니다. 목록 새로고침 또는 목록에서만 제거를 다시 시도하세요.";
        setStatus(partialSuccessStatus);
        void loadProjects().finally(() => setStatus(partialSuccessStatus));
      } else {
        setDeleteError("");
        setDeleteErrorSource(null);
        setStatus("프로젝트 파일까지 삭제했습니다. 프로젝트 목록도 새로고침했습니다.");
        void loadProjects();
      }
    } catch (error) {
      const viewModel = projectDeleteErrorViewModel({
        message: error instanceof Error ? error.message : String(error)
      });
      setProjectListState(projects.length > 0 ? "ready" : "empty");
      setDeleteError(viewModel.content);
      setDeleteErrorSource("files");
      setStatus(`프로젝트 파일 삭제 실패: ${viewModel.message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLastRestoredProjectId(null);
      return;
    }
    if (currentProject?.id && currentProject.id !== projectId) {
      setCurrentProject(null);
      setWorkflowSummary(null);
      setPreviewReadiness(null);
      setExportPlan(null);
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
  }, [projectId, tab, lastRestoredProjectId, currentProject?.id]);

  const reconnectTarget = reconnectProjectId
    ? projects.find((entry) => entry.projectId === reconnectProjectId) || {
      projectId: reconnectProjectId,
      projectDirectory: projectDirectoryInput,
      title: reconnectProjectId,
      lastOpenedAt: "",
      missing: true
    }
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
      projectExportPlan={exportPlan}
      projectPreviewReadiness={previewReadiness}
      shellProjectTitle={shellState.projectTitle}
      workflowSummary={workflowSummary}
    />
  ) : null;
  const projectStatusBanner = (
    <StatusRegion>
      <StatusBanner tone={statusTone(status)}>
        <span className="page-status">{status}</span>
        {deleteError && deleteErrorSource === "list" ? (
          <span className="page-status">{deleteError}</span>
        ) : null}
        {removedProject ? (
          <Button disabled={busy} onClick={() => void restoreProjectListEntry()} variant="ghost">
            되돌리기
          </Button>
        ) : null}
      </StatusBanner>
    </StatusRegion>
  );

  return (
    <section className="app-page" aria-labelledby="projectsTitle">
      {!projectId ? (
        <header className="page-hero">
          <div>
            <p className="eyebrow">Projects</p>
            <h1 id="projectsTitle">프로젝트 관리</h1>
            <p>프로젝트 목록에서 제작 루프의 상세 탭으로 바로 진입합니다.</p>
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
        <ProjectList
          busy={busy}
          errorText={projectListError}
          listState={projectListState}
          loadedAt={projectListMeta.loadedAt}
          missingCount={projectListMeta.missingCount}
          onOpen={(entry) => void openProject("프로젝트 상세보기", { projectId: entry.projectId })}
          onPrepareDelete={(entry, trigger) => prepareProjectDelete(entry, trigger)}
          onPrepareReconnect={(entry) => {
            setReconnectProjectId(entry.projectId);
            setProjectDirectoryInput(entry.missing ? "" : entry.projectDirectory);
            setStatus("프로젝트 폴더를 찾을 수 없습니다. 새 위치를 입력해 다시 연결해 주세요.");
          }}
          onRefresh={() => void loadProjects()}
          projects={projects}
          totalCount={projectListMeta.count}
        />
      ) : null}

      {reconnectTarget ? (
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

      {deleteTarget && deleteDialogMode === "list" ? (
        <DeleteConfirmDialog
          busy={busy}
          irreversible={false}
          confirmationHint=""
          confirmationLabel=""
          confirmationRequired={false}
          error={deleteError}
          expectedConfirmation=""
          impactItems={[
            { label: "저장 위치", value: deleteTarget.projectDirectory },
            { label: "파일 유지", value: "프로젝트 목록에서만 사라지며 프로젝트 파일은 유지됩니다." },
            { label: "되돌리기", value: "제거 직후 되돌리기로 목록에 다시 표시할 수 있습니다." }
          ]}
          intro="프로젝트 목록에서만 제거합니다."
          onClose={closeDeleteConfirmation}
          primaryAction={{
            label: "목록에서만 제거",
            onSelect: () => void removeProjectFromList(deleteTarget, true),
            variant: "primary"
          }}
          retryAction={deleteError && deleteErrorSource === "list" ? {
            label: "다시 시도",
            onSelect: () => void removeProjectFromList(deleteTarget, true),
            requiresConfirmation: false,
            variant: "ghost"
          } : undefined}
          secondaryActions={[{
            label: "프로젝트 파일까지 삭제",
            onSelect: () => showFileDeleteConfirmation(deleteTarget),
            requiresConfirmation: false,
            variant: "ghost"
          }]}
          title="프로젝트 목록에서 제거"
          warningMessage="프로젝트 목록 항목만 제거합니다. 로컬 프로젝트 파일은 그대로 유지됩니다."
          warningTitle="되돌릴 수 있음"
        />
      ) : null}

      {deleteTarget && deleteDialogMode === "files" ? (
        <DeleteConfirmDialog
          busy={busy}
          irreversible={true}
          confirmationHint="프로젝트 제목을 정확히 입력해야 로컬 파일 삭제를 실행할 수 있습니다."
          confirmationLabel="프로젝트 제목"
          error={deleteError}
          expectedConfirmation={deleteTarget.title}
          impactItems={[
            { label: "저장 위치", value: deleteTarget.projectDirectory },
            { label: "로컬 프로젝트 파일", value: "프로젝트 폴더와 제작 데이터를 삭제합니다." },
            { label: "프로젝트 목록 정리", value: "삭제 성공 후 목록에서도 제거합니다." }
          ]}
          intro="로컬 프로젝트 파일 삭제를 확인합니다."
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
            label: "목록 제거로 돌아가기",
            onSelect: () => showProjectListRemoveConfirmation(deleteTarget),
            requiresConfirmation: false,
            variant: "ghost"
          }]}
          title="프로젝트 파일 삭제"
          warningMessage="로컬 프로젝트 폴더를 삭제하며 이 화면에서 복구할 수 없습니다."
          warningTitle="되돌릴 수 없음"
        />
      ) : null}
    </section>
  );
}
