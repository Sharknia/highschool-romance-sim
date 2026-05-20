import {
  buildProjectHtml,
  createImageGenerationJob,
  createStarterProject,
  type CreateStarterProjectInput,
  validateProject,
  type CreateImageGenerationJobInput,
  type VnMakerProject
} from "@vn-maker/engine-core";
import {
  sharedCodexAppServerClient,
  type CodexImageGenerationInput,
  type CodexLoginStartResult,
  type CodexSession,
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
}

export interface ApiHandlerOptions {
  generatedAssetsDirectory?: string;
  codex?: CodexGenerationAdapter;
}

const allowedImageKinds = new Set(["portrait", "expression", "cg"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getProject(body: unknown): VnMakerProject {
  const record = asRecord(body);
  if (!record.project) {
    throw new Error("project 입력이 필요합니다.");
  }
  return record.project as VnMakerProject;
}

function getOptionalStarter(value: unknown): CreateStarterProjectInput | undefined {
  return value && typeof value === "object" ? value as CreateStarterProjectInput : undefined;
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
    generateImageAsset: (input: CodexImageGenerationInput) => sharedCodexAppServerClient.generateImageAsset(input)
  };
}

function createErrorResponse(error: unknown, status = 400): ApiResponse {
  return {
    status,
    body: {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  };
}

export function createApiRequestHandler(options: ApiHandlerOptions = {}) {
  const generatedAssetsDirectory = options.generatedAssetsDirectory || process.env.VN_MAKER_GENERATED_DIR || join(process.cwd(), "generated-assets");
  const codex = options.codex || createDefaultCodexAdapter();

  return async function handleApiRequestWithOptions(request: ApiRequest): Promise<ApiResponse> {
    try {
      if (request.method === "GET" && request.path === "/api/codex/session") {
        const session = await codex.readSession(false);
        return {
          status: 200,
          body: {
            ok: true,
            ...session,
            note: "Codex app-server의 ChatGPT managed OAuth 상태를 조회한다. OpenAI API key 입력은 사용하지 않는다."
          }
        };
      }

      if (request.method !== "POST") {
        return { status: 405, body: { ok: false, error: "지원하지 않는 메서드입니다." } };
      }

      if (request.path === "/api/codex/login") {
        const body = asRecord(request.body);
        const login = await codex.startLogin(getLoginFlow(body.flow));
        return { status: 200, body: { ok: true, login } };
      }

      if (request.path === "/api/codex/logout") {
        await codex.logout();
        return { status: 200, body: { ok: true } };
      }

      if (request.path === "/api/project/starter") {
        const body = asRecord(request.body);
        return { status: 200, body: { ok: true, project: createStarterProject(getOptionalStarter(body.starter)) } };
      }

      if (request.path === "/api/project/validate") {
        const issues = validateProject(getProject(request.body));
        return { status: 200, body: { ok: issues.every((issue) => issue.severity !== "error"), issues } };
      }

      if (request.path === "/api/project/build") {
        return { status: 200, body: { ok: true, artifact: buildProjectHtml(getProject(request.body)) } };
      }

      if (request.path === "/api/generation/jobs") {
        return { status: 200, body: { ok: true, job: createImageGenerationJob(createGenerationJobInput(request.body)) } };
      }

      if (request.path === "/api/generation/images") {
        const body = asRecord(request.body);
        const result = await codex.generateImageAsset({
          kind: getImageKind(body.kind),
          targetId: String(body.targetId || "scene-opening"),
          prompt: String(body.prompt || ""),
          style: String(body.style || "soft visual novel, clean anime, production-ready"),
          model: typeof body.model === "string" ? body.model : null,
          outputDirectory: generatedAssetsDirectory,
          publicPathPrefix: "/generated-assets"
        });

        return { status: 200, body: { ok: true, ...result } };
      }

      return { status: 404, body: { ok: false, error: "알 수 없는 API 경로입니다." } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("OAuth 로그인이 필요") ? 401 : 400;
      return createErrorResponse(error, status);
    }
  };
}

export const handleApiRequest = createApiRequestHandler();
