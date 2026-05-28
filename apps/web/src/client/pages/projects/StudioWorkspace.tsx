import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  GitCompareArrows,
  GitBranch,
  LocateFixed,
  Maximize2,
  MousePointerClick,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Undo2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
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
  ProjectRepairActionRequiredInput,
  ProjectRepairHistoryEntry,
  ProjectRepairPreview,
  ProjectRevision,
  StudioIssueFocus,
  StudioProblemAction,
  StudioRouteGraphEdge,
  StudioRouteGraphNode,
  StudioRouteGraphView,
  StudioRouteSelection,
  Phase0DecisionReport,
  GenerationResultLog,
  TestPromptFixture,
  UXDecisionEventLog
} from "./projectPageTypes";
import { repairDiffOperationLabel, repairDiffValueText } from "./projectDisplayText";
import {
  activeRepairHistoryEntry,
  repairActionKey,
  repairActionMetaText,
  repairInputDisplayLabel,
  repairInputValue,
  repairRequestBody,
  repairResultMessage
} from "./projectRepairFlow";

export const STUDIO_MIN_WIDTH = 1280;
export const STUDIO_MIN_HEIGHT = 720;

type StudioPanelId = "scene" | "choices" | "stats" | "assets" | "validation";
type StudioSaveState = "idle" | "dirty" | "saving" | "saved" | "failed" | "apiFailure";
type ProjectScene = NonNullable<ProjectData["scenes"]>[number];
type ProjectRoute = NonNullable<ProjectData["routes"]>[number];
type SceneCharacter = NonNullable<ProjectScene["characters"]>[number];
type SceneChoice = NonNullable<ProjectScene["choices"]>[number];
type StudioCommandAddKind = "start" | "scene" | "choice";
type StudioLayoutResizeTarget = "route" | "inspector" | "problems";
type ProblemFilter = "all" | "errors" | "warnings" | "currentScene";
type ValidationRunState = "idle" | "running" | "current" | "stale";

const dirtyDraftDiscardMessage = "저장하지 않은 씬 변경 사항이 있습니다. 변경 사항을 버리고 이동할까요?";

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

interface StudioCommandAddAction {
  disabledReason?: string;
  kind: StudioCommandAddKind;
  label: string;
}

export function studioDefaultLayoutForViewport(viewportWidth = STUDIO_MIN_WIDTH, viewportHeight = STUDIO_MIN_HEIGHT): StudioLayout {
  const problemsHeight = viewportHeight <= STUDIO_MIN_HEIGHT ? 180 : 220;
  if (viewportWidth >= 1920) {
    return {
      routeWidth: 340,
      inspectorWidth: 420,
      problemsHeight,
      routeCollapsed: false,
      inspectorCollapsed: false,
      problemsCollapsed: false
    };
  }
  if (viewportWidth >= 1440) {
    return {
      routeWidth: 300,
      inspectorWidth: 380,
      problemsHeight,
      routeCollapsed: false,
      inspectorCollapsed: false,
      problemsCollapsed: false
    };
  }
  if (viewportWidth >= 1366) {
    return {
      routeWidth: 260,
      inspectorWidth: 340,
      problemsHeight: 180,
      routeCollapsed: false,
      inspectorCollapsed: false,
      problemsCollapsed: true
    };
  }
  return {
    routeWidth: 240,
    inspectorWidth: 320,
    problemsHeight: 180,
    routeCollapsed: false,
    inspectorCollapsed: false,
    problemsCollapsed: false
  };
}

const defaultStudioLayout: StudioLayout = studioDefaultLayoutForViewport();

const panelTabs: Array<{ id: StudioPanelId; label: string }> = [
  { id: "scene", label: "씬" },
  { id: "choices", label: "선택지" },
  { id: "stats", label: "조건" },
  { id: "assets", label: "에셋" },
  { id: "validation", label: "검증" }
];

const problemFilterTabs: Array<{ id: ProblemFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "errors", label: "Errors" },
  { id: "warnings", label: "Warnings" },
  { id: "currentScene", label: "Current Scene" }
];

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function studioLayoutStorageKey(projectId?: string): string {
  return `vn-maker:studio-layout:${projectId || "unknown"}`;
}

