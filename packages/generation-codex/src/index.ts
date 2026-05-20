import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  createDeterministicEventExpansionPlan,
  createImageGenerationJob,
  validateEventExpansionPlan,
  type AssetKind,
  type EventExpansionPlan,
  type EventExpansionRequest,
  type VnMakerAsset,
  type VnMakerGenerationJob,
  type VnMakerProject,
  type EventExpansionValidationResult
} from "@vn-maker/engine-core";

type JsonObject = Record<string, unknown>;
type LoginFlow = "browser" | "device";
type CodexAuthMode = "chatgpt" | "chatgptAuthTokens" | "apikey" | null;
type CodexImageKind = Extract<AssetKind, "portrait" | "expression" | "cg">;

interface JsonRpcResponse<T = unknown> {
  id: number;
  result?: T;
  error?: {
    message?: string;
    code?: number;
  };
}

interface JsonRpcNotification {
  method: string;
  params?: JsonObject;
}

interface CodexAccount {
  type: "chatgpt" | "chatgptAuthTokens" | "apiKey";
  email?: string;
  planType?: string | null;
}

interface CodexAccountResponse {
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean;
}

interface CodexCapabilitiesResponse {
  imageGeneration: boolean;
  namespaceTools: boolean;
  webSearch: boolean;
}

interface CodexThreadStartResponse {
  thread: {
    id: string;
  };
}

interface CodexTurnCompletedParams {
  threadId: string;
  turn: {
    id: string;
    status: string;
    error?: string | null;
  };
}

interface CodexImageGenerationItem {
  id: string;
  type: "imageGeneration";
  result: string;
  revisedPrompt?: string | null;
  savedPath?: string | null;
  status: string;
}

interface CodexTextGenerationItem {
  id?: string;
  type?: string;
  text?: string;
  result?: string;
  content?: unknown;
  message?: unknown;
  status?: string;
}

interface CodexItemCompletedParams {
  threadId: string;
  turnId: string;
  item: JsonObject;
}

export interface CodexSession {
  connected: boolean;
  mode: CodexAuthMode;
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean;
  capabilities: CodexCapabilitiesResponse | null;
}

export interface CodexLoginStartResult {
  type: "chatgpt" | "chatgptDeviceCode";
  loginId: string;
  authUrl?: string;
  verificationUrl?: string;
  userCode?: string;
}

export interface CodexImageGenerationInput {
  prompt: string;
  style?: string;
  kind?: CodexImageKind;
  targetId: string;
  jobId?: string;
  outputAssetId?: string;
  outputDirectory?: string;
  publicPathPrefix?: string;
  model?: string | null;
  cwd?: string;
}

export interface GeneratedCodexImageAssetResult {
  job: VnMakerGenerationJob;
  asset: VnMakerAsset;
  image: {
    mimeType: string;
    b64Json: string;
    dataUrl: string;
    fileName?: string;
    filePath?: string;
    uri?: string;
    codexSavedPath?: string | null;
    revisedPrompt?: string | null;
  };
  raw: {
    item: CodexImageGenerationItem;
  };
}

export interface EventTextGenerationAttempt {
  attempt: number;
  ok: boolean;
  failureKind?: "schema_invalid" | "engine_validation_failed" | "quality_rule_failed";
  issues: string[];
}

export interface EventTextGenerationAdapter {
  generateEventExpansionPlan(input: {
    project: VnMakerProject;
    request: EventExpansionRequest;
    attempt: number;
    previousAttempts: EventTextGenerationAttempt[];
  }): Promise<EventExpansionPlan | unknown>;
}

export interface ExpandNaturalLanguageEventInput {
  project: VnMakerProject;
  request: EventExpansionRequest;
  adapter?: EventTextGenerationAdapter;
  maxAttempts?: number;
}

export type ExpandNaturalLanguageEventResult =
  | {
      ok: true;
      plan: EventExpansionPlan;
      validation: EventExpansionValidationResult;
      attempts: EventTextGenerationAttempt[];
    }
  | {
      ok: false;
      attempts: EventTextGenerationAttempt[];
      error: string;
    };

export interface CodexAppServerClientOptions {
  codexBinary?: string;
  cwd?: string;
  initializeTimeoutMs?: number;
  requestTimeoutMs?: number;
  turnTimeoutMs?: number;
}

