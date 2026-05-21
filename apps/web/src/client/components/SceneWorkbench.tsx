import { AlertTriangle, CheckCircle2, GitBranch, ListChecks, Plus, Save, Split, StopCircle, XCircle } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { analyzeRouteGraph } from "@vn-maker/engine-core";
import { Button } from "./ui";

export type SceneEndingKind = "good" | "normal" | "bad";

export interface SceneEnding {
  id: string;
  title: string;
  kind: SceneEndingKind;
}

export interface RuntimeAsset {
  id: string;
  kind: string;
  label: string;
  uri?: string;
}

export interface ProjectCharacter {
  id: string;
  displayName: string;
  emotionTags?: string[];
  expressionAssetIds?: Record<string, string>;
  sourceHeroineId?: string;
  sourceHeroineName?: string;
  sourceSnapshotCreatedAt?: string;
}

export interface RouteData {
  id: string;
  title: string;
  heroineId: string;
  entrySceneId: string;
}

export interface SceneDraft {
  id: string;
  label: string;
  speaker: string;
  text: string;
  characters: Array<{ characterId: string; expression?: string; assetId?: string; position?: "left" | "center" | "right" }>;
  choices: Array<{ id: string; text: string; next: string }>;
  next?: string;
  ending?: SceneEnding;
  backgroundAssetId?: string;
  cgAssetId?: string;
}

export interface ProjectData {
  id: string;
  title: string;
  premise: string;
  characters: ProjectCharacter[];
  routes: RouteData[];
  scenes: SceneDraft[];
  assets: RuntimeAsset[];
  generationJobs: unknown[];
}

