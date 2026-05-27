import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  GitBranch,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings
} from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, DiagnosticDrawer, EmptyState, StatusChip } from "../../components/ui";
import type {
  ProjectApiResult,
  ProjectAsset,
  ProjectData,
  ProjectIssue,
  ProjectPreviewPreflight,
  ProjectRepairAction,
  ProjectRevision,
  Phase0DecisionReport,
  GenerationResultLog,
  TestPromptFixture,
  UXDecisionEventLog
} from "./projectPageTypes";

export const STUDIO_MIN_WIDTH = 1280;
export const STUDIO_MIN_HEIGHT = 720;

type StudioPanelId = "scene" | "choices" | "stats" | "assets" | "validation";
type StudioSaveState = "idle" | "dirty" | "saving" | "saved" | "failed" | "apiFailure";
type ProjectScene = NonNullable<ProjectData["scenes"]>[number];
type ProjectRoute = NonNullable<ProjectData["routes"]>[number];
type SceneCharacter = NonNullable<ProjectScene["characters"]>[number];
type SceneChoice = NonNullable<ProjectScene["choices"]>[number];

interface StudioLayout {
  routeWidth: number;
  inspectorWidth: number;
  problemsHeight: number;
  routeCollapsed: boolean;
  inspectorCollapsed: boolean;
  problemsCollapsed: boolean;
}

interface StudioWorkspaceProps {
  navigationLabel?: string;
  onNavigate: (path: string) => void;
  onProjectResult: (result: ProjectApiResult) => void;
  postJson: (path: string, body: Record<string, unknown>) => Promise<ProjectApiResult>;
  previewPreflight: ProjectPreviewPreflight | null;
  project: ProjectData | null;
  projectDirectory: string;
  projectId?: string;
  projectRevision?: ProjectRevision | null;
  repairActions: ProjectRepairAction[];
}

const defaultStudioLayout: StudioLayout = {
  routeWidth: 240,
  inspectorWidth: 320,
  problemsHeight: 220,
  routeCollapsed: false,
  inspectorCollapsed: false,
  problemsCollapsed: false
};

const panelTabs: Array<{ id: StudioPanelId; label: string }> = [
  { id: "scene", label: "씬" },
  { id: "choices", label: "연결" },
  { id: "stats", label: "조건" },
  { id: "assets", label: "표시" },
  { id: "validation", label: "검증" }
];

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function studioLayoutStorageKey(projectId?: string): string {
  return `vn-maker:studio-layout:${projectId || "unknown"}`;
}

export function clampStudioLayout(input: Partial<StudioLayout>): StudioLayout {
  return {
    routeWidth: clampNumber(input.routeWidth, defaultStudioLayout.routeWidth, 200, 380),
    inspectorWidth: clampNumber(input.inspectorWidth, defaultStudioLayout.inspectorWidth, 280, 460),
    problemsHeight: clampNumber(input.problemsHeight, defaultStudioLayout.problemsHeight, 128, 320),
    routeCollapsed: input.routeCollapsed === true,
    inspectorCollapsed: input.inspectorCollapsed === true,
    problemsCollapsed: input.problemsCollapsed === true
  };
}

