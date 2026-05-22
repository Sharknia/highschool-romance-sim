import { useEffect } from "react";
import type { HeroineDraft } from "./heroinePageTypes";

export const reservedHeroineIds = ["new", "edit", "settings", "delete", "create"] as const;

const requiredFields: Array<{ field: keyof HeroineDraft; label: string }> = [
  { field: "id", label: "히로인 ID" },
  { field: "name", label: "이름" },
  { field: "description", label: "설명" },
  { field: "personality", label: "성격" },
  { field: "speechStyle", label: "말투" },
  { field: "appearance", label: "외형 설명" }
];

export function createEmptyHeroineDraft(): HeroineDraft {
  return {
    id: "",
    name: "",
    description: "",
    personality: "",
    speechStyle: "",
    appearance: ""
  };
}

export function suggestHeroineId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || "";
}

export function validateHeroineDraft(draft: HeroineDraft, mode: "create" | "edit"): string[] {
  const issues = requiredFields
    .filter(({ field }) => !String(draft[field] || "").trim())
    .map(({ label }) => `${label}을 입력해야 합니다.`);
  const heroineId = draft.id.trim();
  if (heroineId && !/^[a-z0-9_-]+$/.test(heroineId)) {
    issues.push("히로인 ID는 소문자 영문, 숫자, 하이픈, 언더스코어만 사용할 수 있습니다.");
  }
  if (mode === "create" && reservedHeroineIds.includes(heroineId as typeof reservedHeroineIds[number])) {
    issues.push("예약어 ID는 사용할 수 없습니다.");
  }
  return issues;
}

interface HeroineFormPanelProps {
  draft: HeroineDraft;
  mode: "create" | "edit";
  onChange: (draft: HeroineDraft) => void;
}

export function HeroineFormPanel({ draft, mode, onChange }: HeroineFormPanelProps) {
  const suggestedId = suggestHeroineId(draft.name);

  useEffect(() => {
    if (mode === "create" && !draft.id.trim() && suggestedId) {
      onChange({ ...draft, id: suggestedId });
    }
  }, [draft, mode, onChange, suggestedId]);

  function update(field: keyof HeroineDraft, value: string): void {
    onChange({ ...draft, [field]: value });
  }

  return (
    <section className="heroine-form-panel">
      <div className="field-row">
        <label htmlFor="heroineName">이름</label>
        <input id="heroineName" onChange={(event) => update("name", event.target.value)} value={draft.name} />
      </div>
      <div className="field-row">
        <label htmlFor="heroineId">히로인 ID</label>
        <input
          id="heroineId"
          onChange={(event) => update("id", event.target.value)}
          readOnly={mode === "edit"}
          value={draft.id}
        />
        <span className="field-hint">
          {mode === "create"
            ? `ID는 이름으로 자동 제안됩니다. 저장 전에는 수정할 수 있고, 저장 후에는 바꿀 수 없습니다.${suggestedId ? ` 제안값: ${suggestedId}` : ""}`
            : "저장된 히로인 ID는 수정할 수 없습니다."}
        </span>
      </div>
      <div className="field-row">
        <label htmlFor="heroineDescription">설명</label>
        <textarea id="heroineDescription" onChange={(event) => update("description", event.target.value)} value={draft.description} />
      </div>
      <div className="heroine-form-grid">
        <label className="field-row" htmlFor="heroinePersonality">
          <span>성격</span>
          <textarea id="heroinePersonality" onChange={(event) => update("personality", event.target.value)} value={draft.personality} />
        </label>
        <label className="field-row" htmlFor="heroineSpeechStyle">
          <span>말투</span>
          <textarea id="heroineSpeechStyle" onChange={(event) => update("speechStyle", event.target.value)} value={draft.speechStyle} />
        </label>
      </div>
      <div className="field-row">
        <label htmlFor="heroineAppearance">외형 설명</label>
        <textarea id="heroineAppearance" onChange={(event) => update("appearance", event.target.value)} value={draft.appearance} />
      </div>
    </section>
  );
}
