export type VnMakerProjectVersion = "vn-maker/v1";
export type ValidationSeverity = "error" | "warning";
export type AssetKind = "background" | "portrait" | "expression" | "cg" | "audio" | "other";
export type GenerationJobKind = "character" | "route" | "scene" | "dialogue" | "portrait" | "expression" | "cg";

export interface VnMakerProject {
  version: VnMakerProjectVersion;
  id: string;
  title: string;
  premise: string;
  characters: VnMakerCharacter[];
  routes: VnMakerRoute[];
  scenes: VnMakerScene[];
  assets: VnMakerAsset[];
  generationJobs: VnMakerGenerationJob[];
  settings: VnMakerProjectSettings;
}

export interface VnMakerProjectSettings {
  defaultRouteId: string;
  outputFileName: string;
  language: string;
}

export interface VnMakerCharacter {
  id: string;
  displayName: string;
  role: string;
  profile: string;
  emotionTags: string[];
  portraitAssetIds: string[];
}

export interface VnMakerRoute {
  id: string;
  title: string;
  heroineId: string;
  summary: string;
  entrySceneId: string;
  endings: VnMakerEnding[];
}

export interface VnMakerEnding {
  id: string;
  title: string;
  condition: VnMakerCondition;
}

export interface VnMakerScene {
  id: string;
  label: string;
  speaker: string;
  text: string;
  backgroundAssetId?: string;
  cgAssetId?: string;
  characters: VnMakerSceneCharacter[];
  choices: VnMakerChoice[];
  next?: string;
  condition?: VnMakerCondition;
  memoryTags?: Record<string, string[]>;
}

export interface VnMakerSceneCharacter {
  characterId: string;
  expression?: string;
  assetId?: string;
  position?: "left" | "center" | "right";
}

export interface VnMakerChoice {
  id: string;
  text: string;
  next: string;
  condition?: VnMakerCondition;
  effects?: VnMakerChoiceEffects;
}

export interface VnMakerCondition {
  flags?: string[];
  notFlags?: string[];
  minAffinity?: Record<string, number>;
  memoryTags?: Record<string, string[]>;
}

export interface VnMakerChoiceEffects {
  flags?: string[];
  affinity?: Record<string, number>;
  memoryTags?: Record<string, string[]>;
}

export interface VnMakerAsset {
  id: string;
  kind: AssetKind;
  label: string;
  uri?: string;
  source?: "generated" | "imported" | "placeholder";
  generationJobId?: string;
}

export interface VnMakerGenerationJob {
  id: string;
  kind: GenerationJobKind;
  targetId: string;
  prompt: string;
  style?: string;
  provider: "codex-text-adapter" | "image-generation-adapter" | "mock-adapter";
  status: "planned" | "running" | "completed" | "failed";
  outputAssetId?: string;
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  path: string;
  message: string;
}

export interface AssetManifest {
  projectId: string;
  requiredAssets: VnMakerAsset[];
  missingAssetReferences: string[];
  generationJobs: VnMakerGenerationJob[];
}

export interface HtmlBuildArtifact {
  fileName: string;
  html: string;
}

export interface CreateStarterProjectInput {
  id?: string;
  title?: string;
  premise?: string;
}