export interface PendingPatchSummary {
  plan?: {
    summary?: string;
    decision?: {
      sceneCount?: number;
      choiceCount?: number;
      cgCount?: number;
    };
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

export interface SceneOption {
  value: string;
  label: string;
  description: string;
  ending?: SceneEnding;
}

export interface RouteRow {
  sceneId: string;
  label: string;
  depth: number;
  parentSceneId?: string;
  edgeType: "entry" | "next" | "choice";
  viaChoiceId?: string;
  viaChoiceText?: string;
  ending?: SceneEnding;
}

export interface RouteCompletionSummary {
  endingCount: number;
  openBranchCount: number;
  reachableEndingIds: string[];
  uncoveredTerminalSceneIds: string[];
  missingTargets: Array<{ sourceSceneId: string; targetSceneId: string; edgeType: string; choiceId?: string }>;
  cyclesWithoutEndingPath: string[][];
  routeRows: RouteRow[];
  issues: Array<{ severity: string; message: string; sceneIds?: string[]; choiceIds?: string[]; targetSceneId?: string }>;
}

type ManualLink = { type: "none" | "next" | "choice"; preservePreviousNext?: boolean; choiceId?: string; choiceText?: string };

interface SceneWorkbenchProps {
  currentHeroine: ProjectCharacter | null;
  currentRoute: RouteData | null;
  currentSceneId: string;
  onApproveEvent: () => void;
  onCancelPatch: () => void;
  onExpandEvent: () => void;
  onInsertScene: (input: { sourceSceneId?: string; link: ManualLink; scene: SceneDraft }) => void;
  onLinkScene: (input: { sourceSceneId: string; targetSceneId: string; link: ManualLink }) => void;
  onPromptChange: (value: string) => void;
  onSaveScene: () => void;
  onSelectRoute: (routeId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onSceneDraftChange: (scene: SceneDraft) => void;
  onSetSceneEnding: (input: { sceneId: string; ending: Partial<SceneEnding> | null; clearOutgoing?: boolean }) => void;
  patchCanApply: boolean;
  pendingPatch: PendingPatchSummary | null;
  previewStale: boolean;
  project: ProjectData | null;
  prompt: string;
  sceneDraft: SceneDraft | null;
}

function slugId(value: string, fallback: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function uniqueSceneId(project: ProjectData, seed: string): string {
  const used = new Set(project.scenes.map((scene) => scene.id));
  const base = slugId(seed, "scene-new").startsWith("scene-")
    ? slugId(seed, "scene-new")
    : `scene-${slugId(seed, "new")}`;
  if (!used.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `${base}-${Date.now()}`;
}

function cloneScene(scene: SceneDraft): SceneDraft {
  return JSON.parse(JSON.stringify(scene)) as SceneDraft;
}

function analyzerProject(project: ProjectData, routeId?: string) {
  const selectedRouteId = routeId || project.routes[0]?.id || "";
  return {
    version: "vn-maker/v1",
    id: project.id,
    title: project.title,
    premise: project.premise,
    characters: project.characters.map((character) => ({
      id: character.id,
      displayName: character.displayName,
      role: "히로인",
      profile: character.displayName,
      emotionTags: character.emotionTags || ["normal"],
      portraitAssetIds: []
    })),
    routes: project.routes.map((route) => ({
      id: route.id,
      title: route.title,
      heroineId: route.heroineId,
      summary: "",
      entrySceneId: route.entrySceneId,
      endings: []
    })),
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      label: scene.label,
      speaker: scene.speaker,
      text: scene.text,
      characters: scene.characters || [],
      choices: scene.choices || [],
      next: scene.next,
      ending: scene.ending,
      backgroundAssetId: scene.backgroundAssetId,
      cgAssetId: scene.cgAssetId
    })),
    assets: project.assets,
    generationJobs: [],
    settings: {
      defaultRouteId: selectedRouteId,
      outputFileName: "index.html",
      language: "ko"
    }
  } as Parameters<typeof analyzeRouteGraph>[0];
}

export function selectSceneOptions(project: ProjectData): SceneOption[] {
  return project.scenes.map((scene) => ({
    value: scene.id,
    label: scene.label || scene.id,
    description: `${scene.id}${scene.ending ? ` · 엔딩 ${scene.ending.kind}` : ""}`,
    ending: scene.ending
  }));
}

export function createBlankSceneDraft(project: ProjectData, sourceSceneId?: string): SceneDraft {
  const sourceScene = project.scenes.find((scene) => scene.id === sourceSceneId) || project.scenes[0];
  const sourceCharacter = sourceScene?.characters[0];
  const characterId = sourceCharacter?.characterId || project.routes[0]?.heroineId || project.characters[0]?.id || "";
  return {
    id: uniqueSceneId(project, `${sourceSceneId || "scene"}-next`),
    label: "새 장면",
    speaker: sourceScene?.speaker || project.characters.find((character) => character.id === characterId)?.displayName || "",
    text: "",
    characters: characterId ? [{ characterId, expression: sourceCharacter?.expression || "normal", assetId: sourceCharacter?.assetId, position: "center" }] : [],
    choices: []
  };
}

export function createRouteCompletionSummary(project: ProjectData, routeId?: string): RouteCompletionSummary {
  const route = project.routes.find((item) => item.id === routeId) || project.routes[0];
  const graph = analyzeRouteGraph(analyzerProject(project, route?.id), route?.id);
  const sceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const routeRows: RouteRow[] = [];
  const visited = new Set<string>();
  const queue: Array<{ sceneId: string; depth: number; parentSceneId?: string; edgeType: RouteRow["edgeType"]; viaChoiceId?: string; viaChoiceText?: string }> = route?.entrySceneId
    ? [{ sceneId: route.entrySceneId, depth: 0, edgeType: "entry" }]
    : [];

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.sceneId)) {
      continue;
    }
    const scene = sceneMap.get(item.sceneId);
    if (!scene) {
      continue;
    }
    visited.add(item.sceneId);
    routeRows.push({
      sceneId: scene.id,
      label: scene.label,
      depth: item.depth,
      parentSceneId: item.parentSceneId,
      edgeType: item.edgeType,
      viaChoiceId: item.viaChoiceId,
      viaChoiceText: item.viaChoiceText,
      ending: scene.ending
    });
    if (scene.ending) {
      continue;
    }
    if (scene.choices.length > 0) {
      scene.choices.forEach((choice) => queue.push({
        sceneId: choice.next,
        depth: item.depth + 1,
        parentSceneId: scene.id,
        edgeType: "choice",
        viaChoiceId: choice.id,
        viaChoiceText: choice.text
      }));
    } else if (scene.next) {
      queue.push({ sceneId: scene.next, depth: item.depth + 1, parentSceneId: scene.id, edgeType: "next" });
    }
  }

  return {
    endingCount: graph.reachableEndingIds.length,
    openBranchCount: graph.uncoveredTerminalSceneIds.length,
    reachableEndingIds: graph.reachableEndingIds,
    uncoveredTerminalSceneIds: graph.uncoveredTerminalSceneIds,
    missingTargets: graph.missingTargets,
    cyclesWithoutEndingPath: graph.cyclesWithoutEndingPath,
    routeRows,
    issues: graph.issues
  };
}

