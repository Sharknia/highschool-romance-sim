import { RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";

export function SettingsStartPage() {
  const { refreshSession } = useAuth();
  const [status, setStatus] = useState("설정 상태를 확인할 수 있습니다.");

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
          <p className="page-muted">연결 상태와 로그아웃은 상단 Shell에서 확인합니다.</p>
        </article>
        <article className="page-panel">
          <div className="page-panel-icon"><SlidersHorizontal size={18} /></div>
          <h2>작업 환경</h2>
          <p className="page-muted">Alpha 제작에 필요한 환경 정보를 확인합니다.</p>
        </article>
      </section>
    </section>
  );
}
