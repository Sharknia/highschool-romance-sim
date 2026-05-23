import { ArrowLeft, Database, FolderOpen, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { Button, StatusBanner } from "../../components/ui";
import { useWorkspaceShell } from "../../components/WorkspaceLayout";
import type { HeroineDraft, HeroineLibraryResult } from "../heroines/heroinePageTypes";
import type { ProjectApiResult } from "./projectPageTypes";

type CreateMode = "blank" | "heroine";

function suggestProjectId(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "new-project";
}

function statusTone(status: string): "neutral" | "waiting" | "success" | "error" {
  if (status.includes("실패") || status.includes("차단") || status.includes("이미 존재") || status.includes("권한")) {
    return "error";
  }
  if (status.includes("완료")) {
    return "success";
  }
  if (status.includes("생성 중") || status.includes("불러오는 중")) {
    return "waiting";
  }
  return "neutral";
}

function createProjectErrorMessage(result: ProjectApiResult): string {
  if (result.code === "PROJECT_ID_RESERVED") {
    return result.message || result.error || "예약된 프로젝트 ID입니다.";
  }
  if (result.code === "PROJECT_ID_CONFLICT" || result.code === "PROJECT_ID_MISMATCH") {
    return "저장 위치가 이미 존재합니다. 기존 프로젝트 열기, 다른 위치 선택, 생성 취소 중 하나를 선택하세요.";
  }
  if (result.code === "PROJECT_INPUT_INVALID") {
    return result.message || result.error || "입력값을 확인해 주세요.";
  }
  return result.message || result.error || "프로젝트 생성에 실패했습니다. 저장 실패 시 입력값은 유지됩니다.";
}

export function ProjectNewPage() {
  const { postAuthedJson } = useAuth();
  const { setShellState } = useWorkspaceShell();
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreateMode>("blank");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("new-project");
  const [projectIdTouched, setProjectIdTouched] = useState(false);
  const [premise, setPremise] = useState("");
  const [projectDirectory, setProjectDirectory] = useState("");
  const [status, setStatus] = useState("새 프로젝트 정보를 입력하세요.");
  const [busy, setBusy] = useState(false);
  const [heroines, setHeroines] = useState<HeroineDraft[]>([]);
  const [selectedHeroineId, setSelectedHeroineId] = useState("");
  const [heroineSourceProjectDirectory, setHeroineSourceProjectDirectory] = useState("");
  const [lastFailureCode, setLastFailureCode] = useState<string | null>(null);

  const heroineSelectionDirty = mode === "heroine" && selectedHeroineId;
  const dirty = Boolean(title.trim() || premise.trim() || projectDirectory.trim() || projectId !== "new-project" || mode !== "blank" || heroineSelectionDirty);
  const selectedHeroine = heroines.find((heroine) => heroine.id === selectedHeroineId) || null;
  const folderPreview = projectDirectory.trim()
    ? projectDirectory.trim()
    : `workspace/${projectId || "new-project"}.vnmaker`;
  const canSubmit = Boolean(title.trim() && projectId.trim() && !busy);
  const showConflictActions = lastFailureCode === "PROJECT_ID_CONFLICT" || lastFailureCode === "PROJECT_ID_MISMATCH";

  const modeDescription = useMemo(() => mode === "blank"
    ? "히로인 없이 빈 프로젝트로 시작합니다. 제작 단계는 히로인 선택 전까지 차단됩니다."
    : "히로인 스냅샷을 선택해 시작합니다. Alpha는 히로인 1명만 사용합니다.", [mode]);

  useEffect(() => {
    void postAuthedJson<HeroineLibraryResult>("/api/heroines/list", {}).then((result) => {
      if (result.ok === false) {
        setStatus(`히로인 라이브러리를 불러오지 못했습니다. ${result.error || "빈 프로젝트로 시작할 수 있습니다."}`);
        return;
      }
      const nextHeroines = Array.isArray(result.heroines) ? result.heroines : [];
      setHeroines(nextHeroines);
      setHeroineSourceProjectDirectory(result.projectDirectory || "");
      if (nextHeroines[0]) {
        setSelectedHeroineId(nextHeroines[0].id);
      }
    }).catch((error) => {
      setStatus(`히로인 라이브러리를 불러오지 못했습니다. ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [postAuthedJson]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || busy) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [busy, dirty]);

  function updateTitle(value: string): void {
    setTitle(value);
    if (!projectIdTouched) {
      setProjectId(suggestProjectId(value));
    }
  }

  function cancelCreate(): void {
    if (!dirty || window.confirm("작성 중인 새 프로젝트 정보를 버리고 나갈까요?")) {
      navigate("/projects");
    }
  }

  async function createProject(): Promise<void> {
    if (!canSubmit) {
      setStatus("프로젝트 제목과 프로젝트 ID를 입력해야 합니다.");
      return;
    }
    if (mode === "heroine" && !selectedHeroine) {
      setStatus("히로인 스냅샷을 선택해 시작하려면 히로인 1명을 선택해야 합니다.");
      return;
    }
    setBusy(true);
    setLastFailureCode(null);
    setStatus("프로젝트 생성 중");
    try {
      const body = {
        projectDirectory: projectDirectory.trim() || folderPreview,
        projectId: projectId.trim(),
        title: title.trim(),
        premise: premise.trim() || `${title.trim()} 프로젝트`,
        starter: {
          id: projectId.trim(),
          title: title.trim(),
          premise: premise.trim() || `${title.trim()} 프로젝트`
        },
        blank: mode === "blank",
        heroineId: mode === "heroine" ? selectedHeroine?.id : undefined,
        sourceProjectDirectory: mode === "heroine" ? heroineSourceProjectDirectory || undefined : undefined
      };
      const result = await postAuthedJson<ProjectApiResult>(mode === "heroine" ? "/api/projects/from-heroine" : "/api/projects", body);
      if (result.ok === false) {
        setLastFailureCode(result.code || null);
        setStatus(createProjectErrorMessage(result));
        return;
      }
      const nextProjectId = result.project?.id || projectId.trim();
      setShellState({
        projectDirectory: result.projectDirectory || projectDirectory,
        projectTitle: result.project?.title || title.trim(),
        validationStatus: result.validation?.ok === false ? "검증 필요" : "검증 통과"
      });
      setStatus("프로젝트 생성 완료");
      navigate(`/projects/${nextProjectId}/overview`);
    } catch (error) {
      setStatus(`프로젝트 생성 실패: ${error instanceof Error ? error.message : String(error)} 저장 실패 시 입력값은 유지됩니다.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-page project-new-page" aria-labelledby="projectNewTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">New Project</p>
          <h1 id="projectNewTitle">새 프로젝트 만들기</h1>
          <p>저장 후 프로젝트 ID는 변경할 수 없습니다. 제목 바로 아래에서 ID를 확인하고 저장하세요.</p>
        </div>
        <div className="page-primary-action">
          <span>{modeDescription}</span>
          <Button disabled={!canSubmit} icon={<Save size={18} />} onClick={() => void createProject()} variant="primary">
            프로젝트 저장
          </Button>
          <Button disabled={busy} icon={<ArrowLeft size={16} />} onClick={cancelCreate}>
            생성 취소
          </Button>
        </div>
      </header>

      <StatusBanner tone={statusTone(status)}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid project-new-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><Sparkles size={18} /></div>
          <h2>생성 모드</h2>
          <div className="segmented-control" aria-label="생성 모드">
            <button className={mode === "blank" ? "selected" : ""} onClick={() => setMode("blank")} type="button">
              빈 프로젝트로 시작
            </button>
            <button className={mode === "heroine" ? "selected" : ""} onClick={() => setMode("heroine")} type="button">
              히로인 스냅샷을 선택해 시작
            </button>
          </div>
          {mode === "heroine" ? (
            <label className="field-row">
              <span>시작 히로인 선택</span>
              <select onChange={(event) => setSelectedHeroineId(event.target.value)} value={selectedHeroineId}>
                {heroines.length === 0 ? <option value="">히로인 라이브러리가 비어 있습니다.</option> : null}
                {heroines.map((heroine) => <option key={heroine.id} value={heroine.id}>{heroine.name}</option>)}
              </select>
            </label>
          ) : null}
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><Database size={18} /></div>
          <h2>프로젝트 정보</h2>
          <label className="field-row">
            <span>프로젝트 제목</span>
            <input onChange={(event) => updateTitle(event.target.value)} placeholder="예: 하루와 도서관" value={title} />
          </label>
          <label className="field-row">
            <span>프로젝트 ID</span>
            <input
              onChange={(event) => {
                setProjectIdTouched(true);
                setProjectId(event.target.value);
              }}
              placeholder="url-safe-project-id"
              value={projectId}
            />
          </label>
          <label className="field-row">
            <span>premise</span>
            <textarea onChange={(event) => setPremise(event.target.value)} placeholder="프로젝트의 기본 전제를 입력하세요." value={premise} />
          </label>
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><FolderOpen size={18} /></div>
          <h2>저장 위치</h2>
          <label className="field-row">
            <span>저장 위치</span>
            <input onChange={(event) => setProjectDirectory(event.target.value)} placeholder="기본 저장 위치 사용" value={projectDirectory} />
          </label>
          <p className="page-muted">저장 폴더 미리보기: {folderPreview}</p>
          <div className="panel-actions">
            <Button disabled={busy} icon={<FolderOpen size={16} />} onClick={() => setStatus("다른 위치 선택: 저장 위치 입력란에 새 경로를 입력하세요.")}>
              다른 위치 선택
            </Button>
            <Button disabled={busy} onClick={() => navigate("/projects")}>
              기존 프로젝트 열기
            </Button>
          </div>
          {showConflictActions ? (
            <div className="inline-status warning">
              저장 위치가 이미 존재합니다. 기존 프로젝트 열기, 다른 위치 선택, 생성 취소 중 하나를 선택하세요.
            </div>
          ) : null}
        </article>
      </section>

      <div className="sticky-action-bar">
        <Button disabled={busy} icon={<ArrowLeft size={16} />} onClick={cancelCreate}>생성 취소</Button>
        <Button disabled={!canSubmit} icon={<Save size={16} />} onClick={() => void createProject()} variant="primary">프로젝트 저장</Button>
      </div>
    </section>
  );
}
