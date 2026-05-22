import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button, StatusBanner } from "../../components/ui";
import { HeroineActionBar } from "./HeroineActionBar";
import { HeroineFormPanel } from "./HeroineFormPanel";
import { HeroinePortraitPanel } from "./HeroinePortraitPanel";
import type { HeroineDraft } from "./heroinePageTypes";
import type { CodexSessionResult } from "../../api/types";

interface HeroineEditorScreenProps {
  canSave: boolean;
  description: string;
  dirty: boolean;
  draft: HeroineDraft;
  eyebrow: string;
  mode: "create" | "edit";
  onBackToList: () => void;
  onCancel: () => void;
  onChange: (draft: HeroineDraft) => void;
  onGeneratePortrait: () => void;
  onSave: () => void;
  saving: boolean;
  session: CodexSessionResult | null;
  status?: string;
  statusTone: "neutral" | "waiting" | "success" | "error";
  summary: string;
  title: string;
  titleId: string;
  conflict?: boolean;
  error?: boolean;
  existingIds?: string[];
  loading?: boolean;
  notFound?: boolean;
  notFoundTitle?: string;
  onReload?: () => void;
  onRetry?: () => void;
  onSaveAndExit?: () => void;
}

export function HeroineEditorScreen({
  canSave,
  conflict = false,
  description,
  dirty,
  draft,
  error = false,
  existingIds,
  eyebrow,
  loading = false,
  mode,
  notFound = false,
  notFoundTitle = "히로인을 찾을 수 없습니다.",
  onBackToList,
  onCancel,
  onChange,
  onGeneratePortrait,
  onReload,
  onRetry,
  onSave,
  onSaveAndExit,
  saving,
  session,
  status,
  statusTone,
  summary,
  title,
  titleId
}: HeroineEditorScreenProps) {
  const showEditor = !loading && !notFound && !error;

  return (
    <section className="app-page heroine-page" aria-labelledby={titleId}>
      <header className="page-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 id={titleId}>{title}</h1>
          <p>{description}</p>
        </div>
      </header>

      {status ? (
        <StatusBanner tone={statusTone}>
          <span className="page-status">{status}</span>
        </StatusBanner>
      ) : null}

      {notFound ? (
        <section className="page-panel">
          <h2>{notFoundTitle}</h2>
          <Button icon={<ArrowLeft size={16} />} onClick={onBackToList}>
            목록으로 돌아가기
          </Button>
        </section>
      ) : null}

      {error && onRetry ? (
        <div className="panel-actions">
          <Button icon={<RefreshCw size={16} />} onClick={onRetry}>다시 시도</Button>
        </div>
      ) : null}

      {showEditor ? (
        <>
          <section className="heroine-editor-layout">
            <article className="page-panel heroine-editor-main">
              <HeroineFormPanel draft={draft} existingIds={existingIds} mode={mode} onChange={onChange} />
            </article>
            <HeroinePortraitPanel
              busy={saving}
              heroine={draft}
              onGenerate={onGeneratePortrait}
              session={session}
            />
          </section>

          <HeroineActionBar
            canSave={canSave}
            conflict={conflict}
            dirty={dirty}
            onCancel={onCancel}
            onReload={onReload}
            onSave={onSave}
            onSaveAndExit={onSaveAndExit}
            saving={saving}
            summary={summary}
          />
        </>
      ) : null}
    </section>
  );
}
