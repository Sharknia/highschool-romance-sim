import { useEffect } from "react";
import type { HeroineDraft } from "./heroinePageTypes";

export const reservedHeroineIds = ["new", "edit", "settings", "delete", "create"] as const;

const requiredFields: Array<{ field: keyof HeroineDraft; label: string }> = [
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
  return normalized || "heroine";
}

export function suggestUniqueHeroineId(name: string, existingIds: string[] = []): string {
  const baseId = suggestHeroineId(name);
  const blockedIds = new Set([
    ...existingIds.map((id) => id.trim()).filter(Boolean),
    ...reservedHeroineIds
  ]);
  if (!blockedIds.has(baseId)) {
    return baseId;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!blockedIds.has(candidate)) {
      return candidate;
    }
  }
  return `${baseId}-${Date.now()}`;
}

export function validateHeroineDraft(draft: HeroineDraft, mode: "create" | "edit"): string[] {
  const issues = requiredFields
    .filter(({ field }) => !String(draft[field] || "").trim())
    .map(({ label }) => `${label}을 입력해야 합니다.`);
  const heroineId = draft.id.trim();
  if (heroineId && !/^[a-z0-9_-]+$/.test(heroineId)) {
    issues.push("자동 식별자는 소문자 영문, 숫자, 하이픈, 언더스코어만 사용할 수 있습니다.");
  }
  if (mode === "create" && reservedHeroineIds.includes(heroineId as typeof reservedHeroineIds[number])) {
    issues.push("예약어 ID는 사용할 수 없습니다.");
  }
  return issues;
}

interface HeroineFormPanelProps {
  draft: HeroineDraft;
  existingIds?: string[];
  mode: "create" | "edit";
  onChange: (draft: HeroineDraft) => void;
}

function isRequiredEmpty(draft: HeroineDraft, field: keyof HeroineDraft): boolean {
  return requiredFields.some((item) => item.field === field) && !String(draft[field] || "").trim();
}

function requiredClassName(draft: HeroineDraft, field: keyof HeroineDraft, mode: "create" | "edit"): string {
  return mode === "edit" && isRequiredEmpty(draft, field) ? "field-row field-row-invalid" : "field-row";
}

function missingText(draft: HeroineDraft, field: keyof HeroineDraft, mode: "create" | "edit") {
  return mode === "edit" && isRequiredEmpty(draft, field) ? <span className="field-error">미입력</span> : null;
}

export function HeroineFormPanel({ draft, existingIds = [], mode, onChange }: HeroineFormPanelProps) {
  const suggestedId = suggestUniqueHeroineId(draft.name, existingIds);

  useEffect(() => {
    if (mode === "create" && draft.id !== suggestedId) {
      onChange({ ...draft, id: suggestedId });
    }
  }, [draft, mode, onChange, suggestedId]);

  function update(field: keyof HeroineDraft, value: string): void {
    onChange({ ...draft, [field]: value });
  }

  return (
    <section className="heroine-form-panel">
      <div className={requiredClassName(draft, "name", mode)}>
        <label htmlFor="heroineName">이름</label>
        <input aria-invalid={isRequiredEmpty(draft, "name")} id="heroineName" onChange={(event) => update("name", event.target.value)} value={draft.name} />
        {missingText(draft, "name", mode)}
      </div>
      <div className={requiredClassName(draft, "description", mode)}>
        <label htmlFor="heroineDescription">설명</label>
        <textarea aria-invalid={isRequiredEmpty(draft, "description")} id="heroineDescription" onChange={(event) => update("description", event.target.value)} value={draft.description} />
        {missingText(draft, "description", mode)}
      </div>
      <div className="heroine-form-grid">
        <label className={requiredClassName(draft, "personality", mode)} htmlFor="heroinePersonality">
          <span>성격</span>
          <textarea aria-invalid={isRequiredEmpty(draft, "personality")} id="heroinePersonality" onChange={(event) => update("personality", event.target.value)} value={draft.personality} />
          {missingText(draft, "personality", mode)}
        </label>
        <label className={requiredClassName(draft, "speechStyle", mode)} htmlFor="heroineSpeechStyle">
          <span>말투</span>
          <textarea aria-invalid={isRequiredEmpty(draft, "speechStyle")} id="heroineSpeechStyle" onChange={(event) => update("speechStyle", event.target.value)} value={draft.speechStyle} />
          {missingText(draft, "speechStyle", mode)}
        </label>
      </div>
      <div className={requiredClassName(draft, "appearance", mode)}>
        <label htmlFor="heroineAppearance">외형 설명</label>
        <textarea aria-invalid={isRequiredEmpty(draft, "appearance")} id="heroineAppearance" onChange={(event) => update("appearance", event.target.value)} value={draft.appearance} />
        {missingText(draft, "appearance", mode)}
      </div>
    </section>
  );
}
