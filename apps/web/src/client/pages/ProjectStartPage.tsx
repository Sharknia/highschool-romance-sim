import { CheckCircle2, Database, FolderOpen, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiResult } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";

const starterProject = {
  id: "web-starter",
  title: "웹 제작툴 샘플",
  premise: "Codex와 함께 미연시를 제작하는 첫 프로젝트"
};

export function ProjectStartPage() {
  const { postAuthedJson } = useAuth();
  const { setShellState, summarizeDirectory } = useWorkspaceShell();
  const [projectDirectory, setProjectDirectory] = useState("");
  const [status, setStatus] = useState("열린 프로젝트가 없습니다.");
  const [projectTitle, setProjectTitle] = useState("프로젝트 없음");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShellState({
      projectTitle,
      storageSummary: summarizeDirectory(projectDirectory),
      validationStatus: projectTitle === "프로젝트 없음" ? "검증 미실행" : "검증 대기"
    });
  }, [projectDirectory, projectTitle, setShellState, summarizeDirectory]);

  async function runProjectAction(label: string, action: () => Promise<ApiResult>): Promise<void> {
    setBusy(true);
    setStatus(`${label} 실행 중`);
    try {
      const result = await action();
      if (result.ok === false) {
        throw new Error(result.error || `${label} 요청이 실패했습니다.`);
      }
      const nextProject = result.project as { title?: string } | undefined;
      const nextDirectory = typeof result.projectDirectory === "string" ? result.projectDirectory : projectDirectory;
      setProjectDirectory(nextDirectory);
      setProjectTitle(nextProject?.title || projectTitle);
      setStatus(`${label} 완료`);
    } catch (error) {
      setStatus(`${label} 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-page" aria-labelledby="projectsTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Projects</p>
          <h1 id="projectsTitle">프로젝트 관리</h1>
          <p>현재 프로젝트를 열고 Alpha 제작 루프를 시작합니다.</p>
        </div>
        <div className="page-primary-action">
          <span>첫 제작 기준 프로젝트가 필요합니다.</span>
          <Button disabled={busy} icon={<Sparkles size={18} />} onClick={() => void runProjectAction("샘플 프로젝트 생성", () => postAuthedJson<ApiResult>("/api/project/starter", {
            projectDirectory: projectDirectory || undefined,
            starter: starterProject
          }))} variant="primary">
            샘플 프로젝트 생성
          </Button>
        </div>
      </header>

      <StatusBanner tone={status.includes("실패") ? "error" : status.includes("완료") ? "success" : status.includes("실행 중") ? "waiting" : "neutral"}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><Database size={18} /></div>
          <h2>저장 위치</h2>
          <label className="field-row">
            <span>프로젝트 디렉터리</span>
            <input aria-label="프로젝트 디렉터리" onChange={(event) => setProjectDirectory(event.target.value)} placeholder="기본 작업공간 사용" value={projectDirectory} />
          </label>
          <Button disabled={busy} icon={<FolderOpen size={16} />} onClick={() => void runProjectAction("프로젝트 열기", () => postAuthedJson<ApiResult>("/api/project/open", {
            projectDirectory: projectDirectory || undefined
          }))}>
            프로젝트 열기
          </Button>
        </article>
        <article className="page-panel">
          <div className="page-panel-icon"><CheckCircle2 size={18} /></div>
          <h2>현재 상태</h2>
          <dl className="summary-list">
            <div><dt>프로젝트</dt><dd>{projectTitle}</dd></div>
            <div><dt>저장 위치</dt><dd>{summarizeDirectory(projectDirectory)}</dd></div>
            <div><dt>검증</dt><dd>{projectTitle === "프로젝트 없음" ? "검증 미실행" : "검증 대기"}</dd></div>
          </dl>
        </article>
      </section>
    </section>
  );
}
