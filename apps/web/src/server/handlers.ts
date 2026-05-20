import { Hono, type Context } from "hono";
import {
  buildProjectHtml,
  createAssetManifest,
  createEventExpansionRequest,
  createHeroineProfile,
  createImageGenerationJob,
  createProjectFromHeroine,
  createStarterProject,
  type EventExpansionPlan,
  type EventExpansionRequest,
  type CreateImageGenerationJobInput,
  type CreateStarterProjectInput,
  type HeroineProfile,
  type VnMakerCharacter,
  type VnMakerProject,
  type VnMakerScene
} from "@vn-maker/engine-core";
import {
  createProjectWorkspace,
  openProjectStore,
  resolveProjectWorkspacePaths,
  type ProjectStore
} from "@vn-maker/project-store";
import {
  expandNaturalLanguageEvent,
  sharedCodexAppServerClient,
  type CodexImageGenerationInput,
  type CodexLoginStartResult,
  type CodexSession,
  type EventTextGenerationAdapter,
  type GeneratedCodexImageAssetResult
} from "@vn-maker/generation-codex";
import { join } from "node:path";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface CodexGenerationAdapter {
  readSession(refreshToken?: boolean): Promise<CodexSession>;
  startLogin(flow: "browser" | "device"): Promise<CodexLoginStartResult>;
  logout(): Promise<void>;
  generateImageAsset(input: CodexImageGenerationInput): Promise<GeneratedCodexImageAssetResult>;
  generateEventExpansionPlan?: EventTextGenerationAdapter["generateEventExpansionPlan"];
}

export interface ApiHandlerOptions {
  projectDirectory?: string;
  generatedAssetsDirectory?: string;
  codex?: CodexGenerationAdapter;
  eventText?: EventTextGenerationAdapter;
}

