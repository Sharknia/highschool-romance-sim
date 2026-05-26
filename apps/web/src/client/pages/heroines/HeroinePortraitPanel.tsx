import { ImagePlus, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import type { CodexSessionResult } from "../../api/types";
import { Button } from "../../components/ui";
import type { HeroineDraft } from "./heroinePageTypes";

interface HeroinePortraitPanelProps {
  busy: boolean;
  heroine: HeroineDraft;
  onGenerate: () => void;
  session: CodexSessionResult | null;
}

export function HeroinePortraitPanel({ busy, heroine, onGenerate, session }: HeroinePortraitPanelProps) {
  const imageGenerationAvailable = Boolean(session?.connected && (session.capabilities?.imageGeneration ?? true));
  const previewUri = heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0] || "";
  const codexText = !session
    ? "Codex 연결 상태를 확인하는 중입니다."
    : session.connected
      ? `Codex 연결됨${session.account?.email ? ` · ${session.account.email}` : ""}`
      : session.error || "Codex 연결이 필요합니다.";
  const generationText = imageGenerationAvailable
    ? "이미지 생성 가능"
    : "생성 불가: 설정에서 Codex 연결과 이미지 생성 상태를 확인하세요.";
  const portraitText = previewUri
    ? "기본 포트레이트가 연결되었습니다."
    : heroine.defaultPortraitAssetId
      ? "기본 포트레이트 에셋이 있지만 미리보기를 찾지 못했습니다."
      : "기본 포트레이트가 없습니다.";

  return (
    <section className="page-panel heroine-portrait-panel">
      <div className="page-panel-icon"><ImagePlus size={18} /></div>
      <h2>기본 포트레이트</h2>
      <dl className="summary-list">
        <div><dt>Codex 연결</dt><dd>{codexText}</dd></div>
        <div><dt>생성 기능</dt><dd>{generationText}</dd></div>
        <div><dt>상태</dt><dd>{portraitText}</dd></div>
      </dl>
      {previewUri ? (
        <div className="preview-area portrait-preview">
          <img alt={`${heroine.name || "히로인"} 기본 포트레이트`} src={previewUri} />
        </div>
      ) : (
        <div className="portrait-placeholder">기본 포트레이트가 없습니다.</div>
      )}
      <p className="page-muted">이미지 생성을 사용할 수 없어도 기본 정보는 저장할 수 있습니다. 포트레이트는 나중에 추가할 수 있습니다.</p>
      <div className="panel-actions">
        {imageGenerationAvailable ? (
          <Button disabled={busy} icon={<ImagePlus size={16} />} onClick={onGenerate} variant="primary">
            기본 포트레이트 생성
          </Button>
        ) : (
          <Link className="button button-secondary" to="/settings">
            <span className="button-icon" aria-hidden="true"><Settings size={16} /></span>
            <span>설정으로 이동</span>
          </Link>
        )}
      </div>
    </section>
  );
}
