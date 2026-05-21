import {
  CheckCircle2,
  Code2,
  Copy,
  Database,
  FileDown,
  History,
  ImagePlus,
  ListChecks,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Tags,
  Trash2,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiResult, ImagePreviewResult } from "../api/types";
import { describeSession, useAuth } from "../auth/AuthProvider";
import { AppShell, Button, StatusBanner } from "../components/ui";

interface HeroineDraft {
  id?: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
  portraitAssetIds?: string[];
  expressionAssetIds?: Record<string, string>;
  tags?: string[];
  reuseHistory?: Array<{
    projectId: string;
    projectTitle: string;
    snapshotCreatedAt: string;
  }>;
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
  characters: Array<{ characterId: string; expression?: string; asset?: RuntimeAsset; position?: string }>;
  choices: Array<{ id: string; text: string; next: string }>;
  next?: string;
  backgroundAsset?: RuntimeAsset;
  cgAsset?: RuntimeAsset;
}

interface RuntimeData {
  startSceneId: string;
  scenes: RuntimeScene[];
}

interface ProjectData {
  id: string;
  title: string;
  premise: string;
  characters: Array<{
    id: string;
    displayName: string;
    emotionTags?: string[];
    expressionAssetIds?: Record<string, string>;
    sourceHeroineId?: string;
    sourceHeroineName?: string;
    sourceSnapshotCreatedAt?: string;
  }>;
  routes: Array<{ id: string; title: string; heroineId: string; entrySceneId: string }>;
  scenes: SceneDraft[];
  assets: RuntimeAsset[];
  generationJobs: GenerationJob[];
}

interface SceneDraft {
  id: string;
  label: string;
  speaker: string;
  text: string;
  characters: Array<{ characterId: string; expression?: string; assetId?: string; position?: "left" | "center" | "right" }>;
  choices: Array<{ id: string; text: string; next: string }>;
  next?: string;
  backgroundAssetId?: string;
  cgAssetId?: string;
}

interface GenerationJob {
  id: string;
  kind: string;
  targetId: string;
  prompt: string;
  style?: string;
  provider: string;
  status: "planned" | "running" | "completed" | "failed";
  outputAssetId?: string;
  failureMessage?: string;
  asset?: RuntimeAsset;
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
    patch?: { operations?: Array<Record<string, unknown>> };
  };
  validation?: {
    ok?: boolean;
    issues?: Array<{ path: string; message: string; severity: string }>;
  };
  diff?: {
    text?: string;
    operations?: string[];
  };
  patchHistoryEntry?: PatchHistoryEntry;
}

interface PatchHistoryEntry {
  id: string;
  status: "proposed" | "applied" | "failed";
  summary: string;
  validationIssues: Array<{ path: string; message: string; severity: string }>;
  attempts?: Array<{ attempt: number; ok: boolean; failureKind?: string; issues?: string[] }>;
  diff?: {
    text?: string;
    operations?: string[];
  };
  beforeSummary?: string;
  afterSummary?: string;
  revertedAt?: string;
  rawOutput?: unknown;
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
  defaultPortraitAssetId: "asset-haru-portrait",
  tags: ["library", "quiet"]
};

