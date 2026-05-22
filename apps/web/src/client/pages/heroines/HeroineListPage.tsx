import { Heart, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { Button, ContentList, StatusBanner } from "../../components/ui";
import { deleteHeroine, failureText, listHeroines } from "./heroineApi";
import { HeroineDeleteDialog, type HeroineDeleteConfirmation } from "./HeroineDeleteDialog";
import type { HeroineDraft, HeroineListState } from "./heroinePageTypes";

function statusTone(state: HeroineListState): "neutral" | "waiting" | "success" | "error" {
  if (state === "loading" || state === "deleting") return "waiting";
  if (state === "error") return "error";
  return "neutral";
}

function formatUpdatedAt(value?: string): string {
  if (!value) {
    return "수정 시각 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function HeroineListPage() {
  const { postAuthedJson } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<HeroineListState>("loading");
  const [status, setStatus] = useState("히로인 목록을 불러오는 중입니다.");
  const [heroines, setHeroines] = useState<HeroineDraft[]>([]);
  const [count, setCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<HeroineDraft | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async (): Promise<HeroineDraft[] | null> => {
    setState("loading");
    setStatus("히로인 목록을 불러오는 중입니다.");
    const result = await listHeroines(postAuthedJson);
    if (result.ok === false) {
      setState("error");
      setStatus(`히로인 목록을 불러오지 못했습니다. ${failureText(result, "저장소 상태를 확인한 뒤 다시 시도하세요.")}`);
      return null;
    }
    const nextHeroines = result.heroines || [];
    setHeroines(nextHeroines);
    setCount(result.count ?? nextHeroines.length);
    setState(nextHeroines.length > 0 ? "ready" : "empty");
    setStatus(nextHeroines.length > 0
      ? "최근 수정한 히로인부터 표시합니다. 카드를 선택해 상세 정보를 확인하세요."
      : "아직 히로인이 없습니다.");
    return nextHeroines;
  }, [postAuthedJson]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete(heroine: HeroineDraft, confirmation: HeroineDeleteConfirmation): Promise<void> {
    setState("deleting");
    setDeleteError("");
    const result = await deleteHeroine(postAuthedJson, heroine, confirmation, heroine.heroineRevision);
    if (result.ok === false) {
      setState("ready");
      setDeleteError(failureText(result, "히로인 삭제 실패"));
      return;
    }
    setDeleteTarget(null);
    setHeroines(result.heroines || []);
    setCount(result.heroines?.length ?? 0);
    setState(result.heroines && result.heroines.length > 0 ? "ready" : "empty");
    setStatus("히로인을 삭제하는 중입니다. 삭제 후 최근 수정순 목록을 갱신했습니다.");
  }

  async function reloadDeleteTarget(): Promise<void> {
    const targetId = deleteTarget?.id;
    const nextHeroines = await load();
    if (!targetId || !nextHeroines) {
      return;
    }
    const refreshedDeleteTarget = nextHeroines.find((heroine) => heroine.id === targetId);
    setDeleteError("");
    if (refreshedDeleteTarget) {
      setDeleteTarget(refreshedDeleteTarget);
      setStatus("최신 히로인 정보를 불러왔습니다. 삭제 확인값을 다시 입력하세요.");
      return;
    }
    setDeleteTarget(null);
    setStatus("대상 히로인이 이미 목록에서 사라져 삭제 dialog를 닫았습니다.");
  }

  return (
    <section className="app-page heroine-page" aria-labelledby="heroinesTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Heroines</p>
          <h1 id="heroinesTitle">히로인 관리</h1>
          <p>라이브러리 원본 히로인을 최근 수정순으로 확인하고 상세 정보로 이동합니다.</p>
        </div>
        <div className="page-primary-action">
          <span>총 히로인 {count}명 · 최근 수정순 고정 정렬</span>
          <Button icon={<Plus size={18} />} onClick={() => navigate("/heroines/new")} variant="primary">
            새 히로인 만들기
          </Button>
        </div>
      </header>

      <StatusBanner tone={statusTone(state)}>
        <span className="page-status">{status}</span>
      </StatusBanner>

      {state === "error" ? (
        <div className="panel-actions">
          <Button icon={<RefreshCw size={16} />} onClick={() => void load()}>다시 시도</Button>
        </div>
      ) : null}

      {state === "empty" ? (
        <section className="page-panel">
          <div className="page-panel-icon"><Heart size={18} /></div>
          <h2>아직 히로인이 없습니다.</h2>
          <p className="page-muted">첫 히로인 만들기로 라이브러리 원본을 준비하세요.</p>
          <div className="panel-actions">
            <Button icon={<Plus size={16} />} onClick={() => navigate("/heroines/new")} variant="primary">
              첫 히로인 만들기
            </Button>
          </div>
        </section>
      ) : null}

      {state === "ready" || state === "deleting" ? (
        <ContentList
          ariaLabel="히로인 목록"
          items={heroines.map((heroine) => {
            const portraitUri = heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0];
            return {
              id: heroine.id,
              leading: portraitUri ? (
                <img alt={`${heroine.name} 기본 포트레이트`} className="content-list-thumbnail" src={portraitUri} />
              ) : (
                <span className="content-list-thumbnail content-list-thumbnail-placeholder">{heroine.name.slice(0, 1) || "H"}</span>
              ),
              title: heroine.name,
              description: heroine.summary || heroine.description,
              meta: formatUpdatedAt(heroine.updatedAt),
              onSelect: () => navigate(`/heroines/${encodeURIComponent(heroine.id)}`),
              actions: (
                <button
                  aria-label={`${heroine.name} 삭제`}
                  className="icon-button icon-button-danger"
                  onClick={() => setDeleteTarget(heroine)}
                  type="button"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              )
            };
          })}
        />
      ) : null}

      <HeroineDeleteDialog
        deleting={state === "deleting"}
        error={deleteError}
        heroine={deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={(heroine, confirmation) => void confirmDelete(heroine, confirmation)}
        onReload={() => void reloadDeleteTarget()}
      />
    </section>
  );
}
