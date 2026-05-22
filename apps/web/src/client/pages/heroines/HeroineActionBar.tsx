import { RotateCcw, Save, X } from "lucide-react";
import { Button } from "../../components/ui";

interface HeroineActionBarProps {
  canSave: boolean;
  dirty: boolean;
  saving: boolean;
  summary: string;
  conflict?: boolean;
  onCancel: () => void;
  onReload?: () => void;
  onSave: () => void;
  onSaveAndExit?: () => void;
  saveAndExitLabel?: string;
}

export function HeroineActionBar({
  canSave,
  conflict = false,
  dirty,
  onCancel,
  onReload,
  onSave,
  onSaveAndExit,
  saving,
  saveAndExitLabel = "저장 후 상세보기",
  summary
}: HeroineActionBarProps) {
  return (
    <div className="heroine-action-bar" aria-label="히로인 저장 작업">
      <div className="heroine-action-status">
        <strong>{dirty ? "변경됨" : "변경된 내용이 없습니다."}</strong>
        <span>{summary}</span>
      </div>
      <div className="panel-actions">
        {conflict && onReload ? (
          <Button disabled={saving} icon={<RotateCcw size={16} />} onClick={onReload}>
            최신 정보를 다시 불러오기
          </Button>
        ) : null}
        <Button disabled={saving} icon={<X size={16} />} onClick={onCancel}>
          취소
        </Button>
        <Button disabled={!canSave || saving} icon={<Save size={16} />} onClick={onSave} variant="primary">
          저장
        </Button>
        {onSaveAndExit ? (
          <Button disabled={!canSave || saving} icon={<Save size={16} />} onClick={onSaveAndExit} variant="primary">
            {saveAndExitLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
