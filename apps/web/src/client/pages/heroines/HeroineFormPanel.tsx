import { useEffect, useState } from "react";
import { FieldGroup } from "../../components/ui";
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
  showAllValidationErrors?: boolean;
}

function isRequiredEmpty(draft: HeroineDraft, field: keyof HeroineDraft): boolean {
  return requiredFields.some((item) => item.field === field) && !String(draft[field] || "").trim();
}

export function HeroineFormPanel({ draft, existingIds = [], mode, onChange, showAllValidationErrors = false }: HeroineFormPanelProps) {
  const suggestedId = suggestUniqueHeroineId(draft.name, existingIds);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof HeroineDraft, boolean>>>({});

  useEffect(() => {
    if (mode === "create" && draft.id !== suggestedId) {
      onChange({ ...draft, id: suggestedId });
    }
  }, [draft, mode, onChange, suggestedId]);

  function update(field: keyof HeroineDraft, value: string): void {
    onChange({ ...draft, [field]: value });
  }

  function markTouched(field: keyof HeroineDraft): void {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function showRequiredError(field: keyof HeroineDraft): boolean {
    return Boolean((showAllValidationErrors || touchedFields[field]) && isRequiredEmpty(draft, field));
  }

  function requiredClassName(field: keyof HeroineDraft): string {
    return showRequiredError(field) ? "field-row field-row-invalid" : "field-row";
  }

  return (
    <section className="heroine-form-panel">
      <FieldGroup title="기본 정체성" description="이름과 한 줄 설명은 프로젝트 스냅샷과 목록 카드에 먼저 표시되는 필수 정보입니다.">
        <div className={requiredClassName("name")}>
          <label htmlFor="heroineName">이름 <span className="field-required">필수</span></label>
          <input aria-invalid={showRequiredError("name")} id="heroineName" onBlur={() => markTouched("name")} onChange={(event) => update("name", event.target.value)} value={draft.name} />
          <p className="field-hint">저장용 자동 식별자는 이름을 기준으로 제안됩니다.</p>
        </div>
        <div className={requiredClassName("description")}>
          <label htmlFor="heroineDescription">설명 <span className="field-required">필수</span></label>
          <textarea aria-invalid={showRequiredError("description")} id="heroineDescription" onBlur={() => markTouched("description")} onChange={(event) => update("description", event.target.value)} value={draft.description} />
          <p className="field-hint">목록과 상세 첫 화면에서 캐릭터를 빠르게 파악할 수 있는 짧은 소개를 입력합니다.</p>
        </div>
      </FieldGroup>
      <FieldGroup title="성격과 말투" description="대화 생성과 캐릭터 검토에 쓰이는 필수 기준입니다.">
        <div className="heroine-form-grid">
          <label className={requiredClassName("personality")} htmlFor="heroinePersonality">
            <span>성격 <span className="field-required">필수</span></span>
            <textarea aria-invalid={showRequiredError("personality")} id="heroinePersonality" onBlur={() => markTouched("personality")} onChange={(event) => update("personality", event.target.value)} value={draft.personality} />
          </label>
          <label className={requiredClassName("speechStyle")} htmlFor="heroineSpeechStyle">
            <span>말투 <span className="field-required">필수</span></span>
            <textarea aria-invalid={showRequiredError("speechStyle")} id="heroineSpeechStyle" onBlur={() => markTouched("speechStyle")} onChange={(event) => update("speechStyle", event.target.value)} value={draft.speechStyle} />
          </label>
        </div>
      </FieldGroup>
      <FieldGroup title="외형과 이미지 단서" description="포트레이트와 배경 생성 프롬프트에 연결되는 필수 외형 정보입니다. 포트레이트 생성은 선택 사항입니다.">
        <div className={requiredClassName("appearance")}>
          <label htmlFor="heroineAppearance">외형 설명 <span className="field-required">필수</span></label>
          <textarea aria-invalid={showRequiredError("appearance")} id="heroineAppearance" onBlur={() => markTouched("appearance")} onChange={(event) => update("appearance", event.target.value)} value={draft.appearance} />
          <p className="field-hint">의상, 머리 모양, 분위기처럼 이미지 생성에 필요한 단서를 구체적으로 적습니다.</p>
        </div>
      </FieldGroup>
    </section>
  );
}
