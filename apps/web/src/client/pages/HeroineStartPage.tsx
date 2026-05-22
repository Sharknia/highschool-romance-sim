import { Heart, ImagePlus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiResult } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";
import { useWorkspaceShell } from "../components/WorkspaceLayout";

export function HeroineStartPage() {
  const { postAuthedJson } = useAuth();
  const { setShellState } = useWorkspaceShell();
  const [heroineName, setHeroineName] = useState("하루");
  const [status, setStatus] = useState("히로인 라이브러리 시작점입니다.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShellState({
      projectTitle: "프로젝트 없음",
      storageSummary: "히로인 라이브러리",
      validationStatus: "검증 미실행"
    });
  }, [setShellState]);

  async function saveStarterHeroine(): Promise<void> {
    setBusy(true);
    setStatus("첫 히로인 저장 중");
    try {
      const result = await postAuthedJson<ApiResult>("/api/heroines/save", {
        heroine: {
          id: heroineName.trim().toLowerCase() || "haru",
          name: heroineName,
          description: "도서관에서 자주 만나는 조용한 같은 반 학생.",
          personality: "차분하지만 당황하면 솔직한 반응이 먼저 나온다.",
          speechStyle: "짧고 조심스럽게 말한다.",
          appearance: "단정한 교복, 어깨까지 오는 검은 머리, 연한 분홍색 머리핀.",
          tags: ["alpha"]
        }
      });
      if (result.ok === false) {
        throw new Error(result.error || "히로인 저장 요청이 실패했습니다.");
      }
      setStatus("첫 히로인 저장 완료");
    } catch (error) {
      setStatus(`첫 히로인 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
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
          <span>첫 히로인 프로필을 저장합니다.</span>
          <Button disabled={busy || !heroineName.trim()} icon={<Save size={18} />} onClick={() => void saveStarterHeroine()} variant="primary">
            첫 히로인 저장
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