type PendingRequest = {
  resolve: (value: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type NotificationListener = (notification: JsonRpcNotification) => void;

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePublicPath(prefix: string, fileName: string): string {
  return `${prefix.replace(/\/$/, "")}/${fileName}`;
}

function getAuthMode(account: CodexAccount | null): CodexAuthMode {
  if (!account) {
    return null;
  }
  if (account.type === "apiKey") {
    return "apikey";
  }
  return account.type;
}

function isChatGptAuth(account: CodexAccount | null): boolean {
  return account?.type === "chatgpt" || account?.type === "chatgptAuthTokens";
}

function createImagePrompt(input: CodexImageGenerationInput): string {
  return [
    "Use the image generation tool to create one visual novel production asset.",
    `Asset kind: ${input.kind || "cg"}`,
    `Target id: ${input.targetId}`,
    `Prompt: ${input.prompt.trim()}`,
    input.style ? `Style: ${input.style.trim()}` : "",
    "Do not include text, logos, watermarks, speech bubbles, UI chrome, or captions.",
    "After the image tool finishes, keep the final text response short."
  ].filter(Boolean).join("\n");
}

function parseDataUrl(value: string): { mimeType: string; b64Json: string } | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    b64Json: match[2]
  };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "png";
}

async function createImagePayloadFromCodexItem(item: CodexImageGenerationItem): Promise<{ mimeType: string; b64Json: string; dataUrl: string }> {
  const result = item.result.trim();
  const dataUrl = parseDataUrl(result);

  if (dataUrl) {
    return {
      ...dataUrl,
      dataUrl: result
    };
  }

  if (result) {
    return {
      mimeType: "image/png",
      b64Json: result,
      dataUrl: `data:image/png;base64,${result}`
    };
  }

  if (item.savedPath) {
    const source = await readFile(item.savedPath);
    const extension = extname(item.savedPath).toLowerCase();
    const mimeType = extension === ".webp" ? "image/webp" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
    const b64Json = source.toString("base64");
    return {
      mimeType,
      b64Json,
      dataUrl: `data:${mimeType};base64,${b64Json}`
    };
  }

  throw new Error("Codex 이미지 생성 결과에 이미지 데이터가 없습니다.");
}

export async function createCodexImageAssetResult(
  input: CodexImageGenerationInput,
  item: CodexImageGenerationItem
): Promise<GeneratedCodexImageAssetResult> {
  const kind = input.kind || "cg";
  const jobId = input.jobId || createId(`job-${kind}`);
  const outputAssetId = input.outputAssetId || createId(`asset-${kind}`);
  const payload = await createImagePayloadFromCodexItem(item);
  const image = {
    ...payload,
    fileName: undefined as string | undefined,
    filePath: undefined as string | undefined,
    uri: undefined as string | undefined,
    codexSavedPath: item.savedPath || null,
    revisedPrompt: item.revisedPrompt || null
  };

  if (input.outputDirectory) {
    await mkdir(input.outputDirectory, { recursive: true });
    image.fileName = `${outputAssetId}.${extensionForMimeType(image.mimeType)}`;
    image.filePath = join(input.outputDirectory, image.fileName);
    await writeFile(image.filePath, Buffer.from(image.b64Json, "base64"));
    image.uri = input.publicPathPrefix ? normalizePublicPath(input.publicPathPrefix, image.fileName) : image.filePath;
  }

  const job = createImageGenerationJob({
    id: jobId,
    kind,
    targetId: input.targetId,
    prompt: input.prompt,
    style: input.style,
    outputAssetId
  });
  job.status = "completed";

  const asset: VnMakerAsset = {
    id: outputAssetId,
    kind,
    label: `${kind} generated by Codex for ${input.targetId}`,
    uri: image.uri || image.dataUrl,
    source: "generated",
    generationJobId: job.id
  };

  return {
    job,
    asset,
    image,
    raw: { item }
  };
}

function isEventExpansionPlan(value: unknown): value is EventExpansionPlan {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const decision = record.decision && typeof record.decision === "object" ? record.decision as Record<string, unknown> : {};
  const patch = record.patch && typeof record.patch === "object" ? record.patch as Record<string, unknown> : {};
  return typeof record.summary === "string"
    && typeof decision.sceneCount === "number"
    && typeof decision.choiceCount === "number"
    && typeof decision.cgCount === "number"
    && typeof decision.newExpressionAssetCount === "number"
    && Array.isArray(patch.operations);
}

