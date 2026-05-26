import { RotateCcw, Save, X } from "lucide-react";
import { Button, StickyActionBar } from "../../components/ui";

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
    <StickyActionBar
      className="heroine-action-bar"
      title={dirty ? "변경됨" : "변경된 내용이 없습니다."}
      summary={summary}
    >
      {conflict && onReload ? (
        <Button disabled={saving} icon={<RotateCcw size={16} />} onClick={onReload}>
          최신 정보를 다시 불러오기
        </Button>
      ) : null}
      <Button disabled={saving} icon={<X size={16} />} onClick={onCancel}>
        취소
      </Button>
      <Button disabled={saving} icon={<Save size={16} />} onClick={onSave} variant={onSaveAndExit && canSave ? "secondary" : "primary"}>
        저장
      </Button>
      {onSaveAndExit ? (
        <Button disabled={saving} icon={<Save size={16} />} onClick={onSaveAndExit} variant={canSave ? "primary" : "secondary"}>
          {saveAndExitLabel}
        </Button>
      ) : null}
    </StickyActionBar>
  );
}