function updateSceneField(scene: SceneDraft, field: keyof SceneDraft, value: string): SceneDraft {
  return { ...scene, [field]: value };
}

function updateChoice(scene: SceneDraft, index: number, field: "text" | "next", value: string): SceneDraft {
  return {
    ...scene,
    choices: scene.choices.map((choice, choiceIndex) => choiceIndex === index ? { ...choice, [field]: value } : choice)
  };
}

export function SceneWorkbench({
  currentHeroine,
  currentRoute,
  currentSceneId,
  onApproveEvent,
  onCancelPatch,
  onExpandEvent,
  onInsertScene,
  onLinkScene,
  onPromptChange,
  onSaveScene,
  onSelectRoute,
  onSelectScene,
  onSceneDraftChange,
  onSetSceneEnding,
  patchCanApply,
  pendingPatch,
  previewStale,
  project,
  prompt,
  sceneDraft
}: SceneWorkbenchProps) {
  const [newSceneLabel, setNewSceneLabel] = useState("새 장면");
  const [newSceneText, setNewSceneText] = useState("");
  const [choiceText, setChoiceText] = useState("새 선택지");
  const [branchTarget, setBranchTarget] = useState("__new__");
  const [branchSceneLabel, setBranchSceneLabel] = useState("새 분기 장면");
  const [branchSceneText, setBranchSceneText] = useState("");
  const [endingTitle, setEndingTitle] = useState("새 엔딩");
  const [endingKind, setEndingKind] = useState<SceneEndingKind>("normal");
  const [clearOutgoing, setClearOutgoing] = useState(false);

  const sceneOptions = useMemo(() => project ? selectSceneOptions(project) : [], [project]);
  const routeSummary = useMemo(() => project ? createRouteCompletionSummary(project, currentRoute?.id) : null, [project, currentRoute?.id]);
  const selectedScene = project?.scenes.find((scene) => scene.id === (sceneDraft?.id || currentSceneId)) || sceneDraft || null;
  const isEndingScene = Boolean(sceneDraft?.ending);
  const hasOutgoing = Boolean(sceneDraft?.next || (sceneDraft?.choices.length || 0) > 0);
  const canSetEnding = Boolean(sceneDraft && (!hasOutgoing || clearOutgoing));

  function manualSceneFromForm(label: string, text: string, sourceSceneId?: string): SceneDraft {
    const draft = createBlankSceneDraft(project!, sourceSceneId);
    return {
      ...draft,
      id: uniqueSceneId(project!, label || draft.id),
      label: label || draft.label,
      text
    };
  }

  function addSceneAfterCurrent(): void {
    if (!project || !sceneDraft) return;
    onInsertScene({
      sourceSceneId: sceneDraft.id,
      link: { type: "next", preservePreviousNext: true },
      scene: manualSceneFromForm(newSceneLabel, newSceneText, sceneDraft.id)
    });
  }

  function addChoiceBranch(): void {
    if (!project || !sceneDraft || !choiceText.trim()) return;
    if (branchTarget === "__new__") {
      onInsertScene({
        sourceSceneId: sceneDraft.id,
        link: { type: "choice", choiceText: choiceText.trim() },
        scene: manualSceneFromForm(branchSceneLabel, branchSceneText, sceneDraft.id)
      });
      return;
    }
    onLinkScene({
      sourceSceneId: sceneDraft.id,
      targetSceneId: branchTarget,
      link: { type: "choice", choiceText: choiceText.trim() }
    });
  }

  function setCurrentAsEnding(): void {
    if (!sceneDraft || !canSetEnding) return;
    onSetSceneEnding({
      sceneId: sceneDraft.id,
      ending: { title: endingTitle, kind: endingKind },
      clearOutgoing
    });
    setClearOutgoing(false);
  }

  function setOpenBranchAsEnding(sceneId: string): void {
    const scene = project?.scenes.find((item) => item.id === sceneId);
    onSetSceneEnding({
      sceneId,
      ending: { title: `${scene?.label || sceneId} 엔딩`, kind: "normal" },
      clearOutgoing: false
    });
  }

  function addSceneAfterOpenBranch(sceneId: string): void {
    if (!project) return;
    onInsertScene({
      sourceSceneId: sceneId,
      link: { type: "next" },
      scene: manualSceneFromForm(`${sceneId} 다음`, "", sceneId)
    });
  }

  return (
    <section className="workbench-section scene-workbench">
      <header className="section-header">
        <div>
          <p className="panel-eyebrow">Route / Scene</p>
          <h2>씬 편집과 수동 분기 제작</h2>
        </div>
        <div className="button-row">
          <Button icon={<Save size={16} />} onClick={onSaveScene}>씬 저장</Button>
          <Button icon={<Plus size={16} />} onClick={addSceneAfterCurrent} variant="primary">현재 뒤에 장면 추가</Button>
          <Button icon={<ListChecks size={16} />} onClick={onExpandEvent}>패치 제안</Button>
          <Button disabled={!patchCanApply} icon={<CheckCircle2 size={16} />} onClick={onApproveEvent}>승인</Button>
          <Button disabled={!pendingPatch} icon={<XCircle size={16} />} onClick={onCancelPatch}>취소</Button>
        </div>
      </header>

      {previewStale ? <div className="inline-status warning">변경 후 프리뷰가 갱신되지 않았습니다. 다시 프리뷰를 실행하세요.</div> : null}
      {pendingPatch ? <div className="inline-status warning">수동 변경 전에 pending natural-language patch를 승인하거나 취소하세요. 수동 변경을 실행하면 패치 제안을 폐기합니다.</div> : null}

      {project?.routes.length ? (
        <div className="route-panel">
          <div className="route-selector">
            <select aria-label="루트 선택" value={currentRoute?.id || ""} onChange={(event) => onSelectRoute(event.target.value)}>
              {project.routes.map((route) => (
                <option key={route.id} value={route.id}>{route.title}</option>
              ))}
            </select>
            <div className="inline-status">
              {currentRoute?.id || "루트 없음"} · {currentHeroine?.displayName || currentRoute?.heroineId || "히로인 없음"} · 시작 {currentRoute?.entrySceneId || "없음"}
            </div>
          </div>
        </div>
      ) : <div className="inline-status">루트가 없습니다.</div>}

      {routeSummary ? (
        <div className="route-health">
          <div className="coverage-meter">
            <strong>{routeSummary.endingCount}개 엔딩 / 열린 분기 {routeSummary.openBranchCount}개</strong>
            <span>도달 가능 씬 {routeSummary.routeRows.length}개 · 깨진 target {routeSummary.missingTargets.length}개 · cycle {routeSummary.cyclesWithoutEndingPath.length}개</span>
          </div>
          <div className="route-tree" aria-label="루트 트리">
            {routeSummary.routeRows.map((row) => (
              <button
                className={selectedScene?.id === row.sceneId ? "route-tree-item selected" : "route-tree-item"}
                key={`${row.sceneId}-${row.edgeType}-${row.viaChoiceId || "entry"}`}
                onClick={() => onSelectScene(row.sceneId)}
                style={{ "--depth": row.depth } as CSSProperties}
                type="button"
              >
                <span>{row.edgeType === "choice" ? row.viaChoiceText : row.edgeType === "next" ? "다음" : "시작"}</span>
                <strong>{row.label}</strong>
                <small>{row.sceneId}{row.ending ? ` · 엔딩 ${row.ending.title}` : ""}</small>
              </button>
            ))}
          </div>
          <div className="route-issue-grid">
            <IssueList
              actionLabel="이 장면을 엔딩으로 지정"
              icon={<StopCircle size={16} />}
              items={routeSummary.uncoveredTerminalSceneIds}
              onAction={setOpenBranchAsEnding}
              onSelect={onSelectScene}
              secondaryActionLabel="이 branch에 다음 장면 추가"
              onSecondaryAction={addSceneAfterOpenBranch}
              title="Open branches"
            />
            <IssueList
              icon={<AlertTriangle size={16} />}
              items={routeSummary.missingTargets.map((target) => `${target.sourceSceneId} -> ${target.targetSceneId}`)}
              onSelect={(item) => onSelectScene(item.split(" -> ")[0])}
              title="Missing targets"
            />
            <IssueList
              icon={<GitBranch size={16} />}
              items={routeSummary.cyclesWithoutEndingPath.map((cycle) => cycle.join(" -> "))}
              onSelect={(item) => onSelectScene(item.split(" -> ")[0])}
              title="Cycles"
            />
          </div>
          {routeSummary.issues.filter((issue) => issue.severity === "error").length > 0 ? (
            <div className="route-validation-list">
              {routeSummary.issues.filter((issue) => issue.severity === "error").map((issue) => (
                <button
                  key={`${issue.message}-${issue.sceneIds?.join("-") || issue.targetSceneId || "route"}`}
                  onClick={() => issue.sceneIds?.[0] ? onSelectScene(issue.sceneIds[0]) : undefined}
                  type="button"
                >
                  {issue.message}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="scene-layout">
        <div className="scene-list">
          {(project?.scenes || []).map((item) => (
            <button
              className={sceneDraft?.id === item.id ? "list-item selected" : "list-item"}
              key={item.id}
              onClick={() => onSelectScene(item.id)}
              type="button"
            >
              <strong>{item.label}</strong>
              <span>{item.id}{item.ending ? ` · ${item.ending.kind}` : ""}</span>
            </button>
          ))}
        </div>

        {sceneDraft ? (
          <div className="scene-editor">
            {isEndingScene ? <div className="inline-status warning">엔딩 장면에는 다음 장면이나 선택지가 있을 수 없습니다.</div> : null}
            <div className="form-grid">
              <input aria-label="씬 ID" value={sceneDraft.id} onChange={(event) => onSceneDraftChange(updateSceneField(sceneDraft, "id", event.target.value))} />
              <input aria-label="씬 라벨" value={sceneDraft.label} onChange={(event) => onSceneDraftChange(updateSceneField(sceneDraft, "label", event.target.value))} />
              <input aria-label="화자" value={sceneDraft.speaker} onChange={(event) => onSceneDraftChange(updateSceneField(sceneDraft, "speaker", event.target.value))} />
              <select
                aria-label="다음 씬"
                disabled={isEndingScene || sceneDraft.choices.length > 0}
                onChange={(event) => onSceneDraftChange({ ...sceneDraft, next: event.target.value || undefined })}
                value={sceneDraft.next || ""}
              >
                <option value="">다음 없음</option>
                {sceneOptions.filter((option) => option.value !== sceneDraft.id).map((option) => (
                  <option key={option.value} value={option.value}>{option.label} ({option.value})</option>
                ))}
              </select>
            </div>
            <textarea aria-label="씬 본문" value={sceneDraft.text} onChange={(event) => onSceneDraftChange(updateSceneField(sceneDraft, "text", event.target.value))} />
            <select
              aria-label="표정 태그"
              onChange={(event) => {
                const characterId = sceneDraft.characters[0]?.characterId || currentHeroine?.id || "";
                onSceneDraftChange({
                  ...sceneDraft,
                  characters: characterId ? [{ characterId, expression: event.target.value, position: "center" }] : []
                });
              }}
              value={sceneDraft.characters[0]?.expression || "normal"}
            >
              {(currentHeroine?.emotionTags || ["normal"]).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <div className="choice-editor">
              {sceneDraft.choices.map((choice, index) => (
                <div className="choice-row" key={choice.id}>
                  <input
                    aria-label="선택지 문구"
                    disabled={isEndingScene}
                    value={choice.text}
                    onChange={(event) => onSceneDraftChange(updateChoice(sceneDraft, index, "text", event.target.value))}
                  />
                  <select
                    aria-label="선택지 이동 씬"
                    disabled={isEndingScene}
                    value={choice.next}
                    onChange={(event) => onSceneDraftChange(updateChoice(sceneDraft, index, "next", event.target.value))}
                  >
                    {sceneOptions.filter((option) => option.value !== sceneDraft.id).map((option) => (
                      <option key={option.value} value={option.value}>{option.label} ({option.value})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="manual-action-grid">
              <div className="manual-action">
                <strong>현재 뒤에 장면 추가</strong>
                <input aria-label="새 장면 라벨" value={newSceneLabel} onChange={(event) => setNewSceneLabel(event.target.value)} />
                <textarea aria-label="새 장면 본문" value={newSceneText} onChange={(event) => setNewSceneText(event.target.value)} />
                <Button disabled={isEndingScene} icon={<Plus size={16} />} onClick={addSceneAfterCurrent}>추가</Button>
              </div>
              <div className="manual-action">
                <strong>선택지 분기 추가</strong>
                <input aria-label="선택지 문구" value={choiceText} onChange={(event) => setChoiceText(event.target.value)} />
                <select aria-label="분기 target" value={branchTarget} onChange={(event) => setBranchTarget(event.target.value)}>
                  <option value="__new__">새 장면 만들기</option>
                  {sceneOptions.filter((option) => option.value !== sceneDraft.id).map((option) => (
                    <option key={option.value} value={option.value}>{option.label} ({option.value})</option>
                  ))}
                </select>
                {branchTarget === "__new__" ? (
                  <>
                    <input aria-label="분기 새 장면 라벨" value={branchSceneLabel} onChange={(event) => setBranchSceneLabel(event.target.value)} />
                    <textarea aria-label="분기 새 장면 본문" value={branchSceneText} onChange={(event) => setBranchSceneText(event.target.value)} />
                  </>
                ) : null}
                <Button disabled={isEndingScene || !choiceText.trim()} icon={<Split size={16} />} onClick={addChoiceBranch}>분기 추가</Button>
              </div>
              <div className="manual-action">
                <strong>엔딩 지정</strong>
                <input aria-label="엔딩 제목" value={endingTitle} onChange={(event) => setEndingTitle(event.target.value)} />
                <select aria-label="엔딩 종류" value={endingKind} onChange={(event) => setEndingKind(event.target.value as SceneEndingKind)}>
                  <option value="good">good</option>
                  <option value="normal">normal</option>
                  <option value="bad">bad</option>
                </select>
                {hasOutgoing ? (
                  <label className="checkbox-row">
                    <input checked={clearOutgoing} onChange={(event) => setClearOutgoing(event.target.checked)} type="checkbox" />
                    <span>다음/선택지를 제거하고 엔딩으로 만들기</span>
                  </label>
                ) : null}
                <div className="button-row compact">
                  <Button disabled={!canSetEnding} icon={<StopCircle size={16} />} onClick={setCurrentAsEnding}>엔딩으로 지정</Button>
                  {sceneDraft.ending ? <Button icon={<XCircle size={16} />} onClick={() => onSetSceneEnding({ sceneId: sceneDraft.id, ending: null })}>엔딩 해제</Button> : null}
                </div>
              </div>
            </div>
          </div>
        ) : <div className="inline-status">편집할 씬을 선택하세요.</div>}
      </div>

      <textarea aria-label="자연어 이벤트" value={prompt} onChange={(event) => onPromptChange(event.target.value)} wrap="soft" />
      {pendingPatch ? (
        <div className="patch-summary">
          <strong>{pendingPatch.plan?.summary}</strong>
          <span>씬 {pendingPatch.plan?.decision?.sceneCount || 0} / 선택지 {pendingPatch.plan?.decision?.choiceCount || 0} / CG {pendingPatch.plan?.decision?.cgCount || 0}</span>
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
  );
}

function IssueList({
  actionLabel,
  icon,
  items,
  onAction,
  onSecondaryAction,
  onSelect,
  secondaryActionLabel,
  title
}: {
  actionLabel?: string;
  icon: ReactNode;
  items: string[];
  onAction?: (item: string) => void;
  onSecondaryAction?: (item: string) => void;
  onSelect: (item: string) => void;
  secondaryActionLabel?: string;
  title: string;
}) {
  return (
    <div className="route-issue-list">
      <strong>{icon}{title}</strong>
      {items.length === 0 ? <span>없음</span> : items.map((item) => (
        <div className="route-issue-item" key={item}>
          <button onClick={() => onSelect(item)} type="button">{item}</button>
          {actionLabel && onAction ? <Button onClick={() => onAction(item)}>{actionLabel}</Button> : null}
          {secondaryActionLabel && onSecondaryAction ? <Button onClick={() => onSecondaryAction(item)}>{secondaryActionLabel}</Button> : null}
        </div>
      ))}
    </div>
  );
}