function classifyValidationFailure(validation: EventExpansionValidationResult): EventTextGenerationAttempt["failureKind"] {
  return validation.issues.some((issue) => issue.path.startsWith("decision") || issue.path.includes("newExpressionAssetCount"))
    ? "quality_rule_failed"
    : "engine_validation_failed";
}

function extractTextFromUnknown(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFromUnknown(item));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      ...extractTextFromUnknown(record.text),
      ...extractTextFromUnknown(record.result),
      ...extractTextFromUnknown(record.content),
      ...extractTextFromUnknown(record.message)
    ];
  }
  return [];
}

function extractEventPlanJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] || trimmed).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  const json = firstBrace >= 0 && lastBrace > firstBrace
    ? candidate.slice(firstBrace, lastBrace + 1)
    : candidate;
  return JSON.parse(json);
}

function createEventExpansionPrompt(
  project: VnMakerProject,
  request: EventExpansionRequest,
  attempt: number,
  previousAttempts: EventTextGenerationAttempt[]
): string {
  const route = project.routes.find((item) => item.id === request.routeId);
  const afterScene = project.scenes.find((scene) => scene.id === request.afterSceneId);
  return [
    "You are generating a small validated patch for a Korean teen-safe visual novel maker.",
    "Return JSON only. Do not use markdown.",
    "The JSON must match EventExpansionPlan with summary, decision, and patch.operations.",
    "Allowed operation types: addScene, updateScene, updateSceneLink, addChoice, addAsset, addGenerationJob.",
    "Do not rewrite the whole project, add heroines, add routes, delete scenes, add expression assets, or exceed constraints.",
    `Attempt: ${attempt}`,
    `Previous failures: ${JSON.stringify(previousAttempts, null, 2)}`,
    `Project summary: ${JSON.stringify({
      id: project.id,
      title: project.title,
      heroine: request.heroineContext,
      route,
      afterScene,
      sceneIds: project.scenes.map((scene) => scene.id),
      assetIds: project.assets.map((asset) => asset.id),
      generationJobIds: project.generationJobs.map((job) => job.id)
    }, null, 2)}`,
    `EventExpansionRequest: ${JSON.stringify(request, null, 2)}`,
    "The Alpha target is sceneCount 3, choiceCount 1, cgCount 1 when constraints allow it."
  ].join("\n\n");
}

const deterministicEventTextAdapter: EventTextGenerationAdapter = {
  async generateEventExpansionPlan({ request }) {
    return createDeterministicEventExpansionPlan(request);
  }
};

export async function expandNaturalLanguageEvent(
  input: ExpandNaturalLanguageEventInput
): Promise<ExpandNaturalLanguageEventResult> {
  const adapter = input.adapter || deterministicEventTextAdapter;
  const maxAttempts = input.maxAttempts ?? 3;
  const attempts: EventTextGenerationAttempt[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = await adapter.generateEventExpansionPlan({
      project: input.project,
      request: input.request,
      attempt,
      previousAttempts: attempts
    });

    if (!isEventExpansionPlan(candidate)) {
      attempts.push({
        attempt,
        ok: false,
        failureKind: "schema_invalid",
        issues: ["생성 결과가 EventExpansionPlan 스키마와 일치하지 않습니다."]
      });
      continue;
    }

    const validation = validateEventExpansionPlan(input.project, input.request, candidate);
    if (!validation.ok) {
      attempts.push({
        attempt,
        ok: false,
        failureKind: classifyValidationFailure(validation),
        issues: validation.issues.map((issue) => `${issue.path}: ${issue.message}`)
      });
      continue;
    }

    attempts.push({
      attempt,
      ok: true,
      issues: []
    });
    return {
      ok: true,
      plan: candidate,
      validation,
      attempts
    };
  }

  return {
    ok: false,
    attempts,
    error: attempts.at(-1)?.issues.join(", ") || "자연어 이벤트 생성에 실패했습니다."
  };
}

export class CodexAppServerClient {
  private readonly codexBinary: string;
  private readonly cwd: string;
  private readonly initializeTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly turnTimeoutMs: number;
  private process: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  private nextRequestId = 1;
  private connectPromise: Promise<void> | null = null;
  private readonly pendingRequests = new Map<number, PendingRequest>();
  private readonly notificationListeners = new Set<NotificationListener>();

