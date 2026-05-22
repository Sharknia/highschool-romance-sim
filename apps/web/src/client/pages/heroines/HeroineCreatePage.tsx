import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { createHeroine, failureText, generateHeroinePortrait, listHeroines } from "./heroineApi";
import { HeroineEditorScreen } from "./HeroineEditorScreen";
import { createEmptyHeroineDraft, validateHeroineDraft } from "./HeroineFormPanel";
import { useUnsavedHeroineNavigationGuard } from "./useUnsavedHeroineNavigationGuard";
import type { HeroineDraft, HeroineLibraryResult, HeroineLoadState } from "./heroinePageTypes";

function statusTone(state: HeroineLoadState): "neutral" | "waiting" | "success" | "error" {
  if (state === "saving") return "waiting";
  if (state === "error" || state === "conflict") return "error";
  return "neutral";
}

function editableCreateSnapshot(draft: HeroineDraft): string {
  return JSON.stringify({
    name: draft.name,
    description: draft.description,
    personality: draft.personality,
    speechStyle: draft.speechStyle,
    appearance: draft.appearance,
    defaultPortraitAssetId: draft.defaultPortraitAssetId,
    defaultPortraitUri: draft.defaultPortraitUri
  });
}

export function HeroineCreatePage() {
  const { postAuthedJson, session } = useAuth();
  const navigate = useNavigate();
  const allowNavigationRef = useRef(false);
  const [state, setState] = useState<HeroineLoadState>("ready");
  const [status, setStatus] = useState("새 히로인 기본 설정을 입력하세요.");
  const [draft, setDraft] = useState<HeroineDraft>(() => createEmptyHeroineDraft());
  const draftRef = useRef(draft);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [stagedPortraitRef, setStagedPortraitRef] = useState<HeroineLibraryResult["stagedPortraitRef"]>();
  const emptyDraft = useMemo(() => createEmptyHeroineDraft(), []);
  const dirty = editableCreateSnapshot(draft) !== editableCreateSnapshot(emptyDraft);
  const validationIssues = validateHeroineDraft(draft, "create");
  const idConflict = Boolean(draft.id.trim() && existingIds.includes(draft.id.trim()));
  const allIssues = idConflict ? [...validationIssues, "이미 같은 자동 식별자가 있습니다."] : validationIssues;
  const canSave = allIssues.length === 0 && !state.includes("saving");
  const actionSummary = allIssues.length > 0
    ? `필수값을 모두 입력해야 저장할 수 있습니다. ${allIssues.join(" ")}`
    : "저장하면 편집 화면으로 이동합니다. 저장 후 상세보기는 상세 화면으로 이동합니다.";

  useUnsavedHeroineNavigationGuard(dirty, allowNavigationRef, "저장하지 않은 히로인 draft가 있습니다. 페이지를 떠나시겠습니까?");

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    void listHeroines(postAuthedJson).then((result) => {
      if (result.ok !== false) {
        setExistingIds((result.heroines || []).map((heroine) => heroine.id));
      }
    });
  }, [postAuthedJson]);

  const updateDraft = useCallback((nextDraft: HeroineDraft): void => {
    const currentDraft = draftRef.current;
    if (stagedPortraitRef && nextDraft.id !== currentDraft.id) {
      const clearedDraft = {
        ...nextDraft,
        defaultPortraitAssetId: undefined,
        defaultPortraitUri: undefined,
        portraitAssetIds: [],
        portraitAssetUris: []
      };
      setStagedPortraitRef(undefined);
      setStatus("저장용 식별자가 바뀌어 준비한 포트레이트 연결을 해제했습니다.");
      draftRef.current = clearedDraft;
      setDraft(clearedDraft);
      return;
    }
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, [stagedPortraitRef]);

  async function save(navigateAfterSave = false): Promise<void> {
    if (!canSave) {
      setStatus(actionSummary);
      return;
    }
    setState("saving");
    setStatus("히로인을 저장하는 중입니다.");
    const result = await createHeroine(postAuthedJson, draft, stagedPortraitRef);
    if (result.ok === false) {
      setState(result.code === "HEROINE_REVISION_CONFLICT" ? "conflict" : "error");
      setStatus(`히로인 저장 실패: ${failureText(result, "입력값을 확인해 주세요.")}`);
      return;
    }
    allowNavigationRef.current = true;
    const heroineId = result.heroine?.id || draft.id;
    navigate(navigateAfterSave
      ? `/heroines/${encodeURIComponent(heroineId)}`
      : `/heroines/${encodeURIComponent(heroineId)}/edit`);
  }

  async function generatePortrait(): Promise<void> {
    const requestDraft = draftRef.current;
    setState("saving");
    setStatus("기본 포트레이트를 생성하는 중입니다.");
    const result = await generateHeroinePortrait(postAuthedJson, { draft: requestDraft });
    if (result.ok === false) {
      setState("ready");
      setStatus(`기본 포트레이트를 준비하지 못했습니다. 기본 정보는 저장할 수 있습니다. ${failureText(result, "다시 시도하세요.")}`);
      return;
    }
    const currentDraft = draftRef.current;
    if (currentDraft.id !== requestDraft.id) {
      setStagedPortraitRef(undefined);
      setState("ready");
      setStatus("저장용 식별자가 바뀌어 준비한 포트레이트 연결을 해제했습니다.");
      return;
    }
    const nextDraft = {
      ...currentDraft,
      defaultPortraitAssetId: result.asset?.id || currentDraft.defaultPortraitAssetId,
      defaultPortraitUri: result.stagedPortraitRef?.previewUri || result.asset?.uri || currentDraft.defaultPortraitUri
    };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setStagedPortraitRef(result.stagedPortraitRef);
    setState("ready");
    setStatus("기본 포트레이트가 연결되었습니다. 저장하면 원본 히로인 에셋으로 연결됩니다.");
  }

  function cancel(): void {
    if (dirty && !window.confirm("저장하지 않은 히로인 draft가 있습니다. 목록으로 돌아가시겠습니까?")) {
      return;
    }
    allowNavigationRef.current = true;
    navigate("/heroines");
  }

  return (
    <HeroineEditorScreen
      canSave={canSave}
      description="라이브러리 원본 히로인을 생성합니다. 포트레이트 없이도 기본 정보는 저장할 수 있습니다."
      dirty={dirty}
      draft={draft}
      existingIds={existingIds}
      eyebrow="New Heroine"
      mode="create"
      onBackToList={() => navigate("/heroines")}
      onCancel={cancel}
      onChange={updateDraft}
      onGeneratePortrait={() => void generatePortrait()}
      onSave={() => void save()}
      onSaveAndExit={() => void save(true)}
      saving={state === "saving"}
      session={session}
      status={status}
      statusTone={statusTone(state)}
      summary={actionSummary}
      title="새 히로인 만들기"
      titleId="heroineCreateTitle"
    />
  );
}