export interface CreateImageGenerationJobInput {
  id: string;
  kind: Extract<GenerationJobKind, "portrait" | "expression" | "cg">;
  targetId: string;
  prompt: string;
  style?: string;
  outputAssetId?: string;
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function uniqueById<T extends { id: string }>(items: T[], path: string, issues: ValidationIssue[]): Set<string> {
  const ids = new Set<string>();

  items.forEach((item, index) => {
    if (!item.id.trim()) {
      issues.push({ severity: "error", path: `${path}.${index}.id`, message: "id가 비어 있습니다." });
      return;
    }

    if (ids.has(item.id)) {
      issues.push({ severity: "error", path: `${path}.${index}.id`, message: `중복 id입니다: ${item.id}` });
      return;
    }

    ids.add(item.id);
  });

  return ids;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replaceAll("</", "<\\/");
}

export function createStarterProject(input: CreateStarterProjectInput = {}): VnMakerProject {
  const title = input.title || "새 미연시 프로젝트";
  const id = input.id || normalizeId(title);

  return {
    version: "vn-maker/v1",
    id,
    title,
    premise: input.premise || "Codex와 함께 만드는 고등학교 미연시",
    characters: [
      {
        id: "haru",
        displayName: "하루",
        role: "메인 히로인",
        profile: "조용하지만 게임 제작에는 누구보다 진심인 같은 반 학생.",
        emotionTags: ["normal", "happy", "shy", "worried"],
        portraitAssetIds: ["asset-haru-portrait"]
      }
    ],
    routes: [
      {
        id: "haru-route",
        title: "하루 루트",
        heroineId: "haru",
        summary: "방과 후 게임 제작을 통해 가까워지는 달달한 하루 루트.",
        entrySceneId: "scene-opening",
        endings: [
          {
            id: "good-ending",
            title: "문화제의 약속",
            condition: { flags: ["trusted-haru"] }
          }
        ]
      }
    ],
    scenes: [
      {
        id: "scene-opening",
        label: "방과 후 교실",
        speaker: "나",
        text: "텅 빈 교실에서 노트북 팬 소리만 작게 울렸다.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "normal", assetId: "asset-haru-portrait", position: "center" }],
        choices: [
          {
            id: "choice-help",
            text: "하루의 작업을 도와준다.",
            next: "scene-haru-smile",
            effects: { flags: ["trusted-haru"], affinity: { haru: 1 } }
          }
        ]
      },
      {
        id: "scene-haru-smile",
        label: "첫 번째 미소",
        speaker: "하루",
        text: "고마워. 너랑 같이 만들면, 왠지 완성할 수 있을 것 같아.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "happy", assetId: "asset-haru-portrait", position: "center" }],
        choices: []
      }
    ],
    assets: [
      { id: "asset-classroom-bg", kind: "background", label: "방과 후 교실", source: "placeholder" },
      { id: "asset-haru-portrait", kind: "portrait", label: "하루 기본 포트레이트", source: "placeholder" }
    ],
    generationJobs: [
      createImageGenerationJob({
        id: "job-haru-portrait",
        kind: "portrait",
        targetId: "haru",
        prompt: "high school visual novel heroine, clean anime portrait, transparent background",
        style: "soft, polished, romance visual novel",
        outputAssetId: "asset-haru-portrait"
      })
    ],
    settings: {
      defaultRouteId: "haru-route",
      outputFileName: "vn-maker-build.html",
      language: "ko"
    }
  };
}

export function createImageGenerationJob(input: CreateImageGenerationJobInput): VnMakerGenerationJob {
  return {
    id: input.id,
    kind: input.kind,
    targetId: input.targetId,
    prompt: input.prompt,
    style: input.style,
    provider: "image-generation-adapter",
    status: "planned",
    outputAssetId: input.outputAssetId
  };
}

export function validateProject(project: VnMakerProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (project.version !== "vn-maker/v1") {
    issues.push({ severity: "error", path: "version", message: "지원하지 않는 프로젝트 버전입니다." });
  }

  if (!project.title.trim()) {
    issues.push({ severity: "error", path: "title", message: "프로젝트 제목이 비어 있습니다." });
  }

  const characterIds = uniqueById(project.characters, "characters", issues);
  const routeIds = uniqueById(project.routes, "routes", issues);
  const sceneIds = uniqueById(project.scenes, "scenes", issues);
  const assetIds = uniqueById(project.assets, "assets", issues);
  uniqueById(project.generationJobs, "generationJobs", issues);

  if (!routeIds.has(project.settings.defaultRouteId)) {
    issues.push({ severity: "warning", path: "settings.defaultRouteId", message: "기본 루트가 routes에 없습니다." });
  }

  project.characters.forEach((character, characterIndex) => {
    character.portraitAssetIds.forEach((assetId, assetIndex) => {
      if (!assetIds.has(assetId)) {
        issues.push({ severity: "warning", path: `characters.${characterIndex}.portraitAssetIds.${assetIndex}`, message: `등록되지 않은 에셋입니다: ${assetId}` });
      }
    });
  });

  project.routes.forEach((route, routeIndex) => {
    if (!characterIds.has(route.heroineId)) {
      issues.push({ severity: "error", path: `routes.${routeIndex}.heroineId`, message: `등록되지 않은 캐릭터입니다: ${route.heroineId}` });
    }
    if (!sceneIds.has(route.entrySceneId)) {
      issues.push({ severity: "error", path: `routes.${routeIndex}.entrySceneId`, message: `등록되지 않은 시작 장면입니다: ${route.entrySceneId}` });
    }
  });

  project.scenes.forEach((scene, sceneIndex) => {
    [scene.backgroundAssetId, scene.cgAssetId].filter(Boolean).forEach((assetId) => {
      if (!assetIds.has(assetId!)) {
        issues.push({ severity: "warning", path: `scenes.${sceneIndex}.assets`, message: `등록되지 않은 에셋입니다: ${assetId}` });
      }
    });

    if (scene.next && !sceneIds.has(scene.next)) {
      issues.push({ severity: "error", path: `scenes.${sceneIndex}.next`, message: `등록되지 않은 다음 장면입니다: ${scene.next}` });
    }

    scene.characters.forEach((character, characterIndex) => {
      if (!characterIds.has(character.characterId)) {
        issues.push({ severity: "error", path: `scenes.${sceneIndex}.characters.${characterIndex}.characterId`, message: `등록되지 않은 캐릭터입니다: ${character.characterId}` });
      }
      if (character.assetId && !assetIds.has(character.assetId)) {
        issues.push({ severity: "warning", path: `scenes.${sceneIndex}.characters.${characterIndex}.assetId`, message: `등록되지 않은 캐릭터 에셋입니다: ${character.assetId}` });
      }
    });

    scene.choices.forEach((choice, choiceIndex) => {
      if (!sceneIds.has(choice.next)) {
        issues.push({ severity: "error", path: `scenes.${sceneIndex}.choices.${choiceIndex}.next`, message: `등록되지 않은 선택지 이동 장면입니다: ${choice.next}` });
      }
    });
  });

  return issues;
}

export function createAssetManifest(project: VnMakerProject): AssetManifest {
  const requiredIds = new Set<string>();
  const missingAssetReferences: string[] = [];
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));

  project.characters.forEach((character) => character.portraitAssetIds.forEach((assetId) => requiredIds.add(assetId)));
  project.scenes.forEach((scene) => {
    [scene.backgroundAssetId, scene.cgAssetId].filter(Boolean).forEach((assetId) => requiredIds.add(assetId!));
    scene.characters.forEach((character) => character.assetId && requiredIds.add(character.assetId));
  });

  const requiredAssets = [...requiredIds].flatMap((assetId) => {
    const asset = assetMap.get(assetId);
    if (!asset) {
      missingAssetReferences.push(assetId);
      return [];
    }
    return [asset];
  });

  return {
    projectId: project.id,
    requiredAssets,
    missingAssetReferences,
    generationJobs: project.generationJobs
  };
}

export function buildProjectHtml(project: VnMakerProject): HtmlBuildArtifact {
  const manifest = createAssetManifest(project);

  return {
    fileName: project.settings.outputFileName,
    html: `<!doctype html>
<html lang="${escapeHtml(project.settings.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(project.title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #111827; color: #f8fafc; }
    main { max-width: 880px; margin: 0 auto; padding: 32px 18px; }
    section { border: 1px solid #334155; border-radius: 8px; padding: 16px; background: #0f172a; }
    code, pre { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(project.title)}</h1>
    <p>${escapeHtml(project.premise)}</p>
    <section>
      <h2>Build Manifest</h2>
      <p>Scenes: ${project.scenes.length} / Characters: ${project.characters.length} / Assets: ${manifest.requiredAssets.length}</p>
      <pre>${escapeHtml(JSON.stringify(manifest, null, 2))}</pre>
    </section>
  </main>
  <script type="application/json" id="vn-maker-project">${escapeJsonForHtml(project)}</script>
</body>
</html>`
  };
}