  constructor(options: CodexAppServerClientOptions = {}) {
    this.codexBinary = options.codexBinary || "codex";
    this.cwd = options.cwd || process.cwd();
    this.initializeTimeoutMs = options.initializeTimeoutMs || 15_000;
    this.requestTimeoutMs = options.requestTimeoutMs || 30_000;
    this.turnTimeoutMs = options.turnTimeoutMs || 180_000;
  }

  async readSession(refreshToken = false): Promise<CodexSession> {
    await this.connect();
    const accountResponse = await this.request<CodexAccountResponse>("account/read", { refreshToken });
    let capabilities: CodexCapabilitiesResponse | null = null;

    try {
      capabilities = await this.request<CodexCapabilitiesResponse>("modelProvider/capabilities/read", {});
    } catch {
      capabilities = null;
    }

    return {
      connected: isChatGptAuth(accountResponse.account),
      mode: getAuthMode(accountResponse.account),
      account: accountResponse.account,
      requiresOpenaiAuth: accountResponse.requiresOpenaiAuth,
      capabilities
    };
  }

  async startLogin(flow: LoginFlow): Promise<CodexLoginStartResult> {
    await this.connect();
    const type = flow === "device" ? "chatgptDeviceCode" : "chatgpt";
    return this.request<CodexLoginStartResult>("account/login/start", { type });
  }

  async logout(): Promise<void> {
    await this.connect();
    await this.request("account/logout", {});
  }