function formatResult(result: unknown): string {
  return JSON.stringify(result, (key, value) => {
    if ((key === "b64Json" || key === "dataUrl" || key === "result" || key === "html" || key === "rawOutput") && typeof value === "string" && value.length > 180) {
      return `${value.slice(0, 180)}... (${value.length} chars)`;
    }
    return value;
  }, 2);
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

function cloneScene(scene: SceneDraft): SceneDraft {
  return JSON.parse(JSON.stringify(scene)) as SceneDraft;
}

function jobTone(status: GenerationJob["status"]): string {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "waiting";
  return "neutral";
}

export function WorkspacePage() {
  const { logout, postAuthedJson, refreshSession, session } = useAuth();
  const [projectJson, setProjectJson] = useState(() => JSON.stringify({ starter: starterProject }, null, 2));
  const [projectDirectory, setProjectDirectory] = useState("");
  const [project, setProject] = useState<ProjectData | null>(null);
  const [heroineDraft, setHeroineDraft] = useState<HeroineDraft>(defaultHeroine);
  const [heroines, setHeroines] = useState<HeroineDraft[]>([]);
  const [selectedHeroineId, setSelectedHeroineId] = useState(defaultHeroine.id || "");
  const [heroineQuery, setHeroineQuery] = useState("");
  const [heroineTagFilter, setHeroineTagFilter] = useState("");
  const [heroineSort, setHeroineSort] = useState("name-asc");
  const [customTags, setCustomTags] = useState("embarrassed, festival_nervous");
  const [prompt, setPrompt] = useState("하루와 도서관에서 있던 일이야.\n하루가 책을 떨어트리고, 내가 책을 주워주려다가 두 사람의 손이 겹쳐.\n둘 다 당황해서 어색해지는 짧은 러브코미디 이벤트로 만들어줘.\n씬은 3개, CG는 1개만 만들어줘.");
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);
  const [patchHistory, setPatchHistory] = useState<PatchHistoryEntry[]>([]);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [runtime, setRuntime] = useState<RuntimeData | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [currentSceneId, setCurrentSceneId] = useState("");
  const [sceneDraft, setSceneDraft] = useState<SceneDraft | null>(null);
  const [result, setResult] = useState("{}");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState("작업 대기 중");
  const [lastExport, setLastExport] = useState<Record<string, unknown> | null>(null);

  const currentRoute = project?.routes.find((route) => route.id === selectedRouteId) || project?.routes[0] || null;
  const currentHeroine = project?.characters.find((character) => character.id === currentRoute?.heroineId) || null;
  const plannedJobCount = generationJobs.filter((job) => job.status === "planned").length;
  const failedJobCount = generationJobs.filter((job) => job.status === "failed").length;
  const patchCanApply = Boolean(pendingPatch?.validation?.ok);

  const scene = useMemo(() => {
    if (!runtime) {
      return null;
    }
    const sceneId = currentSceneId || runtime.startSceneId;
    return runtime.scenes.find((item) => item.id === sceneId) || runtime.scenes.find((item) => item.id === runtime.startSceneId) || null;
  }, [currentSceneId, runtime]);

  const workflowSteps = [
    { label: "시작", status: project ? "done" : "current" },
    { label: "히로인", status: currentHeroine ? "done" : project ? "current" : "blocked" },
    { label: "이벤트", status: pendingPatch ? "current" : project && project.scenes.length > 1 ? "done" : project ? "current" : "blocked" },
    { label: "에셋", status: plannedJobCount || failedJobCount ? "current" : generationJobs.some((job) => job.status === "completed") ? "done" : "blocked" },
    { label: "프리뷰", status: runtime ? "done" : project ? "current" : "blocked" },
    { label: "내보내기", status: lastExport ? "done" : project ? "current" : "blocked" }
  ];

  const nextAction = useMemo(() => {
    if (!project) {
      return { label: "샘플 프로젝트 생성", reason: "프로젝트가 아직 열리지 않았습니다.", run: () => void createStarterProject() };
    }
    if (!currentHeroine) {
      return { label: "선택 히로인으로 프로젝트 생성", reason: "프로젝트 스냅샷 히로인이 필요합니다.", run: () => void createProjectFromSelectedHeroine() };
    }
    if (pendingPatch) {
      return { label: "검증된 패치 승인", reason: patchCanApply ? "검증 통과 패치가 대기 중입니다." : "검증 실패 항목을 먼저 확인해야 합니다.", run: () => void approveEvent(), disabled: !patchCanApply };
    }
    if (plannedJobCount > 0) {
      return { label: "선택 이미지 작업 실행", reason: selectedJobIds.length > 0 ? "선택된 작업을 일괄 실행합니다." : "실행할 이미지 작업을 선택하세요.", run: () => void runSelectedGenerationJobs(), disabled: selectedJobIds.length === 0 };
    }
    if (!runtime) {
      return { label: "플레이 프리뷰 열기", reason: "현재 프로젝트를 제작 화면에서 확인합니다.", run: () => void previewProject() };
    }
    return { label: "웹 플레이어 export", reason: "검증과 smoke check를 포함해 산출물을 만듭니다.", run: () => void exportProject() };
  }, [project, currentHeroine, pendingPatch, patchCanApply, plannedJobCount, selectedJobIds.length, runtime]);

  function updateHeroineField(field: keyof HeroineDraft, value: string): void {
    setHeroineDraft((current) => {
      if (field === "tags") {
        return { ...current, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) };
      }
      return { ...current, [field]: value };
    });
  }

  function setProjectState(nextProject: ProjectData): void {
    setProject(nextProject);
    setProjectJson(JSON.stringify(nextProject, null, 2));
    setGenerationJobs(nextProject.generationJobs || []);
    setSelectedRouteId((current) => nextProject.routes.some((route) => route.id === current) ? current : nextProject.routes[0]?.id || "");
    if (!sceneDraft && nextProject.scenes[0]) {
      setSceneDraft(cloneScene(nextProject.scenes[0]));
      setCurrentSceneId(nextProject.scenes[0].id);
    }
  }

  function selectRoute(routeId: string): void {
    setSelectedRouteId(routeId);
    const route = project?.routes.find((item) => item.id === routeId);
    const entryScene = project?.scenes.find((item) => item.id === route?.entrySceneId);
    if (route?.entrySceneId) {
      setCurrentSceneId(route.entrySceneId);
    }
    if (entryScene) {
      setSceneDraft(cloneScene(entryScene));
    }
  }

  function applyActionResult(actionResult: unknown): void {
    if (actionResult && typeof actionResult === "object") {
      const record = actionResult as ApiResult;
      if (typeof record.projectDirectory === "string") {
        setProjectDirectory(record.projectDirectory);
      }
      if (record.project && typeof record.project === "object") {
        setProjectState(record.project as ProjectData);
      }
      if (Array.isArray(record.heroines)) {
        setHeroines(record.heroines as HeroineDraft[]);
      }
      if (record.heroine && typeof record.heroine === "object") {
        const heroine = record.heroine as HeroineDraft;
        setHeroineDraft(heroine);
        setSelectedHeroineId(heroine.id || heroine.name);
      }
      if (Array.isArray(record.jobs)) {
        setGenerationJobs(record.jobs as GenerationJob[]);
      }
      if (Array.isArray(record.entries)) {
        setPatchHistory(record.entries as PatchHistoryEntry[]);
      }
      if (record.runtime && typeof record.runtime === "object") {
        const runtimeData = record.runtime as RuntimeData;
        setRuntime(runtimeData);
        setCurrentSceneId(runtimeData.startSceneId);
      }
      if (record.export && typeof record.export === "object") {
        setLastExport(record as Record<string, unknown>);
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
    await runAction("히로인 검색", async () => postAuthedJson<ApiResult>("/api/heroines/list", {
      projectDirectory: projectDirectory || undefined,
      query: heroineQuery || undefined,
      tag: heroineTagFilter || undefined,
      sort: heroineSort
    }));
  }

  async function saveHeroine(): Promise<void> {
    await runAction("히로인 저장", async () => postAuthedJson<ApiResult>("/api/heroines/save", {
      projectDirectory: projectDirectory || undefined,
      heroine: heroineDraft
    }));
  }

  async function cloneSelectedHeroine(): Promise<void> {
    await runAction("히로인 복제", async () => postAuthedJson<ApiResult>("/api/heroines/clone", {
      projectDirectory: projectDirectory || undefined,
      sourceHeroineId: selectedHeroineId,
      newId: `${selectedHeroineId || heroineDraft.id}-copy`,
      name: `${heroineDraft.name} 변형`,
      tags: heroineDraft.tags || []
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
      heroineId: selectedHeroineId || undefined,
      heroine: selectedHeroineId ? undefined : heroineDraft,
      title: `${heroineDraft.name} Beta`,
      premise: `${heroineDraft.name}와 반복 제작을 검증하는 Beta 루트`
    }));
    await loadPatchHistory();
    await loadGenerationJobs();
  }

  async function createStarterProject(): Promise<void> {
    await runAction("샘플 프로젝트 생성", async () => postAuthedJson<ApiResult>("/api/project/starter", {
      projectDirectory: projectDirectory || undefined,
      starter: starterProject
    }));
    await loadGenerationJobs();
  }

  async function openProject(): Promise<void> {
    await runAction("프로젝트 열기", async () => postAuthedJson<ApiResult>("/api/project/open", {
      projectDirectory: projectDirectory || undefined
    }));
    await loadHeroineLibrary();
    await loadPatchHistory();
    await loadGenerationJobs();
  }

  async function validateProject(): Promise<void> {
    await runAction("프로젝트 검증", async () => postAuthedJson<ApiResult>("/api/project/validate", {
      projectDirectory: projectDirectory || undefined,
      ...projectPayloadFromEditor(projectJson)
    }));
  }

  async function planDefaultEmotionAssets(): Promise<void> {
    await runAction("기본 감정 에셋 5종 계획", async () => postAuthedJson<ApiResult>("/api/generation/default-emotions", {
      projectDirectory: projectDirectory || undefined,
      heroineId: currentHeroine?.id || selectedHeroineId || undefined
    }));
    await loadGenerationJobs();
  }

  async function planCustomExpressionAssets(): Promise<void> {
    await runAction("추가 태그 에셋 계획", async () => postAuthedJson<ApiResult>("/api/generation/expression-tags", {
      projectDirectory: projectDirectory || undefined,
      heroineId: currentHeroine?.id || selectedHeroineId || undefined,
      tags: customTags.split(",").map((tag) => tag.trim()).filter(Boolean)
    }));
    await loadGenerationJobs();
  }

  async function loadGenerationJobs(): Promise<void> {
    await runAction("이미지 작업 보드 갱신", async () => postAuthedJson<ApiResult>("/api/generation/jobs/list", {
      projectDirectory: projectDirectory || undefined
    }));
  }

  async function runSelectedGenerationJobs(): Promise<void> {
    setPreviewSrc(null);
    const response = await runAction("이미지 작업 일괄 실행", async () => postAuthedJson<ApiResult & ImagePreviewResult>("/api/generation/jobs/run", {
      projectDirectory: projectDirectory || undefined,
      jobIds: selectedJobIds,
      retryFailed: true
    }));
    if (response && typeof response === "object") {
      const record = response as { assets?: RuntimeAsset[] };
      const previewAsset = record.assets?.find((asset) => asset.uri);
      setPreviewSrc(previewAsset?.uri || null);
    }
    setSelectedJobIds([]);
    await refreshSession();
  }

  async function retryGenerationJob(jobId: string): Promise<void> {
    setSelectedJobIds([jobId]);
    await runAction("실패 작업 재시도", async () => postAuthedJson<ApiResult>("/api/generation/jobs/run", {
      projectDirectory: projectDirectory || undefined,
      jobIds: [jobId],
      retryFailed: true
    }));
    setSelectedJobIds([]);
  }

  async function replaceGenerationAsset(jobId: string): Promise<void> {
    setPreviewSrc(null);
    await runAction("생성 에셋 교체", async () => postAuthedJson<ApiResult>("/api/generation/jobs/run", {
      projectDirectory: projectDirectory || undefined,
      jobIds: [jobId],
      replaceCompleted: true
    }));
  }

  async function expandEvent(): Promise<void> {
    const response = await runAction("이벤트 패치 제안", async () => postAuthedJson<ApiResult>("/api/events/expand", {
      projectDirectory: projectDirectory || undefined,
      userEvent: prompt,
      routeId: currentRoute?.id || undefined,
      heroineId: currentRoute?.heroineId || undefined,
      afterSceneId: sceneDraft?.id || currentSceneId || undefined
    }));
    if (response && typeof response === "object" && (response as ApiResult).ok) {
      setPendingPatch(response as PendingPatch);
    }
    await loadPatchHistory();
  }

  async function approveEvent(): Promise<void> {
    if (!pendingPatch) {
      return;
    }
    await runAction("이벤트 패치 승인", async () => postAuthedJson<ApiResult>("/api/events/approve", {
      projectDirectory: projectDirectory || undefined,
      request: pendingPatch.request,
      plan: pendingPatch.plan,
      patchHistoryId: pendingPatch.patchHistoryEntry?.id
    }));
    setPendingPatch(null);
    await loadPatchHistory();
    await loadGenerationJobs();
  }

  async function loadPatchHistory(): Promise<void> {
    await runAction("패치 히스토리 갱신", async () => postAuthedJson<ApiResult>("/api/events/history", {
      projectDirectory: projectDirectory || undefined
    }));
  }

  async function undoPatch(entryId: string): Promise<void> {
    await runAction("패치 되돌리기", async () => postAuthedJson<ApiResult>("/api/events/undo", {
      projectDirectory: projectDirectory || undefined,
      patchHistoryId: entryId
    }));
    await loadPatchHistory();
    await loadGenerationJobs();
  }

  async function saveSceneDraft(): Promise<void> {
    if (!sceneDraft) {
      return;
    }
    await runAction("씬 저장", async () => postAuthedJson<ApiResult>("/api/project/scenes", {
      projectDirectory: projectDirectory || undefined,
      scene: sceneDraft
    }));
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

  async function generatePortrait(): Promise<void> {
    setPreviewSrc(null);
    await runAction("기본 포트레이트 생성", async () => {
      const response = await postAuthedJson<ApiResult & ImagePreviewResult>("/api/generation/images", {
        projectDirectory: projectDirectory || undefined,
        kind: "portrait",
        heroine: heroineDraft
      });
      setPreviewSrc(response.image?.dataUrl || response.image?.uri || response.asset?.uri || null);
      await refreshSession();
      return response;
    });
  }

  function toggleJob(jobId: string): void {
    setSelectedJobIds((current) => current.includes(jobId)
      ? current.filter((id) => id !== jobId)
      : [...current, jobId]);
  }

  function updateSceneField(field: keyof SceneDraft, value: string): void {
    setSceneDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function updateSceneCharacterExpression(value: string): void {
    setSceneDraft((current) => {
      if (!current) return current;
      const characterId = current.characters[0]?.characterId || currentHeroine?.id || "";
      return {
        ...current,
        characters: [{ characterId, expression: value, position: "center" }]
      };
    });
  }

  function updateChoice(index: number, field: "text" | "next", value: string): void {
    setSceneDraft((current) => {
      if (!current) return current;
      const choices = current.choices.map((choice, choiceIndex) => choiceIndex === index ? { ...choice, [field]: value } : choice);
      return { ...current, choices };
    });
  }

  function addChoice(): void {
    setSceneDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        choices: [
          ...current.choices,
          { id: `choice-${current.id}-${current.choices.length + 1}`, text: "새 선택지", next: current.next || current.id }
        ]
      };
    });
  }

  return (
    <AppShell
      actions={(
        <>
          <span className="topbar-status">{describeSession(session)}</span>
          <Button icon={<RefreshCw size={16} />} onClick={() => void refreshSession()} variant="ghost">상태 갱신</Button>
          <Button icon={<LogOut size={16} />} onClick={() => void logout()} variant="secondary">로그아웃</Button>
        </>
      )}
    >
      <main className="maker-workspace">
        <section className="workspace-summary">
          <div>
            <p className="eyebrow">Beta workspace</p>
            <h1>{project?.title || "VN Maker 제작 워크스페이스"}</h1>
            <p>{project ? project.premise : "히로인을 만들고, 이벤트를 확장하고, 에셋과 export까지 한 흐름에서 확인합니다."}</p>
          </div>
          <div className="primary-action">
            <span>{nextAction.reason}</span>
            <Button disabled={nextAction.disabled} icon={<Sparkles size={18} />} onClick={nextAction.run} variant="primary">{nextAction.label}</Button>
            {nextAction.disabled ? <small>차단 사유: {nextAction.reason}</small> : null}
          </div>
        </section>

        <section className="maker-grid">
          <aside className="workflow-rail" aria-label="제작 단계">
            <div className="rail-block">
              <p className="panel-eyebrow">Workflow</p>
              <ol className="stepper">
                {workflowSteps.map((step) => (
                  <li className={`step-${step.status}`} key={step.label}>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rail-block">
              <p className="panel-eyebrow">Project</p>
              <input
                aria-label="프로젝트 디렉터리"
                onChange={(event) => setProjectDirectory(event.target.value)}
                placeholder="프로젝트 디렉터리 자동 생성"
                value={projectDirectory}
              />
              <div className="button-row compact">
                <Button icon={<Database size={16} />} onClick={() => void openProject()}>열기</Button>
                <Button icon={<Sparkles size={16} />} onClick={() => void createStarterProject()}>샘플</Button>
              </div>
            </div>

            <div className="rail-block">
              <p className="panel-eyebrow">Heroine Library</p>
              <div className="search-row">
                <Search size={16} />
                <input aria-label="히로인 검색" onChange={(event) => setHeroineQuery(event.target.value)} placeholder="검색" value={heroineQuery} />
              </div>
              <div className="field-grid compact-fields">
                <input aria-label="태그 필터" onChange={(event) => setHeroineTagFilter(event.target.value)} placeholder="tag" value={heroineTagFilter} />
                <select aria-label="히로인 정렬" onChange={(event) => setHeroineSort(event.target.value)} value={heroineSort}>
                  <option value="name-asc">이름순</option>
                  <option value="name-desc">이름 역순</option>
                  <option value="reuse-desc">재사용순</option>
                </select>
              </div>
              <Button icon={<RefreshCw size={16} />} onClick={() => void loadHeroineLibrary()}>검색 적용</Button>
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
                    <span>{(heroine.tags || []).join(", ") || "태그 없음"} · 재사용 {heroine.reuseHistory?.length || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="workbench">
            <StatusBanner tone={workspaceStatus.includes("실패") ? "error" : workspaceStatus.includes("완료") ? "success" : "neutral"}>{workspaceStatus}</StatusBanner>

            <section className="workbench-section">
              <header className="section-header">
                <div>
                  <p className="panel-eyebrow">Heroine</p>
                  <h2>히로인 편집과 프로젝트 스냅샷</h2>
                </div>
                <div className="button-row">
                  <Button icon={<Save size={16} />} onClick={() => void saveHeroine()} variant="primary">저장</Button>
                  <Button icon={<Copy size={16} />} onClick={() => void cloneSelectedHeroine()}>복제</Button>
                  <Button icon={<ImagePlus size={16} />} onClick={() => void generatePortrait()}>포트레이트</Button>
                  <Button icon={<Trash2 size={16} />} onClick={() => void deleteSelectedHeroine()}>삭제</Button>
                  <Button icon={<Database size={16} />} onClick={() => void createProjectFromSelectedHeroine()}>프로젝트 생성</Button>
                </div>
              </header>
              <div className="form-grid">
                <input aria-label="히로인 ID" value={heroineDraft.id || ""} onChange={(event) => updateHeroineField("id", event.target.value)} />
                <input aria-label="히로인 이름" value={heroineDraft.name} onChange={(event) => updateHeroineField("name", event.target.value)} />
                <input aria-label="기본 포트레이트 에셋" value={heroineDraft.defaultPortraitAssetId || ""} onChange={(event) => updateHeroineField("defaultPortraitAssetId", event.target.value)} />
                <input aria-label="히로인 태그" value={(heroineDraft.tags || []).join(", ")} onChange={(event) => updateHeroineField("tags", event.target.value)} />
              </div>
              <div className="textarea-grid">
                <label>설명<textarea value={heroineDraft.description} onChange={(event) => updateHeroineField("description", event.target.value)} /></label>
                <label>성격<textarea value={heroineDraft.personality} onChange={(event) => updateHeroineField("personality", event.target.value)} /></label>
                <label>말투<textarea value={heroineDraft.speechStyle} onChange={(event) => updateHeroineField("speechStyle", event.target.value)} /></label>
                <label>외형<textarea value={heroineDraft.appearance} onChange={(event) => updateHeroineField("appearance", event.target.value)} /></label>
              </div>
              {currentHeroine ? (
                <div className="inline-status success">
                  프로젝트 스냅샷 출처: {currentHeroine.sourceHeroineName || currentHeroine.displayName} ({currentHeroine.sourceHeroineId || currentHeroine.id}) · {currentHeroine.sourceSnapshotCreatedAt || "기록 없음"}
                </div>
              ) : (
                <div className="inline-status">프로젝트에 선택된 히로인 스냅샷이 아직 없습니다.</div>
              )}
            </section>

            <section className="workbench-section">
              <header className="section-header">
                <div>
                  <p className="panel-eyebrow">Assets</p>
                  <h2>감정 에셋과 이미지 작업 보드</h2>
                </div>
                <div className="button-row">
                  <Button icon={<Tags size={16} />} onClick={() => void planDefaultEmotionAssets()} variant="primary">기본 감정 5종</Button>
                  <Button icon={<ImagePlus size={16} />} onClick={() => void planCustomExpressionAssets()}>추가 태그 계획</Button>
                  <Button disabled={selectedJobIds.length === 0} icon={<ListChecks size={16} />} onClick={() => void runSelectedGenerationJobs()}>선택 실행</Button>
                </div>
              </header>
              <input aria-label="추가 태그" onChange={(event) => setCustomTags(event.target.value)} value={customTags} />
              <div className="job-board">
                {generationJobs.map((job) => (
                  <article className={`job-card ${jobTone(job.status)}`} key={job.id}>
                    <label>
                      <input checked={selectedJobIds.includes(job.id)} onChange={() => toggleJob(job.id)} type="checkbox" />
                      <strong>{job.id}</strong>
                    </label>
                    <span>{job.kind} · {job.status} · {job.provider}</span>
                    <p>{job.prompt}</p>
                    {job.asset?.uri ? <img alt={job.asset.label} src={job.asset.uri} /> : null}
                    {job.failureMessage ? <small>{job.failureMessage}</small> : null}
                    {job.status === "failed" ? <Button icon={<RefreshCw size={15} />} onClick={() => void retryGenerationJob(job.id)}>재시도</Button> : null}
                    {job.status === "completed" ? <Button icon={<ImagePlus size={15} />} onClick={() => void replaceGenerationAsset(job.id)}>교체</Button> : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="workbench-section">
              <header className="section-header">
                <div>
                  <p className="panel-eyebrow">Route / Scene</p>
                  <h2>씬 편집과 자연어 패치</h2>
                </div>
                <div className="button-row">
                  <Button icon={<Save size={16} />} onClick={() => void saveSceneDraft()}>씬 저장</Button>
                  <Button icon={<Sparkles size={16} />} onClick={() => void expandEvent()} variant="primary">패치 제안</Button>
                  <Button disabled={!patchCanApply} icon={<CheckCircle2 size={16} />} onClick={() => void approveEvent()}>승인</Button>
                  <Button disabled={!pendingPatch} icon={<XCircle size={16} />} onClick={() => setPendingPatch(null)}>취소</Button>
                </div>
              </header>
              {project?.routes.length ? (
                <div className="route-panel">
                  <div className="route-selector">
                    <select aria-label="루트 선택" value={currentRoute?.id || ""} onChange={(event) => selectRoute(event.target.value)}>
                      {project.routes.map((route) => (
                        <option key={route.id} value={route.id}>{route.title}</option>
                      ))}
                    </select>
                    <div className="inline-status">
                      {currentRoute?.id || "루트 없음"} · {currentHeroine?.displayName || currentRoute?.heroineId || "히로인 없음"} · 시작 {currentRoute?.entrySceneId || "없음"}
                    </div>
                  </div>
                  <div className="route-list" aria-label="루트 목록">
                    {project.routes.map((route) => {
                      const routeHeroine = project.characters.find((character) => character.id === route.heroineId);
                      const entryScene = project.scenes.find((item) => item.id === route.entrySceneId);
                      return (
                        <button
                          className={currentRoute?.id === route.id ? "route-item selected" : "route-item"}
                          key={route.id}
                          onClick={() => selectRoute(route.id)}
                          type="button"
                        >
                          <strong>{route.title}</strong>
                          <span>{route.id}</span>
                          <small>{routeHeroine?.displayName || route.heroineId} · {route.entrySceneId} · {entryScene ? "연결됨" : "시작 씬 없음"}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : <div className="inline-status">루트가 없습니다.</div>}
              <div className="scene-layout">
                <div className="scene-list">
                  {(project?.scenes || []).map((item) => (
                    <button
                      className={sceneDraft?.id === item.id ? "list-item selected" : "list-item"}
                      key={item.id}
                      onClick={() => {
                        setSceneDraft(cloneScene(item));
                        setCurrentSceneId(item.id);
                      }}
                      type="button"
                    >
                      <strong>{item.label}</strong>
                      <span>{item.id}</span>
                    </button>
                  ))}
                </div>
                {sceneDraft ? (
                  <div className="scene-editor">
                    <div className="form-grid">
                      <input aria-label="씬 ID" value={sceneDraft.id} onChange={(event) => updateSceneField("id", event.target.value)} />
                      <input aria-label="씬 라벨" value={sceneDraft.label} onChange={(event) => updateSceneField("label", event.target.value)} />
                      <input aria-label="화자" value={sceneDraft.speaker} onChange={(event) => updateSceneField("speaker", event.target.value)} />
                      <input aria-label="다음 씬" value={sceneDraft.next || ""} onChange={(event) => updateSceneField("next", event.target.value)} />
                    </div>
                    <textarea aria-label="씬 본문" value={sceneDraft.text} onChange={(event) => updateSceneField("text", event.target.value)} />
                    <select aria-label="표정 태그" onChange={(event) => updateSceneCharacterExpression(event.target.value)} value={sceneDraft.characters[0]?.expression || "normal"}>
                      {(currentHeroine?.emotionTags || ["normal"]).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                    <div className="choice-editor">
                      {sceneDraft.choices.map((choice, index) => (
                        <div className="choice-row" key={choice.id}>
                          <input aria-label="선택지 문구" value={choice.text} onChange={(event) => updateChoice(index, "text", event.target.value)} />
                          <input aria-label="선택지 이동 씬" value={choice.next} onChange={(event) => updateChoice(index, "next", event.target.value)} />
                        </div>
                      ))}
                      <Button icon={<ListChecks size={16} />} onClick={addChoice}>선택지 추가</Button>
                    </div>
                  </div>
                ) : <div className="inline-status">편집할 씬을 선택하세요.</div>}
              </div>
              <textarea aria-label="자연어 이벤트" value={prompt} onChange={(event) => setPrompt(event.target.value)} wrap="soft" />
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
            </section>

            <section className="workbench-section">
              <header className="section-header">
                <div>
                  <p className="panel-eyebrow">Preview / Export</p>
                  <h2>플레이 확인과 내보내기</h2>
                </div>
                <div className="button-row">
                  <Button icon={<Play size={16} />} onClick={() => void previewProject()}>처음부터</Button>
                  <Button icon={<Play size={16} />} onClick={() => void previewProject(sceneDraft?.id || currentSceneId)}>현재 씬</Button>
                  <Button icon={<CheckCircle2 size={16} />} onClick={() => void validateProject()}>검증</Button>
                  <Button icon={<FileDown size={16} />} onClick={() => void exportProject()} variant="primary">Export</Button>
                </div>
              </header>
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
                    {scene.choices.length === 0 && scene.next ? <Button onClick={() => setCurrentSceneId(scene.next || "")}>다음</Button> : null}
                  </div>
                </div>
              ) : <div className="inline-status">프리뷰가 비어 있습니다. 프로젝트를 열고 프리뷰를 실행하세요.</div>}
              {lastExport ? (
                <div className="inline-status success">
                  Export 완료: {(lastExport.export as { outputDirectory?: string } | undefined)?.outputDirectory || "경로 없음"} · smoke {((lastExport.smoke as { ok?: boolean } | undefined)?.ok) ? "통과" : "확인 필요"}
                </div>
              ) : null}
              {previewSrc ? <div className="preview-area"><img alt="생성 이미지 미리보기" src={previewSrc} /></div> : null}
            </section>
          </section>

          <aside className="inspector" aria-label="작업 인스펙터">
            <section className="rail-block">
              <p className="panel-eyebrow">Current State</p>
              <dl className="summary-list">
                <div><dt>프로젝트</dt><dd>{project?.id || "없음"}</dd></div>
                <div><dt>히로인</dt><dd>{currentHeroine?.displayName || heroineDraft.name}</dd></div>
                <div><dt>현재 씬</dt><dd>{sceneDraft?.id || currentSceneId || "없음"}</dd></div>
                <div><dt>Pending patch</dt><dd>{pendingPatch ? "있음" : "없음"}</dd></div>
                <div><dt>Planned CG/에셋</dt><dd>{plannedJobCount}</dd></div>
                <div><dt>Export</dt><dd>{lastExport ? "완료" : "대기"}</dd></div>
              </dl>
            </section>

            <section className="rail-block">
              <header className="mini-header">
                <p className="panel-eyebrow">Patch History</p>
                <Button icon={<History size={15} />} onClick={() => void loadPatchHistory()}>갱신</Button>
              </header>
              <div className="history-list">
                {patchHistory.map((entry) => (
                  <article className={`history-item ${entry.status}`} key={entry.id}>
                    <strong>{entry.summary}</strong>
                    <span>{entry.status}{entry.revertedAt ? " · reverted" : ""}</span>
                    {entry.beforeSummary && entry.afterSummary ? <small>{entry.beforeSummary}{" -> "}{entry.afterSummary}</small> : null}
                    {entry.diff?.text ? <small>{entry.diff.text}</small> : null}
                    {entry.validationIssues.length > 0 ? <small>{entry.validationIssues[0].path}: {entry.validationIssues[0].message}</small> : null}
                    {(entry.attempts?.length || entry.rawOutput || entry.diff?.operations?.length) ? (
                      <details className="history-details">
                        <summary>상세</summary>
                        {entry.attempts?.length ? (
                          <ul>
                            {entry.attempts.map((attempt) => (
                              <li key={attempt.attempt}>
                                attempt {attempt.attempt}: {attempt.ok ? "ok" : attempt.failureKind || "failed"}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {entry.diff?.operations?.length ? (
                          <ul>
                            {entry.diff.operations.map((operation) => <li key={operation}>{operation}</li>)}
                          </ul>
                        ) : null}
                        {entry.rawOutput ? <pre>{formatResult(entry.rawOutput)}</pre> : null}
                      </details>
                    ) : null}
                    {entry.status === "applied" && !entry.revertedAt ? <Button icon={<RotateCcw size={15} />} onClick={() => void undoPatch(entry.id)}>되돌리기</Button> : null}
                  </article>
                ))}
              </div>
            </section>

            <details className="developer-drawer">
              <summary><Code2 size={16} /> 개발자 도구</summary>
              <div className="button-row">
                <Button icon={<CheckCircle2 size={16} />} onClick={() => void validateProject()}>검증</Button>
              </div>
              <textarea className="project-editor" value={projectJson} onChange={(event) => setProjectJson(event.target.value)} wrap="soft" />
              <pre>{result}</pre>
            </details>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
