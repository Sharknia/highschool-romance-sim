import { AlertTriangle, RotateCw, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./Button";

export interface DeleteConfirmAction {
  label: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  requiresConfirmation?: boolean;
  onSelect: (confirmationValue: string) => void;
}

export interface DeleteConfirmDialogProps {
  busy: boolean;
  error?: string;
  expectedConfirmation: string;
  impactItems: Array<{ label: string; value: string }>;
  intro: string;
  title: string;
  confirmationLabel: string;
  confirmationHint: string;
  primaryAction: DeleteConfirmAction;
  secondaryActions?: DeleteConfirmAction[];
  retryAction?: DeleteConfirmAction;
  onClose: () => void;
}

export function DeleteConfirmDialog({
  busy,
  error,
  expectedConfirmation,
  impactItems,
  intro,
  title,
  confirmationLabel,
  confirmationHint,
  primaryAction,
  secondaryActions = [],
  retryAction,
  onClose
}: DeleteConfirmDialogProps) {
  const [confirmationValue, setConfirmationValue] = useState("");
  const confirmationInputId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmationMatches = confirmationValue.trim() === expectedConfirmation;
  const primaryDisabled = busy || confirmationValue.trim() !== expectedConfirmation || primaryAction.disabled;
  const retryLabel = retryAction?.label || "다시 시도";
  const retryDisabled = busy || retryAction?.disabled || (retryAction?.requiresConfirmation !== false && !confirmationMatches);

  useEffect(() => {
    setConfirmationValue("");
  }, [expectedConfirmation]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function trapDialogFocus(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "Escape") {
      if (!busy) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }
    const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex='-1'])"
    )).filter((element) => !element.hasAttribute("aria-hidden"));
    if (focusableElements.length === 0) {
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="deleteConfirmTitle" aria-modal="true" className="delete-dialog" onKeyDown={trapDialogFocus} ref={dialogRef} role="dialog">
        <div className="dialog-title-row">
          <span aria-hidden="true"><AlertTriangle size={18} /></span>
          <h2 id="deleteConfirmTitle">{title}</h2>
        </div>
        <p>{intro}</p>

        <div className="inline-status warning">
          <strong>되돌릴 수 없음</strong>
          <span> 삭제 후에는 이 화면에서 복구할 수 없습니다. 계속하려면 아래 확인 문구를 정확히 입력해 주세요.</span>
        </div>

        <div>
          <p><strong>영향 범위</strong></p>
          <dl className="summary-list detail-summary" aria-label="영향 범위">
            {impactItems.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="delete-confirm-fields">
          <label className="field-row" htmlFor={confirmationInputId}>
            <span>{confirmationLabel}</span>
            <input
              autoComplete="off"
              id={confirmationInputId}
              onChange={(event) => setConfirmationValue(event.target.value)}
              ref={inputRef}
              value={confirmationValue}
            />
          </label>
          <p className="field-hint">{confirmationHint}</p>
        </div>

        {error ? (
          <div className="inline-status warning" role="alert">
            <strong>삭제 실패</strong>
            <span> {error}</span>
            {retryAction ? (
              <Button disabled={retryDisabled} icon={<RotateCw size={16} />} onClick={() => retryAction.onSelect(confirmationValue.trim())} variant={retryAction.variant || "ghost"}>
                {retryLabel}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="panel-actions">
          <Button disabled={busy} icon={<X size={16} />} onClick={onClose} variant="ghost">
            취소
          </Button>
          {secondaryActions.map((action) => (
            <Button
              disabled={busy || action.disabled || !confirmationMatches}
              key={action.label}
              onClick={() => action.onSelect(confirmationValue.trim())}
              variant={action.variant || "ghost"}
            >
              {action.label}
            </Button>
          ))}
          <Button
            disabled={primaryDisabled}
            icon={<Trash2 size={16} />}
            onClick={() => primaryAction.onSelect(confirmationValue.trim())}
            variant={primaryAction.variant || "primary"}
          >
            {primaryAction.label}
          </Button>
        </div>
      </section>
    </div>
  );
}
