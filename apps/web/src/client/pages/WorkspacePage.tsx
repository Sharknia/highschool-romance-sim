import { CheckCircle2, Code2, Database, FileDown, ImagePlus, LogOut, Play, RefreshCw, Save, Sparkles, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiResult, ImagePreviewResult } from "../api/types";
import { describeSession, useAuth } from "../auth/AuthProvider";
import { AppShell, Button, Panel, StatusBanner } from "../components/ui";

interface HeroineDraft {
  id?: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
}

interface RuntimeAsset {
  id: string;
  kind: string;
  label: string;
  uri?: string;
}

interface RuntimeScene {
  id: string;
  label: string;
  speaker: string;
  text: string;
  characters: Array<{ characterId: string; asset?: RuntimeAsset }>;
  choices: Array<{ id: string; text: string; next: string }>;
  next?: string;
  backgroundAsset?: RuntimeAsset;
  cgAsset?: RuntimeAsset;
}

interface RuntimeData {
  startSceneId: string;
  scenes: RuntimeScene[];
}

interface PendingPatch {
  request: unknown;
  plan: {
    summary?: string;
    decision?: {
      sceneCount?: number;
      choiceCount?: number;
      cgCount?: number;
    };
    patch?: unknown;
  };
  validation?: {
    ok?: boolean;
    issues?: Array<{ path: string; message: string; severity: string }>;
  };
  diff?: {
    text?: string;
    operations?: string[];
  };
}

const starterProject = {
  id: "web-starter",
  title: "웹 제작툴 샘플",
  premise: "Codex와 함께 미연시를 제작하는 첫 프로젝트"
};

const defaultHeroine: HeroineDraft = {
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 조용한 같은 반 학생.",
  personality: "차분하지만 당황하면 솔직한 반응이 먼저 나온다.",
  speechStyle: "짧고 조심스럽게 말한다.",
  appearance: "단정한 교복, 어깨까지 오는 검은 머리, 연한 분홍색 머리핀.",
  defaultPortraitAssetId: "asset-haru-portrait"
};

function formatResult(result: unknown): string {
  return JSON.stringify(result, (key, value) => {
    if ((key === "b64Json" || key === "dataUrl" || key === "result" || key === "html") && typeof value === "string" && value.length > 180) {
      return `${value.slice(0, 180)}... (${value.length} chars)`;
    }
    return value;
  }, 2);
}

function truncateArtifactHtml(result: ApiResult): ApiResult {
  const artifact = result.artifact;
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return result;
  }

  const artifactRecord = artifact as { html?: string };
  if (!artifactRecord.html || artifactRecord.html.length <= 1200) {
    return result;
  }

  return {
    ...result,
    artifact: {
      ...artifactRecord,
      html: `${artifactRecord.html.slice(0, 1200)}\n...`
    }
  };
}

function isHttpFailure(result: unknown): result is ApiResult {
  return Boolean(
    result
      && typeof result === "object"
      && "httpStatus" in result
      && typeof (result as ApiResult).httpStatus === "number"
      && ((result as ApiResult).httpStatus || 0) >= 400
  );
}

function projectPayloadFromEditor(projectJson: string): { project?: unknown; starter?: unknown } {
  const parsed = JSON.parse(projectJson) as Record<string, unknown>;
  return parsed.version === "vn-maker/v1"
    ? { project: parsed }
    : { starter: parsed.starter || parsed };
}

