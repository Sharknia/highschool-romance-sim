import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  Flag,
  GitCompareArrows,
  GitBranch,
  Link2Off,
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
  Trash2,
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
  ProjectGenerationJob,
  ProjectIssue,
  ProjectPreviewPreflight,
  ConditionRuntimeSupport,
  ConditionEvaluationTrace,
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
import {
  fallbackReasonText,
  generationProviderText,
  imageJobKindLabel,
  isDummyGenerationJob,
  isVisualImageJob,
  jobStatusLabel,
  repairDiffOperationLabel,
  repairDiffValueText
} from "./projectDisplayText";
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
type StagePreviewMode = "edit" | "play";
type ScriptBlockKind = "SceneMetaStrip" | "DialogueBlock" | "NarrationBlock" | "StageDirectionBlock" | "ChoiceSummaryBlock" | "EndingBlock";
type GenerationAssistMode = "ready" | "running" | "review" | "protocolReplay" | "unavailable";
type GenerationAssistSourceType = "actualPatch" | "mockReplay" | "protocolReplay" | "unavailableGeneration";
type StudioStructuralOperation =
  | { type: "deleteScene"; sceneId: string; mode?: "failIfReferenced" | "unlinkReferences" }
  | { type: "duplicateScene"; sourceSceneId: string; newSceneId?: string; label?: string }
  | { type: "deleteChoice"; sceneId: string; choiceId: string }
  | { type: "duplicateChoice"; sceneId: string; choiceId: string; newChoiceId?: string; text?: string }
  | { type: "reorderChoice"; sceneId: string; choiceId: string; toIndex: number }
  | { type: "clearChoiceTarget"; sceneId: string; choiceId: string }
  | { type: "unlinkSceneTarget"; sourceSceneId: string; targetSceneId: string; edgeType?: "next" | "choice" | "all" }
  | { type: "setRouteEntry"; routeId: string; sceneId: string };

interface ScriptEditorBlock {
  body: string;
  focusField?: string;
  id: string;
  kind: ScriptBlockKind;
  label: string;
  markerCount: number;
  panel?: StudioPanelId;
}

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

const studioDiagnosticContractTerms = [
  "FlowStatusLegend",
  "SceneNode",
  "ChoiceEdge",
  "RouteEntry",
  "route graph DTO",
  "inline validation",
  "asset missing",
  "actual project mutation",
  "validation stale"
];

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

function labelTextFor(label: string): string {
  if (label === "DialogueBlock 본문") return "대사 본문";
  if (label === "memoryTags") return "메모 태그";
  return label;
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

function sceneStructureModeText(scene: ProjectScene | null, activeRoute: ProjectRoute | null): string {
  if (!scene) return "씬 선택 필요";
  if (activeRoute?.entrySceneId === scene.id) return "시작 씬";
  if (scene.ending) return "엔딩 씬";
  return "일반 씬";
}

function choiceTargetText(choice: SceneChoice, project: ProjectData | null): string {
  if (!choice.next) return "target 없음";
  const target = (project?.scenes || []).find((scene) => scene.id === choice.next);
  return target ? sceneTitle(target) : `missing target: ${choice.next}`;
}

function sceneValidationMarkers(scene: ProjectScene | null, issues: ProjectIssue[]): ProjectIssue[] {
  if (!scene?.id) return [];
  return issues.filter((issue) => (issue.sceneIds || []).includes(scene.id || "") || findIssueSceneId(issue, null) === scene.id || issue.path?.includes(scene.id || ""));
}

function formatMemoryTagsInput(memoryTags?: Record<string, string[]>): string {
  return Object.entries(memoryTags || {})
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .join("\n");
}

function parseMemoryTagsInput(value: string): Record<string, string[]> | undefined {
  const entries = value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawKey, ...rawValues] = line.split(":");
      const key = rawKey.trim();
      const values = rawValues.join(":").split(",").map((tag) => tag.trim()).filter(Boolean);
      return key ? [key, values] as const : null;
    })
    .filter((entry): entry is readonly [string, string[]] => Boolean(entry));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function assetPreviewUrl(asset?: ProjectAsset | null): string {
  const uri = asset?.uri || "";
  if (/^(data:|https?:\/\/|\/)/.test(uri)) {
    return uri;
  }
  return "";
}

function scriptEditorBlocks(scene: ProjectScene | null, activeRoute: ProjectRoute | null, issues: ProjectIssue[]): ScriptEditorBlock[] {
  if (!scene) return [];
  const markers = sceneValidationMarkers(scene, issues);
  return [
    {
      body: `${sceneStructureModeText(scene, activeRoute)} · 확인할 문제 ${markers.length}건`,
      id: "SceneMetaStrip",
      kind: "SceneMetaStrip",
      label: "씬 정보",
      markerCount: markers.length,
      panel: "scene"
    },
    {
      body: scene.speaker ? `${scene.speaker}: ${scene.text || "대사 없음"}` : scene.text || "대사 없음",
      focusField: "text",
      id: "DialogueBlock",
      kind: "DialogueBlock",
      label: "대사",
      markerCount: markers.filter((issue) => issue.path?.includes("text") || issue.path?.includes("speaker")).length,
      panel: "scene"
    },
    {
      body: scene.text ? scene.text.slice(0, 96) : "내레이션 후보 없음",
      focusField: "text",
      id: "NarrationBlock",
      kind: "NarrationBlock",
      label: "내레이션",
      markerCount: 0,
      panel: "scene"
    },
    {
      body: `배경 ${scene.backgroundAssetId ? "연결됨" : "필요"} · CG ${scene.cgAssetId ? "연결됨" : "없음"} · 캐릭터 ${(scene.characters || []).length}명`,
      focusField: "assets",
      id: "StageDirectionBlock",
      kind: "StageDirectionBlock",
      label: "연출/에셋",
      markerCount: markers.filter((issue) => issue.path?.includes("background") || issue.path?.includes("cgAssetId") || issue.path?.includes("characters")).length,
      panel: "assets"
    },
    {
      body: (scene.choices || []).length > 0
        ? (scene.choices || []).map((choice) => `${choice.text || choice.id || "선택지"} -> ${choice.next || "target 없음"}`).join(" / ")
        : "선택지 없음",
      focusField: "choiceTarget",
      id: "ChoiceSummaryBlock",
      kind: "ChoiceSummaryBlock",
      label: "선택지",
      markerCount: markers.filter((issue) => issue.path?.includes("choices") || (issue.choiceIds || []).length > 0).length,
      panel: "choices"
    },
    {
      body: scene.ending ? `${scene.ending.title || "제목 없음"} · ${scene.ending.kind || "normal"}` : "엔딩 없음",
      focusField: "ending",
      id: "EndingBlock",
      kind: "EndingBlock",
      label: "엔딩",
      markerCount: markers.filter((issue) => issue.path?.includes("ending")).length,
      panel: "scene"
    }
  ];
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
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
    ending: scene.ending ? { ...scene.ending } : undefined,
    memoryTags: scene.memoryTags ? Object.fromEntries(Object.entries(scene.memoryTags).map(([key, values]) => [key, [...values]])) : undefined
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
    memoryTags: scene.memoryTags || {},
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
    ending: draft.ending ? { ...draft.ending } : undefined,
    memoryTags: draft.memoryTags ? Object.fromEntries(Object.entries(draft.memoryTags).map(([key, values]) => [key, [...values]])) : undefined
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

function generationAssistSourceType(log: GenerationResultLog | null, hasProtocolReplay: boolean): GenerationAssistSourceType {
  if (log?.sourceType === "actual") return "actualPatch";
  if (log?.sourceType === "mock") return "mockReplay";
  if (hasProtocolReplay) return "protocolReplay";
  return "unavailableGeneration";
}

function generationAssistSourceLabel(sourceType: GenerationAssistSourceType): string {
  if (sourceType === "actualPatch") return "실제 patch";
  if (sourceType === "mockReplay") return "목 replay";
  if (sourceType === "protocolReplay") return "프로토콜 replay";
  return "생성 사용 불가";
}

function generationAssistTone(sourceType: GenerationAssistSourceType): "success" | "warning" | "neutral" {
  if (sourceType === "actualPatch") return "success";
  if (sourceType === "mockReplay" || sourceType === "protocolReplay") return "warning";
  return "neutral";
}

function actualPatchBadge(active: boolean) {
  return (
    <span aria-current={active ? "true" : undefined} data-generation-source-type="actualPatch">
      <StatusChip tone={active ? "success" : "neutral"}>실제 patch</StatusChip>
    </span>
  );
}

function mockReplayBadge(active: boolean) {
  return (
    <span aria-current={active ? "true" : undefined} data-generation-source-type="mockReplay">
      <StatusChip tone={active ? "warning" : "neutral"}>목 replay</StatusChip>
    </span>
  );
}

function protocolReplayBadge(active: boolean) {
  return (
    <span aria-current={active ? "true" : undefined} data-generation-source-type="protocolReplay">
      <StatusChip tone={active ? "warning" : "neutral"}>프로토콜 replay</StatusChip>
    </span>
  );
}

function unavailableGenerationBadge(active: boolean) {
  return (
    <span aria-current={active ? "true" : undefined} data-generation-source-type="unavailableGeneration">
      <StatusChip tone="neutral">생성 사용 불가</StatusChip>
    </span>
  );
}

function studioAssetJobStatusTone(status?: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "planned" || status === "running") return "warning";
  return "neutral";
}