const allowedImageKinds = new Set(["portrait", "expression", "cg"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getDefaultProjectDirectory(): string {
  return process.env.VN_MAKER_PROJECT_DIR || join(process.cwd(), "workspace", "Default.vnmaker");
}

function getProjectDirectory(body: unknown, fallback?: string): string {
  const record = asRecord(body);
  return typeof record.projectDirectory === "string" && record.projectDirectory.trim()
    ? record.projectDirectory
    : fallback || getDefaultProjectDirectory();
}

function isVnMakerProject(value: unknown): value is VnMakerProject {
  const record = asRecord(value);
  return record.version === "vn-maker/v1"
    && typeof record.id === "string"
    && typeof record.title === "string"
    && Array.isArray(record.characters)
    && Array.isArray(record.routes)
    && Array.isArray(record.scenes)
    && Array.isArray(record.assets)
    && Array.isArray(record.generationJobs)
    && Boolean(record.settings);
}

function getProject(body: unknown): VnMakerProject | undefined {
  const record = asRecord(body);
  return isVnMakerProject(record.project) ? record.project : undefined;
}

function getStarter(body: unknown): CreateStarterProjectInput | undefined {
  const record = asRecord(body);
  if (record.starter && typeof record.starter === "object") {
    return record.starter as CreateStarterProjectInput;
  }
  const projectRecord = asRecord(record.project);
  return projectRecord.starter && typeof projectRecord.starter === "object"
    ? projectRecord.starter as CreateStarterProjectInput
    : undefined;
}

function getCharacter(body: unknown): VnMakerCharacter {
  const record = asRecord(body);
  if (!record.character || typeof record.character !== "object") {
    throw new Error("character 입력이 필요합니다.");
  }
  return record.character as VnMakerCharacter;
}

function getScene(body: unknown): VnMakerScene {
  const record = asRecord(body);
  if (!record.scene || typeof record.scene !== "object") {
    throw new Error("scene 입력이 필요합니다.");
  }
  return record.scene as VnMakerScene;
}

function getEventExpansionRequest(body: unknown): EventExpansionRequest {
  const record = asRecord(body);
  if (!record.request || typeof record.request !== "object") {
    throw new Error("request 입력이 필요합니다.");
  }
  return record.request as EventExpansionRequest;
}

function getEventExpansionPlan(body: unknown): EventExpansionPlan {
  const record = asRecord(body);
  if (!record.plan || typeof record.plan !== "object") {
    throw new Error("plan 입력이 필요합니다.");
  }
  return record.plan as EventExpansionPlan;
}

function getHeroine(body: unknown): HeroineProfile {
  const record = asRecord(body);
  if (!record.heroine || typeof record.heroine !== "object") {
    throw new Error("heroine 입력이 필요합니다.");
  }
  return createHeroineProfile(record.heroine as Parameters<typeof createHeroineProfile>[0]);
}

function createGenerationJobInput(body: unknown): CreateImageGenerationJobInput {
  const record = asRecord(body);
  const kind = String(record.kind || "cg") as CreateImageGenerationJobInput["kind"];
  const targetId = String(record.targetId || "scene-opening");

  return {
    id: String(record.id || `job-${kind}-${targetId}-${Date.now()}`),
    kind,
    targetId,
    prompt: String(record.prompt || ""),
    style: String(record.style || "visual novel production asset"),
    outputAssetId: typeof record.outputAssetId === "string" ? record.outputAssetId : undefined
  };
}

function getImageKind(value: unknown): "portrait" | "expression" | "cg" {
  const kind = String(value || "cg");
  if (!allowedImageKinds.has(kind)) {
    throw new Error(`지원하지 않는 이미지 종류입니다: ${kind}`);
  }
  return kind as "portrait" | "expression" | "cg";
}

function getLoginFlow(value: unknown): "browser" | "device" {
  return value === "device" ? "device" : "browser";
}

function createDefaultCodexAdapter(): CodexGenerationAdapter {
  return {
    readSession: (refreshToken?: boolean) => sharedCodexAppServerClient.readSession(refreshToken),
    startLogin: (flow: "browser" | "device") => sharedCodexAppServerClient.startLogin(flow),
    logout: () => sharedCodexAppServerClient.logout(),
    generateImageAsset: (input: CodexImageGenerationInput) => sharedCodexAppServerClient.generateImageAsset(input),
    generateEventExpansionPlan: (input) => sharedCodexAppServerClient.generateEventExpansionPlan(input)
  };
}

function statusForError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("OAuth 로그인이 필요") ? 401 : 400;
}

async function readRequestJson(context: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function jsonRoute(operation: () => Promise<Record<string, unknown>> | Record<string, unknown>): Promise<Response> {
  try {
    return jsonResponse(await operation());
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, statusForError(error));
  }
}

async function jsonBodyRoute(
  context: Context,
  operation: (body: unknown) => Promise<Record<string, unknown>> | Record<string, unknown>
): Promise<Response> {
  const body = await readRequestJson(context);
  return jsonRoute(() => operation(body));
}

async function withStore<T>(
  projectDirectory: string,
  operation: (store: ProjectStore) => Promise<T> | T
): Promise<T> {
  const store = await openProjectStore(projectDirectory);
  try {
    return await operation(store);
  } finally {
    store.close();
  }
}

async function ensureProjectStore(body: unknown, fallbackDirectory?: string): Promise<ProjectStore> {
  const projectDirectory = getProjectDirectory(body, fallbackDirectory);
  const store = await openProjectStore(projectDirectory);
  const project = getProject(body);
  if (project) {
    store.saveProject(project);
    return store;
  }
  if (!store.getProject()) {
    store.saveProject(createStarterProject(getStarter(body)));
  }
  return store;
}

class ApiServices {
  private readonly codex: CodexGenerationAdapter;
  private readonly eventText?: EventTextGenerationAdapter;
  private readonly projectDirectory: string;

  constructor(options: ApiHandlerOptions = {}) {
    this.codex = options.codex || createDefaultCodexAdapter();
    this.eventText = options.eventText || (
      "generateEventExpansionPlan" in this.codex
        ? this.codex as CodexGenerationAdapter & EventTextGenerationAdapter
        : undefined
    );
    this.projectDirectory = options.projectDirectory || getDefaultProjectDirectory();
  }

  async readCodexSession(): Promise<Record<string, unknown>> {
    const session = await this.codex.readSession(false);
    return {
      ok: true,
      ...session,
      note: "Codex app-server의 ChatGPT managed OAuth 상태를 조회한다. OpenAI API key 입력은 사용하지 않는다."
    };
  }

  async startLogin(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    return { ok: true, login: await this.codex.startLogin(getLoginFlow(record.flow)) };
  }

  async logout(): Promise<Record<string, unknown>> {
    await this.codex.logout();
    return { ok: true };
  }

  async createProject(body: unknown): Promise<Record<string, unknown>> {
    const projectDirectory = getProjectDirectory(body, this.projectDirectory);
    const store = await createProjectWorkspace({
      projectDirectory,
      starter: getStarter(body),
      project: getProject(body)
    });
    try {
      const validation = store.validateAndStore();
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        paths: store.paths,
        project: store.requireProject(),
        validation
      };
    } finally {
      store.close();
    }
  }

  async listHeroines(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      return { ok: true, projectDirectory: store.paths.projectDirectory, heroines: store.listHeroines() };
    } finally {
      store.close();
    }
  }

  async saveHeroine(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const heroine = store.saveHeroine(getHeroine(body));
      return { ok: true, projectDirectory: store.paths.projectDirectory, heroine, heroines: store.listHeroines() };
    } finally {
      store.close();
    }
  }

  async deleteHeroine(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    const heroineId = String(record.heroineId || "");
    if (!heroineId) {
      throw new Error("heroineId 입력이 필요합니다.");
    }
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      store.deleteHeroine(heroineId);
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        heroines: store.listHeroines(),
        project: store.requireProject()
      };
    } finally {
      store.close();
    }
  }

  async createProjectFromHeroine(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    const heroine = getHeroine(body);
    const projectDirectory = getProjectDirectory(body, this.projectDirectory);
    const store = await createProjectWorkspace({
      projectDirectory,
      project: createProjectFromHeroine({
        id: typeof record.projectId === "string" ? record.projectId : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        premise: typeof record.premise === "string" ? record.premise : undefined,
        heroine
      })
    });
    try {
      store.saveHeroine(heroine);
      const validation = store.validateAndStore();
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        paths: store.paths,
        heroine,
        project: store.requireProject(),
        validation
      };
    } finally {
      store.close();
    }
  }

  async openProject(body: unknown): Promise<Record<string, unknown>> {
    const projectDirectory = getProjectDirectory(body, this.projectDirectory);
    return withStore(projectDirectory, (store) => {
      const project = store.requireProject();
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        paths: store.paths,
        project,
        validation: store.validateAndStore()
      };
    });
  }

  async saveCharacter(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const project = store.upsertCharacter(getCharacter(body));
      const validation = store.validateAndStore();
      return { ok: true, projectDirectory: store.paths.projectDirectory, project, validation };
    } finally {
      store.close();
    }
  }

  async saveScene(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const project = store.upsertScene(getScene(body));
      const validation = store.validateAndStore();
      return { ok: true, projectDirectory: store.paths.projectDirectory, project, validation };
    } finally {
      store.close();
    }
  }

  async validateProject(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const validation = store.validateAndStore();
      return {
        ok: validation.ok,
        projectDirectory: store.paths.projectDirectory,
        issues: validation.issues,
        project: store.requireProject()
      };
    } finally {
      store.close();
    }
  }

  async createManifest(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        manifest: createAssetManifest(store.requireProject())
      };
    } finally {
      store.close();
    }
  }

  async buildProject(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        artifact: buildProjectHtml(store.requireProject())
      };
    } finally {
      store.close();
    }
  }

  async expandEvent(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const project = store.requireProject();
      const route = project.routes.find((item) => item.id === record.routeId) || project.routes[0];
      if (!route) {
        throw new Error("이벤트를 추가할 루트가 없습니다.");
      }
      const request = createEventExpansionRequest(project, {
        projectDirectory: store.paths.projectDirectory,
        routeId: route.id,
        afterSceneId: typeof record.afterSceneId === "string" ? record.afterSceneId : route.entrySceneId,
        heroineId: typeof record.heroineId === "string" ? record.heroineId : route.heroineId,
        userEvent: String(record.userEvent || record.prompt || ""),
        constraints: record.constraints && typeof record.constraints === "object"
          ? record.constraints as Partial<EventExpansionRequest["constraints"]>
          : undefined
      });
      const result = await expandNaturalLanguageEvent({ project, request, adapter: this.eventText });
      if (!result.ok) {
        return { ok: false, projectDirectory: store.paths.projectDirectory, request, attempts: result.attempts, error: result.error };
      }
      return {
        ok: true,
        projectDirectory: store.paths.projectDirectory,
        request,
        plan: result.plan,
        validation: result.validation,
        diff: result.validation.diff,
        attempts: result.attempts
      };
    } finally {
      store.close();
    }
  }

  async approveEvent(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const result = store.applyEventExpansionPlan(
        getEventExpansionRequest(body),
        getEventExpansionPlan(body)
      );
      return { ok: true, projectDirectory: store.paths.projectDirectory, ...result };
    } finally {
      store.close();
    }
  }

  async previewProject(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const runtime = store.previewProject(typeof record.startSceneId === "string" ? record.startSceneId : undefined);
      return { ok: true, projectDirectory: store.paths.projectDirectory, runtime };
    } finally {
      store.close();
    }
  }

  async exportProject(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const result = await store.exportWebPlayer(typeof record.outputDirectory === "string" ? record.outputDirectory : undefined);
      return { ok: true, projectDirectory: store.paths.projectDirectory, ...result };
    } finally {
      store.close();
    }
  }

  async createGenerationJob(body: unknown): Promise<Record<string, unknown>> {
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const job = createImageGenerationJob(createGenerationJobInput(body));
      const project = store.requireProject();
      const index = project.generationJobs.findIndex((item) => item.id === job.id);
      if (index >= 0) {
        project.generationJobs[index] = job;
      } else {
        project.generationJobs.push(job);
      }
      const savedProject = store.saveProject(project);
      return { ok: true, projectDirectory: store.paths.projectDirectory, job, project: savedProject };
    } finally {
      store.close();
    }
  }

  async generateImage(body: unknown): Promise<Record<string, unknown>> {
    const record = asRecord(body);
    const store = await ensureProjectStore(body, this.projectDirectory);
    try {
      const result = await this.codex.generateImageAsset({
        kind: getImageKind(record.kind),
        targetId: String(record.targetId || "scene-opening"),
        prompt: String(record.prompt || ""),
        style: String(record.style || "soft visual novel, clean anime, production-ready"),
        model: typeof record.model === "string" ? record.model : null,
        jobId: typeof record.jobId === "string" ? record.jobId : undefined,
        outputAssetId: typeof record.outputAssetId === "string" ? record.outputAssetId : undefined,
        outputDirectory: store.paths.generatedAssetsDirectory,
        publicPathPrefix: "/generated-assets",
        cwd: store.paths.projectDirectory
      });
      const project = await store.storeGenerationResult(result);
      return { ok: true, projectDirectory: store.paths.projectDirectory, project, ...result };
    } finally {
      store.close();
    }
  }
}

