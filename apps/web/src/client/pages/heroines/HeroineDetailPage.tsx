import { ArrowLeft, Database, Edit3, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { ActionPanel, Button, DiagnosticDrawer, EntitySummaryHeader, StatusBanner, StatusChip, StatusRegion } from "../../components/ui";
import { createProjectFromHeroine, deleteHeroine, failureText, getHeroine } from "./heroineApi";
import { HeroineDeleteDialog, type HeroineDeleteConfirmation } from "./HeroineDeleteDialog";
import type { HeroineDraft, HeroineLoadState } from "./heroinePageTypes";

function statusTone(state: HeroineLoadState): "neutral" | "waiting" | "success" | "error" {
  if (state === "loading" || state === "deleting" || state === "saving") return "waiting";
  if (state === "error" || state === "notFound" || state === "conflict") return "error";
  return "neutral";
}

export function HeroineDetailPage() {
  const { postAuthedJson } = useAuth();
  const navigate = useNavigate();
  const { heroineId = "" } = useParams<{ heroineId: string }>();
  const [state, setState] = useState<HeroineLoadState>("loading");
  const [status, setStatus] = useState("히로인 정보를 불러오는 중입니다.");
  const [heroine, setHeroine] = useState<HeroineDraft | null>(null);
  const [heroineSourceProjectDirectory, setHeroineSourceProjectDirectory] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setStatus("히로인 정보를 불러오는 중입니다.");
    const result = await getHeroine(postAuthedJson, heroineId);
    if (result.ok === false) {
      const notFound = result.code === "HEROINE_NOT_FOUND";
      setState(notFound ? "notFound" : "error");
      setStatus(notFound ? "히로인을 찾을 수 없습니다." : `히로인 정보를 불러오지 못했습니다. ${failureText(result, "다시 시도하세요.")}`);
      setHeroine(null);
      setHeroineSourceProjectDirectory("");
      return;
    }
    setHeroineSourceProjectDirectory(result.projectDirectory || "");
    setHeroine({
      ...result.heroine!,
      heroineRevision: result.heroineRevision
    });
    setState("ready");
    setStatus("히로인 원본 정보를 확인하세요.");
  }, [heroineId, postAuthedJson]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete(target: HeroineDraft, confirmation: HeroineDeleteConfirmation): Promise<void> {
    setState("deleting");
    setDeleteError("");
    const result = await deleteHeroine(postAuthedJson, target, confirmation, target.heroineRevision);
    if (result.ok === false) {
      setState(result.code === "HEROINE_REVISION_CONFLICT" ? "conflict" : "ready");
      setDeleteError(failureText(result, "히로인 삭제 실패"));
      return;
    }
    navigate("/heroines");
  }

  async function createProject(): Promise<void> {
    if (!heroine) return;
    setState("saving");
    setStatus("히로인 기반 프로젝트 생성 중입니다.");
    const result = await createProjectFromHeroine(postAuthedJson, heroine, heroineSourceProjectDirectory);
    if (result.ok === false) {
      setState("ready");
      setStatus(`히로인 기반 프로젝트 생성 실패: ${failureText(result, "다시 시도하세요.")}`);
      return;
    }
    navigate(result.targetRoute || `/projects/${result.projectId || ""}/overview`);
  }

  return (
    <section className="app-page heroine-page" aria-labelledby="heroineDetailTitle">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Heroine Detail</p>
          <h1 id="heroineDetailTitle">{heroine?.name || "히로인 상세"}</h1>
          <p>이 화면은 라이브러리 원본 히로인을 확인합니다.</p>
        </div>
      </header>

      <StatusRegion>
        <StatusBanner tone={statusTone(state)}>
          <span className="page-status">{status}</span>
        </StatusBanner>
      </StatusRegion>

      {state === "notFound" ? (
        <section className="page-panel">
          <h2>히로인을 찾을 수 없습니다.</h2>
          <p className="page-muted">요청한 원본 히로인이 라이브러리에 없습니다.</p>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/heroines")}>
            목록으로 돌아가기
          </Button>
        </section>
      ) : null}

      {state === "error" ? (
        <div className="panel-actions">
          <Button icon={<RefreshCw size={16} />} onClick={() => void load()}>다시 시도</Button>
        </div>
      ) : null}

      {heroine && (state === "ready" || state === "saving" || state === "deleting" || state === "conflict") ? (
        <section className="heroine-detail-layout">
          <article className="page-panel">
            <EntitySummaryHeader
              eyebrow="Library Source"
              title={heroine.name}
              status={<StatusChip tone={heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0] ? "success" : "neutral"}>{heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0] ? "포트레이트 있음" : "원본 정보"}</StatusChip>}
              description={heroine.description}
              primaryAction={(
                <Button disabled={state === "saving"} icon={<Database size={16} />} onClick={() => void createProject()} variant="primary">
                  히로인 기반 프로젝트 생성
                </Button>
              )}
              actions={(
                <Button icon={<Edit3 size={16} />} onClick={() => navigate(`/heroines/${encodeURIComponent(heroine.id)}/edit`)}>
                  수정
                </Button>
              )}
            />
            <h2>캐릭터 정의</h2>
            <dl className="summary-list detail-summary">
              <div><dt>성격</dt><dd>{heroine.personality}</dd></div>
              <div><dt>말투</dt><dd>{heroine.speechStyle}</dd></div>
              <div><dt>외형 설명</dt><dd>{heroine.appearance}</dd></div>
              <div><dt>마지막 수정</dt><dd>{heroine.updatedAt || "기록 없음"}</dd></div>
            </dl>
            <div className="inline-status">
              이 화면은 라이브러리 원본 히로인을 수정합니다. 이미 만든 프로젝트에 복사된 히로인 스냅샷은 자동으로 바뀌지 않습니다.
            </div>
            <DiagnosticDrawer summary="히로인 진단 정보">
              <dl className="summary-list detail-summary">
                <div><dt>내부 식별자</dt><dd>{heroine.id}</dd></div>
                <div><dt>revision</dt><dd>{heroine.heroineRevision?.value || "기록 없음"}</dd></div>
                <div><dt>기본 포트레이트 에셋</dt><dd>{heroine.defaultPortraitAssetId || "없음"}</dd></div>
              </dl>
            </DiagnosticDrawer>
          </article>
          <aside>
            <ActionPanel
              title="이동"
              description="목록으로 돌아가거나 라이브러리 원본을 수정합니다."
            >
            <div className="panel-actions vertical-actions">
              <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/heroines")}>
                목록으로 돌아가기
              </Button>
              <Button icon={<Edit3 size={16} />} onClick={() => navigate(`/heroines/${encodeURIComponent(heroine.id)}/edit`)}>
                수정
              </Button>
            </div>
            </ActionPanel>
            <ActionPanel
              title="위험 작업"
              description="삭제는 라이브러리 원본에 영향을 주며, 확인 dialog에서 영향 범위를 다시 확인합니다."
              tone="danger"
            >
            <div className="panel-actions vertical-actions">
              <Button disabled={state === "deleting"} icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)} variant="danger">
                삭제
              </Button>
            </div>
            </ActionPanel>
            <section className="page-panel">
              <h2>포트레이트</h2>
            {heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0] ? (
              <div className="preview-area portrait-preview">
                <img alt={`${heroine.name} 기본 포트레이트`} src={heroine.defaultPortraitUri || heroine.portraitAssetUris?.[0]} />
              </div>
            ) : (
              <div className="portrait-placeholder">기본 포트레이트가 없습니다.</div>
            )}
            </section>
          </aside>
        </section>
      ) : null}

      <HeroineDeleteDialog
        deleting={state === "deleting"}
        error={deleteError}
        heroine={deleteOpen ? heroine : null}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError("");
        }}
        onConfirm={(target, confirmation) => void confirmDelete(target, confirmation)}
        onReload={() => void load()}
      />
    </section>
  );
}
