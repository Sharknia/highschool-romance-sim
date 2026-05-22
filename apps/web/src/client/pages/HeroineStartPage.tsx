import { CheckCircle2, Heart, ImagePlus, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, StatusBanner } from "../components/ui";
import type { HeroineDraft, HeroineLibraryResult, HeroineListState } from "./heroines/heroinePageTypes";

const emptyDraft: HeroineDraft = {
  id: "",
  name: "",
  description: "",
  personality: "",
  speechStyle: "",
  appearance: "",
  defaultPortraitAssetId: ""
};

const requiredFields: Array<{ field: keyof HeroineDraft; label: string }> = [
  { field: "id", label: "히로인 ID" },
  { field: "name", label: "이름" },
  { field: "description", label: "설명" },
  { field: "personality", label: "성격" },
  { field: "speechStyle", label: "말투" },
  { field: "appearance", label: "외형 설명" }
];

function cloneDraft(heroine: HeroineDraft): HeroineDraft {
  return {
    ...emptyDraft,
    ...heroine,
    defaultPortraitAssetId: heroine.defaultPortraitAssetId || "",
    portraitAssetIds: [...(heroine.portraitAssetIds || [])],
    expressionAssetIds: { ...(heroine.expressionAssetIds || {}) },
    reuseHistory: [...(heroine.reuseHistory || [])]
  };
}

function createNewDraft(): HeroineDraft {
  return {
    ...emptyDraft,
    id: "haru",
    name: "하루",
    description: "도서관에서 자주 만나는 같은 반 학생.",
    personality: "차분하지만 가까운 사람에게는 솔직하다.",
    speechStyle: "짧고 조심스럽게 말한다.",
    appearance: "단정한 교복과 작은 머리핀."
  };
}

function statusTone(status: string): "neutral" | "waiting" | "success" | "error" {
  if (status.includes("실패") || status.includes("못했습니다")) {
    return "error";
  }
  if (status.includes("완료") || status.includes("저장했습니다") || status.includes("삭제했습니다")) {
    return "success";
  }
  if (status.includes("불러오는 중") || status.includes("저장 중") || status.includes("삭제 중")) {
    return "waiting";
  }
  return "neutral";
}

function heroineListMessage(listState: HeroineListState): string {
  if (listState === "loading") {
    return "히로인 목록을 불러오는 중입니다.";
  }
  if (listState === "error") {
    return "히로인 목록을 불러오지 못했습니다.";
  }
  if (listState === "empty") {
    return "아직 히로인이 없습니다.";
  }
  return "히로인을 선택하거나 새로 만드세요.";
}