export function createApiApp(options: ApiHandlerOptions = {}): Hono {
  const services = new ApiServices(options);
  const app = new Hono();

  app.get("/api/codex/session", () => jsonRoute(() => services.readCodexSession()));
  app.post("/api/codex/login", (context) => jsonBodyRoute(context, (body) => services.startLogin(body)));
  app.post("/api/codex/logout", () => jsonRoute(() => services.logout()));

  app.post("/api/projects", (context) => jsonBodyRoute(context, (body) => services.createProject(body)));
  app.post("/api/projects/open", (context) => jsonBodyRoute(context, (body) => services.openProject(body)));
  app.post("/api/project/starter", (context) => jsonBodyRoute(context, (body) => services.createProject(body)));
  app.post("/api/project/open", (context) => jsonBodyRoute(context, (body) => services.openProject(body)));
  app.post("/api/heroines/list", (context) => jsonBodyRoute(context, (body) => services.listHeroines(body)));
  app.post("/api/heroines/save", (context) => jsonBodyRoute(context, (body) => services.saveHeroine(body)));
  app.post("/api/heroines/delete", (context) => jsonBodyRoute(context, (body) => services.deleteHeroine(body)));
  app.post("/api/projects/from-heroine", (context) => jsonBodyRoute(context, (body) => services.createProjectFromHeroine(body)));
  app.post("/api/project/characters", (context) => jsonBodyRoute(context, (body) => services.saveCharacter(body)));
  app.post("/api/project/scenes", (context) => jsonBodyRoute(context, (body) => services.saveScene(body)));
  app.post("/api/project/validate", (context) => jsonBodyRoute(context, (body) => services.validateProject(body)));
  app.post("/api/project/manifest", (context) => jsonBodyRoute(context, (body) => services.createManifest(body)));
  app.post("/api/project/build", (context) => jsonBodyRoute(context, (body) => services.buildProject(body)));
  app.post("/api/project/preview", (context) => jsonBodyRoute(context, (body) => services.previewProject(body)));
  app.post("/api/project/export", (context) => jsonBodyRoute(context, (body) => services.exportProject(body)));
  app.post("/api/events/expand", (context) => jsonBodyRoute(context, (body) => services.expandEvent(body)));
  app.post("/api/events/approve", (context) => jsonBodyRoute(context, (body) => services.approveEvent(body)));

  app.post("/api/generation/jobs", (context) => jsonBodyRoute(context, (body) => services.createGenerationJob(body)));
  app.post("/api/generation/images", (context) => jsonBodyRoute(context, (body) => services.generateImage(body)));

  app.all("/api/*", () => jsonResponse({ ok: false, error: "알 수 없는 API 경로입니다." }, 404));
  app.all("/api", () => jsonResponse({ ok: false, error: "알 수 없는 API 경로입니다." }, 404));

  return app;
}

export function createApiRequestHandler(options: ApiHandlerOptions = {}) {
  const app = createApiApp(options);

  return async function handleApiRequestWithOptions(request: ApiRequest): Promise<ApiResponse> {
    if (request.method !== "GET" && request.method !== "POST") {
      return { status: 405, body: { ok: false, error: "지원하지 않는 메서드입니다." } };
    }

    const response = await app.request(`http://127.0.0.1${request.path}`, {
      method: request.method,
      headers: request.method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: request.method === "POST" ? JSON.stringify(request.body ?? {}) : undefined
    });
    const body = await response.json() as Record<string, unknown>;
    return { status: response.status, body };
  };
}

export const handleApiRequest = createApiRequestHandler();

export function defaultGeneratedAssetsDirectory(projectDirectory = getDefaultProjectDirectory()): string {
  return resolveProjectWorkspacePaths(projectDirectory).generatedAssetsDirectory;
}
