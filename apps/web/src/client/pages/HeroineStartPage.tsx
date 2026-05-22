import { CheckCircle2, Heart, ImagePlus } from "lucide-react";
import { useState } from "react";
import { Button, StatusBanner } from "../components/ui";

export function HeroineStartPage() {
  const [heroineName, setHeroineName] = useState("하루");
  const [status, setStatus] = useState("히로인 라이브러리 시작점입니다.");

  function confirmHeroineWorkspace(): void {
    const name = heroineName.trim();
    setStatus(name ? `${name} 프로필 작업 영역 준비 완료` : "히로인 이름을 입력해야 합니다.");
  }

  return (
    <section className="app-page" aria-labelledby="heroinesTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Heroines</p>
          <h1 id="heroinesTitle">히로인 관리</h1>
          <p>라이브러리 원본 히로인을 준비합니다.</p>
        </div>
        <div className="page-primary-action">
          <span>프로필 입력 상태를 확인합니다.</span>
          <Button disabled={!heroineName.trim()} icon={<CheckCircle2 size={18} />} onClick={confirmHeroineWorkspace} variant="primary">
            작업 영역 확인
          </Button>
        </div>
      </header>

      <StatusBanner tone={status.includes("실패") ? "error" : status.includes("완료") ? "success" : status.includes("중") ? "waiting" : "neutral"}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><Heart size={18} /></div>
          <h2>기본 프로필</h2>
          <label className="field-row">
            <span>이름</span>
            <input aria-label="히로인 이름" onChange={(event) => setHeroineName(event.target.value)} value={heroineName} />
          </label>
        </article>
        <article className="page-panel">
          <div className="page-panel-icon"><ImagePlus size={18} /></div>
          <h2>포트레이트</h2>
          <p className="page-muted">기본 포트레이트가 아직 없습니다.</p>
        </article>
      </section>
    </section>
  );
}