function projectFromJson(projectJson: string): Record<string, unknown> | null {
  try {
    const payload = projectPayloadFromEditor(projectJson);
    return payload.project && typeof payload.project === "object" ? payload.project as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function getProjectRoute(project: Record<string, unknown> | null): Record<string, unknown> | null {
  const routes = Array.isArray(project?.routes) ? project.routes : [];
  return routes[0] && typeof routes[0] === "object" ? routes[0] as Record<string, unknown> : null;
}

function getPlannedCgJob(project: Record<string, unknown> | null): Record<string, unknown> | null {
  const jobs = Array.isArray(project?.generationJobs) ? project.generationJobs : [];
  const job = jobs.find((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return record.kind === "cg" && record.status === "planned";
  });
  return job && typeof job === "object" ? job as Record<string, unknown> : null;
}

export function WorkspacePage() {
  const { logout, postAuthedJson, refreshSession, session } = useAuth();
  const [projectJson, setProjectJson] = useState(() => JSON.stringify({ starter: starterProject }, null, 2));
  const [projectDirectory, setProjectDirectory] = useState("");
  const [heroineDraft, setHeroineDraft] = useState<HeroineDraft>(defaultHeroine);
  const [heroines, setHeroines] = useState<HeroineDraft[]>([]);
  const [selectedHeroineId, setSelectedHeroineId] = useState(defaultHeroine.id || "");
  const [prompt, setPrompt] = useState("하루와 도서관에서 있던 일이야.\n하루가 책을 떨어트리고, 내가 책을 주워주려다가 두 사람의 손이 겹쳐.\n둘 다 당황해서 어색해지는 짧은 러브코미디 이벤트로 만들어줘.\n씬은 3개, CG는 1개만 만들어줘.");
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);
  const [runtime, setRuntime] = useState<RuntimeData | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState("");
  const [result, setResult] = useState("{}");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState("작업 대기 중");

  const project = useMemo(() => projectFromJson(projectJson), [projectJson]);
  const route = useMemo(() => getProjectRoute(project), [project]);
  const scene = useMemo(() => {
    if (!runtime) {
      return null;
    }
    const sceneId = currentSceneId || runtime.startSceneId;
    return runtime.scenes.find((item) => item.id === sceneId) || runtime.scenes.find((item) => item.id === runtime.startSceneId) || null;
  }, [currentSceneId, runtime]);

  function updateHeroineField(field: keyof HeroineDraft, value: string): void {
    setHeroineDraft((current) => ({ ...current, [field]: value }));
  }

  function applyActionResult(actionResult: unknown): void {
    if (actionResult && typeof actionResult === "object") {
      const record = actionResult as ApiResult;
      if (typeof record.projectDirectory === "string") {
        setProjectDirectory(record.projectDirectory);
      }
      if (record.project) {
        setProjectJson(JSON.stringify(record.project, null, 2));
      }
      if (Array.isArray(record.heroines)) {
        setHeroines(record.heroines as HeroineDraft[]);
      }
      if (record.heroine && typeof record.heroine === "object") {
        const heroine = record.heroine as HeroineDraft;
        setHeroineDraft(heroine);
        setSelectedHeroineId(heroine.id || heroine.name);
      }
      if (record.runtime && typeof record.runtime === "object") {
        const runtimeData = record.runtime as RuntimeData;
        setRuntime(runtimeData);
        setCurrentSceneId(runtimeData.startSceneId);
      }
    }
  }

  async function runAction(label: string, action: () => Promise<unknown>): Promise<unknown> {
    setWorkspaceStatus(`${label} 실행 중`);
    try {
      const actionResult = await action();
      if (isHttpFailure(actionResult)) {
        throw new Error(actionResult.error || `${label} 요청이 실패했습니다.`);
      }
      applyActionResult(actionResult);
      setResult(formatResult(actionResult));
      setWorkspaceStatus(`${label} 완료`);
      return actionResult;
    } catch (error) {
      const failure = { ok: false, error: error instanceof Error ? error.message : String(error) };
      setResult(formatResult(failure));
      setWorkspaceStatus(`${label} 실패`);
      return failure;
    }
  }

  async function loadHeroineLibrary(): Promise<void> {
    await runAction("히로인 목록", async () => postAuthedJson<ApiResult>("/api/heroines/list", {
      projectDirectory: projectDirectory || undefined
    }));
  }

  async function saveHeroine(): Promise<void> {
    await runAction("히로인 저장", async () => postAuthedJson<ApiResult>("/api/heroines/save", {
      projectDirectory: projectDirectory || undefined,
      heroine: heroineDraft
    }));
  }

  async function deleteSelectedHeroine(): Promise<void> {
    await runAction("히로인 삭제", async () => postAuthedJson<ApiResult>("/api/heroines/delete", {
      projectDirectory: projectDirectory || undefined,
      heroineId: selectedHeroineId
    }));
  }

  async function createProjectFromSelectedHeroine(): Promise<void> {
    await runAction("히로인 프로젝트 생성", async () => postAuthedJson<ApiResult>("/api/projects/from-heroine", {
      projectDirectory: projectDirectory || undefined,
      heroine: heroineDraft,
      title: `${heroineDraft.name} Alpha`,
      premise: `${heroineDraft.name}와 도서관에서 시작하는 Alpha 루트`
    }));
  }

  async function createStarterProject(): Promise<void> {
    await runAction("샘플 프로젝트 생성", async () => {
      return postAuthedJson<ApiResult>("/api/project/starter", { projectDirectory: projectDirectory || undefined, starter: starterProject });
    });
  }

  async function openProject(): Promise<void> {
    await runAction("프로젝트 열기", async () => postAuthedJson<ApiResult>("/api/project/open", {
      projectDirectory: projectDirectory || undefined
    }));
  }

  async function validateProject(): Promise<void> {
    await runAction("프로젝트 검증", async () => {
      return postAuthedJson<ApiResult>("/api/project/validate", {
        projectDirectory: projectDirectory || undefined,
        ...projectPayloadFromEditor(projectJson)
      });
    });
  }

  async function buildProject(): Promise<void> {
    await runAction("프로젝트 빌드", async () => {
      return truncateArtifactHtml(await postAuthedJson<ApiResult>("/api/project/build", {
        projectDirectory: projectDirectory || undefined,
        ...projectPayloadFromEditor(projectJson)
      }));
    });
  }

  async function expandEvent(): Promise<void> {
    const response = await runAction("이벤트 패치 제안", async () => {
      const routeId = typeof route?.id === "string" ? route.id : undefined;
      const heroineId = typeof route?.heroineId === "string" ? route.heroineId : heroineDraft.id;
      const afterSceneId = currentSceneId || (typeof route?.entrySceneId === "string" ? route.entrySceneId : undefined);
      return postAuthedJson<ApiResult>("/api/events/expand", {
        projectDirectory: projectDirectory || undefined,
        userEvent: prompt,
        routeId,
        heroineId,
        afterSceneId
      });
    });
    if (response && typeof response === "object" && (response as ApiResult).ok) {
      setPendingPatch(response as PendingPatch);
    }
  }

  async function approveEvent(): Promise<void> {
    if (!pendingPatch) {
      return;
    }
    await runAction("이벤트 패치 승인", async () => postAuthedJson<ApiResult>("/api/events/approve", {
      projectDirectory: projectDirectory || undefined,
      request: pendingPatch.request,
      plan: pendingPatch.plan
    }));
    setPendingPatch(null);
  }

  async function previewProject(startSceneId?: string): Promise<void> {
    await runAction("플레이 프리뷰", async () => postAuthedJson<ApiResult>("/api/project/preview", {
      projectDirectory: projectDirectory || undefined,
      startSceneId
    }));
  }

  async function exportProject(): Promise<void> {
    await runAction("웹 플레이어 export", async () => postAuthedJson<ApiResult>("/api/project/export", {
      projectDirectory: projectDirectory || undefined
    }));
  }

  async function generatePlannedCg(): Promise<void> {
    const plannedJob = getPlannedCgJob(project);
    if (!plannedJob) {
      setResult(formatResult({ ok: false, error: "planned 상태의 CG 작업이 없습니다." }));
      setWorkspaceStatus("CG 생성 실패");
      return;
    }

    setPreviewSrc(null);
    await runAction("CG 이미지 생성", async () => {
      const response = await postAuthedJson<ApiResult & ImagePreviewResult>("/api/generation/images", {
        projectDirectory: projectDirectory || undefined,
        kind: "cg",
        targetId: plannedJob.targetId,
        jobId: plannedJob.id,
        outputAssetId: plannedJob.outputAssetId,
        prompt: plannedJob.prompt,
        style: plannedJob.style
      });
      setPreviewSrc(response.image?.dataUrl || response.image?.uri || response.asset?.uri || null);
      await refreshSession();
      return response;
    });
  }

  async function generatePortrait(): Promise<void> {
    setPreviewSrc(null);
    await runAction("기본 포트레이트 생성", async () => {
      const response = await postAuthedJson<ApiResult & ImagePreviewResult>("/api/generation/images", {
        projectDirectory: projectDirectory || undefined,
        kind: "portrait",
        targetId: heroineDraft.id || heroineDraft.name,
        outputAssetId: heroineDraft.defaultPortraitAssetId || `asset-${heroineDraft.id || heroineDraft.name}-portrait`,
        prompt: `${heroineDraft.name}, ${heroineDraft.appearance}, clean visual novel heroine portrait`,
        style: "soft, polished, romance visual novel portrait"
      });
      setPreviewSrc(response.image?.dataUrl || response.image?.uri || response.asset?.uri || null);
      await refreshSession();
      return response;
    });
  }

  async function handleLogout(): Promise<void> {
    await logout();
  }

  const patchCanApply = Boolean(pendingPatch?.validation?.ok);

  return (
    <AppShell
      actions={(
        <>
          <span className="topbar-status">{describeSession(session)}</span>
          <Button icon={<RefreshCw size={16} />} onClick={() => void refreshSession()} variant="ghost">상태 갱신</Button>
          <Button icon={<LogOut size={16} />} onClick={() => void handleLogout()} variant="secondary">로그아웃</Button>
        </>
      )}
    >
      <main className="workspace-layout">
        <aside className="side-column">
          <Panel eyebrow="Heroine" title="히로인 라이브러리">
            <input
              aria-label="프로젝트 디렉터리"
              className="project-path-input"
              onChange={(event) => setProjectDirectory(event.target.value)}
              placeholder="프로젝트 디렉터리 자동 생성"
              value={projectDirectory}
            />
            <div className="field-grid">
              <input aria-label="히로인 ID" value={heroineDraft.id || ""} onChange={(event) => updateHeroineField("id", event.target.value)} />
              <input aria-label="히로인 이름" value={heroineDraft.name} onChange={(event) => updateHeroineField("name", event.target.value)} />
              <input aria-label="기본 포트레이트 에셋" value={heroineDraft.defaultPortraitAssetId || ""} onChange={(event) => updateHeroineField("defaultPortraitAssetId", event.target.value)} />
            </div>
            <textarea aria-label="히로인 설명" value={heroineDraft.description} onChange={(event) => updateHeroineField("description", event.target.value)} />
            <textarea aria-label="히로인 성격" value={heroineDraft.personality} onChange={(event) => updateHeroineField("personality", event.target.value)} />
            <textarea aria-label="히로인 말투와 외형" value={`${heroineDraft.speechStyle}\n${heroineDraft.appearance}`} onChange={(event) => {
              const [speechStyle = "", ...appearance] = event.target.value.split("\n");
              setHeroineDraft((current) => ({ ...current, speechStyle, appearance: appearance.join("\n") }));
            }} />
            <div className="button-row">
              <Button icon={<RefreshCw size={17} />} onClick={() => void loadHeroineLibrary()}>목록</Button>
              <Button icon={<Save size={17} />} onClick={() => void saveHeroine()} variant="primary">저장</Button>
              <Button icon={<ImagePlus size={17} />} onClick={() => void generatePortrait()}>포트레이트 생성</Button>
              <Button icon={<Trash2 size={17} />} onClick={() => void deleteSelectedHeroine()}>삭제</Button>
              <Button icon={<Database size={17} />} onClick={() => void createProjectFromSelectedHeroine()}>프로젝트 생성</Button>
            </div>
            <div className="heroine-list">
              {heroines.map((heroine) => (
                <button
                  className={selectedHeroineId === heroine.id ? "list-item selected" : "list-item"}
                  key={heroine.id || heroine.name}
                  onClick={() => {
                    setHeroineDraft(heroine);
                    setSelectedHeroineId(heroine.id || heroine.name);
                  }}
                  type="button"
                >
                  <strong>{heroine.name}</strong>
                  <span>{heroine.description}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Event" title="자연어 이벤트">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} wrap="soft" />
            <div className="button-row">
              <Button icon={<Sparkles size={17} />} onClick={() => void expandEvent()} variant="primary">패치 제안</Button>
              <Button disabled={!patchCanApply} icon={<CheckCircle2 size={17} />} onClick={() => void approveEvent()}>승인</Button>
              <Button disabled={!pendingPatch} icon={<XCircle size={17} />} onClick={() => setPendingPatch(null)}>취소</Button>
              <Button icon={<ImagePlus size={17} />} onClick={() => void generatePlannedCg()}>CG 생성</Button>
            </div>
            {pendingPatch ? (
              <div className="patch-summary">
                <strong>{pendingPatch.plan.summary}</strong>
                <span>씬 {pendingPatch.plan.decision?.sceneCount || 0} / 선택지 {pendingPatch.plan.decision?.choiceCount || 0} / CG {pendingPatch.plan.decision?.cgCount || 0}</span>
                <span>{pendingPatch.diff?.text}</span>
                <ul>
                  {(pendingPatch.diff?.operations || []).map((operation) => <li key={operation}>{operation}</li>)}
                </ul>
                {(pendingPatch.validation?.issues || []).length > 0 ? (
                  <ul>
                    {pendingPatch.validation?.issues?.map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.path}: {issue.message}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </aside>

        <section className="main-column">
          <Panel
            actions={(
              <>
                <Button icon={<Play size={17} />} onClick={() => void previewProject()}>처음부터</Button>
                <Button icon={<Play size={17} />} onClick={() => void previewProject(currentSceneId)}>현재 씬</Button>
                <Button icon={<FileDown size={17} />} onClick={() => void exportProject()} variant="primary">Export</Button>
              </>
            )}
            eyebrow="Preview"
            title="플레이 프리뷰"
          >
            <StatusBanner tone={runtime?.scenes?.length ? "success" : "neutral"}>{workspaceStatus}</StatusBanner>
            {scene ? (
              <div className="player-preview">
                <div className="player-images">
                  {scene.backgroundAsset?.uri ? <img alt={scene.backgroundAsset.label} src={scene.backgroundAsset.uri} /> : null}
                  {scene.characters.map((character) => character.asset?.uri ? <img alt={character.characterId} key={`${scene.id}-${character.characterId}`} src={character.asset.uri} /> : null)}
                  {scene.cgAsset?.uri ? <img alt={scene.cgAsset.label} src={scene.cgAsset.uri} /> : null}
                </div>
                <div className="player-dialogue">
                  <span>{scene.label}</span>
                  <strong>{scene.speaker}</strong>
                  <p>{scene.text}</p>
                </div>
                <div className="player-choices">
                  {scene.choices.map((choice) => (
                    <Button key={choice.id} onClick={() => setCurrentSceneId(choice.next)}>{choice.text}</Button>
                  ))}
                  {scene.choices.length === 0 && scene.next ? (
                    <Button onClick={() => setCurrentSceneId(scene.next || "")}>다음</Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {previewSrc ? (
              <div className="preview-area">
                <img alt="생성 이미지 미리보기" src={previewSrc} />
              </div>
            ) : null}
          </Panel>

          <Panel
            actions={(
              <>
                <Button icon={<Sparkles size={17} />} onClick={() => void createStarterProject()}>샘플</Button>
                <Button icon={<Database size={17} />} onClick={() => void openProject()}>열기</Button>
                <Button icon={<CheckCircle2 size={17} />} onClick={() => void validateProject()} variant="primary">검증</Button>
                <Button icon={<Code2 size={17} />} onClick={() => void buildProject()}>HTML</Button>
              </>
            )}
            eyebrow="Project"
            title="프로젝트 JSON"
          >
            <textarea className="project-editor" value={projectJson} onChange={(event) => setProjectJson(event.target.value)} wrap="soft" />
          </Panel>

          <Panel eyebrow="Result" title="결과">
            <pre>{result}</pre>
          </Panel>
        </section>
      </main>
    </AppShell>
  );
}
