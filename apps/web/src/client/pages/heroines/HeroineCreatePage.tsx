import { useBeforeUnload, useBlocker, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { StatusBanner } from "../../components/ui";
import { createHeroine, failureText, generateHeroinePortrait, listHeroines } from "./heroineApi";
import { HeroineActionBar } from "./HeroineActionBar";
import { createEmptyHeroineDraft, HeroineFormPanel, validateHeroineDraft } from "./HeroineFormPanel";
import { HeroinePortraitPanel } from "./HeroinePortraitPanel";
import type { HeroineDraft, HeroineLibraryResult, HeroineLoadState } from "./heroinePageTypes";

function statusTone(state: HeroineLoadState): "neutral" | "waiting" | "success" | "error" {
  if (state === "saving") return "waiting";
  if (state === "error" || state === "conflict") return "error";
  return "neutral";
}

export function HeroineCreatePage() {
  const { postAuthedJson, refreshSession, session } = useAuth();
  const navigate = useNavigate();
  const allowNavigationRef = useRef(false);
  const [state, setState] = useState<HeroineLoadState>("ready");
  const [status, setStatus] = useState("새 히로인 기본 설정을 입력하세요.");
  const [draft, setDraft] = useState<HeroineDraft>(() => createEmptyHeroineDraft());
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [stagedPortraitRef, setStagedPortraitRef] = useState<HeroineLibraryResult["stagedPortraitRef"]>();
  const emptyDraft = useMemo(() => createEmptyHeroineDraft(), []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(emptyDraft);
  const validationIssues = validateHeroineDraft(draft, "create");
  const idConflict = Boolean(draft.id.trim() && existingIds.includes(draft.id.trim()));
  const allIssues = idConflict ? [...validationIssues, "이미 같은 히로인 ID가 있습니다."] : validationIssues;
  const canSave = allIssues.length === 0 && !state.includes("saving");
  const actionSummary = allIssues.length > 0
    ? `필수값을 모두 입력해야 저장할 수 있습니다. ${allIssues.join(" ")}`
    : "저장하려면 이름, 설명, 성격, 말투, 외형 설명을 입력해야 합니다. ID는 이름으로 자동 제안됩니다.";

  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    dirty
    && !allowNavigationRef.current
    && currentLocation.pathname !== nextLocation.pathname
  ));

  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("저장하지 않은 히로인 draft가 있습니다. 페이지를 떠나시겠습니까?")) {
        allowNavigationRef.current = true;
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useBeforeUnload(useCallback((event) => {
    if (dirty && !allowNavigationRef.current) {
      event.preventDefault();
    }
  }, [dirty]));

  useEffect(() => {
    void listHeroines(postAuthedJson).then((result) => {
      if (result.ok !== false) {
        setExistingIds((result.heroines || []).map((heroine) => heroine.id));
      }
    });
  }, [postAuthedJson]);

  async function save(): Promise<void> {
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
    navigate(`/heroines/${encodeURIComponent(result.heroine?.id || draft.id)}`);
  }

  async function generatePortrait(): Promise<void> {
    setState("saving");
    setStatus("기본 포트레이트를 생성하는 중입니다.");
    const result = await generateHeroinePortrait(postAuthedJson, { draft });
    if (result.ok === false) {
      setState("ready");
      setStatus(`기본 포트레이트를 준비하지 못했습니다. 기본 정보는 저장할 수 있습니다. ${failureText(result, "다시 시도하세요.")}`);
      return;
    }
    setDraft({
      ...draft,
      defaultPortraitAssetId: result.asset?.id || draft.defaultPortraitAssetId,
      defaultPortraitUri: result.stagedPortraitRef?.previewUri || result.asset?.uri || draft.defaultPortraitUri
    });
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
    <section className="app-page heroine-page" aria-labelledby="heroineCreateTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">New Heroine</p>
          <h1 id="heroineCreateTitle">새 히로인 만들기</h1>
          <p>라이브러리 원본 히로인을 생성합니다. 포트레이트 없이도 기본 정보는 저장할 수 있습니다.</p>
        </div>
        <div className="page-primary-action">
          <span>저장 성공 시 상세보기로 이동합니다.</span>
        </div>
      </header>

      <StatusBanner tone={statusTone(state)}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      <section className="heroine-editor-layout">
        <article className="page-panel heroine-editor-main">
          <HeroineFormPanel draft={draft} mode="create" onChange={setDraft} />
        </article>
        <HeroinePortraitPanel
          busy={state === "saving"}
          heroine={draft}
          onGenerate={() => void generatePortrait()}
          onRefreshSession={() => void refreshSession()}
          session={session}
        />
      </section>

      <HeroineActionBar
        canSave={canSave}
        dirty={dirty}
        onCancel={cancel}
        onSave={() => void save()}
        saving={state === "saving"}
        summary={actionSummary}
      />
    </section>
  );
}
