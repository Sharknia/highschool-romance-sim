import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import { StatusBanner } from "../components/ui";

export function SettingsStartPage() {
  const status = "설정 상태를 확인할 수 있습니다.";

  return (
    <section className="app-page" aria-labelledby="settingsTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 id="settingsTitle">설정</h1>
          <p>전역 연결 상태와 제작 환경을 확인합니다.</p>
        </div>
      </header>

      <StatusBanner tone={status.includes("완료") ? "success" : status.includes("중") ? "waiting" : status.includes("필요") ? "error" : "neutral"}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><ShieldCheck size={18} /></div>
          <h2>Codex 연결</h2>
          <p className="page-muted">연결 상태는 앱 시작과 화면 재진입 시 자동으로 확인합니다.</p>
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
