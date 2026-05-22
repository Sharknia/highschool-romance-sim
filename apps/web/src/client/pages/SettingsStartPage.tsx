import { LogOut, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { describeSession, useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";

export function SettingsStartPage() {
  const { logout, refreshSession, session } = useAuth();
  const { setShellState } = useWorkspaceShell();
  const [status, setStatus] = useState("설정 상태를 확인할 수 있습니다.");

  useEffect(() => {
    setShellState({
      projectTitle: "프로젝트 없음",
      storageSummary: "전역 설정",
      validationStatus: "검증 미실행"
    });
  }, [setShellState]);

  async function handleRefresh(): Promise<void> {
    setStatus("Codex 연결 상태 갱신 중");
    const nextSession = await refreshSession();
    setStatus(nextSession.connected ? "Codex 연결 상태 확인 완료" : nextSession.error || "Codex 로그인이 필요합니다.");
  }

  return (
    <section className="app-page" aria-labelledby="settingsTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 id="settingsTitle">설정</h1>
          <p>전역 연결 상태와 제작 환경을 확인합니다.</p>
        </div>
        <div className="page-primary-action">
          <span>Codex 연결 상태를 다시 확인합니다.</span>
          <Button icon={<RefreshCw size={18} />} onClick={() => void handleRefresh()} variant="primary">
            상태 갱신
          </Button>
        </div>
      </header>

      <StatusBanner tone={status.includes("완료") ? "success" : status.includes("중") ? "waiting" : status.includes("필요") ? "error" : "neutral"}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><ShieldCheck size={18} /></div>
          <h2>Codex 연결</h2>
          <dl className="settings-list">
            <div><dt>상태</dt><dd>{describeSession(session)}</dd></div>
            <div><dt>계정</dt><dd>{session?.account?.email || "확인되지 않음"}</dd></div>
            <div><dt>모드</dt><dd>{session?.mode || "없음"}</dd></div>
          </dl>
          <Button icon={<LogOut size={16} />} onClick={() => void logout()}>로그아웃</Button>
        </article>
        <article className="page-panel">
          <div className="page-panel-icon"><SlidersHorizontal size={18} /></div>
          <h2>생성 기본값</h2>
          <dl className="settings-list">
            <div><dt>스타일</dt><dd>soft visual novel</dd></div>
            <div><dt>이미지</dt><dd>Codex imageGeneration</dd></div>
          </dl>
        </article>
      </section>
    </section>
  );
}
