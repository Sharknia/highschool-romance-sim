import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui";
import type { HeroineDraft, HeroineRevisionRef } from "./heroinePageTypes";

export interface HeroineDeleteConfirmation {
  confirmName: string;
  confirmId: string;
}

interface HeroineDeleteDialogProps {
  deleting: boolean;
  error?: string;
  heroine: HeroineDraft | null;
  onClose: () => void;
  onConfirm: (heroine: HeroineDraft, confirmation: HeroineDeleteConfirmation, expectedHeroineRevision?: HeroineRevisionRef) => void;
  onReload?: () => void;
}

export function HeroineDeleteDialog({ deleting, error, heroine, onClose, onConfirm, onReload }: HeroineDeleteDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const [confirmId, setConfirmId] = useState("");

  useEffect(() => {
    setConfirmName("");
    setConfirmId("");
  }, [heroine?.id]);

  if (!heroine) {
    return null;
  }

  const isConflict = Boolean(error?.includes("충돌"));
  const confirmationMatches = confirmName.trim() === heroine.name && confirmId.trim() === heroine.id;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="deleteHeroineTitle" aria-modal="true" className="delete-dialog" role="dialog">
        <div className="dialog-title-row">
          <span aria-hidden="true"><AlertTriangle size={18} /></span>
          <h2 id="deleteHeroineTitle">원본 히로인 삭제</h2>
        </div>
        <p>
          '{heroine.name}'({heroine.id}) 원본 히로인을 삭제합니다.
          이미 만든 프로젝트의 스냅샷은 유지되지만, 라이브러리에서는 제거됩니다.
          이 작업은 Alpha에서 되돌릴 수 없습니다.
        </p>
        <dl className="summary-list detail-summary">
          <div><dt>이름</dt><dd>{heroine.name}</dd></div>
          <div><dt>ID</dt><dd>{heroine.id}</dd></div>
          <div><dt>영향 범위</dt><dd>라이브러리 원본만 삭제하고 기존 프로젝트 스냅샷은 유지합니다.</dd></div>
        </dl>
        <div className="delete-confirm-fields">
          <label className="field-row" htmlFor="confirmHeroineName">
            <span>삭제 확인 이름</span>
            <input
              autoComplete="off"
              id="confirmHeroineName"
              onChange={(event) => setConfirmName(event.target.value)}
              value={confirmName}
            />
          </label>
          <label className="field-row" htmlFor="confirmHeroineId">
            <span>삭제 확인 ID</span>
            <input
              autoComplete="off"
              id="confirmHeroineId"
              onChange={(event) => setConfirmId(event.target.value)}
              value={confirmId}
            />
          </label>
          <p className="field-hint">삭제 확인값을 입력해야 합니다. 이름과 ID가 모두 일치해야 삭제할 수 있습니다.</p>
        </div>
        {error ? (
          <div className="inline-status warning">
            {error}
            {isConflict && onReload ? (
              <Button disabled={deleting} icon={<X size={16} />} onClick={onReload}>
                최신 정보를 다시 불러오기
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="panel-actions">
          <Button disabled={deleting} icon={<X size={16} />} onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={deleting || !confirmationMatches}
            icon={<Trash2 size={16} />}
            onClick={() => onConfirm(heroine, { confirmName: confirmName.trim(), confirmId: confirmId.trim() }, heroine.heroineRevision)}
            variant="primary"
          >
            삭제
          </Button>
        </div>
      </section>
    </div>
  );
}
