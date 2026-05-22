import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { failureText, generateHeroinePortrait, getHeroine, updateHeroine } from "./heroineApi";
import { HeroineEditorScreen } from "./HeroineEditorScreen";
import { createEmptyHeroineDraft, validateHeroineDraft } from "./HeroineFormPanel";
import { useUnsavedHeroineNavigationGuard } from "./useUnsavedHeroineNavigationGuard";
import type { HeroineDraft, HeroineLoadState, HeroineRevisionRef } from "./heroinePageTypes";

function statusTone(state: HeroineLoadState): "neutral" | "waiting" | "success" | "error" {
  if (state === "loading" || state === "saving") return "waiting";
  if (state === "error" || state === "notFound" || state === "conflict") return "error";
  return "neutral";
}

function editableSnapshot(draft: HeroineDraft): string {
  return JSON.stringify({
    name: draft.name,
    description: draft.description,
    personality: draft.personality,
    speechStyle: draft.speechStyle,
    appearance: draft.appearance,
    defaultPortraitAssetId: draft.defaultPortraitAssetId
  });
}

export function HeroineEditPage() {
  const { postAuthedJson, session } = useAuth();
  const navigate = useNavigate();
  const { heroineId = "" } = useParams<{ heroineId: string }>();
  const allowNavigationRef = useRef(false);
  const [state, setState] = useState<HeroineLoadState>("loading");
  const [status, setStatus] = useState("수정할 히로인 정보를 불러오는 중입니다.");
  const [draft, setDraft] = useState<HeroineDraft>(() => createEmptyHeroineDraft());
  const [original, setOriginal] = useState<HeroineDraft>(() => createEmptyHeroineDraft());
  const [revision, setRevision] = useState<HeroineRevisionRef | undefined>();
  const validationIssues = validateHeroineDraft(draft, "edit");
  const dirty = useMemo(() => editableSnapshot(draft) !== editableSnapshot(original), [draft, original]);
  const canSave = state !== "saving" && dirty && validationIssues.length === 0;
  const actionSummary = validationIssues.length > 0
    ? `필수값을 모두 입력해야 저장할 수 있습니다. ${validationIssues.join(" ")}`
    : dirty
      ? "변경할 내용을 입력하세요."
      : "변경된 내용이 없습니다.";

  const load = useCallback(async () => {
    setState("loading");
    setStatus("수정할 히로인 정보를 불러오는 중입니다.");
    const result = await getHeroine(postAuthedJson, heroineId);
    if (result.ok === false) {
      const notFound = result.code === "HEROINE_NOT_FOUND";
      setState(notFound ? "notFound" : "error");
      setStatus(notFound ? "히로인을 찾을 수 없습니다." : `수정할 히로인 정보를 불러오지 못했습니다. ${failureText(result, "다시 시도하세요.")}`);
      return;
    }
    const nextDraft = {
      ...result.heroine!,
      heroineRevision: result.heroineRevision
    };
    setDraft(nextDraft);
    setOriginal(nextDraft);
    setRevision(result.heroineRevision);
    setState("ready");
    setStatus("변경할 내용을 입력하세요.");
  }, [heroineId, postAuthedJson]);

  useEffect(() => {
    void load();
  }, [load]);

  useUnsavedHeroineNavigationGuard(dirty, allowNavigationRef, "저장하지 않은 변경 사항이 있습니다. 페이지를 떠나시겠습니까?");

  async function save(navigateAfterSave = false): Promise<void> {
    if (!canSave) {
      setStatus(actionSummary);
      return;
    }
    setState("saving");
    setStatus("히로인을 저장하는 중입니다.");
    const result = await updateHeroine(postAuthedJson, draft, revision);
    if (result.ok === false) {
      setState(result.code === "HEROINE_REVISION_CONFLICT" ? "conflict" : "error");
      setStatus(`히로인 저장 실패: ${failureText(result, "입력값을 확인해 주세요.")}`);
      return;
    }
    const nextDraft = {
      ...result.heroine!,
      heroineRevision: result.heroineRevision
    };
    setDraft(nextDraft);
    setOriginal(nextDraft);
    setRevision(result.heroineRevision);
    setState("ready");
    setStatus(navigateAfterSave ? "히로인을 저장했습니다. 상세보기로 이동합니다." : "히로인을 저장했습니다.");
    if (navigateAfterSave) {
      allowNavigationRef.current = true;
      navigate(`/heroines/${encodeURIComponent(result.heroine?.id || draft.id)}`);
    }
  }

  async function generatePortrait(): Promise<void> {
    if (dirty) {
      setStatus("저장하지 않은 변경 사항이 있어 기본 포트레이트 생성 전에 저장해야 합니다.");
      return;
    }
    setState("saving");
    setStatus("기본 포트레이트를 생성하는 중입니다.");
    const result = await generateHeroinePortrait(postAuthedJson, {
      heroineId: draft.id,
      expectedHeroineRevision: revision
    });
    if (result.ok === false) {
      setState(result.code === "HEROINE_REVISION_CONFLICT" ? "conflict" : "ready");
      setStatus(`기본 포트레이트를 준비하지 못했습니다. 기본 정보는 저장할 수 있습니다. ${failureText(result, "다시 시도하세요.")}`);
      return;
    }
    const nextDraft = {
      ...result.heroine!,
      heroineRevision: result.heroineRevision
    };
    setDraft(nextDraft);
    setOriginal(nextDraft);
    setRevision(result.heroineRevision);
    setState("ready");
    setStatus("기본 포트레이트가 연결되었습니다.");
  }

  function cancel(): void {
    if (dirty && !window.confirm("저장하지 않은 변경 사항이 있습니다. 상세보기로 돌아가시겠습니까?")) {
      return;
    }
    allowNavigationRef.current = true;
    navigate(`/heroines/${encodeURIComponent(heroineId)}`);
  }

  return (
    <HeroineEditorScreen
      canSave={canSave}
      conflict={state === "conflict"}
      description="원본 히로인을 수정해도 기존 프로젝트 스냅샷은 자동 갱신하지 않습니다."
      dirty={dirty}
      draft={draft}
      error={state === "error"}
      eyebrow="Edit Heroine"
      mode="edit"
      notFound={state === "notFound"}
      onBackToList={() => navigate("/heroines")}
      onCancel={cancel}
      onChange={setDraft}
      onGeneratePortrait={() => void generatePortrait()}
      onReload={() => void load()}
      onRetry={() => void load()}
      onSave={() => void save()}
      onSaveAndExit={() => void save(true)}
      saving={state === "saving"}
      session={session}
      status={status}
      statusTone={statusTone(state)}
      summary={actionSummary}
      title="히로인 수정"
      titleId="heroineEditTitle"
    />
  );
}
