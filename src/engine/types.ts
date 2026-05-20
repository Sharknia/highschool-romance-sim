export type FlagSet = Record<string, boolean>;
export type NumericMap = Record<string, number>;
export type CharacterMemoryTags = Record<string, FlagSet>;
export type CharacterStageMap = Record<string, string>;
export type MaybePromise<T> = T | Promise<T>;

export type Resolvable<T> = T | ((state: GameState) => T);

export interface RouteState {
  [key: string]: string | number | FlagSet;
  name: string;
  chapter: string;
  focus: number;
  courage: number;
  glitch: number;
  flags: FlagSet;
  endingReason: string;
}

export interface ScheduleState {
  id: string;
  currentSlot: string;
  actionPoints: number | null;
  maxActionPoints: number | null;
  usedActions: string[];
}

export interface CharacterRouteState {
  stage: string;
  memoryTags: FlagSet;
}

export interface GameState {
  currentSceneId: string;
  affinity: NumericMap;
  route: RouteState;
  schedule: ScheduleState;
  characterRoutes: Record<string, CharacterRouteState>;
}

export interface Condition {
  all?: Condition[];
  any?: Condition[];
  none?: Condition[];
  flags?: string[] | FlagSet;
  anyFlags?: string[] | FlagSet;
  notFlags?: string[] | FlagSet;
  minStats?: NumericMap;
  maxStats?: NumericMap;
  minAffinity?: NumericMap;
  maxAffinity?: NumericMap;
  routeStages?: CharacterStageMap;
  memoryTags?: CharacterMemoryTags;
  anyMemoryTags?: CharacterMemoryTags;
  notMemoryTags?: CharacterMemoryTags;
  minActionPoints?: number;
  maxActionPoints?: number;
  usedActions?: string[] | FlagSet;
  notUsedActions?: string[] | FlagSet;
  timeSlot?: string;
}

export interface ScheduleConfig {
  id?: string;
  slot?: string;
  actionPoints?: number;
  actionPointCost?: number;
  markAction?: string;
  reset?: boolean;
}

export interface ChoiceEffects {
  affinity?: NumericMap;
  stats?: NumericMap;
  flags?: string[] | FlagSet;
  setFlags?: string[] | FlagSet;
  clearFlags?: string[] | FlagSet;
  routeStages?: CharacterStageMap;
  memoryTags?: CharacterMemoryTags;
  clearMemoryTags?: CharacterMemoryTags;
  schedule?: ScheduleConfig;
  endingReason?: string;
  toast?: string;
}

export interface Choice {
  text: string;
  next: Resolvable<string>;
  affinity?: NumericMap;
  stats?: NumericMap;
  flags?: string[] | FlagSet;
  clearFlags?: string[] | FlagSet;
  routeStages?: CharacterStageMap;
  memoryTags?: CharacterMemoryTags;
  clearMemoryTags?: CharacterMemoryTags;
  actionPointCost?: number;
  scheduleAction?: string;
  requires?: Condition;
  lockedReason?: string;
  hideWhenLocked?: boolean;
  toast?: string;
  effects?: ChoiceEffects;
}

export interface SceneHud {
  name?: string;
  chapter?: string;
}

export interface CharacterState {
  name: string;
  position?: string;
  expression?: string;
  active?: boolean;
}

export interface CharacterAssetMap {
  [characterName: string]: Record<string, string>;
}

export interface SceneVariant extends Partial<Scene> {
  when?: Condition;
}

export interface Scene {
  label: Resolvable<string>;
  background: string;
  speaker: Resolvable<string>;
  text: Resolvable<string>;
  hud?: SceneHud;
  routeStages?: CharacterStageMap;
  memoryTags?: CharacterMemoryTags;
  schedule?: ScheduleConfig;
  timeSlot?: string;
  characters?: CharacterState[];
  choices?: Choice[];
  variants?: SceneVariant[];
  unlocks?: string[] | FlagSet;
  unlockToast?: string;
  cg?: string;
  effect?: string;
  next?: Resolvable<string>;
  ending?: boolean;
}

export type SceneMap = Record<string, Scene>;

export interface RuntimeOptions {
  state: GameState;
  scenes: SceneMap;
  affinityMax?: number;
  routeStatMax?: number;
  platform?: VisualNovelPlatformOptions;
}

export interface DebugSnapshot {
  currentSceneId: string;
  affinity: NumericMap;
  route: RouteState;
  schedule: ScheduleState;
  characterRoutes: Record<string, CharacterRouteState>;
}

export interface BacklogEntry {
  sceneId: string;
  label: string;
  speaker: string;
  text: string;
  characterNames: string[];
  createdAt: number;
}

export interface SaveSlot {
  id: string;
  label: string;
  savedAt: string;
  sceneId: string;
  state: GameState;
  backlog: BacklogEntry[];
}

export interface VisualNovelSaveStorage {
  save(saveSlot: SaveSlot): MaybePromise<SaveSlot>;
  load(slotId: string): MaybePromise<SaveSlot | null>;
  list(): MaybePromise<SaveSlot[]>;
  remove(slotId: string): MaybePromise<void>;
}

export interface VisualNovelLogger {
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
}

export interface VisualNovelKeyValueStorage {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface VisualNovelPlatform {
  now(): number;
  createSaveTimestamp(): string;
  setTimeout(callback: () => void, delayMs: number): unknown;
  logger: VisualNovelLogger;
  alert(message: string): void;
  createElement?: (tagName: string) => unknown;
  getStorage?: () => VisualNovelKeyValueStorage | null;
}

export type VisualNovelPlatformOptions = Partial<VisualNovelPlatform>;

export interface LocalStorageSaveStorageOptions {
  storageKey: string;
  storage?: VisualNovelKeyValueStorage;
  platform?: VisualNovelPlatformOptions;
}

export interface SceneValidationIssue {
  severity: "error" | "warning";
  sceneId: string;
  field: string;
  message: string;
}

export interface VisualNovelProjectDefinition {
  scenes: SceneMap;
  imageAssets?: Record<string, string>;
  characterAssetMap?: CharacterAssetMap;
}
