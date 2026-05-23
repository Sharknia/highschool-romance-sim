import { DeleteConfirmDialog } from "../../components/ui";
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
  if (!heroine) {
    return null;
  }

  const isConflict = Boolean(error?.includes("충돌"));
  const confirmHeroineName = "삭제 확인 이름";

  return (
    <DeleteConfirmDialog
      busy={deleting}
      confirmationHint="삭제 확인 이름을 입력해야 합니다. 이름이 일치해야 삭제할 수 있습니다."
      confirmationLabel={confirmHeroineName}
      error={error}
      expectedConfirmation={heroine.name}
      impactItems={[
        { label: "이름", value: heroine.name },
        { label: "영향 범위", value: "라이브러리 원본만 삭제하고 기존 프로젝트 스냅샷은 유지합니다." }
      ]}
      intro={`'${heroine.name}' 원본 히로인을 삭제합니다. 이미 만든 프로젝트의 스냅샷은 유지되지만, 라이브러리에서는 제거됩니다. 이 작업은 Alpha에서 되돌릴 수 없습니다.`}
      onClose={onClose}
      primaryAction={{
        label: "삭제",
        onSelect: (confirmationValue) => onConfirm(heroine, { confirmName: confirmationValue.trim(), confirmId: heroine.id }, heroine.heroineRevision),
        variant: "primary"
      }}
      retryAction={isConflict && onReload ? {
        label: "최신 정보를 다시 불러오기",
        onSelect: onReload,
        requiresConfirmation: false,
        variant: "ghost"
      } : undefined}
      title="원본 히로인 삭제"
    />
  );
}