export function HeroineStartPage() {
  const { postAuthedJson } = useAuth();
  const navigate = useNavigate();
  const { heroineId } = useParams<{ heroineId?: string }>();
  const [listState, setListState] = useState<HeroineListState>("loading");
  const [status, setStatus] = useState("히로인 목록을 불러오는 중입니다.");
  const [busy, setBusy] = useState(false);
  const [heroines, setHeroines] = useState<HeroineDraft[]>([]);
  const [draft, setDraft] = useState<HeroineDraft>(emptyDraft);
  const [selectedHeroineId, setSelectedHeroineId] = useState("");
  const [projectDirectory, setProjectDirectory] = useState("");

  const missingRequiredLabels = useMemo(() => requiredFields
    .filter(({ field }) => !String(draft[field] || "").trim())
    .map(({ label }) => label), [draft]);
  const canSave = missingRequiredLabels.length === 0 && !busy;
  const saveBlockedReason = missingRequiredLabels.length > 0
    ? `필수값을 모두 입력해야 저장할 수 있습니다. 빠진 항목: ${missingRequiredLabels.join(", ")}`
    : "필수값이 모두 입력되었습니다.";
  const selectedHeroine = heroines.find((heroine) => heroine.id === selectedHeroineId) || null;
  const hasSavedSelection = Boolean(selectedHeroine);

  function applyHeroineList(result: HeroineLibraryResult, preferredHeroineId?: string): void {
    const nextHeroines = Array.isArray(result.heroines) ? result.heroines : [];
    const nextSelected = preferredHeroineId
      ? nextHeroines.find((heroine) => heroine.id === preferredHeroineId) || null
      : nextHeroines.find((heroine) => heroine.id === selectedHeroineId) || nextHeroines[0] || null;
    setProjectDirectory(typeof result.projectDirectory === "string" ? result.projectDirectory : "");
    setHeroines(nextHeroines);
    setListState(nextHeroines.length > 0 ? "ready" : "empty");
    setSelectedHeroineId(nextSelected?.id || "");
    setDraft(nextSelected ? cloneDraft(nextSelected) : createNewDraft());
    setStatus(nextHeroines.length > 0 ? "히로인을 선택하거나 새로 만드세요." : "아직 히로인이 없습니다.");
  }

  const loadHeroineLibrary = useCallback(async (preferredHeroineId?: string): Promise<void> => {
    setListState("loading");
    setStatus("히로인 목록을 불러오는 중입니다.");
    try {
      const result = await postAuthedJson<HeroineLibraryResult>("/api/heroines/list", {});
      if (result.ok === false) {
        setListState("error");
        setStatus(`히로인 목록을 불러오지 못했습니다. ${result.error || "다시 시도해 주세요."}`);
        return;
      }
      applyHeroineList(result, preferredHeroineId);
    } catch (error) {
      setListState("error");
      setStatus(`히로인 목록을 불러오지 못했습니다. ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [postAuthedJson]);

  useEffect(() => {
    void loadHeroineLibrary(heroineId);
  }, [heroineId, loadHeroineLibrary]);

  function updateDraftField(field: keyof HeroineDraft, value: string): void {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function startNewHeroine(): void {
    const nextDraft = createNewDraft();
    setDraft(nextDraft);
    setSelectedHeroineId("");
    setStatus("새 히로인 기본 설정을 입력하세요.");
    navigate("/heroines");
  }

  function selectHeroine(heroine: HeroineDraft): void {
    setDraft(cloneDraft(heroine));
    setSelectedHeroineId(heroine.id);
    setStatus(`${heroine.name} 기본 정보를 편집할 수 있습니다.`);
    navigate(`/heroines/${encodeURIComponent(heroine.id)}`);
  }

  async function saveHeroine(): Promise<void> {
    if (!canSave) {
      setStatus(saveBlockedReason);
      return;
    }
    setBusy(true);
    setStatus("히로인 저장 중");
    try {
      const result = await postAuthedJson<HeroineLibraryResult>("/api/heroines/save", {
        projectDirectory: projectDirectory || undefined,
        heroine: draft
      });
      if (result.ok === false) {
        setStatus(`히로인 저장 실패: ${result.error || "입력값을 확인해 주세요."}`);
        return;
      }
      const savedHeroine = result.heroine || draft;
      applyHeroineList(result, savedHeroine.id);
      setStatus(`${savedHeroine.name} 기본 정보를 저장했습니다.`);
      navigate(`/heroines/${encodeURIComponent(savedHeroine.id)}`);
    } catch (error) {
      setStatus(`히로인 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedHeroine(): Promise<void> {
    if (!selectedHeroineId) {
      setStatus("삭제할 히로인을 먼저 선택해야 합니다.");
      return;
    }
    setBusy(true);
    setStatus("히로인 삭제 중");
    try {
      const result = await postAuthedJson<HeroineLibraryResult>("/api/heroines/delete", {
        projectDirectory: projectDirectory || undefined,
        heroineId: selectedHeroineId
      });
      if (result.ok === false) {
        setStatus(`히로인 삭제 실패: ${result.error || "다시 시도해 주세요."}`);
        return;
      }
      applyHeroineList(result);
      setStatus("히로인을 라이브러리 목록에서 삭제했습니다.");
      navigate("/heroines");
    } catch (error) {
      setStatus(`히로인 삭제 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-page" aria-labelledby="heroinesTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Heroines</p>
          <h1 id="heroinesTitle">히로인 관리</h1>
          <p>라이브러리 원본 히로인을 만들고 프로젝트에 배정할 기본 정보를 준비합니다.</p>
        </div>
        <div className="page-primary-action">
          <span>{heroines.length === 0 ? "첫 히로인을 만들 수 있습니다." : "새 히로인을 추가할 수 있습니다."}</span>
          <Button disabled={busy} icon={<Plus size={18} />} onClick={startNewHeroine} variant="primary">
            {heroines.length === 0 ? "첫 히로인 만들기" : "새 히로인 만들기"}
          </Button>
        </div>
      </header>

      <StatusBanner tone={statusTone(status)}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><Heart size={18} /></div>
          <h2>히로인 목록</h2>
          <p className="page-muted">{heroineListMessage(listState)}</p>
          <div className="panel-actions">
            <Button disabled={busy || listState === "loading"} icon={<RefreshCw size={16} />} onClick={() => void loadHeroineLibrary(selectedHeroineId)}>
              다시 시도
            </Button>
          </div>
          {listState === "ready" ? (
            <div className="heroine-list">
              {heroines.map((heroine) => (
                <button
                  className={selectedHeroineId === heroine.id ? "list-item selected" : "list-item"}
                  key={heroine.id}
                  onClick={() => selectHeroine(heroine)}
                  type="button"
                >
                  <strong>{heroine.name}</strong>
                  <span>{heroine.id} · {heroine.description}</span>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><CheckCircle2 size={18} /></div>
          <h2>기본 설정</h2>
          <label className="field-row">
            <span>히로인 ID</span>
            <input aria-label="히로인 ID" onChange={(event) => updateDraftField("id", event.target.value)} value={draft.id} />
          </label>
          <label className="field-row">
            <span>이름</span>
            <input aria-label="히로인 이름" onChange={(event) => updateDraftField("name", event.target.value)} value={draft.name} />
          </label>
          <label className="field-row">
            <span>설명</span>
            <textarea aria-label="히로인 설명" onChange={(event) => updateDraftField("description", event.target.value)} value={draft.description} />
          </label>
          <label className="field-row">
            <span>성격</span>
            <textarea aria-label="히로인 성격" onChange={(event) => updateDraftField("personality", event.target.value)} value={draft.personality} />
          </label>
          <label className="field-row">
            <span>말투</span>
            <textarea aria-label="히로인 말투" onChange={(event) => updateDraftField("speechStyle", event.target.value)} value={draft.speechStyle} />
          </label>
          <label className="field-row">
            <span>외형 설명</span>
            <textarea aria-label="히로인 외형 설명" onChange={(event) => updateDraftField("appearance", event.target.value)} value={draft.appearance} />
          </label>
          <p className="page-muted">{saveBlockedReason}</p>
          <div className="panel-actions">
            <Button disabled={!canSave} icon={<Save size={16} />} onClick={() => void saveHeroine()} variant="primary">
              저장
            </Button>
          </div>
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><ImagePlus size={18} /></div>
          <h2>기본 포트레이트</h2>
          <label className="field-row">
            <span>기본 포트레이트 에셋</span>
            <input
              aria-label="기본 포트레이트 에셋"
              onChange={(event) => updateDraftField("defaultPortraitAssetId", event.target.value)}
              placeholder="asset-haru-portrait"
              value={draft.defaultPortraitAssetId || ""}
            />
          </label>
          <p className="page-muted">
            기본 포트레이트 에셋 ID를 저장하면 프로젝트 생성 시 기본 포트레이트로 연결됩니다.
          </p>
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><Trash2 size={18} /></div>
          <h2>삭제</h2>
          <p className="page-muted">
            {hasSavedSelection ? `${selectedHeroine?.name || selectedHeroineId}을 라이브러리 목록에서 삭제할 수 있습니다.` : "삭제할 히로인을 먼저 선택해야 합니다."}
          </p>
          <div className="panel-actions">
            <Button disabled={busy || !hasSavedSelection} icon={<Trash2 size={16} />} onClick={() => void deleteSelectedHeroine()}>
              삭제
            </Button>
          </div>
        </article>
      </section>
    </section>
  );
}