  async generateImageAsset(input: CodexImageGenerationInput): Promise<GeneratedCodexImageAssetResult> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error("이미지 생성을 위한 prompt 입력이 필요합니다.");
    }

    const session = await this.readSession(true);
    if (!session.connected) {
      throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
    }
    if (session.capabilities && !session.capabilities.imageGeneration) {
      throw new Error("현재 Codex app-server가 imageGeneration 기능을 제공하지 않습니다.");
    }

    await this.connect();
    const threadResponse = await this.request<CodexThreadStartResponse>("thread/start", {
      ephemeral: true,
      cwd: input.cwd || this.cwd,
      sandbox: "read-only",
      model: input.model ?? null
    });
    const threadId = threadResponse.thread.id;
    const imageItem = await this.runImageGenerationTurn(threadId, input);
    return createCodexImageAssetResult(input, imageItem);
  }

  async generateEventExpansionPlan(input: {
    project: VnMakerProject;
    request: EventExpansionRequest;
    attempt: number;
    previousAttempts: EventTextGenerationAttempt[];
  }): Promise<EventExpansionPlan> {
    const session = await this.readSession(true);
    if (!session.connected) {
      throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
    }

    await this.connect();
    const threadResponse = await this.request<CodexThreadStartResponse>("thread/start", {
      ephemeral: true,
      cwd: input.request.projectDirectory || this.cwd,
      sandbox: "read-only",
      model: null
    });
    const threadId = threadResponse.thread.id;
    const text = await this.runTextGenerationTurn(threadId, createEventExpansionPrompt(
      input.project,
      input.request,
      input.attempt,
      input.previousAttempts
    ), input.request.projectDirectory || this.cwd);
    return extractEventPlanJson(text) as EventExpansionPlan;
  }

  close(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connectPromise = null;
  }

  private async connect(): Promise<void> {
    if (this.process && !this.process.killed) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.startProcessAndInitialize();
    try {
      await this.connectPromise;
    } catch (error) {
      this.connectPromise = null;
      throw error;
    }
  }

  private async startProcessAndInitialize(): Promise<void> {
    this.process = spawn(this.codexBinary, ["app-server", "--listen", "stdio://"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.process.stdout.on("data", (chunk: Buffer) => this.handleStdout(chunk));
    // stderr는 app-server 경고가 섞여 나오므로 서버가 멈추지 않게 비워만 둔다.
    this.process.stderr.on("data", () => undefined);
    this.process.on("exit", () => this.handleExit());
    await this.request("initialize", {
      clientInfo: {
        name: "vn_maker",
        title: "VN Maker",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true
      }
    }, this.initializeTimeoutMs);
    this.sendNotification("initialized");
  }

  private async runImageGenerationTurn(threadId: string, input: CodexImageGenerationInput): Promise<CodexImageGenerationItem> {
    let imageItem: CodexImageGenerationItem | null = null;
    let turnStatus = "inProgress";
    const completed = new Promise<CodexImageGenerationItem>((resolve, reject) => {
      const timeout = setTimeout(() => {
        dispose();
        reject(new Error("Codex 이미지 생성 시간이 초과되었습니다."));
      }, this.turnTimeoutMs);

      const dispose = this.onNotification((notification) => {
        if (notification.method === "item/completed") {
          const params = notification.params as CodexItemCompletedParams | undefined;
          if (params?.threadId === threadId && params.item?.type === "imageGeneration") {
            imageItem = params.item as unknown as CodexImageGenerationItem;
          }
        }

        if (notification.method === "turn/completed") {
          const params = notification.params as unknown as CodexTurnCompletedParams | undefined;
          if (params?.threadId !== threadId) {
            return;
          }

          turnStatus = params.turn.status;
          clearTimeout(timeout);
          dispose();

          if (imageItem) {
            resolve(imageItem);
            return;
          }

          reject(new Error(`Codex turn이 ${turnStatus} 상태로 끝났지만 imageGeneration 결과가 없습니다.`));
        }
      });
    });

    await this.request("turn/start", {
      threadId,
      cwd: input.cwd || this.cwd,
      model: input.model ?? null,
      input: [
        {
          type: "text",
          text: createImagePrompt(input)
        }
      ]
    });

    return completed;
  }

  private async runTextGenerationTurn(threadId: string, text: string, cwd: string): Promise<string> {
    const textItems: string[] = [];
    const completed = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        dispose();
        reject(new Error("Codex 텍스트 생성 시간이 초과되었습니다."));
      }, this.turnTimeoutMs);

      const dispose = this.onNotification((notification) => {
        if (notification.method === "item/completed") {
          const params = notification.params as CodexItemCompletedParams | undefined;
          if (params?.threadId === threadId && params.item?.type !== "imageGeneration") {
            const item = params.item as unknown as CodexTextGenerationItem;
            textItems.push(...extractTextFromUnknown(item));
          }
        }

        if (notification.method === "turn/completed") {
          const params = notification.params as unknown as CodexTurnCompletedParams | undefined;
          if (params?.threadId !== threadId) {
            return;
          }

          clearTimeout(timeout);
          dispose();
          const output = textItems.join("\n").trim();
          if (output) {
            resolve(output);
            return;
          }
          reject(new Error(`Codex turn이 ${params.turn.status} 상태로 끝났지만 텍스트 결과가 없습니다.`));
        }
      });
    });

    await this.request("turn/start", {
      threadId,
      cwd,
      model: null,
      input: [
        {
          type: "text",
          text
        }
      ]
    });

    return completed;
  }

  private async request<T = unknown>(method: string, params: unknown = {}, timeoutMs = this.requestTimeoutMs): Promise<T> {
    await this.ensureProcessForRequest(method);
    const id = this.nextRequestId;
    this.nextRequestId += 1;

    const response = await new Promise<JsonRpcResponse<T>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Codex app-server 요청 시간이 초과되었습니다: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: JsonRpcResponse) => void,
        reject,
        timeout
      });

      this.writeJson({ id, method, params });
    });

    if (response.error) {
      throw new Error(response.error.message || `Codex app-server 요청 실패: ${method}`);
    }
    return response.result as T;
  }

  private async ensureProcessForRequest(method: string): Promise<void> {
    if (method === "initialize") {
      return;
    }
    if (!this.process || this.process.killed) {
      await this.connect();
    }
  }

  private onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  private sendNotification(method: string, params?: unknown): void {
    this.writeJson(params === undefined ? { method } : { method, params });
  }

  private writeJson(value: unknown): void {
    if (!this.process) {
      throw new Error("Codex app-server 프로세스가 시작되지 않았습니다.");
    }
    this.process.stdin.write(`${JSON.stringify(value)}\n`);
  }

  private handleStdout(chunk: Buffer): void {
    this.stdoutBuffer += chunk.toString("utf8");

    let newlineIndex = this.stdoutBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      newlineIndex = this.stdoutBuffer.indexOf("\n");

      if (!line) {
        continue;
      }
      this.handleMessage(JSON.parse(line) as JsonRpcResponse | JsonRpcNotification);
    }
  }

  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    if ("id" in message && typeof message.id === "number") {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);
      pending.resolve(message);
      return;
    }

    const notification = message as JsonRpcNotification;
    this.notificationListeners.forEach((listener) => listener(notification));
  }

  private handleExit(): void {
    this.process = null;
    this.connectPromise = null;
    const error = new Error("Codex app-server 프로세스가 종료되었습니다.");
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }
}

export const sharedCodexAppServerClient = new CodexAppServerClient();
