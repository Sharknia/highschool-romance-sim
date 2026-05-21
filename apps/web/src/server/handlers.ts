import { Hono, type Context } from "hono";
import { join } from "node:path";
import { sharedCodexAppServerClient, type CodexLoginStartResult, type CodexSession } from "@vn-maker/generation-codex";
import { resolveProjectWorkspacePaths } from "@vn-maker/project-store";
import {
  createVnMakerUseCases,
  InputValidationError,
  type EventTextGenerationAdapter,
  type ProjectImageGenerationAdapter,
  type ProjectImageGenerationInput,
  type ProjectImageGenerationResult
} from "@vn-maker/use-cases";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface CodexGenerationAdapter extends ProjectImageGenerationAdapter {
  readSession(refreshToken?: boolean): Promise<CodexSession>;
  startLogin(flow: "browser" | "device"): Promise<CodexLoginStartResult>;
  logout(): Promise<void>;
  generateImageAsset(input: ProjectImageGenerationInput): Promise<ProjectImageGenerationResult>;
  generateEventExpansionPlan?: EventTextGenerationAdapter["generateEventExpansionPlan"];
}

export interface ApiHandlerOptions {
  projectDirectory?: string;
  codex?: CodexGenerationAdapter;
  eventText?: EventTextGenerationAdapter;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getDefaultProjectDirectory(): string {
  return process.env.VN_MAKER_PROJECT_DIR || join(process.cwd(), "workspace", "Default.vnmaker");
}

function getLoginFlow(value: unknown): "browser" | "device" {
  return value === "device" ? "device" : "browser";
}

function createDefaultCodexAdapter(): CodexGenerationAdapter {
  return {
    readSession: (refreshToken?: boolean) => sharedCodexAppServerClient.readSession(refreshToken),
    startLogin: (flow: "browser" | "device") => sharedCodexAppServerClient.startLogin(flow),
    logout: () => sharedCodexAppServerClient.logout(),
    generateImageAsset: (input: ProjectImageGenerationInput) => sharedCodexAppServerClient.generateImageAsset(input),
    generateEventExpansionPlan: (input) => sharedCodexAppServerClient.generateEventExpansionPlan(input)
  };
}

function statusForError(error: unknown): number {
  if (error instanceof InputValidationError) {
    return 400;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("OAuth 로그인이 필요")) {
    return 401;
  }
  if (message.includes("현재 프로젝트가 패치 적용 직후 상태와 달라")) {
    return 409;
  }
  if (
    message.startsWith("패치 검증 실패")
    || message.includes("패치 제안 이력을 찾을 수 없습니다")
    || message.includes("패치 이력을 찾을 수 없습니다")
    || message.includes("적용된 패치만 되돌릴 수 있습니다")
    || message.includes("이미 되돌린 패치입니다")
  ) {
    return 400;
  }
  return 500;
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
      error: error instanceof Error ? error.message : String(error),
      issues: error instanceof InputValidationError ? error.issues : undefined
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

class ApiServices {
  private readonly codex: CodexGenerationAdapter;
  private readonly useCases: ReturnType<typeof createVnMakerUseCases>;

  constructor(options: ApiHandlerOptions = {}) {
    this.codex = options.codex || createDefaultCodexAdapter();
    this.useCases = createVnMakerUseCases({
      defaultProjectDirectory: options.projectDirectory || getDefaultProjectDirectory(),
      eventText: options.eventText,
      image: { generateImageAsset: (input) => this.codex.generateImageAsset(input) }
    });
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
    return { ok: true, login: await this.codex.startLogin(getLoginFlow(asRecord(body).flow)) };
  }

  async logout(): Promise<Record<string, unknown>> {
    await this.codex.logout();
    return { ok: true };
  }

  createProject(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.createProject(body);
  }

  listHeroines(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.listHeroines(body);
  }

  saveHeroine(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.saveHeroine(body);
  }

  cloneHeroine(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.cloneHeroine(body);
  }

  deleteHeroine(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.deleteHeroine(body);
  }

  createProjectFromHeroine(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.createProjectFromHeroine(body);
  }

  openProject(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.openProject(body);
  }

  saveCharacter(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.saveCharacter(body);
  }

  saveScene(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.saveScene(body);
  }

  insertManualScene(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.insertManualScene(body);
  }

  linkManualScene(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.linkManualScene(body);
  }

  setSceneEnding(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.setSceneEnding(body);
  }

  validateProject(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.validateProject(body);
  }

  createManifest(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.createManifest(body);
  }

  buildProject(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.buildProject(body);
  }

  expandEvent(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.expandEvent(body);
  }

  approveEvent(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.approveEvent(body);
  }

  previewProject(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.previewProject(body);
  }

  exportProject(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.exportProject(body);
  }

  createGenerationJob(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.createGenerationJob(body);
  }

  planDefaultEmotionAssets(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.planDefaultEmotionAssets(body);
  }

  planExpressionAssets(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.planExpressionAssets(body);
  }

  listGenerationJobs(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.listGenerationJobs(body);
  }

  runGenerationJobs(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.runGenerationJobs(body);
  }

  generateImage(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.generateImage(body);
  }

  listPatchHistory(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.listPatchHistory(body);
  }

  undoPatch(body: unknown): Promise<Record<string, unknown>> {
    return this.useCases.undoPatch(body);
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
  app.post("/api/heroines/clone", (context) => jsonBodyRoute(context, (body) => services.cloneHeroine(body)));
  app.post("/api/heroines/delete", (context) => jsonBodyRoute(context, (body) => services.deleteHeroine(body)));
  app.post("/api/projects/from-heroine", (context) => jsonBodyRoute(context, (body) => services.createProjectFromHeroine(body)));
  app.post("/api/project/characters", (context) => jsonBodyRoute(context, (body) => services.saveCharacter(body)));
  app.post("/api/project/scenes", (context) => jsonBodyRoute(context, (body) => services.saveScene(body)));
  app.post("/api/project/scenes/insert", (context) => jsonBodyRoute(context, (body) => services.insertManualScene(body)));
  app.post("/api/project/scenes/link", (context) => jsonBodyRoute(context, (body) => services.linkManualScene(body)));
  app.post("/api/project/scenes/ending", (context) => jsonBodyRoute(context, (body) => services.setSceneEnding(body)));
  app.post("/api/project/validate", (context) => jsonBodyRoute(context, (body) => services.validateProject(body)));
  app.post("/api/project/manifest", (context) => jsonBodyRoute(context, (body) => services.createManifest(body)));
  app.post("/api/project/build", (context) => jsonBodyRoute(context, (body) => services.buildProject(body)));
  app.post("/api/project/preview", (context) => jsonBodyRoute(context, (body) => services.previewProject(body)));
  app.post("/api/project/export", (context) => jsonBodyRoute(context, (body) => services.exportProject(body)));
  app.post("/api/events/expand", (context) => jsonBodyRoute(context, (body) => services.expandEvent(body)));
  app.post("/api/events/approve", (context) => jsonBodyRoute(context, (body) => services.approveEvent(body)));
  app.post("/api/events/history", (context) => jsonBodyRoute(context, (body) => services.listPatchHistory(body)));
  app.post("/api/events/undo", (context) => jsonBodyRoute(context, (body) => services.undoPatch(body)));

  app.post("/api/generation/jobs", (context) => jsonBodyRoute(context, (body) => services.createGenerationJob(body)));
  app.post("/api/generation/jobs/list", (context) => jsonBodyRoute(context, (body) => services.listGenerationJobs(body)));
  app.post("/api/generation/jobs/run", (context) => jsonBodyRoute(context, (body) => services.runGenerationJobs(body)));
  app.post("/api/generation/default-emotions", (context) => jsonBodyRoute(context, (body) => services.planDefaultEmotionAssets(body)));
  app.post("/api/generation/expression-tags", (context) => jsonBodyRoute(context, (body) => services.planExpressionAssets(body)));
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