function useViewportSize(): { width: number; height: number } {
  const [viewport, setViewport] = useState(() => ({
    height: typeof window === "undefined" ? STUDIO_MIN_HEIGHT : window.innerHeight,
    width: typeof window === "undefined" ? STUDIO_MIN_WIDTH : window.innerWidth
  }));

  useEffect(() => {
    function updateViewport(): void {
      setViewport({ height: window.innerHeight, width: window.innerWidth });
    }
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  return viewport;
}

function cleanText(value?: string): string {
  return value?.trim() || "";
}

function sceneTitle(scene?: ProjectScene | null): string {
  if (!scene) return "씬 없음";
  return cleanText(scene.label) || cleanText(scene.id) || "씬";
}

function assetLabel(asset?: ProjectAsset | null): string {
  if (!asset) return "연결 없음";
  return asset.label || asset.id || asset.uri || "에셋";
}

function characterLabel(project: ProjectData | null, characterId?: string): string {
  if (!characterId) return "캐릭터 없음";
  const character = (project?.characters || []).find((item) => item.id === characterId);
  return character?.displayName || character?.sourceHeroineName || character?.id || characterId;
}

function panelFromValue(value?: string | null): StudioPanelId {
  return panelTabs.some((tab) => tab.id === value) ? value as StudioPanelId : "scene";
}

function cloneScene(scene: ProjectScene | null): ProjectScene | null {
  if (!scene) {
    return null;
  }
  return {
    ...scene,
    characters: (scene.characters || []).map((character) => ({ ...character })),
    choices: (scene.choices || []).map((choice) => ({
      ...choice,
      condition: choice.condition ? { ...choice.condition } : undefined,
      effects: choice.effects ? { ...choice.effects } : undefined
    })),
    ending: scene.ending ? { ...scene.ending } : undefined
  };
}

function serializeScene(scene: ProjectScene | null): string {
  return JSON.stringify(scene || null);
}

function sceneContentSnapshot(scene: ProjectScene | null): Record<string, unknown> | null {
  if (!scene) return null;
  return {
    id: scene.id || "",
    label: scene.label || "",
    speaker: scene.speaker || "",
    text: scene.text || "",
    backgroundAssetId: scene.backgroundAssetId || "",
    cgAssetId: scene.cgAssetId || "",
    characters: (scene.characters || []).map((character) => ({
      assetId: character.assetId || "",
      characterId: character.characterId || "",
      expression: character.expression || "",
      position: character.position || ""
    }))
  };
}

function sceneRoutingSnapshot(scene: ProjectScene | null): Record<string, unknown> | null {
  if (!scene) return null;
  return {
    choices: (scene.choices || []).map((choice) => ({
      id: choice.id || "",
      next: choice.next || "",
      text: choice.text || ""
    })),
    ending: scene.ending ? { ...scene.ending } : null,
    next: scene.next || ""
  };
}

function sceneContentSavePayload(draft: ProjectScene, source: ProjectScene | null): ProjectScene {
  const content = sceneContentSnapshot(draft) || {};
  return {
    ...content,
    choices: (source?.choices || []).map((choice) => ({ ...choice })),
    ending: source?.ending ? { ...source.ending } : undefined,
    next: source?.next
  } as ProjectScene;
}

function issueText(issue: ProjectIssue): string {
  const code = issue.code ? `[${issue.code}] ` : "";
  const path = issue.path ? `${issue.path}: ` : "";
  return `${code}${path}${issue.message || "확인이 필요합니다."}`;
}

function issueTone(issue: ProjectIssue): "danger" | "warning" | "neutral" {
  if (issue.severity === "error") return "danger";
  if (issue.severity === "warning") return "warning";
  return "neutral";
}

function generationClassificationTone(classification?: string): "success" | "warning" | "danger" | "neutral" {
  if (classification === "passed") return "success";
  if (classification === "generation_quality" || classification === "validation_model") return "warning";
  if (classification) return "danger";
  return "neutral";
}

function generationSourceText(log: GenerationResultLog | null): string {
  if (!log) return "결과 없음";
  if (log.sourceType === "actual") return `actual · ${log.adapter || "adapter unknown"}`;
  if (log.sourceType === "mock") return `mock · ${log.adapter || "adapter unknown"}`;
  return `unavailable · ${log.skippedReason || "reason missing"}`;
}

function preflightToIssues(preflight: ProjectPreviewPreflight | null): ProjectIssue[] {
  const blockers = (preflight?.blockers || []).map<ProjectIssue>((issue) => ({
    code: issue.issueCode,
    message: issue.message,
    path: issue.path,
    sceneIds: issue.sceneIds,
    choiceIds: issue.choiceIds,
    targetSceneId: issue.targetSceneId,
    severity: "error"
  }));
  const warnings = (preflight?.warnings || []).map<ProjectIssue>((issue) => ({
    code: issue.issueCode,
    message: issue.message,
    path: issue.path,
    sceneIds: issue.sceneIds,
    choiceIds: issue.choiceIds,
    targetSceneId: issue.targetSceneId,
    severity: "warning"
  }));
  return [...blockers, ...warnings];
}

function studioIssueKey(issue: ProjectIssue): string {
  return [
    issue.severity || "info",
    issue.code || "",
    issue.path || "",
    issue.message || "",
    (issue.sceneIds || []).join(","),
    (issue.choiceIds || []).join(","),
    issue.targetSceneId || ""
  ].join("::");
}

function mergedStudioIssues(localIssues: ProjectIssue[], preflightIssues: ProjectIssue[]): ProjectIssue[] {
  const issues = [...localIssues, ...preflightIssues];
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = studioIssueKey(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resultIssues(result: ProjectApiResult): ProjectIssue[] {
  return result.issues
    || result.validation?.issues
    || result.runtime?.validation?.issues
    || [];
}

function revisionFromResult(result: ProjectApiResult): ProjectRevision | null {
  return result.projectRevision || result.previewPreflight?.projectRevision || result.actualRevision || null;
}

function resultSelectedSceneId(result: ProjectApiResult): string {
  return typeof result.selectedSceneId === "string" ? result.selectedSceneId : "";
}

function isApiFailure(result: ProjectApiResult): boolean {
  return result.ok === false || result.code === "NON_JSON_RESPONSE" || result.code === "EMPTY_RESPONSE" || result.code === "HTTP_ERROR" || result.code === "NETWORK_ERROR";
}

function uniqueSceneId(project: ProjectData | null, seed: string): string {
  const used = new Set((project?.scenes || []).map((scene) => scene.id).filter(Boolean));
  const base = seed.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "scene-manual";
  if (!used.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function newScene(project: ProjectData | null, label: string, speaker?: string): ProjectScene {
  const id = uniqueSceneId(project, `scene-${label}-${Date.now()}`);
  return {
    id,
    label,
    speaker: speaker || "",
    text: "",
    characters: [],
    choices: []
  };
}

function findIssueSceneId(issue: ProjectIssue, project: ProjectData | null): string {
  if (issue.sceneIds?.[0]) return issue.sceneIds[0];
  if (issue.targetSceneId) return issue.targetSceneId;
  const pathMatch = issue.path?.match(/scenes\.(.*?)\./) || issue.path?.match(/scenes\[(\d+)\]/);
  if (!pathMatch) return "";
  const value = pathMatch[1];
  if (/^\d+$/.test(value)) {
    return project?.scenes?.[Number(value)]?.id || "";
  }
  return value || "";
}

function issuePanel(issue: ProjectIssue): StudioPanelId {
  const path = issue.path || "";
  if (issue.code === "conditional-choice-runtime-unsupported" || path.includes("condition") || path.includes("effects")) return "stats";
  if (path.includes("choices") || issue.choiceIds?.length) return "choices";
  if (path.includes("background") || path.includes("cgAssetId") || path.includes("characters")) return "assets";
  if (path.includes("ending") || path.includes("next")) return "choices";
  return "scene";
}

function canonicalStudioQuery(current: URLSearchParams, nextValues: { scene?: string; panel?: StudioPanelId }): URLSearchParams {
  const next = new URLSearchParams(current);
  if (nextValues.scene !== undefined) {
    if (nextValues.scene) next.set("scene", nextValues.scene);
    else next.delete("scene");
  }
  if (nextValues.panel !== undefined) {
    next.set("panel", nextValues.panel);
  } else if (!panelTabs.some((tab) => tab.id === next.get("panel"))) {
    next.set("panel", "scene");
  }
  return next;
}

function focusLater(ref: RefObject<HTMLElement | null>): void {
  window.setTimeout(() => ref.current?.focus(), 0);
}

function revisionStatusText(revision: ProjectRevision | null): string {
  return revision?.revision ? `revision ${revision.revision}` : "revision 확인 필요";
}

export function StudioWorkspace({
  navigationLabel = "Studio workspace",
  onNavigate,
  onProjectResult,
  postJson,
  previewPreflight,
  project,
  projectDirectory,
  projectId: routeProjectId,
  projectRevision,
  repairActions
}: StudioWorkspaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewport = useViewportSize();
  const [layout, setLayout] = useState(defaultStudioLayout);
  const [layoutStorageReadyKey, setLayoutStorageReadyKey] = useState("");
  const [draftScene, setDraftScene] = useState<ProjectScene | null>(null);
  const [saveState, setSaveState] = useState<StudioSaveState>("idle");
  const [statusText, setStatusText] = useState("수동 제작 워크스페이스를 불러왔습니다.");
  const [fixedPrompts, setFixedPrompts] = useState<TestPromptFixture[]>([]);
  const [selectedFixedPromptId, setSelectedFixedPromptId] = useState("");
  const [generationLog, setGenerationLog] = useState<GenerationResultLog | null>(null);
  const [generationStatus, setGenerationStatus] = useState("고정 프롬프트 세트를 불러오는 중입니다.");
  const [generationBusy, setGenerationBusy] = useState(false);
  const [phase0EventLog, setPhase0EventLog] = useState<UXDecisionEventLog | null>(null);
  const [phase0Report, setPhase0Report] = useState<Phase0DecisionReport | null>(null);
  const [phase0Status, setPhase0Status] = useState("Phase 0 decision report 생성 전입니다.");
  const [phase0Busy, setPhase0Busy] = useState(false);
  const [localIssues, setLocalIssues] = useState<ProjectIssue[]>(() => preflightToIssues(previewPreflight));
  const [localRevision, setLocalRevision] = useState<ProjectRevision | null>(projectRevision || previewPreflight?.projectRevision || null);
  const scriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inspectorFirstFieldRef = useRef<HTMLElement | null>(null);
  const uxSessionIdRef = useRef(`studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  const projectId = project?.id || routeProjectId || "";
  const scenes = project?.scenes || [];
  const routes = project?.routes || [];
  const activeRoute = routes[0] || null;
  const selectedSceneQuery = searchParams.get("scene");
  const selectedPanel = panelFromValue(searchParams.get("panel"));
  const selectedScene = useMemo(() => {
    const routeEntry = scenes.find((scene) => scene.id === activeRoute?.entrySceneId) || null;
    return scenes.find((scene) => scene.id === selectedSceneQuery) || routeEntry || scenes[0] || null;
  }, [activeRoute?.entrySceneId, scenes, selectedSceneQuery]);
  const originalSceneJson = useMemo(() => serializeScene(selectedScene), [selectedScene]);
  const draftSceneJson = useMemo(() => serializeScene(draftScene), [draftScene]);
  const contentDirty = useMemo(() => JSON.stringify(sceneContentSnapshot(draftScene)) !== JSON.stringify(sceneContentSnapshot(selectedScene)), [draftSceneJson, originalSceneJson]);
  const routingDirty = useMemo(() => JSON.stringify(sceneRoutingSnapshot(draftScene)) !== JSON.stringify(sceneRoutingSnapshot(selectedScene)), [draftSceneJson, originalSceneJson]);
  const dirty = contentDirty || routingDirty;
  const preflightIssues = useMemo(() => preflightToIssues(previewPreflight), [previewPreflight]);
  const visibleIssues = useMemo(() => mergedStudioIssues(localIssues, preflightIssues), [localIssues, preflightIssues]);
  const conditionRuntimeSupport = previewPreflight?.conditionRuntimeSupport || previewPreflight?.runtimeCapabilities?.conditionRuntimeSupport || null;
  const conditionSupportMode = conditionRuntimeSupport?.editorMode || "candidate_review_only";
  const conditionStrictPreviewText = conditionRuntimeSupport?.strictPreviewStatus === "not_evaluated"
    ? "condition preview not evaluated"
    : "조건 판정 상태 확인 전";
  const problemCount = visibleIssues.length;
  const errorCount = visibleIssues.filter((issue) => issue.severity === "error").length;
  const previewDisabledReason = errorCount > 0
    ? `문제 ${errorCount}건을 먼저 해결해야 합니다.`
    : previewPreflight?.canRun === false
      ? previewPreflight.disabledReason || "프리뷰 실행 조건을 충족하지 못했습니다."
      : "";
  const unsupported = viewport.width < STUDIO_MIN_WIDTH || viewport.height < STUDIO_MIN_HEIGHT;
  const backgroundAssets = (project?.assets || []).filter((asset) => asset.kind === "background");
  const cgAssets = (project?.assets || []).filter((asset) => asset.kind === "cg");
  const sceneBackgroundAsset = backgroundAssets.find((asset) => asset.id === draftScene?.backgroundAssetId) || null;
  const sceneCgAsset = cgAssets.find((asset) => asset.id === draftScene?.cgAssetId) || null;
  const unsupportedProjectPath = projectId ? `/projects/${projectId}/overview` : "/projects";
  const routeMapScenes = useMemo(() => {
    if (!activeRoute?.entrySceneId) {
      return scenes;
    }
    const ordered: ProjectScene[] = [];
    const seen = new Set<string>();
    let current = scenes.find((scene) => scene.id === activeRoute.entrySceneId) || null;
    while (current && current.id && !seen.has(current.id)) {
      ordered.push(current);
      seen.add(current.id);
      current = current.next ? scenes.find((scene) => scene.id === current?.next) || null : null;
    }
    scenes.forEach((scene) => {
      if (scene.id && !seen.has(scene.id)) {
        ordered.push(scene);
      }
    });
    return ordered;
  }, [activeRoute?.entrySceneId, scenes]);

  function recordUXDecisionEvent(event: Record<string, unknown>): void {
    if (!projectDirectory) {
      return;
    }
    void postJson("/api/events/ux/record", {
      projectDirectory,
      sessionId: uxSessionIdRef.current,
      participantIdHash: "local-browser-session",
      participantType: "local_operator",
      taskId: "phase0-studio-decision-session",
      projectId,
      routeId: activeRoute?.id,
      sceneId: selectedScene?.id,
      projectRevision: localRevision || previewPreflight?.projectRevision || projectRevision || undefined,
      ...event
    }).catch(() => {
      // Event capture must not interrupt authoring actions.
    });
  }

  useEffect(() => {
    if (!projectDirectory) {
      return;
    }
    recordUXDecisionEvent({ eventName: "started", outcome: "started", inputMode: "manual" });
  }, [projectDirectory, projectId]);

  useEffect(() => {
    setLocalIssues(preflightToIssues(previewPreflight));
  }, [previewPreflight]);

  useEffect(() => {
    const nextRevision = projectRevision || previewPreflight?.projectRevision || null;
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
  }, [projectRevision, previewPreflight?.projectRevision]);

  useEffect(() => {
    if (!projectDirectory) {
      setFixedPrompts([]);
      setSelectedFixedPromptId("");
      setGenerationStatus("프로젝트 저장 위치가 없어 고정 프롬프트를 불러올 수 없습니다.");
      return;
    }
    void loadFixedPrompts();
  }, [projectDirectory]);

  useEffect(() => {
    if (!projectId) {
      setLayoutStorageReadyKey("");
      return;
    }
    const key = studioLayoutStorageKey(projectId);
    setLayoutStorageReadyKey("");
    try {
      const raw = localStorage.getItem(key);
      setLayout(raw ? clampStudioLayout(JSON.parse(raw) as Partial<StudioLayout>) : defaultStudioLayout);
    } catch {
      setLayout(defaultStudioLayout);
    } finally {
      setLayoutStorageReadyKey(key);
    }
  }, [projectId]);

  useEffect(() => {
    const key = projectId ? studioLayoutStorageKey(projectId) : "";
    if (!key || layoutStorageReadyKey !== key) return;
    localStorage.setItem(key, JSON.stringify(clampStudioLayout(layout)));
  }, [layout, layoutStorageReadyKey, projectId]);

  useEffect(() => {
    setDraftScene(cloneScene(selectedScene));
    setSaveState("idle");
  }, [selectedScene?.id]);

  useEffect(() => {
    if (saveState === "saving" || saveState === "failed" || saveState === "apiFailure") {
      return;
    }
    if (dirty) {
      setSaveState("dirty");
    } else if (saveState === "dirty") {
      setSaveState("idle");
    }
  }, [dirty, saveState]);

  useEffect(() => {
    const next = canonicalStudioQuery(searchParams, {
      panel: selectedPanel,
      scene: selectedScene?.id || selectedSceneQuery || ""
    });
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedPanel, selectedScene?.id, selectedSceneQuery, setSearchParams]);

  function updateQuery(nextValues: { scene?: string; panel?: StudioPanelId }, replace = false): void {
    const next = canonicalStudioQuery(searchParams, nextValues);
    setSearchParams(next, { replace });
  }

  function selectScene(sceneId?: string): void {
    if (!sceneId) return;
    updateQuery({ scene: sceneId });
  }

  function setPanel(panel: StudioPanelId): void {
    updateQuery({ panel });
    if (panel === "stats") {
      recordUXDecisionEvent({
        eventName: "added_condition",
        helpChannel: "inline_guide",
        issueCode: "conditional-choice-runtime-unsupported",
        outcome: "blocked"
      });
    }
    if (panel === "validation") {
      recordUXDecisionEvent({
        eventName: "help_opened",
        helpChannel: "automatic_repair_suggestion",
        outcome: "opened"
      });
    }
  }

  function updateLayout(nextLayout: Partial<StudioLayout>): void {
    setLayout((current) => clampStudioLayout({ ...current, ...nextLayout }));
  }

  async function loadFixedPrompts(): Promise<void> {
    setGenerationStatus("고정 프롬프트 세트를 불러오는 중입니다.");
    try {
      const result = await postJson("/api/events/fixed-prompts", { projectDirectory });
      if (isApiFailure(result)) {
        setGenerationStatus(result.message || result.error || "고정 프롬프트 세트를 불러오지 못했습니다.");
        return;
      }
      const prompts = result.fixtures || result.fixedPromptSet?.fixtures || [];
      setFixedPrompts(prompts);
      setSelectedFixedPromptId((current) => current || prompts[0]?.promptId || "");
      setGenerationStatus(prompts.length ? "고정 프롬프트 세트를 불러왔습니다." : "표시할 고정 프롬프트가 없습니다.");
    } catch (error) {
      setGenerationStatus(`고정 프롬프트 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function replayFixedPrompt(adapterMode: "mock" | "actual"): Promise<void> {
    const promptId = selectedFixedPromptId || fixedPrompts[0]?.promptId;
    if (!promptId) {
      setGenerationStatus("실행할 고정 프롬프트가 없습니다.");
      return;
    }
    setGenerationBusy(true);
    setGenerationStatus(adapterMode === "actual" ? "actual 생성 경로로 replay 중입니다." : "mock replay 중입니다.");
    recordUXDecisionEvent({
      eventName: "recipe_used",
      inputMode: "fixed_prompt",
      outcome: "used",
      promptId
    });
    try {
      const result = await postJson("/api/events/fixed-prompts/replay", {
        projectDirectory,
        promptId,
        adapterMode
      });
      setGenerationLog(result.generationResultLog || null);
      recordUXDecisionEvent({
        eventName: "generated",
        correlationId: result.correlationId,
        inputMode: "fixed_prompt",
        outcome: isApiFailure(result) ? "failed" : "success",
        promptId,
        resultId: result.generationResultId
      });
      if (result.project) {
        onProjectResult(result);
      }
      if (isApiFailure(result)) {
        setGenerationStatus(result.generationResultLog?.skippedReason || result.message || result.error || "고정 프롬프트 replay가 실패했습니다.");
        return;
      }
      setGenerationStatus(result.generationResultLog?.outputSummary || "고정 프롬프트 replay 결과가 기록되었습니다.");
    } catch (error) {
      setGenerationStatus(`고정 프롬프트 replay 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGenerationBusy(false);
    }
  }

  async function exportCurrentUXEventLog(): Promise<void> {
    if (!projectDirectory) {
      setPhase0Status("이벤트 로그 export 실패: 프로젝트 저장 위치가 없습니다.");
      return;
    }
    setPhase0Busy(true);
    setPhase0Status("이벤트 로그 export 중입니다.");
    try {
      const result = await postJson("/api/events/ux/export", {
        projectDirectory,
        sessionId: uxSessionIdRef.current
      });
      if (isApiFailure(result)) {
        setPhase0Status(result.message || result.error || "이벤트 로그를 export하지 못했습니다.");
        return;
      }
      setPhase0EventLog(result.eventLog || null);
      setPhase0Status(`eventLogId ${result.eventLogId || result.eventLog?.eventLogId || "기록 없음"} export 완료`);
    } catch (error) {
      setPhase0Status(`이벤트 로그 export 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPhase0Busy(false);
    }
  }

  async function createPhase0DecisionReport(): Promise<void> {
    if (!projectDirectory) {
      setPhase0Status("Phase 0 판정 실패: 프로젝트 저장 위치가 없습니다.");
      return;
    }
    setPhase0Busy(true);
    setPhase0Status("Phase 0 판정 리포트 생성 중입니다.");
    try {
      const result = await postJson("/api/phase0/decision-report", {
        projectDirectory,
        sessionIds: [uxSessionIdRef.current],
        participantResults: [{
          participantIdHash: "local-browser-session",
          sessionId: uxSessionIdRef.current,
          inputMode: generationLog?.promptId ? "fixed_prompt" : "manual",
          taskId: "phase0-studio-decision-session",
          promptId: generationLog?.promptId || selectedFixedPrompt?.promptId,
          vnToolCompletedCount: 0,
          professionalDeveloper: false,
          regularScriptingWork: false,
          storyCreatorLastYear: true,
          completed: previewPreflight?.canRun === true,
          reachedValidPreview: previewPreflight?.canRun === true,
          usedModeratorHint: false,
          usedStaticTutorial: false,
          abandoned: false,
          blockingErrorCount: errorCount,
          actualPreview: previewPreflight?.canRun === true,
          mockPreview: false
        }]
      });
      if (isApiFailure(result)) {
        setPhase0Status(result.message || result.error || "Phase 0 판정 리포트를 생성하지 못했습니다.");
        return;
      }
      setPhase0Report(result.phase0DecisionReport || null);
      setPhase0Status(`Phase 0 판정 ${result.phase0DecisionReport?.decision || "Iterate"} · eventLogId ${result.phase0DecisionReport?.sessions?.[0]?.eventLogId || "기록 없음"}`);
    } catch (error) {
      setPhase0Status(`Phase 0 판정 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPhase0Busy(false);
    }
  }

  function renderPhase0ProtocolPanel() {
    return (
      <section>
        <h3>Phase 0 판정</h3>
        <p className="studio-disabled-note">Ready/Partial/Missing 작업 패키지, fixed/free 분리, eventLogId, preflightResult 기준으로 Go · Iterate · Stop/Rethink를 계산합니다.</p>
        <div className="button-row">
          <Button disabled={phase0Busy} icon={<ListChecks size={16} />} onClick={() => void exportCurrentUXEventLog()}>
            이벤트 로그 export
          </Button>
          <Button disabled={phase0Busy} icon={<CheckCircle2 size={16} />} onClick={() => void createPhase0DecisionReport()} variant="primary">
            Phase 0 리포트
          </Button>
        </div>
        <dl className="summary-list">
          <div><dt>상태</dt><dd>{phase0Status}</dd></div>
          <div><dt>eventLogId</dt><dd>{phase0Report?.sessions?.[0]?.eventLogId || phase0EventLog?.eventLogId || "export 전"}</dd></div>
          <div><dt>판정</dt><dd>{phase0Report?.decision || "계산 전"}</dd></div>
          <div><dt>고정/자유 입력</dt><dd>fixed {phase0Report?.fixedInputMetrics?.sessionCount ?? 0} · free {phase0Report?.freeInputFindings?.sessionCount ?? 0}</dd></div>
          <div><dt>preflightResult</dt><dd>{phase0Report?.conditionRuntime?.actualPreviewCanRun ? "actual preview evidence 있음" : "actual preview evidence 확인 전"}</dd></div>
        </dl>
        {phase0Report?.workPackages?.length ? (
          <ul className="studio-readonly-list">
            {phase0Report.workPackages.map((item) => (
              <li key={item.id || item.label}>
                <strong>{item.label || item.id}</strong>
                <span>{item.status || "Missing"} · {(item.evidence || item.missing || []).join(" · ") || "evidence 없음"}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <DiagnosticDrawer summary="Phase 0 decision report">
          <pre>{phase0Report ? JSON.stringify({ phase0DecisionReport: phase0Report, eventLog: phase0EventLog }, null, 2) : "Phase 0 decision report 없음"}</pre>
        </DiagnosticDrawer>
      </section>
    );
  }

  function patchDraftScene(patch: Partial<ProjectScene>): void {
    setDraftScene((current) => current ? { ...current, ...patch } : current);
  }

  function updateChoice(index: number, patch: Partial<SceneChoice>): void {
    setDraftScene((current) => {
      if (!current) return current;
      const choices = [...(current.choices || [])];
      choices[index] = { ...choices[index], ...patch };
      return { ...current, choices };
    });
  }

  function addChoiceDraft(): void {
    setDraftScene((current) => {
      if (!current) return current;
      const nextChoice: SceneChoice = {
        id: `choice-${(current.choices || []).length + 1}`,
        next: "",
        text: "새 선택지"
      };
      return { ...current, choices: [...(current.choices || []), nextChoice], next: "" };
    });
    recordUXDecisionEvent({ eventName: "added_choices", outcome: "success" });
    setPanel("choices");
  }

  function updateCharacter(index: number, patch: Partial<SceneCharacter>): void {
    setDraftScene((current) => {
      if (!current) return current;
      const characters = [...(current.characters || [])];
      characters[index] = { ...characters[index], ...patch };
      return { ...current, characters };
    });
  }

  function addCharacterDisplay(): void {
    const firstCharacter = project?.characters?.[0];
    if (!firstCharacter?.id) return;
    setDraftScene((current) => {
      if (!current) return current;
      const characters = [...(current.characters || []), { characterId: firstCharacter.id, position: "center" }];
      return { ...current, characters };
    });
  }

  function removeCharacterDisplay(index: number): void {
    setDraftScene((current) => {
      if (!current) return current;
      return { ...current, characters: (current.characters || []).filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  function applySuccessfulResult(result: ProjectApiResult, fallbackStatus: string): void {
    const nextRevision = revisionFromResult(result);
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
    setLocalIssues(resultIssues(result));
    onProjectResult(result);
    const nextSelectedSceneId = resultSelectedSceneId(result);
    if (nextSelectedSceneId) {
      selectScene(nextSelectedSceneId);
    }
    setSaveState("saved");
    setStatusText(result.message || fallbackStatus);
  }

  function applyFailedResult(result: ProjectApiResult, fallbackStatus: string): void {
    const issues = resultIssues(result);
    if (issues.length > 0) {
      setLocalIssues(issues);
    }
    const nextRevision = revisionFromResult(result);
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
    if (result.project || result.previewPreflight || result.previewReadiness || result.exportPlan) {
      onProjectResult(result);
    }
    const apiFailure = isApiFailure(result);
    setSaveState(apiFailure ? "apiFailure" : "failed");
    setStatusText(`${apiFailure ? "API failure" : "저장 실패"}: ${result.message || result.error || fallbackStatus}`);
  }

  async function validateStudio(): Promise<ProjectRevision | null> {
    setStatusText("검증을 실행하는 중입니다.");
    try {
      const result = await postJson("/api/project/validate", { projectDirectory });
      const nextRevision = revisionFromResult(result);
      if (result.project || result.previewPreflight || result.previewReadiness || result.exportPlan) {
        onProjectResult(result);
      }
      setLocalIssues(resultIssues(result));
      if (nextRevision) {
        setLocalRevision(nextRevision);
      }
      if (isApiFailure(result)) {
        setSaveState("apiFailure");
        setStatusText(`API failure: ${result.message || result.error || "검증을 실행하지 못했습니다."}`);
        return null;
      }
      setStatusText(resultIssues(result).length > 0 ? "검증 stale: 문제 확인 결과가 갱신되었습니다." : "검증 완료. 문제 없음.");
      if (resultIssues(result).some((issue) => issue.severity === "error")) {
        recordUXDecisionEvent({
          eventName: "validation_failed",
          issueCodesBefore: resultIssues(result).map((issue) => issue.code || issue.path || "unknown"),
          outcome: "failed"
        });
      }
      return nextRevision;
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API failure: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async function ensureRevision(): Promise<ProjectRevision | null> {
    if (localRevision) {
      return localRevision;
    }
    return validateStudio();
  }

  async function saveDraftScene(): Promise<void> {
    if (!draftScene) {
      setStatusText("저장할 씬이 없습니다.");
      return;
    }
    const expectedProjectRevision = await ensureRevision();
    if (!expectedProjectRevision) {
      setStatusText("저장 실패: 최신 projectRevision을 확인할 수 없습니다.");
      setSaveState("failed");
      return;
    }
    setSaveState("saving");
    setStatusText("씬을 저장하는 중입니다.");
    try {
      const result = await postJson("/api/project/scenes", {
        expectedProjectRevision,
        projectDirectory,
        scene: sceneContentSavePayload(draftScene, selectedScene)
      });
      if (isApiFailure(result)) {
        applyFailedResult(result, "씬을 저장하지 못했습니다.");
        return;
      }
      applySuccessfulResult(result, "씬 저장 완료.");
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function insertScene(scene: ProjectScene, body: Record<string, unknown>, fallbackStatus: string): Promise<void> {
    const expectedProjectRevision = await ensureRevision();
    if (!expectedProjectRevision) {
      setSaveState("failed");
      setStatusText("저장 실패: 최신 projectRevision을 확인할 수 없습니다.");
      return;
    }
    setSaveState("saving");
    try {
      const result = await postJson("/api/project/scenes/insert", {
        ...body,
        expectedProjectRevision,
        projectDirectory,
        scene
      });
      if (isApiFailure(result)) {
        applyFailedResult(result, fallbackStatus);
        return;
      }
      applySuccessfulResult(result, fallbackStatus);
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function createStartScene(): Promise<void> {
    const route = activeRoute as ProjectRoute | null;
    const seedLabel = route?.title ? `${route.title} 시작` : "시작 씬";
    await insertScene(newScene(project, seedLabel), { link: { type: "none" } }, "시작 씬 만들기 완료.");
  }

  async function addSceneAfterCurrent(): Promise<void> {
    if (!selectedScene?.id) {
      setStatusText("기준 씬을 먼저 선택해야 합니다.");
      return;
    }
    await insertScene(
      newScene(project, "현재 씬 뒤 새 씬", draftScene?.speaker || ""),
      {
        link: { preservePreviousNext: true, type: "next" },
        sourceSceneId: selectedScene.id
      },
      "현재 씬 뒤 새 씬 추가 완료."
    );
  }

  async function createChoiceTargetScene(): Promise<void> {
    if (!selectedScene?.id) {
      setStatusText("기준 씬을 먼저 선택해야 합니다.");
      return;
    }
    await insertScene(
      newScene(project, "선택지 target 생성", draftScene?.speaker || ""),
      {
        link: { choiceText: "새 선택지", type: "choice" },
        sourceSceneId: selectedScene.id
      },
      "선택지 target 생성 완료."
    );
  }

  async function linkExistingTarget(link: { choiceId?: string; choiceText?: string; targetSceneId: string; type: "choice" | "next" }): Promise<void> {
    if (!selectedScene?.id || !link.targetSceneId) {
      setStatusText("source와 target 씬을 모두 선택해야 합니다.");
      return;
    }
    const expectedProjectRevision = await ensureRevision();
    if (!expectedProjectRevision) {
      setSaveState("failed");
      setStatusText("저장 실패: 최신 projectRevision을 확인할 수 없습니다.");
      return;
    }
    setSaveState("saving");
    try {
      const result = await postJson("/api/project/scenes/link", {
        expectedProjectRevision,
        link: link.type === "choice"
          ? { choiceId: link.choiceId, choiceText: link.choiceText, type: "choice" }
          : { type: "next" },
        projectDirectory,
        sourceSceneId: selectedScene.id,
        targetSceneId: link.targetSceneId
      });
      if (isApiFailure(result)) {
        applyFailedResult(result, "연결을 저장하지 못했습니다.");
        return;
      }
      applySuccessfulResult(result, "연결 저장 완료.");
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function setEnding(ending: ProjectScene["ending"] | null): Promise<void> {
    if (!selectedScene?.id) {
      setStatusText("엔딩을 설정할 씬을 먼저 선택해야 합니다.");
      return;
    }
    const expectedProjectRevision = await ensureRevision();
    if (!expectedProjectRevision) {
      setSaveState("failed");
      setStatusText("저장 실패: 최신 projectRevision을 확인할 수 없습니다.");
      return;
    }
    setSaveState("saving");
    try {
      const result = await postJson("/api/project/scenes/ending", {
        clearOutgoing: ending ? true : undefined,
        ending,
        expectedProjectRevision,
        projectDirectory,
        sceneId: selectedScene.id
      });
      if (isApiFailure(result)) {
        applyFailedResult(result, "엔딩을 저장하지 못했습니다.");
        return;
      }
      applySuccessfulResult(result, ending ? "엔딩 저장 완료." : "엔딩 해제 완료.");
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleProblemFocus(issue: ProjectIssue): void {
    const sceneId = findIssueSceneId(issue, project);
    const nextPanel = issuePanel(issue);
    recordUXDecisionEvent({
      eventName: "help_opened",
      helpChannel: "static_tutorial",
      issueCode: issue.code,
      outcome: "opened"
    });
    updateQuery({ panel: nextPanel, scene: sceneId || selectedScene?.id || "" });
    if (nextPanel === "scene") {
      focusLater(scriptTextareaRef);
    } else {
      focusLater(inspectorFirstFieldRef);
    }
  }

  const selectedFixedPrompt = fixedPrompts.find((fixture) => fixture.promptId === selectedFixedPromptId) || fixedPrompts[0] || null;
  const rootStyle = {
    "--studio-inspector-width": `${layout.inspectorCollapsed ? 48 : layout.inspectorWidth}px`,
    "--studio-problems-height": `${layout.problemsCollapsed ? 38 : layout.problemsHeight}px`,
    "--studio-route-width": `${layout.routeCollapsed ? 48 : layout.routeWidth}px`
  } as CSSProperties;

  if (unsupported) {
    return (
      <section className="studio-unsupported" data-testid="studio-unsupported">
        <div>
          <p className="eyebrow">Studio unsupported viewport</p>
          <h3>창을 넓혀 데스크톱 환경에서 열어주세요.</h3>
          <p>제작 워크스페이스는 1280x720 이상에서 사용할 수 있습니다.</p>
          <p className="page-muted">현재 창: {viewport.width}x{viewport.height}</p>
        </div>
        <div className="button-row">
          <Button icon={<Eye size={16} />} onClick={() => {
            recordUXDecisionEvent({ eventName: "abandoned", outcome: "abandoned" });
            onNavigate(unsupportedProjectPath);
          }} variant="primary">
            프로젝트 상세로 이동
          </Button>
          <Button icon={<GitBranch size={16} />} onClick={() => {
            recordUXDecisionEvent({ eventName: "abandoned", outcome: "abandoned" });
            onNavigate("/projects");
          }} variant="ghost">
            프로젝트 목록
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={navigationLabel} className="studio-workspace" data-testid="studio-workspace" style={rootStyle}>
      <header aria-label="Top command bar" className="studio-command-bar">
        <div className="studio-command-main">
          <strong>{project?.title || "VN Maker Studio"}</strong>
          <StatusChip tone={saveState === "failed" || saveState === "apiFailure" ? "danger" : dirty ? "warning" : "success"}>
            {saveState === "saving" ? "saving" : saveState === "failed" ? "저장 실패" : saveState === "apiFailure" ? "API failure" : dirty ? "dirty" : "saved"}
          </StatusChip>
          <StatusChip tone={problemCount > 0 ? (errorCount > 0 ? "danger" : "warning") : "success"}>Problems {problemCount}</StatusChip>
          <span className="studio-command-status">{statusText}</span>
        </div>
        <div className="studio-command-actions">
          <Button disabled={!draftScene || saveState === "saving" || !contentDirty} icon={<Save size={16} />} onClick={() => void saveDraftScene()} variant="primary">
            저장
          </Button>
          <Button disabled={saveState === "saving"} icon={<RefreshCw size={16} />} onClick={() => void validateStudio()}>
            검증
          </Button>
          <Button disabled={Boolean(previewDisabledReason)} icon={<Play size={16} />} onClick={() => onNavigate(`/projects/${projectId}/preview`)} title={previewDisabledReason || "프리뷰로 이동"}>
            프리뷰
          </Button>
          <Button icon={<Settings size={16} />} onClick={() => updateLayout(defaultStudioLayout)} variant="ghost">
            레이아웃 리셋
          </Button>
          <DiagnosticDrawer summary="Diagnostics">
            <dl className="summary-list">
              <div><dt>query</dt><dd>?scene={selectedScene?.id || "none"} · ?panel={selectedPanel}</dd></div>
              <div><dt>revision</dt><dd>{revisionStatusText(localRevision)}</dd></div>
              <div><dt>preview disabled reason</dt><dd>{previewDisabledReason || "없음"}</dd></div>
              <div><dt>검증 stale</dt><dd>{dirty ? "저장되지 않은 변경으로 stale 가능" : "현재 draft 기준"}</dd></div>
            </dl>
          </DiagnosticDrawer>
        </div>
      </header>

      <div className="studio-layout-controls" aria-label="Studio layout settings">
        <label>
          <span>Route flow map 폭</span>
          <input max="380" min="200" onChange={(event) => updateLayout({ routeWidth: Number(event.target.value) })} type="range" value={layout.routeWidth} />
        </label>
        <label>
          <span>Inspector 폭</span>
          <input max="460" min="280" onChange={(event) => updateLayout({ inspectorWidth: Number(event.target.value) })} type="range" value={layout.inspectorWidth} />
        </label>
        <label>
          <span>Problems 높이</span>
          <input max="320" min="128" onChange={(event) => updateLayout({ problemsHeight: Number(event.target.value) })} type="range" value={layout.problemsHeight} />
        </label>
      </div>

      <div className="studio-body">
        <aside aria-label="Route flow map" className={`studio-route-map ${layout.routeCollapsed ? "collapsed" : ""}`}>
          <div className="studio-panel-toolbar">
            <strong>Route flow map</strong>
            <Button icon={layout.routeCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />} iconOnly onClick={() => updateLayout({ routeCollapsed: !layout.routeCollapsed })} title="루트 패널 접기" />
          </div>
          {layout.routeCollapsed ? null : (
            <>
              <div className="button-row">
                <Button disabled={saveState === "saving"} icon={<Plus size={16} />} onClick={() => void createStartScene()} variant={scenes.length === 0 ? "primary" : "secondary"}>
                  시작 씬 만들기
                </Button>
              </div>
              {routeMapScenes.length > 0 ? (
                <ol className="studio-node-list">
                  {routeMapScenes.map((scene, index) => {
                    const sceneProblemCount = visibleIssues.filter((issue) => findIssueSceneId(issue, project) === scene.id).length;
                    return (
                      <li key={scene.id || index}>
                        <button className={`studio-node ${selectedScene?.id === scene.id ? "selected" : ""}`} onClick={() => selectScene(scene.id)} type="button">
                          <span className="studio-node-index">{index + 1}</span>
                          <span>
                            <strong>{sceneTitle(scene)}</strong>
                            <small>{scene.id}</small>
                          </span>
                          <span className="studio-node-badges">
                            {activeRoute?.entrySceneId === scene.id ? <StatusChip tone="success">Start</StatusChip> : null}
                            {scene.ending ? <StatusChip tone="warning">Ending</StatusChip> : null}
                            {(scene.choices || []).length > 0 ? <StatusChip>Choices {(scene.choices || []).length}</StatusChip> : null}
                            {sceneProblemCount > 0 ? <StatusChip tone="danger">{sceneProblemCount}</StatusChip> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState
                  action={<Button icon={<Plus size={16} />} onClick={() => void createStartScene()} variant="primary">시작 씬 만들기</Button>}
                  title="씬이 아직 없습니다."
                  description="첫 장면을 만들면 Route flow map과 Stage preview가 동시에 갱신됩니다."
                />
              )}
            </>
          )}
        </aside>

        <main className="studio-center">
          <section aria-label="Stage preview" className="studio-stage">
            <div className="studio-stage-header">
              <div>
                <strong>Stage preview</strong>
                <span>{previewDisabledReason || "프리뷰 이동 가능"} · 문제 {problemCount}건</span>
              </div>
              <div className="button-row">
                <Button disabled={!selectedScene || Boolean(draftScene?.ending) || (draftScene?.choices || []).length > 0 || saveState === "saving"} icon={<Plus size={16} />} onClick={() => void addSceneAfterCurrent()}>
                  현재 씬 뒤 새 씬
                </Button>
                <Button disabled={!selectedScene || Boolean(draftScene?.ending) || Boolean(draftScene?.next) || saveState === "saving"} icon={<GitBranch size={16} />} onClick={() => void createChoiceTargetScene()}>
                  선택지 target 생성
                </Button>
              </div>
            </div>
            <div className="studio-stage-frame">
              <div className="studio-stage-backdrop">
                <span>{assetLabel(sceneBackgroundAsset)}</span>
              </div>
              {sceneCgAsset ? <div className="studio-stage-cg">{assetLabel(sceneCgAsset)}</div> : null}
              <div className="studio-stage-characters">
                {(draftScene?.characters || []).map((character, index) => (
                  <span className={`studio-character-pill ${character.position || "center"}`} key={`${character.characterId || "character"}-${index}`}>
                    {characterLabel(project, character.characterId)}
                  </span>
                ))}
              </div>
              <div className="studio-dialogue-box">
                <strong>{draftScene?.speaker || "화자 없음"}</strong>
                <p>{draftScene?.text || "대사를 입력하면 이 영역에서 장면 톤을 확인할 수 있습니다."}</p>
                {(draftScene?.choices || []).length > 0 ? (
                  <div className="studio-choice-preview">
                    {(draftScene?.choices || []).map((choice, index) => <span key={choice.id || index}>{choice.text || "선택지"}</span>)}
                  </div>
                ) : null}
                {draftScene?.ending ? <StatusChip tone="warning">Ending · {draftScene.ending.title || draftScene.ending.id}</StatusChip> : null}
              </div>
            </div>
          </section>

          <section aria-label="Script editor" className="studio-script-editor">
            <header>
              <div>
                <strong>Script editor</strong>
                <span>{selectedScene?.id || "선택된 씬 없음"}</span>
              </div>
              <StatusChip tone={dirty ? "warning" : "success"}>{dirty ? "dirty" : "clean"}</StatusChip>
            </header>
            {draftScene ? (
              <div className="studio-editor-grid">
                <label className="field-row">
                  <span>label</span>
                  <input onChange={(event) => patchDraftScene({ label: event.target.value })} value={draftScene.label || ""} />
                </label>
                <label className="field-row">
                  <span>speaker</span>
                  <input onChange={(event) => patchDraftScene({ speaker: event.target.value })} value={draftScene.speaker || ""} />
                </label>
                <label className="field-row studio-editor-text">
                  <span>text</span>
                  <textarea ref={scriptTextareaRef} onChange={(event) => patchDraftScene({ text: event.target.value })} value={draftScene.text || ""} />
                </label>
              </div>
            ) : (
              <EmptyState title="선택된 씬이 없습니다." description="Route flow map에서 씬을 선택하거나 시작 씬을 만드세요." />
            )}
          </section>
        </main>

        <aside aria-label="Inspector" className={`studio-inspector ${layout.inspectorCollapsed ? "collapsed" : ""}`}>
          <div className="studio-panel-toolbar">
            <strong>Inspector</strong>
            <Button icon={layout.inspectorCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />} iconOnly onClick={() => updateLayout({ inspectorCollapsed: !layout.inspectorCollapsed })} title="인스펙터 접기" />
          </div>
          {layout.inspectorCollapsed ? null : (
            <>
              <div className="studio-panel-tabs" role="tablist">
                {panelTabs.map((tab) => (
                  <button className={selectedPanel === tab.id ? "selected" : ""} key={tab.id} onClick={() => setPanel(tab.id)} role="tab" type="button">
                    {tab.label}
                  </button>
                ))}
              </div>
              {draftScene ? (
                <div className="studio-inspector-body">
                  {selectedPanel === "scene" ? (
                    <section>
                      <h3>Scene</h3>
                      <label className="field-row">
                        <span>id</span>
                        <input readOnly ref={(element) => { inspectorFirstFieldRef.current = element; }} value={draftScene.id || ""} />
                      </label>
                      <label className="field-row">
                        <span>label</span>
                        <input onChange={(event) => patchDraftScene({ label: event.target.value })} value={draftScene.label || ""} />
                      </label>
                      <label className="field-row">
                        <span>speaker</span>
                        <input onChange={(event) => patchDraftScene({ speaker: event.target.value })} value={draftScene.speaker || ""} />
                      </label>
                      <label className="field-row">
                        <span>ending title</span>
                        <input onChange={(event) => patchDraftScene({ ending: { ...(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, kind: "normal" }), title: event.target.value } })} value={draftScene.ending?.title || ""} />
                      </label>
                      <label className="field-row">
                        <span>ending kind</span>
                        <select onChange={(event) => patchDraftScene({ ending: { ...(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, title: "새 엔딩" }), kind: event.target.value } })} value={draftScene.ending?.kind || "normal"}>
                          <option value="normal">normal</option>
                          <option value="good">good</option>
                          <option value="bad">bad</option>
                        </select>
                      </label>
                      <div className="button-row">
                        <Button disabled={saveState === "saving"} icon={<CheckCircle2 size={16} />} onClick={() => void setEnding(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, kind: "normal", title: "새 엔딩" })}>
                          엔딩 저장
                        </Button>
                        <Button disabled={saveState === "saving" || !draftScene.ending} icon={<RefreshCw size={16} />} onClick={() => void setEnding(null)} variant="ghost">
                          엔딩 해제
                        </Button>
                      </div>
                    </section>
                  ) : null}

                  {selectedPanel === "choices" ? (
                    <section>
                      <h3>Next 연결</h3>
                      <label className="field-row">
                        <span>next target</span>
                        <select
                          disabled={(draftScene.choices || []).length > 0 || Boolean(draftScene.ending)}
                          onChange={(event) => patchDraftScene({ next: event.target.value || undefined })}
                          ref={(element) => { inspectorFirstFieldRef.current = element; }}
                          value={draftScene.next || ""}
                        >
                          <option value="">없음</option>
                          {scenes.filter((scene) => scene.id !== draftScene.id).map((scene) => <option key={scene.id} value={scene.id}>{sceneTitle(scene)}</option>)}
                        </select>
                      </label>
                      <Button disabled={!draftScene.next || saveState === "saving"} icon={<GitBranch size={16} />} onClick={() => void linkExistingTarget({ targetSceneId: draftScene.next || "", type: "next" })}>
                        next 연결 저장
                      </Button>
                      <h3>Choices 연결</h3>
                      <div className="button-row">
                        <Button disabled={Boolean(draftScene.next) || Boolean(draftScene.ending)} icon={<Plus size={16} />} onClick={addChoiceDraft}>
                          선택지 추가
                        </Button>
                        <Button disabled={Boolean(draftScene.next) || Boolean(draftScene.ending) || saveState === "saving"} icon={<GitBranch size={16} />} onClick={() => void createChoiceTargetScene()}>
                          선택지 target 생성
                        </Button>
                      </div>
                      <ul className="studio-choice-list">
                        {(draftScene.choices || []).map((choice, index) => (
                          <li key={choice.id || index}>
                            <label className="field-row">
                              <span>choice text</span>
                              <input onChange={(event) => updateChoice(index, { text: event.target.value })} value={choice.text || ""} />
                            </label>
                            <label className="field-row">
                              <span>choice target</span>
                              <select onChange={(event) => updateChoice(index, { next: event.target.value })} value={choice.next || ""}>
                                <option value="">없음</option>
                                {scenes.filter((scene) => scene.id !== draftScene.id).map((scene) => <option key={scene.id} value={scene.id}>{sceneTitle(scene)}</option>)}
                              </select>
                            </label>
                            <div className="button-row">
                              <Button disabled={!choice.next || saveState === "saving"} onClick={() => void linkExistingTarget({ choiceId: choice.id, choiceText: choice.text, targetSceneId: choice.next || "", type: "choice" })}>
                                선택지 연결 저장
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedPanel === "stats" ? (
                    <section data-condition-runtime-support={conditionSupportMode}>
                      <h3>조건/효과 후보 검토</h3>
                      <p className="studio-disabled-note">
                        condition runtime support가 #105에서 확정되기 전까지 편집할 수 없습니다. 현재 support false입니다. {conditionStrictPreviewText}
                      </p>
                      <ul className="studio-readonly-list">
                        {(draftScene.choices || []).map((choice, index) => {
                          const hasCondition = Boolean(choice.condition && Object.keys(choice.condition).length);
                          const hasEffects = Boolean(choice.effects && Object.keys(choice.effects).length);
                          return (
                            <li key={choice.id || index}>
                              <strong>{choice.text || choice.id || "선택지"}</strong>
                              <span>조건 후보 {hasCondition ? "있음" : "없음"} · 효과 후보 {hasEffects ? "있음" : "없음"}</span>
                            </li>
                          );
                        })}
                        {repairActions.map((action, index) => (
                          <li key={`${action.actionId || "action"}-${index}`}>
                            <strong>{action.label || action.actionId || "수리 후보"}</strong>
                            <span>{action.disabledReason || action.description || action.targetPath || "검토 가능"}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedPanel === "assets" ? (
                    <section>
                      <h3>Assets</h3>
                      <label className="field-row">
                        <span>background</span>
                        <select onChange={(event) => patchDraftScene({ backgroundAssetId: event.target.value || undefined })} ref={(element) => { inspectorFirstFieldRef.current = element; }} value={draftScene.backgroundAssetId || ""}>
                          <option value="">연결 없음</option>
                          {backgroundAssets.map((asset) => <option key={asset.id || asset.uri} value={asset.id || ""}>{assetLabel(asset)}</option>)}
                        </select>
                      </label>
                      <label className="field-row">
                        <span>CG</span>
                        <select onChange={(event) => patchDraftScene({ cgAssetId: event.target.value || undefined })} value={draftScene.cgAssetId || ""}>
                          <option value="">연결 없음</option>
                          {cgAssets.map((asset) => <option key={asset.id || asset.uri} value={asset.id || ""}>{assetLabel(asset)}</option>)}
                        </select>
                      </label>
                      <h3>relative characters</h3>
                      <div className="button-row">
                        <Button disabled={!project?.characters?.length} icon={<Plus size={16} />} onClick={addCharacterDisplay}>
                          캐릭터 표시 추가
                        </Button>
                      </div>
                      <ul className="studio-choice-list">
                        {(draftScene.characters || []).map((character, index) => (
                          <li key={`${character.characterId || "character"}-${index}`}>
                            <label className="field-row">
                              <span>character</span>
                              <select onChange={(event) => updateCharacter(index, { characterId: event.target.value })} value={character.characterId || ""}>
                                <option value="">없음</option>
                                {(project?.characters || []).map((item) => <option key={item.id} value={item.id}>{characterLabel(project, item.id)}</option>)}
                              </select>
                            </label>
                            <label className="field-row">
                              <span>position</span>
                              <select onChange={(event) => updateCharacter(index, { position: event.target.value })} value={character.position || "center"}>
                                <option value="left">left</option>
                                <option value="center">center</option>
                                <option value="right">right</option>
                              </select>
                            </label>
                            <Button onClick={() => removeCharacterDisplay(index)} variant="ghost">삭제</Button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedPanel === "validation" ? (
                    <section>
                      <h3>Validation</h3>
                      <p className="studio-disabled-note">저장 실패, 검증 stale, API failure 상태를 여기서 확인합니다.</p>
                      <ul className="studio-problem-list compact">
                        {visibleIssues.map((issue, index) => (
                          <li key={`${issue.path || issue.code || "issue"}-${index}`}>
                            <button onClick={() => handleProblemFocus(issue)} type="button">
                              <StatusChip tone={issueTone(issue)}>{issue.severity || "info"}</StatusChip>
                              <span>{issueText(issue)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <h3>Generation result log</h3>
                      <label className="field-row">
                        <span>fixed prompt</span>
                        <select onChange={(event) => setSelectedFixedPromptId(event.target.value)} value={selectedFixedPrompt?.promptId || ""}>
                          {fixedPrompts.map((fixture) => (
                            <option key={fixture.promptId} value={fixture.promptId}>{fixture.promptId}</option>
                          ))}
                        </select>
                      </label>
                      <p className="studio-disabled-note">{selectedFixedPrompt?.promptText || generationStatus}</p>
                      <div className="button-row">
                        <Button disabled={generationBusy || fixedPrompts.length === 0} icon={<Play size={16} />} onClick={() => void replayFixedPrompt("actual")} variant="primary">
                          actual replay
                        </Button>
                        <Button disabled={generationBusy || fixedPrompts.length === 0} icon={<RefreshCw size={16} />} onClick={() => void replayFixedPrompt("mock")}>
                          mock replay
                        </Button>
                      </div>
                      <dl className="summary-list">
                        <div><dt>상태</dt><dd>{generationStatus}</dd></div>
                        <div><dt>classification</dt><dd><StatusChip tone={generationClassificationTone(generationLog?.classification)}>{generationLog?.classification || "not run"}</StatusChip></dd></div>
                        <div><dt>source</dt><dd>{generationSourceText(generationLog)}</dd></div>
                        <div><dt>resultId</dt><dd>{generationLog?.resultId || "기록 없음"}</dd></div>
                      </dl>
                      {renderPhase0ProtocolPanel()}
                    </section>
                  ) : null}
                </div>
              ) : selectedPanel === "validation" ? (
                <div className="studio-inspector-body">
                  {renderPhase0ProtocolPanel()}
                </div>
              ) : (
                <EmptyState title="Inspector 대상 없음" description="씬을 만들거나 선택하면 편집 필드가 표시됩니다." />
              )}
            </>
          )}
        </aside>
      </div>

      <section aria-label="Problems" className={`studio-problems-panel ${layout.problemsCollapsed ? "collapsed" : ""}`}>
        <div className="studio-panel-toolbar">
          <strong>Problems</strong>
          <div className="button-row">
            <Button icon={<ListChecks size={16} />} onClick={() => void validateStudio()} variant="ghost">
              다시 검증
            </Button>
            <Button icon={<AlertTriangle size={16} />} iconOnly onClick={() => updateLayout({ problemsCollapsed: !layout.problemsCollapsed })} title="문제 패널 접기" />
          </div>
        </div>
        {layout.problemsCollapsed ? null : (
          visibleIssues.length > 0 ? (
            <ul className="studio-problem-list">
              {visibleIssues.map((issue, index) => (
                <li key={`${issue.path || issue.code || "issue"}-${index}`}>
                  <button onClick={() => handleProblemFocus(issue)} type="button">
                    <StatusChip tone={issueTone(issue)}>{issue.severity || "info"}</StatusChip>
                    <span>{issueText(issue)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="page-muted">문제 없음. 저장 후 검증을 다시 실행하면 최신 상태가 표시됩니다.</p>
          )
        )}
      </section>
    </section>
  );
}