function studioAssetJobSourceText(job: ProjectGenerationJob): string {
  if (isDummyGenerationJob(job)) {
    return `mock/actual/dummy · 목 이미지 · ${fallbackReasonText(job.fallbackReason || job.asset?.provenance?.fallbackReason)}`;
  }
  if (job.provider === "image-generation-adapter") {
    return "mock/actual/dummy · 실제 생성 adapter";
  }
  return `mock/actual/dummy · ${generationProviderText(job.provider)}`;
}

function compactUnknownValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => compactUnknownValue(item)).join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key} ${compactUnknownValue(item)}`)
      .join(" · ");
  }
  if (typeof value === "undefined" || value === null || value === "") {
    return "없음";
  }
  return String(value);
}

function conditionReadableSummary(condition?: Record<string, unknown>): string {
  if (!condition || Object.keys(condition).length === 0) {
    return "조건 후보 없음";
  }
  const parts: string[] = [];
  if (Array.isArray(condition.flags)) {
    parts.push(`필요 flags: ${condition.flags.join(", ")}`);
  }
  if (condition.affinity && typeof condition.affinity === "object") {
    parts.push(`호감도 조건: ${compactUnknownValue(condition.affinity)}`);
  }
  Object.entries(condition)
    .filter(([key]) => key !== "flags" && key !== "affinity")
    .forEach(([key, value]) => parts.push(`${key}: ${compactUnknownValue(value)}`));
  return parts.length ? parts.join(" · ") : "조건 후보 raw 확인 필요";
}

function effectReadableSummary(effects?: Record<string, unknown>): string {
  if (!effects || Object.keys(effects).length === 0) {
    return "효과 후보 없음";
  }
  const parts: string[] = [];
  if (Array.isArray(effects.flags)) {
    parts.push(`추가 flags: ${effects.flags.join(", ")}`);
  }
  if (effects.affinity && typeof effects.affinity === "object") {
    parts.push(`호감도 변화: ${compactUnknownValue(effects.affinity)}`);
  }
  if (effects.memoryTags && typeof effects.memoryTags === "object") {
    parts.push(`memoryTags: ${compactUnknownValue(effects.memoryTags)}`);
  }
  Object.entries(effects)
    .filter(([key]) => key !== "flags" && key !== "affinity" && key !== "memoryTags")
    .forEach(([key, value]) => parts.push(`${key}: ${compactUnknownValue(value)}`));
  return parts.length ? parts.join(" · ") : "효과 후보 raw 확인 필요";
}

function conditionChoiceSummaryText(choice: SceneChoice): string {
  return `${conditionReadableSummary(choice.condition)} / ${effectReadableSummary(choice.effects)}`;
}

function conditionRuntimeGateStatus(support: ConditionRuntimeSupport | null = null, trace: ConditionEvaluationTrace | null = null): string {
  const supported = support?.supported === true;
  const mode = support?.editorMode || "candidate_review_only";
  const strictPreviewStatus = support?.strictPreviewStatus || trace?.status || "not_evaluated";
  const strictSuccess = support?.strictPreviewSuccess === true;
  if (!supported) {
    return `support false · ${mode} · ${strictPreviewStatus} · strict preview success 제외 · conditionPreviewCountsAsStrictSuccess false`;
  }
  return `support true · ${mode} · ${strictPreviewStatus} · ${strictSuccess ? "strict preview success 포함" : "strict preview success 제외"}`;
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
    return { kind: "scene", label: "현재 씬 사이에 장면 삽입" };
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

function structuralImpactText(operation: StudioStructuralOperation, project: ProjectData | null): string {
  if (operation.type === "deleteScene") {
    const scene = (project?.scenes || []).find((item) => item.id === operation.sceneId);
    return `씬 삭제: ${sceneTitle(scene)} · 참조는 unlinkReferences 정책으로 해제됩니다.`;
  }
  if (operation.type === "duplicateScene") {
    const scene = (project?.scenes || []).find((item) => item.id === operation.sourceSceneId);
    return `씬 복제: ${sceneTitle(scene)}의 선택지와 엔딩 설정을 새 ID로 복사합니다.`;
  }
  if (operation.type === "deleteChoice") return `선택지 삭제: ${operation.choiceId}`;
  if (operation.type === "duplicateChoice") return `선택지 복제: ${operation.choiceId}`;
  if (operation.type === "reorderChoice") return `선택지 정렬: ${operation.choiceId} -> ${operation.toIndex + 1}번째`;
  if (operation.type === "clearChoiceTarget") return `target 해제: ${operation.choiceId}의 연결을 missing target 경고 상태로 전환합니다.`;
  if (operation.type === "unlinkSceneTarget") return `씬 연결 해제: ${operation.sourceSceneId} -> ${operation.targetSceneId}`;
  if (operation.type === "setRouteEntry") return `시작 씬 변경: ${operation.routeId} route의 entry를 ${operation.sceneId}로 변경합니다.`;
  return "구조 편집";
}

function structuralOperationRequiresConfirm(operation: StudioStructuralOperation): boolean {
  return ["deleteScene", "deleteChoice", "clearChoiceTarget", "unlinkSceneTarget"].includes(operation.type);
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
  if (edge.kind === "route-entry") return "시작";
  if (edge.kind === "choice") return "선택지";
  if (edge.kind === "next") return "다음";
  return "연결";
}

function routeGraphEdgeActionLabel(edge: StudioRouteGraphEdge): string {
  if (edge.kind === "choice") return "선택지 편집";
  if (edge.kind === "next") return "next 편집";
  if (edge.kind === "route-entry") return "시작 씬 보기";
  return "edge 보기";
}

function routeGraphEdgeText(edge: StudioRouteGraphEdge, targetLabel: string): string {
  const label = edge.label || (edge.kind === "choice" ? "선택지" : routeGraphEdgeKindLabel(edge));
  return `${routeGraphEdgeKindLabel(edge)} · ${label} → ${targetLabel}`;
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
  const [studioAssetJobs, setStudioAssetJobs] = useState<ProjectGenerationJob[]>([]);
  const [studioAssetStatus, setStudioAssetStatus] = useState("StudioAssetJobLifecycle: 이미지 작업 상태를 확인하세요.");
  const [studioAssetErrors, setStudioAssetErrors] = useState<string[]>([]);
  const [studioAssetBusy, setStudioAssetBusy] = useState(false);
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
  const [stagePreviewMode, setStagePreviewMode] = useState<StagePreviewMode>("edit");
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
  const conditionEvaluationTrace = previewPreflight?.conditionEvaluationTrace || null;
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
  const visualAssetJobs = studioAssetJobs.length > 0 ? studioAssetJobs : (project?.generationJobs || []).filter(isVisualImageJob);
  const backgroundAssetJobs = visualAssetJobs.filter((job) => job.kind === "background");
  const cgAssetJobs = visualAssetJobs.filter((job) => job.kind === "cg");
  const selectedSceneAssetJobs = visualAssetJobs.filter((job) =>
    job.outputAssetId === draftScene?.backgroundAssetId
    || job.outputAssetId === draftScene?.cgAssetId
    || job.targetId === draftScene?.id
    || job.targetId === selectedScene?.id
  );
  const plannedStudioAssetJobIds = visualAssetJobs.filter((job) => job.status === "planned" && job.id).map((job) => String(job.id));
  const failedStudioAssetJobIds = visualAssetJobs.filter((job) => job.status === "failed" && job.id).map((job) => String(job.id));
  const dummyStudioAssetJobIds = visualAssetJobs.filter((job) => job.status === "completed" && job.id && isDummyGenerationJob(job)).map((job) => String(job.id));
  const sceneBackgroundAsset = backgroundAssets.find((asset) => asset.id === draftScene?.backgroundAssetId) || null;
  const sceneCgAsset = cgAssets.find((asset) => asset.id === draftScene?.cgAssetId) || null;
  const backgroundPreviewAsset = sceneBackgroundAsset;
  const backgroundPreviewUrl = assetPreviewUrl(backgroundPreviewAsset);
  const cgPreviewUrl = assetPreviewUrl(sceneCgAsset);
  const characterPreviewAssets = (draftScene?.characters || []).map((character, index) => {
    const asset = (project?.assets || []).find((item) => item.id === character.assetId) || null;
    return {
      asset,
      character,
      index,
      previewUrl: assetPreviewUrl(asset)
    };
  });
  const stagePreviewMissingItems = [
    draftScene?.backgroundAssetId && !backgroundPreviewAsset ? "배경 에셋을 다시 연결하세요." : "",
    backgroundPreviewAsset && !backgroundPreviewUrl ? "배경 미리보기 경로를 확인하세요." : "",
    draftScene?.cgAssetId && !sceneCgAsset ? "CG 에셋을 다시 연결하세요." : "",
    sceneCgAsset && !cgPreviewUrl ? "CG 미리보기 경로를 확인하세요." : "",
    ...characterPreviewAssets.map((item) => item.character.assetId && !item.asset ? `${item.character.assetId} 포트레이트를 다시 연결하세요.` : "")
  ].filter(Boolean);
  const currentSceneMarkers = sceneValidationMarkers(draftScene, visibleIssues);
  const currentScriptEditorBlocks = useMemo(() => scriptEditorBlocks(draftScene, activeRoute, visibleIssues), [activeRoute, draftScene, visibleIssues]);
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
  const routeGraphDataSourceText = activeRouteGraph ? "루트 맵 최신 상태" : "루트 맵을 준비하는 중";

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
    setStudioAssetJobs((project?.generationJobs || []).filter(isVisualImageJob));
  }, [project?.generationJobs]);

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
      if (!commandPressed && event.key === "Delete" && selectedScene?.id && !isEditableEventTarget(event.target)) {
        event.preventDefault();
        void deleteSelectedScene();
        return;
      }
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
    setStatusText(`${routeGraphRouteTitle} 루트 맞춤. 장면 ${routeGraphNodes.length}개와 연결 ${routeGraphEdges.length}개를 표시합니다.`);
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
      </section>
    );
  }

  function rawGenerationDiagnostics(): Record<string, unknown> {
    return {
      generation: {
        status: generationStatus,
        log: generationLog,
        selectedFixedPromptId: selectedFixedPrompt?.promptId || selectedFixedPromptId || "",
        fixedPromptCount: fixedPrompts.length
      },
      phase0: {
        status: phase0Status,
        phase0DecisionReport: phase0Report,
        eventLog: phase0EventLog
      },
      selectedIds: {
        projectId,
        routeId: activeRoute?.id || "",
        sceneId: selectedScene?.id || "",
        panel: selectedPanel,
        problemId: selectedProblemQuery || ""
      },
      source: {
        mode: generationAssistMode,
        type: currentGenerationAssistSourceType,
        label: generationAssistSourceLabel(currentGenerationAssistSourceType)
      }
    };
  }

  function ManualAuthoringPrimaryFlow() {
    return (
      <section data-generation-assist-surface="ManualAuthoringPrimaryFlow">
        <h3>수동 제작</h3>
        <p className="studio-disabled-note">수동 제작이 기본 흐름입니다. 생성 보조는 선택형 drawer이며 자연어 event patch와 고정 프롬프트 replay를 그 안에서만 다룹니다.</p>
      </section>
    );
  }

  function GenerationDiagnosticsSurface() {
    return (
      <section data-generation-assist-surface="GenerationDiagnosticsSurface">
        <h3>QA 진단</h3>
        <p className="studio-disabled-note" data-contract-copy="Problems Panel validation issue flow">Problems Panel validation issue flow와 생성 보조 replay 원문은 분리합니다.</p>
        <dl className="summary-list">
          <div><dt>선택 프롬프트</dt><dd>{selectedFixedPrompt?.promptId || selectedFixedPromptId || "선택 없음"}</dd></div>
          <div><dt>현재 route</dt><dd>{activeRoute?.id || "없음"}</dd></div>
          <div><dt>현재 scene</dt><dd>{selectedScene?.id || "없음"}</dd></div>
          <div><dt>현재 problem</dt><dd>{selectedProblemQuery || "없음"}</dd></div>
        </dl>
        <DiagnosticDrawer summary="원문 API envelope">
          <pre data-contract-copy="Phase 0 decision report">{JSON.stringify(rawGenerationDiagnostics(), null, 2)}</pre>
        </DiagnosticDrawer>
      </section>
    );
  }

  function renderGenerationAssistDrawer() {
    return (
      <DiagnosticDrawer summary="생성 보조 / QA">
        <section data-generation-assist-surface="StudioGenerationAssistDrawer">
          <ManualAuthoringPrimaryFlow />
          <section>
            <h3>생성 결과 로그</h3>
            <p className="studio-disabled-note">실제 patch, 목 replay, 프로토콜 replay, 생성 사용 불가 상태를 같은 검증 문제 목록에 섞지 않고 구분합니다.</p>
            <div className="button-row">
              {actualPatchBadge(currentGenerationAssistSourceType === "actualPatch")}
              {mockReplayBadge(currentGenerationAssistSourceType === "mockReplay")}
              {protocolReplayBadge(currentGenerationAssistSourceType === "protocolReplay")}
              {unavailableGenerationBadge(currentGenerationAssistSourceType === "unavailableGeneration")}
            </div>
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
              <div><dt>보조 모드</dt><dd>{generationAssistMode}</dd></div>
              <div><dt>분류</dt><dd><StatusChip tone={generationClassificationTone(generationLog?.classification)}>{generationLog?.classification || "실행 전"}</StatusChip></dd></div>
              <div><dt>소스</dt><dd><span data-generation-source-type={currentGenerationAssistSourceType}><StatusChip tone={generationAssistTone(currentGenerationAssistSourceType)}>{generationAssistSourceLabel(currentGenerationAssistSourceType)}</StatusChip></span> · {generationSourceText(generationLog)}</dd></div>
              <div><dt>결과 ID</dt><dd>{generationLog?.resultId || "기록 없음"}</dd></div>
            </dl>
          </section>
          {renderPhase0ProtocolPanel()}
          <GenerationDiagnosticsSurface />
        </section>
      </DiagnosticDrawer>
    );
  }

  function studioAssetForJob(job: ProjectGenerationJob): ProjectAsset | null {
    return job.asset || (project?.assets || []).find((asset) => asset.id === job.outputAssetId) || null;
  }

  function applyStudioAssetResult(result: ProjectApiResult, fallbackStatus: string): void {
    const nextJobs = (result.project?.generationJobs || result.jobs || (result.job ? [result.job] : [])).filter(isVisualImageJob);
    setStudioAssetJobs(nextJobs);
    setStudioAssetErrors(result.errors || result.issues?.map(issueText) || []);
    applyStudioDtoState(result);
    const nextRevision = revisionFromResult(result);
    if (nextRevision) {
      setLocalRevision(nextRevision);
    }
    if (result.project || result.previewPreflight || result.previewReadiness || result.exportPlan) {
      onProjectResult(result);
      setValidationRunState(result.previewPreflight ? "current" : "stale");
    }
    setStudioAssetStatus(result.message || result.error || fallbackStatus);
  }

  async function loadStudioGenerationJobs(): Promise<void> {
    setStudioAssetBusy(true);
    setStudioAssetErrors([]);
    setStudioAssetStatus("StudioAssetJobLifecycle: 이미지 작업을 불러오는 중입니다.");
    try {
      const result = await postJson("/api/generation/jobs/list", { projectDirectory });
      if (isApiFailure(result)) {
        applyStudioAssetResult(result, "이미지 작업을 불러오지 못했습니다.");
        return;
      }
      applyStudioAssetResult(result, result.jobs?.length ? "Studio Assets tab에서 CG/background image job 상태를 확인했습니다." : "Studio Assets tab에 표시할 CG/background image job이 없습니다.");
    } catch (error) {
      setStudioAssetStatus(`이미지 작업 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
      setStudioAssetErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setStudioAssetBusy(false);
    }
  }

  async function runStudioImageJobs(jobIds: string[], retryFailed = false, replaceCompleted = false): Promise<void> {
    if (jobIds.length === 0) {
      setStudioAssetStatus(replaceCompleted ? "교체할 목/더미 이미지 작업이 없습니다." : retryFailed ? "재시도할 실패 이미지 작업이 없습니다." : "실행할 예정 이미지 작업이 없습니다.");
      return;
    }
    setStudioAssetBusy(true);
    setStudioAssetErrors([]);
    setStudioAssetStatus(replaceCompleted ? "목/더미 이미지를 실제 이미지로 replaceCompleted 실행 중입니다." : retryFailed ? "실패 이미지 작업 retryFailed 실행 중입니다." : "예정 이미지 작업을 실행 중입니다.");
    recordUXDecisionEvent({
      eventName: "generated",
      inputMode: "manual",
      outcome: "started",
      generationJobId: jobIds.join(","),
      sourceGeneratedBy: replaceCompleted ? "actual-replace" : retryFailed ? "retryFailed" : "studio-assets"
    });
    try {
      const result = await postJson("/api/generation/jobs/run", {
        projectDirectory,
        jobIds,
        retryFailed,
        replaceCompleted
      });
      applyStudioAssetResult(result, result.assets?.length ? "이미지 생성 결과가 프로젝트 에셋에 연결되었습니다." : "완료된 작업은 재생성하지 않고 기존 결과를 유지했습니다.");
      recordUXDecisionEvent({
        eventName: "generated",
        inputMode: "manual",
        outcome: isApiFailure(result) ? "failed" : "success",
        generationJobId: jobIds.join(","),
        sourceGeneratedBy: replaceCompleted ? "actual-replace" : retryFailed ? "retryFailed" : "studio-assets",
        failureCause: result.message || result.error || result.errors?.join(" · ")
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStudioAssetStatus(`이미지 작업 실행 실패: ${message}`);
      setStudioAssetErrors([message]);
      recordUXDecisionEvent({
        eventName: "generated",
        inputMode: "manual",
        outcome: "failed",
        generationJobId: jobIds.join(","),
        sourceGeneratedBy: replaceCompleted ? "actual-replace" : retryFailed ? "retryFailed" : "studio-assets",
        failureCause: message
      });
    } finally {
      setStudioAssetBusy(false);
    }
  }

  function connectCompletedAssetToScene(job: ProjectGenerationJob): void {
    const asset = studioAssetForJob(job);
    const assetId = asset?.id || job.outputAssetId || "";
    if (!assetId) {
      setStudioAssetStatus("연결할 생성 결과 asset이 없습니다.");
      return;
    }
    if (job.kind === "background") {
      patchDraftScene({ backgroundAssetId: assetId });
      setStudioAssetStatus("생성된 background asset을 현재 씬 backgroundAssetId에 연결했습니다. 저장하면 반영됩니다.");
      return;
    }
    if (job.kind === "cg") {
      patchDraftScene({ cgAssetId: assetId });
      setStudioAssetStatus("생성된 CG asset을 현재 씬 cgAssetId에 연결했습니다. 저장하면 반영됩니다.");
      return;
    }
    setStudioAssetStatus("background/CG 작업만 현재 씬 slot에 연결할 수 있습니다.");
  }

  function ConditionEffectCandidateReview() {
    const conditionProblemRows = problemRows.filter((row) =>
      row.issue.code === "conditional-choice-runtime-unsupported"
      || row.issue.path?.includes("condition")
      || row.issue.path?.includes("effects")
      || row.focus?.inspectorPanel === "stats"
    );
    return (
      <section
        className={focusedClass("condition", "effects", "stats:condition", "stats:effects").trim()}
        data-condition-evaluation-trace={conditionEvaluationTrace?.status || "not_evaluated"}
        data-condition-runtime-support={conditionSupportMode}
        ref={(element) => {
          inspectorFirstFieldRef.current = element;
          setFocusTargets(["condition", "effects", "stats:condition", "stats:effects"], element);
        }}
        tabIndex={-1}
      >
        <h3>조건/효과 후보 검토</h3>
        <p className="studio-disabled-note">
          조건 판정 런타임 지원이 #105에서 확정되기 전까지 편집할 수 없습니다. 현재 {conditionRuntimeGateStatus(conditionRuntimeSupport, conditionEvaluationTrace)}입니다. {conditionStrictPreviewText}
        </p>
        <dl className="summary-list">
          <div><dt>support</dt><dd>{conditionRuntimeSupport?.supported ? "support true" : "support false"}</dd></div>
          <div><dt>editor mode</dt><dd>{conditionSupportMode === "candidate_review_only" ? "candidate review only" : conditionSupportMode}</dd></div>
          <div><dt>strict preview</dt><dd>{conditionRuntimeSupport?.strictPreviewSuccess ? "strict preview success 포함" : "strict preview success 제외"}</dd></div>
          <div><dt>conditionPreviewCountsAsStrictSuccess</dt><dd>false</dd></div>
          <div><dt>ConditionEvaluationTrace</dt><dd>{conditionEvaluationTrace?.reasonCode || conditionRuntimeSupport?.reasonCode || "conditional-choice-runtime-unsupported"}</dd></div>
        </dl>
        <div className="button-row">
          <Button disabled icon={<Settings size={16} />} title="support false 상태에서는 조건 builder를 저장 가능한 편집기로 열지 않습니다.">
            조건 builder 비활성
          </Button>
          <Button disabled icon={<Settings size={16} />} title="support false 상태에서는 효과 builder를 저장 가능한 편집기로 열지 않습니다.">
            효과 builder 비활성
          </Button>
          <Button icon={<MousePointerClick size={16} />} onClick={() => setPanel("choices")} variant="ghost">
            선택지 탭으로 이동
          </Button>
          <Button icon={<ListChecks size={16} />} onClick={() => setPanel("validation")} variant="ghost">
            검증 탭으로 이동
          </Button>
          <Button disabled={conditionProblemRows.length === 0} icon={<AlertTriangle size={16} />} onClick={openProblemsPanel} variant="ghost">
            관련 Problems Panel
          </Button>
        </div>
        <ul className="studio-readonly-list">
          {(draftScene?.choices || []).map((choice, index) => {
            const hasCondition = Boolean(choice.condition && Object.keys(choice.condition).length);
            const hasEffects = Boolean(choice.effects && Object.keys(choice.effects).length);
            return (
              <li data-condition-choice-id={choice.id || `choice-${index}`} key={choice.id || index}>
                <strong>{choice.text || "선택지"}</strong>
                <span>{conditionChoiceSummaryText(choice)}</span>
                <small>사람 readable summary · 조건 후보 {hasCondition ? "있음" : "없음"} · 효과 후보 {hasEffects ? "있음" : "없음"}</small>
              </li>
            );
          })}
          {(draftScene?.choices || []).length === 0 ? (
            <li><strong>선택지 없음</strong><span>선택지 탭에서 선택지를 만들면 조건/효과 후보 요약이 여기에 표시됩니다.</span></li>
          ) : null}
          {conditionProblemRows.map((row) => (
            <li key={`condition-problem-${row.key}`}>
              <strong>{row.issue.message || row.issue.code || "조건/효과 문제"}</strong>
              <span>{row.defaultActionLabel || "검토 필요"}</span>
            </li>
          ))}
        </ul>
        <DiagnosticDrawer summary="ConditionEvaluationTrace 원문">
          <pre>{JSON.stringify({ conditionRuntimeSupport, conditionEvaluationTrace }, null, 2)}</pre>
        </DiagnosticDrawer>
      </section>
    );
  }

  function renderStudioAssetJob(job: ProjectGenerationJob) {
    const asset = studioAssetForJob(job);
    const canConnect = Boolean(asset?.id || job.outputAssetId) && (job.kind === "background" || job.kind === "cg");
    return (
      <li data-studio-asset-job={job.id || job.outputAssetId || "asset-job"} key={job.id || job.outputAssetId || `${job.kind}-${job.targetId}`}>
        <strong>{imageJobKindLabel(job.kind)} · {job.id || job.outputAssetId || "작업 ID 없음"}</strong>
        <span>{jobStatusLabel(job.status)} · {studioAssetJobSourceText(job)}</span>
        <small>target {job.targetId || "확인 필요"} · outputAssetId {job.outputAssetId || "확인 필요"}</small>
        {job.failureMessage ? <small>{job.failureMessage}</small> : null}
        {asset?.uri ? <small>에셋 경로 연결됨</small> : <small>{job.status === "completed" ? "생성 결과 연결 확인 필요" : "에셋 연결 대기"}</small>}
        <div className="button-row">
          <StatusChip tone={studioAssetJobStatusTone(job.status)}>{jobStatusLabel(job.status)}</StatusChip>
          {isDummyGenerationJob(job) ? <StatusChip tone="warning">목/더미</StatusChip> : <StatusChip tone="neutral">실제/adapter</StatusChip>}
          <Button disabled={!canConnect} icon={<CheckCircle2 size={16} />} onClick={() => connectCompletedAssetToScene(job)} variant="ghost">
            현재 씬 slot 연결
          </Button>
        </div>
      </li>
    );
  }

  function StudioAssetJobLifecycle() {
    return (
      <section data-asset-slot="generationJobs">
        <h3>이미지 작업</h3>
        <p className="studio-disabled-note">StudioAssetJobLifecycle은 기존 generation job contract를 소비합니다. mock/actual/dummy 결과를 구분하고 completed job은 replaceCompleted가 아니면 재생성하지 않습니다.</p>
        <div className="button-row">
          <Button disabled={studioAssetBusy} icon={<RefreshCw size={16} />} onClick={() => void loadStudioGenerationJobs()}>
            이미지 작업 새로고침
          </Button>
          <Button disabled={studioAssetBusy || plannedStudioAssetJobIds.length === 0} icon={<Play size={16} />} onClick={() => void runStudioImageJobs(plannedStudioAssetJobIds)}>
            예정 작업 실행
          </Button>
          <Button disabled={studioAssetBusy || failedStudioAssetJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runStudioImageJobs(failedStudioAssetJobIds, true)}>
            실패 retry
          </Button>
          <Button disabled={studioAssetBusy || dummyStudioAssetJobIds.length === 0} icon={<RefreshCw size={16} />} onClick={() => void runStudioImageJobs(dummyStudioAssetJobIds, true, true)} variant="primary">
            목/더미 실제 이미지로 교체
          </Button>
        </div>
        <dl className="summary-list">
          <div><dt>상태</dt><dd>{studioAssetStatus}</dd></div>
          <div><dt>background jobs</dt><dd>{backgroundAssetJobs.length}</dd></div>
          <div><dt>CG jobs</dt><dd>{cgAssetJobs.length}</dd></div>
          <div><dt>Stage asset jobs</dt><dd>{selectedSceneAssetJobs.length}</dd></div>
        </dl>
        {studioAssetErrors.length ? (
          <ul className="studio-readonly-list">
            {studioAssetErrors.map((error) => <li key={error}><strong>생성 오류</strong><span>{error}</span></li>)}
          </ul>
        ) : null}
        <ul className="studio-readonly-list">
          {visualAssetJobs.length ? visualAssetJobs.map((job) => renderStudioAssetJob(job)) : (
            <li><strong>이미지 작업 없음</strong><span>ProjectDetailView 또는 생성 API에서 background/CG job을 준비하면 여기에 표시됩니다.</span></li>
          )}
        </ul>
        <section data-asset-slot="audio">
          <h3>Audio unsupported</h3>
          <p className="studio-disabled-note">audio placeholder · Alpha에서는 audio generation/runtime playback을 구현하지 않으며 후속 범위로만 표시합니다.</p>
        </section>
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

  function confirmStructuralMutation(label: string, operations: StudioStructuralOperation[]): boolean {
    if (dirty && !confirmDiscardDirtyDraft()) {
      return false;
    }
    if (!operations.some(structuralOperationRequiresConfirm)) {
      return true;
    }
    const impacts = operations.map((operation) => `- ${structuralImpactText(operation, project)}`).join("\n");
    return window.confirm(`${label}\n\n영향 범위\n${impacts}\n\n구조 편집은 즉시 저장됩니다. 계속할까요?`);
  }

  async function applyStudioStructuralMutation(
    operations: StudioStructuralOperation[],
    fallbackStatus: string,
    options: { selectedSceneId?: string } = {}
  ): Promise<ProjectRevision | null> {
    if (operations.length === 0) {
      setStatusText("적용할 구조 편집이 없습니다.");
      return null;
    }
    if (!confirmStructuralMutation(fallbackStatus, operations)) {
      setStatusText("구조 편집을 취소했습니다.");
      return null;
    }
    const expectedProjectRevision = await ensureRevision();
    if (!expectedProjectRevision) {
      setSaveState("failed");
      setStatusText("저장 실패: 최신 projectRevision을 확인할 수 없습니다.");
      return null;
    }
    setSaveState("saving");
    setStatusText("구조 편집을 적용하는 중입니다.");
    try {
      const result = await postJson("/api/project/studio/mutate", {
        expectedProjectRevision,
        operations,
        projectDirectory,
        routeId: activeRoute?.id,
        sceneId: options.selectedSceneId || selectedScene?.id || draftScene?.id
      });
      if (isApiFailure(result)) {
        applyFailedResult(result, fallbackStatus);
        return null;
      }
      applySuccessfulResult(result, `${fallbackStatus} 구조 편집은 즉시 저장되었습니다.`, {
        preserveContext: true,
        selectedSceneId: options.selectedSceneId
      });
      return revisionFromResult(result);
    } catch (error) {
      setSaveState("apiFailure");
      setStatusText(`API 실패: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async function duplicateSelectedScene(): Promise<void> {
    if (!selectedScene?.id) {
      setStatusText("복제할 씬을 먼저 선택해야 합니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "duplicateScene", sourceSceneId: selectedScene.id }
    ], "씬 복제 완료.");
  }

  async function deleteSelectedScene(): Promise<void> {
    if (!selectedScene?.id) {
      setStatusText("삭제할 씬을 먼저 선택해야 합니다.");
      return;
    }
    if (scenes.length <= 1) {
      setStatusText("마지막 씬은 삭제할 수 없습니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "deleteScene", sceneId: selectedScene.id, mode: "unlinkReferences" }
    ], "씬 삭제 완료.");
  }

  async function setSelectedSceneAsRouteEntry(): Promise<void> {
    if (!activeRoute?.id || !selectedScene?.id) {
      setStatusText("시작 씬으로 지정할 route와 씬이 필요합니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "setRouteEntry", routeId: activeRoute.id, sceneId: selectedScene.id }
    ], "시작 씬 지정 완료.", { selectedSceneId: selectedScene.id });
  }

  async function duplicateChoiceViaMutation(choice: SceneChoice): Promise<void> {
    if (!selectedScene?.id || !choice.id) {
      setStatusText("복제할 선택지를 먼저 선택해야 합니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "duplicateChoice", sceneId: selectedScene.id, choiceId: choice.id }
    ], "선택지 복제 완료.", { selectedSceneId: selectedScene.id });
  }

  async function deleteChoiceViaMutation(choice: SceneChoice): Promise<void> {
    if (!selectedScene?.id || !choice.id) {
      setStatusText("삭제할 선택지를 먼저 선택해야 합니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "deleteChoice", sceneId: selectedScene.id, choiceId: choice.id }
    ], "선택지 삭제 완료.", { selectedSceneId: selectedScene.id });
  }

  async function moveChoiceViaMutation(choice: SceneChoice, toIndex: number): Promise<void> {
    if (!selectedScene?.id || !choice.id) {
      setStatusText("정렬할 선택지를 먼저 선택해야 합니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "reorderChoice", sceneId: selectedScene.id, choiceId: choice.id, toIndex }
    ], "선택지 정렬 완료.", { selectedSceneId: selectedScene.id });
  }

  async function clearChoiceTargetViaMutation(choice: SceneChoice): Promise<void> {
    if (!selectedScene?.id || !choice.id) {
      setStatusText("target을 해제할 선택지를 먼저 선택해야 합니다.");
      return;
    }
    await applyStudioStructuralMutation([
      { type: "clearChoiceTarget", sceneId: selectedScene.id, choiceId: choice.id }
    ], "선택지 target 해제 완료.", { selectedSceneId: selectedScene.id });
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
    if (ending && (draftScene.next || (draftScene.choices || []).length > 0)) {
      const confirmed = window.confirm("엔딩 설정은 이 씬의 다음 연결과 선택지를 해제합니다. 초안에 반영할까요?");
      if (!confirmed) {
        setStatusText("엔딩 설정을 취소했습니다.");
        return;
      }
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
    setStudioRepairStatus("입력이 변경되었습니다. 변경 미리보기를 다시 확인하세요.");
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
    setStudioRepairStatus("변경 미리보기를 계산하는 중입니다.");
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
        setStudioRepairStatus(repairResultMessage(result, "변경 미리보기를 계산하지 못했습니다."));
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
      setStudioRepairStatus("변경 미리보기를 확인한 뒤 적용을 누르세요.");
    } catch (error) {
      setStudioRepairPreview(null);
      setStudioRepairStatus(`변경 미리보기 계산 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStudioRepairBusy(false);
    }
  }

  async function applyStudioRepairPreview(): Promise<void> {
    if (!studioRepairPreview?.repairAction || !studioRepairPreview.beforeRevision || !studioRepairPreview.confirmToken) {
      setStudioRepairStatus("먼저 변경 미리보기를 확인해야 합니다.");
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
        setStudioRepairStatus(`${repairResultMessage(result, "수정을 적용하지 못했습니다.")} 변경 미리보기를 다시 확인하세요.`);
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
      setStudioRepairStatus(`수정 적용 실패: ${error instanceof Error ? error.message : String(error)} 변경 미리보기를 다시 확인하세요.`);
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

  function renderScriptBlock(block: ScriptEditorBlock) {
    return (
      <button
        className={`studio-script-block ${block.kind}`}
        data-script-block={block.kind}
        key={block.id}
        onClick={() => {
          if (block.panel) {
            setPanel(block.panel);
          }
          if (block.focusField) {
            setFocusedFieldKey(block.focusField);
            setFocusRequestTick((current) => current + 1);
          }
        }}
        type="button"
      >
        <span>
          <strong>{block.label}</strong>
          <small>{block.body}</small>
        </span>
        <StatusChip tone={block.markerCount > 0 ? "warning" : "neutral"}>{block.markerCount}</StatusChip>
      </button>
    );
  }

  function renderFlowStatusLegend() {
    return (
      <section className={`studio-flow-legend ${flowLegendCollapsed ? "collapsed" : ""}`} aria-label="FlowStatusLegend">
        <button onClick={() => setFlowLegendCollapsed((current) => !current)} type="button">
          <GitBranch aria-hidden="true" size={14} />
          <span>흐름 범례</span>
          <small>{flowLegendCollapsed ? "펼치기" : "접기"}</small>
        </button>
        {flowLegendCollapsed ? null : (
          <dl>
            <div><dt>오류</dt><dd>프리뷰를 막는 문제 또는 연결되지 않은 대상</dd></div>
            <div><dt>주의</dt><dd>검토가 필요한 사전 점검 경고</dd></div>
            <div><dt>엔딩</dt><dd>도달 가능한 마무리 장면</dd></div>
            <div><dt>조건</dt><dd>조건/효과 후보가 있는 선택지</dd></div>
            <div><dt>변경</dt><dd>저장 전 초안이 루트 맵보다 최신인 상태</dd></div>
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
            setStatusText(`${node.label || node.id || "씬"} 작업: ${commandAddAction.label}`);
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
            <strong>{node.label || node.id || "씬"}</strong>
            <small>{node.summary || sceneSummaryText(scene)}</small>
          </span>
          <span className="studio-node-badges">
            {node.entry ? <StatusChip tone="success">시작</StatusChip> : null}
            {node.ending ? <StatusChip tone="warning">엔딩</StatusChip> : null}
            {choicesCount > 0 ? <StatusChip>선택지 {choicesCount}</StatusChip> : null}
            {hasConditionalChoice ? <StatusChip tone="warning">조건</StatusChip> : null}
            {node.unreachable ? <StatusChip tone="danger">도달 불가</StatusChip> : null}
            {view.problemCount > 0 ? <StatusChip tone={nodeSeverity}>{view.problemCount}</StatusChip> : null}
            {hasDirtyDraft ? <StatusChip tone="warning">변경됨</StatusChip> : null}
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
                  <small>프로젝트에 적용 전 미리보기</small>
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
        <small>표시된 변경을 확인한 뒤 프로젝트에 적용합니다.</small>
        {studioRepairPreview ? (
          <>
            <dl className="summary-list">
              <div><dt>수리 액션</dt><dd>{studioRepairPreview.repairAction?.label || studioRepairPreview.actionId || "수리 후보"}</dd></div>
              <div><dt>대상</dt><dd>{studioRepairPreview.targetPath || "대상 확인 필요"}</dd></div>
              <div><dt>기준 revision</dt><dd>{studioRepairPreview.beforeRevision?.revision || "revision 확인 필요"}</dd></div>
              <div><dt>확인 방식</dt><dd>{studioRepairPreview.repairAction?.requiresConfirmation || studioRepairPreview.destructiveWarnings?.length ? "변경 확인 후 적용" : "즉시 적용 가능"}</dd></div>
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
  const generationAssistMode: GenerationAssistMode = generationBusy
    ? "running"
    : generationLog
      ? "review"
      : phase0Report || phase0EventLog
        ? "protocolReplay"
        : fixedPrompts.length > 0
          ? "ready"
          : "unavailable";
  const currentGenerationAssistSourceType = generationAssistSourceType(generationLog, Boolean(phase0Report || phase0EventLog));
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
              <div><dt>계약 용어</dt><dd>{studioDiagnosticContractTerms.join(", ")}</dd></div>
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
                  placeholder="씬과 선택지 검색"
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
                <span aria-label="preview startSceneId">{previewCommandDisabledReason || "프리뷰 이동 가능"} · 현재 씬 시작 {selectedScene?.id || "없음"} · 문제 {problemCount}건</span>
              </div>
              <div className="studio-stage-mode" role="tablist" aria-label="Stage Preview mode">
                <button className={stagePreviewMode === "edit" ? "selected" : ""} onClick={() => setStagePreviewMode("edit")} role="tab" type="button">Edit Preview</button>
                <button className={stagePreviewMode === "play" ? "selected" : ""} onClick={() => setStagePreviewMode("play")} role="tab" type="button">Play Preview</button>
              </div>
            </div>
            <div className="studio-stage-frame" data-stage-preview-mode={stagePreviewMode}>
              <div className="studio-stage-backdrop">
                {backgroundPreviewUrl ? <img alt={assetLabel(backgroundPreviewAsset)} src={backgroundPreviewUrl} /> : <span className="studio-asset-missing">{assetLabel(backgroundPreviewAsset)} · 배경을 연결하거나 생성하세요.</span>}
              </div>
              {sceneCgAsset ? (
                <div className="studio-stage-cg">
                  {cgPreviewUrl ? <img alt={assetLabel(sceneCgAsset)} src={cgPreviewUrl} /> : <span className="studio-asset-missing">{assetLabel(sceneCgAsset)} · CG 경로를 확인하세요.</span>}
                </div>
              ) : null}
              <div className="studio-stage-characters">
                {characterPreviewAssets.map(({ asset, character, index, previewUrl }) => (
                  previewUrl ? (
                    <img alt={assetLabel(asset)} className={`studio-character-sprite ${character.position || "center"}`} key={`${character.characterId || "character"}-${index}`} src={previewUrl} />
                  ) : (
                    <span className={`studio-character-pill ${character.position || "center"} studio-asset-missing`} key={`${character.characterId || "character"}-${index}`}>
                      {characterLabel(project, character.characterId)} · 포트레이트를 연결하세요.
                    </span>
                  )
                ))}
              </div>
              {stagePreviewMissingItems.length > 0 || selectedSceneAssetJobs.length > 0 || dirty || problemPanelState === "stale" || previewCommandDisabledReason ? (
                <div aria-label="StagePreviewOverlay" className="studio-stage-overlay">
                  {dirty || problemPanelState === "stale" ? <StatusChip tone="warning">검증 갱신 필요</StatusChip> : null}
                  {previewCommandDisabledReason ? <StatusChip tone="danger">{previewCommandDisabledReason}</StatusChip> : null}
                  {selectedSceneAssetJobs.length > 0 ? <StatusChip tone="neutral">Stage asset jobs {selectedSceneAssetJobs.map((job) => `${imageJobKindLabel(job.kind)} ${jobStatusLabel(job.status)}`).join(" · ")}</StatusChip> : null}
                  {stagePreviewMissingItems.map((item) => <StatusChip key={item} tone="warning">{item}</StatusChip>)}
                </div>
              ) : null}
              <div className="studio-dialogue-box">
                <strong>{draftScene?.speaker || "화자 없음"}</strong>
                <p>{draftScene?.text || "대사를 입력하면 이 영역에서 장면 톤을 확인할 수 있습니다."}</p>
                {(draftScene?.choices || []).length > 0 ? (
                  <div className="studio-choice-preview">
                    {(draftScene?.choices || []).map((choice, index) => <span key={choice.id || index}>{choice.text || "선택지"}</span>)}
                  </div>
                ) : null}
                {draftScene?.ending ? <StatusChip tone="warning">엔딩 · {draftScene.ending.title || "제목 없음"}</StatusChip> : null}
                {stagePreviewMode === "play" ? <Button disabled={Boolean(previewCommandDisabledReason)} icon={<Play size={16} />} onClick={openPreview}>현재 씬에서 플레이</Button> : null}
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
              <div className="studio-editor-grid block-aware">
                <div className="studio-scene-meta-strip" aria-label="SceneMetaStrip">
                  <StatusChip tone={activeRoute?.entrySceneId === draftScene.id ? "success" : draftScene.ending ? "warning" : "neutral"}>{sceneStructureModeText(draftScene, activeRoute)}</StatusChip>
                  <span>scene id {draftScene.id || "없음"}</span>
                  <span>route {activeRoute?.title || activeRoute?.id || "없음"}</span>
                  <StatusChip tone={currentSceneMarkers.length > 0 ? "warning" : "success"}>문제 {currentSceneMarkers.length}건</StatusChip>
                </div>
                <div className="studio-script-block-list">
                  {currentScriptEditorBlocks.map((block) => renderScriptBlock(block))}
                </div>
                <label className={`field-row studio-editor-text${focusedClass("text", `scene:${draftScene.id || ""}`)}`}>
                  <span>{labelTextFor("DialogueBlock 본문")}</span>
                  <textarea
                    aria-label={labelTextFor("DialogueBlock 본문")}
                    ref={(element) => {
                      scriptTextareaRef.current = element;
                      setFocusTargets(["text", "scene:text", draftScene.id ? `scene:${draftScene.id}` : ""], element);
                    }}
                    onChange={(event) => patchDraftScene({ text: event.target.value })}
                    value={draftScene.text || ""}
                  />
                </label>
                <label className={`field-row${focusedClass("speaker", "scene:speaker")}`}>
                  <span>화자</span>
                  <input aria-label={labelTextFor("화자")} onChange={(event) => patchDraftScene({ speaker: event.target.value })} ref={(element) => setFocusTargets(["speaker", "scene:speaker"], element)} value={draftScene.speaker || ""} />
                </label>
                <label className={`field-row${focusedClass("label", "scene:label")}`}>
                  <span>라벨</span>
                  <input aria-label={labelTextFor("라벨")} onChange={(event) => patchDraftScene({ label: event.target.value })} ref={(element) => setFocusTargets(["label", "scene:label"], element)} value={draftScene.label || ""} />
                </label>
                <label className="field-row studio-editor-text">
                  <span>{labelTextFor("memoryTags")}</span>
                  <textarea
                    aria-label={labelTextFor("memoryTags")}
                    onChange={(event) => patchDraftScene({ memoryTags: parseMemoryTagsInput(event.target.value) })}
                    placeholder="key: tag-a, tag-b"
                    value={formatMemoryTagsInput(draftScene.memoryTags)}
                  />
                </label>
                <p className="studio-disabled-note">notes/tags는 현재 scene schema-backed 필드가 아니므로 이 화면에서 저장 가능한 값처럼 제공하지 않습니다.</p>
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
                      <div className="studio-scene-actions" aria-label="씬 구조 편집">
                        <div>
                          <StatusChip tone={draftScene.ending ? "warning" : activeRoute?.entrySceneId === draftScene.id ? "success" : "neutral"}>{sceneStructureModeText(draftScene, activeRoute)}</StatusChip>
                          <small>구조 편집은 즉시 저장됩니다. 엔딩 입력과 이름/본문 같은 초안 편집은 저장 버튼으로 반영합니다.</small>
                        </div>
                        <div className="button-row">
                          <Button data-structural-action="setRouteEntry" disabled={saveState === "saving" || !activeRoute?.id || activeRoute.entrySceneId === draftScene.id} icon={<Flag size={16} />} onClick={() => void setSelectedSceneAsRouteEntry()} title="현재 route의 시작 씬으로 지정">
                            시작 지정
                          </Button>
                          <Button data-structural-action="duplicateScene" disabled={saveState === "saving"} icon={<Copy size={16} />} onClick={() => void duplicateSelectedScene()} title="현재 씬 복제">
                            복제
                          </Button>
                          <Button data-structural-action="deleteScene" disabled={saveState === "saving" || scenes.length <= 1} icon={<Trash2 size={16} />} onClick={() => void deleteSelectedScene()} title={scenes.length <= 1 ? "마지막 씬은 삭제할 수 없습니다." : "Delete 키로도 삭제 확인을 열 수 있습니다."} variant="danger">
                            삭제
                          </Button>
                        </div>
                      </div>
                      <label className={`field-row${focusedClass("label", "scene:label")}`}>
                        <span>라벨</span>
                        <input
                          aria-label={labelTextFor("라벨")}
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
                        <input aria-label={labelTextFor("화자")} onChange={(event) => patchDraftScene({ speaker: event.target.value })} ref={(element) => setFocusTargets(["speaker", "scene:speaker"], element)} value={draftScene.speaker || ""} />
                      </label>
                      <label className={`field-row${focusedClass("ending", "scene:ending")}`}>
                        <span>엔딩 제목</span>
                        <input aria-label={labelTextFor("엔딩 제목")} onChange={(event) => patchDraftScene({ ending: { ...(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, kind: "normal" }), title: event.target.value } })} ref={(element) => setFocusTargets(["ending", "scene:ending"], element)} value={draftScene.ending?.title || ""} />
                      </label>
                      <label className={`field-row${focusedClass("ending", "scene:ending")}`}>
                        <span>엔딩 종류</span>
                        <select aria-label={labelTextFor("엔딩 종류")} onChange={(event) => patchDraftScene({ ending: { ...(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, title: "새 엔딩" }), kind: event.target.value } })} ref={(element) => setFocusTargets(["endingKind", "scene:endingKind"], element)} value={draftScene.ending?.kind || "normal"}>
                          <option value="normal">일반</option>
                          <option value="good">좋음</option>
                          <option value="bad">나쁨</option>
                        </select>
                      </label>
                      <p className="studio-disabled-note">엔딩으로 설정하면 다음 연결과 선택지를 해제할지 먼저 확인합니다.</p>
                      <div className="button-row">
                        <Button data-structural-action="setEndingDraft" disabled={saveState === "saving"} icon={<CheckCircle2 size={16} />} onClick={() => applyDraftEnding(draftScene.ending || { id: `ending-${draftScene.id || "scene"}`, kind: "normal", title: "새 엔딩" })}>
                          엔딩 적용
                        </Button>
                        <Button data-structural-action="unsetEndingDraft" disabled={saveState === "saving" || !draftScene.ending} icon={<RefreshCw size={16} />} onClick={() => applyDraftEnding(null)} variant="ghost">
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
                          aria-label={labelTextFor("다음 대상")}
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
                              <input aria-label={labelTextFor(`선택지 ${index + 1} 문구`)} onChange={(event) => updateChoice(index, { text: event.target.value })} ref={(element) => setFocusTargets(["choiceText", choice.id ? `choice:${choice.id}:choiceText` : ""], element)} value={choice.text || ""} />
                            </label>
                            <label className={`field-row${focusedClass("choiceTarget", choice.id ? `choice:${choice.id}:choiceTarget` : undefined)}`}>
                              <span>선택지 대상</span>
                              <select aria-label={labelTextFor(`선택지 ${index + 1} 대상`)} onChange={(event) => updateChoice(index, { next: event.target.value })} ref={(element) => setFocusTargets(["choiceTarget", choice.id ? `choice:${choice.id}:choiceTarget` : ""], element)} value={choice.next || ""}>
                                <option value="">없음</option>
                                {scenes.filter((scene) => scene.id !== draftScene.id).map((scene) => <option key={scene.id} value={scene.id}>{sceneTitle(scene)}</option>)}
                              </select>
                            </label>
                            <div className="studio-choice-actions" aria-label={`${choice.text || choice.id || "선택지"} 구조 편집`}>
                              <span>{choiceTargetText(choice, project)}</span>
                              <div className="button-row">
                                <Button data-structural-action="reorderChoice" disabled={saveState === "saving" || dirty || index <= 0 || !choice.id} icon={<ArrowUp size={14} />} iconOnly onClick={() => void moveChoiceViaMutation(choice, index - 1)} title={dirty ? "저장 후 정렬할 수 있습니다." : "위로 이동"} />
                                <Button data-structural-action="reorderChoice" disabled={saveState === "saving" || dirty || index >= (draftScene.choices || []).length - 1 || !choice.id} icon={<ArrowDown size={14} />} iconOnly onClick={() => void moveChoiceViaMutation(choice, index + 1)} title={dirty ? "저장 후 정렬할 수 있습니다." : "아래로 이동"} />
                                <Button data-structural-action="duplicateChoice" disabled={saveState === "saving" || dirty || !choice.id} icon={<Copy size={14} />} iconOnly onClick={() => void duplicateChoiceViaMutation(choice)} title={dirty ? "저장 후 복제할 수 있습니다." : "선택지 복제"} />
                                <Button data-structural-action="clearChoiceTarget" disabled={saveState === "saving" || dirty || !choice.id || !choice.next} icon={<Link2Off size={14} />} iconOnly onClick={() => void clearChoiceTargetViaMutation(choice)} title={dirty ? "저장 후 target을 해제할 수 있습니다." : "target 해제"} />
                                <Button data-structural-action="deleteChoice" disabled={saveState === "saving" || dirty || !choice.id} icon={<Trash2 size={14} />} iconOnly onClick={() => void deleteChoiceViaMutation(choice)} title={dirty ? "저장 후 삭제할 수 있습니다." : "선택지 삭제"} variant="danger" />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {selectedPanel === "stats" ? (
                    <ConditionEffectCandidateReview />
                  ) : null}

                  {selectedPanel === "assets" ? (
                    <section>
                      <h3>에셋</h3>
                      <label className={`field-row${focusedClass("backgroundAssetId", "assets:backgroundAssetId")}`}>
                        <span>배경</span>
                        <select
                          aria-label={labelTextFor("배경")}
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
                        <select aria-label={labelTextFor("CG")} onChange={(event) => patchDraftScene({ cgAssetId: event.target.value || undefined })} ref={(element) => setFocusTargets(["cgAssetId", "generationJobs", "assets:cgAssetId", "assets:generationJobs"], element)} value={draftScene.cgAssetId || ""}>
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
                              <select aria-label={labelTextFor(`캐릭터 ${index + 1}`)} onChange={(event) => updateCharacter(index, { characterId: event.target.value })} ref={(element) => setFocusTargets(["characters", `character:${index}:characters`], element)} value={character.characterId || ""}>
                                <option value="">없음</option>
                                {(project?.characters || []).map((item) => <option key={item.id} value={item.id}>{characterLabel(project, item.id)}</option>)}
                              </select>
                            </label>
                            <label className="field-row">
                              <span>위치</span>
                              <select aria-label={labelTextFor(`캐릭터 ${index + 1} 위치`)} onChange={(event) => updateCharacter(index, { position: event.target.value })} value={character.position || "center"}>
                                <option value="left">왼쪽</option>
                                <option value="center">중앙</option>
                                <option value="right">오른쪽</option>
                              </select>
                            </label>
                            <Button onClick={() => removeCharacterDisplay(index)} variant="ghost">삭제</Button>
                          </li>
                        ))}
                      </ul>
                      <StudioAssetJobLifecycle />
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
                      {renderGenerationAssistDrawer()}
                    </section>
                  ) : null}
                </div>
              ) : selectedPanel === "validation" ? (
                <div className="studio-inspector-body">
                  {renderGenerationAssistDrawer()}
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
