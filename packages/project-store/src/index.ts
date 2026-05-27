import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  analyzeRouteGraph,
  buildPlayerRuntimeScript,
  buildProjectHtml,
  applyGenerationResultToProject,
  createProjectRevision,
  createPlayerRuntimeData,
  createStarterProject,
  hashProjectSnapshot,
  parseVnMakerProject,
  updateGenerationJobStatus,
  upsertProjectCharacter,
  upsertProjectScene,
  validateEventExpansionPlan,
  validateProject,
  type EventExpansionPlan,
  type EventExpansionRequest,
  type HeroineProfile,
  type PlayerRuntimeData,
  type ProjectPatchDescription,
  type CreateStarterProjectInput,
  type EventExpansionValidationResult,
  type HeroineReuseRecord,
  type ProjectRevisionDto,
  type ValidationIssue,
  type VnMakerAsset,
  type VnMakerCharacter,
  type VnMakerGenerationJob,
  type VnMakerProject,
  type VnMakerRoute,
  type VnMakerScene
} from "@vn-maker/engine-core";

export interface ProjectWorkspacePaths {
  projectDirectory: string;
  databasePath: string;
  assetsDirectory: string;
  sourceAssetsDirectory: string;
  generatedAssetsDirectory: string;
  exportsDirectory: string;
  cacheDirectory: string;
}

export interface CreateProjectWorkspaceInput {
  projectDirectory: string;
  starter?: CreateStarterProjectInput;
  project?: VnMakerProject;
}

export type RecentProjectValidationState = "unchecked" | "valid" | "invalid" | "stale";

export interface RecentProjectIndexEntry {
  projectId: string;
  projectDirectory: string;
  title: string;
  lastOpenedAt: string;
  lastValidatedAt?: string;
  validationState?: RecentProjectValidationState;
  missing?: boolean;
}

export interface RecentProjectIndexStoreOptions {
  indexFilePath?: string;
  clock?: () => Date;
}

export interface StoredHeroineProfile extends HeroineProfile {
  createdAt: string;
  updatedAt: string;
}

export interface StoreStagedPortraitInput {
  id: string;
  assetId: string;
  heroineId?: string;
  expiresAt: string;
}

export interface StoredStagedPortrait {
  id: string;
  assetId: string;
  heroineId?: string;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

export interface UpsertRecentProjectInput {
  projectId: string;
  projectDirectory: string;
  title: string;
  lastValidatedAt?: string;
  validationState?: RecentProjectValidationState;
}

export interface StoredGenerationAssetMetadata {
  relativePath?: string;
  hash?: string;
  mimeType?: string;
  byteSize?: number;
  promptHash?: string;
  adapter?: string;
}

export interface StoreGenerationResultInput {
  job: VnMakerGenerationJob;
  asset: VnMakerAsset;
  image?: {
    filePath?: string;
    uri?: string;
    mimeType?: string;
    b64Json?: string;
  };
  adapter?: string;
}

export interface ProjectValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export type ProjectRevisionInput = ProjectRevisionDto | string;

export interface TransactionalProjectMutationResult {
  project: VnMakerProject;
  validation: ProjectValidationResult;
  previousRevision: ProjectRevisionDto;
  projectRevision: ProjectRevisionDto;
}

export class PatchStaleError extends Error {
  readonly code = "PATCH_STALE";
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`패치 검증 실패: ${issues.map((issue) => issue.message).join(", ")}`);
    this.name = "PatchStaleError";
    this.issues = issues;
  }
}

export class StaleProjectRevisionError extends Error {
  readonly code = "STALE_PROJECT_REVISION";
  readonly expectedRevision: string;
  readonly actualRevision: ProjectRevisionDto;
  readonly nextAction = "최신 프로젝트를 다시 불러온 뒤 시도하세요.";

  constructor(input: { expectedRevision: string; actualRevision: ProjectRevisionDto }) {
    super("프로젝트가 다른 곳에서 변경되었습니다.");
    this.name = "StaleProjectRevisionError";
    this.expectedRevision = input.expectedRevision;
    this.actualRevision = input.actualRevision;
  }
}

export interface ApplyEventExpansionResult {
  project: VnMakerProject;
  validation: ProjectValidationResult;
  diff: ProjectPatchDescription;
  patchHistoryEntry: PatchHistoryEntry;
  previousRevision: ProjectRevisionDto;
  projectRevision: ProjectRevisionDto;
}

export interface ApplyEventExpansionInput {
  request: EventExpansionRequest;
  plan: EventExpansionPlan;
  expectedProjectRevision: ProjectRevisionInput;
  sourcePatchHistoryId?: string;
}

export interface ApplyRepairMutationInput {
  expectedProjectRevision: ProjectRevisionInput;
  summary: string;
  rawOutput?: (projectRevision: ProjectRevisionDto) => unknown;
  diff?: ProjectPatchDescription;
  mutate: (project: VnMakerProject) => VnMakerProject;
}

export interface ApplyRepairMutationResult {
  project: VnMakerProject;
  validation: ProjectValidationResult;
  previousRevision: ProjectRevisionDto;
  projectRevision: ProjectRevisionDto;
  repairHistoryEntry: PatchHistoryEntry;
}

export type PatchHistoryStatus = "proposed" | "applied" | "failed";

export interface PatchGenerationAttempt {
  attempt: number;
  ok: boolean;
  failureKind?: "schema_invalid" | "engine_validation_failed" | "quality_rule_failed";
  issues: string[];
}

export interface RecordPatchHistoryInput {
  status: PatchHistoryStatus;
  summary: string;
  request?: EventExpansionRequest;
  plan?: EventExpansionPlan;
  rawOutput?: unknown;
  attempts?: PatchGenerationAttempt[];
  validation?: EventExpansionValidationResult | ProjectValidationResult;
  diff?: ProjectPatchDescription;
  beforeProject?: VnMakerProject;
  afterProject?: VnMakerProject;
}

export interface PatchHistoryEntry {
  id: string;
  status: PatchHistoryStatus;
  summary: string;
  request?: EventExpansionRequest;
  plan?: EventExpansionPlan;
  rawOutput?: unknown;
  attempts: PatchGenerationAttempt[];
  validationIssues: ValidationIssue[];
  diff?: ProjectPatchDescription;
  beforeSummary?: string;
  afterSummary?: string;
  createdAt: string;
  revertedAt?: string;
}

export interface WebExportResult {
  outputDirectory: string;
  indexPath: string;
  projectDataPath: string;
  runtimeScriptPath: string;
  assetPathRewrites: Record<string, string>;
}

export interface WebExportSmokeTestResult {
  ok: boolean;
  checks: {
    indexHtml: boolean;
    runtimeScript: boolean;
    projectData: boolean;
    firstScene: boolean;
    portrait: boolean;
    choice: boolean;
    choiceNavigation: boolean;
    cg: boolean;
    branchEndingCoverage: boolean;
    endingMetadata: boolean;
  };
  issues: string[];
  reachableEndingIds?: string[];
  uncoveredTerminalSceneIds?: string[];
  cyclesWithoutEndingPath?: string[][];
}

interface ProjectRow {
  id: string;
  version: string;
  title: string;
  premise: string;
  updated_at: string;
}

interface SettingsRow {
  default_route_id: string;
  output_file_name: string;
  language: string;
}

interface CharacterRow {
  id: string;
  display_name: string;
  role: string;
  profile: string;
  emotion_tags_json: string;
  portrait_asset_ids_json: string;
  expression_asset_ids_json: string | null;
  description: string | null;
  personality: string | null;
  speech_style: string | null;
  appearance: string | null;
  default_portrait_asset_id: string | null;
  source_heroine_id: string | null;
  source_heroine_name: string | null;
  source_snapshot_created_at: string | null;
  position: number;
}

