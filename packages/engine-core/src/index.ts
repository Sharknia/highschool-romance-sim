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

export interface HeroineProfile {
  id: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
  portraitAssetIds: string[];
}

export interface CreateHeroineProfileInput {
  id?: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
  portraitAssetIds?: string[];
}

export interface VnMakerCharacter {
  id: string;
  displayName: string;
  role: string;
  profile: string;
  emotionTags: string[];
  portraitAssetIds: string[];
  description?: string;
  personality?: string;
  speechStyle?: string;
  appearance?: string;
  defaultPortraitAssetId?: string;
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

export interface CreateProjectFromHeroineInput {
  id?: string;
  title?: string;
  premise?: string;
  heroine: HeroineProfile;
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

export interface EventExpansionRequest {
  projectDirectory: string;
  baseProjectHash: string;
  routeId: string;
  afterSceneId: string;
  heroineId: string;
  userEvent: string;
  heroineContext: {
    name: string;
    description: string;
    personality: string;
    speechStyle: string;
    appearance: string;
  };
  constraints: {
    maxScenes: number;
    maxChoices: number;
    maxCgCount: number;
    allowNewExpressionAssets: false;
    language: "ko";
    contentRating: "all" | "teen";
  };
}

export interface CreateEventExpansionRequestOptions {
  projectDirectory: string;
  routeId: string;
  afterSceneId: string;
  heroineId: string;
  userEvent: string;
  constraints?: Partial<EventExpansionRequest["constraints"]>;
}

export interface EventExpansionPlan {
  summary: string;
  decision: {
    sceneCount: number;
    choiceCount: number;
    cgCount: number;
    newExpressionAssetCount: 0 | number;
    tone?: string;
  };
  patch: VnMakerProjectPatch;
}

export type VnMakerProjectPatchOperation =
  | { type: "addScene"; scene: VnMakerScene }
  | { type: "updateScene"; scene: VnMakerScene }
  | { type: "updateSceneLink"; sceneId: string; nextSceneId?: string }
  | { type: "addChoice"; sceneId: string; choice: VnMakerChoice }
  | { type: "addAsset"; asset: VnMakerAsset }
  | { type: "addGenerationJob"; job: VnMakerGenerationJob };

export interface VnMakerProjectPatch {
  operations: VnMakerProjectPatchOperation[];
}

export interface ProjectPatchDescription {
  text: string;
  sceneCount: number;
  choiceCount: number;
  assetCount: number;
  generationJobCount: number;
  operations: string[];
}

export interface EventExpansionValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  appliedProject?: VnMakerProject;
  diff: ProjectPatchDescription;
}

export interface PlayerRuntimeData {
  projectId: string;
  title: string;
  premise: string;
  routeId: string;
  startSceneId: string;
  scenes: PlayerRuntimeScene[];
  assets: VnMakerAsset[];
  validation: {
    ok: boolean;
    issues: ValidationIssue[];
  };
}

export interface PlayerRuntimeScene {
  id: string;
  label: string;
  speaker: string;
  text: string;
  characters: Array<VnMakerSceneCharacter & { asset?: VnMakerAsset }>;
  choices: VnMakerChoice[];
  next?: string;
  backgroundAsset?: VnMakerAsset;
  cgAsset?: VnMakerAsset;
}

export interface PlayerRuntimeOptions {
  startSceneId?: string;
  assetPathRewrites?: Record<string, string>;
}

export interface BuildProjectHtmlOptions extends PlayerRuntimeOptions {
  projectDataPath?: string;
  runtimeScriptPath?: string;
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function cloneProject(project: VnMakerProject): VnMakerProject {
  return JSON.parse(JSON.stringify(project)) as VnMakerProject;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashProjectSnapshot(project: VnMakerProject): string {
  return hashString(JSON.stringify(project));
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

export function createHeroineProfile(input: CreateHeroineProfileInput): HeroineProfile {
  const id = normalizeId(input.id || input.name);
  const defaultPortraitAssetId = input.defaultPortraitAssetId || `asset-${id}-portrait`;
  const portraitAssetIds = uniqueStrings([
    defaultPortraitAssetId,
    ...(input.portraitAssetIds || [])
  ]);

  return {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    personality: input.personality.trim(),
    speechStyle: input.speechStyle.trim(),
    appearance: input.appearance.trim(),
    defaultPortraitAssetId,
    portraitAssetIds
  };
}

function heroineToCharacter(heroine: HeroineProfile): VnMakerCharacter {
  return {
    id: heroine.id,
    displayName: heroine.name,
    role: "메인 히로인",
    profile: heroine.description,
    emotionTags: ["normal"],
    portraitAssetIds: heroine.portraitAssetIds,
    description: heroine.description,
    personality: heroine.personality,
    speechStyle: heroine.speechStyle,
    appearance: heroine.appearance,
    defaultPortraitAssetId: heroine.defaultPortraitAssetId
  };
}

function characterToHeroineContext(character: VnMakerCharacter): EventExpansionRequest["heroineContext"] {
  return {
    name: character.displayName,
    description: character.description || character.profile,
    personality: character.personality || "차분한 성격",
    speechStyle: character.speechStyle || "조심스러운 말투",
    appearance: character.appearance || "교복 차림의 비주얼 노벨 히로인"
  };
}

export function createProjectFromHeroine(input: CreateProjectFromHeroineInput): VnMakerProject {
  const title = input.title || `${input.heroine.name} 프로젝트`;
  const id = input.id || normalizeId(title);
  const routeId = `${input.heroine.id}-route`;
  const openingSceneId = `scene-${input.heroine.id}-opening`;
  const portraitAssetId = input.heroine.defaultPortraitAssetId || input.heroine.portraitAssetIds[0] || `asset-${input.heroine.id}-portrait`;

  return {
    version: "vn-maker/v1",
    id,
    title,
    premise: input.premise || `${input.heroine.name}의 단일 루트를 제작하는 Alpha 프로젝트`,
    characters: [heroineToCharacter(input.heroine)],
    routes: [
      {
        id: routeId,
        title: `${input.heroine.name} 루트`,
        heroineId: input.heroine.id,
        summary: `${input.heroine.name}와 가까워지는 단일 Alpha 루트.`,
        entrySceneId: openingSceneId,
        endings: []
      }
    ],
    scenes: [
      {
        id: openingSceneId,
        label: `${input.heroine.name} 루트 시작`,
        speaker: "나",
        text: `${input.heroine.name}와의 이야기가 시작되려 한다.`,
        characters: [{ characterId: input.heroine.id, expression: "normal", assetId: portraitAssetId, position: "center" }],
        choices: []
      }
    ],
    assets: [
      {
        id: portraitAssetId,
        kind: "portrait",
        label: `${input.heroine.name} 기본 포트레이트`,
        source: "placeholder"
      }
    ],
    generationJobs: [
      createImageGenerationJob({
        id: `job-${input.heroine.id}-portrait`,
        kind: "portrait",
        targetId: input.heroine.id,
        prompt: `${input.heroine.name}, ${input.heroine.appearance}, clean visual novel heroine portrait`,
        style: "soft, polished, romance visual novel",
        outputAssetId: portraitAssetId
      })
    ],
    settings: {
      defaultRouteId: routeId,
      outputFileName: "index.html",
      language: "ko"
    }
  };
}

export function createEventExpansionRequest(
  project: VnMakerProject,
  options: CreateEventExpansionRequestOptions
): EventExpansionRequest {
  const heroine = project.characters.find((character) => character.id === options.heroineId);
  if (!heroine) {
    throw new Error(`프로젝트에 히로인 스냅샷이 없습니다: ${options.heroineId}`);
  }

  return {
    projectDirectory: options.projectDirectory,
    baseProjectHash: hashProjectSnapshot(project),
    routeId: options.routeId,
    afterSceneId: options.afterSceneId,
    heroineId: options.heroineId,
    userEvent: options.userEvent,
    heroineContext: characterToHeroineContext(heroine),
    constraints: {
      maxScenes: options.constraints?.maxScenes ?? 3,
      maxChoices: options.constraints?.maxChoices ?? 1,
      maxCgCount: options.constraints?.maxCgCount ?? 1,
      allowNewExpressionAssets: false,
      language: "ko",
      contentRating: options.constraints?.contentRating ?? "teen"
    }
  };
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

function createEventId(seed: string, suffix: string): string {
  return normalizeId(`${seed}-${suffix}`).slice(0, 80);
}

export function createDeterministicEventExpansionPlan(request: EventExpansionRequest): EventExpansionPlan {
  const seed = createEventId(`${request.heroineId}-${hashString(request.userEvent)}`, "library");
  const sceneOneId = `scene-${seed}-1`;
  const sceneTwoId = `scene-${seed}-2`;
  const sceneThreeId = `scene-${seed}-3`;
  const choiceId = `choice-${seed}-ask`;
  const cgAssetId = `asset-cg-${seed}`;
  const cgJobId = `job-cg-${seed}`;
  const heroineName = request.heroineContext.name;
  const portraitAssetId = `asset-${request.heroineId}-portrait`;

  return {
    summary: `${heroineName}와 도서관에서 책을 줍다가 손이 겹치는 3씬 러브코미디 이벤트를 추가합니다.`,
    decision: {
      sceneCount: 3,
      choiceCount: 1,
      cgCount: 1,
      newExpressionAssetCount: 0,
      tone: "romantic_comedy"
    },
    patch: {
      operations: [
        { type: "updateSceneLink", sceneId: request.afterSceneId, nextSceneId: sceneOneId },
        {
          type: "addScene",
          scene: {
            id: sceneOneId,
            label: "도서관의 작은 사고",
            speaker: "나",
            text: `${heroineName}가 안고 있던 책더미가 흔들리더니, 조용한 도서관 바닥에 책이 흩어졌다.`,
            characters: [{ characterId: request.heroineId, expression: "normal", assetId: portraitAssetId, position: "center" }],
            choices: [],
            next: sceneTwoId
          }
        },
        {
          type: "addScene",
          scene: {
            id: sceneTwoId,
            label: "겹쳐진 손",
            speaker: heroineName,
            text: "아, 괜찮아. 내가 주우면 되는데... 잠깐, 손이...",
            cgAssetId,
            characters: [{ characterId: request.heroineId, expression: "shy", assetId: portraitAssetId, position: "center" }],
            choices: []
          }
        },
        {
          type: "addChoice",
          sceneId: sceneTwoId,
          choice: {
            id: choiceId,
            text: "괜찮은지 조심스럽게 묻는다.",
            next: sceneThreeId,
            effects: { flags: ["library-haru-kindness"], affinity: { [request.heroineId]: 1 } }
          }
        },
        {
          type: "addScene",
          scene: {
            id: sceneThreeId,
            label: "어색한 침묵",
            speaker: heroineName,
            text: "괜찮아. 그런데... 방금 건 아무한테도 말하지 말아줘.",
            characters: [{ characterId: request.heroineId, expression: "shy", assetId: portraitAssetId, position: "center" }],
            choices: []
          }
        },
        {
          type: "addAsset",
          asset: {
            id: cgAssetId,
            kind: "cg",
            label: `${heroineName}와 도서관에서 손이 겹치는 CG`,
            source: "placeholder",
            generationJobId: cgJobId
          }
        },
        {
          type: "addGenerationJob",
          job: createImageGenerationJob({
            id: cgJobId,
            kind: "cg",
            targetId: sceneTwoId,
            outputAssetId: cgAssetId,
            prompt: `${heroineName} and protagonist reaching for fallen books in a quiet school library, hands accidentally touching, romantic comedy visual novel CG, teen safe, ${request.heroineContext.appearance}`,
            style: "soft visual novel cg, warm library light, non-explicit, school romance"
          })
        }
      ]
    }
  };
}

export function describeProjectPatch(patch: VnMakerProjectPatch): ProjectPatchDescription {
  const sceneCount = patch.operations.filter((operation) => operation.type === "addScene").length;
  const choiceCount = patch.operations.filter((operation) => operation.type === "addChoice").length;
  const assetCount = patch.operations.filter((operation) => operation.type === "addAsset").length;
  const generationJobCount = patch.operations.filter((operation) => operation.type === "addGenerationJob").length;
  const operations = patch.operations.map((operation) => {
    if (operation.type === "addScene") {
      return `씬 추가: ${operation.scene.label} (${operation.scene.id})`;
    }
    if (operation.type === "updateScene") {
      return `씬 수정: ${operation.scene.label} (${operation.scene.id})`;
    }
    if (operation.type === "updateSceneLink") {
      return `씬 연결 수정: ${operation.sceneId} -> ${operation.nextSceneId || "끝"}`;
    }
    if (operation.type === "addChoice") {
      return `선택지 추가: ${operation.choice.text} (${operation.sceneId})`;
    }
    if (operation.type === "addAsset") {
      return `에셋 추가: ${operation.asset.label} (${operation.asset.kind})`;
    }
    return `CG 작업 추가: ${operation.job.prompt}`;
  });

  return {
    text: `씬 ${sceneCount}개, 선택지 ${choiceCount}개, 에셋 ${assetCount}개, CG 작업 ${generationJobCount}개 변경`,
    sceneCount,
    choiceCount,
    assetCount,
    generationJobCount,
    operations
  };
}

export function applyProjectPatch(project: VnMakerProject, patch: VnMakerProjectPatch): VnMakerProject {
  const nextProject = cloneProject(project);

  for (const operation of patch.operations) {
    if (operation.type === "addScene") {
      if (nextProject.scenes.some((scene) => scene.id === operation.scene.id)) {
        throw new Error(`이미 존재하는 씬입니다: ${operation.scene.id}`);
      }
      nextProject.scenes.push(JSON.parse(JSON.stringify(operation.scene)) as VnMakerScene);
    } else if (operation.type === "updateScene") {
      const sceneIndex = nextProject.scenes.findIndex((scene) => scene.id === operation.scene.id);
      if (sceneIndex < 0) {
        throw new Error(`수정할 씬을 찾을 수 없습니다: ${operation.scene.id}`);
      }
      nextProject.scenes[sceneIndex] = JSON.parse(JSON.stringify(operation.scene)) as VnMakerScene;
    } else if (operation.type === "updateSceneLink") {
      const scene = nextProject.scenes.find((item) => item.id === operation.sceneId);
      if (!scene) {
        throw new Error(`연결할 씬을 찾을 수 없습니다: ${operation.sceneId}`);
      }
      scene.next = operation.nextSceneId;
    } else if (operation.type === "addChoice") {
      const scene = nextProject.scenes.find((item) => item.id === operation.sceneId);
      if (!scene) {
        throw new Error(`선택지를 추가할 씬을 찾을 수 없습니다: ${operation.sceneId}`);
      }
      if (scene.choices.some((choice) => choice.id === operation.choice.id)) {
        throw new Error(`이미 존재하는 선택지입니다: ${operation.choice.id}`);
      }
      scene.choices.push(JSON.parse(JSON.stringify(operation.choice)) as VnMakerChoice);
    } else if (operation.type === "addAsset") {
      if (nextProject.assets.some((asset) => asset.id === operation.asset.id)) {
        throw new Error(`이미 존재하는 에셋입니다: ${operation.asset.id}`);
      }
      nextProject.assets.push(JSON.parse(JSON.stringify(operation.asset)) as VnMakerAsset);
    } else if (operation.type === "addGenerationJob") {
      if (nextProject.generationJobs.some((job) => job.id === operation.job.id)) {
        throw new Error(`이미 존재하는 생성 작업입니다: ${operation.job.id}`);
      }
      nextProject.generationJobs.push(JSON.parse(JSON.stringify(operation.job)) as VnMakerGenerationJob);
    } else {
      const unknown = operation as { type?: string };
      throw new Error(`허용되지 않은 패치 연산입니다: ${unknown.type || "unknown"}`);
    }
  }

  return nextProject;
}

function addIssue(issues: ValidationIssue[], path: string, message: string, severity: ValidationSeverity = "error"): void {
  issues.push({ severity, path, message });
}

export function validateEventExpansionPlan(
  project: VnMakerProject,
  request: EventExpansionRequest,
  plan: EventExpansionPlan
): EventExpansionValidationResult {
  const issues: ValidationIssue[] = [];
  const diff = describeProjectPatch(plan.patch);

  if (project.characters.length !== 1) {
    addIssue(issues, "characters", "Alpha 프로젝트는 히로인 1명만 포함해야 합니다.");
  }
  if (project.routes.length !== 1) {
    addIssue(issues, "routes", "Alpha 프로젝트는 루트 1개만 포함해야 합니다.");
  }
  if (!project.routes.some((route) => route.id === request.routeId && route.heroineId === request.heroineId)) {
    addIssue(issues, "request.routeId", "요청한 루트와 히로인이 프로젝트와 일치하지 않습니다.");
  }
  if (!project.scenes.some((scene) => scene.id === request.afterSceneId)) {
    addIssue(issues, "request.afterSceneId", "삽입 기준 씬이 프로젝트에 없습니다.");
  }
  if (request.baseProjectHash !== hashProjectSnapshot(project)) {
    addIssue(issues, "request.baseProjectHash", "패치 생성 기준 프로젝트와 현재 프로젝트가 다릅니다.");
  }
  if (plan.decision.newExpressionAssetCount !== 0 || request.constraints.allowNewExpressionAssets !== false) {
    addIssue(issues, "decision.newExpressionAssetCount", "Alpha에서는 새 표정 에셋을 생성하지 않습니다.");
  }
  if (diff.sceneCount !== plan.decision.sceneCount || diff.sceneCount > request.constraints.maxScenes) {
    addIssue(issues, "decision.sceneCount", "패치의 씬 추가 수가 선언 또는 제약과 일치하지 않습니다.");
  }
  if (diff.choiceCount !== plan.decision.choiceCount || diff.choiceCount > request.constraints.maxChoices) {
    addIssue(issues, "decision.choiceCount", "패치의 선택지 추가 수가 선언 또는 제약과 일치하지 않습니다.");
  }
  const cgAssetCount = plan.patch.operations.filter((operation) => operation.type === "addAsset" && operation.asset.kind === "cg").length;
  if (cgAssetCount !== plan.decision.cgCount || cgAssetCount > request.constraints.maxCgCount) {
    addIssue(issues, "decision.cgCount", "패치의 CG 추가 수가 선언 또는 제약과 일치하지 않습니다.");
  }
  if (plan.patch.operations.some((operation) => operation.type === "addAsset" && operation.asset.kind === "expression")) {
    addIssue(issues, "patch.operations", "Alpha에서는 표정 에셋 추가 연산을 허용하지 않습니다.");
  }

  let appliedProject: VnMakerProject | undefined;
  if (issues.length === 0) {
    try {
      appliedProject = applyProjectPatch(project, plan.patch);
    } catch (error) {
      addIssue(issues, "patch.operations", error instanceof Error ? error.message : String(error));
    }
  }

  if (appliedProject) {
    validateProject(appliedProject).forEach((issue) => {
      if (issue.severity === "error") {
        addIssue(issues, issue.path, issue.message, issue.severity);
      }
    });

    const assetMap = new Map(appliedProject.assets.map((asset) => [asset.id, asset]));
    const jobMap = new Map(appliedProject.generationJobs.map((job) => [job.id, job]));
    const heroineIds = new Set(appliedProject.characters.map((character) => character.id));

    appliedProject.scenes.forEach((scene, sceneIndex) => {
      scene.characters.forEach((character, characterIndex) => {
        if (character.characterId !== request.heroineId || !heroineIds.has(character.characterId)) {
          addIssue(issues, `scenes.${sceneIndex}.characters.${characterIndex}.characterId`, "씬 캐릭터는 프로젝트 단일 히로인과 일치해야 합니다.");
        }
      });

      if (scene.cgAssetId) {
        const asset = assetMap.get(scene.cgAssetId);
        if (!asset || asset.kind !== "cg") {
          addIssue(issues, `scenes.${sceneIndex}.cgAssetId`, "CG 씬은 등록된 CG 에셋을 참조해야 합니다.");
        } else {
          const job = asset.generationJobId ? jobMap.get(asset.generationJobId) : undefined;
          if (!job || job.outputAssetId !== asset.id) {
            addIssue(issues, `assets.${asset.id}.generationJobId`, "CG asset은 outputAssetId가 연결된 generation job을 가져야 합니다.");
          }
        }
      }
    });

    appliedProject.generationJobs.forEach((job, jobIndex) => {
      if (job.kind === "cg") {
        const outputAsset = job.outputAssetId ? assetMap.get(job.outputAssetId) : undefined;
        if (!outputAsset || outputAsset.kind !== "cg" || outputAsset.generationJobId !== job.id) {
          addIssue(issues, `generationJobs.${jobIndex}.outputAssetId`, "CG generation job의 outputAssetId는 연결된 CG asset이어야 합니다.");
        }
      }
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
    appliedProject: issues.every((issue) => issue.severity !== "error") ? appliedProject : undefined,
    diff
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

function placeholderAssetUri(asset: VnMakerAsset): string {
  const label = escapeHtml(asset.label || asset.id);
  const fill = asset.kind === "portrait" ? "#f9a8d4" : asset.kind === "cg" ? "#93c5fd" : "#64748b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${fill}"/><text x="480" y="270" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="40" fill="#111827">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function rewriteAsset(asset: VnMakerAsset | undefined, rewrites: Record<string, string> = {}): VnMakerAsset | undefined {
  if (!asset) {
    return undefined;
  }
  return {
    ...asset,
    uri: rewrites[asset.id] || asset.uri || placeholderAssetUri(asset)
  };
}

export function createPlayerRuntimeData(project: VnMakerProject, options: PlayerRuntimeOptions = {}): PlayerRuntimeData {
  const route = project.routes.find((item) => item.id === project.settings.defaultRouteId) || project.routes[0];
  const assets = project.assets
    .map((asset) => rewriteAsset(asset, options.assetPathRewrites))
    .filter((asset): asset is VnMakerAsset => Boolean(asset));
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const issues = validateProject(project);

  return {
    projectId: project.id,
    title: project.title,
    premise: project.premise,
    routeId: route?.id || "",
    startSceneId: options.startSceneId || route?.entrySceneId || project.scenes[0]?.id || "",
    scenes: project.scenes.map((scene): PlayerRuntimeScene => ({
      id: scene.id,
      label: scene.label,
      speaker: scene.speaker,
      text: scene.text,
      characters: scene.characters.map((character) => ({
        ...character,
        asset: character.assetId ? assetMap.get(character.assetId) : undefined
      })),
      choices: scene.choices,
      next: scene.next,
      backgroundAsset: scene.backgroundAssetId ? assetMap.get(scene.backgroundAssetId) : undefined,
      cgAsset: scene.cgAssetId ? assetMap.get(scene.cgAssetId) : undefined
    })),
    assets,
    validation: {
      ok: issues.every((issue) => issue.severity !== "error"),
      issues
    }
  };
}

export function buildPlayerRuntimeScript(): string {
  return `
(function () {
  function readRuntime() {
    if (window.VN_MAKER_RUNTIME) return window.VN_MAKER_RUNTIME;
    var node = document.getElementById("vn-maker-project");
    return node ? JSON.parse(node.textContent || "{}") : null;
  }

  function start(runtime) {
    var root = document.getElementById("vn-player");
    if (!root || !runtime) return;
    var sceneMap = new Map((runtime.scenes || []).map(function (scene) { return [scene.id, scene]; }));
    var currentSceneId = runtime.startSceneId;

    function imageNode(asset, alt) {
      if (!asset || !asset.uri) return "";
      return '<img src="' + asset.uri + '" alt="' + alt.replace(/"/g, "&quot;") + '">';
    }

    function render(sceneId) {
      var scene = sceneMap.get(sceneId);
      if (!scene) {
        root.innerHTML = '<section class="vn-stage"><p>장면을 찾을 수 없습니다.</p></section>';
        return;
      }
      currentSceneId = scene.id;
      var images = "";
      if (scene.backgroundAsset) images += imageNode(scene.backgroundAsset, scene.backgroundAsset.label || "background");
      (scene.characters || []).forEach(function (character) {
        images += imageNode(character.asset, character.characterId || "character");
      });
      if (scene.cgAsset) images += imageNode(scene.cgAsset, scene.cgAsset.label || "cg");
      var choices = (scene.choices || []).map(function (choice) {
        return '<button class="vn-choice" data-next="' + choice.next + '">' + choice.text + '</button>';
      }).join("");
      if (!choices && scene.next) {
        choices = '<button class="vn-choice" data-next="' + scene.next + '">다음</button>';
      }
      root.innerHTML =
        '<section class="vn-stage">' +
        '<div class="vn-images">' + images + '</div>' +
        '<div class="vn-dialogue"><p class="vn-label">' + scene.label + '</p><h2>' + scene.speaker + '</h2><p>' + scene.text + '</p></div>' +
        '<div class="vn-choices">' + choices + '</div>' +
        '</section>';
      root.querySelectorAll("[data-next]").forEach(function (button) {
        button.addEventListener("click", function () { render(button.getAttribute("data-next")); });
      });
    }

    render(currentSceneId);
  }

  if (window.VN_MAKER_RUNTIME) {
    start(window.VN_MAKER_RUNTIME);
  } else if (document.currentScript && document.currentScript.dataset.project) {
    fetch(document.currentScript.dataset.project).then(function (response) {
      return response.json();
    }).then(function (runtime) {
      window.VN_MAKER_RUNTIME = runtime;
      start(runtime);
    });
  } else {
    start(readRuntime());
  }
}());
`.trim();
}

export function buildProjectHtml(project: VnMakerProject, options: BuildProjectHtmlOptions = {}): HtmlBuildArtifact {
  const runtime = createPlayerRuntimeData(project, options);
  const inlineRuntime = !options.projectDataPath && !options.runtimeScriptPath;
  const runtimeScript = inlineRuntime ? `<script>${buildPlayerRuntimeScript()}</script>` : `<script src="${escapeHtml(options.runtimeScriptPath || "./runtime/player.js")}" data-project="${escapeHtml(options.projectDataPath || "./project-data.json")}"></script>`;
  const runtimeData = inlineRuntime
    ? `<script type="application/json" id="vn-maker-project">${escapeJsonForHtml(runtime)}</script>`
    : "";

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
    main { width: min(960px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0; }
    .vn-stage { min-height: 680px; display: grid; grid-template-rows: 1fr auto auto; gap: 16px; }
    .vn-images { min-height: 400px; display: flex; align-items: end; justify-content: center; gap: 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .vn-images img { max-height: 390px; max-width: 100%; object-fit: contain; }
    .vn-dialogue { border: 1px solid #334155; border-radius: 8px; padding: 18px; background: rgba(15, 23, 42, 0.94); }
    .vn-label { color: #93c5fd; margin: 0 0 8px; }
    .vn-dialogue h2 { margin: 0 0 10px; font-size: 20px; }
    .vn-dialogue p { line-height: 1.7; }
    .vn-choices { display: flex; flex-direction: column; gap: 10px; }
    .vn-choice { border: 1px solid #60a5fa; border-radius: 8px; background: #1e3a8a; color: white; padding: 12px 14px; font: inherit; cursor: pointer; }
    .vn-choice:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <main>
    <div id="vn-player" aria-live="polite"></div>
  </main>
  ${runtimeData}
  ${runtimeScript}
</body>
</html>`
  };
}