export function clampStudioLayout(input: Partial<StudioLayout>, fallback = defaultStudioLayout, viewportHeight = STUDIO_MIN_HEIGHT): StudioLayout {
  const maxProblemsHeight = Math.max(96, Math.floor(viewportHeight * 0.4));
  return {
    routeWidth: clampNumber(input.routeWidth, fallback.routeWidth, 240, 420),
    inspectorWidth: clampNumber(input.inspectorWidth, fallback.inspectorWidth, 320, 520),
    problemsHeight: clampNumber(input.problemsHeight, fallback.problemsHeight, 96, maxProblemsHeight),
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
  return cleanText(scene.label) || "이름 없는 씬";
}

function sceneSummaryText(scene?: ProjectScene | null): string {
  if (!scene) return "선택된 씬 없음";
  const speaker = cleanText(scene.speaker);
  const text = cleanText(scene.text).replace(/\s+/g, " ");
  if (speaker && text) return `${speaker} · ${text.slice(0, 32)}${text.length > 32 ? "..." : ""}`;
  if (speaker) return `${speaker} 대사`;
  if (text) return text.slice(0, 36) + (text.length > 36 ? "..." : "");
  if ((scene.choices || []).length > 0) return `선택지 ${(scene.choices || []).length}개`;
  if (scene.ending) return `엔딩: ${scene.ending.title || "제목 없음"}`;
  return "요약 없음";
}

function assetLabel(asset?: ProjectAsset | null): string {
  if (!asset) return "연결 없음";
  return asset.label || "이름 없는 에셋";
}

function characterLabel(project: ProjectData | null, characterId?: string): string {
  if (!characterId) return "캐릭터 없음";
  const character = (project?.characters || []).find((item) => item.id === characterId);
  return character?.displayName || character?.sourceHeroineName || "이름 없는 캐릭터";
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

function studioSceneSavePayload(draft: ProjectScene): ProjectScene {
  return {
    ...draft,
    characters: (draft.characters || []).map((character) => ({ ...character })),
    choices: (draft.choices || []).map((choice) => ({
      ...choice,
      condition: choice.condition ? { ...choice.condition } : undefined,
      effects: choice.effects ? { ...choice.effects } : undefined
    })),
    ending: draft.ending ? { ...draft.ending } : undefined
  };
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
  if (log.sourceType === "actual") return `실제 생성 · ${log.adapter || "어댑터 확인 필요"}`;
  if (log.sourceType === "mock") return `목 생성 · ${log.adapter || "어댑터 확인 필요"}`;
  return `사용 불가 · ${log.skippedReason || "사유 없음"}`;
}

function saveStateLabel(saveState: StudioSaveState, dirty: boolean): string {
  if (saveState === "saving") return "저장 중";
  if (saveState === "failed") return "저장 실패";
  if (saveState === "apiFailure") return "API 실패";
  if (dirty) return "변경됨";
  return "저장됨";
}

function studioCommandAddAction(input: { draftScene: ProjectScene | null; hasScenes: boolean; saveState: StudioSaveState }): StudioCommandAddAction {
  if (input.saveState === "saving") {
    return { disabledReason: "저장 중에는 구조를 변경할 수 없습니다.", kind: "scene", label: "씬 추가" };
  }
  if (!input.hasScenes) {
    return { kind: "start", label: "시작 씬 만들기" };
  }
  if (!input.draftScene) {
    return { kind: "start", label: "독립 씬 만들기" };
  }
  if (input.draftScene.ending) {
    return { disabledReason: "엔딩 씬에는 다음 씬이나 분기 target을 추가할 수 없습니다.", kind: "scene", label: "현재 씬 뒤 새 씬" };
  }
  if ((input.draftScene.choices || []).length > 0) {
    return { kind: "choice", label: "분기 target 만들기" };
  }
  if (input.draftScene.next) {
    return { disabledReason: "이미 다음 씬이 연결되어 있습니다.", kind: "scene", label: "현재 씬 뒤 새 씬" };
  }
  return { kind: "scene", label: "현재 씬 뒤 새 씬" };
}

function studioPreviewPath(projectId: string, routeId?: string, sceneId?: string): string {
  const params = new URLSearchParams();
  if (routeId) params.set("route", routeId);
  if (sceneId) params.set("scene", sceneId);
  const query = params.toString();
  return `/projects/${projectId}/preview${query ? `?${query}` : ""}`;
}

function problemCountLabel(problemCount: number): string {
  return problemCount === 0 ? "문제 0건" : `문제 ${problemCount}건`;
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

interface StudioProblemRow {
  actions: StudioProblemAction[];
  defaultActionLabel: string;
  focus?: StudioIssueFocus;
  issue: ProjectIssue;
  key: string;
}

interface RouteGraphNodeView {
  incomingEdges: StudioRouteGraphEdge[];
  node: StudioRouteGraphNode;
  outgoingEdges: StudioRouteGraphEdge[];
  problemCount: number;
  scene: ProjectScene | null;
}

function fallbackRouteGraphNode(scene: ProjectScene, activeRoute: ProjectRoute | null, reachable = true): StudioRouteGraphNode {
  return {
    id: scene.id,
    label: sceneTitle(scene),
    summary: sceneSummaryText(scene),
    routeId: activeRoute?.id,
    entry: activeRoute?.entrySceneId === scene.id,
    reachable,
    unreachable: !reachable,
    ending: Boolean(scene.ending)
  };
}

function routeGraphEdgeKindLabel(edge: StudioRouteGraphEdge): string {
  if (edge.kind === "route-entry") return "RouteEntry";
  if (edge.kind === "choice") return "ChoiceEdge";
  if (edge.kind === "next") return "NextEdge";
  return "Edge";
}

function routeGraphEdgeActionLabel(edge: StudioRouteGraphEdge): string {
  if (edge.kind === "choice") return "선택지 편집";
  if (edge.kind === "next") return "next 편집";
  if (edge.kind === "route-entry") return "시작 씬 보기";
  return "edge 보기";
}

function routeGraphEdgeText(edge: StudioRouteGraphEdge, targetLabel: string): string {
  const label = edge.label || (edge.kind === "choice" ? edge.choiceId : edge.kind) || "edge";
  return `${routeGraphEdgeKindLabel(edge)} · ${label} -> ${targetLabel}`;
}

function routeGraphNodeProblemCount(node: StudioRouteGraphNode, issues: ProjectIssue[]): number {
  return issues.filter((issue) => (issue.sceneIds || []).includes(node.id || "") || issue.targetSceneId === node.id).length;
}

function routeGraphNodeSeverity(node: StudioRouteGraphNode, problemCount: number): "danger" | "warning" | "neutral" {
  if (node.problemSeverity === "error") return "danger";
  if (node.problemSeverity === "warning") return "warning";
  return problemCount > 0 ? "danger" : "neutral";
}

function routeGraphZoomLabel(zoom: number): string {
  return `${zoom}%`;
}

function validationTimestampText(lastValidationAt: string): string {
  return lastValidationAt ? `ValidationTimestamp ${lastValidationAt}` : "ValidationTimestamp 검증 전";
}

function problemRowLocationText(row: StudioProblemRow, project: ProjectData | null): string {
  const sceneId = row.focus?.sceneId || findIssueSceneId(row.issue, project);
  const scene = project?.scenes?.find((item) => item.id === sceneId) || null;
  const panel = row.focus?.inspectorPanel || issuePanel(row.issue);
  return scene ? `${sceneTitle(scene)} · ${panel}` : panel;
}

function problemRowAffectedObjectText(row: StudioProblemRow): string {
  if (row.focus?.choiceId || row.issue.choiceIds?.[0]) {
    return `choice ${row.focus?.choiceId || row.issue.choiceIds?.[0]}`;
  }
  if (row.focus?.targetSceneId || row.issue.targetSceneId) {
    return `target ${row.focus?.targetSceneId || row.issue.targetSceneId}`;
  }
  return row.issue.path || row.issue.code || "프로젝트";
}

function problemRowStatusText(row: StudioProblemRow): string {
  if (row.actions.length > 0 || row.focus?.defaultAction === "repair") return "수리 가능";
  if (row.issue.severity === "error") return "해결 필요";
  if (row.issue.severity === "warning") return "검토 필요";
  return "확인";
}

function studioFocusToIssue(focus: StudioIssueFocus): ProjectIssue {
  return {
    code: focus.issueCode,
    message: focus.message,
    path: focus.path,
    sceneIds: focus.sceneId ? [focus.sceneId] : undefined,
    choiceIds: focus.choiceId ? [focus.choiceId] : undefined,
    targetSceneId: focus.targetSceneId,
    severity: focus.severity
  };
}

function studioFocusIdentity(focus: StudioIssueFocus): string {
  return focus.issueId || [
    focus.severity || "info",
    focus.issueCode || "validation-issue",
    focus.path || "",
    focus.message || ""
  ].join(":");
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

function studioIssueIdentity(issue: ProjectIssue): string {
  return [
    issue.severity || "info",
    issue.code || "validation-issue",
    issue.path || "",
    issue.message || ""
  ].join(":");
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

function uniqueStudioIssueFocuses(issues: StudioIssueFocus[]): StudioIssueFocus[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = studioFocusIdentity(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function studioFocusesFromResult(result: ProjectApiResult): StudioIssueFocus[] {
  const studio = result.studio;
  return uniqueStudioIssueFocuses([
    ...(studio?.issues || []),
    ...(studio?.previewPreflight?.blockers || []),
    ...(studio?.previewPreflight?.warnings || [])
  ]);
}

function problemDefaultActionLabel(focus: StudioIssueFocus | undefined, actions: StudioProblemAction[]): string {
  if (actions.length > 0 || focus?.defaultAction === "repair") return "수리 후보";
  if (focus?.defaultAction === "preview-blocker") return "프리뷰 차단";
  if (focus?.defaultAction === "focus") return "이동";
  return "확인";
}

function buildStudioProblemRows(
  studioIssues: StudioIssueFocus[],
  fallbackIssues: ProjectIssue[],
  problemActions: StudioProblemAction[]
): StudioProblemRow[] {
  const seen = new Set<string>();
  const rows: StudioProblemRow[] = uniqueStudioIssueFocuses(studioIssues).map((focus) => {
    const key = studioFocusIdentity(focus);
    seen.add(key);
    const actions = problemActions.filter((action) =>
      action.issueId === focus.issueId
      || (action.issueCode === focus.issueCode && action.targetPath === focus.path)
    );
    return {
      actions,
      defaultActionLabel: problemDefaultActionLabel(focus, actions),
      focus,
      issue: studioFocusToIssue(focus),
      key
    };
  });

  fallbackIssues.forEach((issue) => {
    const identity = studioIssueIdentity(issue);
    if (seen.has(identity)) {
      return;
    }
    const actions = problemActions.filter((action) => action.issueCode === issue.code && action.targetPath === issue.path);
    rows.push({
      actions,
      defaultActionLabel: problemDefaultActionLabel(undefined, actions),
      issue,
      key: identity
    });
    seen.add(identity);
  });

  return rows;
}

function resultIssues(result: ProjectApiResult): ProjectIssue[] {
  return result.issues
    || result.validation?.issues
    || result.runtime?.validation?.issues
    || [];
}

function revisionFromResult(result: ProjectApiResult): ProjectRevision | null {
  return result.projectRevision || result.studio?.projectRevision || result.previewPreflight?.projectRevision || result.actualRevision || null;
}

function resultSelectedSceneId(result: ProjectApiResult): string {
  return typeof result.selectedSceneId === "string" ? result.selectedSceneId : "";
}

function isApiTransportFailure(result: ProjectApiResult): boolean {
  return result.code === "NON_JSON_RESPONSE" || result.code === "EMPTY_RESPONSE" || result.code === "HTTP_ERROR" || result.code === "NETWORK_ERROR";
}

function isApiFailure(result: ProjectApiResult): boolean {
  return result.ok === false || isApiTransportFailure(result);
}

function failedResultStatusText(result: ProjectApiResult, fallbackStatus: string, apiFailure: boolean): string {
  const detail = result.message || result.error || fallbackStatus;
  if (result.code === "STALE_PROJECT_REVISION") {
    return `저장 실패: 리비전 충돌입니다. 최신 검증 결과를 확인한 뒤 다시 저장하세요. ${detail}`;
  }
  return `${apiFailure ? "API 실패" : "저장 실패"}: ${detail}`;
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
  if (issue.code === "ending-has-outgoing" || issue.code === "invalid-ending" || issue.code === "duplicate-ending-id" || path.includes("ending")) return "scene";
  if (issue.code === "background-required" || issue.code === "image-generation-incomplete" || path.includes("assets") || path.includes("generationJobs") || path.includes("background") || path.includes("cgAssetId") || path.includes("characters")) return "assets";
  if (path.includes("choices") || issue.choiceIds?.length || issue.code === "missing-target" || issue.code === "mixed-outgoing" || path.includes("next")) return "choices";
  return "scene";
}

function canonicalStudioQuery(current: URLSearchParams, nextValues: { route?: string; scene?: string; panel?: StudioPanelId; problem?: string }): URLSearchParams {
  const next = new URLSearchParams(current);
  if (nextValues.route !== undefined) {
    if (nextValues.route) next.set("route", nextValues.route);
    else next.delete("route");
  }
  if (nextValues.scene !== undefined) {
    if (nextValues.scene) next.set("scene", nextValues.scene);
    else next.delete("scene");
  }
  if (nextValues.panel !== undefined) {
    next.set("panel", nextValues.panel);
  } else if (!panelTabs.some((tab) => tab.id === next.get("panel"))) {
    next.set("panel", "scene");
  }
  if (nextValues.problem !== undefined) {
    if (nextValues.problem) next.set("problem", nextValues.problem);
    else next.delete("problem");
  }
  return next;
}

function revisionStatusText(revision: ProjectRevision | null): string {
  return revision?.revision ? `리비전 ${revision.revision}` : "리비전 확인 필요";
}

export function StudioWorkspace({
  navigationLabel = "제작 워크스페이스",
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
  const [layout, setLayout] = useState(() => studioDefaultLayoutForViewport());
  const [layoutStorageReadyKey, setLayoutStorageReadyKey] = useState("");
  const [draftScene, setDraftScene] = useState<ProjectScene | null>(null);
  const [draftBaseScene, setDraftBaseScene] = useState<ProjectScene | null>(null);
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
  const [localIssues, setLocalIssues] = useState<ProjectIssue[]>([]);
  const [localPreflightIssues, setLocalPreflightIssues] = useState<ProjectIssue[]>(() => preflightToIssues(previewPreflight));
  const [localStudioIssues, setLocalStudioIssues] = useState<StudioIssueFocus[]>([]);
  const [localProblemActions, setLocalProblemActions] = useState<StudioProblemAction[]>([]);
  const [localRepairActions, setLocalRepairActions] = useState<ProjectRepairAction[]>(repairActions);
  const [localRouteSelection, setLocalRouteSelection] = useState<StudioRouteSelection | null>(null);
  const [localRouteGraph, setLocalRouteGraph] = useState<StudioRouteGraphView | null>(null);
  const [studioRepairPreview, setStudioRepairPreview] = useState<ProjectRepairPreview | null>(null);
  const [studioRepairHistoryEntry, setStudioRepairHistoryEntry] = useState<ProjectRepairHistoryEntry | null>(null);
  const [studioRepairHistory, setStudioRepairHistory] = useState<ProjectRepairHistoryEntry[]>([]);
  const [studioRepairInputs, setStudioRepairInputs] = useState<Record<string, Record<string, string>>>({});
  const [studioRepairStatus, setStudioRepairStatus] = useState("수리 후보를 선택해 diff를 확인하세요.");
  const [studioRepairBusy, setStudioRepairBusy] = useState(false);
  const [localRevision, setLocalRevision] = useState<ProjectRevision | null>(projectRevision || previewPreflight?.projectRevision || null);
  const [routeSearchTerm, setRouteSearchTerm] = useState("");
  const [routeGraphZoom, setRouteGraphZoom] = useState(100);
  const [flowLegendCollapsed, setFlowLegendCollapsed] = useState(false);
  const [problemFilter, setProblemFilter] = useState<ProblemFilter>("all");
  const [lastValidationAt, setLastValidationAt] = useState("");
  const [validationRunState, setValidationRunState] = useState<ValidationRunState>("idle");
  const [focusedProblemId, setFocusedProblemId] = useState("");
  const [focusedFieldKey, setFocusedFieldKey] = useState("");
  const [focusRequestTick, setFocusRequestTick] = useState(0);
  const routeSearchRef = useRef<HTMLInputElement | null>(null);
  const scriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inspectorFirstFieldRef = useRef<HTMLElement | null>(null);
  const fieldFocusRefs = useRef<Record<string, HTMLElement | null>>({});
  const pendingProblemFocusRef = useRef<{
    fieldKey: string;
    focus?: StudioIssueFocus;
    panel: StudioPanelId;
    problemId: string;
    sceneId: string;
  } | null>(null);
  const pendingRouteGraphFocusRef = useRef<{
    fieldKey: string;
    panel: StudioPanelId;
    sceneId: string;
  } | null>(null);
  const confirmedSceneChangeRef = useRef<string | null>(null);
  const uxSessionIdRef = useRef(`studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  const projectId = project?.id || routeProjectId || "";
  const scenes = project?.scenes || [];
  const routes = project?.routes || [];
  const activeRouteIdQuery = searchParams.get("route") || localRouteSelection?.routeId || localRouteGraph?.routeId || "";
  const activeRoute = routes.find((route) => route.id === activeRouteIdQuery) || routes[0] || null;
  const selectedSceneQuery = searchParams.get("scene") || localRouteSelection?.selectedSceneId || localRouteGraph?.selectedSceneId || "";
  const selectedPanel = panelFromValue(searchParams.get("panel"));
  const selectedProblemQuery = searchParams.get("problem") || "";
  const selectedScene = useMemo(() => {
    const routeEntry = scenes.find((scene) => scene.id === activeRoute?.entrySceneId) || null;
    return scenes.find((scene) => scene.id === selectedSceneQuery) || routeEntry || scenes[0] || null;
  }, [activeRoute?.entrySceneId, scenes, selectedSceneQuery]);
  const draftSceneJson = useMemo(() => serializeScene(draftScene), [draftScene]);
  const draftBaseSceneJson = useMemo(() => serializeScene(draftBaseScene), [draftBaseScene]);
  const contentDirty = useMemo(() => JSON.stringify(sceneContentSnapshot(draftScene)) !== JSON.stringify(sceneContentSnapshot(draftBaseScene)), [draftSceneJson, draftBaseSceneJson]);
  const routingDirty = useMemo(() => JSON.stringify(sceneRoutingSnapshot(draftScene)) !== JSON.stringify(sceneRoutingSnapshot(draftBaseScene)), [draftSceneJson, draftBaseSceneJson]);
  const dirty = contentDirty || routingDirty;
  const fallbackIssues = useMemo(() => mergedStudioIssues(localIssues, localPreflightIssues), [localIssues, localPreflightIssues]);
  const problemRows = useMemo(() => buildStudioProblemRows(localStudioIssues, fallbackIssues, localProblemActions), [fallbackIssues, localProblemActions, localStudioIssues]);
  const visibleIssues = useMemo(() => problemRows.map((row) => row.issue), [problemRows]);
  const errorProblemCount = visibleIssues.filter((issue) => issue.severity === "error").length;
  const warningProblemCount = visibleIssues.filter((issue) => issue.severity === "warning").length;
  const currentSceneProblemCount = problemRows.filter((row) => (row.focus?.sceneId || findIssueSceneId(row.issue, project)) === selectedScene?.id).length;
  const filteredProblemRows = useMemo(() => {
    if (problemFilter === "errors") {
      return problemRows.filter((row) => row.issue.severity === "error");
    }
    if (problemFilter === "warnings") {
      return problemRows.filter((row) => row.issue.severity === "warning");
    }
    if (problemFilter === "currentScene") {
      return problemRows.filter((row) => (row.focus?.sceneId || findIssueSceneId(row.issue, project)) === selectedScene?.id);
    }
    return problemRows;
  }, [problemFilter, problemRows, project, selectedScene?.id]);
  const problemPanelState = validationRunState === "running"
    ? "running"
    : dirty
      ? "stale"
      : problemRows.length === 0
        ? "noProblems"
        : validationRunState;
  const conditionRuntimeSupport = previewPreflight?.conditionRuntimeSupport || previewPreflight?.runtimeCapabilities?.conditionRuntimeSupport || null;
  const conditionSupportMode = conditionRuntimeSupport?.editorMode || "candidate_review_only";
  const conditionStrictPreviewText = conditionRuntimeSupport?.strictPreviewStatus === "not_evaluated"
    ? "condition preview not evaluated"
    : "조건 판정 상태 확인 전";
  const problemCount = visibleIssues.length;
  const errorCount = errorProblemCount;
  const undoStudioRepairEntry = activeRepairHistoryEntry(studioRepairHistoryEntry);
  const previewDisabledReason = errorCount > 0
    ? `문제 ${errorCount}건을 먼저 해결해야 합니다.`
    : previewPreflight?.canRun === false
      ? previewPreflight.disabledReason || "프리뷰 실행 조건을 충족하지 못했습니다."
      : "";
  const previewCommandDisabledReason = dirty ? "저장 후 프리뷰를 실행하세요." : previewDisabledReason;
  const unsupported = viewport.width < STUDIO_MIN_WIDTH || viewport.height < STUDIO_MIN_HEIGHT;
  const backgroundAssets = (project?.assets || []).filter((asset) => asset.kind === "background");
  const cgAssets = (project?.assets || []).filter((asset) => asset.kind === "cg");
  const sceneBackgroundAsset = backgroundAssets.find((asset) => asset.id === draftScene?.backgroundAssetId) || null;
  const sceneCgAsset = cgAssets.find((asset) => asset.id === draftScene?.cgAssetId) || null;
  const unsupportedProjectPath = projectId ? `/projects/${projectId}/overview` : "/projects";
  const projectOverviewPath = projectId ? `/projects/${projectId}/overview` : "/projects";
  const sceneTitleInput = draftScene?.label || "";
  const canSaveStudioDraft = Boolean(draftScene && saveState !== "saving" && dirty);
  const commandAddAction = studioCommandAddAction({ draftScene, hasScenes: scenes.length > 0, saveState });
  const previewPath = projectId ? studioPreviewPath(projectId, activeRoute?.id, selectedScene?.id) : "/projects";
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
  const activeRouteGraph = useMemo(() => {
    if (!localRouteGraph) {
      return null;
    }
    if (!activeRoute?.id || localRouteGraph.routeId === activeRoute.id) {
      return localRouteGraph;
    }
    return null;
  }, [activeRoute?.id, localRouteGraph]);
  const routeGraphNodes = useMemo<StudioRouteGraphNode[]>(() => {
    if (activeRouteGraph?.nodes?.length) {
      return activeRouteGraph.nodes;
    }
    return routeMapScenes.map((scene, index) => fallbackRouteGraphNode(scene, activeRoute, index < routeMapScenes.length));
  }, [activeRoute, activeRouteGraph, routeMapScenes]);
  const routeGraphEdges = useMemo<StudioRouteGraphEdge[]>(() => {
    if (activeRouteGraph?.edges?.length) {
      return activeRouteGraph.edges;
    }
    const edges: StudioRouteGraphEdge[] = [];
    if (activeRoute?.entrySceneId) {
      edges.push({
        id: `fallback:${activeRoute.id}:entry:${activeRoute.entrySceneId}`,
        kind: "route-entry",
        targetSceneId: activeRoute.entrySceneId,
        label: activeRoute.title || activeRoute.id,
        missingTarget: !scenes.some((scene) => scene.id === activeRoute.entrySceneId)
      });
    }
    scenes.forEach((scene) => {
      if (scene.next) {
        edges.push({
          id: `fallback:${scene.id}:next:${scene.next}`,
          kind: "next",
          sourceSceneId: scene.id,
          targetSceneId: scene.next,
          label: "next",
          missingTarget: !scenes.some((candidate) => candidate.id === scene.next)
        });
      }
      (scene.choices || []).forEach((choice) => {
        edges.push({
          id: `fallback:${scene.id}:choice:${choice.id}:${choice.next}`,
          kind: "choice",
          sourceSceneId: scene.id,
          targetSceneId: choice.next,
          choiceId: choice.id,
          label: choice.text || choice.id,
          missingTarget: !scenes.some((candidate) => candidate.id === choice.next)
        });
      });
    });
    return edges;
  }, [activeRoute, activeRouteGraph, scenes]);
  const routeGraphNodeViews = useMemo<RouteGraphNodeView[]>(() => {
    const term = routeSearchTerm.trim().toLowerCase();
    const nodesById = new Map(routeGraphNodes.map((node) => [node.id || "", node]));
    return routeGraphNodes
      .map((node) => {
        const scene = scenes.find((item) => item.id === node.id) || null;
        const outgoingEdges = routeGraphEdges.filter((edge) => edge.sourceSceneId === node.id);
        const incomingEdges = routeGraphEdges.filter((edge) => edge.targetSceneId === node.id && edge.sourceSceneId !== node.id);
        return {
          incomingEdges,
          node,
          outgoingEdges,
          problemCount: routeGraphNodeProblemCount(node, visibleIssues),
          scene
        };
      })
      .filter((view) => {
        if (!term) {
          return true;
        }
        const edgeText = [...view.outgoingEdges, ...view.incomingEdges].map((edge) => {
          const target = nodesById.get(edge.targetSceneId || "");
          return `${edge.label || ""} ${edge.choiceId || ""} ${edge.targetSceneId || ""} ${target?.label || ""}`;
        }).join(" ");
        const haystack = `${view.node.label || ""} ${view.node.summary || ""} ${view.node.id || ""} ${edgeText}`.toLowerCase();
        return haystack.includes(term);
      });
  }, [routeGraphEdges, routeGraphNodes, routeSearchTerm, scenes, visibleIssues]);
  const routeGraphRouteTitle = activeRouteGraph?.routeTitle || localRouteSelection?.routeTitle || activeRoute?.title || activeRoute?.id || "루트 없음";
  const routeGraphSelectedSceneId = selectedScene?.id || activeRouteGraph?.selectedSceneId || localRouteSelection?.selectedSceneId || "";
  const routeGraphProblemCount = activeRouteGraph?.markers?.problemSceneIds?.length || problemCount;
  const routeGraphDataSourceText = activeRouteGraph ? "route graph DTO" : "fallback route graph DTO 대기";

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

  function setFocusTargets(keys: string[], element: HTMLElement | null): void {
    keys.filter(Boolean).forEach((key) => {
      if (element) {
        fieldFocusRefs.current[key] = element;
      } else {
        delete fieldFocusRefs.current[key];
      }
    });
  }

  function focusedClass(...keys: Array<string | undefined>): string {
    return keys.some((key) => key && key === focusedFieldKey) ? " focused" : "";
  }

  function applyStudioDtoState(result: ProjectApiResult, options: { clearWhenAbsent?: boolean } = {}): void {
    const studioIssues = studioFocusesFromResult(result);
    if (result.studio || studioIssues.length > 0) {
      setLocalStudioIssues(studioIssues);
    } else if (options.clearWhenAbsent) {
      setLocalStudioIssues([]);
    }
    if (Array.isArray(result.problemActions)) {
      setLocalProblemActions(result.problemActions);
    } else if (options.clearWhenAbsent) {
      setLocalProblemActions([]);
    }
    if (Array.isArray(result.repairActions)) {
      setLocalRepairActions(result.repairActions);
    }
    if (result.studio?.routeSelection) {
      setLocalRouteSelection(result.studio.routeSelection);
    } else if (options.clearWhenAbsent) {
      setLocalRouteSelection(null);
    }
    if (result.studio?.routeGraph) {
      setLocalRouteGraph(result.studio.routeGraph);
    } else if (options.clearWhenAbsent) {
      setLocalRouteGraph(null);
    }
    if (result.previewPreflight) {
      setLocalPreflightIssues(preflightToIssues(result.previewPreflight));
    } else if (options.clearWhenAbsent) {
      setLocalPreflightIssues([]);
    }
    if (result.validation || result.previewPreflight || result.studio) {
      setLastValidationAt(new Date().toISOString());
      setValidationRunState("current");
    }
  }

  function focusProblemTarget(focus: StudioIssueFocus | undefined, panel: StudioPanelId): void {
    const field = focus?.field || "";
    const candidates = [
      focus?.issueId ? `issue:${focus.issueId}` : "",
      focus?.choiceId && field ? `choice:${focus.choiceId}:${field}` : "",
      field ? `${panel}:${field}` : "",
      field,
      focus?.scriptBlockId || "",
      focus?.sceneId ? `scene:${focus.sceneId}` : ""
    ].filter(Boolean);
    window.setTimeout(() => {
      const target = candidates.map((key) => fieldFocusRefs.current[key]).find(Boolean)
        || (panel === "scene" ? scriptTextareaRef.current : inspectorFirstFieldRef.current)
        || scriptTextareaRef.current;
      target?.focus();
    }, 0);
  }

  useEffect(() => {
    if (!projectDirectory) {
      return;
    }
    recordUXDecisionEvent({ eventName: "started", outcome: "started", inputMode: "manual" });
  }, [projectDirectory, projectId]);

  useEffect(() => {
    setLocalRepairActions(repairActions);
  }, [repairActions]);

  useEffect(() => {
    if (dirty) {
      setValidationRunState("stale");
    }
  }, [dirty]);

  useEffect(() => {
    if (!projectDirectory || !activeRoute?.id || dirty || saveState === "saving" || unsupported) {
      return;
    }
    let cancelled = false;
    async function loadStudioContext(): Promise<void> {
      try {
        const result = await postJson("/api/project/studio/context", {
          projectDirectory,
          routeId: activeRoute?.id,
          sceneId: selectedScene?.id,
          problemId: selectedProblemQuery || undefined
        });
        if (cancelled) {
          return;
        }
        if (isApiFailure(result)) {
          return;
        }
        applyStudioDtoState(result);
        setLocalIssues(resultIssues(result));
        const nextRevision = revisionFromResult(result);
        if (nextRevision) {
          setLocalRevision(nextRevision);
        }
        if (result.project || result.previewPreflight) {
          onProjectResult(result);
        }
      } catch {
        // Studio context refresh is opportunistic; explicit validate/save surfaces failures.
      }
    }
    void loadStudioContext();
    return () => {
      cancelled = true;
    };
  }, [activeRoute?.id, dirty, localRevision?.revision, projectDirectory, saveState, selectedProblemQuery, selectedScene?.id, unsupported]);

  useEffect(() => {
    const pending = pendingProblemFocusRef.current;
    if (!pending) {
      return;
    }
    if (pending.sceneId && selectedScene?.id !== pending.sceneId) {
      return;
    }
    if (selectedPanel !== pending.panel) {
      return;
    }
    if (layout.inspectorCollapsed) {
      return;
    }
    pendingProblemFocusRef.current = null;
    setFocusedProblemId(pending.problemId);
    setFocusedFieldKey(pending.fieldKey);
    focusProblemTarget(pending.focus, pending.panel);
  }, [draftScene?.id, focusRequestTick, layout.inspectorCollapsed, selectedPanel, selectedScene?.id]);

  useEffect(() => {
    const pending = pendingRouteGraphFocusRef.current;
    if (!pending) {
      return;
    }
    if (pending.sceneId && selectedScene?.id !== pending.sceneId) {
      return;
    }
    if (selectedPanel !== pending.panel) {
      return;
    }
    if (layout.inspectorCollapsed) {
      return;
    }
    pendingRouteGraphFocusRef.current = null;
    setFocusedFieldKey(pending.fieldKey);
    window.setTimeout(() => {
      const target = fieldFocusRefs.current[pending.fieldKey]
        || inspectorFirstFieldRef.current
        || scriptTextareaRef.current;
      target?.focus();
    }, 0);
  }, [draftScene?.id, focusRequestTick, layout.inspectorCollapsed, selectedPanel, selectedScene?.id]);

  useEffect(() => {
    setLocalPreflightIssues(preflightToIssues(previewPreflight));
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
    const viewportDefaultLayout = studioDefaultLayoutForViewport(viewport.width, viewport.height);
    const key = studioLayoutStorageKey(projectId);
    setLayoutStorageReadyKey("");
    try {
      const raw = localStorage.getItem(key);
      setLayout(raw ? clampStudioLayout(JSON.parse(raw) as Partial<StudioLayout>, viewportDefaultLayout, viewport.height) : viewportDefaultLayout);
    } catch {
      setLayout(viewportDefaultLayout);
    } finally {
      setLayoutStorageReadyKey(key);
    }
  }, [projectId]);

  useEffect(() => {
    const key = projectId ? studioLayoutStorageKey(projectId) : "";
    if (!key || layoutStorageReadyKey !== key) return;
    localStorage.setItem(key, JSON.stringify(clampStudioLayout(layout, studioDefaultLayoutForViewport(viewport.width, viewport.height), viewport.height)));
  }, [layout, layoutStorageReadyKey, projectId, viewport.height, viewport.width]);

  useEffect(() => {
    const currentDraftSceneId = draftBaseScene?.id || null;
    const nextSceneId = selectedScene?.id || null;
    const confirmedSceneChange = confirmedSceneChangeRef.current === nextSceneId;
    if (currentDraftSceneId === nextSceneId) {
      return;
    }
    if (dirty && currentDraftSceneId && !confirmedSceneChange) {
      const confirmed = window.confirm(dirtyDraftDiscardMessage);
      if (!confirmed) {
        setSaveState("dirty");
        setStatusText("저장하지 않은 씬 변경 사항이 있어 이동을 취소했습니다.");
        setSearchParams(canonicalStudioQuery(searchParams, { scene: currentDraftSceneId }), { replace: true });
        return;
      }
    }
    confirmedSceneChangeRef.current = null;
    setDraftScene(cloneScene(selectedScene));
    setDraftBaseScene(cloneScene(selectedScene));
    setSaveState("idle");
  }, [dirty, draftBaseScene?.id, searchParams, selectedScene, selectedScene?.id, setSearchParams]);

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
    if (!dirty || saveState === "saving") {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty, saveState]);

  useEffect(() => {
    function handleStudioShortcuts(event: KeyboardEvent): void {
      const commandPressed = event.metaKey || event.ctrlKey;
      if (!commandPressed) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        runSaveCommand();
      } else if (event.key === "Enter") {
        event.preventDefault();
        openPreview();
      } else if (key === "k") {
        event.preventDefault();
        focusRouteSearch();
      }
    }
    window.addEventListener("keydown", handleStudioShortcuts);
    return () => window.removeEventListener("keydown", handleStudioShortcuts);
  }, [activeRoute?.id, dirty, draftScene, layout.routeCollapsed, previewCommandDisabledReason, previewPath, previewPreflight, projectId, saveState, selectedScene?.id]);

  useEffect(() => {
    const next = canonicalStudioQuery(searchParams, {
      panel: selectedPanel,
      route: activeRoute?.id || "",
      scene: selectedScene?.id || selectedSceneQuery || ""
    });
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeRoute?.id, searchParams, selectedPanel, selectedScene?.id, selectedSceneQuery, setSearchParams]);

  function updateQuery(nextValues: { route?: string; scene?: string; panel?: StudioPanelId; problem?: string }, replace = false): void {
    const next = canonicalStudioQuery(searchParams, nextValues);
    setSearchParams(next, { replace });
  }

  function confirmDiscardDirtyDraft(): boolean {
    if (!dirty) {
      return true;
    }
    const confirmed = window.confirm(dirtyDraftDiscardMessage);
    if (!confirmed) {
      setSaveState("dirty");
      setStatusText("저장하지 않은 씬 변경 사항이 있어 이동을 취소했습니다.");
      return false;
    }
    return true;
  }

  function selectScene(sceneId?: string, options: { force?: boolean } = {}): void {
    if (!sceneId) return;
    if (selectedScene?.id !== sceneId) {
      if (!options.force && !confirmDiscardDirtyDraft()) return;
      confirmedSceneChangeRef.current = sceneId;
    }
    updateQuery({ scene: sceneId });
  }

  function selectRoute(routeId: string): void {
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      setStatusText("선택할 route를 찾을 수 없습니다.");
      return;
    }
    const nextSceneId = route.entrySceneId || selectedScene?.id || "";
    if (nextSceneId && nextSceneId !== selectedScene?.id && !confirmDiscardDirtyDraft()) {
      return;
    }
    if (nextSceneId && nextSceneId !== selectedScene?.id) {
      confirmedSceneChangeRef.current = nextSceneId;
    }
    updateQuery({ panel: selectedPanel, route: route.id, scene: nextSceneId });
    setStatusText(`${route.title || route.id} route로 이동했습니다.`);
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
    setLayout((current) => clampStudioLayout({ ...current, ...nextLayout }, current, viewport.height));
  }

  function focusRouteSearch(): void {
    if (layout.routeCollapsed) {
      updateLayout({ routeCollapsed: false });
      setStatusText("루트 맵을 펼치고 검색으로 이동했습니다.");
    } else {
      setStatusText("루트 맵 검색으로 이동했습니다.");
    }
    window.setTimeout(() => routeSearchRef.current?.focus(), 0);
  }

  function openProblemsPanel(): void {
    updateLayout({ problemsCollapsed: false });
    setStatusText(`Problems Panel을 열었습니다. ${problemCountLabel(problemCount)}`);
  }

  function updateRouteGraphZoom(nextZoom: number): void {
    setRouteGraphZoom(Math.min(140, Math.max(80, nextZoom)));
  }

  function fitSelectedRouteNode(): void {
    if (layout.routeCollapsed) {
      updateLayout({ routeCollapsed: false });
    }
    const selectedLabel = selectedScene ? sceneTitle(selectedScene) : "선택 씬 없음";
    setRouteSearchTerm("");
    setStatusText(`선택 씬 맞춤: ${selectedLabel}`);
  }

  function fitRouteGraph(): void {
    if (layout.routeCollapsed) {
      updateLayout({ routeCollapsed: false });
    }
    setRouteGraphZoom(100);
    setRouteSearchTerm("");
    setStatusText(`${routeGraphRouteTitle} route 맞춤. ${routeGraphNodes.length}개 SceneNode와 ${routeGraphEdges.length}개 edge를 표시합니다.`);
  }

  function focusRouteGraphEdge(edge: StudioRouteGraphEdge): void {
    const sceneId = edge.sourceSceneId || edge.targetSceneId || "";
    if (sceneId && sceneId !== selectedScene?.id && !confirmDiscardDirtyDraft()) {
      return;
    }
    const panel: StudioPanelId = edge.kind === "choice" || edge.kind === "next" ? "choices" : "scene";
    const fieldKey = edge.kind === "choice" && edge.choiceId
      ? `choice:${edge.choiceId}:choiceTarget`
      : edge.kind === "next"
        ? "choices:next"
        : "scene:label";
    if (sceneId && sceneId !== selectedScene?.id) {
      confirmedSceneChangeRef.current = sceneId;
    }
    if (layout.inspectorCollapsed) {
      updateLayout({ inspectorCollapsed: false });
    }
    pendingRouteGraphFocusRef.current = { fieldKey, panel, sceneId };
    setFocusedFieldKey(fieldKey);
    setFocusRequestTick((current) => current + 1);
    updateQuery({
      panel,
      route: activeRoute?.id || "",
      scene: sceneId || selectedScene?.id || "",
      problem: selectedProblemQuery
    });
    recordUXDecisionEvent({
      eventName: "help_opened",
      helpChannel: edge.kind === "choice" ? "ChoiceEdge" : edge.kind === "next" ? "NextEdge" : "SceneNode",
      outcome: "opened",
      repairActionId: edge.id
    });
    setStatusText(`${routeGraphEdgeKindLabel(edge)}를 선택했습니다. ${routeGraphEdgeActionLabel(edge)} 위치로 이동합니다.`);
  }

  function runSaveCommand(): void {
    if (!draftScene) {
      setStatusText("저장할 씬이 없습니다.");
      return;
    }
    if (saveState === "saving") {
      setStatusText("이미 저장 중입니다.");
      return;
    }
    if (!dirty) {
      setStatusText("저장할 Studio 변경이 없습니다.");
      return;
    }
    void saveStudioDraft();
  }

  function openPreview(): void {
    if (!projectId) {
      setStatusText("프리뷰를 열 프로젝트가 없습니다.");
      return;
    }
    if (previewCommandDisabledReason) {
      setStatusText(`프리뷰 제한: ${previewCommandDisabledReason}`);
      return;
    }
    recordUXDecisionEvent({
      eventName: "previewed",
      outcome: previewPreflight?.canRun === true ? "started" : "opened",
      preflightResult: previewPreflight || undefined
    });
    onNavigate(previewPath);
  }

  function runCommandAddAction(): void {
    if (commandAddAction.disabledReason) {
      setStatusText(commandAddAction.disabledReason);
      return;
    }
    if (commandAddAction.kind === "start") {
      void createStartScene();
      return;
    }
    if (commandAddAction.kind === "choice") {
      void createChoiceTargetScene();
      return;
    }
    void addSceneAfterCurrent();
  }

  function handleLayoutSplitterKeyDown(target: StudioLayoutResizeTarget, event: ReactKeyboardEvent<HTMLButtonElement>): void {
    const horizontalKeys = ["ArrowLeft", "ArrowRight"];
    const verticalKeys = ["ArrowUp", "ArrowDown"];
    if (target === "problems" ? !verticalKeys.includes(event.key) : !horizontalKeys.includes(event.key)) {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
    const step = 24;
    if (target === "route") {
      updateLayout({ routeWidth: layout.routeWidth + (direction * step) });
    } else if (target === "inspector") {
      updateLayout({ inspectorWidth: layout.inspectorWidth - (direction * step) });
    } else {
      updateLayout({ problemsHeight: layout.problemsHeight + (direction * step) });
    }
  }

  function startLayoutResize(target: StudioLayoutResizeTarget, startX: number, startY: number): void {
    const startRouteWidth = layout.routeWidth;
    const startInspectorWidth = layout.inspectorWidth;
    const startProblemsHeight = layout.problemsHeight;

    function handlePointerMove(event: PointerEvent): void {
      if (target === "route") {
        updateLayout({ routeWidth: startRouteWidth + event.clientX - startX });
      } else if (target === "inspector") {
        updateLayout({ inspectorWidth: startInspectorWidth - (event.clientX - startX) });
      } else {
        updateLayout({ problemsHeight: startProblemsHeight - (event.clientY - startY) });
      }
    }

    function stopPointerMove(): void {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopPointerMove);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopPointerMove, { once: true });
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
    setGenerationStatus(adapterMode === "actual" ? "실제 생성 경로로 재생 중입니다." : "목 생성 경로로 재생 중입니다.");
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
      setPhase0Status(`이벤트 로그 ID ${result.eventLogId || result.eventLog?.eventLogId || "기록 없음"} export 완료`);
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
      setPhase0Status(`Phase 0 판정 ${result.phase0DecisionReport?.decision || "Iterate"} · 이벤트 로그 ID ${result.phase0DecisionReport?.sessions?.[0]?.eventLogId || "기록 없음"}`);
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
        <p className="studio-disabled-note">Ready/Partial/Missing 작업 패키지, 고정/자유 입력 분리, 이벤트 로그 ID, 프리플라이트 결과 기준으로 Go · Iterate · Stop/Rethink를 계산합니다.</p>
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
          <div><dt>이벤트 로그 ID</dt><dd>{phase0Report?.sessions?.[0]?.eventLogId || phase0EventLog?.eventLogId || "export 전"}</dd></div>
          <div><dt>판정</dt><dd>{phase0Report?.decision || "계산 전"}</dd></div>
          <div><dt>고정/자유 입력</dt><dd>고정 {phase0Report?.fixedInputMetrics?.sessionCount ?? 0} · 자유 {phase0Report?.freeInputFindings?.sessionCount ?? 0}</dd></div>
          <div data-contract-copy="preflightResult"><dt>프리플라이트 결과</dt><dd>{phase0Report?.conditionRuntime?.actualPreviewCanRun ? "실제 프리뷰 근거 있음" : "실제 프리뷰 근거 확인 전"}</dd></div>
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
        <DiagnosticDrawer summary="Phase 0 판정 원문">
          <pre data-contract-copy="Phase 0 decision report">{phase0Report ? JSON.stringify({ phase0DecisionReport: phase0Report, eventLog: phase0EventLog }, null, 2) : "Phase 0 판정 원문 없음"}</pre>
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

  function applySuccessfulResult(result: ProjectApiResult, fallbackStatus: string, options: { preserveContext?: boolean; selectedSceneId?: string } = {}): void {
    const nextRevision = revisionFromResult(result);
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
    applyStudioDtoState(result);
    setLocalIssues(resultIssues(result));
    onProjectResult(result);
    const nextSelectedSceneId = options.selectedSceneId || resultSelectedSceneId(result);
    if (options.preserveContext) {
      const selectedSceneId = nextSelectedSceneId || selectedScene?.id || draftScene?.id || "";
      updateQuery({
        panel: selectedPanel,
        route: activeRoute?.id || "",
        scene: selectedSceneId
      }, true);
      const savedScene = result.project?.scenes?.find((scene) => scene.id === selectedSceneId) || draftScene;
      setDraftScene(cloneScene(savedScene || null));
      setDraftBaseScene(cloneScene(savedScene || null));
      setSaveState("saved");
      setStatusText(result.message || fallbackStatus);
      return;
    }
    if (nextSelectedSceneId) {
      selectScene(nextSelectedSceneId, { force: true });
    } else if (draftScene) {
      setDraftBaseScene(cloneScene(draftScene));
    }
    if (nextSelectedSceneId && nextSelectedSceneId === selectedScene?.id && draftScene) {
      setDraftBaseScene(cloneScene(draftScene));
    }
    setSaveState("saved");
    setStatusText(result.message || fallbackStatus);
  }

  function applyFailedResult(result: ProjectApiResult, fallbackStatus: string): void {
    const issues = resultIssues(result);
    if (issues.length > 0) {
      setLocalIssues(issues);
    }
    applyStudioDtoState(result);
    const nextRevision = revisionFromResult(result);
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
    if (result.project || result.previewPreflight || result.previewReadiness || result.exportPlan) {
      onProjectResult(result);
    }
    const apiFailure = isApiTransportFailure(result);
    setSaveState(apiFailure ? "apiFailure" : "failed");
    setStatusText(failedResultStatusText(result, fallbackStatus, apiFailure));
  }

  async function validateStudio(): Promise<ProjectRevision | null> {
    if (dirty) {
      setSaveState("dirty");
      setValidationRunState("stale");
      setStatusText("저장하지 않은 씬 변경 사항이 있습니다. 저장 후 검증을 실행하세요.");
      return null;
    }
    setValidationRunState("running");
    setStatusText("검증을 실행하는 중입니다.");
    try {
      const result = await postJson("/api/project/validate", { projectDirectory });
      const nextRevision = revisionFromResult(result);
      if (result.project || result.previewPreflight || result.previewReadiness || result.exportPlan) {
        onProjectResult(result);
      }
      applyStudioDtoState(result, { clearWhenAbsent: true });
      setLocalIssues(resultIssues(result));
      if (nextRevision) {
        setLocalRevision(nextRevision);
      }
      if (isApiFailure(result)) {
        setSaveState("apiFailure");
        setValidationRunState("idle");
        setStatusText(`API 실패: ${result.message || result.error || "검증을 실행하지 못했습니다."}`);
        return null;
      }
      setLastValidationAt(new Date().toISOString());
      setValidationRunState("current");
      setStatusText(resultIssues(result).length > 0 ? "검증 갱신 필요: 문제 확인 결과가 갱신되었습니다." : "검증 완료. 문제 없음.");
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
      setValidationRunState("idle");
      setStatusText(`API 실패: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async function ensureRevision(): Promise<ProjectRevision | null> {
    if (localRevision) {
      return localRevision;
    }
    return validateStudio();
  }

  async function saveStudioDraft(): Promise<void> {
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
    setStatusText("Studio 변경 사항을 저장하는 중입니다.");
    try {
      const result = await postJson("/api/project/studio/mutate", {
        expectedProjectRevision,
        operations: [
          {
            type: "upsertScene",
            scene: studioSceneSavePayload(draftScene)
          }
        ],
        projectDirectory,
        routeId: activeRoute?.id,
        sceneId: draftScene.id
      });
      if (isApiFailure(result)) {
        applyFailedResult(result, "Studio 저장을 완료하지 못했습니다.");
        return;
      }
      applySuccessfulResult(result, "Studio 저장 완료.", { preserveContext: true, selectedSceneId: draftScene.id });
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API 실패: ${error instanceof Error ? error.message : String(error)}`);
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
      setStatusText(`API 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function createStartScene(): Promise<void> {
    if (!confirmDiscardDirtyDraft()) {
      return;
    }
    const route = activeRoute as ProjectRoute | null;
    const seedLabel = route?.title ? `${route.title} 시작` : "시작 씬";
    await insertScene(newScene(project, seedLabel), { link: { type: "none" } }, "시작 씬 만들기 완료.");
  }

  async function addSceneAfterCurrent(): Promise<void> {
    if (!selectedScene?.id) {
      setStatusText("기준 씬을 먼저 선택해야 합니다.");
      return;
    }
    if (!confirmDiscardDirtyDraft()) {
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
    if (!confirmDiscardDirtyDraft()) {
      return;
    }
    await insertScene(
      newScene(project, "선택지 대상 생성", draftScene?.speaker || ""),
      {
        link: { choiceText: "새 선택지", type: "choice" },
        sourceSceneId: selectedScene.id
      },
      "선택지 대상 생성 완료."
    );
  }

  function applyDraftEnding(ending: ProjectScene["ending"] | null): void {
    if (!draftScene?.id) {
      setStatusText("엔딩을 설정할 씬을 먼저 선택해야 합니다.");
      return;
    }
    setDraftScene((current) => {
      if (!current) return current;
      if (!ending) {
        return { ...current, ending: undefined };
      }
      return {
        ...current,
        choices: [],
        ending: { ...ending },
        next: undefined
      };
    });
    setStatusText(ending ? "엔딩 변경이 초안에 반영되었습니다." : "엔딩 해제가 초안에 반영되었습니다.");
  }

  function repairActionMatchesProblemAction(action: ProjectRepairAction, problemAction: StudioProblemAction): boolean {
    return action.actionId === problemAction.actionId
      && action.issueCode === problemAction.issueCode
      && action.targetPath === problemAction.targetPath;
  }

  function repairActionsForRow(row: StudioProblemRow): ProjectRepairAction[] {
    const actions = localRepairActions.filter((action) =>
      row.actions.some((problemAction) => repairActionMatchesProblemAction(action, problemAction))
      || (action.issueCode === row.issue.code && action.targetPath === row.issue.path)
    );
    const seen = new Set<string>();
    return actions.filter((action) => {
      const key = repairActionKey(action);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function studioRepairActionInputValue(action: ProjectRepairAction, input: ProjectRepairActionRequiredInput): string {
    return repairInputValue(action, input, studioRepairInputs);
  }

  function updateStudioRepairInput(action: ProjectRepairAction, input: ProjectRepairActionRequiredInput, value: string): void {
    if (!input.name) {
      return;
    }
    setStudioRepairInputs((current) => ({
      ...current,
      [repairActionKey(action)]: {
        ...(current[repairActionKey(action)] || {}),
        [input.name as string]: value
      }
    }));
    setStudioRepairPreview(null);
    setStudioRepairStatus("입력이 변경되었습니다. 수리 diff를 다시 확인하세요.");
  }

  function applyStudioRepairResultState(result: ProjectApiResult, status: string): void {
    const nextRevision = revisionFromResult(result);
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
    applyStudioDtoState(result, { clearWhenAbsent: true });
    setLocalIssues(resultIssues(result));
    setStudioRepairPreview(null);
    setStudioRepairHistoryEntry(result.repairHistoryEntry || null);
    setStudioRepairHistory(result.repairHistory || []);
    onProjectResult(result);
    const currentSceneId = selectedScene?.id || draftScene?.id || "";
    const nextScene = result.project?.scenes?.find((scene) => scene.id === currentSceneId) || null;
    if (nextScene) {
      setDraftScene(cloneScene(nextScene));
      setDraftBaseScene(cloneScene(nextScene));
    }
    updateQuery({
      panel: selectedPanel,
      problem: selectedProblemQuery,
      route: activeRoute?.id || "",
      scene: currentSceneId
    }, true);
    setSaveState("saved");
    setStatusText(status);
    setStudioRepairStatus(status);
  }

  async function previewStudioRepairAction(action: ProjectRepairAction): Promise<void> {
    if (!projectDirectory) {
      setStudioRepairStatus("프로젝트 저장 위치가 필요합니다.");
      return;
    }
    setStudioRepairBusy(true);
    setStudioRepairStatus("수리 diff를 계산하는 중입니다.");
    recordUXDecisionEvent({
      eventName: "repair_action_used",
      issueCode: action.issueCode,
      repairActionId: action.actionId,
      outcome: "used"
    });
    try {
      const result = await postJson("/api/project/repair/preview", repairRequestBody(action, projectDirectory, studioRepairInputs, localRevision));
      if (isApiFailure(result) || !result.repairPreview) {
        setStudioRepairPreview(null);
        applyStudioDtoState(result);
        setStudioRepairStatus(repairResultMessage(result, "수리 diff를 계산하지 못했습니다."));
        return;
      }
      const nextRevision = revisionFromResult(result);
      if (nextRevision) {
        setLocalRevision(nextRevision);
      }
      applyStudioDtoState(result);
      setLocalIssues(resultIssues(result));
      setStudioRepairPreview(result.repairPreview);
      recordUXDecisionEvent({
        eventName: "repair_action_used",
        correlationId: result.correlationId,
        issueCode: result.repairPreview.issueCode,
        repairActionId: result.repairPreview.actionId,
        outcome: "success"
      });
      setStudioRepairStatus("수리 diff를 확인한 뒤 변경 적용을 누르세요. actual project mutation 경로입니다.");
    } catch (error) {
      setStudioRepairPreview(null);
      setStudioRepairStatus(`수리 diff 계산 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStudioRepairBusy(false);
    }
  }

  async function applyStudioRepairPreview(): Promise<void> {
    if (!studioRepairPreview?.repairAction || !studioRepairPreview.beforeRevision || !studioRepairPreview.confirmToken) {
      setStudioRepairStatus("먼저 수리 diff를 확인해야 합니다.");
      return;
    }
    const destructive = (studioRepairPreview.destructiveWarnings || []).length > 0 || studioRepairPreview.repairAction.destructive;
    if (destructive && !window.confirm("표시된 diff대로 수리 적용할까요?")) {
      setStudioRepairStatus("수리 적용을 취소했습니다.");
      return;
    }
    setStudioRepairBusy(true);
    setStudioRepairStatus("수리를 적용하고 검증을 다시 계산하는 중입니다.");
    try {
      const result = await postJson("/api/project/repair/apply", {
        ...repairRequestBody(studioRepairPreview.repairAction, projectDirectory, studioRepairInputs, studioRepairPreview.beforeRevision),
        confirmToken: studioRepairPreview.confirmToken
      });
      if (isApiFailure(result)) {
        setStudioRepairPreview(null);
        applyStudioDtoState(result);
        setStudioRepairStatus(`${repairResultMessage(result, "수리를 적용하지 못했습니다.")} 수리 diff를 다시 확인하세요.`);
        return;
      }
      recordUXDecisionEvent({
        eventName: "repaired",
        correlationId: result.correlationId,
        issueCode: result.repairHistoryEntry?.issueCode || studioRepairPreview.repairAction.issueCode,
        issueCodesBefore: result.repairHistoryEntry?.issueCode ? [result.repairHistoryEntry.issueCode] : [],
        issueCodesAfter: (result.previewPreflight?.blockers || []).map((blocker) => blocker.issueCode || blocker.path || "unknown"),
        repairActionId: result.repairHistoryEntry?.actionId || studioRepairPreview.repairAction.actionId,
        revisionBefore: result.previousRevision || studioRepairPreview.beforeRevision,
        revisionAfter: result.projectRevision,
        outcome: "success",
        preflightResult: result.previewPreflight || undefined
      });
      applyStudioRepairResultState(result, "수리 적용 완료. 마지막 수리는 되돌릴 수 있습니다.");
    } catch (error) {
      setStudioRepairPreview(null);
      setStudioRepairStatus(`수리 적용 실패: ${error instanceof Error ? error.message : String(error)} 수리 diff를 다시 확인하세요.`);
    } finally {
      setStudioRepairBusy(false);
    }
  }

  async function undoStudioRepair(): Promise<void> {
    if (!undoStudioRepairEntry?.id) {
      setStudioRepairStatus("되돌릴 수리 이력이 없습니다.");
      return;
    }
    if (!window.confirm("마지막 수리를 되돌리고 검증을 다시 계산할까요?")) {
      setStudioRepairStatus("수리 되돌리기를 취소했습니다.");
      return;
    }
    setStudioRepairBusy(true);
    setStudioRepairStatus("마지막 수리를 되돌리고 검증을 다시 계산하는 중입니다.");
    try {
      const result = await postJson("/api/project/repair/undo", {
        projectDirectory,
        repairHistoryId: undoStudioRepairEntry.id
      });
      if (isApiFailure(result)) {
        setStudioRepairStatus(repairResultMessage(result, "마지막 수리를 되돌리지 못했습니다."));
        return;
      }
      recordUXDecisionEvent({
        eventName: "undo_used",
        correlationId: result.correlationId,
        issueCode: result.repairHistoryEntry?.issueCode || undoStudioRepairEntry.issueCode,
        repairActionId: result.repairHistoryEntry?.actionId || undoStudioRepairEntry.actionId,
        revisionBefore: result.previousRevision,
        revisionAfter: result.projectRevision,
        outcome: "undone",
        preflightResult: result.previewPreflight || undefined
      });
      applyStudioRepairResultState(result, "마지막 수리를 되돌렸습니다. 검증 결과와 사전 점검을 다시 확인하세요.");
    } catch (error) {
      setStudioRepairStatus(`수리 되돌리기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStudioRepairBusy(false);
    }
  }

  function renderProblemFilterTabs() {
    const counts: Record<ProblemFilter, number> = {
      all: problemRows.length,
      errors: errorProblemCount,
      warnings: warningProblemCount,
      currentScene: currentSceneProblemCount
    };
    return (
      <div aria-label="ProblemFilterTabs" className="studio-problem-filter-tabs" role="tablist">
        {problemFilterTabs.map((tab) => (
          <button
            aria-selected={problemFilter === tab.id}
            className={problemFilter === tab.id ? "selected" : ""}
            data-problem-filter={tab.id}
            key={tab.id}
            onClick={() => setProblemFilter(tab.id)}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            <small>{counts[tab.id]}</small>
          </button>
        ))}
      </div>
    );
  }

  function renderProblemPanelState() {
    return (
      <div className={`studio-problem-state ${problemPanelState}`}>
        <span>{validationTimestampText(lastValidationAt)}</span>
        {problemPanelState === "running" ? <strong>검증 실행 중</strong> : null}
        {problemPanelState === "stale" ? <strong>검증 stale · 저장 후 다시 실행하세요.</strong> : null}
        {problemPanelState === "noProblems" ? <strong>문제 없음</strong> : null}
      </div>
    );
  }

  function renderFlowStatusLegend() {
    return (
      <section className={`studio-flow-legend ${flowLegendCollapsed ? "collapsed" : ""}`} aria-label="FlowStatusLegend">
        <button onClick={() => setFlowLegendCollapsed((current) => !current)} type="button">
          <GitBranch aria-hidden="true" size={14} />
          <span>FlowStatusLegend</span>
          <small>{flowLegendCollapsed ? "펼치기" : "접기"}</small>
        </button>
        {flowLegendCollapsed ? null : (
          <dl>
            <div><dt>error</dt><dd>프리뷰를 막는 문제 또는 missing target</dd></div>
            <div><dt>warning</dt><dd>검토가 필요한 preflight 경고</dd></div>
            <div><dt>ending</dt><dd>도달 가능한 엔딩 SceneNode</dd></div>
            <div><dt>conditional</dt><dd>조건/효과 후보가 있는 ChoiceEdge</dd></div>
            <div><dt>dirty</dt><dd>저장 전 draft가 route graph DTO보다 앞선 상태</dd></div>
          </dl>
        )}
      </section>
    );
  }

  function renderRouteGraphEdge(edge: StudioRouteGraphEdge, mode: "incoming" | "outgoing") {
    const targetNode = routeGraphNodes.find((node) => node.id === edge.targetSceneId);
    const targetScene = scenes.find((scene) => scene.id === edge.targetSceneId) || null;
    const targetLabel = targetNode?.label || sceneTitle(targetScene) || edge.targetSceneId || "대상 없음";
    const sourceScene = scenes.find((scene) => scene.id === edge.sourceSceneId) || null;
    const sourceLabel = edge.sourceSceneId ? sceneTitle(sourceScene) : routeGraphRouteTitle;
    return (
      <li className={`studio-route-edge ${edge.kind || "edge"} ${edge.missingTarget ? "missing" : ""}`} data-route-edge-kind={edge.kind || "edge"} key={`${mode}-${edge.id || edge.kind}-${edge.sourceSceneId || "route"}-${edge.targetSceneId}`}>
        <button onClick={() => focusRouteGraphEdge(edge)} type="button">
          <MousePointerClick aria-hidden="true" size={13} />
          <span>{routeGraphEdgeText(edge, targetLabel)}</span>
          <small>{mode === "incoming" ? `${sourceLabel}에서 들어옴` : `${targetLabel}로 이동`}</small>
          {edge.missingTarget ? <StatusChip tone="danger">missing target</StatusChip> : null}
        </button>
      </li>
    );
  }

  function renderRouteGraphNode(view: RouteGraphNodeView, index: number) {
    const node = view.node;
    const scene = view.scene;
    const selected = routeGraphSelectedSceneId === node.id;
    const nodeSeverity = routeGraphNodeSeverity(node, view.problemCount);
    const choicesCount = (scene?.choices || []).length;
    const hasConditionalChoice = (scene?.choices || []).some((choice) => Boolean(choice.condition) || Boolean(choice.effects));
    const hasDirtyDraft = dirty && selectedScene?.id === node.id;
    const routeEntryEdges = view.incomingEdges.filter((edge) => edge.kind === "route-entry");
    return (
      <li className={`studio-route-node-card ${selected ? "selected" : ""} ${node.unreachable ? "unreachable" : ""} severity-${nodeSeverity}`} data-route-node-id={node.id || "unknown"} key={node.id || index}>
        <button
          className="studio-node"
          onClick={() => selectScene(node.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            if (node.id) {
              selectScene(node.id);
            }
            setStatusText(`${node.label || node.id || "SceneNode"} context action: ${commandAddAction.label}`);
          }}
          onDoubleClick={() => {
            if (node.id) {
              selectScene(node.id);
            }
            setPanel("scene");
          }}
          type="button"
        >
          <span className="studio-node-index">{index + 1}</span>
          <span>
            <strong>SceneNode · {node.label || node.id || "씬"}</strong>
            <small>{node.summary || sceneSummaryText(scene)}</small>
          </span>
          <span className="studio-node-badges">
            {node.entry ? <StatusChip tone="success">시작</StatusChip> : null}
            {node.ending ? <StatusChip tone="warning">ending</StatusChip> : null}
            {choicesCount > 0 ? <StatusChip>선택지 {choicesCount}</StatusChip> : null}
            {hasConditionalChoice ? <StatusChip tone="warning">conditional</StatusChip> : null}
            {node.unreachable ? <StatusChip tone="danger">unreachable</StatusChip> : null}
            {view.problemCount > 0 ? <StatusChip tone={nodeSeverity}>{view.problemCount}</StatusChip> : null}
            {hasDirtyDraft ? <StatusChip tone="warning">dirty</StatusChip> : null}
          </span>
        </button>
        {[...routeEntryEdges, ...view.outgoingEdges].length > 0 ? (
          <ul className="studio-route-edge-list">
            {routeEntryEdges.map((edge) => renderRouteGraphEdge(edge, "incoming"))}
            {view.outgoingEdges.map((edge) => renderRouteGraphEdge(edge, "outgoing"))}
          </ul>
        ) : null}
      </li>
    );
  }

  function handleProblemFocus(row: StudioProblemRow, selectedAction?: StudioProblemAction): void {
    const issue = row.issue;
    const focus = row.focus;
    const sceneId = focus?.sceneId || findIssueSceneId(issue, project);
    const nextPanel = panelFromValue(focus?.inspectorPanel || issuePanel(issue));
    const nextSceneId = sceneId || selectedScene?.id || "";
    if (nextSceneId && nextSceneId !== selectedScene?.id && !confirmDiscardDirtyDraft()) {
      return;
    }
    if (nextSceneId && nextSceneId !== selectedScene?.id) {
      confirmedSceneChangeRef.current = nextSceneId;
    }
    const repairActionId = selectedAction?.actionId || row.actions[0]?.actionId || focus?.repairActionIds?.[0];
    recordUXDecisionEvent({
      eventName: "help_opened",
      helpChannel: row.actions.length > 0 || focus?.defaultAction === "repair" ? "automatic_repair_suggestion" : "inline_guide",
      issueCode: focus?.issueCode || issue.code,
      repairActionId,
      outcome: "opened"
    });
    const fieldKey = focus?.field || focus?.scriptBlockId || "";
    setFocusedProblemId(row.key);
    setFocusedFieldKey(fieldKey);
    if (layout.inspectorCollapsed) {
      updateLayout({ inspectorCollapsed: false });
    }
    pendingProblemFocusRef.current = {
      fieldKey,
      focus,
      panel: nextPanel,
      problemId: row.key,
      sceneId: nextSceneId
    };
    setFocusRequestTick((current) => current + 1);
    updateQuery({
      panel: nextPanel,
      problem: row.key,
      route: focus?.routeId || activeRoute?.id || "",
      scene: nextSceneId
    });
  }

  function handleProblemRowDefaultAction(row: StudioProblemRow): void {
    const repairAction = repairActionsForRow(row).find((action) => !action.disabledReason);
    if (repairAction) {
      void previewStudioRepairAction(repairAction);
      return;
    }
    handleProblemFocus(row);
  }

  function handleProblemRowKeyDown(event: ReactKeyboardEvent<HTMLElement>, row: StudioProblemRow): void {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    handleProblemRowDefaultAction(row);
  }

  function renderProblemRow(row: StudioProblemRow, compact = false) {
    const selected = row.key === selectedProblemQuery || row.key === focusedProblemId;
    const fullRepairActions = repairActionsForRow(row);
    return (
      <li className={`studio-problem-row ${selected ? "selected" : ""}`} data-problem-id={row.key} key={row.key}>
        <button aria-label={`ProblemRow ${problemRowLocationText(row, project)} ${row.issue.message || row.issue.code || "문제"}`} className="studio-problem-main studio-problem-row-grid" onClick={() => handleProblemFocus(row)} onKeyDown={(event) => handleProblemRowKeyDown(event, row)} type="button">
          <span className="studio-problem-severity"><StatusChip tone={issueTone(row.issue)}>{row.issue.severity || "info"}</StatusChip></span>
          <span className="studio-problem-location">
            <strong>{problemRowLocationText(row, project)}</strong>
            <small>{problemRowAffectedObjectText(row)}</small>
          </span>
          <span className="studio-problem-message">{row.issue.message || issueText(row.issue)}</span>
          <span className="studio-problem-action">{row.defaultActionLabel}</span>
          <span className="studio-problem-status"><StatusChip tone={fullRepairActions.length > 0 || row.actions.length > 0 ? "warning" : issueTone(row.issue)}>{problemRowStatusText(row)}</StatusChip></span>
        </button>
        {!compact && (fullRepairActions.length > 0 || row.actions.length > 0) ? (
          <div className="studio-problem-actions" aria-label="수리 후보">
            {fullRepairActions.length > 0 ? fullRepairActions.map((action) => (
              <div className="studio-repair-action-group" key={`${row.key}-${repairActionKey(action)}`}>
                <button
                  className={`studio-problem-action-chip preview-ready ${action.destructive ? "destructive" : ""}`}
                  data-repair-candidate-action={action.actionId || "repair-action"}
                  disabled={studioRepairBusy || Boolean(action.disabledReason)}
                  onClick={() => void previewStudioRepairAction(action)}
                  title={action.disabledReason || action.label || action.actionId || "수리 후보"}
                  type="button"
                >
                  <GitCompareArrows aria-hidden="true" size={14} />
                  <span>{action.label || action.actionId || "수리 후보"} diff</span>
                  <small>{repairActionMetaText(action)}</small>
                  <small>actual project mutation</small>
                  {action.destructive ? <small>확인 필요</small> : null}
                  {action.disabledReason ? <small>{action.disabledReason}</small> : null}
                </button>
                {action.requiredInputs?.length ? (
                  <div className="studio-repair-inputs">
                    {action.requiredInputs.map((input) => (
                      <label key={`${repairActionKey(action)}-${input.name || input.label}`}>
                        <span>{repairInputDisplayLabel(input)}</span>
                        {input.inputType === "select" ? (
                          <select disabled={studioRepairBusy || Boolean(action.disabledReason)} onChange={(event) => updateStudioRepairInput(action, input, event.target.value)} value={studioRepairActionInputValue(action, input)}>
                            {(input.options || []).map((option) => (
                              <option key={option.value || option.label} value={option.value || ""}>{option.label || option.value || "선택"}</option>
                            ))}
                          </select>
                        ) : (
                          <input disabled={studioRepairBusy || Boolean(action.disabledReason)} onChange={(event) => updateStudioRepairInput(action, input, event.target.value)} placeholder={repairInputDisplayLabel(input)} value={studioRepairActionInputValue(action, input)} />
                        )}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            )) : row.actions.map((action) => (
                <button
                  className={`studio-problem-action-chip ${action.destructive ? "destructive" : ""}`}
                  data-repair-candidate-action={action.actionId || "repair-action"}
                  disabled={Boolean(action.disabledReason)}
                  key={`${row.key}-${action.actionId || action.label}`}
                  onClick={() => handleProblemFocus(row, action)}
                  title={action.disabledReason || action.label || action.actionId || "수리 후보"}
                  type="button"
                >
                  <span>{action.label || action.actionId || "수리 후보"}</span>
                  {action.requiresPreflight ? <small>프리플라이트 필요</small> : null}
                  {action.destructive ? <small>확인 필요</small> : null}
                  {action.disabledReason ? <small>{action.disabledReason}</small> : null}
                </button>
              ))}
          </div>
        ) : null}
      </li>
    );
  }

  function renderStudioRepairPanel(compact = false) {
    if (!studioRepairPreview && !undoStudioRepairEntry && !studioRepairStatus) {
      return null;
    }
    return (
      <div className={`studio-repair-panel ${compact ? "compact" : ""}`}>
        <p aria-live="polite" className="studio-repair-status">{studioRepairStatus}</p>
        <small>actual project mutation 경로로 기존 repair preview/apply/undo contract를 사용합니다.</small>
        {studioRepairPreview ? (
          <>
            <dl className="summary-list">
              <div><dt>수리 액션</dt><dd>{studioRepairPreview.repairAction?.label || studioRepairPreview.actionId || "수리 후보"}</dd></div>
              <div><dt>대상</dt><dd>{studioRepairPreview.targetPath || "대상 확인 필요"}</dd></div>
              <div><dt>기준 revision</dt><dd>{studioRepairPreview.beforeRevision?.revision || "revision 확인 필요"}</dd></div>
              <div><dt>확인 방식</dt><dd>{studioRepairPreview.repairAction?.requiresConfirmation || studioRepairPreview.destructiveWarnings?.length ? "diff 확인 후 적용" : "즉시 적용 가능"}</dd></div>
            </dl>
            <p className="page-muted">{studioRepairPreview.expectedAfterSummary || "표시된 변경 사항을 확인한 뒤 적용합니다."}</p>
            {studioRepairPreview.destructiveWarnings?.length ? (
              <ul className="compact-list">
                {studioRepairPreview.destructiveWarnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            ) : null}
            <ul className="studio-repair-diff-list">
              {(studioRepairPreview.diff || []).map((entry, index) => (
                <li key={`${entry.path || "diff"}-${entry.op || "op"}-${index}`}>
                  <strong>{repairDiffOperationLabel(entry.op)} · {entry.path || "경로 확인 필요"}</strong>
                  <span>{entry.humanLabel || "프로젝트 값을 변경합니다."}</span>
                  <small>이전 {repairDiffValueText(entry.before)} → 이후 {repairDiffValueText(entry.after)}</small>
                </li>
              ))}
            </ul>
          </>
        ) : undoStudioRepairEntry ? (
          <p className="page-muted">마지막 수리 적용 이력이 있습니다. 필요하면 되돌릴 수 있습니다.</p>
        ) : null}
        <div className="button-row">
          {studioRepairPreview ? (
            <Button disabled={studioRepairBusy} icon={<CheckCircle2 size={16} />} onClick={() => void applyStudioRepairPreview()} variant={studioRepairPreview.destructiveWarnings?.length || studioRepairPreview.repairAction?.destructive ? "danger" : "primary"}>
              변경 적용
            </Button>
          ) : null}
          <Button disabled={studioRepairBusy || !undoStudioRepairEntry?.id} icon={<Undo2 size={16} />} onClick={() => void undoStudioRepair()} variant="ghost">
            마지막 수리 되돌리기
          </Button>
        </div>
        {studioRepairHistoryEntry?.appliedAt ? <small>마지막 적용 시각 {studioRepairHistoryEntry.appliedAt}</small> : null}
        {studioRepairHistory.length > 0 ? <small>수리 이력 {studioRepairHistory.length}건</small> : null}
      </div>
    );
  }

  const selectedFixedPrompt = fixedPrompts.find((fixture) => fixture.promptId === selectedFixedPromptId) || fixedPrompts[0] || null;
  const rootStyle = {
    "--studio-inspector-width": `${layout.inspectorCollapsed ? 48 : layout.inspectorWidth}px`,
    "--studio-problems-height": `${layout.problemsCollapsed ? 34 : layout.problemsHeight}px`,
    "--studio-route-width": `${layout.routeCollapsed ? 48 : layout.routeWidth}px`
  } as CSSProperties;

  if (unsupported) {
    return (
      <section className="studio-unsupported" data-testid="studio-unsupported">
        <div>
          <p className="eyebrow">제작 화면 미지원</p>
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
      <header aria-label="상단 명령 바" className="studio-command-bar">
        <div className="studio-command-main">
          <nav aria-label="프로젝트 위치" className="studio-breadcrumb">
            <button onClick={() => onNavigate("/projects")} type="button">Projects</button>
            <span aria-hidden="true">&gt;</span>
            <button onClick={() => onNavigate(projectOverviewPath)} type="button">{project?.title || "VN Maker Studio"}</button>
            <span aria-hidden="true">&gt;</span>
            <strong>Studio</strong>
          </nav>
          {routes.length > 1 ? (
            <label className="studio-route-selector">
              <span>route:</span>
              <select aria-label="route selector" onChange={(event) => selectRoute(event.target.value)} value={activeRoute?.id || ""}>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>{route.title || route.id}</option>
                ))}
              </select>
            </label>
          ) : (
            <span className="studio-route-selector readonly">route: {activeRoute?.title || activeRoute?.id || "없음"}</span>
          )}
          <label className="studio-scene-title-input">
            <span>씬</span>
            <input
              aria-label="SceneTitleInput"
              disabled={!draftScene || saveState === "saving"}
              onChange={(event) => patchDraftScene({ label: event.target.value })}
              placeholder="선택 씬 제목"
              value={sceneTitleInput}
            />
          </label>
          <StatusChip tone={saveState === "failed" || saveState === "apiFailure" ? "danger" : dirty ? "warning" : "success"}>
            {saveStateLabel(saveState, dirty)}
          </StatusChip>
          <button className="studio-problem-count-button" onClick={openProblemsPanel} type="button">
            <StatusChip tone={problemCount > 0 ? (errorCount > 0 ? "danger" : "warning") : "success"}>{problemCountLabel(problemCount)}</StatusChip>
          </button>
          <span className="studio-command-status">{statusText}</span>
        </div>
        <div className="studio-command-actions">
          <Button disabled={Boolean(commandAddAction.disabledReason)} icon={<Plus size={16} />} onClick={runCommandAddAction} title={commandAddAction.disabledReason || commandAddAction.label} className="studio-command-add">
            {commandAddAction.label}
          </Button>
          <Button icon={<Eye size={16} />} onClick={() => onNavigate(projectOverviewPath)} title="프로젝트 상세로">
            프로젝트 상세로
          </Button>
          <Button disabled={!canSaveStudioDraft} icon={<Save size={16} />} onClick={runSaveCommand} title="Cmd/Ctrl+S" variant="primary">
            저장
          </Button>
          <Button disabled={saveState === "saving" || dirty} icon={<RefreshCw size={16} />} onClick={() => void validateStudio()} title={dirty ? "저장 후 검증을 실행하세요." : "검증 실행"}>
            검증
          </Button>
          <Button disabled={Boolean(previewCommandDisabledReason)} icon={<Play size={16} />} onClick={openPreview} title={previewCommandDisabledReason || "Cmd/Ctrl+Enter"}>
            프리뷰
          </Button>
          <DiagnosticDrawer summary="설정">
            <div className="studio-settings-grid">
              <Button icon={<Settings size={16} />} onClick={() => updateLayout(studioDefaultLayoutForViewport(viewport.width, viewport.height))} variant="ghost">
                레이아웃 리셋
              </Button>
              <dl className="summary-list">
                <div><dt>Cmd/Ctrl+S</dt><dd>Studio 저장</dd></div>
                <div><dt>Cmd/Ctrl+Enter</dt><dd>선택 씬 프리뷰로 이동</dd></div>
                <div><dt>Cmd/Ctrl+K</dt><dd>루트 맵 검색 focus</dd></div>
              </dl>
              <div className="studio-layout-controls" aria-label="Studio layout settings">
                <label>
                  <span>루트 맵 폭</span>
                  <input max="420" min="240" onChange={(event) => updateLayout({ routeWidth: Number(event.target.value) })} type="range" value={layout.routeWidth} />
                </label>
                <label>
                  <span>인스펙터 폭</span>
                  <input max="520" min="320" onChange={(event) => updateLayout({ inspectorWidth: Number(event.target.value) })} type="range" value={layout.inspectorWidth} />
                </label>
                <label>
                  <span>문제 패널 높이</span>
                  <input max={Math.max(96, Math.floor(viewport.height * 0.4))} min="96" onChange={(event) => updateLayout({ problemsHeight: Number(event.target.value) })} type="range" value={layout.problemsHeight} />
                </label>
              </div>
            </div>
          </DiagnosticDrawer>
          <DiagnosticDrawer summary="진단">
            <dl className="summary-list" data-contract-copy="진단 API 실패">
              <div><dt>쿼리</dt><dd>?route={activeRoute?.id || "none"} · ?scene={selectedScene?.id || "none"} · ?panel={selectedPanel} · ?problem={selectedProblemQuery || "none"}</dd></div>
              <div><dt>리비전</dt><dd>{revisionStatusText(localRevision)}</dd></div>
              <div><dt>프리뷰 제한 사유</dt><dd>{previewCommandDisabledReason || "없음"}</dd></div>
              <div><dt>진단 범위</dt><dd>진단 패널</dd></div>
              <div><dt>검증 최신성</dt><dd>{dirty ? "저장되지 않은 변경으로 갱신 필요" : "현재 초안 기준"}</dd></div>
            </dl>
          </DiagnosticDrawer>
        </div>
      </header>

      <div className="studio-body">
        <aside aria-label="루트 맵" className={`studio-route-map ${layout.routeCollapsed ? "collapsed" : ""}`}>
          <div className="studio-panel-toolbar">
            <strong>루트 맵</strong>
            <Button icon={layout.routeCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />} iconOnly onClick={() => updateLayout({ routeCollapsed: !layout.routeCollapsed })} title="루트 패널 접기" />
          </div>
          {layout.routeCollapsed ? (
            <div className="studio-route-collapsed-summary">
              <strong>{routeGraphRouteTitle}</strong>
              <small>{selectedScene ? sceneTitle(selectedScene) : "선택 씬 없음"}</small>
              <StatusChip tone={routeGraphProblemCount > 0 ? "danger" : "success"}>{routeGraphProblemCount}</StatusChip>
            </div>
          ) : (
            <div className="studio-route-map-content">
              <div className="studio-route-graph-toolbar">
                <div>
                  <strong>{routeGraphRouteTitle}</strong>
                  <small>{routeGraphDataSourceText}</small>
                </div>
                <StatusChip tone={routeGraphProblemCount > 0 ? "danger" : "success"}>문제 {routeGraphProblemCount}</StatusChip>
                <div className="button-row">
                  <Button icon={<LocateFixed size={14} />} iconOnly onClick={fitSelectedRouteNode} title="선택 씬 맞춤" />
                  <Button icon={<Maximize2 size={14} />} iconOnly onClick={fitRouteGraph} title="route 맞춤" />
                  <Button disabled={routeGraphZoom <= 80} icon={<ZoomOut size={14} />} iconOnly onClick={() => updateRouteGraphZoom(routeGraphZoom - 10)} title="축소" />
                  <span className="studio-route-zoom">{routeGraphZoomLabel(routeGraphZoom)}</span>
                  <Button disabled={routeGraphZoom >= 140} icon={<ZoomIn size={14} />} iconOnly onClick={() => updateRouteGraphZoom(routeGraphZoom + 10)} title="확대" />
                </div>
              </div>
              <label className="studio-route-search">
                <Search aria-hidden="true" size={15} />
                <input
                  aria-label="루트 맵 씬 검색"
                  onChange={(event) => setRouteSearchTerm(event.target.value)}
                  placeholder="SceneNode, ChoiceEdge 검색"
                  ref={routeSearchRef}
                  value={routeSearchTerm}
                />
              </label>
              {renderFlowStatusLegend()}
              {routeGraphNodeViews.length > 0 ? (
                <ol className="studio-node-list studio-route-graph" style={{ "--route-graph-zoom": routeGraphZoom / 100 } as CSSProperties}>
                  {routeGraphNodeViews.map((view, index) => renderRouteGraphNode(view, index))}
                </ol>
              ) : routeGraphNodes.length > 0 ? (
                <p className="page-muted">검색 결과가 없습니다.</p>
              ) : (
                <EmptyState
                  action={<Button icon={<Plus size={16} />} onClick={() => void createStartScene()} variant="primary">시작 씬 만들기</Button>}
                  title="씬이 아직 없습니다."
                  description="첫 장면을 만들면 루트 맵과 스테이지 미리보기가 동시에 갱신됩니다."
                />
              )}
            </div>
          )}
        </aside>
        <button
          role="separator"
          aria-label="루트 맵 폭 조절"
          aria-orientation="vertical"
          aria-valuemax={420}
          aria-valuemin={240}
          aria-valuenow={layout.routeWidth}
          className="studio-splitter vertical"
          onKeyDown={(event) => handleLayoutSplitterKeyDown("route", event)}
          onPointerDown={(event) => {
            event.preventDefault();
            startLayoutResize("route", event.clientX, event.clientY);
          }}
          type="button"
        />

        <main className="studio-center">
          <section aria-label="스테이지 미리보기" className="studio-stage">
            <div className="studio-stage-header">
              <div>
                <strong>스테이지 미리보기</strong>
                <span>{previewCommandDisabledReason || "프리뷰 이동 가능"} · 문제 {problemCount}건</span>
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
                {draftScene?.ending ? <StatusChip tone="warning">엔딩 · {draftScene.ending.title || "제목 없음"}</StatusChip> : null}
              </div>
            </div>
          </section>

          <section aria-label="스크립트 편집기" className="studio-script-editor">
            <header>
              <div>
                <strong>스크립트 편집기</strong>
                <span>{sceneSummaryText(draftScene)}</span>
              </div>
              <StatusChip tone={dirty ? "warning" : "success"}>{dirty ? "변경됨" : "저장됨"}</StatusChip>
            </header>
            {draftScene ? (
              <div className="studio-editor-grid">
                <label className={`field-row${focusedClass("label", "scene:label")}`}>
                  <span>라벨</span>
                  <input onChange={(event) => patchDraftScene({ label: event.target.value })} ref={(element) => setFocusTargets(["label", "scene:label"], element)} value={draftScene.label || ""} />
                </label>
                <label className={`field-row${focusedClass("speaker", "scene:speaker")}`}>
                  <span>화자</span>
                  <input onChange={(event) => patchDraftScene({ speaker: event.target.value })} ref={(element) => setFocusTargets(["speaker", "scene:speaker"], element)} value={draftScene.speaker || ""} />
                </label>
                <label className={`field-row studio-editor-text${focusedClass("text", `scene:${draftScene.id || ""}`)}`}>
                  <span>본문</span>
                  <textarea
                    ref={(element) => {
                      scriptTextareaRef.current = element;
                      setFocusTargets(["text", "scene:text", draftScene.id ? `scene:${draftScene.id}` : ""], element);
                    }}
                    onChange={(event) => patchDraftScene({ text: event.target.value })}
                    value={draftScene.text || ""}
                  />
                </label>
              </div>
            ) : (
              <EmptyState title="선택된 씬이 없습니다." description="루트 맵에서 씬을 선택하거나 시작 씬을 만드세요." />
            )}
          </section>
        </main>
        <button
          role="separator"
          aria-label="인스펙터 폭 조절"
          aria-orientation="vertical"
          aria-valuemax={520}
          aria-valuemin={320}
          aria-valuenow={layout.inspectorWidth}
          className="studio-splitter vertical"
          onKeyDown={(event) => handleLayoutSplitterKeyDown("inspector", event)}
          onPointerDown={(event) => {
            event.preventDefault();
            startLayoutResize("inspector", event.clientX, event.clientY);
          }}
          type="button"
        />

        <aside aria-label="인스펙터" className={`studio-inspector ${layout.inspectorCollapsed ? "collapsed" : ""}`}>
          <div className="studio-panel-toolbar">
            <strong>인스펙터</strong>
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
                      <h3>씬</h3>
                      <label className={`field-row${focusedClass("label", "scene:label")}`}>
                        <span>라벨</span>
                        <input
                          onChange={(event) => patchDraftScene({ label: event.target.value })}
                          ref={(element) => {
                            inspectorFirstFieldRef.current = element;
                            setFocusTargets(["label", "scene:label"], element);
                          }}
                          value={draftScene.label || ""}
                        />
                      </label>
                      <label className={`field-row${focusedClass("speaker", "scene:speaker")}`}>
                        <span>화자</span>
                        <input onChange={(event) => patchDraftScene({ speaker: event.target.value })} ref={(element) => setFocusTargets(["speaker", "scene:speaker"], element)} value={draftScene.speaker || ""} />
                      </label>
                      <label className={`field-row${focusedClass("ending", "scene:ending")}`}>
                        <span>엔딩 제목</span>
                        <input onChange={(event) => patchDraftScene({ ending: { ...(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, kind: "normal" }), title: event.target.value } })} ref={(element) => setFocusTargets(["ending", "scene:ending"], element)} value={draftScene.ending?.title || ""} />
                      </label>
                      <label className={`field-row${focusedClass("ending", "scene:ending")}`}>
                        <span>엔딩 종류</span>
                        <select onChange={(event) => patchDraftScene({ ending: { ...(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, title: "새 엔딩" }), kind: event.target.value } })} ref={(element) => setFocusTargets(["endingKind", "scene:endingKind"], element)} value={draftScene.ending?.kind || "normal"}>
                          <option value="normal">일반</option>
                          <option value="good">좋음</option>
                          <option value="bad">나쁨</option>
                        </select>
                      </label>
                      <div className="button-row">
                        <Button disabled={saveState === "saving"} icon={<CheckCircle2 size={16} />} onClick={() => applyDraftEnding(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, kind: "normal", title: "새 엔딩" })}>
                          엔딩 적용
                        </Button>
                        <Button disabled={saveState === "saving" || !draftScene.ending} icon={<RefreshCw size={16} />} onClick={() => applyDraftEnding(null)} variant="ghost">
                          엔딩 해제
                        </Button>
                      </div>
                      <details className="studio-technical-details">
                        <summary>기술 정보</summary>
                        <label className="field-row"><span>씬 ID</span><input readOnly value={draftScene.id || ""} /></label>
                      </details>
                    </section>
                  ) : null}

                  {selectedPanel === "choices" ? (
                    <section>
                      <h3>다음 연결</h3>
                      <label className={`field-row${focusedClass("next", "outgoing", "choices:next", "choices:outgoing")}`}>
                        <span>다음 대상</span>
                        <select
                          disabled={(draftScene.choices || []).length > 0 || Boolean(draftScene.ending)}
                          onChange={(event) => patchDraftScene({ next: event.target.value || undefined })}
                          ref={(element) => {
                            inspectorFirstFieldRef.current = element;
                            setFocusTargets(["next", "outgoing", "choices:next", "choices:outgoing"], element);
                          }}
                          value={draftScene.next || ""}
                        >
                          <option value="">없음</option>
                          {scenes.filter((scene) => scene.id !== draftScene.id).map((scene) => <option key={scene.id} value={scene.id}>{sceneTitle(scene)}</option>)}
                        </select>
                      </label>
                      <h3>선택지 연결</h3>
                      <div className="button-row">
                        <Button disabled={Boolean(draftScene.next) || Boolean(draftScene.ending)} icon={<Plus size={16} />} onClick={addChoiceDraft}>
                          선택지 추가
                        </Button>
                        <Button disabled={Boolean(draftScene.next) || Boolean(draftScene.ending) || saveState === "saving"} icon={<GitBranch size={16} />} onClick={() => void createChoiceTargetScene()}>
                          선택지 대상 생성
                        </Button>
                      </div>
                      <ul className="studio-choice-list">
                        {(draftScene.choices || []).map((choice, index) => (
                          <li key={choice.id || index}>
                            <label className={`field-row${focusedClass("choiceText", choice.id ? `choice:${choice.id}:choiceText` : undefined)}`}>
                              <span>선택지 문구</span>
                              <input onChange={(event) => updateChoice(index, { text: event.target.value })} ref={(element) => setFocusTargets(["choiceText", choice.id ? `choice:${choice.id}:choiceText` : ""], element)} value={choice.text || ""} />
                            </label>
                            <label className={`field-row${focusedClass("choiceTarget", choice.id ? `choice:${choice.id}:choiceTarget` : undefined)}`}>
                              <span>선택지 대상</span>
                              <select onChange={(event) => updateChoice(index, { next: event.target.value })} ref={(element) => setFocusTargets(["choiceTarget", choice.id ? `choice:${choice.id}:choiceTarget` : ""], element)} value={choice.next || ""}>
                                <option value="">없음</option>
                                {scenes.filter((scene) => scene.id !== draftScene.id).map((scene) => <option key={scene.id} value={scene.id}>{sceneTitle(scene)}</option>)}
                              </select>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedPanel === "stats" ? (
                    <section
                      className={focusedClass("condition", "effects", "stats:condition", "stats:effects").trim()}
                      data-condition-runtime-support={conditionSupportMode}
                      ref={(element) => {
                        inspectorFirstFieldRef.current = element;
                        setFocusTargets(["condition", "effects", "stats:condition", "stats:effects"], element);
                      }}
                      tabIndex={-1}
                    >
                      <h3>조건/효과 후보 검토</h3>
                      <p className="studio-disabled-note">
                        조건 판정 런타임 지원이 #105에서 확정되기 전까지 편집할 수 없습니다. 현재 미지원 상태입니다. {conditionStrictPreviewText}
                      </p>
                      <ul className="studio-readonly-list">
                        {(draftScene.choices || []).map((choice, index) => {
                          const hasCondition = Boolean(choice.condition && Object.keys(choice.condition).length);
                          const hasEffects = Boolean(choice.effects && Object.keys(choice.effects).length);
                          return (
                            <li key={choice.id || index}>
                              <strong>{choice.text || "선택지"}</strong>
                              <span>조건 후보 {hasCondition ? "있음" : "없음"} · 효과 후보 {hasEffects ? "있음" : "없음"}</span>
                            </li>
                          );
                        })}
                        {localRepairActions.map((action, index) => (
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
                      <h3>에셋</h3>
                      <label className={`field-row${focusedClass("backgroundAssetId", "assets:backgroundAssetId")}`}>
                        <span>배경</span>
                        <select
                          onChange={(event) => patchDraftScene({ backgroundAssetId: event.target.value || undefined })}
                          ref={(element) => {
                            inspectorFirstFieldRef.current = element;
                            setFocusTargets(["assets", "backgroundAssetId", "assets:assets", "assets:backgroundAssetId"], element);
                          }}
                          value={draftScene.backgroundAssetId || ""}
                        >
                          <option value="">연결 없음</option>
                          {backgroundAssets.map((asset) => <option key={asset.id || asset.uri} value={asset.id || ""}>{assetLabel(asset)}</option>)}
                        </select>
                      </label>
                      <label className={`field-row${focusedClass("cgAssetId", "assets:cgAssetId")}`}>
                        <span>CG</span>
                        <select onChange={(event) => patchDraftScene({ cgAssetId: event.target.value || undefined })} ref={(element) => setFocusTargets(["cgAssetId", "generationJobs", "assets:cgAssetId", "assets:generationJobs"], element)} value={draftScene.cgAssetId || ""}>
                          <option value="">연결 없음</option>
                          {cgAssets.map((asset) => <option key={asset.id || asset.uri} value={asset.id || ""}>{assetLabel(asset)}</option>)}
                        </select>
                      </label>
                      <h3>캐릭터 표시</h3>
                      <div className="button-row">
                        <Button disabled={!project?.characters?.length} icon={<Plus size={16} />} onClick={addCharacterDisplay}>
                          캐릭터 표시 추가
                        </Button>
                      </div>
                      <ul className="studio-choice-list">
                        {(draftScene.characters || []).map((character, index) => (
                          <li key={`${character.characterId || "character"}-${index}`}>
                            <label className={`field-row${focusedClass("characters", `character:${index}:characters`)}`}>
                              <span>캐릭터</span>
                              <select onChange={(event) => updateCharacter(index, { characterId: event.target.value })} ref={(element) => setFocusTargets(["characters", `character:${index}:characters`], element)} value={character.characterId || ""}>
                                <option value="">없음</option>
                                {(project?.characters || []).map((item) => <option key={item.id} value={item.id}>{characterLabel(project, item.id)}</option>)}
                              </select>
                            </label>
                            <label className="field-row">
                              <span>위치</span>
                              <select onChange={(event) => updateCharacter(index, { position: event.target.value })} value={character.position || "center"}>
                                <option value="left">왼쪽</option>
                                <option value="center">중앙</option>
                                <option value="right">오른쪽</option>
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
                      <h3>검증</h3>
                      <p className="studio-disabled-note">Problems Panel은 해결 허브이고, 이 탭은 선택 씬/프로젝트 검증 요약과 진단을 분리해 표시합니다.</p>
                      {renderProblemPanelState()}
                      <dl className="summary-list">
                        <div><dt>전체 문제</dt><dd>{problemCount}</dd></div>
                        <div><dt>Errors</dt><dd>{errorProblemCount}</dd></div>
                        <div><dt>Warnings</dt><dd>{warningProblemCount}</dd></div>
                        <div><dt>Current Scene</dt><dd>{currentSceneProblemCount}</dd></div>
                      </dl>
                      <h3>생성 결과 로그</h3>
                      <label className="field-row">
                        <span>고정 프롬프트</span>
                        <select onChange={(event) => setSelectedFixedPromptId(event.target.value)} value={selectedFixedPrompt?.promptId || ""}>
                          {fixedPrompts.map((fixture) => (
                            <option key={fixture.promptId} value={fixture.promptId}>{fixture.promptId}</option>
                          ))}
                        </select>
                      </label>
                      <p className="studio-disabled-note">{selectedFixedPrompt?.promptText || generationStatus}</p>
                      <div className="button-row">
                        <Button disabled={generationBusy || fixedPrompts.length === 0} icon={<Play size={16} />} onClick={() => void replayFixedPrompt("actual")} variant="primary">
                          실제 재생
                        </Button>
                        <Button disabled={generationBusy || fixedPrompts.length === 0} icon={<RefreshCw size={16} />} onClick={() => void replayFixedPrompt("mock")}>
                          목 재생
                        </Button>
                      </div>
                      <dl className="summary-list">
                        <div><dt>상태</dt><dd>{generationStatus}</dd></div>
                        <div><dt>분류</dt><dd><StatusChip tone={generationClassificationTone(generationLog?.classification)}>{generationLog?.classification || "실행 전"}</StatusChip></dd></div>
                        <div><dt>소스</dt><dd>{generationSourceText(generationLog)}</dd></div>
                        <div><dt>결과 ID</dt><dd>{generationLog?.resultId || "기록 없음"}</dd></div>
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

      <section aria-label="문제 패널" className={`studio-problems-panel ${layout.problemsCollapsed ? "collapsed" : ""}`}>
        {layout.problemsCollapsed ? null : (
          <button
            role="separator"
            aria-label="문제 패널 높이 조절"
            aria-orientation="horizontal"
            aria-valuemax={Math.max(96, Math.floor(viewport.height * 0.4))}
            aria-valuemin={96}
            aria-valuenow={layout.problemsHeight}
            className="studio-splitter horizontal"
            onKeyDown={(event) => handleLayoutSplitterKeyDown("problems", event)}
            onPointerDown={(event) => {
              event.preventDefault();
              startLayoutResize("problems", event.clientX, event.clientY);
            }}
            type="button"
          />
        )}
        <div className="studio-panel-toolbar">
          <strong>문제 패널</strong>
          <span className="studio-problem-summary-rail">
            <StatusChip tone={errorProblemCount > 0 ? "danger" : "neutral"}>E {errorProblemCount}</StatusChip>
            <StatusChip tone={warningProblemCount > 0 ? "warning" : "neutral"}>W {warningProblemCount}</StatusChip>
            <StatusChip tone={currentSceneProblemCount > 0 ? "warning" : "neutral"}>현재 {currentSceneProblemCount}</StatusChip>
          </span>
          <div className="button-row">
            <Button disabled={saveState === "saving" || dirty} icon={<ListChecks size={16} />} onClick={() => void validateStudio()} title={dirty ? "저장 후 검증을 실행하세요." : "다시 검증"} variant="ghost">
              다시 검증
            </Button>
            <Button icon={<AlertTriangle size={16} />} iconOnly onClick={() => updateLayout({ problemsCollapsed: !layout.problemsCollapsed })} title="문제 패널 접기" />
          </div>
        </div>
        {layout.problemsCollapsed ? null : (
          <>
            {renderProblemPanelState()}
            {renderProblemFilterTabs()}
            {filteredProblemRows.length > 0 ? (
              <ul className="studio-problem-list">
                {filteredProblemRows.map((row) => renderProblemRow(row))}
              </ul>
            ) : problemRows.length > 0 ? (
              <p className="page-muted">선택한 필터에 해당하는 문제가 없습니다.</p>
            ) : (
              <p className="page-muted">문제 없음. 저장 후 검증을 다시 실행하면 최신 상태가 표시됩니다.</p>
            )}
            {renderStudioRepairPanel()}
          </>
        )}
      </section>
    </section>
  );
}