interface HeroineRow {
  id: string;
  name: string;
  description: string;
  personality: string;
  speech_style: string;
  appearance: string;
  default_portrait_asset_id: string | null;
  portrait_asset_ids_json: string;
  expression_asset_ids_json: string | null;
  tags_json: string | null;
  reuse_history_json: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface StagedPortraitRow {
  id: string;
  asset_id: string;
  heroine_id: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

interface RouteRow {
  id: string;
  title: string;
  heroine_id: string;
  summary: string;
  entry_scene_id: string;
  endings_json: string;
  position: number;
}

interface SceneRow {
  id: string;
  label: string;
  speaker: string;
  text: string;
  background_asset_id: string | null;
  cg_asset_id: string | null;
  characters_json: string;
  choices_json: string;
  next_scene_id: string | null;
  ending_json: string | null;
  condition_json: string | null;
  memory_tags_json: string | null;
  position: number;
}

interface AssetRow {
  id: string;
  kind: VnMakerAsset["kind"];
  label: string;
  uri: string | null;
  source: VnMakerAsset["source"] | null;
  generation_job_id: string | null;
  provenance_json: string | null;
  relative_path: string | null;
  hash: string | null;
  mime_type: string | null;
  byte_size: number | null;
  prompt_hash: string | null;
  adapter: string | null;
  position: number;
}

interface GenerationJobRow {
  id: string;
  kind: VnMakerGenerationJob["kind"];
  target_id: string;
  prompt: string;
  style: string | null;
  provider: VnMakerGenerationJob["provider"];
  status: VnMakerGenerationJob["status"];
  output_asset_id: string | null;
  failure_message: string | null;
  dummy: number | null;
  fallback_reason: string | null;
  pack_version: string | null;
  source_generated_by: string | null;
  prompt_hash: string | null;
  adapter: string | null;
  position: number;
}

interface ValidationIssueRow {
  severity: ValidationIssue["severity"];
  path: string;
  message: string;
  code: string | null;
  domain: string | null;
  scene_ids_json: string | null;
  choice_ids_json: string | null;
  target_scene_id: string | null;
}

interface PatchHistoryRow {
  id: string;
  status: PatchHistoryStatus;
  summary: string;
  request_json: string | null;
  plan_json: string | null;
  raw_output_json: string | null;
  attempts_json: string | null;
  validation_issues_json: string | null;
  diff_json: string | null;
  before_project_json: string | null;
  after_project_json: string | null;
  created_at: string;
  reverted_at: string | null;
}

const migrations = [
  {
    id: 1,
    name: "initial_project_store",
    sql: `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  premise TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_settings (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  default_route_id TEXT NOT NULL,
  output_file_name TEXT NOT NULL,
  language TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  profile TEXT NOT NULL,
  emotion_tags_json TEXT NOT NULL,
  portrait_asset_ids_json TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS routes (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  heroine_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  entry_scene_id TEXT NOT NULL,
  endings_json TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS scenes (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  background_asset_id TEXT,
  cg_asset_id TEXT,
  characters_json TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  next_scene_id TEXT,
  condition_json TEXT,
  memory_tags_json TEXT,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS assets (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  uri TEXT,
  source TEXT,
  generation_job_id TEXT,
  relative_path TEXT,
  hash TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  prompt_hash TEXT,
  adapter TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  style TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  output_asset_id TEXT,
  prompt_hash TEXT,
  adapter TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  path TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_project_kind ON assets(project_id, kind);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_status ON generation_jobs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_validation_issues_project ON validation_issues(project_id);
`
  },
  {
    id: 2,
    name: "heroine_library",
    sql: `
CREATE TABLE IF NOT EXISTS heroine_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  personality TEXT NOT NULL,
  speech_style TEXT NOT NULL,
  appearance TEXT NOT NULL,
  default_portrait_asset_id TEXT,
  portrait_asset_ids_json TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`
  },
  {
    id: 3,
    name: "beta_iteration_fields",
    sql: `
ALTER TABLE heroine_library ADD COLUMN expression_asset_ids_json TEXT;
ALTER TABLE heroine_library ADD COLUMN tags_json TEXT;
ALTER TABLE heroine_library ADD COLUMN reuse_history_json TEXT;

ALTER TABLE characters ADD COLUMN expression_asset_ids_json TEXT;
ALTER TABLE characters ADD COLUMN description TEXT;
ALTER TABLE characters ADD COLUMN personality TEXT;
ALTER TABLE characters ADD COLUMN speech_style TEXT;
ALTER TABLE characters ADD COLUMN appearance TEXT;
ALTER TABLE characters ADD COLUMN default_portrait_asset_id TEXT;
ALTER TABLE characters ADD COLUMN source_heroine_id TEXT;
ALTER TABLE characters ADD COLUMN source_heroine_name TEXT;
ALTER TABLE characters ADD COLUMN source_snapshot_created_at TEXT;

ALTER TABLE generation_jobs ADD COLUMN failure_message TEXT;

CREATE TABLE IF NOT EXISTS patch_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  request_json TEXT,
  plan_json TEXT,
  raw_output_json TEXT,
  attempts_json TEXT,
  validation_issues_json TEXT NOT NULL,
  diff_json TEXT,
  before_project_json TEXT,
  after_project_json TEXT,
  created_at TEXT NOT NULL,
  reverted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_patch_history_project_created ON patch_history(project_id, created_at);
`
  },
  {
    id: 4,
    name: "scene_level_ending",
    sql: `
ALTER TABLE scenes ADD COLUMN ending_json TEXT;
`
  },
  {
    id: 5,
    name: "staged_portrait_refs",
    sql: `
CREATE TABLE IF NOT EXISTS staged_portraits (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  heroine_id TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_staged_portraits_project_asset ON staged_portraits(project_id, asset_id);
`
  },
  {
    id: 6,
    name: "mock_image_pack_provenance",
    sql: `
ALTER TABLE assets ADD COLUMN provenance_json TEXT;

ALTER TABLE generation_jobs ADD COLUMN dummy INTEGER;
ALTER TABLE generation_jobs ADD COLUMN fallback_reason TEXT;
ALTER TABLE generation_jobs ADD COLUMN pack_version TEXT;
ALTER TABLE generation_jobs ADD COLUMN source_generated_by TEXT;
`
  },
  {
    id: 7,
    name: "validation_issue_metadata",
    sql: `
ALTER TABLE validation_issues ADD COLUMN code TEXT;
ALTER TABLE validation_issues ADD COLUMN domain TEXT;
ALTER TABLE validation_issues ADD COLUMN scene_ids_json TEXT;
ALTER TABLE validation_issues ADD COLUMN choice_ids_json TEXT;
ALTER TABLE validation_issues ADD COLUMN target_scene_id TEXT;
`
  }
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  return JSON.parse(value) as T;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeNullable(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function revisionValue(input: ProjectRevisionInput): string {
  return typeof input === "string" ? input : input.revision;
}

function validationIssueFromRow(row: ValidationIssueRow): ValidationIssue {
  return {
    severity: row.severity,
    path: row.path,
    message: row.message,
    code: row.code ? row.code as ValidationIssue["code"] : undefined,
    domain: row.domain ? row.domain as ValidationIssue["domain"] : undefined,
    sceneIds: parseJson<string[] | undefined>(row.scene_ids_json, undefined),
    choiceIds: parseJson<string[] | undefined>(row.choice_ids_json, undefined),
    targetSceneId: row.target_scene_id || undefined
  };
}

function assertProjectSnapshot(project: VnMakerProject): void {
  const parsed = parseVnMakerProject(project);
  if (!parsed.ok) {
    throw new Error(`저장하려는 project 입력이 VnMakerProject 형식이 아닙니다: ${parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join(", ")}`);
  }
}

function heroineFromRow(row: HeroineRow): HeroineProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    personality: row.personality,
    speechStyle: row.speech_style,
    appearance: row.appearance,
    defaultPortraitAssetId: row.default_portrait_asset_id || undefined,
    portraitAssetIds: parseJson<string[]>(row.portrait_asset_ids_json, []),
    expressionAssetIds: parseJson<Record<string, string>>(row.expression_asset_ids_json, {}),
    tags: parseJson<string[]>(row.tags_json, []),
    reuseHistory: parseJson<HeroineReuseRecord[]>(row.reuse_history_json, [])
  };
}

function storedHeroineFromRow(row: HeroineRow): StoredHeroineProfile {
  return {
    ...heroineFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function stagedPortraitFromRow(row: StagedPortraitRow): StoredStagedPortrait {
  return {
    id: row.id,
    assetId: row.asset_id,
    heroineId: row.heroine_id || undefined,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at || undefined,
    createdAt: row.created_at
  };
}

function summarizeProject(project: VnMakerProject): string {
  return `씬 ${project.scenes.length}개, 선택지 ${project.scenes.reduce((total, scene) => total + scene.choices.length, 0)}개, 에셋 ${project.assets.length}개, 생성 작업 ${project.generationJobs.length}개`;
}

function applySingleBackgroundScenePolicy(project: VnMakerProject): VnMakerProject {
  const backgroundAssets = project.assets.filter((asset) => asset.kind === "background");
  if (backgroundAssets.length !== 1 || project.scenes.length === 0) {
    return project;
  }
  const backgroundAssetId = backgroundAssets[0].id;
  if (project.scenes.every((scene) => scene.backgroundAssetId === backgroundAssetId)) {
    return project;
  }
  return {
    ...project,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      backgroundAssetId
    }))
  };
}

function applyGenerationPolicy(project: VnMakerProject, input: StoreGenerationResultInput): VnMakerProject {
  const nextProject = applyGenerationResultToProject(project, input);
  if (input.asset.kind !== "background") {
    return nextProject;
  }

  const outputAssetId = input.asset.id;
  const outputJobId = input.job.id;

  nextProject.assets = nextProject.assets.filter((asset) => {
    return !(asset.kind === "background" && asset.id !== outputAssetId);
  });
  nextProject.generationJobs = nextProject.generationJobs.filter((job) => job.kind !== "background" || job.id === outputJobId);

  return applySingleBackgroundScenePolicy(nextProject);
}

function patchHistoryEntryFromRow(row: PatchHistoryRow): PatchHistoryEntry {
  const beforeProject = parseJson<VnMakerProject | null>(row.before_project_json, null);
  const afterProject = parseJson<VnMakerProject | null>(row.after_project_json, null);

  return {
    id: row.id,
    status: row.status,
    summary: row.summary,
    request: parseJson<EventExpansionRequest | undefined>(row.request_json, undefined),
    plan: parseJson<EventExpansionPlan | undefined>(row.plan_json, undefined),
    rawOutput: parseJson<unknown>(row.raw_output_json, undefined),
    attempts: parseJson<PatchGenerationAttempt[]>(row.attempts_json, []),
    validationIssues: parseJson<ValidationIssue[]>(row.validation_issues_json, []),
    diff: parseJson<ProjectPatchDescription | undefined>(row.diff_json, undefined),
    beforeSummary: beforeProject ? summarizeProject(beforeProject) : undefined,
    afterSummary: afterProject ? summarizeProject(afterProject) : undefined,
    createdAt: row.created_at,
    revertedAt: row.reverted_at || undefined
  };
}

function statementList(sql: string): string[] {
  return sql.split(";").map((statement) => statement.trim()).filter(Boolean);
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function shouldSkipMigrationStatement(db: Database.Database, statement: string): boolean {
  const addColumn = statement.match(/^ALTER TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
  return Boolean(addColumn && columnExists(db, addColumn[1], addColumn[2]));
}

export function resolveProjectWorkspacePaths(projectDirectory: string): ProjectWorkspacePaths {
  const root = isAbsolute(projectDirectory) ? projectDirectory : resolve(projectDirectory);
  const assetsDirectory = join(root, "assets");

  return {
    projectDirectory: root,
    databasePath: join(root, "project.sqlite"),
    assetsDirectory,
    sourceAssetsDirectory: join(assetsDirectory, "source"),
    generatedAssetsDirectory: join(assetsDirectory, "generated"),
    exportsDirectory: join(root, "exports"),
    cacheDirectory: join(root, "cache")
  };
}

export async function ensureProjectWorkspaceDirectories(paths: ProjectWorkspacePaths): Promise<void> {
  await mkdir(paths.projectDirectory, { recursive: true });
  await mkdir(paths.sourceAssetsDirectory, { recursive: true });
  await mkdir(paths.generatedAssetsDirectory, { recursive: true });
  await mkdir(paths.exportsDirectory, { recursive: true });
  await mkdir(paths.cacheDirectory, { recursive: true });
}

export function getDefaultRecentProjectIndexPath(): string {
  return process.env.VN_MAKER_RECENT_PROJECTS_FILE || join(process.cwd(), "workspace", "recent-projects.json");
}

function isErrorWithCode(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function normalizeRecentProjectEntry(value: unknown): RecentProjectIndexEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.projectId !== "string"
    || typeof record.projectDirectory !== "string"
    || typeof record.title !== "string"
    || typeof record.lastOpenedAt !== "string"
  ) {
    return null;
  }
  const validationState = record.validationState === "valid"
    || record.validationState === "invalid"
    || record.validationState === "stale"
    || record.validationState === "unchecked"
    ? record.validationState
    : "unchecked";
  return {
    projectId: record.projectId,
    projectDirectory: resolveProjectWorkspacePaths(record.projectDirectory).projectDirectory,
    title: record.title,
    lastOpenedAt: record.lastOpenedAt,
    lastValidatedAt: typeof record.lastValidatedAt === "string" ? record.lastValidatedAt : undefined,
    validationState,
    missing: Boolean(record.missing)
  };
}

function compareRecentProjectEntries(left: RecentProjectIndexEntry, right: RecentProjectIndexEntry): number {
  const openedAt = right.lastOpenedAt.localeCompare(left.lastOpenedAt);
  if (openedAt !== 0) {
    return openedAt;
  }
  const title = left.title.localeCompare(right.title);
  if (title !== 0) {
    return title;
  }
  return left.projectId.localeCompare(right.projectId);
}

function sortRecentProjectEntries(entries: RecentProjectIndexEntry[]): RecentProjectIndexEntry[] {
  return [...entries].sort(compareRecentProjectEntries);
}

async function readRecentProjectEntries(indexFilePath: string): Promise<RecentProjectIndexEntry[]> {
  try {
    const raw = await readFile(indexFilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray((parsed as { projects?: unknown }).projects)
      ? (parsed as { projects: unknown[] }).projects
      : Array.isArray(parsed)
        ? parsed
        : [];
    return entries
      .map(normalizeRecentProjectEntry)
      .filter((entry): entry is RecentProjectIndexEntry => Boolean(entry))
      .sort(compareRecentProjectEntries);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeRecentProjectEntries(indexFilePath: string, projects: RecentProjectIndexEntry[]): Promise<void> {
  await mkdir(dirname(indexFilePath), { recursive: true });
  await writeFile(indexFilePath, `${JSON.stringify({ projects }, null, 2)}\n`, "utf8");
}

const recentProjectIndexQueues = new Map<string, Promise<unknown>>();

async function withRecentProjectIndexQueue<T>(indexFilePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = recentProjectIndexQueues.get(indexFilePath) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  const queued = next.catch(() => undefined);
  recentProjectIndexQueues.set(indexFilePath, queued);
  try {
    return await next;
  } finally {
    if (recentProjectIndexQueues.get(indexFilePath) === queued) {
      recentProjectIndexQueues.delete(indexFilePath);
    }
  }
}

export async function projectWorkspaceExists(projectDirectory: string): Promise<boolean> {
  try {
    const paths = resolveProjectWorkspacePaths(projectDirectory);
    const databaseStat = await stat(paths.databasePath);
    return databaseStat.isFile();
  } catch (error) {
    if (isErrorWithCode(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return false;
    }
    throw error;
  }
}

class ProjectDirectoryDeleteSafetyError extends Error {
  readonly code = "PROJECT_INPUT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "ProjectDirectoryDeleteSafetyError";
  }
}

export async function deleteLocalProjectDirectory(projectDirectory: string): Promise<void> {
  const resolvedProjectDirectory = await realpath(projectDirectory);
  const resolvedRoot = await realpath(dirname(projectDirectory));
  if (!basename(resolvedProjectDirectory).endsWith(".vnmaker")) {
    throw new ProjectDirectoryDeleteSafetyError("프로젝트 폴더명은 .vnmaker로 끝나야 삭제할 수 있습니다.");
  }
  if (!resolvedProjectDirectory.startsWith(`${resolvedRoot}${sep}`)) {
    throw new ProjectDirectoryDeleteSafetyError("프로젝트 폴더 경계가 안전하지 않아 삭제할 수 없습니다.");
  }
  if (resolvedProjectDirectory === resolvedRoot || resolvedProjectDirectory === homedir() || resolvedProjectDirectory === sep) {
    throw new ProjectDirectoryDeleteSafetyError("프로젝트 루트가 아닌 위치는 삭제할 수 없습니다.");
  }
  if (!existsSync(join(resolvedProjectDirectory, "project.sqlite"))) {
    throw new ProjectDirectoryDeleteSafetyError("프로젝트 데이터베이스가 있는 폴더만 삭제할 수 있습니다.");
  }
  await rm(resolvedProjectDirectory, { recursive: true, force: false });
}

export class RecentProjectIndexStore {
  private readonly indexFilePath: string;
  private readonly clock: () => Date;

  constructor(options: RecentProjectIndexStoreOptions = {}) {
    this.indexFilePath = resolve(options.indexFilePath || getDefaultRecentProjectIndexPath());
    this.clock = options.clock || (() => new Date());
  }

  private now(): string {
    return this.clock().toISOString();
  }

  private async readEntries(): Promise<RecentProjectIndexEntry[]> {
    return readRecentProjectEntries(this.indexFilePath);
  }

  private async writeEntries(projects: RecentProjectIndexEntry[]): Promise<void> {
    await writeRecentProjectEntries(this.indexFilePath, projects);
  }

  async listProjects(): Promise<RecentProjectIndexEntry[]> {
    return withRecentProjectIndexQueue(this.indexFilePath, async () => {
      const entries = await this.readEntries();
      const refreshed = sortRecentProjectEntries(await Promise.all(entries.map(async (entry) => ({
        ...entry,
        missing: !(await projectWorkspaceExists(entry.projectDirectory))
      }))));
      if (JSON.stringify(entries) !== JSON.stringify(refreshed)) {
        await this.writeEntries(refreshed);
      }
      return refreshed;
    });
  }

  async findProject(projectId: string): Promise<RecentProjectIndexEntry | null> {
    return (await this.listProjects()).find((entry) => entry.projectId === projectId) || null;
  }

  async upsertProject(input: UpsertRecentProjectInput): Promise<RecentProjectIndexEntry[]> {
    return withRecentProjectIndexQueue(this.indexFilePath, async () => {
      const entries = await this.readEntries();
      const previous = entries.find((entry) => entry.projectId === input.projectId);
      const now = this.now();
      const entry: RecentProjectIndexEntry = {
        projectId: input.projectId,
        projectDirectory: resolveProjectWorkspacePaths(input.projectDirectory).projectDirectory,
        title: input.title,
        lastOpenedAt: now,
        lastValidatedAt: input.lastValidatedAt || (input.validationState ? now : previous?.lastValidatedAt),
        validationState: input.validationState || previous?.validationState || "unchecked",
        missing: false
      };
      const nextEntries = [
        entry,
        ...entries.filter((item) => item.projectId !== input.projectId)
      ].sort(compareRecentProjectEntries);
      await this.writeEntries(nextEntries);
      return nextEntries;
    });
  }

  async restoreProject(entry: RecentProjectIndexEntry): Promise<RecentProjectIndexEntry[]> {
    return withRecentProjectIndexQueue(this.indexFilePath, async () => {
      const normalized = normalizeRecentProjectEntry(entry);
      if (!normalized) {
        return this.readEntries();
      }
      const entries = await this.readEntries();
      const nextEntries = sortRecentProjectEntries([
        normalized,
        ...entries.filter((item) => item.projectId !== normalized.projectId)
      ]);
      await this.writeEntries(nextEntries);
      return nextEntries;
    });
  }

  async markProjectMissing(projectId: string, missing = true): Promise<RecentProjectIndexEntry[]> {
    return withRecentProjectIndexQueue(this.indexFilePath, async () => {
      const entries = await this.readEntries();
      const nextEntries = entries.map((entry) => entry.projectId === projectId ? { ...entry, missing } : entry);
      await this.writeEntries(nextEntries);
      return nextEntries;
    });
  }

  async removeProject(projectId: string): Promise<RecentProjectIndexEntry[]> {
    return withRecentProjectIndexQueue(this.indexFilePath, async () => {
      const entries = await this.readEntries();
      const nextEntries = entries.filter((entry) => entry.projectId !== projectId);
      await this.writeEntries(nextEntries);
      return nextEntries;
    });
  }
}

function applyMigrations(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.exec(`
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`);

  const hasMigration = db.prepare("SELECT 1 FROM migrations WHERE id = ?").pluck();
  const insertMigration = db.prepare("INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)");

  for (const migration of migrations) {
    if (hasMigration.get(migration.id)) {
      continue;
    }

    const runMigration = db.transaction(() => {
      for (const statement of statementList(migration.sql)) {
        if (shouldSkipMigrationStatement(db, statement)) {
          continue;
        }
        db.prepare(statement).run();
      }
      insertMigration.run(migration.id, migration.name, nowIso());
    });
    runMigration();
  }
}

async function fileMetadata(projectDirectory: string, input: StoreGenerationResultInput): Promise<StoredGenerationAssetMetadata> {
  const promptHash = hashText(input.job.prompt);
  const metadata: StoredGenerationAssetMetadata = {
    promptHash,
    adapter: input.adapter || input.job.provider
  };

  if (input.image?.filePath) {
    const absoluteFilePath = isAbsolute(input.image.filePath) ? input.image.filePath : resolve(input.image.filePath);
    const [source, sourceStat] = await Promise.all([readFile(absoluteFilePath), stat(absoluteFilePath)]);
    metadata.relativePath = relative(projectDirectory, absoluteFilePath);
    metadata.hash = createHash("sha256").update(source).digest("hex");
    metadata.mimeType = input.image.mimeType;
    metadata.byteSize = sourceStat.size;
    return metadata;
  }

  if (input.image?.b64Json) {
    const payload = Buffer.from(input.image.b64Json, "base64");
    metadata.hash = createHash("sha256").update(payload).digest("hex");
    metadata.mimeType = input.image.mimeType;
    metadata.byteSize = payload.byteLength;
  }

  return metadata;
}

export class ProjectStore {
  readonly paths: ProjectWorkspacePaths;
  private readonly db: Database.Database;

  constructor(paths: ProjectWorkspacePaths) {
    this.paths = paths;
    this.db = new Database(paths.databasePath);
    applyMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }

  runInTransaction<T>(operation: () => T): T {
    return this.db.transaction(operation)();
  }

  getProject(): VnMakerProject | null {
    const project = this.db.prepare("SELECT id, version, title, premise, updated_at FROM projects ORDER BY updated_at DESC LIMIT 1").get() as ProjectRow | undefined;
    if (!project) {
      return null;
    }

    const settings = this.db.prepare(`
SELECT default_route_id, output_file_name, language
FROM project_settings
WHERE project_id = ?
`).get(project.id) as SettingsRow | undefined;

    const characters = this.db.prepare(`
SELECT id, display_name, role, profile, emotion_tags_json, portrait_asset_ids_json,
  expression_asset_ids_json, description, personality, speech_style, appearance,
  default_portrait_asset_id, source_heroine_id, source_heroine_name, source_snapshot_created_at, position
FROM characters
WHERE project_id = ?
ORDER BY position ASC, id ASC
`).all(project.id) as CharacterRow[];

    const routes = this.db.prepare(`
SELECT id, title, heroine_id, summary, entry_scene_id, endings_json, position
FROM routes
WHERE project_id = ?
ORDER BY position ASC, id ASC
`).all(project.id) as RouteRow[];

    const scenes = this.db.prepare(`
SELECT id, label, speaker, text, background_asset_id, cg_asset_id, characters_json, choices_json, next_scene_id, ending_json, condition_json, memory_tags_json, position
FROM scenes
WHERE project_id = ?
ORDER BY position ASC, id ASC
`).all(project.id) as SceneRow[];

    const assets = this.db.prepare(`
SELECT id, kind, label, uri, source, generation_job_id, provenance_json, relative_path, hash, mime_type, byte_size, prompt_hash, adapter, position
FROM assets
WHERE project_id = ?
ORDER BY position ASC, id ASC
`).all(project.id) as AssetRow[];

    const generationJobs = this.db.prepare(`
SELECT id, kind, target_id, prompt, style, provider, status, output_asset_id, failure_message, dummy, fallback_reason, pack_version, source_generated_by, prompt_hash, adapter, position
FROM generation_jobs
WHERE project_id = ?
ORDER BY position ASC, id ASC
`).all(project.id) as GenerationJobRow[];

    return {
      version: project.version as VnMakerProject["version"],
      id: project.id,
      title: project.title,
      premise: project.premise,
      characters: characters.map((row): VnMakerCharacter => ({
        id: row.id,
        displayName: row.display_name,
        role: row.role,
        profile: row.profile,
        emotionTags: parseJson<string[]>(row.emotion_tags_json, []),
        portraitAssetIds: parseJson<string[]>(row.portrait_asset_ids_json, []),
        expressionAssetIds: parseJson<Record<string, string>>(row.expression_asset_ids_json, {}),
        description: row.description || undefined,
        personality: row.personality || undefined,
        speechStyle: row.speech_style || undefined,
        appearance: row.appearance || undefined,
        defaultPortraitAssetId: row.default_portrait_asset_id || undefined,
        sourceHeroineId: row.source_heroine_id || undefined,
        sourceHeroineName: row.source_heroine_name || undefined,
        sourceSnapshotCreatedAt: row.source_snapshot_created_at || undefined
      })),
      routes: routes.map((row): VnMakerRoute => ({
        id: row.id,
        title: row.title,
        heroineId: row.heroine_id,
        summary: row.summary,
        entrySceneId: row.entry_scene_id,
        endings: parseJson<VnMakerRoute["endings"]>(row.endings_json, [])
      })),
      scenes: scenes.map((row): VnMakerScene => ({
        id: row.id,
        label: row.label,
        speaker: row.speaker,
        text: row.text,
        backgroundAssetId: row.background_asset_id || undefined,
        cgAssetId: row.cg_asset_id || undefined,
        characters: parseJson<VnMakerScene["characters"]>(row.characters_json, []),
        choices: parseJson<VnMakerScene["choices"]>(row.choices_json, []),
        next: row.next_scene_id || undefined,
        ending: parseJson<VnMakerScene["ending"] | undefined>(row.ending_json, undefined),
        condition: parseJson<VnMakerScene["condition"] | undefined>(row.condition_json, undefined),
        memoryTags: parseJson<VnMakerScene["memoryTags"] | undefined>(row.memory_tags_json, undefined)
      })),
      assets: assets.map((row): VnMakerAsset => ({
        id: row.id,
        kind: row.kind,
        label: row.label,
        uri: row.uri || undefined,
        source: row.source || undefined,
        generationJobId: row.generation_job_id || undefined,
        provenance: parseJson<VnMakerAsset["provenance"] | undefined>(row.provenance_json, undefined)
      })),
      generationJobs: generationJobs.map((row): VnMakerGenerationJob => ({
        id: row.id,
        kind: row.kind,
        targetId: row.target_id,
        prompt: row.prompt,
        style: row.style || undefined,
        provider: row.provider,
        status: row.status,
        outputAssetId: row.output_asset_id || undefined,
        failureMessage: row.failure_message || undefined,
        dummy: row.dummy === null ? undefined : Boolean(row.dummy),
        fallbackReason: row.fallback_reason || undefined,
        packVersion: row.pack_version || undefined,
        sourceGeneratedBy: row.source_generated_by || undefined
      })),
      settings: {
        defaultRouteId: settings?.default_route_id || "",
        outputFileName: settings?.output_file_name || "vn-maker-build.html",
        language: settings?.language || "ko"
      }
    };
  }

  requireProject(): VnMakerProject {
    const project = this.getProject();
    if (!project) {
      throw new Error("프로젝트 저장소가 비어 있습니다. 먼저 프로젝트를 생성하거나 가져와야 합니다.");
    }
    return project;
  }

  getProjectRevision(): ProjectRevisionDto {
    const project = this.requireProject();
    const row = this.db.prepare("SELECT updated_at FROM projects WHERE id = ?").get(project.id) as { updated_at: string } | undefined;
    return createProjectRevision(project, row?.updated_at || nowIso());
  }

  listHeroines(): HeroineProfile[] {
    const rows = this.db.prepare(`
SELECT id, name, description, personality, speech_style, appearance, default_portrait_asset_id,
  portrait_asset_ids_json, expression_asset_ids_json, tags_json, reuse_history_json, position, created_at, updated_at
FROM heroine_library
ORDER BY position ASC, id ASC
`).all() as HeroineRow[];
    return rows.map(heroineFromRow);
  }

  listHeroineEntries(): StoredHeroineProfile[] {
    const rows = this.db.prepare(`
SELECT id, name, description, personality, speech_style, appearance, default_portrait_asset_id,
  portrait_asset_ids_json, expression_asset_ids_json, tags_json, reuse_history_json, position, created_at, updated_at
FROM heroine_library
ORDER BY updated_at DESC, name ASC, id ASC
`).all() as HeroineRow[];
    return rows.map(storedHeroineFromRow);
  }

  getHeroine(heroineId: string): StoredHeroineProfile | null {
    const row = this.db.prepare(`
SELECT id, name, description, personality, speech_style, appearance, default_portrait_asset_id,
  portrait_asset_ids_json, expression_asset_ids_json, tags_json, reuse_history_json, position, created_at, updated_at
FROM heroine_library
WHERE id = ?
`).get(heroineId) as HeroineRow | undefined;
    return row ? storedHeroineFromRow(row) : null;
  }

  saveHeroine(heroine: HeroineProfile): StoredHeroineProfile {
    const now = nowIso();
    const position = this.listHeroines().findIndex((item) => item.id === heroine.id);
    const nextPosition = position >= 0 ? position : this.listHeroines().length;
    this.db.prepare(`
INSERT INTO heroine_library (
  id, name, description, personality, speech_style, appearance,
  default_portrait_asset_id, portrait_asset_ids_json, expression_asset_ids_json,
  tags_json, reuse_history_json, position, created_at, updated_at
)
VALUES (
  @id, @name, @description, @personality, @speechStyle, @appearance,
  @defaultPortraitAssetId, @portraitAssetIdsJson, @expressionAssetIdsJson,
  @tagsJson, @reuseHistoryJson, @position, @now, @now
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  personality = excluded.personality,
  speech_style = excluded.speech_style,
  appearance = excluded.appearance,
  default_portrait_asset_id = excluded.default_portrait_asset_id,
  portrait_asset_ids_json = excluded.portrait_asset_ids_json,
  expression_asset_ids_json = excluded.expression_asset_ids_json,
  tags_json = excluded.tags_json,
  reuse_history_json = excluded.reuse_history_json,
  position = excluded.position,
  updated_at = excluded.updated_at
`).run({
      id: heroine.id,
      name: heroine.name,
      description: heroine.description,
      personality: heroine.personality,
      speechStyle: heroine.speechStyle,
      appearance: heroine.appearance,
      defaultPortraitAssetId: heroine.defaultPortraitAssetId || null,
      portraitAssetIdsJson: json(heroine.portraitAssetIds),
      expressionAssetIdsJson: json(heroine.expressionAssetIds),
      tagsJson: json(heroine.tags),
      reuseHistoryJson: json(heroine.reuseHistory),
      position: nextPosition,
      now
    });
    return this.getHeroine(heroine.id) || {
      ...heroine,
      createdAt: now,
      updatedAt: now
    };
  }

  recordHeroineReuse(heroineId: string, project: VnMakerProject, projectDirectory = this.paths.projectDirectory): HeroineProfile | null {
    const heroine = this.listHeroines().find((item) => item.id === heroineId);
    if (!heroine) {
      return null;
    }
    const snapshot = project.characters.find((character) => character.sourceHeroineId === heroineId || character.id === heroineId);
    const record: HeroineReuseRecord = {
      projectId: project.id,
      projectTitle: project.title,
      projectDirectory,
      snapshotCharacterId: snapshot?.id || heroineId,
      snapshotCreatedAt: snapshot?.sourceSnapshotCreatedAt || new Date().toISOString()
    };
    const reuseHistory = [
      record,
      ...heroine.reuseHistory.filter((item) => item.projectId !== record.projectId)
    ];
    return this.saveHeroine({ ...heroine, reuseHistory });
  }

  deleteHeroine(heroineId: string): boolean {
    const result = this.db.prepare("DELETE FROM heroine_library WHERE id = ?").run(heroineId);
    return result.changes > 0;
  }

  saveStagedPortrait(input: StoreStagedPortraitInput): StoredStagedPortrait {
    const project = this.requireProject();
    const now = nowIso();
    this.db.prepare(`
INSERT INTO staged_portraits (project_id, id, asset_id, heroine_id, expires_at, consumed_at, created_at)
VALUES (@projectId, @id, @assetId, @heroineId, @expiresAt, NULL, @now)
ON CONFLICT(project_id, id) DO UPDATE SET
  asset_id = excluded.asset_id,
  heroine_id = excluded.heroine_id,
  expires_at = excluded.expires_at,
  consumed_at = NULL
`).run({
      projectId: project.id,
      id: input.id,
      assetId: input.assetId,
      heroineId: input.heroineId || null,
      expiresAt: input.expiresAt,
      now
    });
    const staged = this.getStagedPortrait(input.id);
    if (!staged) {
      throw new Error(`staged portrait 저장에 실패했습니다: ${input.id}`);
    }
    return staged;
  }

  getStagedPortrait(stagedPortraitId: string): StoredStagedPortrait | null {
    const project = this.requireProject();
    const row = this.db.prepare(`
SELECT id, asset_id, heroine_id, expires_at, consumed_at, created_at
FROM staged_portraits
WHERE project_id = ? AND id = ?
`).get(project.id, stagedPortraitId) as StagedPortraitRow | undefined;
    return row ? stagedPortraitFromRow(row) : null;
  }

  consumeStagedPortrait(stagedPortraitId: string): boolean {
    const project = this.requireProject();
    const result = this.db.prepare(`
UPDATE staged_portraits
SET consumed_at = @now
WHERE project_id = @projectId AND id = @id AND consumed_at IS NULL
`).run({
      projectId: project.id,
      id: stagedPortraitId,
      now: nowIso()
    });
    return result.changes > 0;
  }

  saveProject(project: VnMakerProject): VnMakerProject {
    return this.runInTransaction(() => this.writeProject(project));
  }

  private writeProject(project: VnMakerProject): VnMakerProject {
    project = applySingleBackgroundScenePolicy(project);
    assertProjectSnapshot(project);

    const now = nowIso();
    const previousProject = this.db.prepare("SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1").get() as { id: string } | undefined;
    const preservedAssets = this.readAssetMetadata(project.id);
    const preservedJobs = this.readGenerationJobMetadata(project.id);

    if (previousProject && previousProject.id !== project.id) {
      this.db.prepare("DELETE FROM projects WHERE id = ?").run(previousProject.id);
    }

    this.db.prepare(`
INSERT INTO projects (id, version, title, premise, created_at, updated_at)
VALUES (@id, @version, @title, @premise, @now, @now)
ON CONFLICT(id) DO UPDATE SET
  version = excluded.version,
  title = excluded.title,
  premise = excluded.premise,
  updated_at = excluded.updated_at
`).run({ ...project, now });

    this.db.prepare(`
INSERT INTO project_settings (project_id, default_route_id, output_file_name, language)
VALUES (@projectId, @defaultRouteId, @outputFileName, @language)
ON CONFLICT(project_id) DO UPDATE SET
  default_route_id = excluded.default_route_id,
  output_file_name = excluded.output_file_name,
  language = excluded.language
`).run({
        projectId: project.id,
        defaultRouteId: project.settings.defaultRouteId,
        outputFileName: project.settings.outputFileName,
        language: project.settings.language
      });

      this.db.prepare("DELETE FROM characters WHERE project_id = ?").run(project.id);
      this.db.prepare("DELETE FROM routes WHERE project_id = ?").run(project.id);
      this.db.prepare("DELETE FROM scenes WHERE project_id = ?").run(project.id);
      this.db.prepare("DELETE FROM assets WHERE project_id = ?").run(project.id);
      this.db.prepare("DELETE FROM generation_jobs WHERE project_id = ?").run(project.id);

      const insertCharacter = this.db.prepare(`
INSERT INTO characters (
  project_id, id, display_name, role, profile, emotion_tags_json, portrait_asset_ids_json,
  expression_asset_ids_json, description, personality, speech_style, appearance,
  default_portrait_asset_id, source_heroine_id, source_heroine_name, source_snapshot_created_at,
  position
)
VALUES (
  @projectId, @id, @displayName, @role, @profile, @emotionTagsJson, @portraitAssetIdsJson,
  @expressionAssetIdsJson, @description, @personality, @speechStyle, @appearance,
  @defaultPortraitAssetId, @sourceHeroineId, @sourceHeroineName, @sourceSnapshotCreatedAt,
  @position
)
`);
      project.characters.forEach((character, position) => insertCharacter.run({
        projectId: project.id,
        id: character.id,
        displayName: character.displayName,
        role: character.role,
        profile: character.profile,
        emotionTagsJson: json(character.emotionTags),
        portraitAssetIdsJson: json(character.portraitAssetIds),
        expressionAssetIdsJson: json(character.expressionAssetIds || {}),
        description: character.description || null,
        personality: character.personality || null,
        speechStyle: character.speechStyle || null,
        appearance: character.appearance || null,
        defaultPortraitAssetId: character.defaultPortraitAssetId || null,
        sourceHeroineId: character.sourceHeroineId || null,
        sourceHeroineName: character.sourceHeroineName || null,
        sourceSnapshotCreatedAt: character.sourceSnapshotCreatedAt || null,
        position
      }));

      const insertRoute = this.db.prepare(`
INSERT INTO routes (project_id, id, title, heroine_id, summary, entry_scene_id, endings_json, position)
VALUES (@projectId, @id, @title, @heroineId, @summary, @entrySceneId, @endingsJson, @position)
`);
      project.routes.forEach((route, position) => insertRoute.run({
        projectId: project.id,
        id: route.id,
        title: route.title,
        heroineId: route.heroineId,
        summary: route.summary,
        entrySceneId: route.entrySceneId,
        endingsJson: json(route.endings),
        position
      }));

      const insertScene = this.db.prepare(`
INSERT INTO scenes (
  project_id, id, label, speaker, text, background_asset_id, cg_asset_id,
  characters_json, choices_json, next_scene_id, ending_json, condition_json, memory_tags_json, position
)
VALUES (
  @projectId, @id, @label, @speaker, @text, @backgroundAssetId, @cgAssetId,
  @charactersJson, @choicesJson, @nextSceneId, @endingJson, @conditionJson, @memoryTagsJson, @position
)
`);
      project.scenes.forEach((scene, position) => insertScene.run({
        projectId: project.id,
        id: scene.id,
        label: scene.label,
        speaker: scene.speaker,
        text: scene.text,
        backgroundAssetId: normalizeNullable(scene.backgroundAssetId),
        cgAssetId: normalizeNullable(scene.cgAssetId),
        charactersJson: json(scene.characters),
        choicesJson: json(scene.choices),
        nextSceneId: normalizeNullable(scene.next),
        endingJson: scene.ending ? json(scene.ending) : null,
        conditionJson: scene.condition ? json(scene.condition) : null,
        memoryTagsJson: scene.memoryTags ? json(scene.memoryTags) : null,
        position
      }));

      const insertAsset = this.db.prepare(`
INSERT INTO assets (
  project_id, id, kind, label, uri, source, generation_job_id, provenance_json, relative_path,
  hash, mime_type, byte_size, prompt_hash, adapter, position, created_at, updated_at
)
VALUES (
  @projectId, @id, @kind, @label, @uri, @source, @generationJobId, @provenanceJson, @relativePath,
  @hash, @mimeType, @byteSize, @promptHash, @adapter, @position, @now, @now
)
`);
      project.assets.forEach((asset, position) => {
        const preserved = preservedAssets.get(asset.id);
        insertAsset.run({
          projectId: project.id,
          id: asset.id,
          kind: asset.kind,
          label: asset.label,
          uri: normalizeNullable(asset.uri),
          source: normalizeNullable(asset.source),
          generationJobId: normalizeNullable(asset.generationJobId),
          provenanceJson: asset.provenance ? json(asset.provenance) : null,
          relativePath: preserved?.relative_path || null,
          hash: preserved?.hash || null,
          mimeType: preserved?.mime_type || null,
          byteSize: preserved?.byte_size || null,
          promptHash: preserved?.prompt_hash || null,
          adapter: preserved?.adapter || null,
          position,
          now
        });
      });

      const insertJob = this.db.prepare(`
INSERT INTO generation_jobs (
  project_id, id, kind, target_id, prompt, style, provider, status,
  output_asset_id, failure_message, dummy, fallback_reason, pack_version, source_generated_by, prompt_hash, adapter, position, created_at, updated_at
)
VALUES (
  @projectId, @id, @kind, @targetId, @prompt, @style, @provider, @status,
  @outputAssetId, @failureMessage, @dummy, @fallbackReason, @packVersion, @sourceGeneratedBy, @promptHash, @adapter, @position, @now, @now
)
`);
      project.generationJobs.forEach((job, position) => {
        const preserved = preservedJobs.get(job.id);
        insertJob.run({
          projectId: project.id,
          id: job.id,
          kind: job.kind,
          targetId: job.targetId,
          prompt: job.prompt,
          style: normalizeNullable(job.style),
          provider: job.provider,
          status: job.status,
          outputAssetId: normalizeNullable(job.outputAssetId),
          failureMessage: normalizeNullable(job.failureMessage),
          dummy: job.dummy === undefined ? null : job.dummy ? 1 : 0,
          fallbackReason: normalizeNullable(job.fallbackReason),
          packVersion: normalizeNullable(job.packVersion),
          sourceGeneratedBy: normalizeNullable(job.sourceGeneratedBy),
          promptHash: preserved?.prompt_hash || hashText(job.prompt),
          adapter: preserved?.adapter || job.provider,
          position,
          now
        });
      });

    return this.requireProject();
  }

  upsertCharacter(character: VnMakerCharacter): VnMakerProject {
    return this.saveProject(upsertProjectCharacter(this.requireProject(), character));
  }

  upsertScene(scene: VnMakerScene): VnMakerProject {
    return this.saveProject(upsertProjectScene(this.requireProject(), scene));
  }

  private assertExpectedProjectRevision(expectedProjectRevision: ProjectRevisionInput): ProjectRevisionDto {
    const previousRevision = this.getProjectRevision();
    const expectedRevision = revisionValue(expectedProjectRevision);
    if (expectedRevision !== previousRevision.revision) {
      throw new StaleProjectRevisionError({
        expectedRevision,
        actualRevision: previousRevision
      });
    }
    return previousRevision;
  }

  applyProjectMutation(input: {
    expectedProjectRevision: ProjectRevisionInput;
    mutate: (project: VnMakerProject) => VnMakerProject;
  }): TransactionalProjectMutationResult {
    return this.runInTransaction(() => {
      const currentProject = this.requireProject();
      const previousRevision = this.assertExpectedProjectRevision(input.expectedProjectRevision);

      const nextProject = input.mutate(JSON.parse(JSON.stringify(currentProject)) as VnMakerProject);
      const savedProject = this.writeProject(nextProject);
      const validation = this.validateAndStoreCurrentProject();
      return {
        project: savedProject,
        validation,
        previousRevision,
        projectRevision: this.getProjectRevision()
      };
    });
  }

  applyRepairMutation(input: ApplyRepairMutationInput): ApplyRepairMutationResult {
    return this.runInTransaction(() => {
      const currentProject = this.requireProject();
      const previousRevision = this.assertExpectedProjectRevision(input.expectedProjectRevision);
      const nextProject = input.mutate(JSON.parse(JSON.stringify(currentProject)) as VnMakerProject);
      const savedProject = this.writeProject(nextProject);
      const validation = this.validateAndStoreCurrentProject();
      const projectRevision = this.getProjectRevision();
      const repairHistoryEntry = this.recordPatchHistory({
        status: "applied",
        summary: input.summary,
        rawOutput: input.rawOutput ? input.rawOutput(projectRevision) : undefined,
        validation,
        diff: input.diff,
        beforeProject: currentProject,
        afterProject: savedProject
      });
      return {
        project: savedProject,
        validation,
        previousRevision,
        projectRevision,
        repairHistoryEntry
      };
    });
  }

  async storeGenerationResult(input: StoreGenerationResultInput): Promise<VnMakerProject> {
    const project = this.requireProject();
    const metadata = await fileMetadata(this.paths.projectDirectory, input);
    const saved = this.saveProject(applyGenerationPolicy(project, input));
    this.writeAssetMetadata(project.id, input.asset.id, metadata);
    this.writeGenerationJobMetadata(project.id, input.job.id, metadata);
    return saved;
  }

  markGenerationJobStatus(jobId: string, status: VnMakerGenerationJob["status"], failureMessage?: string): VnMakerProject {
    return this.saveProject(updateGenerationJobStatus(this.requireProject(), jobId, status, failureMessage));
  }

  validateAndStore(): ProjectValidationResult {
    return this.runInTransaction(() => this.validateAndStoreCurrentProject());
  }

  private validateAndStoreCurrentProject(): ProjectValidationResult {
    const project = this.requireProject();
    const issues = validateProject(project);
    this.writeValidationIssues(project.id, issues);
    return {
      ok: issues.every((issue) => issue.severity !== "error"),
      issues
    };
  }

  applyEventExpansionPlan(input: ApplyEventExpansionInput): ApplyEventExpansionResult {
    const outcome = this.runInTransaction<ApplyEventExpansionResult | { error: Error }>(() => {
      const project = this.requireProject();
      const previousRevision = this.assertExpectedProjectRevision(input.expectedProjectRevision);
      const sourcePatchHistoryEntry = input.sourcePatchHistoryId ? this.getPatchHistoryEntry(input.sourcePatchHistoryId) : null;
      if (input.sourcePatchHistoryId && !sourcePatchHistoryEntry) {
        throw new Error(`패치 제안 이력을 찾을 수 없습니다: ${input.sourcePatchHistoryId}`);
      }
      const patchValidation = validateEventExpansionPlan(project, input.request, input.plan);
      if (!patchValidation.ok || !patchValidation.appliedProject) {
        this.writeValidationIssues(project.id, patchValidation.issues);
        this.recordPatchHistory({
          status: "failed",
          summary: input.plan.summary || "패치 검증 실패",
          request: input.request,
          plan: input.plan,
          rawOutput: sourcePatchHistoryEntry?.rawOutput,
          attempts: sourcePatchHistoryEntry?.attempts,
          validation: patchValidation,
          diff: patchValidation.diff,
          beforeProject: project
        });
        return {
          error: patchValidation.issues.some((issue) => issue.path === "request.baseProjectHash")
            ? new StaleProjectRevisionError({
                expectedRevision: previousRevision.revision,
                actualRevision: previousRevision
              })
            : new Error(`패치 검증 실패: ${patchValidation.issues.map((issue) => issue.message).join(", ")}`)
        };
      }

      const savedProject = this.writeProject(patchValidation.appliedProject);
      const validation = this.validateAndStoreCurrentProject();
      const patchHistoryEntry = this.recordPatchHistory({
        status: "applied",
        summary: input.plan.summary,
        request: input.request,
        plan: input.plan,
        rawOutput: sourcePatchHistoryEntry?.rawOutput,
        attempts: sourcePatchHistoryEntry?.attempts,
        validation,
        diff: patchValidation.diff,
        beforeProject: project,
        afterProject: savedProject
      });
      return {
        project: savedProject,
        validation,
        diff: patchValidation.diff,
        patchHistoryEntry,
        previousRevision,
        projectRevision: this.getProjectRevision()
      };
    });
    if ("error" in outcome) {
      throw outcome.error;
    }
    return outcome;
  }

  previewProject(startSceneId?: string): PlayerRuntimeData {
    return createPlayerRuntimeData(this.requireProject(), { startSceneId });
  }

  async exportWebPlayer(outputDirectory?: string): Promise<{ export: WebExportResult; smoke: WebExportSmokeTestResult }> {
    const project = this.requireProject();
    const validation = this.validateAndStore();
    if (!validation.ok) {
      throw new Error(`검증 실패 프로젝트는 export할 수 없습니다: ${validation.issues.map((issue) => issue.message).join(", ")}`);
    }

    const exportDirectory = outputDirectory
      ? resolve(outputDirectory)
      : join(this.paths.exportsDirectory, `${project.id}-web`);
    const assetPathRewrites = await this.copyExportAssets(exportDirectory);
    const runtime = createPlayerRuntimeData(project, { assetPathRewrites });
    const artifact = buildProjectHtml(project, {
      projectDataPath: "./project-data.json",
      runtimeScriptPath: "./runtime/player.js",
      assetPathRewrites
    });
    const indexPath = join(exportDirectory, "index.html");
    const projectDataPath = join(exportDirectory, "project-data.json");
    const runtimeScriptPath = join(exportDirectory, "runtime", "player.js");

    await mkdir(dirname(runtimeScriptPath), { recursive: true });
    await writeFile(indexPath, artifact.html, "utf8");
    await writeFile(projectDataPath, JSON.stringify(runtime, null, 2), "utf8");
    await writeFile(runtimeScriptPath, buildPlayerRuntimeScript(), "utf8");

    const exportResult: WebExportResult = {
      outputDirectory: exportDirectory,
      indexPath,
      projectDataPath,
      runtimeScriptPath,
      assetPathRewrites
    };
    return {
      export: exportResult,
      smoke: await smokeTestWebExport(exportDirectory)
    };
  }

  readValidationIssues(): ValidationIssue[] {
    const project = this.requireProject();
    const rows = this.db.prepare(`
SELECT severity, path, message, code, domain, scene_ids_json, choice_ids_json, target_scene_id
FROM validation_issues
WHERE project_id = ?
ORDER BY id ASC
`).all(project.id) as ValidationIssueRow[];
    return rows.map(validationIssueFromRow);
  }

  listPatchHistory(): PatchHistoryEntry[] {
    const project = this.requireProject();
    const rows = this.db.prepare(`
SELECT id, status, summary, request_json, plan_json, raw_output_json, attempts_json,
  validation_issues_json, diff_json, before_project_json, after_project_json,
  created_at, reverted_at
FROM patch_history
WHERE project_id = ?
ORDER BY created_at DESC, id DESC
`).all(project.id) as PatchHistoryRow[];
    return rows.map(patchHistoryEntryFromRow);
  }

  getPatchHistoryEntry(patchHistoryId: string): PatchHistoryEntry | null {
    const project = this.requireProject();
    const row = this.db.prepare(`
SELECT id, status, summary, request_json, plan_json, raw_output_json, attempts_json,
  validation_issues_json, diff_json, before_project_json, after_project_json,
  created_at, reverted_at
FROM patch_history
WHERE project_id = ? AND id = ?
`).get(project.id, patchHistoryId) as PatchHistoryRow | undefined;
    return row ? patchHistoryEntryFromRow(row) : null;
  }

  recordPatchHistory(input: RecordPatchHistoryInput): PatchHistoryEntry {
    const project = this.requireProject();
    const createdAt = nowIso();
    const id = `patch-${createdAt.replace(/[^0-9]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
    const validationIssues = input.validation?.issues || [];
    this.db.prepare(`
INSERT INTO patch_history (
  id, project_id, status, summary, request_json, plan_json, raw_output_json,
  attempts_json, validation_issues_json, diff_json, before_project_json,
  after_project_json, created_at, reverted_at
)
VALUES (
  @id, @projectId, @status, @summary, @requestJson, @planJson, @rawOutputJson,
  @attemptsJson, @validationIssuesJson, @diffJson, @beforeProjectJson,
  @afterProjectJson, @createdAt, NULL
)
`).run({
      id,
      projectId: project.id,
      status: input.status,
      summary: input.summary,
      requestJson: input.request ? json(input.request) : null,
      planJson: input.plan ? json(input.plan) : null,
      rawOutputJson: input.rawOutput === undefined ? null : json(input.rawOutput),
      attemptsJson: json(input.attempts || []),
      validationIssuesJson: json(validationIssues),
      diffJson: input.diff ? json(input.diff) : null,
      beforeProjectJson: input.beforeProject ? json(input.beforeProject) : null,
      afterProjectJson: input.afterProject ? json(input.afterProject) : null,
      createdAt
    });
    return this.listPatchHistory().find((entry) => entry.id === id)!;
  }

  undoPatchHistory(patchHistoryId: string): VnMakerProject {
    const project = this.requireProject();
    const row = this.db.prepare(`
SELECT id, status, summary, request_json, plan_json, raw_output_json, attempts_json,
  validation_issues_json, diff_json, before_project_json, after_project_json,
  created_at, reverted_at
FROM patch_history
WHERE project_id = ? AND id = ?
`).get(project.id, patchHistoryId) as PatchHistoryRow | undefined;
    if (!row) {
      throw new Error(`패치 이력을 찾을 수 없습니다: ${patchHistoryId}`);
    }
    if (row.status !== "applied" || !row.before_project_json) {
      throw new Error("적용된 패치만 되돌릴 수 있습니다.");
    }
    if (row.reverted_at) {
      throw new Error("이미 되돌린 패치입니다.");
    }

    const beforeProject = parseJson<VnMakerProject | null>(row.before_project_json, null);
    const afterProject = parseJson<VnMakerProject | null>(row.after_project_json, null);
    if (!beforeProject) {
      throw new Error("되돌릴 프로젝트 스냅샷이 없습니다.");
    }
    if (!afterProject) {
      throw new Error("패치 적용 직후 프로젝트 스냅샷이 없습니다.");
    }
    if (hashProjectSnapshot(project) !== hashProjectSnapshot(afterProject)) {
      throw new Error("현재 프로젝트가 패치 적용 직후 상태와 달라 되돌릴 수 없습니다.");
    }
    const saved = this.saveProject(beforeProject);
    this.db.prepare("UPDATE patch_history SET reverted_at = ? WHERE id = ?").run(nowIso(), patchHistoryId);
    return saved;
  }

  importProjectSnapshot(project: VnMakerProject): VnMakerProject {
    return this.saveProject(project);
  }

  exportProjectSnapshot(): VnMakerProject {
    return this.requireProject();
  }

  async backup(destinationPath: string): Promise<string> {
    await mkdir(dirname(destinationPath), { recursive: true });
    await this.db.backup(destinationPath);
    return destinationPath;
  }

  private async copyExportAssets(exportDirectory: string): Promise<Record<string, string>> {
    const project = this.requireProject();
    const metadata = this.readAssetMetadata(project.id);
    const rewrites: Record<string, string> = {};

    for (const asset of project.assets) {
      const row = metadata.get(asset.id);
      const sourceRelativePath = row?.relative_path;
      if (!sourceRelativePath) {
        continue;
      }

      const sourcePath = resolve(this.paths.projectDirectory, sourceRelativePath);
      const bucket = asset.source === "generated" ? "generated" : "source";
      const fileName = basename(sourcePath);
      const targetRelativePath = join("assets", bucket, fileName);
      const targetPath = join(exportDirectory, targetRelativePath);
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      rewrites[asset.id] = `./${targetRelativePath.replaceAll("\\", "/")}`;
    }

    return rewrites;
  }

  private writeValidationIssues(projectId: string, issues: ValidationIssue[]): void {
    const createdAt = nowIso();
    this.db.prepare("DELETE FROM validation_issues WHERE project_id = ?").run(projectId);
    const insertIssue = this.db.prepare(`
INSERT INTO validation_issues (
  project_id, severity, path, message, code, domain, scene_ids_json,
  choice_ids_json, target_scene_id, created_at
)
VALUES (
  @projectId, @severity, @path, @message, @code, @domain, @sceneIdsJson,
  @choiceIdsJson, @targetSceneId, @createdAt
)
`);
    issues.forEach((issue) => insertIssue.run({
      projectId,
      severity: issue.severity,
      path: issue.path,
      message: issue.message,
      code: issue.code || null,
      domain: issue.domain || null,
      sceneIdsJson: issue.sceneIds ? json(issue.sceneIds) : null,
      choiceIdsJson: issue.choiceIds ? json(issue.choiceIds) : null,
      targetSceneId: issue.targetSceneId || null,
      createdAt
    }));
  }

  private readAssetMetadata(projectId: string): Map<string, AssetRow> {
    const rows = this.db.prepare(`
SELECT id, kind, label, uri, source, generation_job_id, provenance_json, relative_path, hash, mime_type, byte_size, prompt_hash, adapter, position
FROM assets
WHERE project_id = ?
`).all(projectId) as AssetRow[];
    return new Map(rows.map((row) => [row.id, row]));
  }

  private readGenerationJobMetadata(projectId: string): Map<string, GenerationJobRow> {
    const rows = this.db.prepare(`
SELECT id, kind, target_id, prompt, style, provider, status, output_asset_id, failure_message, dummy, fallback_reason, pack_version, source_generated_by, prompt_hash, adapter, position
FROM generation_jobs
WHERE project_id = ?
`).all(projectId) as GenerationJobRow[];
    return new Map(rows.map((row) => [row.id, row]));
  }

  private writeAssetMetadata(projectId: string, assetId: string, metadata: StoredGenerationAssetMetadata): void {
    this.db.prepare(`
UPDATE assets
SET relative_path = @relativePath,
  hash = @hash,
  mime_type = @mimeType,
  byte_size = @byteSize,
  prompt_hash = @promptHash,
  adapter = @adapter,
  updated_at = @updatedAt
WHERE project_id = @projectId AND id = @assetId
`).run({
      projectId,
      assetId,
      relativePath: metadata.relativePath || null,
      hash: metadata.hash || null,
      mimeType: metadata.mimeType || null,
      byteSize: metadata.byteSize || null,
      promptHash: metadata.promptHash || null,
      adapter: metadata.adapter || null,
      updatedAt: nowIso()
    });
  }

  private writeGenerationJobMetadata(projectId: string, jobId: string, metadata: StoredGenerationAssetMetadata): void {
    this.db.prepare(`
UPDATE generation_jobs
SET prompt_hash = @promptHash,
  adapter = @adapter,
  updated_at = @updatedAt
WHERE project_id = @projectId AND id = @jobId
`).run({
      projectId,
      jobId,
      promptHash: metadata.promptHash || null,
      adapter: metadata.adapter || null,
      updatedAt: nowIso()
    });
  }
}

export async function smokeTestWebExport(outputDirectory: string): Promise<WebExportSmokeTestResult> {
  const checks = {
    indexHtml: false,
    runtimeScript: false,
    projectData: false,
    firstScene: false,
    portrait: false,
    choice: false,
    choiceNavigation: false,
    cg: false,
    branchEndingCoverage: false,
    endingMetadata: false
  };
  const issues: string[] = [];
  let reachableEndingIds: string[] = [];
  let uncoveredTerminalSceneIds: string[] = [];
  let cyclesWithoutEndingPath: string[][] = [];

  try {
    const [indexHtml, runtimeScript, projectDataRaw] = await Promise.all([
      readFile(join(outputDirectory, "index.html"), "utf8"),
      readFile(join(outputDirectory, "runtime", "player.js"), "utf8"),
      readFile(join(outputDirectory, "project-data.json"), "utf8")
    ]);
    checks.indexHtml = indexHtml.includes("vn-player");
    checks.runtimeScript = runtimeScript.includes("VN_MAKER_RUNTIME");
    checks.projectData = projectDataRaw.includes("startSceneId");

    const runtime = JSON.parse(projectDataRaw) as PlayerRuntimeData;
    const scenes = runtime.scenes || [];
    const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
    const firstScene = sceneMap.get(runtime.startSceneId);
    checks.firstScene = Boolean(firstScene);
    checks.portrait = Boolean(firstScene?.characters.some((character) => character.asset?.kind === "portrait" && character.asset.uri));

    for (const scene of scenes) {
      // The legacy smoke key is named cg, but Alpha exports are valid with a generated background-only visual pass.
      if (scene.cgAsset?.uri || scene.backgroundAsset?.uri) {
        checks.cg = true;
      }
      for (const choice of scene.choices) {
        checks.choice = true;
        if (sceneMap.has(choice.next)) {
          checks.choiceNavigation = true;
        }
      }
    }

    const routeId = runtime.routeId || "runtime-route";
    const routeGraphProject: VnMakerProject = {
      version: "vn-maker/v1",
      id: runtime.projectId || "runtime-project",
      title: runtime.title || "Runtime Project",
      premise: runtime.premise || "",
      characters: [],
      routes: [
        {
          id: routeId,
          title: "Runtime Route",
          heroineId: "",
          summary: "",
          entrySceneId: runtime.startSceneId,
          endings: []
        }
      ],
      scenes: scenes.map((scene) => ({
        id: scene.id,
        label: scene.label,
        speaker: scene.speaker,
        text: scene.text,
        characters: [],
        choices: scene.choices || [],
        next: scene.next,
        ending: scene.ending,
        backgroundAssetId: scene.backgroundAsset?.id,
        cgAssetId: scene.cgAsset?.id
      })),
      assets: runtime.assets || [],
      generationJobs: [],
      settings: {
        defaultRouteId: routeId,
        outputFileName: "index.html",
        language: "ko"
      }
    };
    const routeGraph = analyzeRouteGraph(routeGraphProject, routeId);
    reachableEndingIds = routeGraph.reachableEndingIds;
    uncoveredTerminalSceneIds = routeGraph.uncoveredTerminalSceneIds;
    cyclesWithoutEndingPath = routeGraph.cyclesWithoutEndingPath;
    const reachableEndingScenes = scenes.filter((scene) => routeGraph.reachableSceneIds.includes(scene.id) && scene.ending);
    checks.endingMetadata = reachableEndingScenes.length > 0 && reachableEndingScenes.every((scene) => Boolean(scene.ending?.id && scene.ending.title && scene.ending.kind));
    checks.branchEndingCoverage = checks.endingMetadata
      && reachableEndingIds.length > 0
      && uncoveredTerminalSceneIds.length === 0
      && cyclesWithoutEndingPath.length === 0
      && routeGraph.missingTargets.length === 0
      && routeGraph.issues.every((issue) => issue.severity !== "error");
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }

  Object.entries(checks).forEach(([name, ok]) => {
    if (!ok) {
      issues.push(`export smoke check failed: ${name}`);
    }
  });

  return {
    ok: issues.length === 0,
    checks,
    issues,
    reachableEndingIds,
    uncoveredTerminalSceneIds,
    cyclesWithoutEndingPath
  };
}

export async function openProjectStore(projectDirectory: string): Promise<ProjectStore> {
  const paths = resolveProjectWorkspacePaths(projectDirectory);
  await ensureProjectWorkspaceDirectories(paths);
  return new ProjectStore(paths);
}

export async function createProjectWorkspace(input: CreateProjectWorkspaceInput): Promise<ProjectStore> {
  const store = await openProjectStore(input.projectDirectory);
  const project = input.project || createStarterProject(input.starter);
  store.saveProject(project);
  store.validateAndStore();
  return store;
}
